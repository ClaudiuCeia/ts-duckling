/** Tailwind classes for each entity kind. */
export function kindClasses(kind: string): string {
  switch (kind) {
    case "quantity":
      return "bg-amber-100 outline-amber-200 hover:bg-amber-200";
    case "ip":
      return "bg-indigo-100 outline-indigo-200 hover:bg-indigo-200";
    case "email":
      return "bg-emerald-100 outline-emerald-200 hover:bg-emerald-200";
    case "url":
      return "bg-sky-100 outline-sky-200 hover:bg-sky-200";
    case "phone":
      return "bg-fuchsia-100 outline-fuchsia-200 hover:bg-fuchsia-200";
    case "ssn":
    case "credit_card":
      return "bg-rose-100 outline-rose-200 hover:bg-rose-200";
    case "uuid":
      return "bg-violet-100 outline-violet-200 hover:bg-violet-200";
    case "time":
      return "bg-blue-100 outline-blue-200 hover:bg-blue-200";
    case "temperature":
      return "bg-orange-100 outline-orange-200 hover:bg-orange-200";
    case "range":
      return "bg-cyan-100 outline-cyan-200 hover:bg-cyan-200";
    case "location":
      return "bg-lime-100 outline-lime-200 hover:bg-lime-200";
    case "language":
      return "bg-teal-100 outline-teal-200 hover:bg-teal-200";
    case "institution":
      return "bg-green-100 outline-green-200 hover:bg-green-200";
    case "api_key":
      return "bg-pink-100 outline-pink-200 hover:bg-pink-200";
    default:
      return "bg-teal-100 outline-teal-200 hover:bg-teal-200";
  }
}

/** Human-readable duration. */
export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 0.001) return `${Math.round(ms * 1e6)}ns`;
  if (ms < 1) return `${Math.round(ms * 1000)}µs`;
  if (ms < 10) return `${ms.toFixed(2)}ms`;
  if (ms < 100) return `${ms.toFixed(1)}ms`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

const STORAGE_KEY = "ts-duckling:docs:selected-parsers:v4";

export function loadSelection(defaultIds: string[]): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set(defaultIds);
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return new Set(defaultIds);
    const s = new Set(ids.filter((x: unknown) => typeof x === "string"));
    return s.size ? (s as Set<string>) : new Set(defaultIds);
  } catch {
    return new Set(defaultIds);
  }
}

export function saveSelection(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}
