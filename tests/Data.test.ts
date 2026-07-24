import { assertEquals } from "@std/assert";
import countries from "@data/countries-en-us" with { type: "json" };
import languages from "@data/languages-en" with { type: "json" };

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

const countryData = countries as CldrData;
const languageData = languages as CldrData;

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
