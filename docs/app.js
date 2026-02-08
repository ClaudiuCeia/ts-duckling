import {
  CreditCard,
  Duckling,
  Email,
  Institution,
  IPAddress,
  Language,
  Location,
  Phone,
  Quantity,
  Range,
  SSN,
  Temperature,
  Time,
  URL,
  UUID,
} from "ts-duckling";
import { Readability } from "@mozilla/readability";

const STORAGE_KEY = "ts-duckling:docs:selected-parsers:v2";

const registry = [
  {
    id: "Range",
    label: "Range",
    desc: "Intervals: time and temperature ranges",
    p: Range.parser,
  },
  {
    id: "Time",
    label: "Time",
    desc: "Dates, relative time, day of week, circa",
    p: Time.parser,
  },
  {
    id: "Temperature",
    label: "Temperature",
    desc: "Temperatures with optional unit",
    p: Temperature.parser,
  },
  {
    id: "Quantity",
    label: "Quantity",
    desc: "Numbers: literals, commas, fractions",
    p: Quantity.parser,
  },
  {
    id: "Location",
    label: "Location",
    desc: "Countries and cities (dataset-backed)",
    p: Location.parser,
  },
  {
    id: "URL",
    label: "URL",
    desc: "http/https/ftp URLs (domain + optional port)",
    p: URL.parser,
  },
  { id: "Email", label: "Email", desc: "Email addresses", p: Email.parser },
  {
    id: "Institution",
    label: "Institution",
    desc: "Town halls, schools, etc.",
    p: Institution.parser,
  },
  {
    id: "Language",
    label: "Language",
    desc: "Language names (dataset-backed)",
    p: Language.parser,
  },
  {
    id: "Phone",
    label: "Phone",
    desc: "E.164: +<digits> (8-15)",
    p: Phone.parser,
  },
  {
    id: "IPAddress",
    label: "IP address",
    desc: "IPv4 + IPv6 full form",
    p: IPAddress.parser,
  },
  {
    id: "SSN",
    label: "SSN",
    desc: "US SSN: AAA-GG-SSSS (basic constraints)",
    p: SSN.parser,
  },
  {
    id: "CreditCard",
    label: "Credit card",
    desc: "13-19 digits (spaces/dashes) + Luhn",
    p: CreditCard.parser,
  },
  {
    id: "UUID",
    label: "UUID",
    desc: "Canonical 8-4-4-4-12 UUID",
    p: UUID.parser,
  },
];

const presets = {
  mixed: [
    "Email me at no-reply+foo@some.domain.dev.",
    "Visit https://duckling.deno.dev/.",
    "Call +14155552671.",
    "SSN 123-45-6789. CC 4242 4242 4242 4242.",
    "IP 192.168.0.1 and 2001:0db8:85a3:0000:0000:8a2e:0370:7334.",
    "We met 2 days ago and it was 20 C.",
    "id 550e8400-e29b-41d4-a716-446655440000",
  ].join(" "),
  pii: [
    "no-reply+foo@some.domain.dev",
    "https://duckling.deno.dev/",
    "+14155552671",
    "192.168.0.1",
    "123-45-6789",
    "4242 4242 4242 4242",
    "550e8400-e29b-41d4-a716-446655440000",
  ].join("\n"),
  article: [
    "Between 2018 and 2022, we saw a big shift in browser runtimes.",
    "On January 5, 2022, the project started shipping weekly releases.",
    "Reach out at hello@example.com or visit https://example.com/docs.",
  ].join("\n\n"),
};

const els = {
  parserList: document.getElementById("parser-list"),
  parserCount: document.getElementById("parser-count"),
  matchCount: document.getElementById("match-count"),
  charCount: document.getElementById("char-count"),
  timing: document.getElementById("timing"),
  input: document.getElementById("input"),
  annotated: document.getElementById("annotated"),
  json: document.getElementById("json"),
  jsonWrap: document.getElementById("json-wrap"),
  toggleJson: document.getElementById("toggle-json"),
  selectedWrap: document.getElementById("selected-wrap"),
  selectedTitle: document.getElementById("selected-title"),
  selectedJson: document.getElementById("selected-json"),
  status: document.getElementById("status"),
  url: document.getElementById("url"),
  presetText: document.getElementById("preset-text"),
  btnLoad: document.getElementById("btn-load"),
  btnRun: document.getElementById("btn-run"),
  btnClear: document.getElementById("btn-clear"),
  presetAll: document.getElementById("preset-all"),
  presetNone: document.getElementById("preset-none"),
  presetPii: document.getElementById("preset-pii"),
  presetDefault: document.getElementById("preset-default"),
};

