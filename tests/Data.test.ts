import { assert, assertEquals } from "@std/assert";
import countries from "@data/countries-en-us" with { type: "json" };
import languages from "@data/languages-en" with { type: "json" };
import parserVocabulary from "@data/parser-en" with { type: "json" };
import tlds from "@data/tlds" with { type: "json" };

type CldrData = {
  _meta: {
    source: string;
    release: string;
    cldrVersion: string;
    locale: string;
    inputs: string[];
  };
  names: Record<string, string>;
  aliases: Record<string, string[]>;
};

type TldData = {
  _meta: {
    source: string;
    version: string;
  };
  values: string[];
};

type ParserData = {
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
    symbols: Record<string, string>;
    compactMultipliers: {
      value: number;
      long: string;
      short: string;
    }[];
  };
  temperature: {
    degree: { one: string; other: string; symbol: string };
    units: Record<string, { name: string; symbol: string }>;
  };
  compatibility: {
    time: {
      common: string[];
      eras: string[];
      grainAbbreviations: Record<string, string[]>;
      relative: Record<string, string[]>;
    };
    quantity: {
      multiplierNames: { value: number; names: string[] }[];
      plusMinus: string;
      under: string[];
    };
    temperature: {
      below: string[];
      units: Record<string, string[]>;
      zero: string[];
    };
  };
};

const countryData = countries as CldrData;
const languageData = languages as CldrData;
const parserData = parserVocabulary as ParserData;
const tldData = tlds as TldData;

const assertSorted = (values: string[]) => {
  assertEquals(values, values.toSorted((a, b) => a.localeCompare(b)));
};

Deno.test("CLDR data has pinned provenance and deterministic ordering", () => {
  for (const data of [countryData, languageData]) {
    assertEquals(data._meta.source, "unicode-org/cldr-json");
    assertEquals(data._meta.release, "48.2.0");
    assertEquals(data._meta.cldrVersion, "48");
    assertEquals(data._meta.locale, "en");
    assertEquals(Object.keys(data.names), Object.keys(data.names).toSorted());
    assertEquals(
      Object.keys(data.aliases),
      Object.keys(data.aliases).toSorted(),
    );
    for (const aliases of Object.values(data.aliases)) {
      assertEquals(aliases, aliases.toSorted());
    }
  }

  assertEquals(countryData._meta.inputs, [
    "cldr-localenames-full@48.2.0/main/en/territories.json",
    "cldr-core@48.2.0/supplemental/codeMappings.json",
  ]);
  assertEquals(languageData._meta.inputs, [
    "cldr-localenames-full@48.2.0/main/en/languages.json",
  ]);
});

Deno.test("CLDR territories contain exactly the ISO alpha-2 set", () => {
  assertEquals(Object.keys(countryData.names).length, 249);
  assertEquals(
    Object.keys(countryData.names).every((code) => /^[A-Z]{2}$/.test(code)),
    true,
  );
  assertEquals(countryData.names.TR, "Türkiye");
  assertEquals(countryData.aliases.TR, ["Turkey"]);

  for (const code of ["EU", "EZ", "UN", "XA", "XB", "XK", "ZZ"]) {
    assertEquals(countryData.names[code], undefined);
  }
});

Deno.test("CLDR language aliases map to canonical codes", () => {
  assertEquals(Object.keys(languageData.names).length, 660);
  assertEquals(languageData.names.az, "Azerbaijani");
  assertEquals(languageData.aliases.az, ["Azeri"]);
  assertEquals(languageData.names["en-US"], "American English");
  assertEquals(
    Object.keys(languageData.names).some((code) =>
      code.includes("-alt-") || code.includes("-menu-")
    ),
    false,
  );
  assertEquals(
    Object.keys(languageData.aliases).every((code) =>
      languageData.names[code] !== undefined
    ),
    true,
  );
});

Deno.test("English parser data has pinned compact provenance and shape", () => {
  assertEquals(parserData._meta, {
    source: "unicode-org/cldr-json",
    release: "48.2.0",
    cldrVersion: "48",
    locale: "en",
    inputs: [
      "cldr-dates-full@48.2.0/main/en/ca-gregorian.json",
      "cldr-dates-full@48.2.0/main/en/dateFields.json",
      "cldr-units-full@48.2.0/main/en/units.json",
      "cldr-numbers-full@48.2.0/main/en/numbers.json",
    ],
  });
  assertEquals(Object.keys(parserData), [
    "_meta",
    "time",
    "quantity",
    "temperature",
    "compatibility",
  ]);
  assertEquals(Object.keys(parserData.time), [
    "months",
    "weekdays",
    "eras",
    "relativeDays",
    "dayPeriods",
    "grains",
  ]);
  assertEquals(Object.keys(parserData.time.months).length, 12);
  assertEquals(Object.keys(parserData.time.grains).length, 10);
  assertEquals(parserData.quantity.compactMultipliers.length, 4);
  assertEquals(Object.keys(parserData.temperature.units), [
    "Celsius",
    "Fahrenheit",
  ]);
});

