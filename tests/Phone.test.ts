import { assertEquals } from "@std/assert";
import { Duckling, Phone } from "../mod.ts";

Deno.test("Phone E.164 strict", () => {
  const res = Duckling([Phone.parser]).extract("Call +14155552671 now");

  assertEquals(res, [
    {
      start: 5,
      end: 17,
      kind: "phone",
      text: "+14155552671",
      value: {
        phone: "+14155552671",
        normalized: "+14155552671",
      },
    },
  ]);
});

Deno.test("Phone E.164 international numbers", () => {
  const inputs = [
    { text: "+442071234567", digits: 13 }, // UK
    { text: "+61412345678", digits: 12 }, // AU
    { text: "+8613800138000", digits: 14 }, // CN
    { text: "+491721234567", digits: 13 }, // DE
  ];
  for (const { text } of inputs) {
    const res = Duckling([Phone.parser]).extract(text);
    assertEquals(res.length, 1, `Expected match for ${text}`);
    assertEquals(res[0].value.normalized, text);
  }
});

Deno.test("Phone US formatted (NNN) NNN-NNNN", () => {
  const res = Duckling([Phone.parser]).extract("Call (415) 555-2671 today");
  assertEquals(res.length, 1);
  assertEquals(res[0].text, "(415) 555-2671");
  assertEquals(res[0].value.normalized, "4155552671");
});

Deno.test("Phone US formatted NNN-NNN-NNNN", () => {
  const res = Duckling([Phone.parser]).extract("Call 415-555-2671 today");
  assertEquals(res.length, 1);
  assertEquals(res[0].text, "415-555-2671");
  assertEquals(res[0].value.normalized, "4155552671");
});

Deno.test("Phone US formatted NNN.NNN.NNNN", () => {
  const res = Duckling([Phone.parser]).extract("Call 415.555.2671 today");
  assertEquals(res.length, 1);
  assertEquals(res[0].text, "415.555.2671");
  assertEquals(res[0].value.normalized, "4155552671");
});

Deno.test("Phone intl with separators +1 (415) 555-2671", () => {
  const res = Duckling([Phone.parser]).extract("Dial +1 (415) 555-2671 now");
  assertEquals(res.length, 1);
  assertEquals(res[0].text, "+1 (415) 555-2671");
  assertEquals(res[0].value.normalized, "+14155552671");
});

Deno.test("Phone intl with dashes +1-415-555-2671", () => {
  const res = Duckling([Phone.parser]).extract("Dial +1-415-555-2671 now");
  assertEquals(res.length, 1);
  assertEquals(res[0].text, "+1-415-555-2671");
  assertEquals(res[0].value.normalized, "+14155552671");
});

Deno.test("Phone intl UK spaced +44 20 7123 4567", () => {
  const res = Duckling([Phone.parser]).extract("Ring +44 20 7123 4567 please");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.normalized, "+442071234567");
});

Deno.test("Phone preferred over quantity in Duckling()", () => {
  const res = Duckling().extract("Call +14155552671 now");

  assertEquals(
    res.some((e) => e.kind === "phone" && e.text === "+14155552671"),
    true,
  );
});
