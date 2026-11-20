---
title: Obsidian themes
category: documentation
tags: [lattice, documentation, themes]
description: Publish with actual Obsidian theme CSS, enabled snippets, and local assets.
---

Choose a look for your notes, add a small CSS snippet, and optionally let readers choose their own theme. You can use the built-in **Default (Obsidian)** and **Publish** themes without installing anything, or publish the original CSS from an installed Obsidian theme such as Minimal.

Before you begin, complete [[About/Quick start]] and keep your local site running. The examples assume your own vault is `my-vault/`. Keep the title and homepage settings you added in [[About/Configuration]].

## 1. Try the two built-in themes

Open `publish.config.json`. Add `theme` beside `vault`, not inside `site`:

```json
{
  "vault": "./my-vault",
  "theme": "default",
  "site": {
    "title": "My notes",
    "home": "Home.md",
    "theme": "system"
  }
}
```

If you have not created `Home.md`, keep your existing homepage setting or leave `home` out. Save and open the site in a fresh private browser window so an earlier reader choice does not mask your new default. **Default (Obsidian)** gives you the built-in baseline appearance.

Change top-level `theme` to `"publish-theme"` and save again. You should see the **Publish** style, with a compact file tree, generous page titles, and a page-information column on wider screens. Both built-ins ship with Lattice; neither needs a folder in `.obsidian/themes`.

Now open **Reader settings → Color scheme** and try **Light**, **Dark**, and **Adapt to system**. These change the color mode without changing the CSS theme. In the configuration, `site.theme` sets that color-mode default; top-level `theme` chooses the design.

## 2. Use Minimal's original CSS

If Minimal is not installed in your copied vault, open that vault in Obsidian. Go to **Settings → Appearance → Themes → Manage**, find **Minimal**, install it, and select it. No Obsidian plugin is needed.

Obsidian saves the theme at `.obsidian/themes/Minimal/theme.css` inside the vault and records the selection in `.obsidian/appearance.json`. If you are copying a vault from elsewhere, include its hidden `.obsidian` folder so those files come along.

Back in `publish.config.json`, change the top-level selection:

```json
"theme": "Minimal"
```

Save, then reload your private-window preview. The site should now use Minimal's installed CSS. This loads the theme's actual stylesheet, not a separate approximation of Minimal.

Alternatively, remove the top-level `theme` setting altogether to follow the theme selected in Obsidian. Lattice reads `cssTheme` from `.obsidian/appearance.json`; if nothing selects a theme, it uses Default (Obsidian). The included demo explicitly selects `"default"`, so merely selecting Minimal in Obsidian will not override that configuration.

If the build says Minimal is unavailable, check for `.obsidian/themes/Minimal/theme.css` in the vault named by `vault`. Choosing a name does not install or download a theme.

## 3. Add one visible snippet

In your copied vault, create `.obsidian/snippets/roomier-paragraphs.css` with:

```css
.markdown-rendered p {
  line-height: 1.8;
}
```

In Obsidian, open **Settings → Appearance → CSS snippets**, refresh the list if needed, and enable **roomier-paragraphs**. Leave `snippets` out of `publish.config.json` to follow Obsidian's enabled snippets.

Save a note or reload the local preview. Paragraphs should look more spacious. Obsidian records the enabled name in `enabledCssSnippets`; the relevant part of `.obsidian/appearance.json` looks like this:

```json
{
  "cssTheme": "Minimal",
  "enabledCssSnippets": ["roomier-paragraphs"]
}
```

You do not need to replace that file by hand. To select snippets only for the website, add top-level `"snippets": ["roomier-paragraphs"]` to your publish configuration. To publish without snippets, use `"snippets": []`. An omitted setting follows Obsidian; an empty array turns snippets off. A selected snippet file needs to exist.

## 4. Let readers choose a theme

Add `allowThemeSwitching` inside `site`:

