const STORAGE_KEY = "ts-duckling:docs:selected-parsers:v3";

const registry = [
  {
    id: "Range",
    label: "Range",
    desc: "Intervals: time and temperature ranges",
  },
  {
    id: "Time",
    label: "Time",
    desc: "Dates, relative time, day of week, circa",
  },
  {
    id: "Temperature",
    label: "Temperature",
    desc: "Temperatures with optional unit",
  },
  {
    id: "Quantity",
    label: "Quantity",
    desc: "Numbers: literals, commas, fractions",
  },
  {
    id: "Location",
    label: "Location",
    desc: "Countries and cities (dataset-backed)",
  },
  {
    id: "URL",
    label: "URL",
    desc: "http/https/ftp URLs (domain + optional port)",
  },
  { id: "Email", label: "Email", desc: "Email addresses" },
  {
    id: "Institution",
    label: "Institution",
    desc: "Town halls, schools, etc.",
  },
  {
    id: "Language",
    label: "Language",
    desc: "Language names (dataset-backed)",
  },
  { id: "Phone", label: "Phone", desc: "E.164: +<digits> (8-15)" },
  { id: "IPAddress", label: "IP address", desc: "IPv4 + IPv6 full form" },
  { id: "SSN", label: "SSN", desc: "US SSN: AAA-GG-SSSS (basic constraints)" },
  {
    id: "CreditCard",
    label: "Credit card",
    desc: "13-19 digits (spaces/dashes) + Luhn",
  },
  { id: "UUID", label: "UUID", desc: "Canonical 8-4-4-4-12 UUID" },
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
  status: document.getElementById("status"),
  statusSpinner: document.getElementById("status-spinner"),
  statusText: document.getElementById("status-text"),
  url: document.getElementById("url"),
  presetText: document.getElementById("preset-text"),
  maxChars: document.getElementById("max-chars"),
  fullText: document.getElementById("full-text"),
  btnLoad: document.getElementById("btn-load"),
  btnRun: document.getElementById("btn-run"),
  btnStop: document.getElementById("btn-stop"),
  btnClear: document.getElementById("btn-clear"),
  presetAll: document.getElementById("preset-all"),
  presetNone: document.getElementById("preset-none"),
  presetPii: document.getElementById("preset-pii"),
  presetDefault: document.getElementById("preset-default"),

  popover: document.getElementById("popover"),
  popoverBackdrop: null,
  popoverClose: null,
  popoverTitle: null,
  popoverJson: null,

  hovercard: document.getElementById("hovercard"),
  hovercardClose: document.getElementById("hovercard-close"),
  hovercardTitle: document.getElementById("hovercard-title"),
  hovercardTabs: document.getElementById("hovercard-tabs"),
  hovercardJson: document.getElementById("hovercard-json"),
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
let scheduled = 0;
let worker = null;
let reqId = 0;
let parseInFlight = false;
let lastEntities = [];
let lastDisplayEntities = [];
let lastGroupsByStart = new Map();
let currentText = "";
let parseTimer = 0;
let activeEntEl = null;
let cardPinned = false;
let cardHideTimer = 0;

const fmtDuration = (ms) => {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return "";

  if (n < 0.001) return `${Math.round(n * 1e6)}ns`; // ms -> ns
  if (n < 1) return `${Math.round(n * 1000)}µs`; // ms -> µs
  if (n < 10) return `${n.toFixed(2)}ms`;
  if (n < 100) return `${n.toFixed(1)}ms`;
  if (n < 1000) return `${n.toFixed(0)}ms`;
  if (n < 60_000) return `${(n / 1000).toFixed(n < 10_000 ? 2 : 1)}s`;
  return `${(n / 60_000).toFixed(1)}m`;
};

const setStatus = (msg, spinning = false) => {
  if (!msg) {
    els.statusText.textContent = "";
    els.statusSpinner.classList.add("hidden");
    els.status.classList.add("opacity-0");
    return;
  }
  els.status.classList.remove("opacity-0");
  els.statusText.textContent = msg;
  els.statusSpinner.classList.toggle("hidden", !spinning);
};

const updateCounts = () => {
  els.parserCount.textContent = String(selected.size);
  els.charCount.textContent = String(els.input.value.length);
};

const renderParserList = () => {
  els.parserList.innerHTML = "";

  for (const item of registry) {
    const wrap = document.createElement("div");
    wrap.className =
      "rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-slate-300";
    wrap.setAttribute("role", "listitem");

    const row = document.createElement("label");
    row.className = "flex cursor-pointer items-start gap-3";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "mt-1 h-4 w-4 accent-teal-600";
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
    name.className = "text-sm font-semibold text-slate-900";
    name.textContent = item.label;
    const desc = document.createElement("div");
    desc.className = "text-sm text-slate-600";
    desc.textContent = item.desc;
    meta.append(name, desc);

    row.append(cb, meta);
    wrap.append(row);
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

const ensureWorker = () => {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (ev) => {
    const msg = ev.data;
    if (!msg || msg.type !== "result") return;
    if (msg.reqId !== reqId) return;

    parseInFlight = false;
    if (parseTimer) {
      clearInterval(parseTimer);
      parseTimer = 0;
    }
    setStatus("", false);

    lastEntities = Array.isArray(msg.entities) ? msg.entities : [];
    els.matchCount.textContent = String(lastEntities.length);

    const ms = Number.isFinite(msg.ms) ? msg.ms : 0;
    const suffix = msg.truncated ? ` (prefix ${msg.length} chars)` : "";
    els.timing.textContent = `${fmtDuration(ms)}${suffix}`;

    renderAnnotated(
      currentText,
      lastEntities,
      msg.truncated ? msg.length : null,
    );
    els.json.textContent = JSON.stringify(lastEntities, null, 2);
  };
  return worker;
};

const stopWorker = () => {
  if (!worker) return;
  worker.terminate();
  worker = null;
  parseInFlight = false;
  if (parseTimer) {
    clearInterval(parseTimer);
    parseTimer = 0;
  }
  setStatus("", false);
};

const groupByStart = (entities) => {
  const map = new Map();
  for (const e of entities) {
    if (!e || !Number.isFinite(e.start)) continue;
    const arr = map.get(e.start) ?? [];
    arr.push(e);
    map.set(e.start, arr);
  }

  const starts = [...map.keys()].sort((a, b) => a - b);
  const groups = [];
  const display = [];
  for (const s of starts) {
    const arr = map.get(s) ?? [];
    // For the hovercard, keep "most informative" (longest) first.
    arr.sort((a, b) =>
      (b.end - b.start) - (a.end - a.start) ||
      (b.end - a.end) ||
      String(a.kind).localeCompare(b.kind)
    );
    if (!arr.length) continue;
    groups.push(arr);

    // For annotation, prefer the smallest (shortest) match so we don't hide
    // inner groups (e.g. CC + 4x quantity chunks).
    const smallest = [...arr].sort((a, b) =>
      (a.end - a.start) - (b.end - b.start) ||
      (a.end - b.end) ||
      String(a.kind).localeCompare(b.kind)
    )[0];
    display.push(smallest);
  }
  return { map, groups, display };
};

const closeHovercard = () => {
  if (cardHideTimer) {
    clearTimeout(cardHideTimer);
    cardHideTimer = 0;
  }
  cardPinned = false;
  els.hovercard.classList.add("hidden");
  if (activeEntEl) {
    activeEntEl.classList.remove("ring-2", "ring-teal-400");
    activeEntEl = null;
  }
};

const positionHovercard = (anchorEl) => {
  const card = els.hovercard;
  const a = anchorEl.getBoundingClientRect();

  // Make visible off-screen to measure.
  card.style.left = "-9999px";
  card.style.top = "-9999px";
  card.classList.remove("hidden");

  const c = card.getBoundingClientRect();
  const margin = 12;

  // Prefer below; flip above if needed.
  let top = a.bottom + 10;
  if (top + c.height + margin > globalThis.innerHeight) {
    top = a.top - c.height - 10;
  }

  let left = a.left;
  if (left + c.width + margin > globalThis.innerWidth) {
    left = globalThis.innerWidth - c.width - margin;
  }
  if (left < margin) left = margin;

  // Clamp top too.
  if (top + c.height + margin > globalThis.innerHeight) {
    top = Math.max(margin, globalThis.innerHeight - c.height - margin);
  }
  if (top < margin) top = margin;

  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(top)}px`;
};

const setHovercardMatch = (match) => {
  const title = `${match.kind}  "${
    match.text.length > 60 ? `${match.text.slice(0, 60)}…` : match.text
  }"  [${match.start},${match.end}]`;

  els.hovercardTitle.textContent = title;
  els.hovercardJson.textContent = JSON.stringify(match, null, 2);
};

const openHovercard = (start, el, pinned) => {
  const list = lastGroupsByStart.get(start) ?? [];
  if (!list.length) return;

  if (activeEntEl) activeEntEl.classList.remove("ring-2", "ring-teal-400");
  activeEntEl = el || null;
  if (activeEntEl) activeEntEl.classList.add("ring-2", "ring-teal-400");

  if (cardHideTimer) {
    clearTimeout(cardHideTimer);
    cardHideTimer = 0;
  }
  cardPinned = !!pinned;

  // Chips for all matches at this start offset.
  els.hovercardTabs.innerHTML = "";
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:border-slate-300";
    btn.textContent = `${m.kind} ${(m.end - m.start)}c`;
    btn.addEventListener("click", () => {
      els.hovercardTabs.querySelectorAll("button").forEach((b) => {
        b.classList.remove("border-teal-200", "bg-teal-50", "text-teal-900");
      });
      btn.classList.add("border-teal-200", "bg-teal-50", "text-teal-900");
      setHovercardMatch(m);
    });
    if (i === 0) {
      btn.classList.add("border-teal-200", "bg-teal-50", "text-teal-900");
    }
    els.hovercardTabs.append(btn);
  }

  setHovercardMatch(list[0]);
  positionHovercard(el);
};

