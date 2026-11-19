import { useEffect, useRef, useState } from "react";
import type { CompiledSite } from "./types";

const preferenceKey = "publish-reader-community-theme";

export function usePublishedTheme(site: CompiledSite) {
  const defaultId = site.defaultTheme ?? "default";
  const choices = site.settings.allowThemeSwitching ? (site.themes ?? []) : [];
  const [selectedId, setSelectedId] = useState(defaultId);
  const [themeCss, setThemeCss] = useState(site.themeCss);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const cache = useRef(new Map<string, string>());
  const abort = useRef<AbortController | null>(null);

  async function selectTheme(id: string, persist = true) {
    const choice = choices.find((theme) => theme.id === id);
    if (!choice) return;
    const request = ++revision.current;
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

  useEffect(() => {
    const staticTheme = document.querySelector<HTMLStyleElement>(
      "style#published-theme",
    );
    const previousMedia = staticTheme?.getAttribute("media");
    staticTheme?.setAttribute("media", "not all");
    revision.current++;
    abort.current?.abort();
    cache.current.clear();
    setSelectedId(defaultId);
    setThemeCss(site.themeCss);
    setPendingId(null);
    setError("");
    document.documentElement.dataset.community = defaultId;
    document.body.dataset.themeName = defaultId;
    if (site.settings.allowThemeSwitching) {
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
    return () => {
      revision.current++;
      abort.current?.abort();
      if (staticTheme) {
        if (previousMedia == null) staticTheme.removeAttribute("media");
        else staticTheme.setAttribute("media", previousMedia);
      }
    };
  }, [site]);

  return { choices, selectedId, themeCss, pendingId, error, selectTheme };
}
