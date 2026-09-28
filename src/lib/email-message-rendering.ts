/** The sandbox and CSP are the security boundary; these transforms improve display. */
const EXTERNAL_IMAGE_SOURCE = /(?:https?:)?\/\//i;

function imageAttribute(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function escapeText(value: string): string {
  // Existing entities stay encoded, so alt text remains text inside the frame.
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function emailHasExternalImages(html: string): boolean {
  return (
    /<(?:img|source)\b[^>]*\b(?:src|srcset)\s*=\s*(?:"[^"]*(?:https?:)?\/\/|'[^']*(?:https?:)?\/\/|(?:https?:)?\/\/)/i.test(
      html,
    ) ||
    /\b(?:background|poster)\s*=\s*["']?(?:https?:)?\/\//i.test(html) ||
    /url\(\s*["']?(?:https?:)?\/\//i.test(html)
  );
}

function blockExternalImageSources(html: string): string {
  return html
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const source = [imageAttribute(tag, "src"), imageAttribute(tag, "srcset")]
        .filter(Boolean)
        .join(" ");
      if (!EXTERNAL_IMAGE_SOURCE.test(source)) return tag;

      const alt = imageAttribute(tag, "alt")?.trim();
      // Tracking pixels and decorative spacers should not leave empty boxes.
      const width = Number(imageAttribute(tag, "width"));
      const height = Number(imageAttribute(tag, "height"));
      if ((width > 0 && width <= 2) || (height > 0 && height <= 2)) return "";
      if (!alt) return "";
      return `<span class="email-hidden-image">${escapeText(alt)}</span>`;
    })
    .replace(
      /(\b(?:src|srcset|poster|background)\s*=\s*["'])\s*(?:https?:)?\/\/[^"']*(["'])/gi,
      "$1$2",
    )
    .replace(
      /(\b(?:src|srcset|poster|background)\s*=\s*)(?:https?:)?\/\/[^\s>]+/gi,
      '$1""',
    )
    .replace(/url\(\s*(["']?)(?:https?:)?\/\/[^)]*\1\s*\)/gi, "none");
}

export function buildEmailFrameDocument(
  html: string,
  {
    stripOpenTrackingPixel = false,
    allowExternalImages = false,
  }: {
    stripOpenTrackingPixel?: boolean;
    allowExternalImages?: boolean;
  } = {},
): string {
  let content = html
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");

  if (stripOpenTrackingPixel) {
    content = content.replace(
      /<img\b[^>]*hellocara-email-open\?token=[^>]*>/gi,
      "",
    );
  }
  if (!allowExternalImages) {
    content = blockExternalImageSources(content);
  }

  const csp = [
    "default-src 'none'",
    `img-src data: blob:${allowExternalImages ? " https:" : ""}`,
    "style-src 'unsafe-inline'",
    "font-src data:",
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");

  const head = [
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="referrer" content="no-referrer">',
    '<base target="_blank">',
  ].join("");

  // Never derive document height from the iframe viewport. In particular,
  // min-height:100% creates a feedback loop as the parent resizes the frame.
  const displayStyles = `<style>
    html{background:#fff;color-scheme:light;overflow:visible!important;height:auto!important;min-height:0!important;}
    html body{display:flow-root!important;margin:0!important;padding:0!important;width:auto!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;overflow:visible!important;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#1e293b;overflow-wrap:anywhere;}
    body table,body div{max-width:100%!important;min-width:0!important;box-sizing:border-box;}
    body img,body video{max-width:100%!important;height:auto!important;object-fit:contain;}
    body td,body th{overflow-wrap:anywhere;}
    body pre{white-space:pre-wrap;overflow-wrap:anywhere;}
    body a{overflow-wrap:anywhere;}
    body .email-hidden-image{display:inline-block!important;max-width:100%!important;height:auto!important;margin:6px 0!important;padding:8px 12px!important;border:1px dashed #cbd5e1!important;border-radius:6px!important;font:13px/1.5 Arial,Helvetica,sans-serif!important;color:#64748b!important;background:#f8fafc!important;overflow-wrap:anywhere;}
  </style>`;

  // Own the envelope so the CSP is parsed before *any* sender markup, including
  // malformed documents that put images before their <head>. Source styles are
  // retained, then the display overrides are applied after them.
  content = content.replace(/<\/?(?:html|head|body)\b[^>]*>/gi, "");
  return `<!doctype html><html><head>${head}</head><body>${content}${displayStyles}</body></html>`;
}

/** Uses the content box, never the viewport-sized documentElement.scrollHeight. */
export function emailContentHeight(
  body: Pick<
    HTMLElement,
    "scrollHeight" | "offsetHeight" | "getBoundingClientRect"
  >,
): number {
  return Math.max(
    80,
    Math.ceil(
      Math.max(
        body.scrollHeight,
        body.offsetHeight,
        body.getBoundingClientRect().height,
      ),
    ) + 1,
  );
}
