import type { Note } from '../types';
import { basename, normalizePath, stripExtension } from './utils';

interface Candidate {
  note: Note;
  order: number;
  folders: string[];
}

interface CandidateIndex {
  first: Candidate;
  // The lexical winner for each folder prefix avoids scanning ambiguous names.
  byFolder: Map<string, Candidate>;
}

interface NoteIndex {
  length: number;
  selfPaths: Map<string, Note>;
  paths: Map<string, Note>;
  basenames: Map<string, CandidateIndex>;
  slugs: Map<string, CandidateIndex>;
  aliases: Map<string, CandidateIndex>;
  backlinks?: Map<string, Note[]>;
}

const indexes = new WeakMap<Note[], NoteIndex>();

export function notePathKey(path: string): string {
  return stripExtension(normalizePath(path)).toLocaleLowerCase();
}

function precedes(a: Candidate, b: Candidate): boolean {
  return (a.note.path.localeCompare(b.note.path) || a.order - b.order) < 0;
}

function addCandidate(map: Map<string, CandidateIndex>, key: string, candidate: Candidate): void {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = { first: candidate, byFolder: new Map() };
    map.set(key, bucket);
  } else if (precedes(candidate, bucket.first)) bucket.first = candidate;
  let prefix = '';
  for (let i = 0; i < candidate.folders.length; i++) {
    prefix = i ? `${prefix}/${candidate.folders[i]}` : candidate.folders[i];
    const previous = bucket.byFolder.get(prefix);
    if (!previous || precedes(candidate, previous)) bucket.byFolder.set(prefix, candidate);
  }
}

/**
 * Notes arrays and their lookup/link fields are treated as immutable snapshots.
 * Replacing an array rebuilds lazily; call this after in-place edits to paths,
 * folders, slugs, aliases or links, or after replacing/reordering array entries.
 * Length changes are detected automatically without scanning on every lookup.
 */
export function invalidateNoteIndex(notes: Note[]): void {
  indexes.delete(notes);
}

export function getNoteIndex(notes: Note[]): NoteIndex {
  const cached = indexes.get(notes);
  if (cached && cached.length === notes.length) return cached;
  const index: NoteIndex = {
    length: notes.length, selfPaths: new Map(), paths: new Map(),
    basenames: new Map(), slugs: new Map(), aliases: new Map(),
  };
  notes.forEach((note, order) => {
    const selfPath = normalizePath(note.path);
    const pathKey = notePathKey(note.path);
    // Exact matches preserve the first note in input order, not lexical order.
    if (!index.selfPaths.has(selfPath)) index.selfPaths.set(selfPath, note);
    if (!index.paths.has(pathKey)) index.paths.set(pathKey, note);
    const candidate = { note, order, folders: note.folder.split('/') };
    addCandidate(index.basenames, stripExtension(basename(note.path)).toLocaleLowerCase(), candidate);
    addCandidate(index.slugs, note.slug, candidate);
    const value = note.properties.aliases ?? note.properties.alias;
    const aliases = Array.isArray(value) ? value : value == null ? [] : [value];
    const keys = new Set<string>(aliases.filter((alias): alias is string => typeof alias === 'string')
      .map(alias => alias.toLocaleLowerCase()));
    for (const key of keys) addCandidate(index.aliases, key, candidate);
  });
  indexes.set(notes, index);
  return index;
}

export function findNoteCandidate(index: NoteIndex, path: string, folder: string[]): Note | undefined {
  const name = stripExtension(basename(path)).toLocaleLowerCase();
  const buckets = [index.basenames.get(name), index.slugs.get(path), index.aliases.get(path.toLocaleLowerCase())];
  const prefixes: string[] = [];
  for (let i = 0; i < folder.length; i++) prefixes.push(i ? `${prefixes[i - 1]}/${folder[i]}` : folder[i]);
  let best: Candidate | undefined;
  let bestProximity = -1;
  for (const bucket of buckets) {
    if (!bucket) continue;
    let candidate = bucket.first;
    let proximity = 0;
    for (let i = prefixes.length - 1; i >= 0; i--) {
      const local = bucket.byFolder.get(prefixes[i]);
      if (local) { candidate = local; proximity = i + 1; break; }
    }
    if (proximity > bestProximity || (proximity === bestProximity && best && precedes(candidate, best))) {
      best = candidate;
      bestProximity = proximity;
    }
  }
  return best?.note;
}
