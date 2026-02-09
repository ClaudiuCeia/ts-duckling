import { assertEquals } from "@std/assert";
import { Duckling } from "../mod.ts";

Deno.test("Language", () => {
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
