import { useLayoutEffect, useRef, useState } from "react";
import type { CompiledSite } from "./types";

type InitialAppearance = {
  mode: "light" | "dark";
  id: string;
  selectedId: string;
  defaultId: string;
  catalog: string;
  defaultCss: string;
  css: string;
  pending: boolean;
  ready: Promise<InitialAppearance>;
  cancel: () => void;
};
function initialAppearance(site: CompiledSite): InitialAppearance | undefined {
  const state = (window as Window & { __latticeAppearance?: InitialAppearance })
    .__latticeAppearance;
  const choices = site.settings.allowThemeSwitching ? (site.themes ?? []) : [];
  if (
    !state ||
    typeof state !== "object" ||
    !["light", "dark"].includes(state.mode) ||
    typeof state.id !== "string" ||
    typeof state.selectedId !== "string" ||
    typeof state.css !== "string" ||
    typeof state.defaultCss !== "string" ||
    typeof state.pending !== "boolean" ||
    typeof state.cancel !== "function" ||
    !state.ready ||
    typeof state.ready.then !== "function"
  )
    return undefined;
  return state.defaultId === (site.defaultTheme ?? "default") &&
    state.catalog === JSON.stringify(choices) &&
    state.defaultCss === site.themeCss.replace(/<\/style/gi, "<\\/style") &&
    (state.id === state.defaultId ||
      choices.some((choice) => choice.id === state.id)) &&
    (state.selectedId === state.defaultId ||
      choices.some((choice) => choice.id === state.selectedId)) &&
    (!state.pending ||
      (!!site.settings.allowThemeSwitching && state.selectedId !== state.defaultId))
    ? state
    : undefined;
}

const preferenceKey = "publish-reader-community-theme";

