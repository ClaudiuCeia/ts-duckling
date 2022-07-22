import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { Duckling } from "../mod.ts";

Deno.test("Language", () => {
  const res = Duckling().extract({
    text: `
        Five languages have more than 50 million native speakers in 
        Europe: Russian, French, Italian, German, and English.
    `,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 42,
        kind: "quantity",
        start: 39,
        text: "50 ",
        value: {
          amount: 50,
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
  }
});