const escapeHtml = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const defaultSelection = new Set(registry.map((r) => r.id));
const piiSelection = new Set([
  "Email",
  "URL",
  "UUID",
  "Phone",
  "IPAddress",
  "SSN",
  "CreditCard",
]);

const loadSelection = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set(defaultSelection);
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return new Set(defaultSelection);
    const s = new Set(ids.filter((x) => typeof x === "string"));
    return s.size ? s : new Set(defaultSelection);
  } catch {
    return new Set(defaultSelection);
  }
};

const saveSelection = (set) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
};

let selected = loadSelection();
let activeIdx = null;
let lastEntities = [];
let scheduled = 0;

const setStatus = (kind, msg) => {
  if (!kind) {
    els.status.textContent = "";
    return;
  }
  const spinner = kind === "fetch" || kind === "parse"
    ? '<span class="spinner" aria-hidden="true"></span>'
    : "";
  els.status.innerHTML = `${spinner}${escapeHtml(msg)}`;
};

const updateCounts = () => {
  els.parserCount.textContent = String(selected.size);
  els.charCount.textContent = String(els.input.value.length);
};

const renderParserList = () => {
  els.parserList.innerHTML = "";
  for (const item of registry) {
    const wrap = document.createElement("div");
    wrap.className = "parser-item";
    wrap.setAttribute("role", "listitem");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selected.has(item.id);
    cb.addEventListener("change", () => {
      if (cb.checked) selected.add(item.id);
      else selected.delete(item.id);
      saveSelection(selected);
      updateCounts();
      scheduleExtract();
    });

    const meta = document.createElement("div");
    const name = document.createElement("div");
    name.className = "parser-name";
    name.textContent = item.label;
    const desc = document.createElement("div");
    desc.className = "parser-desc";
    desc.textContent = item.desc;
    meta.append(name, desc);

    wrap.append(cb, meta);
    els.parserList.append(wrap);
  }
};

const setSelection = (set) => {
  selected = new Set(set);
  saveSelection(selected);
  renderParserList();
  updateCounts();
  scheduleExtract();
};

const setActive = (idx) => {
  activeIdx = idx;
  els.annotated.querySelectorAll(".ent").forEach((el) => {
    const i = Number(el.getAttribute("data-idx"));
    el.classList.toggle("active", i === activeIdx);
  });

  const e = lastEntities[idx];
  if (!e) {
    els.selectedWrap.classList.add("hidden");
    return;
  }

  const title = `${e.kind}  "${
    e.text.length > 40 ? `${e.text.slice(0, 40)}…` : e.text
  }"  [${e.start},${e.end}]`;
  els.selectedTitle.textContent = title;
  els.selectedJson.textContent = JSON.stringify(e, null, 2);
  els.selectedWrap.classList.remove("hidden");
  els.selectedWrap.open = true;
};

const annotate = (text, entities) => {
  const sorted = [...entities].sort((a, b) =>
    a.start - b.start || a.end - b.end
  );
  let cursor = 0;
  const parts = [];
  let idx = 0;

  for (const e of sorted) {
    if (e.start < cursor) continue; // overlap, skip
    parts.push(escapeHtml(text.slice(cursor, e.start)));
    const chunk = escapeHtml(text.slice(e.start, e.end));
    parts.push(
      `<span class="ent" data-idx="${idx}" title="${
        escapeHtml(e.kind)
      }">${chunk}</span>`,
    );
    cursor = e.end;
    idx++;
  }
  parts.push(escapeHtml(text.slice(cursor)));
  return parts.join("");
};

const extractNow = async () => {
  const text = els.input.value;
  const parsers = registry.filter((r) => selected.has(r.id)).map((r) => r.p);

  setStatus("parse", "Parsing…");
  await new Promise((r) => requestAnimationFrame(() => r()));

  const t0 = performance.now();
  const res = Duckling(parsers).extract({ text, index: 0 });
  const dt = performance.now() - t0;

  const entities = res.success ? res.value : [];
  lastEntities = entities;

  els.matchCount.textContent = String(entities.length);
  els.timing.textContent = `${dt.toFixed(1)}ms`;
  els.annotated.innerHTML = annotate(text, entities);
  els.json.textContent = JSON.stringify(entities, null, 2);
  setStatus("", "");

  activeIdx = null;
  els.selectedWrap.classList.add("hidden");

  els.annotated.querySelectorAll(".ent").forEach((el) => {
    el.addEventListener("click", () => {
      const i = Number(el.getAttribute("data-idx"));
      setActive(i);
    });
  });
};

