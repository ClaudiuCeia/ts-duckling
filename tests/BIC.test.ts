import { assertEquals } from "@std/assert";
import { BIC } from "../src/BIC.ts";
import { Duckling } from "../mod.ts";

Deno.test("BIC 8-char (head office)", () => {
  const res = Duckling([BIC.parser]).extract("Send via DEUTDEFF please");
  assertEquals(res.length, 1);
  assertEquals(res[0].kind, "bic");
  assertEquals(res[0].text, "DEUTDEFF");
  assertEquals(res[0].value, {
    bic: "DEUTDEFF",
    bank: "DEUT",
    country: "DE",
    location: "FF",
    branch: null,
  });
});

Deno.test("BIC 11-char (with branch)", () => {
  const res = Duckling([BIC.parser]).extract("Wire to BOFAUS3NXXX now");
  assertEquals(res.length, 1);
  assertEquals(res[0].kind, "bic");
  assertEquals(res[0].text, "BOFAUS3NXXX");
  assertEquals(res[0].value, {
    bic: "BOFAUS3NXXX",
    bank: "BOFA",
    country: "US",
    location: "3N",
    branch: "XXX",
  });
});

Deno.test("BIC HSBC UK", () => {
  const res = Duckling([BIC.parser]).extract("Use HBUKGB4B for HSBC");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.bank, "HBUK");
  assertEquals(res[0].value.country, "GB");
});

Deno.test("BIC with numeric location", () => {
  const res = Duckling([BIC.parser]).extract("Code: BNPAFRPP ok");
  assertEquals(res.length, 1);
  assertEquals(res[0].value, {
    bic: "BNPAFRPP",
    bank: "BNPA",
    country: "FR",
    location: "PP",
    branch: null,
  });
});

Deno.test("BIC invalid country rejected", () => {
  // ZZ is not a valid ISO 3166-1 country code
  const res = Duckling([BIC.parser]).extract("code AAAAZZBB ok");
  assertEquals(res.length, 0);
});

Deno.test("BIC too short rejected (7 chars)", () => {
  const res = Duckling([BIC.parser]).extract("code DEUTDEF ok");
  assertEquals(res.length, 0);
});

Deno.test("BIC 9 chars rejected (not 8 or 11)", () => {
  // 9 chars is neither a valid 8-char nor 11-char BIC
  const res = Duckling([BIC.parser]).extract("code DEUTDEFFA ok");
  // The parser will match DEUTDEFF (8) and leave the A, which is fine
  // because dot() requires a non-word boundary after. 'A' is a word char,
  // so this should NOT match.
  assertEquals(res.length, 0);
});

Deno.test("BIC in default parsers", () => {
  const res = Duckling().extract("Wire to DEUTDEFF please");
  assertEquals(
    res.some((e) => e.kind === "bic"),
    true,
  );
});

Deno.test("BIC with branch digits", () => {
  const res = Duckling([BIC.parser]).extract("SWIFT: COBADEFF100 here");
  assertEquals(res.length, 1);
  assertEquals(res[0].value, {
    bic: "COBADEFF100",
    bank: "COBA",
    country: "DE",
    location: "FF",
    branch: "100",
  });
});
