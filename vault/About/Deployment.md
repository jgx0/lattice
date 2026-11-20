---
title: Deployment
category: documentation
tags: [lattice, documentation, deployment]
description: Put your own Lattice site online with Cloudflare Pages, Vercel, or Netlify.
---

This guide takes your local site and gives it a public web address. If you haven't created your own repository and run Lattice yet, start with [[About/Quick start]].

You only need to choose **one** hosting provider. Cloudflare Pages, Vercel, and Netlify can all build a site from your GitHub repository. They'll rebuild it when you push changes.

## First, decide where your notes will live

**Automatic builds from GitHub:** the host needs your configuration, publishable notes, attachments, and selected theme files in **your own repository**. Put a reviewed copy of those files in a folder such as `site-vault/`, then set `"vault": "./site-vault"` in `publish.config.json`. Do not commit an entire personal archive just to make cloud builds work.

**Keep the vault on your computer:** if your vault is ignored by Git or lives outside the project, build locally and upload the generated `dist/` folder yourself. Follow the [[About/Deployment#CLI upload|Cloudflare upload steps]] below, or use your preferred static-file host.

A private GitHub repository can keep source files private, but the deployed website is still public. [[About/Security and privacy]] walks through choosing what to share.

## Build it once before connecting a host

In your project's terminal:

```sh
npm run build
npm run preview
```

Open **http://localhost:4173**. This is the version you'll deploy. Open a note directly by its URL, try an attachment, and check your theme. Preview won't update after edits until you run `npm run build` again. Press **Ctrl+C** to stop preview before running the next commands.

When you're happy with it, commit the files the cloud builder will need and push them to **your repository**. For example, if `site-vault/` contains only publishable material:

```sh
git add publish.config.json site-vault/
git commit -m "Add my published notes"
git push origin main
```

Check the files selected for the commit before running it. If `site-vault/` is in `.gitignore`, it won't be included; only remove that ignore rule after deciding those files can go to GitHub.

## Cloudflare Pages

### Git integration

1. Open [Cloudflare Pages setup](https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages).
2. Choose **Pages → Connect to Git** and authorize GitHub if asked.
3. Select **the repository you created from the Lattice template**, such as `YOUR-USERNAME/my-lattice`.
4. Keep the root directory at the repository root and use these settings:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variables | `NODE_VERSION=22`, `NPM_CONFIG_INCLUDE=dev` |

The development dependencies are needed to build the site. `NPM_CONFIG_INCLUDE=dev` keeps them installed on the builder. Node.js must be 22.12 or newer.

5. Save and deploy. Once the build finishes, open the address Cloudflare gives you.

The included `wrangler.jsonc` starts with `name: "lattice"`, `pages_build_output_dir: "./dist"`, and a pinned `compatibility_date`. Change its name to match your Pages project if you use Wrangler. `public/_headers` supplies the site's response headers and asset-cache rules.

### CLI upload

Use this route when you want to build from a vault kept on your computer. You'll upload the website, not the vault.

Create a Pages project once in your account, either in the dashboard or with:

```sh
npx wrangler pages project create my-lattice
```

Then build and upload:

```sh
npm ci --include=dev
npm run build
npx wrangler pages deploy dist --project-name=my-lattice
```

Replace `my-lattice` with your project name. Wrangler will ask you to authenticate if needed. These commands publish when you run them; Lattice doesn't supply hosting credentials.

Choose Git integration or Direct Upload when creating your Pages project. Cloudflare doesn't let you freely switch every existing project between the two workflows.

## Vercel

1. Open [Vercel's new-project page](https://vercel.com/new).
2. Import **your own template-created repository** from GitHub.
3. Leave the root directory at the repository root.
4. Confirm these settings, supplied by `vercel.json`:

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Install command | `npm ci --include=dev` |
| Build command | `npm run build` |
| Output directory | `dist` |

Choose Node.js 22 or newer in project settings, then deploy. Vercel gives you a URL when the build completes.

For reference, the configuration uses `framework: null`, `cleanUrls: true`, `outputDirectory: "dist"`, `installCommand: "npm ci --include=dev"`, and `buildCommand: "npm run build"`. You don't need to edit those values for a normal root-domain deployment. There is no catch-all rewrite to the homepage.

## Netlify

1. Open Netlify and choose **Add new site → Import an existing project**.
2. Connect GitHub and select **your own repository**.
3. Leave the build settings from `netlify.toml`: command `npm run build`, output `dist`, Node 22.
4. Deploy and open the generated address.

If your builder omits development dependencies, include them with `npm ci --include=dev`. The site itself is static and needs no Node server after the build.

## Check the public site

Try these on the provider's URL:

- Open a nested note, then reload it.
- Follow a heading link and an attachment.
- Switch themes if the picker is enabled.
- Open a made-up URL. It should show the missing-page screen, not the homepage.
- Confirm that excluded notes and private details are absent.

Lattice emits `404.html`. Keep the host's normal file routing and **don't add an SPA rewrite to `index.html`**. A missing URL should return HTTP 404. If an old note remains online after you exclude it, replace or clear the previous deployment rather than leaving stale files behind.

## Deploy under a subdirectory

Most provider URLs use the default `base: "/"`. Only change this if the site really lives below a path, such as `example.com/notes/`:

```json
{
  "vault": "./site-vault",
  "base": "/notes/",
  "site": { "title": "My notes" }
}
```

Rebuild and mount the **contents** of `dist/` at `/notes/`. The output won't contain an extra `notes/` folder. Revisit host routing and the path patterns in `public/_headers`, `vercel.json`, and `netlify.toml` when changing the mount path.

For GitHub Pages project sites, the base is usually your own repository name, such as `/my-lattice/`, not `/lattice/` unless that is your name. Use your own Pages deployment workflow to publish `dist/`.

## Updating your site

With Git-connected hosting, edit the publishable files, check the site locally, commit, and push to your own deployment branch. Your provider runs the next build. With manual hosting, run `npm run build` and upload the new `dist/` output again.

For your own site, use `npm run build` and `npm run preview` before an update. The build includes TypeScript checking; preview lets you inspect the generated pages. `npm run check` additionally runs Lattice's development regression suite, which assumes the included demo configuration. Use that suite when contributing changes to Lattice, not as the only test of your personalized site.

### The inherited GitHub check

The template includes `.github/workflows/verify.yml`, which runs the development checks on Node 22 and 24 for pushes and pull requests. It **does not deploy**. After you customize the configuration, this workflow may fail because some tests expect the demo; an ignored local vault also isn't available to GitHub's runner.

For a personal site, open **your repository → Actions → Verify → ⋯ → Disable workflow** if you aren't using that check. Alternatively, adapt the workflow to build your committed publishing vault with `npm run build`. Your hosting provider's Git integration can still build and deploy the site independently.

Setting up a host requires your own account, and no hosting account or live deployment is provisioned by these files. Authentication and confirmation are still required.

[[About/Troubleshooting|Deployment troubleshooting]] · [[About/Documentation|Guide index]].
