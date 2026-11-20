---
title: Quick start
category: documentation
tags: [lattice, documentation, setup]
description: Create your own Lattice repository, add a vault, and open your first site.
---

By the end of this guide, your Obsidian notes will be running as a website on your computer. The whole setup is **create your repository, clone it, add a vault, choose its folder, and run**.

You'll need a GitHub account, Git, and **Node.js 22.12 or newer**. Installing Node also installs npm, which runs the commands below.

## 1. Create your own repository

Open [Lattice on GitHub](https://github.com/jgx0/lattice) and click **Use this template → Create a new repository**. You can also go straight to [Create from template](https://github.com/jgx0/lattice/generate).

Choose your own account as the owner and name the repository something like **`my-lattice`**. Choose **Private** if you plan to keep your source notes there. Click **Create repository**.

You now have your own copy of Lattice. This is the repository you'll edit and connect to a hosting provider—not `jgx0/lattice`.

## 2. Clone your copy

On your new repository page, click **Code**, select **HTTPS**, and copy its URL. Open a terminal and run:

```sh
git clone https://github.com/YOUR-USERNAME/my-lattice.git
cd my-lattice
npm ci
```

Replace `YOUR-USERNAME` and `my-lattice` with the names in your copied URL. Keep the terminal open in this folder for the rest of the guide.

Want a quick look before adding your notes? Run `npm run dev` now to see the included demo. Press **Ctrl+C** when you're ready to continue.

## 3. Add your vault

Use Finder or File Explorer to copy your Obsidian vault into the project folder. For this guide, call the copy **`my-vault`**:

```text
my-lattice/
├── my-vault/
│   ├── .obsidian/
│   ├── Home.md
│   ├── Notes/
│   └── Attachments/
├── vault/                 # the included demo
├── publish.config.json
└── package.json
```

Copy the whole vault, including its hidden `.obsidian` folder if you want its installed theme and snippets. Make sure `my-vault` directly contains your notes, not another folder around them. You can leave the demo folder alone.

**Using a personal vault?** Add `my-vault/` on a new line in the project's `.gitignore` before committing anything. This keeps the copied notes out of your GitHub repository. You can still run and build the site locally. [[About/Security and privacy|Choose what to publish]] before putting the site online.

You do not have to copy the vault if you prefer to keep it where it is. The next step accepts its full folder path instead.

## 4. Point Lattice at the folder

Open **`publish.config.json`** in your project folder and replace its contents with:

```json
{
  "vault": "./my-vault",
  "site": { "title": "My notes" }
}
```

Change `my-vault` if your folder has a different name. That's enough to start. Lattice fills in the other settings and picks a note for the homepage.

To use a vault outside the project, set `vault` to its full folder path. On Windows, use forward slashes, such as `C:/Users/you/Documents/My Vault`.

## 5. Open your site

Back in the terminal:

```sh
npm run dev
```

Open **http://localhost:5173**, or the address printed in the terminal. Your notes should be there.

Try opening a note from the file tree. Press **Command+K** on Mac or **Ctrl+K** elsewhere to find a file quickly. Save an edit to a source note and watch the page refresh. Folder expansion choices are remembered in this browser.

Leave the terminal running while you work. Press **Ctrl+C** to stop the local server.

## Make it yours

You can stop here—you have a working local site. When you want to customize it:

- [[About/Configuration|Choose a homepage and site name]].
- [[About/Obsidian themes|Try your Obsidian theme]].
- [[About/Markdown and Bases|Add linked notes and an inline Base]].

## Put it online when you're ready

Running locally does not upload your vault or create a public site. Follow [[About/Deployment]] for Cloudflare Pages, Vercel, or Netlify.

A cloud builder can only use files it can access. If your vault is ignored by Git or lives elsewhere on your computer, use a local build and upload `dist/` yourself. For automatic cloud builds, put **only the notes and assets you're comfortable sharing** in your own repository. A private GitHub repository does not make the resulting website private.

## Stuck?

- **Folder not found:** check that `vault` matches the folder containing your notes.
- **Homepage not found:** remove `site.home` or change it to a note that exists.
- **`npm` not found:** install Node.js, then reopen your terminal.

[[About/Troubleshooting|Troubleshooting]] has more fixes. [[About/Documentation|Back to the guide index]].
