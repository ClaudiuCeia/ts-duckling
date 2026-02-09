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
