---
title: Quick start
category: documentation
tags: [lattice, documentation, setup]
description: Clone Lattice, copy in your vault, choose its folder, and start your site.
---

**Clone the repo, put your vault in the project folder, point Lattice at it, and run.** You do not need to upload notes, convert your Markdown, or configure every setting.

You'll need Git and **Node.js 22.12 or newer** installed. Node includes npm, which runs the commands below.

## 1. Clone Lattice

Open a terminal and run:

```sh
git clone https://github.com/jgx0/lattice.git
cd lattice
npm ci
```

Keep this terminal open. Run the remaining commands from this `lattice` folder—not from inside your vault.

## 2. Copy your vault into the folder

Using Finder, File Explorer, or your usual file manager, copy your Obsidian vault into the `lattice` folder. For this guide, name the copied folder **`my-vault`**:

```text
lattice/
├── my-vault/
│   ├── .obsidian/
│   ├── Home.md
│   ├── Notes/
│   └── Attachments/
├── publish.config.json
└── package.json
```

Your notes and attachments stay as they are. Include the hidden `.obsidian` folder if you want Lattice to use your installed theme and enabled CSS snippets.

The included `vault/` folder is just the demo. Leave it alone; your own vault goes in a separate folder. Make sure `my-vault` is the actual vault folder containing your notes, not an extra folder wrapped around it.

## 3. Tell Lattice which folder to use

Open **`publish.config.json`** in the `lattice` folder. Replace its contents with:

```json
{
  "vault": "./my-vault",
  "site": {
    "title": "My notes"
  }
}
```

That's the only configuration you need to start. If your folder has a different name, change `./my-vault` to match it. Lattice uses the other settings' defaults and picks a note as the homepage.

If you want a specific homepage, add `"home": "Home.md"` inside `site`, using an existing note's full vault-relative filename, such as `Notes/Home.md`. This is a file path, not its frontmatter title or published URL. See [[About/Configuration]] for optional settings—you do not need them to get started.

## 4. Start your site

Back in the terminal, run:

```sh
npm run dev
```

Open **http://localhost:5173**, or the address printed in the terminal. Your notes should now be on the site.

**You're ready to go.** Edit a note in the copied vault and save it; Lattice rebuilds and refreshes the page. Leave the terminal running while you work. Press **Ctrl+C** when you want to stop the server.

If you prefer to keep your vault somewhere else, you can use its full folder path in `vault` instead of copying it. Lattice reads the folder you choose; it does not move or rewrite your source notes.

## Want to try the demo first?

After step 1, run `npm run dev` without changing anything. The original configuration opens the included demo vault. Stop the server, then follow steps 2 and 3 when you want to use your own notes.

## Ready to put it online?

Local setup and public deployment are separate. When you are happy with your site:

```sh
npm run build
```

Lattice writes the website to **`dist/`**. Deploy that folder to Cloudflare Pages, Vercel, Netlify, or another static host; follow [[About/Deployment]] for the provider steps. `npm run dev` only starts a local preview—it does not publish your vault to the internet.

**Before pushing your repository or deploying:** keep your personal vault out of Git (for this example, add `my-vault/` to `.gitignore`) and review which notes should be public. Notes are included unless you exclude them. [[About/Security and privacy]] explains how to hide private notes and folders.

## If something doesn't work

- **Folder not found:** check that `vault` matches the folder name and that you're editing the project's `publish.config.json`.
- **Homepage not found:** remove the optional `home` setting or point it at an existing note.
- **Command not found:** check that Node.js and npm are installed, then reopen your terminal.
- **A build error appears:** read the filename and message in the terminal; fix the note or setting and save again.

More help: [[About/Troubleshooting]].

[[About/Documentation|Documentation index]].
