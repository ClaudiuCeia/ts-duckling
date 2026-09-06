import { test } from "bun:test";
import { assertEquals } from "./assert.ts";
import { Duckling, Language } from "../mod.ts";

test("Language", () => {
  const res = Duckling().extract(`
        Five languages have more than 50 million native speakers in 
        Europe: Russian, French, Italian, German, and English.
    `);

  assertEquals(res, [
    {
      end: 49,
      kind: "quantity",
      start: 39,
      text: "50 million",
      value: {
        amount: 50000000,
      },
    },
    {
      end: 93,
      kind: "language",
      start: 86,
      text: "Russian",
      value: {
        code: "ru",
        name: "Russian",
      },
    },
    {
      end: 101,
      kind: "language",
      start: 95,
      text: "French",
      value: {
        code: "fr",
        name: "French",
      },
    },
    {
      end: 110,
      kind: "language",
      start: 103,
      text: "Italian",
      value: {
        code: "it",
        name: "Italian",
      },
    },
    {
      end: 118,
      kind: "language",
      start: 112,
      text: "German",
      value: {
        code: "de",
        name: "German",
      },
    },
    {
      end: 131,
      kind: "language",
      start: 124,
      text: "English",
      value: {
        code: "en",
        name: "English",
      },
    },
  ]);
});

test("Language maps CLDR alternate names to canonical codes", () => {
  const res = Duckling([Language.parser]).extract(
    "Azeri, American English, Mandarin Chinese, and Arabic, Najdi",
  );

  assertEquals(
    res.map((entity) => entity.value),
    [
      { code: "az", name: "Azeri" },
      { code: "en-US", name: "American English" },
      { code: "zh", name: "Mandarin Chinese" },
      { code: "ars", name: "Arabic, Najdi" },
    ],
  );
});

test("Language preserves names shipped by the previous CLDR dataset", () => {
  const res = Duckling([Language.parser]).extract(
    "Woods Cree, Goan Konkani, Northern Haida, Eastern Canadian Inuktitut, Eastern Ojibwa, and Tokelau",
  );

  assertEquals(
    res.map((entity) => entity.value),
    [
      { code: "cwd", name: "Woods Cree" },
      { code: "gom", name: "Goan Konkani" },
      { code: "hdn", name: "Northern Haida" },
      { code: "ike", name: "Eastern Canadian Inuktitut" },
      { code: "ojg", name: "Eastern Ojibwa" },
      { code: "tkl", name: "Tokelau" },
    ],
  );
});

test("Language prefers the longest overlapping name and preserves canonical casing", () => {
  const res = Duckling([Language.parser]).extract("ARABIC, NAJDI and ENGLISH");

  assertEquals(
    res.map((entity) => entity.value),
    [
      { code: "ars", name: "Arabic, Najdi" },
      { code: "en", name: "English" },
    ],
  );
});
