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
        when: { type: "label", value: "centuries" },
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
        when: { type: "label", value: "Monday" },
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
        when: { type: "label", value: "Friday" },
      },
    },
  ]);
});

Deno.test("Common relative days", () => {
  const time = new FakeTime(new Date("2024-03-01T12:00:00.000Z"));
  try {
    const res = Duckling([Time.parser]).extract("today, yesterday, tomorrow");

    assertEquals(res.map((entity) => entity.value.when), [
      { type: "date", year: 2024, month: 3, day: 1 },
      { type: "date", year: 2024, month: 2, day: 29 },
      { type: "date", year: 2024, month: 3, day: 2 },
    ]);
  } finally {
    time.restore();
  }
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
        when: { type: "datetime", iso: "2004-07-12T22:18:09.000Z" },
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
        when: { type: "relative", offset: 5 },
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
        when: { type: "relative", offset: 51615 },
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
        when: { type: "relative", offset: -4 },
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
        when: { type: "relative", offset: -1 },
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
        when: { type: "relative", offset: -1 },
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
        when: { type: "relative", offset: 2 },
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
    assertEquals(nextWeek.value.value.when, { type: "relative", offset: 1 });
  }

  const lastTwoWeeks = Time.Relative({
    text: "last 2 weeks",
    index: 0,
  });
  assertEquals(lastTwoWeeks.success, true);
  if (lastTwoWeeks.success) {
    assertEquals(lastTwoWeeks.value.value.when, {
      type: "relative",
      offset: -2,
    });
  }

  const weekAgo = Time.Relative({
    text: "week ago",
    index: 0,
  });
  assertEquals(weekAgo.success, true);
  if (weekAgo.success) {
    assertEquals(weekAgo.value.value.when, { type: "relative", offset: -1 });
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
        grain: "month",
        when: { type: "date", year: 2022, month: 12 },
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
        grain: "month",
        when: { type: "date", year: 2022, month: 6 },
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
          when: { type: "date", year: 2022, month: 6, day: 12 },
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
        when: { type: "date", year: 2023, month: 6, day: 1 },
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
        grain: "month",
        when: { type: "date", year: 2022, month: 6 },
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
        grain: "year",
        when: { type: "year", year: 100 },
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
        when: { type: "ordinal", value: 5 },
      },
    },
  ]);
});

Deno.test("qualified grain enumeration inherits the final grain", () => {
  const res = Duckling([Time.parser]).extract(
    "16th, 17th and 18th century",
  );

  assertEquals(res, [
    {
      end: 4,
      kind: "time",
      start: 0,
      text: "16th",
      value: {
        era: "CE",
        grain: "century",
        when: { type: "ordinal", value: 16 },
      },
    },
    {
      end: 10,
      kind: "time",
      start: 6,
      text: "17th",
      value: {
        era: "CE",
        grain: "century",
        when: { type: "ordinal", value: 17 },
      },
    },
    {
      end: 27,
      kind: "time",
      start: 15,
      text: "18th century",
      value: {
        era: "CE",
        grain: "century",
        when: { type: "ordinal", value: 18 },
      },
    },
  ]);
});

Deno.test("qualified grain enumerations propagate eras and Oxford commas", () => {
  const res = Duckling([Time.parser]).extract(
    "16th, 17th, and 18th century BC",
  );

  assertEquals(
    res.map((entity) => [entity.value.when, entity.value.era]),
    [
      [{ type: "ordinal", value: 16 }, "BCE"],
      [{ type: "ordinal", value: 17 }, "BCE"],
      [{ type: "ordinal", value: 18 }, "BCE"],
    ],
  );
});

Deno.test("qualified grain accepts end of input", () => {
  const res = Duckling([Time.parser]).extract("18th century");

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "18th century");
  assertEquals(res[0].value.grain, "century");
});

Deno.test("qualified grain enumeration requires an explicit final grain", () => {
  const res = Duckling([Time.parser]).extract(
    "The 16th, 17th and 18th amendments",
  );

  assertEquals(res, []);
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
          when: { type: "date", year: 2022, month: 7 },
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
          when: { type: "date", year: 2022, month: 8 },
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
        grain: "year",
        when: { type: "year", year: 425 },
      },
    },
  ]);
});
Deno.test("FullDate: invalid date backtracks instead of throwing", () => {
  const res = Duckling([Time.parser]).extract(
    "On 31/02/2024 something happened",
  );

  assertEquals(res, []);
});

