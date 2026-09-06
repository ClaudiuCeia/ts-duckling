// Fetch and vendor external JSON datasets so the library doesn't depend on
// network access at runtime.

import { mkdir, writeFile } from "node:fs/promises";
import { domainToUnicode } from "node:url";

const DATA_DIR = new URL("../data/", import.meta.url);
const CLDR_RELEASE = "48.2.0";
const CLDR_BASE = `https://cdn.jsdelivr.net/npm`;
const CLDR_INPUTS = {
  languages: `cldr-localenames-full@${CLDR_RELEASE}/main/en/languages.json`,
  territories: `cldr-localenames-full@${CLDR_RELEASE}/main/en/territories.json`,
  codeMappings: `cldr-core@${CLDR_RELEASE}/supplemental/codeMappings.json`,
  gregorian: `cldr-dates-full@${CLDR_RELEASE}/main/en/ca-gregorian.json`,
  dateFields: `cldr-dates-full@${CLDR_RELEASE}/main/en/dateFields.json`,
  units: `cldr-units-full@${CLDR_RELEASE}/main/en/units.json`,
  numbers: `cldr-numbers-full@${CLDR_RELEASE}/main/en/numbers.json`,
} as const;
const CLDR_PACKAGES = [
  "cldr-dates-full",
  "cldr-units-full",
  "cldr-numbers-full",
] as const;
const IANA_TLD_SOURCE = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";
const LANGUAGE_COMPATIBILITY: Record<string, string[]> = {
  cwd: ["Woods Cree"],
  gom: ["Goan Konkani"],
  hdn: ["Northern Haida"],
  ike: ["Eastern Canadian Inuktitut"],
  ojg: ["Eastern Ojibwa"],
  tkl: ["Tokelau"],
};
const EN_PARSER_COMPATIBILITY = {
  time: {
    common: ["weekend"],
    eras: ["BCE", "CE"],
    grainAbbreviations: {
      hour: ["h", "hr", "hrs"],
      minute: ["m", "min", "mins"],
      second: ["sec", "secs"],
    },
    relative: {
      ago: ["ago"],
      future: ["following", "next"],
      past: ["last", "past", "previous"],
    },
  },
  quantity: {
    multiplierNames: [
      { value: 100, names: ["hundred", "hundreds"] },
      { value: 1_000, names: ["k", "thousands"] },
      { value: 1_000_000, names: ["millions"] },
      { value: 1_000_000_000, names: ["billions"] },
      { value: 1_000_000_000_000, names: ["trillions"] },
    ],
    plusMinus: "±",
    under: ["less than", "lower than", "under"],
  },
  temperature: {
    below: ["below"],
    units: {
      Celsius: ["C"],
      Fahrenheit: ["F"],
    },
    zero: ["0", "zero"],
  },
} as const;

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

type TldData = {
  _meta: {
    source: typeof IANA_TLD_SOURCE;
    version: string;
  };
  values: string[];
};

type EnglishParserData = {
  _meta: CldrData["_meta"];
  time: {
    months: Record<string, number>;
    weekdays: string[];
    eras: string[];
    relativeDays: Record<string, number>;
    dayPeriods: Record<string, string>;
    grains: Record<string, string[]>;
  };
  quantity: {
    symbols: {
      decimal: string;
      group: string;
      minus: string;
      plus: string;
    };
    compactMultipliers: {
      value: number;
      long: string;
      short: string;
    }[];
  };
  temperature: {
    degree: {
      one: string;
      other: string;
      symbol: string;
    };
    units: Record<string, { name: string; symbol: string }>;
  };
  compatibility: typeof EN_PARSER_COMPATIBILITY;
};

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

