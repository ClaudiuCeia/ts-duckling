import { assertEquals } from "@std/assert";
import { Duckling, IBAN } from "../mod.ts";

Deno.test("IBAN GB compact", () => {
  const res = Duckling([IBAN.parser]).extract(
    "account GB29NWBK60161331926819 ok",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].kind, "iban");
  assertEquals(res[0].value.iban, "GB29NWBK60161331926819");
  assertEquals(res[0].value.country, "GB");
});

Deno.test("IBAN GB grouped with spaces", () => {
  const res = Duckling([IBAN.parser]).extract(
    "pay to GB29 NWBK 6016 1331 9268 19 please",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.iban, "GB29NWBK60161331926819");
  assertEquals(res[0].value.country, "GB");
});

Deno.test("IBAN DE", () => {
  const res = Duckling([IBAN.parser]).extract(
    "IBAN: DE89370400440532013000 here",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.iban, "DE89370400440532013000");
  assertEquals(res[0].value.country, "DE");
});

Deno.test("IBAN FR", () => {
  const res = Duckling([IBAN.parser]).extract(
    "send to FR7630006000011234567890189 now",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.iban, "FR7630006000011234567890189");
  assertEquals(res[0].value.country, "FR");
});

Deno.test("IBAN invalid checksum rejected", () => {
  // GB00 would be an invalid check digit
  const res = Duckling([IBAN.parser]).extract("bad GB00NWBK60161331926819 ok");
  assertEquals(res.length, 0);
});

Deno.test("IBAN wrong length rejected", () => {
  // GB needs 22 chars, this is too short
  const res = Duckling([IBAN.parser]).extract("bad GB29NWBK601613 ok");
  assertEquals(res.length, 0);
});

Deno.test("IBAN in Duckling default parsers", () => {
  const res = Duckling().extract("Wire to DE89370400440532013000 today");
  assertEquals(
    res.some((e) => e.kind === "iban"),
    true,
  );
});
