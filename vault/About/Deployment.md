---
title: Deployment
category: documentation
tags: [lattice, documentation, deployment]
description: Build, inspect, and deploy only Lattice's static output to a production host.
---

Deploy **the generated `dist/` directory**, not the project checkout or the source vault. Lattice produces static HTML, application assets, referenced attachments, and theme assets; a production host does not need access to your notes or a running compiler.

## Build on your machine or in CI

Use Node.js 22.12 or newer. From the project root:

```sh
npm ci --include=dev
npm run check
npm run preview
```

`npm run check` runs type checking, all tests, and the production build. The build requires development dependencies: TypeScript, Vite, and build-time JSDOM are installed there. Do not use a production-only install such as `npm ci --omit=dev` for the builder. `--include=dev` is explicit so CI environments with `NODE_ENV=production` still install the toolchain.

`preview` serves the already-built output, normally at `http://localhost:4173`. It is a **local verification tool**, not a hardened production service. Likewise, the live development server is not the public deployment target.

## Review before upload

- Open the homepage and a deep note URL directly, including after a reload.
- Check links, heading anchors, navigation, and static note content with JavaScript disabled.
- Test images, audio, video, PDFs, and local theme assets where used.
- Inspect `dist/` for secrets, unwanted properties, copied quotations, and private details.
- Confirm there are no unresolved links or visible Base/embed errors on the routes you intend to share.
- Remove old deployment output when replacing a site; excluded notes must not survive as stale files on the host.

A successful build validates compilation, not the appropriateness of making every surviving sentence public. Follow [[About/Security and privacy]] for source exclusion and external-resource review.

## Static host requirements

Configure your host to serve `dist/` as the site's document root. Note routes are emitted as directory `index.html` files, so the host should serve directory indexes and preserve encoded URL paths. Each note's semantic HTML includes its content, navigation, outline, and backlinks before JavaScript runs.

Do not rely on a blanket single-page-app fallback that serves the homepage for every unknown URL; it can hide missing routes. The build emits `404.html`, and local development/preview return an actual 404 status for missing pages without mounting the reader over the error page. Configure the static host to use that missing-page document with a 404 status, then test a URL that does not exist. Configure HTTPS, caching, and any desired security headers on the host. There is no built-in login or password gate; private access requires separate hosting infrastructure.

## Cloudflare Pages

The root `wrangler.jsonc` identifies the Pages project with `name: "lattice"`, sets `pages_build_output_dir: "./dist"`, and pins a `compatibility_date`. These are Pages settings, not a Worker entry point. Change the project name if you use a different Pages project.

### Git integration

Open the [Cloudflare Pages setup dashboard](https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages), create a **Pages** project, and connect a Git repository that you control. Select the project root and configure:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js | 22.12 or newer in the Node 22 release line (`NODE_VERSION=22`) |
| Install dependencies | Set `NPM_CONFIG_INCLUDE=dev`; use `npm ci --include=dev` where an install command is configurable |

If the dashboard uses an automatic dependency install, ensure its environment does not omit development dependencies. With a custom install step, skip the automatic install if needed and run `npm ci --include=dev` before `npm run build`. The repository's Node version file selects Node 22, but verify the version reported in the build log.

### CLI upload

First create the Pages project in your Cloudflare account, using the dashboard or `npx wrangler pages project create lattice`. Then, from the project root:

```sh
npm ci --include=dev
npm run build
npx wrangler pages deploy dist --project-name=lattice
```

Wrangler requires authentication and an existing project named `lattice`; the commands above do not provide credentials. Choose Git integration or direct uploads when setting up the project, rather than assuming an existing project supports switching workflows.

`public/_headers` is copied into `dist/` for Cloudflare Pages static responses. It configures baseline security headers and immutable caching for hashed application, attachment, and theme assets. Review it alongside your theme and embed choices; headers do not add authentication or make published notes private.

## Vercel

The root `vercel.json` selects a static build with `framework: null`, `cleanUrls: true`, `outputDirectory: "dist"`, `installCommand: "npm ci --include=dev"`, and `buildCommand: "npm run build"`. It also defines security and hashed-asset cache headers without a blanket SPA rewrite. Use Node.js 22.12 or newer in the Node 22 release line in the project's dashboard settings.

Open the [Vercel dashboard](https://vercel.com/new), import a Git repository you control, and keep the root directory at this project's root. Verify the framework is **Other**, the install command includes development dependencies, the build command is `npm run build`, and the output directory is `dist` before deploying. Only the static output is served; the source vault is a build input.

No public repository URL is configured for this checkout. The dashboard link is a setup entry point, not a one-click clone/deploy button. Git-triggered deployments require a connected repository and a push to its configured deployment branch. If the source exists only locally, create and connect your own remote repository first; importing a dashboard project does not push this checkout for you.

## Netlify and continuous verification

The checked-in `netlify.toml` uses Node.js 22, runs `npm run build`, and publishes `dist`. It configures `nosniff`, referrer/permissions policies, and long-lived immutable caching for hashed application, attachment, and theme assets. It intentionally has no blanket SPA redirect. Ensure dependency installation includes the development toolchain.

The GitHub Actions verification workflow installs dependencies and runs `npm run check` on Node.js 22 and 24. It verifies the project but does not deploy it or provision hosting credentials. These host configurations are starting points, not a security certification or a private-access mechanism; no hosting account or live deployment is provisioned by the configuration files.

## Deploy under a subdirectory

Start with the default root `base: "/"` for the Cloudflare Pages, Vercel, and Netlify setups above. If you later host at a path such as `/notes/`, configure:

```json
{
  "vault": "./vault",
  "base": "/notes/",
  "site": { "title": "My notes", "home": "Welcome.md" }
}
```

Rebuild, then mount the **contents** of `dist/` at `/notes/` on the host. The base prefixes public URLs; it does not add a nested `notes/` directory to the output. Preview reads the emitted base manifest, so visit its printed base URL when checking the build.

Changing a domain alone does not require changing `base`; changing the mount path does. A correct base must reach note pages, the application bundle, `_assets/`, and `_theme/` consistently. Revisit host routing and the path patterns in `public/_headers`, `vercel.json`, and `netlify.toml` when moving away from `/`; the checked-in hashed-asset cache rules assume a root deployment.

## Updating the site

Edit locally, rerun the checks and build, and replace the deployment with the new output. Prefer atomic deployments or a host that versions releases, especially when note names or privacy settings change. Keep the source vault and its `.obsidian` settings on the build side; only deliberately emitted public files belong on the host.

[[About/Configuration|Configuration]] covers path overrides; [[About/Troubleshooting]] covers deep-link and asset failures.

[[About/Documentation|Documentation index]].
