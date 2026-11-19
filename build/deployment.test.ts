// @vitest-environment node
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const text = (name: string) => readFile(new URL(name, root), "utf8");

describe("static deployment templates", () => {
  it("configures Cloudflare Pages with the generated output and pinned compatibility date", async () => {
    const config = JSON.parse(await text("wrangler.jsonc"));
    expect(config.name).toBe("lattice");
    expect(config.pages_build_output_dir).toBe("./dist");
    expect(config.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(config.main).toBeUndefined();
    const headers = await text("public/_headers");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    for (const path of ["/assets/*", "/_assets/*", "/_theme/*"])
      expect(headers).toContain(path);
    expect(headers.split("\n\n")[0]).not.toContain("immutable");
  });

  it("configures a static Vercel build without an SPA rewrite", async () => {
    const config = JSON.parse(await text("vercel.json"));
    expect(config.framework).toBeNull();
    expect(config.installCommand).toBe("npm ci --include=dev");
    expect(config.buildCommand).toBe("npm run build");
    expect(config.outputDirectory).toBe("dist");
    expect(config.cleanUrls).toBe(true);
    expect(config.rewrites).toBeUndefined();
    expect(config.routes).toBeUndefined();
    expect(
      config.headers.find((item: { source: string }) => item.source === "/(.*)")
        .headers,
    ).not.toContainEqual(expect.objectContaining({ key: "Cache-Control" }));
    for (const prefix of ["/assets/", "/_assets/", "/_theme/"]) {
      expect(
        config.headers.find(
          (item: { source: string }) => item.source === `${prefix}(.*)`,
        ).headers,
      ).toContainEqual({
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      });
    }
  });

  it("keeps README setup buttons local, provider-specific and honest about repository setup", async () => {
    const readme = await text("README.md");
    expect(readme).toContain(
      "https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages",
    );
    expect(readme).toContain(
      "https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjgx0%2Flattice",
    );
    expect(readme).toContain("https://github.com/jgx0/lattice");
    expect(readme).toContain("Both require your own account and confirmation");
    expect(readme).not.toContain("once the public repository URL exists");
    expect(readme).not.toMatch(
      /repository-url=.*(?:example|YOUR|placeholder)/i,
    );
    for (const file of [
      "docs/assets/cloudflare-pages-button.svg",
      "docs/assets/vercel-button.svg",
    ]) {
      const svg = await text(file);
      expect(svg).toContain("<title");
      expect(svg).not.toMatch(/<script|<image|href=/);
    }
  });
});
