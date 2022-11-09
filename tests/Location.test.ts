import { assertEquals } from "https://deno.land/std@0.149.0/testing/asserts.ts";
import { Duckling } from "../mod.ts";

Deno.test("Location", () => {
  const res = Duckling().extract({
    text: `
        The Kingdom of the Netherlands consists of the Netherlands proper, the Aruba, Curaçao, and Sint Maarten. 
        The United Kingdom consists of England, Scotland, Wales, and Northern Ireland.
    `,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 39,
        kind: "location",
        start: 28,
        text: "Netherlands",
        value: {
          place: "Netherlands",
          type: "country",
        },
      },
      {
        end: 67,
        kind: "location",
        start: 56,
        text: "Netherlands",
        value: {
          place: "Netherlands",
          type: "country",
        },
      },
      {
        end: 85,
        kind: "location",
        start: 80,
        text: "Aruba",
        value: {
          place: "Aruba",
          type: "country",
        },
      },
      {
        end: 94,
        kind: "location",
        start: 87,
        text: "Curaçao",
        value: {
          place: "Curaçao",
          type: "country",
        },
      },
      {
        end: 112,
        kind: "location",
        start: 100,
        text: "Sint Maarten",
        value: {
          place: "Sint Maarten",
          type: "country",
        },
      },
      {
        end: 141,
        kind: "location",
        start: 127,
        text: "United Kingdom",
        value: {
          place: "United Kingdom",
          type: "country",
        },
      },
      {
        end: 200,
        kind: "location",
        start: 193,
        text: "Ireland",
        value: {
          place: "Ireland",
          type: "country",
        },
      },
    ]);
  }
});