const annotateHtml = (text, entities, limit) => {
  const view = typeof limit === "number" ? text.slice(0, limit) : text;
  const sorted = [...entities].sort((a, b) => a.start - b.start);
  let cursor = 0;
  let idx = 0;
  const parts = [];

  for (const e of sorted) {
    if (e.start < cursor) continue;
    if (e.start > view.length) break;
    const end = Math.min(e.end, view.length);

    parts.push(escapeHtml(view.slice(cursor, e.start)));
    const chunk = escapeHtml(view.slice(e.start, end));
    parts.push(
      `<span class="ent cursor-pointer rounded-md bg-teal-100 px-1 py-0.5 text-slate-900 outline outline-1 outline-teal-200 hover:bg-teal-200" data-idx="${idx}" data-start="${e.start}">${chunk}</span>`,
    );
    cursor = end;
    idx++;
  }
  parts.push(escapeHtml(view.slice(cursor)));
  return parts.join("");
};

const renderAnnotated = (text, entities, limit) => {
  const grouped = groupByStart(entities);
  lastGroupsByStart = grouped.map;
  lastDisplayEntities = grouped.display;

  els.annotated.innerHTML = annotateHtml(text, lastDisplayEntities, limit);
  els.annotated.querySelectorAll(".ent").forEach((el) => {
    el.addEventListener("mouseenter", () => {
      if (cardPinned) return;
      const start = Number(el.getAttribute("data-start"));
      openHovercard(start, el, false);
    });
    el.addEventListener("mouseleave", () => {
      if (cardPinned) return;
      if (cardHideTimer) clearTimeout(cardHideTimer);
      cardHideTimer = setTimeout(() => closeHovercard(), 120);
    });
    el.addEventListener("click", () => {
      const start = Number(el.getAttribute("data-start"));
      openHovercard(start, el, true);
    });
  });
};