Deno.test("FullDate: valid date still parses correctly", () => {
  const res = Duckling([Time.parser]).extract("On 15/06/2024 we met.");

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "15/06/2024");
  assertEquals(res[0].value.when, {
    type: "date",
    year: 2024,
    month: 6,
    day: 15,
  });
});

Deno.test("calendar dates validate leap days", () => {
  const valid = [
    "29/02/2024",
    "29 February 2024",
    "February 29, 2024",
    "2024-02-29",
  ];
  for (const input of valid) {
    const res = Duckling([Time.parser]).extract(input);
    assertEquals(res.length, 1, input);
    assertEquals(
      res[0].value.when,
      { type: "date", year: 2024, month: 2, day: 29 },
      input,
    );
  }

  assertEquals(Time.FullDate({ text: "29/02/2023", index: 0 }).success, false);
  assertEquals(
    Time.FullDate({ text: "29 February 2023", index: 0 }).success,
    false,
  );
  assertEquals(
    Time.LiteralMonthDayYear({ text: "February 29, 2023", index: 0 })
      .success,
    false,
  );
  assertEquals(Time.ISODate({ text: "2023-02-29", index: 0 }).success, false);
});

Deno.test("calendar date productions reject rollover dates", () => {
  assertEquals(Time.FullDate({ text: "31/04/2024", index: 0 }).success, false);
  assertEquals(
    Time.FullDate({ text: "31 April 2024", index: 0 }).success,
    false,
  );
  assertEquals(
    Time.LiteralMonthDayYear({ text: "April 31, 2024", index: 0 }).success,
    false,
  );
  assertEquals(Time.ISODate({ text: "2024-04-31", index: 0 }).success, false);
});

Deno.test("FullDate preserves numeric ambiguity ordering", () => {
  const res = Duckling([Time.parser]).extract(
    "Dates: 12/11/2024 and 12/31/2024.",
  );

  assertEquals(
    res.map((entity) => entity.value.when),
    [
      { type: "date", year: 2024, month: 11, day: 12 },
      { type: "date", year: 2024, month: 12, day: 31 },
    ],
  );
});

Deno.test("numeric dates can follow sentence punctuation", () => {
  const res = Duckling([Time.parser]).extract("Published.12/2022");

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "12/2022");
  assertEquals(res[0].value.when, { type: "date", year: 2022, month: 12 });
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
      if (entity.kind === "time" && entity.value.when.type === "datetime") {
        assertEquals(entity.value.when.iso.includes("Invalid Date"), false);
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
        when: { type: "date", year: 2024, month: 5, day: 18 },
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
  assertEquals(res[0].value.when, {
    type: "date",
    year: 1990,
    month: 3,
    day: 15,
  });
  assertEquals(res[1].text, "2060-01-01");
  assertEquals(res[1].value.when, {
    type: "date",
    year: 2060,
    month: 1,
    day: 1,
  });
});

Deno.test("ISODate: years below 100 retain their calendar year", () => {
  const res = Duckling([Time.parser]).extract("0001-01-01 and 0099-12-31");

  assertEquals(
    res.map((entity) => entity.value.when),
    [
      { type: "date", year: 1, month: 1, day: 1 },
      { type: "date", year: 99, month: 12, day: 31 },
    ],
  );
});

// ── ISODateTime (with offset / without Z) ──────────────────────────

Deno.test("ISODateTime: with positive offset", () => {
  const res = Duckling([Time.parser]).extract(
    "Logged at 2024-05-18T10:30:00+02:00.",
  );

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "2024-05-18T10:30:00+02:00");
  assertEquals(res[0].value.when, {
    type: "datetime",
    iso: "2024-05-18T08:30:00.000Z",
  });
  assertEquals(res[0].value.grain, "second");
});

Deno.test("ISODateTime: with negative offset", () => {
  const res = Duckling([Time.parser]).extract(
    "Event: 2024-05-18T10:30:00-05:00.",
  );

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "2024-05-18T10:30:00-05:00");
  assertEquals(res[0].value.when, {
    type: "datetime",
    iso: "2024-05-18T15:30:00.000Z",
  });
});

Deno.test("ISODateTime: without timezone is UTC", () => {
  const res = Duckling([Time.parser]).extract(
    "Timestamp: 2024-05-18T10:30:00.",
  );

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "2024-05-18T10:30:00");
  assertEquals(res[0].value.when, {
    type: "datetime",
    iso: "2024-05-18T10:30:00.000Z",
  });
  assertEquals(res[0].value.grain, "second");
});

