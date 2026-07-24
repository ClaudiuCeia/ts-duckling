// Fetch and vendor external JSON datasets so the library doesn't depend on
// network access at runtime.

const DATA_DIR = new URL("../data/", import.meta.url);
const CLDR_RELEASE = "48.2.0";
const CLDR_BASE = `https://cdn.jsdelivr.net/npm`;
const CLDR_INPUTS = {
  languages: `cldr-localenames-full@${CLDR_RELEASE}/main/en/languages.json`,
  territories: `cldr-localenames-full@${CLDR_RELEASE}/main/en/territories.json`,
  codeMappings: `cldr-core@${CLDR_RELEASE}/supplemental/codeMappings.json`,
} as const;
const TLD_SOURCE =
  "https://cdn.jsdelivr.net/gh/incognico/list-of-top-level-domains@8cfd3dc8b8e605fc1cb2ba7d5bbf6abf19226c5f/formats/json/tld-list.json";
const LANGUAGE_COMPATIBILITY: Record<string, string[]> = {
  cwd: ["Woods Cree"],
  gom: ["Goan Konkani"],
  hdn: ["Northern Haida"],
  ike: ["Eastern Canadian Inuktitut"],
  ojg: ["Eastern Ojibwa"],
  tkl: ["Tokelau"],
};

type JsonRecord = Record<string, unknown>;

type CldrData = {
  _meta: {
    source: "unicode-org/cldr-json";
    release: string;
    cldrVersion: string;
    locale: "en";
    inputs: string[];
  };
  names: Record<string, string>;
  aliases: Record<string, string[]>;
};

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

async function writeJson(path: URL, value: unknown) {
  const text = JSON.stringify(value, null, 2) + "\n";
  await Deno.writeTextFile(path, text);
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`expected ${label} to be an object`);
  }
  return value as JsonRecord;
}

function nestedRecord(
  value: unknown,
  path: string[],
  label: string,
): JsonRecord {
  let current = record(value, label);
  for (const key of path) {
    current = record(current[key], `${label}.${key}`);
  }
  return current;
}

function stringEntries(value: JsonRecord, label: string): [string, string][] {
  return Object.entries(value).map(([key, entry]) => {
    if (typeof entry !== "string") {
      throw new Error(`expected ${label}.${key} to be a string`);
    }
    return [key, entry];
  });
}

function sortedRecord<T>(entries: [string, T][]): Record<string, T> {
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

function sortedAliases(
  entries: [string, string[]][],
): Record<string, string[]> {
  return sortedRecord(
    entries.map(([code, aliases]) => [
      code,
      [...new Set(aliases)].sort((a, b) => a.localeCompare(b)),
    ]),
  );
}

function metadata(cldrVersion: string, inputs: string[]): CldrData["_meta"] {
  return {
    source: "unicode-org/cldr-json",
    release: CLDR_RELEASE,
    cldrVersion,
    locale: "en",
    inputs,
  };
}

await Deno.mkdir(DATA_DIR, { recursive: true });

const [territoriesJson, languagesJson, mappingsJson] = await Promise.all(
  [
    CLDR_INPUTS.territories,
    CLDR_INPUTS.languages,
    CLDR_INPUTS.codeMappings,
  ].map((input) => fetchJson(`${CLDR_BASE}/${input}`)),
);

const version = nestedRecord(
  mappingsJson,
  ["supplemental", "version"],
  "CLDR code mappings",
);
const cldrVersion = version._cldrVersion;
if (cldrVersion !== "48") {
  throw new Error(`expected CLDR version 48, got ${String(cldrVersion)}`);
}

// English territory names, restricted to current ISO 3166-1 alpha-2 codes.
{
  const territories = nestedRecord(
    territoriesJson,
    ["main", "en", "localeDisplayNames", "territories"],
    "CLDR territories",
  );
  const mappings = nestedRecord(
    mappingsJson,
    ["supplemental", "codeMappings"],
    "CLDR code mappings",
  );
  const names = new Map<string, string>();
  const aliases = new Map<string, string[]>();

  for (const [code, name] of stringEntries(territories, "territory")) {
    if (!/^[A-Z]{2}$/.test(code)) continue;

    const rawMapping = mappings[code];
    if (
      typeof rawMapping !== "object" || rawMapping === null ||
      Array.isArray(rawMapping)
    ) {
      continue;
    }
    const mapping = rawMapping as JsonRecord;
    const numeric = Number(mapping._numeric);
    if (!mapping._alpha3 || !Number.isInteger(numeric) || numeric >= 900) {
      continue;
    }

    names.set(code, name);
  }

  for (const [key, alias] of stringEntries(territories, "territory")) {
    const match = /^([A-Z]{2})-alt-/.exec(key);
    const code = match?.[1];
    if (!code || !names.has(code) || /^[A-Z]{2}$/.test(alias)) continue;
    aliases.set(code, [...(aliases.get(code) ?? []), alias]);
  }

  if (names.size !== 249 || names.has("EU") || names.has("ZZ")) {
    throw new Error(`expected exactly 249 ISO territories, got ${names.size}`);
  }

  const countries: CldrData = {
    _meta: metadata(cldrVersion, [
      CLDR_INPUTS.territories,
      CLDR_INPUTS.codeMappings,
    ]),
    names: sortedRecord([...names]),
    aliases: sortedAliases([...aliases]),
  };
  await writeJson(new URL("countries-en-us.json", DATA_DIR), countries);
  console.log(
    `updated data/countries-en-us.json (CLDR ${CLDR_RELEASE}, ${names.size} territories)`,
  );
}

// English language names with CLDR alternate labels mapped to canonical codes.
{
  const languages = nestedRecord(
    languagesJson,
    ["main", "en", "localeDisplayNames", "languages"],
    "CLDR languages",
  );
  const names = new Map<string, string>();
  const aliases = new Map<string, string[]>();
  const compatibilityNames = new Set(
    Object.values(LANGUAGE_COMPATIBILITY).flat(),
  );

  for (const [code, name] of stringEntries(languages, "language")) {
    if (code.includes("-alt-") || code.includes("-menu-")) continue;
    names.set(code, name);
  }

  for (const [key, alias] of stringEntries(languages, "language")) {
    const match = /^(.*)-alt-/.exec(key);
    const code = match?.[1];
    if (!code || !names.has(code) || compatibilityNames.has(alias)) continue;
    aliases.set(code, [...(aliases.get(code) ?? []), alias]);
  }

  if (names.size !== 660 || names.has("az-alt-short")) {
    throw new Error(
      `expected exactly 660 canonical languages, got ${names.size}`,
    );
  }

  const generatedLanguages = {
    _meta: metadata(cldrVersion, [CLDR_INPUTS.languages]),
    names: sortedRecord([...names]),
    aliases: sortedAliases([...aliases]),
    compatibility: sortedAliases(Object.entries(LANGUAGE_COMPATIBILITY)),
  };
  await writeJson(
    new URL("languages-en.json", DATA_DIR),
    generatedLanguages,
  );
  console.log(
    `updated data/languages-en.json (CLDR ${CLDR_RELEASE}, ${names.size} languages)`,
  );
}

// TLDs are not CLDR data. Keep their independent upstream source.
{
  const tlds = await fetchJson(TLD_SOURCE);
  await writeJson(new URL("tlds.json", DATA_DIR), tlds);
  console.log("updated data/tlds.json");
}