const scheduleExtract = () => {
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(() => {
    scheduled = 0;
    extractNow();
  }, 350);
};

const extractNow = () => {
  currentText = els.input.value;
  if (!currentText.trim()) {
    lastEntities = [];
    els.matchCount.textContent = "0";
    els.timing.textContent = "";
    els.annotated.textContent = "";
    els.json.textContent = "[]";
    closeHovercard();
    setStatus("", false);
    return;
  }

  reqId++;

  // If we already have a long-running parse, terminate worker to avoid stacking work.
  if (parseInFlight) stopWorker();

  parseInFlight = true;
  const startedAt = performance.now();
  closeHovercard();
  setStatus("Parsing…", true);
  parseTimer = setInterval(() => {
    const dt = performance.now() - startedAt;
    setStatus(dt > 400 ? `Parsing… ${fmtDuration(dt)}` : "Parsing…", true);
  }, 250);

  const full = !!els.fullText.checked;
  const max = full ? 0 : Math.max(500, Number(els.maxChars.value) || 8000);
  const priority = [
    "Email",
    "URL",
    "UUID",
    "Phone",
    "IPAddress",
    "SSN",
    "CreditCard",
    "Time",
    "Temperature",
    "Range",
    "Location",
    "Institution",
    "Language",
    "Quantity",
  ];
  const ids = priority.filter((id) => selected.has(id));

  ensureWorker().postMessage({
    type: "extract",
    reqId,
    text: currentText,
    ids,
    maxChars: max,
  });
};

