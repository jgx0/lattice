# Lattice

**Turn your Obsidian vault into a website—with your theme and connected notes intact.**

Lattice is an independent alternative to Obsidian Publish. Your notes become a static website with wikilinks, hover previews, backlinks, graphs, a quick switcher, and optional stacked pages. You keep your Markdown files and choose where to host the result.

[Get started](#quick-start) · [Try a theme](#make-it-look-like-your-vault) · [Put it online](#put-your-site-online) · [Documentation](vault/About/Documentation.md)

## Quick start

**Use the template to make your own repo, clone it, add your vault, point Lattice at the folder, and run.** You don't need to convert notes or configure every option.

You'll need a GitHub account, Git, and **Node.js 22.12 or newer**. Node includes npm.

### 1. Create your own Lattice repository

On [jgx0/lattice](https://github.com/jgx0/lattice), click **Use this template → Create a new repository**. Choose your account and a name such as `my-lattice`.

[**Create your repository from the Lattice template →**](https://github.com/jgx0/lattice/generate)

This gives you your own copy to edit and deploy. Choose a private repository if you intend to keep source notes there, but remember: a private repository does not make a deployed website private.

### 2. Clone your copy and install

On your new repository page, open **Code → HTTPS** and copy the URL. In a terminal:

```sh
git clone https://github.com/YOUR-USERNAME/my-lattice.git
cd my-lattice
npm ci
```

Replace the example username and repository name with yours. Keep this terminal in the project folder for the remaining commands.

### 3. Add a vault and choose its folder

Copy your vault into the project using Finder or File Explorer. In this example, the copy is called **`my-vault`**:

```text
my-lattice/
├── my-vault/
│   ├── .obsidian/       # include this for your theme and snippets
│   ├── Home.md
│   └── Attachments/
├── publish.config.json
└── package.json
```

Leave the included `vault/` demo alone. Open **`publish.config.json`** and replace its contents with:

```json
{
  "vault": "./my-vault",
  "site": { "title": "My notes" }
}
```

Change the folder name to match yours. That's enough—Lattice fills in defaults and picks a note for the homepage. You can also point `vault` at a full folder path instead of copying it; your source notes are not moved or rewritten.

**Personal vault?** Add `my-vault/` to `.gitignore` before committing. It can still be used for local builds. For automatic cloud builds, your own repository must contain the publishable notes the host needs; use a reviewed copy, not an entire private archive.

### 4. Run

```sh
npm run dev
```

Open **http://localhost:5173**, or the address printed in the terminal. **You're ready to go.** Save a note and the page refreshes. Keep the terminal running while you work; press **Ctrl+C** to stop it.

Press **Command+K** on Mac or **Ctrl+K** elsewhere to find a file quickly. Folder expansion choices are saved in your browser. Reader settings lets you change color mode, panels, stacking, and the quick switcher.

**Want to try the demo first?** Run `npm run dev` after step 2 without editing the configuration.

[Follow the longer quick-start walkthrough](vault/About/Quick%20start.md)

## Make it yours

Once the site is running, follow whichever guide you need:

- [Choose a homepage and site name](vault/About/Configuration.md).
- [Try your Obsidian theme](vault/About/Obsidian%20themes.md).
- [Create linked notes and a Base table](vault/About/Markdown%20and%20Bases.md).
- [Leave private notes out](vault/About/Security%20and%20privacy.md).

There is no requirement to read all the settings before starting. To choose a homepage, for example, add `"home": "Home.md"` inside `site`, using a note's actual vault-relative filename.

## Make it look like your vault

Lattice can use the real theme CSS and enabled snippets from `.obsidian/appearance.json`, plus `publish.css`. The demo starts with **Default (Obsidian)** and offers **Publish** and **Minimal** in Reader settings.

To start a site with an installed theme:

```json
{
  "vault": "./my-vault",
  "theme": "Minimal",
  "site": { "title": "My notes", "theme": "system" }
}
```

Top-level `theme` selects the CSS theme; `site.theme` selects light, dark, or system color mode. Use `"theme": "publish-theme"` for Lattice's built-in Publish style, or omit top-level `theme` to follow your vault's selection.

[The theme tutorial](vault/About/Obsidian%20themes.md) shows how to install a theme, add a snippet, and let readers choose from an allowlist. Themes do not run Obsidian plugins or editor-only controls.

## Put your site online

First [review which notes should be public](vault/About/Security%20and%20privacy.md), then choose one hosting provider. Connect **your own template-created repository**, not `jgx0/lattice`.

<p>
  <a href="https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages"><img src="docs/assets/cloudflare-pages-button.svg" alt="Open Cloudflare Pages setup" height="40" /></a>
  <a href="https://vercel.com/new"><img src="docs/assets/vercel-button.svg" alt="Open Vercel project setup" height="40" /></a>
</p>

These buttons open project setup. Select your repository, review the build settings, and confirm deployment in your own account. Clicking a button does not upload your vault or publish a site by itself.

| Provider | What to select | Build settings |
| --- | --- | --- |
| **Cloudflare Pages** | Connect Git and choose your repository | Framework None; build `npm run build`; output `dist`; `NODE_VERSION=22`, `NPM_CONFIG_INCLUDE=dev`. |
| **Vercel** | Import your repository | `vercel.json` sets a static build and `dist` output; select Node 22 or newer. |
| **Netlify** | Import your repository | `netlify.toml` supplies the build/output settings. |

The host needs the notes, assets, theme files, and configuration in your repository. If your vault is ignored by Git or kept only on your computer, build locally instead:

```sh
npm run build
npm run preview
```

Open **http://localhost:4173** to inspect the finished website, then upload **only `dist/`** to a static host. The finished site needs no Node runtime or source vault. The development and preview servers are local tools, not production hosting services.

[The deployment tutorial](vault/About/Deployment.md) walks through each provider, manual Cloudflare uploads, custom paths, and checking the public URL. It also explains why you should keep normal file routing rather than add an SPA rewrite to the homepage.

## Things to know before sharing

- Every note that is not excluded is published in full—even if the homepage doesn't link to it.
- Use `site.hiddenPaths`, unquoted `publish: false`, or unquoted `private: true` to exclude notes before rendering.
- Folding a folder or hiding the properties panel is not a privacy control. Public properties and note text remain in public reader/search data.
- Replace old deployments when excluding or renaming notes so stale pages do not remain online.
- Themes, external media, and remote fonts can contact other servers. Only use sources you trust.

[Walk through the privacy checks](vault/About/Security%20and%20privacy.md)

## Features and limits

Lattice supports wikilinks and aliases, heading/block links, note embeds, linked properties, callouts, tasks, footnotes, code, math, images, audio, video, inline PDFs, and embedded or inline Bases. Reading features include search, hover previews, backlinks, outlines, local/global graphs, and stacked pages.

Bases supports the functions described in [its guide](vault/About/Markdown%20and%20Bases.md), not every Obsidian expression. Obsidian plugins, Dataview, Canvas editing, Sync, collaboration, hosted accounts, and password protection are not included. Media playback depends on the browser.

[Explore all the guides](vault/About/Documentation.md) · [Fix a setup problem](vault/About/Troubleshooting.md)

## Improving Lattice

If you want to change the project itself, use a **GitHub fork** rather than a template copy so you can open a pull request against the original. [The contribution walkthrough](vault/About/Contributing.md) covers setup, making a change, running tests, and submitting it.

```sh
npm run check
npm audit
```

The [CI workflow](.github/workflows/verify.yml) checks Node 22 and 24; it does not deploy. These development checks assume the included demo. In your own template-created repository, disable the inherited **Verify** workflow in **Actions**, or adapt it to build your committed publishing vault. For your site's ordinary updates, use `npm run build` and `npm run preview`; [the deployment guide](vault/About/Deployment.md#the-inherited-github-check) explains the difference.

[Report a bug](https://github.com/jgx0/lattice/issues) with a small non-sensitive example if something doesn't work.

For large vaults, `npm run benchmark:build -- --notes 1000` runs a temporary synthetic benchmark without changing your notes. Compilation is indexed and cached within a build, but large output still needs memory and disk space. [How the build works](vault/About/Architecture.md)

## Credits and licensing

Lattice is maintained by [jgx0](https://github.com/jgx0) and is not affiliated with or endorsed by Obsidian. It uses React, Vite, Markdown-it, YAML, DOMPurify, jsdom, KaTeX, and Lucide. The bundled Minimal theme is by kepano and retains its original license. AI was used in development.

This repository currently makes no blanket open-source license grant for project code. Do not infer one from third-party theme licenses.
