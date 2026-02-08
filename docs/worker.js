// deno-lint-ignore-file no-import-prefix
let modPromise = null;

const loadModule = () => {
  if (modPromise) return modPromise;

  // Prefer local bundle for development/preview, but fall back to esm.sh for
  // production (GitHub Pages) or when the bundle is missing.
  modPromise = (async () => {
    // The worker runs in its own global scope; it doesn't inherit globals from
    // the page. We pass `?v=<sha>` when constructing the Worker URL.
    const build = new URL(globalThis.location.href).searchParams.get("v") ||
      "dev";
    const local = new URL(
      `./vendor/ts-duckling.js?v=${encodeURIComponent(build)}`,
      import.meta.url,
    ).href;
    try {
      return await import(local);
    } catch {
      return await import(
        "https://esm.sh/gh/ClaudiuCeia/ts-duckling@main/mod.ts"
      );
    }
  })();

  return modPromise;
};

const buildRegistry = (m) => {
  return {
    Range: m.Range.parser,
    Time: m.Time.parser,
    Temperature: m.Temperature.parser,
    Quantity: m.Quantity.parser,
    Location: m.Location.parser,
    URL: m.URL.parser,
    Email: m.Email.parser,
    Institution: m.Institution.parser,
    Language: m.Language.parser,
    Phone: m.Phone.parser,
    IPAddress: m.IPAddress.parser,
    SSN: m.SSN.parser,
    CreditCard: m.CreditCard.parser,
    UUID: m.UUID.parser,
  };
};

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (!msg || msg.type !== "extract") return;

  const { reqId, text, ids, maxChars } = msg;
  const source = typeof text === "string" ? text : "";
  const max = Number.isFinite(maxChars) ? Math.max(0, Math.trunc(maxChars)) : 0;
  const truncated = max > 0 && source.length > max;
  const input = truncated ? source.slice(0, max) : source;

  const m = await loadModule();
  const registry = buildRegistry(m);
  const parsers = Array.isArray(ids)
    ? ids.map((id) => registry[id]).filter(Boolean)
    : [];

  const t0 = performance.now();
  const res = m.Duckling(parsers).extract({ text: input, index: 0 });
  const ms = performance.now() - t0;

  const entities = res.success ? res.value : [];
  self.postMessage({
    type: "result",
    reqId,
    entities,
    ms,
    truncated,
    length: input.length,
  });
};