Deno.test("ISODateTime: without seconds", () => {
  const res = Duckling([Time.parser]).extract(
    "Meeting at 2024-05-18T10:30.",
  );

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "2024-05-18T10:30");
  assertEquals(res[0].value.when, {
    type: "datetime",
    iso: "2024-05-18T10:30:00.000Z",
  });
  assertEquals(res[0].value.grain, "second");
});

// ── LiteralMonthDayYear ────────────────────────────────────────────

Deno.test("LiteralMonthDayYear: with comma", () => {
  const res = Duckling([Time.parser]).extract("On July 13, 2016 we met.");

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "July 13, 2016");
  assertEquals(res[0].value.when, {
    type: "date",
    year: 2016,
    month: 7,
    day: 13,
  });
  assertEquals(res[0].value.grain, "day");
});

Deno.test("LiteralMonthDayYear: without comma", () => {
  const res = Duckling([Time.parser]).extract("On March 3 1990 we met.");

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "March 3 1990");
  assertEquals(res[0].value.when, {
    type: "date",
    year: 1990,
    month: 3,
    day: 3,
  });
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
  assertEquals(res[0].value.when, { type: "clock", time: "23:28 (UTC)" });
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
  assertEquals(res[0].value.when, { type: "clock", time: "12:00" });
  assertEquals(res[0].value.grain, "hour");
});

Deno.test("Common: midnight", () => {
  const res = Duckling([Time.parser]).extract("Come back before midnight.");
  assertEquals(res.length, 1);
  assertEquals(res[0].text, "midnight");
  assertEquals(res[0].value.when, { type: "clock", time: "00:00" });
  assertEquals(res[0].value.grain, "hour");
});

Deno.test("CLDR wide month and weekday names preserve Time behavior", () => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  for (const month of months) {
    const result = Time.LiteralMonth({ text: month, index: 0 });
    assertEquals(result.success, true, month);
    if (result.success) assertEquals(result.value, month);
  }

  const weekdays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  for (const weekday of weekdays) {
    const result = Time.DayOfWeek({ text: weekday, index: 0 });
    assertEquals(result.success, true, weekday);
    if (result.success) {
      assertEquals(result.value.value.when, { type: "label", value: weekday });
    }
  }
});

Deno.test("CLDR duration grains preserve singular and plural Time behavior", () => {
  const grains = [
    ["second", "seconds"],
    ["minute", "minutes"],
    ["hour", "hours"],
    ["day", "days"],
    ["week", "weeks"],
    ["month", "months"],
    ["quarter", "quarters"],
    ["year", "years"],
    ["decade", "decades"],
    ["century", "centuries"],
  ];
  for (const names of grains) {
    for (const name of names) {
      const result = Time.UnspecifiedGrainAmount({ text: name, index: 0 });
      assertEquals(result.success, true, name);
      if (result.success) {
        assertEquals(result.ctx.index, name.length, name);
        assertEquals(result.value.value.when, { type: "label", value: name });
        assertEquals(result.value.value.grain, name);
      }
    }
  }
});

Deno.test("CLDR and compatibility Time eras remain accepted", () => {
  for (const era of ["BC", "AD", "BCE", "CE"]) {
    const result = Time.Era({ text: era, index: 0 });
    assertEquals(result.success, true, era);
    if (result.success) assertEquals(result.value, era);
  }
});

Deno.test("Time compatibility aliases remain accepted", () => {
  for (const grain of ["sec", "secs", "m", "min", "mins", "h", "hr", "hrs"]) {
    const result = Time.Grain({ text: grain, index: 0 });
    assertEquals(result.success, true, grain);
    if (result.success) assertEquals(result.value, grain);
  }

  const relative = Duckling([Time.parser]).extract(
    "previous month, following week, and weekend",
  );
  assertEquals(
    relative.map(({ value }) => [value.when, value.grain]),
    [
      [{ type: "relative", offset: -1 }, "month"],
      [{ type: "relative", offset: 1 }, "week"],
      [{ type: "label", value: "weekend" }, "week"],
    ],
  );
});

Deno.test("era-qualified dates preserve structured calendar values", () => {
  const res = Duckling([Time.parser]).extract(
    "Records mention June 2022 BC and 12 June 2022 BC.",
  );

  assertEquals(
    res.map(({ value }) => value),
    [
      {
        era: "BCE",
        grain: "month",
        when: { type: "date", year: 2022, month: 6 },
      },
      {
        era: "BCE",
        grain: "day",
        when: { type: "date", year: 2022, month: 6, day: 12 },
      },
    ],
  );
});
