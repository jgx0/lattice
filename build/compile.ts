import { createHash } from "node:crypto";
import { readFile, readdir, realpath, stat, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import type {
  CompiledSite,
  Note,
  PublishedNote,
  PublishedTheme,
  VaultFile,
} from "../src/types";
import { parseYaml, stripComments } from "../src/lib/markdown";
import {
  buildNotes,
  getBacklinks,
  resolveLink,
  resolveNote,
} from "../src/lib/model";
import { renderMarkdown, renderPreview } from "../src/lib/render";
import { createSanitizers } from "../src/lib/sanitize";
import { decodeTarget } from "../src/lib/utils";
import { PUBLISH_THEME_ID, type BuildConfig } from "./config";
import { renderPropertyValue } from "../src/lib/propertyValue";
import { validatePublishedRoutes } from "./staticPages";

export interface CompileResult {
  site: CompiledSite;
  /** Output-relative filenames; URLs are prefixed with config.base. */
  assets: Map<string, Uint8Array>;
  /** Absolute files and directories, including optional input paths, for watchers. */
  dependencies: string[];
}
const publishThemePath = fileURLToPath(
  new URL("../src/themes/publish-theme.css", import.meta.url),
);
const mimeTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  pdf: "application/pdf",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  ico: "image/x-icon",
};
const extension = (file: string) => path.extname(file).slice(1).toLowerCase();
const inside = (root: string, file: string) => {
  const relative = path.relative(root, file);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
};
const slash = (file: string) => file.split(path.sep).join("/");
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex").slice(0, 20);
const encodePath = (value: string) =>
  value.split("/").map(encodeURIComponent).join("/");
function hidden(file: string, config: BuildConfig): boolean {
  return (
    file.split("/").some((part) => part.startsWith(".")) ||
    config.settings.hiddenPaths.some((value) => {
      const name = value
        .replace(/\\/g, "/")
        .replace(/^\.\//, "")
        .replace(/\/$/, "");
      return file === name || file.startsWith(`${name}/`);
    })
  );
}
function decodeData(
  source: string,
): { mime: string; bytes: Uint8Array } | undefined {
  const match = /^data:([^;,]+)((?:;[^,]*)?),(.*)$/is.exec(source);
  if (!match) return undefined;
  try {
    return {
      mime: match[1].toLowerCase(),
      bytes: /;base64(?:;|$)/i.test(match[2])
        ? Buffer.from(match[3], "base64")
        : Buffer.from(decodeURIComponent(match[3]), "utf8"),
    };
  } catch {
    return undefined;
  }
}

/** Invalid publication metadata must fail closed, unlike the interactive editor. */
function publicationProperties(
  content: string,
  file: string,
): Record<string, unknown> {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!/^---[ \t]*(?:\n|$)/.test(normalized)) return {};
  const match = /^---[ \t]*\n([\s\S]*?)^(?:---|\.\.\.)[ \t]*(?:\n|$)/m.exec(
    normalized,
  );
  try {
    if (!match) throw new Error("Unterminated frontmatter.");
    const value = parseYaml(match[1]);
    if (value != null && (typeof value !== "object" || Array.isArray(value)))
      throw new Error("Frontmatter must be an object.");
    const properties = (value ?? {}) as Record<string, unknown>;
    for (const key of ["private", "publish"]) {
      if (properties[key] !== undefined && typeof properties[key] !== "boolean")
        throw new Error(`${key} must be a boolean.`);
    }
    return properties;
  } catch (error) {
    throw new Error(
      `Invalid publication frontmatter in ${file}: ${error instanceof Error ? error.message : error}`,
    );
  }
}

