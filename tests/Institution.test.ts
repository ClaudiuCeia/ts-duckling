import { test } from "bun:test";
import { assertEquals } from "./assert.ts";
import { Duckling, Institution } from "../mod.ts";

test("Educational", () => {
  const res = Duckling().extract(
    "The term was coined by the Italian University of Bologna, which is considered to be the first university with a traditional founding date of 1088.",
  );

  assertEquals(res, [
    {
      end: 56,
      kind: "institution",
      start: 27,
      text: "Italian University of Bologna",
      value: {
        name: "Italian University of Bologna",
        type: "university",
      },
    },
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
});

test("New York City Hall", () => {
  const res = Duckling().extract(
    "New York City Hall, the oldest continuous seat of local government in the United States, completed in 1812",
  );

  assertEquals(res, [
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
});

test("Fordwich Town Hall", () => {
  const res = Duckling().extract(
    "16th-century Fordwich Town Hall in Kent, England, closely resembling a market hall in its design",
  );

  assertEquals(res, [
    {
      end: 12,
      kind: "time",
      start: 0,
      text: "16th-century",
      value: {
        era: "CE",
        grain: "century",
        when: { type: "ordinal", value: 16 },
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
});

test("Town hall of Recife, Brazil", () => {
  const res = Duckling().extract("Town hall of Recife, Brazil");

  assertEquals(res, [
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
});

test("Institution suffix names include their separating space", () => {
  const res = Duckling([Institution.parser]).extract(
    "Harvard University is nearby",
  );

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "Harvard University");
  assertEquals(res[0].value.type, "university");
});

test("Institution prefix names stop before lowercase prose", () => {
  const res = Duckling([Institution.parser]).extract(
    "University of Bologna is old",
  );

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "University of Bologna");
});

test("Institution names support practical punctuation", () => {
  const input =
    "King's College London; Paris-Saclay University; MIT School of Medicine";
  const res = Duckling([Institution.parser]).extract(input);

  assertEquals(
    res.map((entity) => entity.text),
    [
      "King's College London",
      "Paris-Saclay University",
      "MIT School of Medicine",
    ],
  );
});