const scheduleExtract = () => {
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(() => {
    scheduled = 0;
    extractNow();
  }, 250);
};

const normalizeUrl = (raw) => {
  let s = raw.trim();
  if (!s) return null;

  // Remove invisible/annoying whitespace that trim() won't catch.
  s = s.replaceAll(/[\u200B-\u200D\uFEFF]/g, "");

  // If the user pasted a markdown link or an entire sentence, try to
  // extract the first URL-looking substring.
  const m = /(https?:\/\/\S+|\/\/\S+)/.exec(s);
  if (m) s = m[1];

  // Drop surrounding punctuation frequently included when copy/pasting.
  s = s.replace(/^<+|>+$/g, "");
  s = s.replace(/^\"+|\"+$/g, "");
  s = s.replace(/^'+|'+$/g, "");
  s = s.replace(/^[([{\s]+|[)\]}.,;:\s]+$/g, "");

  // Collapse internal whitespace (e.g. pasted with line breaks).
  s = s.replaceAll(/\s+/g, "");

  // Accept protocol-relative URLs: //example.com/path
  if (s.startsWith("//")) s = `https:${s}`;

  // Accept "en.wikipedia.org/wiki/..." by assuming https://.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    return u.toString();
  } catch {
    return null;
  }
};

const fetchUrlText = async (url) => {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } catch (_e) {
    // GH Pages + random sites usually means CORS. Retry through a read proxy.
    const proxy = `https://r.jina.ai/${url}`;
    const r = await fetch(proxy);
    if (!r.ok) throw new Error(`proxy HTTP ${r.status}`);
    return await r.text();
  }
};

const extractReadableText = (html, url) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const parsed = new Readability(doc, { baseURI: url }).parse();
  if (parsed?.textContent?.trim()) {
    const title = (parsed.title || "").trim();
    const head = title ? `${title}\n\n` : "";
    return `${head}${parsed.textContent.trim()}`;
  }
  return (doc.body?.innerText || "").trim();
};

const loadFromUrl = async () => {
  const url = normalizeUrl(els.url.value);
  if (!url) {
    setStatus("error", "Invalid URL");
    setTimeout(() => setStatus("", ""), 1500);
    return;
  }

  setStatus("fetch", "Fetching…");
  const t0 = performance.now();
  try {
    const html = await fetchUrlText(url);
    setStatus("parse", "Extracting article…");
    await new Promise((r) => requestAnimationFrame(() => r()));
    const text = extractReadableText(html, url);
    const dt = performance.now() - t0;

    els.input.value = text;
    els.presetText.value = "";
    updateCounts();
    els.timing.textContent = `load ${dt.toFixed(0)}ms`;
    setStatus("", "");
    scheduleExtract();
  } catch (_e) {
    setStatus("error", `Load failed`);
    setTimeout(() => setStatus("", ""), 2500);
  }
};

els.btnRun.addEventListener("click", () => extractNow());
els.btnClear.addEventListener("click", () => {
  els.input.value = "";
  els.timing.textContent = "";
  updateCounts();
  lastEntities = [];
  activeIdx = null;
  els.matchCount.textContent = "0";
  els.annotated.textContent = "";
  els.json.textContent = "[]";
  els.selectedWrap.classList.add("hidden");
  setStatus("", "");
});

els.input.addEventListener("input", () => {
  updateCounts();
  scheduleExtract();
});

els.toggleJson.addEventListener("change", () => {
  const show = els.toggleJson.checked;
  els.jsonWrap.classList.toggle("hidden", !show);
});

els.btnLoad.addEventListener("click", loadFromUrl);

els.presetText.addEventListener("change", () => {
  const k = els.presetText.value;
  if (!k) return;
  els.input.value = presets[k] || "";
  els.url.value = "";
  updateCounts();
  scheduleExtract();
});

els.presetAll.addEventListener(
  "click",
  () => setSelection(registry.map((r) => r.id)),
);
els.presetNone.addEventListener("click", () => setSelection([]));
els.presetPii.addEventListener("click", () => setSelection(piiSelection));
els.presetDefault.addEventListener(
  "click",
  () => setSelection(defaultSelection),
);

renderParserList();
updateCounts();

// Initial extraction if content exists (e.g. browser restores textareas).
if (els.input.value.trim()) scheduleExtract();
