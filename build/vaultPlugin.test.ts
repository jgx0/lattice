// @vitest-environment node
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { JSDOM } from "jsdom";
import { build, createServer, preview, type ViteDevServer, type PreviewServer } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompiledSite, PublishedNote } from "../src/types";
import { loadConfig, type BuildConfig } from "./config";
import { compileVault } from "./compile";
import { vaultPlugin } from "./vaultPlugin";
import { absoluteShellReferences, findPublishedNote, publishedPageFile, renderPublishedPage } from "./staticPages";

vi.mock("./compile", () => ({ compileVault: vi.fn() }));
const compiler = vi.mocked(compileVault);
const temporary: string[] = [];
const servers: ViteDevServer[] = [];
const previews: PreviewServer[] = [];
function messageType(value: unknown): string | undefined {
  return value && typeof value === "object" && "type" in value ? String(value.type) : undefined;
}

function note(pathname: string, url: string, body = "Note body"): PublishedNote {
  const title = pathname.split("/").pop()!.replace(/\.md$/, "");
  return {
    path: pathname, url, title, slug: url.replace(/^\//, ""), folder: pathname.split("/").slice(0, -1).join("/"),
    content: body, body, properties: {}, headings: [{ level: 2, text: "Details", id: "details" }], links: [], tags: [], words: 2,
    html: `<h2 id="details">Details</h2><p>${body}</p>`, previewHtml: `<p>${body}</p>`, outgoing: [], backlinks: [],
  };
}

async function fakeCompile(config: BuildConfig) {
  const entries = await readdir(config.vaultPath, { recursive: true });
  const notes: PublishedNote[] = [];
  for (const entry of entries.filter(entry => entry.endsWith(".md")).sort()) {
    const body = await readFile(path.join(config.vaultPath, entry), "utf8");
    if (body.includes("BROKEN")) throw new Error("Invalid fixture note");
    const route = entry.replace(/\.md$/, "").toLowerCase().replace(/ /g, "-");
    notes.push(note(entry, config.base + (entry === config.settings.home ? "" : route), body));
  }
  const asset = await readFile(path.join(config.vaultPath, "image.png"));
  const cssFile = path.join(config.vaultPath, ".obsidian", "snippets", "custom.css");
  const css = await readFile(cssFile, "utf8");
  const home = notes.find(candidate => candidate.path === config.settings.home);
  if (home) home.backlinks = notes.filter(candidate => candidate !== home).map(candidate => candidate.path);
  const site: CompiledSite = { version: 1, name: "Fixture", settings: config.settings, notes, themeCss: css, bodyClasses: config.bodyClasses };
  return { site, assets: new Map([["_assets/image.png", new Uint8Array(asset)]]), dependencies: [config.vaultPath, config.configPath, cssFile] };
}

async function fixture(base = "/") {
  const container = await realpath(await mkdtemp(path.join(tmpdir(), "publish-plugin-")));
  temporary.push(container);
  const root = path.join(container, "project"), vault = path.join(container, "external-vault");
  await mkdir(root);
  await mkdir(path.join(vault, "Field Notes"), { recursive: true });