Deno.test("English parser data is deterministically ordered", () => {
  for (
    const record of [
      parserData.time.months,
      parserData.time.relativeDays,
      parserData.time.dayPeriods,
      parserData.time.grains,
      parserData.temperature.units,
      parserData.compatibility.time.grainAbbreviations,
      parserData.compatibility.time.relative,
      parserData.compatibility.temperature.units,
    ]
  ) {
    assertSorted(Object.keys(record));
  }
  for (
    const values of [
      parserData.time.weekdays,
      parserData.time.eras,
      ...Object.values(parserData.time.grains),
      parserData.compatibility.time.common,
      parserData.compatibility.time.eras,
      ...Object.values(parserData.compatibility.time.grainAbbreviations),
      ...Object.values(parserData.compatibility.time.relative),
      parserData.compatibility.quantity.under,
      parserData.compatibility.temperature.below,
      ...Object.values(parserData.compatibility.temperature.units),
      parserData.compatibility.temperature.zero,
    ]
  ) {
    assertSorted(values);
    assertEquals(new Set(values).size, values.length);
  }
  assertEquals(
    parserData.quantity.compactMultipliers.map(({ value }) => value),
    [1e3, 1e6, 1e9, 1e12],
  );
  assertEquals(
    parserData.compatibility.quantity.multiplierNames.map(({ value }) => value),
    [1e2, 1e3, 1e6, 1e9, 1e12],
  );
  for (const { names } of parserData.compatibility.quantity.multiplierNames) {
    assertSorted(names);
  }
});

Deno.test("English parser data contains CLDR and compatibility sentinels", () => {
  assertEquals(parserData.time.months.January, 1);
  assert(parserData.time.weekdays.includes("Wednesday"));
  assertEquals(parserData.time.eras, ["AD", "BC"]);
  assertEquals(parserData.time.relativeDays, {
    today: 0,
    tomorrow: 1,
    yesterday: -1,
  });
  assertEquals(parserData.time.dayPeriods, {
    midnight: "00:00",
    noon: "12:00",
  });
  assertEquals(parserData.time.grains.century, ["centuries", "century"]);
  assertEquals(parserData.time.grains.quarter, ["quarter", "quarters"]);

  assertEquals(parserData.quantity.symbols, {
    decimal: ".",
    group: ",",
    minus: "-",
    plus: "+",
  });
  assertEquals(parserData.quantity.compactMultipliers[3], {
    value: 1e12,
    long: "trillion",
    short: "T",
  });
  assertEquals(parserData.temperature.degree, {
    one: "degree",
    other: "degrees",
    symbol: "°",
  });
  assertEquals(parserData.temperature.units.Fahrenheit, {
    name: "Fahrenheit",
    symbol: "°F",
  });

  assertEquals(parserData.compatibility.time.eras, ["BCE", "CE"]);
  assertEquals(parserData.compatibility.time.grainAbbreviations.minute, [
    "m",
    "min",
    "mins",
  ]);
  assertEquals(parserData.compatibility.quantity.plusMinus, "±");
  assertEquals(parserData.compatibility.temperature.units.Celsius, ["C"]);
});

Deno.test("IANA TLD data has provenance and deterministic parser values", () => {
  assertEquals(
    tldData._meta.source,
    "https://data.iana.org/TLD/tlds-alpha-by-domain.txt",
  );
  assert(/^\d{10}$/.test(tldData._meta.version));
  assertEquals(tldData.values, tldData.values.toSorted());
  assertEquals(new Set(tldData.values).size, tldData.values.length);
  assert(tldData.values.every((value) => value === value.toLowerCase()));

  assert(tldData.values.includes("music"));
  assert(tldData.values.includes("xn--p1ai"));
  assert(tldData.values.includes("рф"));
  assertEquals(tldData.values.includes("active"), false);
  assertEquals(tldData.values.includes("an"), false);
});
