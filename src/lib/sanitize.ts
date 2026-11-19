import DOMPurify from 'dompurify';
import type { WindowLike } from 'dompurify';

export interface Sanitizers {
  sanitizeSvg(source: string): string;
  sanitizeHtml(html: string, pdfEmbeds?: ReadonlyMap<string, string>, svgEmbeds?: ReadonlyMap<string, string>): string;
}

export interface SanitizerOptions {
  /** Trusted URL rewriting on the sanitized body, before its HTML is serialized. */
  transformHtml?: (body: HTMLElement) => void;
}

interface HtmlCall {
  pdfEmbeds: ReadonlyMap<string, string>;
  svgEmbeds: ReadonlyMap<string, string>;
  trustedPdfNodes: WeakSet<Node>;
  trustedSvgNodes: WeakSet<Node>;
}

const emptyEmbeds: ReadonlyMap<string, string> = new Map();
const browserSanitizers = new WeakMap<WindowLike, Sanitizers>();

/** Bind a DOM explicitly; each factory owns its purifiers, hooks and per-call trust. */
export function createSanitizers(domWindow: WindowLike, options: SanitizerOptions = {}): Sanitizers {
  const svgPurifier = DOMPurify(domWindow);
  const purifier = DOMPurify(domWindow);
  if (!purifier.isSupported || !svgPurifier.isSupported) throw new Error('Sanitization requires a supported DOM.');
  let call: HtmlCall | undefined;
  const svgCache = new Map<string, string>();
  svgPurifier.addHook('uponSanitizeAttribute', (_node, data) => {
    // Inline SVG images have no reason to load external resources or navigate.
    if (['href', 'xlink:href'].includes(data.attrName) && !data.attrValue.startsWith('#')) data.keepAttr = false;
    if (data.attrName === 'style' && /(?:url\s*\(|expression\s*\(|@import|[\\<>])/i.test(data.attrValue)) data.keepAttr = false;
  });

  purifier.addHook('uponSanitizeElement', (node, data) => {
    const { pdfEmbeds, svgEmbeds, trustedPdfNodes, trustedSvgNodes } = call!;
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
    const { trustedPdfNodes, trustedSvgNodes } = call!;
    // Heading/block anchors must retain exact IDs (even common words such as "title").
    // Names are forbidden, and IDs are retained only on non-interactive content elements.
    if (data.attrName === 'id' && /^(?:H[1-6]|P|UL|OL|LI|TABLE|BLOCKQUOTE|ASIDE|DETAILS|SPAN|DIV|PRE)$/.test(node.nodeName)) data.forceKeepAttr = true;
    if (data.attrName === 'src' || data.attrName === 'href' || data.attrName === 'poster') {
      const value = data.attrValue.trim();
      const tag = node.nodeName.toLowerCase();
      if (/^data:/i.test(value)) {
        // HTML/SVG data and data navigation are forbidden. PDFs use sandboxed iframes or safe links below.
        const safeMedia = data.attrName !== 'href' && ['img', 'audio', 'video', 'source'].includes(tag)
          && /^data:(?:image\/(?:png|jpeg|jpg|gif|webp|avif|bmp)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+)[;,]/i.test(value);
        const safePdf = data.attrName === 'href' && /^data:application\/pdf;base64,[a-z0-9+/=\s]+$/i.test(value)
          && (node as Element).classList.contains('pdf-embed-link');
        const safeDownload = data.attrName === 'href' && (node as Element).hasAttribute('download')
          && (node as Element).classList.contains('asset-link')
          && /^data:(?:image\/(?:png|jpeg|jpg|gif|webp|avif|bmp)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/pdf);base64,[a-z0-9+/=]+$/i.test(value);
        const generatedPdf = data.attrName === 'src' && tag === 'iframe' && trustedPdfNodes.has(node);
        const generatedSvg = data.attrName === 'src' && tag === 'img' && trustedSvgNodes.has(node);
        if (!safeMedia && !safePdf && !safeDownload && !generatedPdf && !generatedSvg) data.keepAttr = false;
        if (safePdf || safeDownload || generatedPdf || generatedSvg) data.forceKeepAttr = true;
      } else if (/^(?:javascript|vbscript|file|blob):/i.test(value)) data.keepAttr = false;
      if (tag === 'iframe' && !trustedPdfNodes.has(node) && !/^https?:\/\//i.test(value)) data.keepAttr = false;
    }
    if (data.attrName === 'srcset') data.keepAttr = false;
    if (data.attrName === 'style') {
      // KaTeX needs numerical layout styles, but URLs, bindings and CSS expressions do not.
      if (/(?:url\s*\(|expression\s*\(|@import|behavior\s*:|-moz-binding|[\\<>])/i.test(data.attrValue)) data.keepAttr = false;
    }
  });
  purifier.addHook('afterSanitizeAttributes', node => {
    const { trustedPdfNodes } = call!;
    if (node.nodeName === 'A' && (node as Element).getAttribute('target') === '_blank') {
      (node as Element).setAttribute('rel', 'noopener noreferrer');
    }
    if (node.nodeName === 'IFRAME') {
      const element = node as Element;
      element.setAttribute('sandbox', trustedPdfNodes.has(node) ? '' : 'allow-scripts allow-same-origin allow-presentation');
      element.setAttribute('referrerpolicy', 'no-referrer');
    }
  });
  return {
    sanitizeSvg(source) {
      const cached = svgCache.get(source);
      if (cached !== undefined) {
        svgCache.delete(source);
        svgCache.set(source, cached);
        return cached;
      }
      const result = svgPurifier.sanitize(source, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ['script', 'foreignObject', 'style', 'animate', 'animateTransform', 'set'],
      }) as string;
      // Bound retained source bytes as well as entry count; large assets are not cached.
      if (source.length <= 65536 && result.length <= 65536) {
        svgCache.set(source, result);
        if (svgCache.size > 32) svgCache.delete(svgCache.keys().next().value!);
      }
      return result;
    },
    sanitizeHtml(html, pdfEmbeds = emptyEmbeds, svgEmbeds = emptyEmbeds) {
      // DOMPurify instances are synchronous and mutable. Reject nested use, including
      // from the transform, instead of overwriting the active capability context.
      if (call) throw new Error('HTML sanitizer cannot be called reentrantly.');
      call = { pdfEmbeds, svgEmbeds, trustedPdfNodes: new WeakSet(), trustedSvgNodes: new WeakSet() };
      try {
        const body = purifier.sanitize(html, {
          ADD_TAGS: ['iframe'],
          ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'loading', 'sandbox', 'referrerpolicy', 'target'],
          ADD_DATA_URI_TAGS: ['audio', 'video', 'source'],
          FORBID_TAGS: ['script', 'style', 'object', 'embed', 'form', 'textarea', 'select', 'button'],
          FORBID_ATTR: ['srcdoc', 'autoplay', 'name'],
          ALLOW_DATA_ATTR: true,
          ALLOW_ARIA_ATTR: true,
          SANITIZE_NAMED_PROPS: false,
          RETURN_DOM: true,
        }) as HTMLElement;
        options.transformHtml?.(body);
        return body.innerHTML;
      } finally {
        call = undefined;
      }
    },
  };
}

function defaultSanitizers(): Sanitizers {
  if (typeof window === 'undefined') throw new Error('Markdown rendering requires a browser DOM (or an explicit sanitizer adapter).');
  let sanitizers = browserSanitizers.get(window);
  if (!sanitizers) {
    sanitizers = createSanitizers(window);
    browserSanitizers.set(window, sanitizers);
  }
  return sanitizers;
}

export function sanitizeSvg(source: string): string {
  return defaultSanitizers().sanitizeSvg(source);
}

export function sanitizeHtml(html: string, pdfEmbeds?: ReadonlyMap<string, string>, svgEmbeds?: ReadonlyMap<string, string>): string {
  return defaultSanitizers().sanitizeHtml(html, pdfEmbeds, svgEmbeds);
}
