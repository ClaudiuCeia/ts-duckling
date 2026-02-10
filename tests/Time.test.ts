import { assertEquals } from "@std/assert";
import { FakeTime } from "@std/testing/time";
import { Duckling, Time } from "../mod.ts";

Deno.test("UnspecifiedGrainAmount", () => {
  const res = Duckling([Time.parser]).extract(
    "People have been at this for centuries.",
  );

  assertEquals(res, [
    {
      end: 38,
      kind: "time",
      start: 29,
      text: "centuries",
      value: {
        era: "CE",
        grain: "centuries",
        when: "centuries",
      },
    },
  ]);
});

Deno.test("DayOfWeek", () => {
  const res = Duckling([Time.parser]).extract(
    "We could meet them either Monday or Friday.",
  );

  assertEquals(res, [
    {
      end: 32,
      kind: "time",
      start: 26,
      text: "Monday",
      value: {
        era: "CE",
        grain: "day",
        when: "Monday",
      },
    },
    {
      end: 42,
      kind: "time",
      start: 36,
      text: "Friday",
      value: {
        era: "CE",
        grain: "day",
        when: "Friday",
      },
    },
  ]);
});

Deno.test("Common", () => {
  const res = Duckling([Time.parser]).extract(
    "I'm not sure if the event is tomorrow. Or was it yesterday?",
  );

  assertEquals(res.length, 2);
});

Deno.test("ISODateTimeZ", () => {
  const res = Duckling([Time.parser]).extract(
    "Timestamp: 2004-07-12T22:18:09Z.",
  );

  assertEquals(res, [
    {
      end: 31,
      kind: "time",
      start: 11,
      text: "2004-07-12T22:18:09Z",
      value: {
        era: "CE",
        grain: "second",
        when: "2004-07-12T22:18:09.000Z",
      },
    },
  ]);
});

Deno.test("GrainQuantity", () => {
  const res = Duckling([Time.parser]).extract(
    "I'll get to it in 5 days, it only takes about 51615 seconds.",
  );

  assertEquals(res, [
    {
      end: 24,
      kind: "time",
      start: 18,
      text: "5 days",
      value: {
        era: "CE",
        grain: "days",
        when: "5 days",
      },
    },
    {
      end: 59,
      kind: "time",
      start: 46,
      text: "51615 seconds",
      value: {
        era: "CE",
        grain: "seconds",
        when: "51615 seconds",
      },
    },
  ]);
});

Deno.test("Relative", () => {
  const res = Duckling([Time.parser]).extract(`
        We've been through this 4 days ago. Last week I also checked out the work
        that was done over the past year and I'm not sure what we'll do the next
        2 years
    `);

  assertEquals(res, [
    {
      end: 43,
      kind: "time",
      start: 33,
      text: "4 days ago",
      value: {
        era: "CE",
        grain: "days",
        when: "-4 days",
      },
    },
    {
      end: 54,
      kind: "time",
      start: 45,
      text: "Last week",
      value: {
        era: "CE",
        grain: "week",
        when: "-1 week",
      },
    },
    {
      end: 123,
      kind: "time",
      start: 114,
      text: "past year",
      value: {
        era: "CE",
        grain: "year",
        when: "-1 year",
      },
    },
    {
      end: 179,
      kind: "time",
      start: 159,
      text: "next\n        2 years",
      value: {
        era: "CE",
        grain: "years",
        when: "2 years",
      },
    },
  ]);
});

Deno.test("Relative defaults and optional quantities", () => {
  // Ensure the conditional defaults in Relative() are exercised.
  const nextWeek = Time.Relative({
    text: "next week",
    index: 0,
  });
  assertEquals(nextWeek.success, true);
  if (nextWeek.success) {
    assertEquals(nextWeek.value.value.when, "1 week");
  }

  const lastTwoWeeks = Time.Relative({
    text: "last 2 weeks",
    index: 0,
  });
  assertEquals(lastTwoWeeks.success, true);
  if (lastTwoWeeks.success) {
    assertEquals(lastTwoWeeks.value.value.when, "-2 weeks");
  }

  const weekAgo = Time.Relative({
    text: "week ago",
    index: 0,
  });
  assertEquals(weekAgo.success, true);
  if (weekAgo.success) {
    assertEquals(weekAgo.value.value.when, "-1 week");
  }
});

