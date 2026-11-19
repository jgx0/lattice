import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const count = Number(option("--notes", "300"));
if (!Number.isSafeInteger(count) || count < 1)
  throw new Error("--notes must be a positive integer.");
const sourceRoot = resolve(option("--root", process.cwd()));
const { loadConfig } = await import(
  pathToFileURL(join(sourceRoot, "build/config.ts")).href
);
const { compileVault } = await import(
  pathToFileURL(join(sourceRoot, "build/compile.ts")).href
);
const { renderPublishedPage, createPageRenderer } = await import(
  pathToFileURL(join(sourceRoot, "build/staticPages.ts")).href
);
const directory = await mkdtemp(join(tmpdir(), "lattice-benchmark-"));
const savedEnvironment = {
  OBSIDIAN_VAULT: process.env.OBSIDIAN_VAULT,
  PUBLISH_CONFIG: process.env.PUBLISH_CONFIG,
};
delete process.env.OBSIDIAN_VAULT;
delete process.env.PUBLISH_CONFIG;
const name = (i: number) => `Note ${String(i).padStart(5, "0")}`;
try {
  await mkdir(join(directory, "vault", "Notes"), { recursive: true });
  await mkdir(join(directory, "vault", "Data"), { recursive: true });
  await writeFile(
    join(directory, "publish.config.json"),
    JSON.stringify({
      vault: "./vault",
      site: { title: "Benchmark", home: `Notes/${name(0)}.md` },
    }),
  );
  await writeFile(
    join(directory, "vault", "Data", "Related.base"),
    "filters:\n  and:\n    - file.folder == this.file.folder\n    - file.path != this.file.path\nviews:\n  - type: table\n    name: Related\n    limit: 8\n    order: [file.name, note.status]\n",
  );
  const paragraph =
    "A connected note carries its context with it. This representative paragraph exercises ordinary Markdown, **emphasis**, and a useful reading layout. Each page contains multiple headings and links to neighboring pages.\n\n";
  for (let i = 0; i < count; i++) {
    const links = Array.from(
      { length: 6 },
      (_, j) => `[[Notes/${name((i + j + 1) % count)}|Connection ${j + 1}]]`,
    ).join(" · ");
    const embed =
      i % 20 === 0 ? `![[Notes/${name((i + 1) % count)}#Details]]\n\n` : "";
    const base = i % 100 === 0 ? "![[Data/Related.base]]\n\n" : "";
    const body = `---\nstatus: growing\ntags: [benchmark, notes]\n---\n\n${paragraph}${links}\n\n## Details\n\n${paragraph}## Connections\n\n${embed}${base}${paragraph}## Next steps\n\n- [ ] Review the next connection\n- [x] Keep the source\n`;
    await writeFile(join(directory, "vault", "Notes", `${name(i)}.md`), body);
  }
  const config = await loadConfig(directory);
  const before = performance.now();
  const result = await compileVault(config);
  const compiled = performance.now();
  const template =
    '<!doctype html><html><head><title>Notes</title></head><body><div id="root"></div></body></html>';
  let bytes = 0;
  const renderPage =
    typeof createPageRenderer === "function"
      ? createPageRenderer(template, result.site)
      : (note: (typeof result.site.notes)[number]) =>
          renderPublishedPage(template, result.site, note);
  for (const note of result.site.notes)
    bytes += Buffer.byteLength(renderPage(note));
  const pages = performance.now();
  console.log(
    JSON.stringify({
      notes: count,
      compileMs: Math.round(compiled - before),
      pagesMs: Math.round(pages - compiled),
      totalMs: Math.round(pages - before),
      htmlMB: Number((bytes / 1024 / 1024).toFixed(2)),
      rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    }),
  );
} finally {
  for (const key of ["OBSIDIAN_VAULT", "PUBLISH_CONFIG"] as const) {
    if (savedEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnvironment[key];
  }
  await rm(directory, { recursive: true, force: true });
}