const normalizeUrl = (raw) => {
  let s = raw.trim();
  if (!s) return null;
  s = s.replaceAll(/[\u200B-\u200D\uFEFF]/g, "");
  const m = /(https?:\/\/\S+|\/\/\S+)/.exec(s);
  if (m) s = m[1];
  s = s.replace(/^<+|>+$/g, "");
  s = s.replace(/^\"+|\"+$/g, "");
  s = s.replace(/^'+|'+$/g, "");
  s = s.replace(/^[([{\s]+|[)\]}.,;:\s]+$/g, "");
  s = s.replaceAll(/\s+/g, "");
  if (s.startsWith("//")) s = `https:${s}`;
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
    const proxy = `https://r.jina.ai/${url}`;
    const r = await fetch(proxy);
    if (!r.ok) throw new Error(`proxy HTTP ${r.status}`);
    return await r.text();
  }
};

const loadFromUrl = async () => {
  const url = normalizeUrl(els.url.value);
  if (!url) {
    setStatus("Invalid URL", false);
    setTimeout(() => setStatus("", false), 1800);
    return;
  }

  setStatus("Fetching…", true);
  stopWorker();

  const t0 = performance.now();
  try {
    const { Readability } = await import("@mozilla/readability");
    const html = await fetchUrlText(url);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const parsed = new Readability(doc, { baseURI: url }).parse();
    const text = parsed?.textContent?.trim()
      ? parsed.textContent.trim()
      : (doc.body?.innerText || "").trim();

    els.input.value = text;
    els.presetText.value = "";
    updateCounts();

    const dt = performance.now() - t0;
    setStatus(`Loaded (${Math.round(dt)}ms)`, false);
    setTimeout(() => setStatus("", false), 900);
    scheduleExtract();
  } catch (_e) {
    setStatus("Load failed (likely CORS)", false);
    setTimeout(() => setStatus("", false), 2500);
  }
};

els.btnRun.addEventListener("click", extractNow);
els.btnStop.addEventListener("click", () => {
  stopWorker();
  closeHovercard();
  setStatus("Stopped", false);
  setTimeout(() => setStatus("", false), 900);
});

els.btnClear.addEventListener("click", () => {
  els.input.value = "";
  els.url.value = "";
  updateCounts();
  stopWorker();
  lastEntities = [];
  els.matchCount.textContent = "0";
  els.timing.textContent = "";
  els.annotated.textContent = "";
  els.json.textContent = "[]";
  closeHovercard();
  setStatus("", false);
});

els.btnLoad.addEventListener("click", loadFromUrl);

els.toggleJson.addEventListener("change", () => {
  const show = els.toggleJson.checked;
  els.jsonWrap.classList.toggle("hidden", !show);
});

els.input.addEventListener("input", () => {
  updateCounts();
  scheduleExtract();
});

els.maxChars.addEventListener("input", scheduleExtract);
els.fullText.addEventListener("change", scheduleExtract);

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

if (els.input.value.trim()) scheduleExtract();

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") closeHovercard();
});

// Keep layout stable; content fades in/out.
els.status.classList.add("opacity-0");

els.hovercard.addEventListener("mouseenter", () => {
  if (cardHideTimer) {
    clearTimeout(cardHideTimer);
    cardHideTimer = 0;
  }
});
els.hovercard.addEventListener("mouseleave", () => {
  if (cardPinned) return;
  if (cardHideTimer) clearTimeout(cardHideTimer);
  cardHideTimer = setTimeout(() => closeHovercard(), 120);
});
els.hovercardClose.addEventListener("click", closeHovercard);
document.addEventListener("click", (ev) => {
  if (!cardPinned) return;
  const t = ev.target;
  if (!(t instanceof HTMLElement)) return;
  if (els.hovercard.contains(t)) return;
  if (activeEntEl && activeEntEl.contains(t)) return;
  closeHovercard();
});
globalThis.addEventListener("scroll", () => {
  if (!els.hovercard.classList.contains("hidden") && activeEntEl) {
    positionHovercard(activeEntEl);
  }
}, { passive: true });
globalThis.addEventListener("resize", () => {
  if (!els.hovercard.classList.contains("hidden") && activeEntEl) {
    positionHovercard(activeEntEl);
  }
});
