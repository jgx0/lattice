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

function sanitizeHtmlWithWindow(html: string, domWindow: WindowLike, pdfEmbeds: ReadonlyMap<string, string> = new Map(), svgEmbeds: ReadonlyMap<string, string> = new Map()): string {
  // Use a separate instance: hooks must not affect other consumers of DOMPurify.
  const purifier = DOMPurify(domWindow);
  const trustedPdfNodes = new WeakSet<Node>();
  const trustedSvgNodes = new WeakSet<Node>();
  purifier.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'img') {
      const element = node as Element;
      const capability = element.getAttribute('data-svg-capability') ?? '';
      if (svgEmbeds.get(capability) === element.getAttribute('src')) trustedSvgNodes.add(node);
      element.removeAttribute('data-svg-capability');
    }
    if (data.tagName === 'iframe') {
      const element = node as Element;
      const source = element.getAttribute('src') ?? '';
      const capability = element.getAttribute('data-pdf-capability') ?? '';
      const trustedPdf = pdfEmbeds.get(capability) === source && /^data:application\/pdf;base64,[a-z0-9+/=]+$/i.test(source);
      if (trustedPdf) trustedPdfNodes.add(node);
      element.removeAttribute('data-pdf-capability');
      if (!trustedPdf && !/^https?:\/\//i.test(source.trim())) node.parentNode?.removeChild(node);
      else {
        element.setAttribute('sandbox', trustedPdf ? '' : 'allow-scripts allow-same-origin allow-presentation');
        element.setAttribute('referrerpolicy', 'no-referrer');
        element.setAttribute('loading', 'lazy');
      }
    }
    if (data.tagName === 'audio' || data.tagName === 'video') {
      (node as Element).setAttribute('controls', '');
      (node as Element).removeAttribute('autoplay');
    }
  });
  purifier.addHook('uponSanitizeAttribute', (node, data) => {
    // Heading/block anchors must retain exact IDs (even common words such as "title").
    // Names are forbidden, and IDs are retained only on non-interactive content elements.
    if (data.attrName === 'id' && /^(?:H[1-6]|P|UL|OL|LI|TABLE|BLOCKQUOTE|ASIDE|DETAILS|SPAN|DIV|PRE)$/.test(node.nodeName)) data.forceKeepAttr = true;
    if (data.attrName === 'src' || data.attrName === 'href' || data.attrName === 'poster') {
      const value = data.attrValue.trim();
      const tag = node.nodeName.toLowerCase();
      if (/^data:/i.test(value)) {
        // HTML/SVG data and data navigation are forbidden. PDFs use sandboxed iframes or safe links below.
