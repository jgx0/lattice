---
title: Contributing
category: documentation
tags: [lattice, documentation, contributing]
description: Create your own site, report a problem, or send a focused change to Lattice.
---

Want your own notes website, or want to improve Lattice? Those use different GitHub workflows. Choose the path below; you do not need to contribute code to publish a site.

## Create your own site: use the template

For your own website, start with [**Use this template**](https://github.com/jgx0/lattice/generate). Choose your GitHub account and a repository name, then create the repository.

Clone **your new repository**, install the dependencies, and follow [[About/Quick start]] to select your vault and start the local site. When it looks right, [[About/Deployment]] explains how to put it online.

A template creates an independent repository for your site. It does **not** create a fork relationship for upstream pull requests. Use the fork workflow below when you want to send a change back to Lattice.

## Report a problem or suggest an improvement

Search [the issues](https://github.com/jgx0/lattice/issues) for an existing report. If you do not find one, open an issue with:

- What you were trying to do and what happened instead.
- Your Node/npm versions, the command you ran, and the error message.
- A small example note, Base, or CSS file that shows the problem, if needed.

Use a made-up example rather than attaching a private vault or screenshots containing personal information. For a substantial feature, discuss it in an issue before spending time on the implementation.

For a setup problem, try [[About/Troubleshooting]] first; it may have the fix you need.

## Contribute a change: fork the repository

A documentation clarification is a good first contribution. The steps below use `vault/About/Troubleshooting.md` as an example; replace that filename if you choose another guide.

### 1. Make your GitHub fork

Open [jgx0/lattice](https://github.com/jgx0/lattice) and click **Fork**. Create the fork under your GitHub account. GitHub keeps it connected to the original repository so you can open an upstream pull request.

With Git and **Node.js 22.12 or newer** installed, run the following. Replace `YOUR-USERNAME` with your GitHub username.

```sh
git clone https://github.com/YOUR-USERNAME/lattice.git
cd lattice
npm ci --include=dev
git switch -c docs/clearer-troubleshooting
```

You now have a local checkout of your fork and a separate branch for this change. Run the remaining commands from this `lattice` folder.

### 2. Make one small edit

Open `vault/About/Troubleshooting.md` in your editor. Clarify one confusing instruction: name the action a reader should take and what they should see afterward. Save the file.

Keep the frontmatter title, stable filename, and working links. The site supplies the page title, so do not add a duplicate top-level heading. Avoid including personal notes or changing unrelated files.

To see the page locally, run `npm run dev`, open the printed address, and navigate to the guide. The saved text should appear on the page. Stop the server with Ctrl+C when finished.

The demo guides also have a copy in `src/demo.ts` for reader and integration tests. Open that file, find `path: 'About/Troubleshooting.md'`, and update the matching `content` text to match your edited guide. Keep the surrounding entry unchanged. The text is inside a JavaScript template literal, so use these escapes when copying it:

```text
Markdown text    Inside the template literal
`                \`
\                \\
${               \${
```

The synchronization test checks that the guide and fixture contain the same text. This step is for contributing to the included demo, not for notes in your own publishing vault.

### 3. Check the change

```sh
npm run check
```

This runs type checking, the test suite, and a production build. A successful run finishes without errors and produces `dist/`. If a check fails, correct the problem and run it again before sending the change.

Review `git diff` to see the exact edit. For a documentation change, check that the steps are understandable to someone setting up their first site and that the links open the intended guides.

### 4. Commit and push to your fork

Stage the guide and its synchronized fixture, then commit and push your feature branch:

```sh
git add vault/About/Troubleshooting.md src/demo.ts
git commit -m "docs: clarify troubleshooting steps"
git push -u origin docs/clearer-troubleshooting
```

Your change is now on your fork's branch, not on the original repository. Do not include your personal vault, generated `dist/` output, or unrelated edits in the commit.

### 5. Open the upstream pull request

Open [Lattice's pull requests](https://github.com/jgx0/lattice/pulls) and choose **New pull request**, then **compare across forks**. Select `jgx0/lattice` as the base repository and your fork's `docs/clearer-troubleshooting` branch as the head. Use the upstream default branch as the base branch.

Give the pull request a short title. Explain the problem, the improvement, and which checks you ran; link the issue if there is one. The resulting pull request proposes your change to Lattice for review.

If a reviewer asks for an adjustment, edit locally, rerun the checks, commit the changed file, and push the same branch. The existing pull request updates automatically.

## Working on code or demo content?

[[About/Architecture]] has a short source-file map. Keep code changes focused and add a test for behavior you change. For reader changes, try a narrow screen, keyboard navigation, and both color modes; for generated-page changes, open a note URL directly.

Demo-content changes may also need updates to the in-memory test fixture and links. Keep examples clearly fictional, and use snippets or `publish.css` for site overrides rather than editing bundled third-party theme files.

Next: [[About/Architecture|find the right place to edit]] or [[About/Troubleshooting|resolve a local problem]]. [[About/Maintainer]] introduces the project's maintainer.

[[About/Documentation|Documentation index]].
