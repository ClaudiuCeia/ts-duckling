import { assertEquals } from "https://deno.land/std@0.149.0/testing/asserts.ts";
import { Duckling } from "../mod.ts";

Deno.test("Educational", () => {
  const res = Duckling().extract({
    text: `The term was coined by the Italian University of Bologna, which is considered to be the first university with a traditional founding date of 1088.`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 34,
        kind: "language",
        start: 27,
        text: "Italian",
        value: {
          code: "it",
          name: "Italian",
        },
      },
      {
        end: 56,
        kind: "institution",
        start: 35,
        text: "University of Bologna",
        value: {
          name: "University of Bologna",
          type: "university",
        },
      },
      {
        end: 146,
        kind: "quantity",
        start: 141,
        text: "1088.",
        value: {
          amount: 1088,
        },
      },
    ]);
  }
});

Deno.test("New York City Hall", () => {
  const res = Duckling().extract({
    text: `New York City Hall, the oldest continuous seat of local government in the United States, completed in 1812`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 18,
        kind: "institution",
        start: 0,
        text: "New York City Hall",
        value: {
          name: "New York City Hall",
          type: "city hall",
        },
      },
      {
        end: 87,
        kind: "location",
        start: 74,
        text: "United States",
        value: {
          place: "United States",
          type: "country",
        },
      },
      {
        end: 106,
        kind: "quantity",
        start: 102,
        text: "1812",
        value: {
          amount: 1812,
        },
      },
    ]);
  }
});

Deno.test("Fordwich Town Hall", () => {
  const res = Duckling().extract({
    text: `16th-century Fordwich Town Hall in Kent, England, closely resembling a market hall in its design`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 12,
        kind: "time",
        start: 0,
        text: "16th-century",
        value: {
          era: "CE",
          grain: "century",
          when: "16th century ",
        },
      },
      {
        end: 31,
        kind: "institution",
        start: 13,
        text: "Fordwich Town Hall",
        value: {
          name: "Fordwich Town Hall",
          type: "town hall",
        },
      },
    ]);
  }
});

Deno.test("Town hall of Recife, Brazil", () => {
  const res = Duckling().extract({
    text: `Town hall of Recife, Brazil`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 19,
        kind: "institution",
        start: 0,
        text: "Town hall of Recife",
        value: {
          name: "Town hall of Recife",
          type: "town hall",
        },
      },
      {
        end: 27,
        kind: "location",
        start: 21,
        text: "Brazil",
        value: {
          place: "Brazil",
          type: "country",
        },
      },
    ]);
  }
});
