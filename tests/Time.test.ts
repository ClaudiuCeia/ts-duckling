import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { Duckling } from "../mod.ts";

Deno.test("UnspecifiedGrainAmount", () => {
  const res = Duckling.extract({
    text: `People have been at this for centuries.`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 38,
        kind: "time",
        start: 29,
        text: "centuries",
        value: {
          grain: "centuries",
          when: "centuries",
        },
      },
    ]);
  }
});

Deno.test("DayOfWeek", () => {
  const res = Duckling.extract({
    text: `We could meet them either Monday or Friday.`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 32,
        kind: "time",
        start: 26,
        text: "Monday",
        value: {
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
          grain: "day",
          when: "Friday",
        },
      },
    ]);
  }
});

Deno.test("Common", () => {
  const res = Duckling.extract({
    text: `I'm not sure if the event is tomorrow. Or was it yesterday?`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 37,
        kind: "time",
        start: 29,
        text: "tomorrow",
        value: {
          grain: "day",
          when: "1970-01-01T00:00:00.021Z",
        },
      },
      {
        end: 58,
        kind: "time",
        start: 49,
        text: "yesterday",
        value: {
          grain: "day",
          when: "1970-01-01T00:00:00.019Z",
        },
      },
    ]);
  }
});

Deno.test("GrainQuantity", () => {
  const res = Duckling.extract({
    text: `I'll get to it in 5 days, it only takes about 51615 seconds.`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 26,
        kind: "time",
        start: 18,
        text: "5 days, ",
        value: {
          grain: "days",
          when: "5 days",
        },
      },
      {
        end: 60,
        kind: "time",
        start: 46,
        text: "51615 seconds.",
        value: {
          grain: "seconds",
          when: "51615 seconds",
        },
      },
    ]);
  }
});

Deno.test("Relative", () => {
  const res = Duckling.extract({
    text: `
        We've been through this 4 days ago. Last week I also checked out the work
        that was done over the past year and I'm not sure what we'll do the next
        2 years
    `,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 45,
        kind: "time",
        start: 33,
        text: "4 days ago. ",
        value: {
          grain: "days",
          when: "-4 days",
        },
      },
      {
        end: 55,
        kind: "time",
        start: 45,
        text: "Last week ",
        value: {
          grain: "week",
          when: "-1 week",
        },
      },
      {
        end: 124,
        kind: "time",
        start: 114,
        text: "past year ",
        value: {
          grain: "year",
          when: "-1 year",
        },
      },
      {
        end: 184,
        kind: "time",
        start: 159,
        text: "next\n        2 years\n    ",
        value: {
          grain: "years",
          when: "2 years",
        },
      },
    ]);
  }
});

Deno.test("PartialDateMonthYear numeric", () => {
  const res = Duckling.extract({
    text: `What date is it? 12/2022?`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 25,
        kind: "time",
        start: 17,
        text: "12/2022?",
        value: {
          grain: "day",
          when: "2022-01-11T22:00:00.000Z",
        },
      },
    ]);
  }
});

Deno.test("PartialDateMonthYear literal", () => {
  const res = Duckling.extract({
    text: `What date is it? Sometime in June 2022?`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 39,
        kind: "time",
        start: 29,
        text: "June 2022?",
        value: {
          grain: "day",
          when: "2022-05-31T21:00:00.000Z",
        },
      },
    ]);
  }
});

Deno.test("PartialDateDayMonth literal", () => {
  const res = Duckling.extract({
    text: `What date is it? 12th of June?`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 30,
        kind: "time",
        start: 17,
        text: "12th of June?",
        value: {
          grain: "day",
          when: "2022-06-11T21:00:00.000Z",
        },
      },
    ]);
  }
});

Deno.test("FullDate", () => {
  const res = Duckling.extract({
    text: `What date is it? 1st of June 2023?`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 33,
        kind: "time",
        start: 17,
        text: "1st of June 2023",
        value: {
          grain: "day",
          when: "2023-05-31T21:00:00.000Z",
        },
      },
    ]);
  }
});