Deno.test("PartialDateMonthYear numeric", () => {
  const res = Duckling([Time.parser]).extract("What date is it? 12/2022?");

  assertEquals(res, [
    {
      end: 24,
      kind: "time",
      start: 17,
      text: "12/2022",
      value: {
        era: "CE",
        grain: "day",
        when: "2022-01-11T22:00:00.000Z",
      },
    },
  ]);
});

Deno.test("Year era CE/AD", () => {
  const res = Duckling([Time.parser]).extract(
    "Around 200 AD the empire expanded",
  );

  // Don't assert full shape; just ensure we parse CE branch.
  const t = res.find((e) => e.kind === "time");
  assertEquals(t?.kind, "time");
  if (t) assertEquals(t.value.era, "CE");
});

Deno.test("PartialDateMonthYear literal", () => {
  const res = Duckling([Time.parser]).extract(
    "What date is it? Sometime in June 2022?",
  );

  assertEquals(res, [
    {
      end: 38,
      kind: "time",
      start: 29,
      text: "June 2022",
      value: {
        era: "CE",
        grain: "day",
        when: "2022-05-31T21:00:00.000Z",
      },
    },
  ]);
});

Deno.test("PartialDateDayMonth literal", () => {
  const time = new FakeTime(new Date("2022-01-01T00:00:00.000Z"));
  try {
    const res = Duckling([Time.parser]).extract(
      "What date is it? 12th of June?",
    );

    assertEquals(res, [
      {
        end: 29,
        kind: "time",
        start: 17,
        text: "12th of June",
        value: {
          era: "CE",
          grain: "day",
          when: "2022-06-11T21:00:00.000Z",
        },
      },
    ]);
  } finally {
    time.restore();
  }
});

Deno.test("FullDate", () => {
  const res = Duckling([Time.parser]).extract(
    "What date is it? 1st of June 2023?",
  );

  assertEquals(res, [
    {
      end: 33,
      kind: "time",
      start: 17,
      text: "1st of June 2023",
      value: {
        era: "CE",
        grain: "day",
        when: "2023-05-31T21:00:00.000Z",
      },
    },
  ]);
});

Deno.test("False positive time", () => {
  const res = Duckling([Time.parser]).extract("6/2022 is 0.00296735905");

  assertEquals(res, [
    {
      end: 6,
      kind: "time",
      start: 0,
      text: "6/2022",
      value: {
        era: "CE",
        grain: "day",
        when: "2022-01-05T22:00:00.000Z",
      },
    },
  ]);
});

Deno.test("Era", () => {
  const res = Duckling([Time.parser]).extract(
    "It has been dated to circa 100 BC.",
  );

  assertEquals(res, [
    {
      end: 33,
      kind: "time",
      start: 27,
      text: "100 BC",
      value: {
        era: "BCE",
        grain: "era",
        when: "100 BC",
      },
    },
  ]);
});

Deno.test("QualifiedGrain", () => {
  const res = Duckling([Time.parser]).extract(
    "In the 5th century BC in ancient India, the grammarian Pāṇini formulated the grammar of Sanskrit.",
  );

  assertEquals(res, [
    {
      end: 21,
      kind: "time",
      start: 7,
      text: "5th century BC",
      value: {
        era: "BCE",
        grain: "century",
        when: "5th century BC",
      },
    },
  ]);
});

Deno.test("No grain quantity false positive", () => {
  const res = Time.GrainQuantity({
    text: `Less than 10 Hertz`,
    index: 0,
  });

  assertEquals(res.success, false);
});

Deno.test("Literal month", () => {
  const time = new FakeTime(new Date("2022-01-01T00:00:00.000Z"));
  try {
    const res = Duckling([Time.parser]).extract(
      "July and August highs in Greece average around 35.8 °C",
    );

    assertEquals(res, [
      {
        end: 4,
        kind: "time",
        start: 0,
        text: "July",
        value: {
          era: "CE",
          grain: "month",
          when: "2022-06-30T21:00:00.000Z",
        },
      },
      {
        end: 15,
        kind: "time",
        start: 9,
        text: "August",
        value: {
          era: "CE",
          grain: "month",
          when: "2022-07-31T21:00:00.000Z",
        },
      },
    ]);
  } finally {
    time.restore();
  }
});

