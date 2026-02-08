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
} from "https://esm.sh/gh/ClaudiuCeia/ts-duckling@main/mod.ts";

const STORAGE_KEY = "ts-duckling:docs:selected-parsers:v1";

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

const els = {
  parserList: document.getElementById("parser-list"),
  parserCount: document.getElementById("parser-count"),
  matchCount: document.getElementById("match-count"),
  charCount: document.getElementById("char-count"),
  input: document.getElementById("input"),
  annotated: document.getElementById("annotated"),
  json: document.getElementById("json"),
  jsonWrap: document.getElementById("json-wrap"),
  toggleJson: document.getElementById("toggle-json"),
  btnRun: document.getElementById("btn-run"),
  btnClear: document.getElementById("btn-clear"),
  presetAll: document.getElementById("preset-all"),
  presetNone: document.getElementById("preset-none"),
  presetPii: document.getElementById("preset-pii"),
  presetDefault: document.getElementById("preset-default"),
};

const escapeHtml = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const defaultSelection = new Set([
  "Range",
  "Time",
  "Temperature",
  "Quantity",
  "Location",
  "URL",
  "Email",
  "Institution",
  "Language",
  "Phone",
  "IPAddress",
  "SSN",
  "CreditCard",
  "UUID",
]);

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

const updateCounts = () => {
  els.parserCount.textContent = String(selected.size);
  els.charCount.textContent = String(els.input.value.length);
};

const setSelection = (set) => {
  selected = new Set(set);
  saveSelection(selected);
  renderParserList();
  updateCounts();
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

const run = () => {
  const text = els.input.value;
  const parsers = registry.filter((r) => selected.has(r.id)).map((r) => r.p);

  const res = Duckling(parsers).extract({ text, index: 0 });
  const entities = res.success ? res.value : [];

  els.matchCount.textContent = String(entities.length);
  els.annotated.innerHTML = annotate(text, entities);
  els.json.textContent = JSON.stringify(entities, null, 2);
  activeIdx = null;

  // Click-to-highlight
  els.annotated.querySelectorAll(".ent").forEach((el) => {
    el.addEventListener("click", () => {
      const i = Number(el.getAttribute("data-idx"));
      setActive(i);
    });
  });
};

const setActive = (idx) => {
  activeIdx = idx;
  els.annotated.querySelectorAll(".ent").forEach((el) => {
    const i = Number(el.getAttribute("data-idx"));
    el.classList.toggle("active", i === activeIdx);
  });
};

els.btnRun.addEventListener("click", run);
els.btnClear.addEventListener("click", () => {
  els.input.value = "";
  updateCounts();
  els.matchCount.textContent = "0";
  els.annotated.textContent = "";
  els.json.textContent = "[]";
});

els.input.addEventListener("input", updateCounts);

els.toggleJson.addEventListener("change", () => {
  const show = els.toggleJson.checked;
  els.jsonWrap.classList.toggle("hidden", !show);
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

// First run on load if textarea already has content (e.g. when preserving form state).
if (els.input.value.trim()) run();