export function usePublishedTheme(site: CompiledSite) {
  const defaultId = site.defaultTheme ?? "default";
  const choices = site.settings.allowThemeSwitching ? (site.themes ?? []) : [];
  const initial = initialAppearance(site);
  const bootstrap = useRef(initial);
  const [selectedId, setSelectedId] = useState(() => initial?.id ?? defaultId);
  const [themeCss, setThemeCss] = useState(() => initial?.css ?? site.themeCss);
  const [pendingId, setPendingId] = useState<string | null>(() =>
    initial?.pending ? initial.selectedId : null,
  );
  const [error, setError] = useState("");
  const revision = useRef(0);
  const cache = useRef(new Map<string, string>());
  const abort = useRef<AbortController | null>(null);
  const staticStyle = useRef<{
    element: HTMLStyleElement;
    media: string | null;
  } | null>(null);
  const waitingBootstrap = useRef(!!initial?.pending);

  async function selectTheme(id: string, persist = true) {
    const choice = choices.find((theme) => theme.id === id);
    if (!choice) return;
    const request = ++revision.current;
    bootstrap.current?.cancel();
    waitingBootstrap.current = false;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setError("");
    setPendingId(id);
    try {
      let css: string;
      if (id === defaultId) css = site.themeCss;
      else {
        let theme = choice.cssUrl ? cache.current.get(choice.cssUrl) : "";
        if (theme === undefined) {
          const response = await fetch(choice.cssUrl, {
            signal: controller.signal,
          });
          if (!response.ok)
            throw new Error(`Theme request failed (${response.status}).`);
          theme = await response.text();
          if (request !== revision.current || controller.signal.aborted) return;
          cache.current.set(choice.cssUrl, theme);
        }
        css = `${theme}\n${site.themeOverridesCss ?? ""}`;
      }
      if (request !== revision.current || controller.signal.aborted) return;
      setThemeCss(css);
      setSelectedId(id);
      document.documentElement.dataset.community = id;
      const activeChoice = choices.find((theme) => theme.id === id);
      document.body.dataset.themePreset =
        id === "publish-theme"
          ? "publish"
          : activeChoice?.name.toLowerCase() === "minimal"
            ? "minimal"
            : "default";
      document.body.dataset.themeName = id;
      if (persist) {
        try {
          localStorage.setItem(preferenceKey, id);
        } catch {}
      }
    } catch (cause) {
      if (request !== revision.current || controller.signal.aborted) return;
      setError(
        `Could not load ${choice.name}. Your current theme has been kept.`,
      );
    } finally {
      if (request === revision.current) setPendingId(null);
    }
  }

  useLayoutEffect(() => {
    // Disable the static stylesheet only in the commit where React already owns
    // the exact same CSS. During bootstrap loading React's baseline is inert.
    const entry = staticStyle.current;
    const owned = document.querySelector<HTMLStyleElement>(
      "style[data-publish-theme]",
    );
    if (waitingBootstrap.current) owned?.setAttribute("media", "not all");
    else if (owned?.textContent === themeCss) {
      owned.removeAttribute("media");
      entry?.element.setAttribute("media", "not all");
    }
  });

  useLayoutEffect(() => {
    const staticTheme = document.querySelector<HTMLStyleElement>(
      "style#published-theme",
    );
    const previousMedia = staticTheme?.getAttribute("media") ?? null;
    if (staticTheme)
      staticStyle.current = { element: staticTheme, media: previousMedia };
    const previousBootstrap = bootstrap.current;
    const startup = initialAppearance(site);
    if (previousBootstrap && previousBootstrap !== startup)
      previousBootstrap.cancel();
    bootstrap.current = startup;
    const request = ++revision.current;
    abort.current?.abort();
    cache.current.clear();
    waitingBootstrap.current = !!startup?.pending;
    setSelectedId(startup?.id ?? defaultId);
    setThemeCss(startup?.css ?? site.themeCss);
    setPendingId(startup?.pending ? startup.selectedId : null);
    setError("");

    const applyMetadata = (id: string) => {
      document.documentElement.dataset.community = id;
      const choice = choices.find((theme) => theme.id === id);
      document.body.dataset.themePreset =
        id === defaultId
          ? defaultId === "publish-theme" ||
            site.settings.communityTheme === "publish-theme"
            ? "publish"
            : site.settings.communityTheme.toLowerCase() === "minimal"
              ? "minimal"
              : "default"
          : id === "publish-theme"
            ? "publish"
            : choice?.name.toLowerCase() === "minimal"
              ? "minimal"
              : "default";
      document.body.dataset.themeName = id;
    };
    applyMetadata(startup?.id ?? defaultId);
    if (startup) {
      void startup.ready.then((state) => {
        if (request !== revision.current) return;
        waitingBootstrap.current = false;
        setThemeCss(state.css);
        setSelectedId(state.id);
        setPendingId(null);
        applyMetadata(state.id);
        const choice = choices.find((theme) => theme.id === state.id);
        if (choice?.cssUrl && state.id !== defaultId) {
          const suffix = `\n${site.themeOverridesCss ?? ""}`;
          cache.current.set(
            choice.cssUrl,
            state.css.endsWith(suffix)
              ? state.css.slice(0, -suffix.length)
              : state.css,
          );
        }
      });
    } else if (site.settings.allowThemeSwitching) {
      try {
        const saved = localStorage.getItem(preferenceKey);
        if (
          saved &&
          saved !== defaultId &&
          choices.some((theme) => theme.id === saved)
        )
          void selectTheme(saved, false);
      } catch {}
    }
    const owned = document.querySelector<HTMLStyleElement>(
      "style[data-publish-theme]",
    );
    if (waitingBootstrap.current) owned?.setAttribute("media", "not all");
    else if (owned?.textContent === (startup?.css ?? site.themeCss)) {
      owned.removeAttribute("media");
      staticTheme?.setAttribute("media", "not all");
    }
    return () => {
      revision.current++;
      abort.current?.abort();
      // StrictMode's probe must not cancel the head request: it remounts this
      // effect immediately. A real unmount/site change is checked next turn.
      queueMicrotask(() => {
        if (revision.current === request + 1 || bootstrap.current !== startup)
          startup?.cancel();
      });
      if (staticTheme) {
        if (previousMedia == null) staticTheme.removeAttribute("media");
        else staticTheme.setAttribute("media", previousMedia);
      }
      staticStyle.current = null;
    };
  }, [site]);

  return { choices, selectedId, themeCss, pendingId, error, selectTheme };
}
