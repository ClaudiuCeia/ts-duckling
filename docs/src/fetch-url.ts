import { Readability } from "@mozilla/readability";

/** Best-effort normalise a pasted/typed string into a URL. */
function normalizeUrl(raw: string): string | null {
  let s = raw.trim();
  s = s.replace(/^"+|"+$/g, "");
  s = s.replace(/^'+|'+$/g, "");
  s = s.replace(/^[([{\s]+|[)\]}.,;:\s]+$/g, "");
  s = s.replace(/\s+/g, "");
  if (s.startsWith("//")) s = `https:${s}`;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) s = `https://${s}`;
  try {
    return new URL(s).toString();
  } catch {
    return null;
  }
}

/** Fetch HTML, falling back to Jina reader proxy on CORS failure. */
async function fetchHtml(url: string): Promise<string> {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } catch {
    const proxy = `https://r.jina.ai/${url}`;
    const r = await fetch(proxy);
    if (!r.ok) throw new Error(`proxy HTTP ${r.status}`);
    return await r.text();
  }
}

export interface LoadResult {
  text: string;
  ms: number;
}

/**
 * Fetch a remote page and extract its readable text content
 * using Mozilla's Readability library.
 *
 * Returns the extracted text, or throws on failure.
 */
export async function loadUrlText(raw: string): Promise<LoadResult> {
  const url = normalizeUrl(raw);
  if (!url) throw new Error("Invalid URL");

  const t0 = performance.now();
  const html = await fetchHtml(url);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const parsed = new Readability(
    doc,
    { baseURI: url } as ConstructorParameters<typeof Readability>[1],
  ).parse();
  const text = parsed?.textContent?.trim()
    ? parsed.textContent.trim()
    : (doc.body?.innerText || "").trim();
  const ms = performance.now() - t0;

  if (!text) throw new Error("No readable text found");
  return { text, ms };
}