```json
{
  "vault": "./my-vault",
  "theme": "Minimal",
  "site": {
    "title": "My notes",
    "allowThemeSwitching": true
  }
}
```

Keep your existing `home` and other site settings when adding this option. Save, open **Reader settings**, and find **Obsidian theme**. Choose **Publish**, then **Default (Obsidian)**, then **Minimal**. Each selection should change the page's styling without navigating away or editing your vault. Try **Color scheme** too: it remains independent of the theme picker.

With switching enabled, Lattice includes both built-ins, the site's selected theme, and other installed themes it discovers in `.obsidian/themes`. Switching is off by default.

If you want to limit the installed choices, add a top-level allowlist:

```json
"themes": ["Minimal"]
```

Only name themes already installed, or use existing CSS file paths. **Default (Obsidian)**, **Publish**, and the selected site theme always remain available, even if they are not in the allowlist. `"themes": []` skips discovery and leaves those choices; omitting `themes` discovers installed themes. With only Minimal installed, this allowlist does not visibly change the picker yet, but it prevents future installations from being offered automatically.

## 5. Check the default and reset saved choices

Reload after choosing a theme. Your browser remembers that choice, along with its separate color-mode preference. A new configuration default does not replace a reader's saved, still-available theme choice.

To see the configured default, use a fresh private window. To return your regular browser to the site defaults, close the site's tabs, clear its stored site data in your browser settings, and reopen it. Clearing site data also resets saved layout preferences and folder folds; there is no reset button in Reader settings.

On startup, Lattice applies the saved or configured color mode early and, when needed, loads the saved theme before revealing the content. If that startup theme request fails or takes more than **four seconds**, the page opens with the site's default theme instead. A failed switch made in Reader settings keeps the current theme and shows an error. The selected theme styles are local website assets; snippets and site overrides continue to apply to every choice.

## Optional: finishing touches and CSS limits

### Reuse font and accent settings

Lattice also reads the vault's accent color, base text size, and text/monospace font names from `.obsidian/appearance.json`. A configured `site.accent` overrides the vault accent. Font names do not download fonts: visitors need the font installed, or you can supply it through CSS. Numeric base text sizes from 8 to 72 pixels are supported.

### Choose where an override belongs

For a website-only style, put `publish.css` directly inside your vault. For a CSS file beside `publish.config.json`, add a top-level setting such as `"css": ["./site-overrides.css"]` after creating that file. Explicit theme and snippet CSS paths also start beside the configuration file, while simple names resolve inside the vault's `.obsidian` folder.

After the reader baseline, the theme layer loads in this order:

1. The selected theme's CSS.
2. Selected snippets in their listed order.
3. Vault-root `publish.css`, if present.
4. Additional files listed in `css`.
5. Appearance-derived variables and optional `site.customCss`.

Later rules can override earlier ones according to the usual CSS cascade. `bodyClasses` adds site-wide classes, and `cssclasses` on a note styles that note; homepage `cssclasses` also contribute site-wide classes.

### Keep styles portable

Local CSS imports, fonts, and supported images are copied into the built site with rewritten URLs. Keep a theme's assets in its theme directory, and a snippet or explicit CSS file's assets within its own directory. Vault-root `publish.css` can use allowed assets elsewhere in the vault, but not excluded ones. Missing files, unsupported assets, or circular imports cause build errors.

Use CSS you trust. Remote `@import` and `url(...)` references remain remote: readers may contact those third-party servers, and the styles may need an internet connection. The build does not download them for offline use.

Lattice is a reader, not Obsidian running in the browser. Theme rules targeting reading content and familiar Obsidian classes can work; editor panes, plugin controls, and Style Settings plugin state are not reproduced. Check your chosen style in light and dark modes and on a narrow screen. See [[About/Troubleshooting]] if a style does not load, or [[About/Security and privacy]] for more on external resources.

[[About/Documentation|Back to the documentation index]].