Deno.test("Circa time", () => {
  const res = Duckling([Time.parser]).extract("Some things happened c. 425 BC");

  assertEquals(res, [
    {
      end: 30,
      kind: "time",
      start: 21,
      text: "c. 425 BC",
      value: {
        era: "BCE",
        grain: "era",
        when: "425 BC",
      },
    },
  ]);
});
Deno.test("FullDate: invalid date backtracks instead of throwing", () => {
  // 31st of February is not a real date — should not throw
  const res = Duckling([Time.parser]).extract(
    "On 31/02/2024 something happened",
  );
  // Should not contain an entity for this invalid date
  for (const entity of res) {
    if (entity.kind === "time" && typeof entity.value.when === "string") {
      assertEquals(
        entity.value.when !== "Invalid Date",
        true,
        `Should not produce Invalid Date, got entity: ${
          JSON.stringify(entity)
        }`,
      );
    }
  }
});

Deno.test("FullDate: valid date still parses correctly", () => {
  const res = Duckling([Time.parser]).extract("On 15/06/2024 we met.");
  const dates = res.filter((e) => e.kind === "time");
  assertEquals(dates.length >= 1, true, "Should find at least one time entity");
  const date = dates[0];
  assertEquals(typeof date.value.when, "string");
  assertEquals((date.value.when as string).includes("Invalid"), false);
});

Deno.test("FullDate: does not crash on nonsense date-like input", () => {
  // Should not throw, regardless of what entities are produced
  const inputs = [
    "99/99/9999 is not a date",
    "Meeting on 32-13-2025 maybe",
    "Date: 00.00.0000 test",
  ];
  for (const input of inputs) {
    const res = Duckling([Time.parser]).extract(input);
    // Just verify it doesn't throw and doesn't produce "Invalid Date"
    for (const entity of res) {
      if (entity.kind === "time" && typeof entity.value.when === "string") {
        assertEquals(
          entity.value.when !== "Invalid Date",
          true,
          `Should not produce Invalid Date for "${input}", got: ${
            JSON.stringify(entity)
          }`,
        );
      }
    }
  }
});

// ── ISODate (YYYY-MM-DD) ───────────────────────────────────────────

Deno.test("ISODate: basic YYYY-MM-DD", () => {
  const res = Duckling([Time.parser]).extract("Published 2024-05-18.");

  assertEquals(res, [
    {
      end: 20,
      kind: "time",
      start: 10,
      text: "2024-05-18",
      value: {
        era: "CE",
        grain: "day",
        when: "2024-05-18T00:00:00.000Z",
      },
    },
  ]);
});

Deno.test("ISODate: multiple YYYY-MM-DD in sentence", () => {
  const res = Duckling([Time.parser]).extract(
    "Born on 1990-03-15, died 2060-01-01.",
  );

  assertEquals(res.length, 2);
  assertEquals(res[0].text, "1990-03-15");
  assertEquals(res[0].value.when, "1990-03-15T00:00:00.000Z");
  assertEquals(res[1].text, "2060-01-01");
  assertEquals(res[1].value.when, "2060-01-01T00:00:00.000Z");
});

// ── ISODateTime (with offset / without Z) ──────────────────────────

Deno.test("ISODateTime: with positive offset", () => {
  const res = Duckling([Time.parser]).extract(
    "Logged at 2024-05-18T10:30:00+02:00.",
  );

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "2024-05-18T10:30:00+02:00");
  assertEquals(res[0].value.when, "2024-05-18T08:30:00.000Z");
  assertEquals(res[0].value.grain, "second");
});

Deno.test("ISODateTime: with negative offset", () => {
  const res = Duckling([Time.parser]).extract(
    "Event: 2024-05-18T10:30:00-05:00.",
  );

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "2024-05-18T10:30:00-05:00");
  assertEquals(res[0].value.when, "2024-05-18T15:30:00.000Z");
});

