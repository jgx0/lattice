import type { CompiledSite } from "../src/types";

export type AppearanceBootstrap = {
  head: string;
  loader: string;
  body: string;
};
const bootstraps = new WeakMap<CompiledSite, AppearanceBootstrap>();

// Only compiler-emitted, same-origin theme assets may be used. Storage holds an
// ID, never CSS or a URL. Keep this restriction even for malformed site catalogs.
function localThemeUrl(url: string): boolean {
  if (!/^\/(?!\/)(?:[^?#\\\s]+\/)*_theme\/[a-zA-Z0-9._-]+\.css$/.test(url))
    return false;
  try {
    return !decodeURIComponent(url)
      .split("/")
      .some(
        (part) =>
          part === "." || part === ".." || /[\\\u0000-\u001f\u007f]/.test(part),
      );
  } catch {
    return false;
  }
}

function script(kind: string, source: string): string {
  return `<script data-published-appearance="${kind}">${source}</script>`;
}
function json(value: unknown): string {
  // Inline classic scripts are raw-text elements, regardless of JS quoting.
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Generated once for each immutable compiled snapshot, shared by all routes. */
export function appearanceBootstrap(site: CompiledSite): AppearanceBootstrap {
  const cached = bootstraps.get(site);
  if (cached) return cached;
  const defaultId = site.defaultTheme ?? "default";
  const choices = site.settings.allowThemeSwitching ? (site.themes ?? []) : [];
  const config = {
    mode: site.settings.theme,
    defaultId,
    defaultPreset:
      defaultId === "publish-theme" ||
      site.settings.communityTheme === "publish-theme"
        ? "publish"
        : site.settings.communityTheme.toLowerCase() === "minimal"
          ? "minimal"
          : "default",
    catalog: JSON.stringify(choices),
    choices: choices.filter(
      (choice) =>
        choice.id === defaultId ||
        !choice.cssUrl ||
        localThemeUrl(choice.cssUrl),
    ),
    overrides: site.themeOverridesCss ?? "",
  };
  const css = `<style id="published-appearance-critical">
:root{--published-initial-bg:#fff;--published-initial-text:#222;background:var(--published-initial-bg);color:var(--published-initial-text);color-scheme:light}
:root[data-theme="dark"]{--published-initial-bg:#1e1e1e;--published-initial-text:#dadada;color-scheme:dark}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--published-initial-bg:#1e1e1e;--published-initial-text:#dadada;color-scheme:dark}}
:where(body){background:var(--background-primary,var(--published-initial-bg));color:var(--text-normal,var(--published-initial-text))}
html[data-appearance-pending="true"] #root{visibility:hidden}
</style>`;
  const head = script(
    "head",
    `(function(){
var config=${json(config)}, root=document.documentElement, mode=config.mode, saved;
try { var prefs=JSON.parse(localStorage.getItem("publish-reader-preferences")||"{}"); if(prefs && !Array.isArray(prefs) && typeof prefs==="object" && ["light","dark","system"].indexOf(prefs.theme)!==-1) mode=prefs.theme; } catch(_) {}
var dark=mode==="dark"; if(mode==="system") { try { dark=matchMedia("(prefers-color-scheme: dark)").matches; } catch(_) {} }
root.dataset.theme=dark?"dark":"light";
try { saved=localStorage.getItem("publish-reader-community-theme"); } catch(_) {}
var choice=config.choices.find(function(theme){return theme.id===saved;});
var state=window.__latticeAppearance={mode:dark?"dark":"light",id:config.defaultId,selectedId:choice?choice.id:config.defaultId,defaultId:config.defaultId,defaultPreset:config.defaultPreset,catalog:config.catalog,overrides:config.overrides,choices:config.choices,css:"",defaultCss:"",pending:false,ready:null,cancel:function(){}};
state.applyBody=function(){if(!document.body)return; document.body.classList.toggle("theme-dark",root.dataset.theme==="dark");document.body.classList.toggle("theme-light",root.dataset.theme!=="dark");var active=config.choices.find(function(theme){return theme.id===state.id;});document.body.dataset.themePreset=state.id===config.defaultId?config.defaultPreset:state.id==="publish-theme"?"publish":active&&active.name.toLowerCase()==="minimal"?"minimal":"default";document.body.dataset.themeName=state.id;};
})();`,
  );
  const loader = script(
    "loader",
    `(function(){
var state=window.__latticeAppearance, style=document.getElementById("published-theme"), root=document.documentElement;
if(!state||!style)return;
state.css=state.defaultCss=style.textContent||"";
var choice=state.choices.find(function(theme){return theme.id===state.selectedId;});
if(!choice||choice.id===state.defaultId){state.ready=Promise.resolve(state);return;}
var active=true, timer, controller=typeof AbortController!=="undefined"?new AbortController():null, resolve;
state.pending=true;root.dataset.appearancePending="true";
state.ready=new Promise(function(done){resolve=done;});
function finish(css){if(!active)return;active=false;clearTimeout(timer);if(controller)controller.abort();if(typeof css==="string"){state.id=choice.id;state.css=css;style.textContent=css;root.dataset.community=state.id;}else{state.selectedId=state.id;}state.pending=false;state.applyBody();delete root.dataset.appearancePending;resolve(state);}
state.cancel=function(){finish();};
timer=setTimeout(function(){finish();},4000);
try { var request=choice.cssUrl?fetch(choice.cssUrl,controller?{signal:controller.signal}:{}).then(function(response){if(!response.ok)throw new Error("Theme request failed");return response.text();}):Promise.resolve("");request.then(function(css){finish(css+"\\n"+state.overrides);},function(){finish();}); } catch(_){finish();}
})();`,
  );
  const body = script(
    "body",
    `(function(){var state=window.__latticeAppearance;if(state)state.applyBody();})();`,
  );
  const result = { head: css + head, loader, body };
  bootstraps.set(site, result);
  return result;
}