/** Compile a filesystem vault with an isolated DOM. No network, source-file emission, or global mutations. */
export async function compileVault(
  config: BuildConfig,
): Promise<CompileResult> {
  const dependencies = new Set<string>([
    config.configPath,
    config.root,
    config.vaultPath,
  ]);
  const assets = new Map<string, Uint8Array>();
  const files: VaultFile[] = [];
  const assetBytes = new Map<string, Uint8Array>();
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const vaultRoot = await realpath(config.vaultPath);
  const boundaryPaths = new Map<string, Promise<string>>();
  const fileTimes = new Map<string, { mtime: number; ctime: number }>();
  const safeRead = async (
    file: string,
    boundary: string,
    optional = false,
  ): Promise<Buffer | undefined> => {
    dependencies.add(file);
    try {
      const resolved = await realpath(file);
      let boundaryPath = boundaryPaths.get(boundary);
      if (!boundaryPath) {
        boundaryPath = realpath(boundary);
        boundaryPaths.set(boundary, boundaryPath);
      }
      const realBoundary = await boundaryPath;
      if (
        !inside(realBoundary, resolved) ||
        (inside(vaultRoot, file) && !inside(vaultRoot, resolved))
      )
        throw new Error(`Path escapes allowed root: ${file}`);
      const metadata = await stat(resolved);
      if (!metadata.isFile()) throw new Error(`Expected a file: ${file}`);
      fileTimes.set(file, {
        mtime: metadata.mtimeMs,
        ctime: metadata.birthtimeMs || metadata.ctimeMs,
      });
      dependencies.add(resolved);
      return await readFile(resolved);
    } catch (error) {
      if (optional && (error as NodeJS.ErrnoException).code === "ENOENT")
        return undefined;
      throw error;
    }
  };
  const scan = async (directory: string): Promise<void> => {
    dependencies.add(directory);
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = slash(path.relative(vaultRoot, absolute));
      // Never follow vault symlinks: prevents cycles, aliases, and accidental outside/private publication.
      if (entry.isSymbolicLink() || hidden(relative, config)) continue;
      if (entry.isDirectory()) {
        await scan(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = extension(relative);
      if (!["md", "markdown", "base"].includes(ext) && !mimeTypes[ext])
        continue;
      const bytes = (await safeRead(absolute, vaultRoot))!;
      if (ext === "md" || ext === "markdown") {
        const content = bytes.toString("utf8");
        const properties = publicationProperties(content, relative);
        if (properties.publish === false || properties.private === true)
          continue;
        files.push({
          path: relative,
          content,
          kind: "note",
          ...fileTimes.get(absolute),
        });
      } else if (ext === "base")
        files.push({
          path: relative,
          content: bytes.toString("utf8"),
          kind: "base",
        });
      else {
        assetBytes.set(relative, bytes);
        files.push({
          path: relative,
          content: ext === "svg" ? bytes.toString("utf8") : "",
          kind: "asset",
          mime: mimeTypes[ext],
          data: `data:${mimeTypes[ext]};base64,${bytes.toString("base64")}`,
        });
      }
    }
  };
  const assetHashes = new WeakMap<Uint8Array, string>();
  const emittedAssets = new WeakMap<Uint8Array, Map<string, string>>();
  const emitAsset = (
    bytes: Uint8Array,
    source: string,
    theme = false,
  ): string => {
    const cacheKey = `${theme ? "theme" : "media"}:${source}`;
    const emitted = emittedAssets.get(bytes)?.get(cacheKey);
    if (emitted) return emitted;
    const digest = assetHashes.get(bytes) ?? hash(bytes);
    assetHashes.set(bytes, digest);
    const ext = extension(source) || "bin";
    const cleanName = path.basename(source).replace(/[^a-zA-Z0-9._-]/g, "-");
    const key = theme
      ? `_theme/${digest}-${cleanName}`
      : `_assets/${source
          .split("/")
          .slice(0, -1)
          .map((segment) => segment.replace(/[^\p{L}\p{N}._-]/gu, "-"))
          .filter(Boolean)
          .join("/")}${source.includes("/") ? "/" : ""}${digest}.${ext}`;
    if (!assets.has(key)) assets.set(key, new Uint8Array(bytes));
    const url = config.base + encodePath(key);
    let entries = emittedAssets.get(bytes);
    if (!entries) {
      entries = new Map();
      emittedAssets.set(bytes, entries);
    }
    entries.set(cacheKey, url);
    return url;
  };
  try {
    await scan(vaultRoot);
    const notes = buildNotes(files);
    if (!notes.length)
      throw new Error(
        "There are no published Markdown notes in the configured vault.",
      );
    const settings = {
      ...config.settings,
      navigation: [...config.settings.navigation],
      hiddenPaths: [...config.settings.hiddenPaths],
    };
    const home = settings.home ? resolveNote(settings.home, notes) : notes[0];
    if (!home)
      throw new Error(
        `Configured home note is missing or private: ${settings.home}`,
      );
    settings.home = home.path;
    const urls = new Map(
      notes.map((note) => [
        note.path,
        note.path === home.path
          ? config.base
          : config.base + encodePath(note.slug),
      ]),
    );
    validatePublishedRoutes(
      notes.map((note) => ({ path: note.path, url: urls.get(note.path)! })),
      config.base,
    );
    const assetSources = new Map(
      files
        .filter((file) => file.kind === "asset")
        .map((file) => [file.data!, file.path]),
    );
    const svgSanitizers = createSanitizers(dom.window);
    for (const file of files)
      if (file.mime === "image/svg+xml") {
        assetSources.set(
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgSanitizers.sanitizeSvg(file.content))}`,
          file.path,
        );
      }
    const assetByName = (
      source: string,
      currentPath: string,
    ): string | undefined => {
      const clean = decodeTarget(source.split(/[?#]/)[0]).replace(/\\/g, "/");
      if (clean.includes("\0")) return undefined;
      const local = path.posix.normalize(
        path.posix.join(path.posix.dirname(currentPath), clean),
      );
      const root = path.posix.normalize(clean.replace(/^\//, ""));
      const candidates = clean.startsWith("/")
        ? [root]
        : /^\.\.?\//.test(clean)
          ? [local]
          : [local, root];
      return candidates.find(
        (candidate) =>
          !candidate.startsWith("../") && assetBytes.has(candidate),
      );
    };
    const noteByPath = new Map(notes.map((note) => [note.path, note]));
    const dataAssetUrls = new Map<string, string>();
    const fileAssetUrls = new Map<string, string>();
    const rewriteMarkup = (document: HTMLElement, note: Note): void => {
      document.querySelectorAll("a").forEach((link) => {
        const target = link.getAttribute("data-note");
        const href = link.getAttribute("href") || "";
        const embeddedNote = link
          .closest(".note-embed-content")
          ?.parentElement?.getAttribute("data-note");
        const local =
          !target &&
          href &&
          !href.startsWith("#") &&
          !/^(?:[a-z][\w+.-]*:|\/\/)/i.test(href)
            ? resolveLink(href, notes, embeddedNote || note.path)
            : undefined;
        const targetNote = target ? noteByPath.get(target) : local?.note;
        if (!targetNote) return;
        const anchor = link.getAttribute("data-anchor") || local?.anchor || "";
        link.setAttribute("data-note", targetNote.path);
        link.setAttribute("data-anchor", anchor);
        link.setAttribute(
          "href",
          urls.get(targetNote.path)! +
            (anchor ? `#${encodeURIComponent(anchor)}` : ""),
        );
      });
      document.querySelectorAll("[src],[poster],a[href]").forEach((element) => {
        for (const attr of element.tagName === "A"
          ? ["href"]
          : ["src", "poster"]) {
          const source = element.getAttribute(attr);
          if (
            !source ||
            source.startsWith("#") ||
            /^(?:https?:|mailto:|tel:|\/\/)/i.test(source) ||
            (attr === "href" && element.classList.contains("internal-link"))
          )
            continue;
          const embeddedNote = element
            .closest(".note-embed-content")
            ?.parentElement?.getAttribute("data-note");
          const currentPath = embeddedNote || note.path;
          const cachedData = dataAssetUrls.get(source);
          if (cachedData) {
            element.setAttribute(attr, cachedData);
            continue;
          }
          const original = assetSources.get(source);
          const data = decodeData(source);
          if (data) {
            const ext = Object.entries(mimeTypes).find(
              ([, mime]) => mime === data.mime,
            )?.[0];
            if (!ext) {
              element.removeAttribute(attr);
              continue;
            }
            const url = emitAsset(
              original && data.mime !== "image/svg+xml"
                ? (assetBytes.get(original) ?? data.bytes)
                : data.bytes,
              original || `inline.${ext}`,
            );
            dataAssetUrls.set(source, url);
            element.setAttribute(attr, url);
          } else {
            const relative = assetByName(source, currentPath);
            if (!relative) {
              if (attr !== "href") element.removeAttribute(attr);
              continue;
            }
            let url = fileAssetUrls.get(relative);
            if (!url) {
              let bytes = assetBytes.get(relative)!;
              if (extension(relative) === "svg")
                bytes = Buffer.from(
                  sanitizers.sanitizeSvg(Buffer.from(bytes).toString("utf8")),
                );
              url = emitAsset(bytes, relative);
              fileAssetUrls.set(relative, url);
            }
            const suffix = /[?#].*$/.exec(source)?.[0] || "";
            element.setAttribute(attr, url + suffix);
          }
        }
      });
    };
    let currentNote: Note | undefined;
    const sanitizers = createSanitizers(dom.window, {
      transformHtml: (body) => {
        if (currentNote) rewriteMarkup(body, currentNote);
      },
    });
    const published: PublishedNote[] = notes.map((note) => {
      currentNote = note;
      return {
        ...note,
        url: urls.get(note.path)!,
        // Readers/search need public prose, not source or invisible author comments.
        content: "",
        body: stripComments(note.body),
        html: renderMarkdown(note, notes, files, sanitizers),
        previewHtml: renderPreview(note, notes, files, sanitizers),
        propertyHtml: Object.fromEntries(
          Object.entries(note.properties).map(([key, value]) => [
            key,
            renderPropertyValue(
              value,
              notes,
              note.path,
              (target, anchor) =>
                urls.get(target.path)! +
                (anchor ? `#${encodeURIComponent(anchor)}` : ""),
            ),
          ]),
        ),
        outgoing: [
          ...new Set(
            note.links
              .map((link) => resolveNote(link, notes, note.path)?.path)
              .filter((value): value is string => !!value),
          ),
        ],
        backlinks: getBacklinks(note, notes).map((candidate) => candidate.path),
      };
    });
    currentNote = undefined;
    const obsidianRoot = path.join(vaultRoot, ".obsidian");
    const appearancePath = path.join(obsidianRoot, "appearance.json");
    const appearanceBytes = await safeRead(appearancePath, vaultRoot, true);
    let appearance: Record<string, unknown> = {};
    if (appearanceBytes) {
      try {
        appearance = JSON.parse(appearanceBytes.toString("utf8"));
      } catch {
        throw new Error(`Invalid Obsidian appearance JSON: ${appearancePath}`);
      }
      if (
        !appearance ||
        typeof appearance !== "object" ||
        Array.isArray(appearance)
      )
        throw new Error(
          `Invalid Obsidian appearance object: ${appearancePath}`,
        );
    }
    if (
      !settings.accent &&
      typeof appearance.accentColor === "string" &&
      /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(appearance.accentColor)
    )
      settings.accent = appearance.accentColor;
    const cssParts: string[] = [];
    const rewriteCss = async (
      css: string,
      file: string,
      boundary: string,
      ancestors: ReadonlySet<string> = new Set(),
    ): Promise<string> => {
      const canonical = await realpath(file).catch(() => file);
      if (ancestors.has(canonical))
        throw new Error(`Circular CSS import: ${file}`);
      const stack = new Set([...ancestors, canonical]);
      // Preserve comments/string literals and remote imports. Local imports become emitted,
      // recursively rewritten stylesheets, retaining their media/supports/layer suffix.
      const expression =
        /\/\*[\s\S]*?(?:\*\/|$)|(?<importPrefix>@import\s+)(?<importSource>url\(\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:\\.|[^)\\])*?)\s*\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')(?<importSuffix>[^;]*;)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\burl\(\s*(?:"(?<doubleUrl>(?:\\.|[^"\\])*)"|'(?<singleUrl>(?:\\.|[^'\\])*)'|(?<bareUrl>(?:\\.|[^)\\])*?))\s*\)/gi;
      let rewritten = "",
        end = 0;
      for (const match of css.matchAll(expression)) {
        rewritten += css.slice(end, match.index);
        const isImport = !!match.groups?.importPrefix;
        const importSource = match.groups?.importSource?.trim() || "";
        const source = isImport
          ? (/^url\(/i.test(importSource)
              ? importSource.slice(4, -1).trim()
              : importSource
            ).replace(/^(["'])([\s\S]*)\1$/, "$2")
          : (
              match.groups?.doubleUrl ??
              match.groups?.singleUrl ??
              match.groups?.bareUrl ??
              ""
            ).trim();
        if (
          (!isImport && !/^url\(/i.test(match[0])) ||
          !source ||
          /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(source)
        )
          rewritten += match[0];
        else {
          const [target] = source.split(/[?#]/);
          const decoded = decodeTarget(target).replace(/\\([ ()'"\\])/g, "$1");
          const absolute = path.resolve(path.dirname(file), decoded);
          if (
            isImport
              ? extension(absolute) !== "css"
              : !mimeTypes[extension(absolute)]
          )
            throw new Error(
              `Unsupported CSS ${isImport ? "import" : "asset"}: ${source} in ${file}`,
            );
          if (
            inside(vaultRoot, absolute) &&
            !inside(obsidianRoot, absolute) &&
            hidden(slash(path.relative(vaultRoot, absolute)), config)
          )
            throw new Error(`CSS references a hidden vault asset: ${source}`);
          const asset = (await safeRead(absolute, boundary))!;
          let safeAsset: Uint8Array = asset;
          if (isImport)
            safeAsset = Buffer.from(
              await rewriteCss(
                asset.toString("utf8"),
                absolute,
                boundary,
                stack,
              ),
            );
          else if (extension(absolute) === "svg")
            safeAsset = Buffer.from(
              sanitizers.sanitizeSvg(asset.toString("utf8")),
            );
          const suffix = /[?#].*$/.exec(source)?.[0] || "";
          const emittedUrl = JSON.stringify(
            emitAsset(safeAsset, path.basename(absolute), true) + suffix,
          );
          rewritten += isImport
            ? `${match.groups!.importPrefix}url(${emittedUrl})${match.groups!.importSuffix}`
            : `url(${emittedUrl})`;
        }
        end = match.index! + match[0].length;
      }
      return rewritten + css.slice(end);
    };
    const readCss = async (
      file: string,
      boundary: string,
      optional = false,
    ): Promise<string | undefined> => {
      const bytes = await safeRead(file, boundary, optional);
      return bytes
        ? await rewriteCss(bytes.toString("utf8"), file, boundary)
        : undefined;
    };
    const loadCss = async (
      file: string,
      boundary: string,
      optional = false,
    ): Promise<void> => {
      const css = await readCss(file, boundary, optional);
      if (css !== undefined) cssParts.push(css);
    };
    const themesRoot = path.join(obsidianRoot, "themes");
    const themeInputs = new Map<
      string,
      { name: string; identity: string; css: string; id?: string }
    >();
    const readTheme = async (reference: string): Promise<string> => {
      if (
        !reference ||
        (!path.isAbsolute(reference) &&
          (reference.includes("/") ||
            reference.includes("\\") ||
            reference === ".."))
      )
        throw new Error(`Invalid Obsidian theme name: ${reference}`);
      // The exact reserved name belongs to the tool, never the vault or config root.
      const builtIn = reference === PUBLISH_THEME_ID;
      const file = builtIn
        ? publishThemePath
        : path.isAbsolute(reference)
          ? reference
          : path.join(themesRoot, reference, "theme.css");
      try {
        // Validate every reference, even aliases of an already-read theme: a vault
        // symlink must not bypass safeRead's boundary checks through the cache.
        const bytes = (await safeRead(file, path.dirname(file)))!;
        const key = await realpath(file);
        if (!themeInputs.has(key) || (builtIn && !themeInputs.get(key)!.id)) {
          const css = await rewriteCss(
            bytes.toString("utf8"),
            file,
            path.dirname(file),
          );
          themeInputs.set(key, {
            name: builtIn
              ? "Publish"
              : path.isAbsolute(reference)
                ? path.basename(path.dirname(reference))
                : reference,
            // Relative identities keep IDs stable when a project is moved. Only their
            // digest is public; neither the catalog nor filenames expose source paths.
            identity: builtIn
              ? PUBLISH_THEME_ID
              : `css:${slash(path.relative(config.root, key))}`,
            css,
            ...(builtIn ? { id: PUBLISH_THEME_ID } : {}),
          });
        }
        return key;
      } catch (error) {
        throw new Error(
          `Unsupported or unavailable theme "${reference}": ${error instanceof Error ? error.message : error}`,
        );
      }
    };
    const theme =
      config.theme ??
      (typeof appearance.cssTheme === "string" && appearance.cssTheme
        ? appearance.cssTheme
        : settings.communityTheme !== "default"
          ? settings.communityTheme
          : undefined);
    let selectedTheme: string | undefined;
    if (theme && theme !== "default") {
      selectedTheme = await readTheme(theme);
      const selected = themeInputs.get(selectedTheme)!;
      cssParts.push(selected.css);
      settings.communityTheme = selected.id ?? selected.name;
    }
    const themePartsCount = cssParts.length;
    let themes: PublishedTheme[] | undefined;
    let defaultTheme: string | undefined;
    if (settings.allowThemeSwitching) {
      // Built-ins are not part of the installed-theme allowlist, including [].
      await readTheme(PUBLISH_THEME_ID);
      dependencies.add(obsidianRoot);
      dependencies.add(themesRoot);
      let references = config.themes;
      if (references === undefined) {
        references = [];
        // Discovery never follows symlinks (including the containing directories),
        // dot directories, or metadata; only installed theme.css files are inputs.
        const plainDirectory = async (directory: string): Promise<boolean> => {
          try {
            return (await lstat(directory)).isDirectory();
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT")
              return false;
            throw error;
          }
        };
        if (
          (await plainDirectory(obsidianRoot)) &&
          (await plainDirectory(themesRoot))
        ) {
          const entries = await readdir(themesRoot, { withFileTypes: true });
          entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
          for (const entry of entries) {
            if (
              !entry.isDirectory() ||
              entry.name.startsWith(".") ||
              entry.name === PUBLISH_THEME_ID
            )
              continue;
            const directory = path.join(themesRoot, entry.name);
            const file = path.join(directory, "theme.css");
            dependencies.add(directory);
            dependencies.add(file);
            try {
              if ((await lstat(file)).isFile()) references.push(entry.name);
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ENOENT")
                throw error;
            }
          }
        }
      }
      for (const reference of references) {
        if (reference !== "default") await readTheme(reference);
      }
      themes = [{ id: "default", name: "Default (Obsidian)", cssUrl: "" }];
      defaultTheme = "default";
      const ids = new Set(["default"]);
      const choices = [...themeInputs].sort(
        ([, a], [, b]) =>
          Number(!!b.id) - Number(!!a.id) ||
          a.name.localeCompare(b.name, "en") ||
          a.identity.localeCompare(b.identity, "en"),
      );
      for (const [key, choice] of choices) {
        const slug =
          choice.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "theme";
        const stem =
          choice.id ?? `${slug}-${hash(Buffer.from(choice.identity))}`;
        let id = stem;
        for (let suffix = 2; ids.has(id); suffix++) id = `${stem}-${suffix}`;
        ids.add(id);
        const cssUrl = emitAsset(
          Buffer.from(choice.css),
          `theme-${slug}.css`,
          true,
        );
        themes.push({ id, name: choice.name, cssUrl });
        if (key === selectedTheme) defaultTheme = id;
        dependencies.add(path.dirname(key));
      }
    }
    const snippetNames =
      config.snippets ??
      (Array.isArray(appearance.enabledCssSnippets)
        ? appearance.enabledCssSnippets.filter(
            (item): item is string => typeof item === "string",
          )
        : []);
    for (const snippet of snippetNames) {
      if (
        !path.isAbsolute(snippet) &&
        (snippet.includes("/") || snippet.includes("\\") || snippet === "..")
      )
        throw new Error(`Invalid Obsidian snippet name: ${snippet}`);
      const snippetPath = path.isAbsolute(snippet)
        ? snippet
        : path.join(
            obsidianRoot,
            "snippets",
            `${snippet.replace(/\.css$/i, "")}.css`,
          );
      await loadCss(snippetPath, path.dirname(snippetPath));
    }
    await loadCss(path.join(vaultRoot, "publish.css"), vaultRoot, true);
    for (const file of config.css) await loadCss(file, path.dirname(file));
    const variables: string[] = [];
    if (settings.accent)
      variables.push(
        `--accent:${settings.accent};--interactive-accent:${settings.accent};--text-accent:${settings.accent}`,
      );
    if (
      typeof appearance.baseFontSize === "number" &&
      appearance.baseFontSize >= 8 &&
      appearance.baseFontSize <= 72
    )
      variables.push(`--font-text-size:${appearance.baseFontSize}px`);
    for (const [property, variable] of [
      ["textFontFamily", "--font-text"],
      ["monospaceFontFamily", "--font-monospace"],
    ] as const) {
      if (typeof appearance[property] === "string" && appearance[property])
        variables.push(
          `${variable}:${appearance[property]
            .split(",")
            .map((family) =>
              JSON.stringify(family.trim().replace(/^['"]|['"]$/g, "")),
            )
            .join(",")}`,
        );
    }
    if (variables.length) cssParts.push(`body{${variables.join(";")}}`);
    if (settings.customCss)
      cssParts.push(
        await rewriteCss(
          settings.customCss,
          path.join(vaultRoot, "publish.css"),
          vaultRoot,
        ),
      );
    const classes = new Set(config.bodyClasses);
    const homeClasses = home.properties.cssclasses;
    for (const value of Array.isArray(homeClasses)
      ? homeClasses
      : typeof homeClasses === "string"
        ? homeClasses.split(/[\s,]+/)
        : [])
      if (typeof value === "string" && value && !/\s/.test(value))
        classes.add(value);
    return {
      site: {
        version: 1,
        name: settings.title || path.basename(vaultRoot),
        settings,
        notes: published,
        themeCss: cssParts.join("\n"),
        bodyClasses: [...classes],
        ...(themes
          ? {
              themes,
              defaultTheme,
              themeOverridesCss: cssParts.slice(themePartsCount).join("\n"),
            }
          : {}),
      },
      assets,
      dependencies: [...dependencies].sort(),
    };
  } finally {
    dom.window.close();
  }
}