async function writeJson(path: URL, value: unknown) {
  const text = JSON.stringify(value, null, 2) + "\n";
  await writeFile(path, text);
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

function stringValue(value: JsonRecord, key: string, label: string): string {
  const entry = value[key];
  if (typeof entry !== "string" || entry.length === 0) {
    throw new Error(`expected ${label}.${key} to be a non-empty string`);
  }
  return entry;
}

function englishMain(value: unknown, label: string): JsonRecord {
  const main = nestedRecord(value, ["main"], label);
  if (Object.keys(main).length !== 1 || !("en" in main)) {
    throw new Error(`expected ${label}.main to contain only the en locale`);
  }
  const english = record(main.en, `${label}.main.en`);
  const identity = record(english.identity, `${label}.main.en.identity`);
  if (identity.language !== "en") {
    throw new Error(`expected ${label} locale identity to be en`);
  }
  return english;
}

function unitNames(value: JsonRecord, label: string): string[] {
  return ["unitPattern-count-one", "unitPattern-count-other"].map((key) => {
    const pattern = stringValue(value, key, label);
    if (!pattern.startsWith("{0} ")) {
      throw new Error(`unexpected ${label}.${key}: ${pattern}`);
    }
    return pattern.slice(4);
  });
}

function unitSymbol(value: JsonRecord, label: string): string {
  const pattern = stringValue(value, "unitPattern-count-one", label);
  const other = stringValue(value, "unitPattern-count-other", label);
  if (!pattern.startsWith("{0}") || pattern !== other) {
    throw new Error(`unexpected ${label} symbol patterns`);
  }
  return pattern.slice(3);
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

function parseIanaTlds(text: string): TldData {
  const lines = text.split(/\r?\n/);
  const header = lines.shift();
  const headerMatch = /^# Version (\d{10}), Last Updated (.+ UTC)$/.exec(
    header ?? "",
  );
  if (!headerMatch) {
    throw new Error(`invalid IANA TLD header: ${String(header)}`);
  }

  const [, version, lastUpdated] = headerMatch;
  const versionDate = version.slice(0, 8);
  const updatedAt = new Date(lastUpdated);
  const updatedDate = Number.isNaN(updatedAt.valueOf())
    ? ""
    : updatedAt.toISOString().slice(0, 10).replaceAll("-", "");
  if (updatedDate !== versionDate) {
    throw new Error(
      `IANA TLD version ${version} does not match Last Updated ${lastUpdated}`,
    );
  }

  if (lines.at(-1) === "") lines.pop();
  const asciiTlds = new Set<string>();
  for (const line of lines) {
    if (!/^[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?$/.test(line)) {
      throw new Error(`invalid IANA TLD label: ${JSON.stringify(line)}`);
    }
    const tld = line.toLowerCase();
    if (asciiTlds.has(tld)) {
      throw new Error(`duplicate IANA TLD label: ${line}`);
    }
    asciiTlds.add(tld);
  }
  if (asciiTlds.size < 1_000 || !asciiTlds.has("com")) {
    throw new Error(`unexpected IANA TLD list with ${asciiTlds.size} labels`);
  }

  const values = new Set(asciiTlds);
  for (const tld of asciiTlds) {
    if (!tld.startsWith("xn--")) continue;
    const unicode = domainToUnicode(tld).toLowerCase();
    if (!unicode || unicode === tld || unicode.includes(".")) {
      throw new Error(`invalid IANA internationalized TLD label: ${tld}`);
    }
    values.add(unicode);
  }

  return {
    _meta: {
      source: IANA_TLD_SOURCE,
      version,
    },
    values: [...values].sort(),
  };
}

await mkdir(DATA_DIR, { recursive: true });

const [
  territoriesJson,
  languagesJson,
  mappingsJson,
  gregorianJson,
  dateFieldsJson,
  unitsJson,
  numbersJson,
] = await Promise.all(
  [
    CLDR_INPUTS.territories,
    CLDR_INPUTS.languages,
    CLDR_INPUTS.codeMappings,
    CLDR_INPUTS.gregorian,
    CLDR_INPUTS.dateFields,
    CLDR_INPUTS.units,
    CLDR_INPUTS.numbers,
  ].map((input) => fetchJson(`${CLDR_BASE}/${input}`)),
);

const packageManifests = await Promise.all(
  CLDR_PACKAGES.map((name) =>
    fetchJson(`${CLDR_BASE}/${name}@${CLDR_RELEASE}/package.json`),
  ),
);
for (const [index, manifestJson] of packageManifests.entries()) {
  const manifest = record(manifestJson, `${CLDR_PACKAGES[index]} manifest`);
  if (manifest.version !== CLDR_RELEASE) {
    throw new Error(
      `expected ${CLDR_PACKAGES[index]} version ${CLDR_RELEASE}, got ${String(
        manifest.version,
      )}`,
    );
  }
}

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
      typeof rawMapping !== "object" ||
      rawMapping === null ||
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
  await writeJson(new URL("languages-en.json", DATA_DIR), generatedLanguages);
  console.log(
    `updated data/languages-en.json (CLDR ${CLDR_RELEASE}, ${names.size} languages)`,
  );
}

// Compact English parser vocabulary and symbols from CLDR, plus explicit
// compatibility aliases for behavior that predates this generated dataset.
{
  const gregorian = englishMain(gregorianJson, "CLDR Gregorian calendar");
  const dateFields = englishMain(dateFieldsJson, "CLDR date fields");
  const units = englishMain(unitsJson, "CLDR units");
  const numbers = englishMain(numbersJson, "CLDR numbers");

  const calendar = nestedRecord(
    gregorian,
    ["dates", "calendars", "gregorian"],
    "CLDR Gregorian calendar en",
  );
  const wideMonths = nestedRecord(
    calendar,
    ["months", "format", "wide"],
    "CLDR Gregorian wide months",
  );
  const monthEntries = stringEntries(wideMonths, "wide month");
  if (
    monthEntries.length !== 12 ||
    monthEntries.some(([month]) => !/^(?:[1-9]|1[0-2])$/.test(month))
  ) {
    throw new Error("expected exactly 12 numeric CLDR wide months");
  }
  const months = sortedRecord(
    monthEntries.map(([month, name]) => [name, Number(month)]),
  );

  const wideWeekdays = nestedRecord(
    calendar,
    ["days", "format", "wide"],
    "CLDR Gregorian wide weekdays",
  );
  const weekdayEntries = stringEntries(wideWeekdays, "wide weekday");
  const weekdayKeys = weekdayEntries.map(([key]) => key).sort();
  if (weekdayKeys.join(",") !== "fri,mon,sat,sun,thu,tue,wed") {
    throw new Error(`unexpected CLDR wide weekday keys: ${weekdayKeys}`);
  }
  const weekdays = weekdayEntries
    .map(([, name]) => name)
    .sort((a, b) => a.localeCompare(b));

  const eraAbbreviations = nestedRecord(
    calendar,
    ["eras", "eraAbbr"],
    "CLDR Gregorian era abbreviations",
  );
  const eras = [
    stringValue(eraAbbreviations, "0", "era abbreviation"),
    stringValue(eraAbbreviations, "1", "era abbreviation"),
  ].sort((a, b) => a.localeCompare(b));

  const wideDayPeriods = nestedRecord(
    calendar,
    ["dayPeriods", "format", "wide"],
    "CLDR Gregorian wide day periods",
  );
  const dayPeriods = sortedRecord([
    [stringValue(wideDayPeriods, "midnight", "wide day period"), "00:00"],
    [stringValue(wideDayPeriods, "noon", "wide day period"), "12:00"],
  ]);

  const dayField = nestedRecord(
    dateFields,
    ["dates", "fields", "day"],
    "CLDR day field",
  );
  const relativeDays = sortedRecord([
    [stringValue(dayField, "relative-type--1", "day field"), -1],
    [stringValue(dayField, "relative-type-0", "day field"), 0],
    [stringValue(dayField, "relative-type-1", "day field"), 1],
  ]);

  const longUnits = nestedRecord(units, ["units", "long"], "CLDR long units");
  const grainEntries: [string, string[]][] = [];
  for (const grain of [
    "century",
    "day",
    "decade",
    "hour",
    "minute",
    "month",
    "quarter",
    "second",
    "week",
    "year",
  ]) {
    const names = unitNames(
      record(longUnits[`duration-${grain}`], `duration-${grain}`),
      `duration-${grain}`,
    ).sort((a, b) => a.localeCompare(b));
    grainEntries.push([grain, names]);
  }
  const grains = sortedRecord(grainEntries);

  const symbols = nestedRecord(
    numbers,
    ["numbers", "symbols-numberSystem-latn"],
    "CLDR Latin number symbols",
  );
  const decimalFormats = nestedRecord(
    numbers,
    ["numbers", "decimalFormats-numberSystem-latn"],
    "CLDR Latin decimal formats",
  );
  const longCompact = nestedRecord(
    decimalFormats,
    ["long", "decimalFormat"],
    "CLDR long compact decimal formats",
  );
  const shortCompact = nestedRecord(
    decimalFormats,
    ["short", "decimalFormat"],
    "CLDR short compact decimal formats",
  );
  const compactMultipliers = [
    1_000, 1_000_000, 1_000_000_000, 1_000_000_000_000,
  ].map((value) => {
    const key = `${value}-count-one`;
    const otherKey = `${value}-count-other`;
    const longPattern = stringValue(longCompact, key, "long compact format");
    const shortPattern = stringValue(shortCompact, key, "short compact format");
    if (
      longPattern !==
        stringValue(longCompact, otherKey, "long compact format") ||
      shortPattern !==
        stringValue(shortCompact, otherKey, "short compact format")
    ) {
      throw new Error(`compact multiplier ${value} differs by plural count`);
    }
    const long = longPattern.replace(/^0+\s*/, "");
    const short = shortPattern.replace(/^0+/, "");
    if (!long || !short || /[0{}]/.test(long + short)) {
      throw new Error(`unexpected compact multiplier patterns for ${value}`);
    }
    return { value, long, short };
  });

  const celsiusNames = unitNames(
    record(longUnits["temperature-celsius"], "temperature-celsius"),
    "temperature-celsius",
  );
  const fahrenheitNames = unitNames(
    record(longUnits["temperature-fahrenheit"], "temperature-fahrenheit"),
    "temperature-fahrenheit",
  );
  const splitTemperatureName = (name: string, label: string) => {
    const match = /^(degrees?) (.+)$/.exec(name);
    if (!match) throw new Error(`unexpected ${label} unit name: ${name}`);
    return { degree: match[1], unit: match[2] };
  };
  const celsius = celsiusNames.map((name) =>
    splitTemperatureName(name, "Celsius"),
  );
  const fahrenheit = fahrenheitNames.map((name) =>
    splitTemperatureName(name, "Fahrenheit"),
  );
  if (
    celsius.some(({ unit }) => unit !== "Celsius") ||
    fahrenheit.some(({ unit }) => unit !== "Fahrenheit") ||
    celsius.map(({ degree }) => degree).join(",") !==
      fahrenheit.map(({ degree }) => degree).join(",")
  ) {
    throw new Error("unexpected CLDR temperature unit names");
  }
  const shortUnits = nestedRecord(
    units,
    ["units", "short"],
    "CLDR short units",
  );
  const degreeSymbol = unitSymbol(
    record(shortUnits["temperature-generic"], "temperature-generic"),
    "temperature-generic",
  );

  const generated: EnglishParserData = {
    _meta: metadata(cldrVersion, [
      CLDR_INPUTS.gregorian,
      CLDR_INPUTS.dateFields,
      CLDR_INPUTS.units,
      CLDR_INPUTS.numbers,
    ]),
    time: {
      months,
      weekdays,
      eras,
      relativeDays,
      dayPeriods,
      grains,
    },
    quantity: {
      symbols: {
        decimal: stringValue(symbols, "decimal", "number symbol"),
        group: stringValue(symbols, "group", "number symbol"),
        minus: stringValue(symbols, "minusSign", "number symbol"),
        plus: stringValue(symbols, "plusSign", "number symbol"),
      },
      compactMultipliers,
    },
    temperature: {
      degree: {
        one: celsius[0].degree,
        other: celsius[1].degree,
        symbol: degreeSymbol,
      },
      units: sortedRecord([
        [
          "Celsius",
          {
            name: celsius[0].unit,
            symbol: unitSymbol(
              record(shortUnits["temperature-celsius"], "temperature-celsius"),
              "temperature-celsius",
            ),
          },
        ],
        [
          "Fahrenheit",
          {
            name: fahrenheit[0].unit,
            symbol: unitSymbol(
              record(
                shortUnits["temperature-fahrenheit"],
                "temperature-fahrenheit",
              ),
              "temperature-fahrenheit",
            ),
          },
        ],
      ]),
    },
    compatibility: EN_PARSER_COMPATIBILITY,
  };
  await writeJson(new URL("parser-en.json", DATA_DIR), generated);
  console.log(
    `updated data/parser-en.json (CLDR ${CLDR_RELEASE}, compact English parser vocabulary)`,
  );
}

// TLDs are IANA root-zone registry data, not CLDR data.
{
  const tlds = parseIanaTlds(await fetchText(IANA_TLD_SOURCE));
  await writeJson(new URL("tlds.json", DATA_DIR), tlds);
  console.log(
    `updated data/tlds.json (IANA ${tlds._meta.version}, ${tlds.values.length} parser labels)`,
  );
}
