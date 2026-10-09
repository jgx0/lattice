import DOMPurify from 'dompurify';
import type { WindowLike } from 'dompurify';

export interface Sanitizers {
  sanitizeSvg(source: string): string;
  sanitizeHtml(html: string, pdfEmbeds?: ReadonlyMap<string, string>, svgEmbeds?: ReadonlyMap<string, string>): string;
}

/** Bind a DOM explicitly; Node callers never need to install globals. */
export function createSanitizers(domWindow: WindowLike): Sanitizers {
  return {
    sanitizeSvg: source => sanitizeSvgWithWindow(source, domWindow),
    sanitizeHtml: (html, pdfEmbeds, svgEmbeds) => sanitizeHtmlWithWindow(html, domWindow, pdfEmbeds, svgEmbeds),
  };
}

function browserWindow(): WindowLike {
  if (typeof window === 'undefined') throw new Error('Markdown rendering requires a browser DOM (or an explicit sanitizer adapter).');
  return window;
}

export function sanitizeSvg(source: string): string {
  return sanitizeSvgWithWindow(source, browserWindow());
}

export function sanitizeHtml(html: string, pdfEmbeds: ReadonlyMap<string, string> = new Map(), svgEmbeds: ReadonlyMap<string, string> = new Map()): string {
  return sanitizeHtmlWithWindow(html, browserWindow(), pdfEmbeds, svgEmbeds);
}

function sanitizeSvgWithWindow(source: string, domWindow: WindowLike): string {
  const purifier = DOMPurify(domWindow);
  purifier.addHook('uponSanitizeAttribute', (_node, data) => {
    // Inline SVG images have no reason to load external resources or navigate.
    if (['href', 'xlink:href'].includes(data.attrName) && !data.attrValue.startsWith('#')) data.keepAttr = false;
    if (data.attrName === 'style' && /(?:url\s*\(|expression\s*\(|@import|[\\<>])/i.test(data.attrValue)) data.keepAttr = false;
  });
  return purifier.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'style', 'animate', 'animateTransform', 'set'],
  }) as string;
}
