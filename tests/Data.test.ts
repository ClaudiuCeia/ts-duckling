import { assert, assertEquals } from "@std/assert";
import countries from "@data/countries-en-us" with { type: "json" };
import languages from "@data/languages-en" with { type: "json" };
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

const countryData = countries as CldrData;
const languageData = languages as CldrData;
const tldData = tlds as TldData;

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