Deno.test("ISODateTime: without timezone (local time)", () => {
  const res = Duckling([Time.parser]).extract(
    "Timestamp: 2024-05-18T10:30:00.",
  );

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "2024-05-18T10:30:00");
  assertEquals(res[0].value.grain, "second");
});

Deno.test("ISODateTime: without seconds", () => {
  const res = Duckling([Time.parser]).extract(
    "Meeting at 2024-05-18T10:30.",
  );

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "2024-05-18T10:30");
  assertEquals(res[0].value.grain, "second");
});

// ── LiteralMonthDayYear ────────────────────────────────────────────

Deno.test("LiteralMonthDayYear: with comma", () => {
  const res = Duckling([Time.parser]).extract("On July 13, 2016 we met.");

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "July 13, 2016");
  assertEquals(res[0].value.grain, "day");
});

Deno.test("LiteralMonthDayYear: without comma", () => {
  const res = Duckling([Time.parser]).extract("On March 3 1990 we met.");

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "March 3 1990");
  assertEquals(res[0].value.grain, "day");
});

Deno.test("LiteralMonthDayYear: various months", () => {
  const inputs = [
    "January 1, 2000",
    "December 25, 2024",
    "September 5, 2019",
  ];
  for (const input of inputs) {
    const res = Duckling([Time.parser]).extract(`Published: ${input}.`);
    assertEquals(
      res.length >= 1,
      true,
      `Should extract at least one entity from "${input}", got ${res.length}`,
    );
    assertEquals(res[0].text, input);
    assertEquals(res[0].value.grain, "day");
  }
});

// ── ClockTime ──────────────────────────────────────────────────────

Deno.test("ClockTime: HH:MM with timezone in parens", () => {
  const res = Duckling([Time.parser]).extract("The call is at 23:28 (UTC).");

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "23:28 (UTC)");
  assertEquals(res[0].value.when, "23:28 (UTC)");
  assertEquals(res[0].value.grain, "minute");
});

Deno.test("ClockTime: HH:MM:SS", () => {
  const res = Duckling([Time.parser]).extract("Logged at 23:28:59.");

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "23:28:59");
  assertEquals(res[0].value.grain, "second");
});

Deno.test("ClockTime: 12-hour AM/PM", () => {
  const cases = [
    { input: "Meet at 3:45 PM.", expected: "3:45 PM" },
    { input: "Wake up at 6:00 AM.", expected: "6:00 AM" },
    { input: "Deadline 11:59 pm.", expected: "11:59 pm" },
  ];
  for (const { input, expected } of cases) {
    const res = Duckling([Time.parser]).extract(input);
    assertEquals(
      res.length >= 1,
      true,
      `Should extract at least one entity from "${input}"`,
    );
    assertEquals(res[0].text, expected);
    assertEquals(res[0].value.grain, "minute");
  }
});

Deno.test("ClockTime: HH:MM with bare timezone", () => {
  const cases = [
    { input: "14:00 UTC", expected: "14:00 UTC" },
    { input: "09:30 EST", expected: "09:30 EST" },
    { input: "11:15 CET", expected: "11:15 CET" },
  ];
  for (const { input, expected } of cases) {
    const res = Duckling([Time.parser]).extract(input);
    assertEquals(
      res.length >= 1,
      true,
      `Should extract at least one entity from "${input}"`,
    );
    assertEquals(res[0].text, expected);
  }
});

// ── Noon / Midnight ────────────────────────────────────────────────

Deno.test("Common: noon", () => {
  const res = Duckling([Time.parser]).extract("We eat lunch at noon.");
  assertEquals(res.length, 1);
  assertEquals(res[0].text, "noon");
  assertEquals(res[0].value.when, "12:00");
  assertEquals(res[0].value.grain, "hour");
});

Deno.test("Common: midnight", () => {
  const res = Duckling([Time.parser]).extract("Come back before midnight.");
  assertEquals(res.length, 1);
  assertEquals(res[0].text, "midnight");
  assertEquals(res[0].value.when, "00:00");
  assertEquals(res[0].value.grain, "hour");
});
