import { assertEquals } from "@std/assert";
import {
  CreditCard,
  Duckling,
  Email,
  IPAddress,
  Phone,
  SSN,
  URL,
  UUID,
} from "../mod.ts";

// ---------------------------------------------------------------------------
// Basic behaviour
// ---------------------------------------------------------------------------

Deno.test("redact: returns input unchanged when no entities found", () => {
  const result = Duckling().redact("Hello world, no entities here.");
  assertEquals(result, "Hello world, no entities here.");
});

Deno.test("redact: masks all entities by default (no opts)", () => {
  const input = "My SSN is 123-45-6789 and email is a@b.com";
  const result = Duckling().redact(input);
  // SSN and email spans should be masked
  assertEquals(result.includes("123-45-6789"), false);
  assertEquals(result.includes("a@b.com"), false);
  // Non-entity text should remain
  assertEquals(result.startsWith("My SSN is "), true);
});

Deno.test("redact: default mask character is █", () => {
  const result = Duckling([SSN.parser]).redact("SSN: 123-45-6789");
  assertEquals(result, "SSN: ███████████");
});

// ---------------------------------------------------------------------------
// Custom mask
// ---------------------------------------------------------------------------

Deno.test("redact: custom mask character", () => {
  const result = Duckling([SSN.parser]).redact("SSN: 123-45-6789", {
    mask: "X",
  });
  assertEquals(result, "SSN: XXXXXXXXXXX");
});

Deno.test("redact: mask with asterisk", () => {
  const result = Duckling([Email.parser]).redact("Email: a@b.com", {
    mask: "*",
  });
  assertEquals(result, "Email: *******");
});

// ---------------------------------------------------------------------------
// Filtering by kind
// ---------------------------------------------------------------------------

Deno.test("redact: filters by kinds — only SSN", () => {
  const input = "SSN 123-45-6789, email a@b.com";
  const result = Duckling().redact(input, { kinds: ["ssn"] });
  // SSN should be masked
  assertEquals(result.includes("123-45-6789"), false);
  // Email should remain
  assertEquals(result.includes("a@b.com"), true);
});

Deno.test("redact: filters by kinds — only email", () => {
  const input = "SSN 123-45-6789, email a@b.com";
  const result = Duckling().redact(input, { kinds: ["email"] });
  // SSN should remain
  assertEquals(result.includes("123-45-6789"), true);
  // Email should be masked
  assertEquals(result.includes("a@b.com"), false);
});

Deno.test("redact: filters by multiple kinds", () => {
  const input = "SSN 123-45-6789, email a@b.com, phone +14155552671";
  const result = Duckling().redact(input, { kinds: ["ssn", "email"] });
  assertEquals(result.includes("123-45-6789"), false);
  assertEquals(result.includes("a@b.com"), false);
  // Phone should remain
  assertEquals(result.includes("+14155552671"), true);
});

Deno.test("redact: empty kinds array redacts nothing", () => {
  const input = "SSN 123-45-6789";
  const result = Duckling().redact(input, { kinds: [] });
  assertEquals(result, input);
});

// ---------------------------------------------------------------------------
// Per-entity-type redaction
// ---------------------------------------------------------------------------

Deno.test("redact: masks credit card numbers", () => {
  const result = Duckling([CreditCard.parser]).redact(
    "CC: 4242 4242 4242 4242",
  );
  assertEquals(result.includes("4242"), false);
});

Deno.test("redact: masks UUIDs", () => {
  const result = Duckling([UUID.parser]).redact(
    "ID: 550e8400-e29b-41d4-a716-446655440000",
  );
  assertEquals(result.includes("550e8400"), false);
});

Deno.test("redact: masks IP addresses", () => {
  const result = Duckling([IPAddress.parser]).redact("Server at 192.168.0.1");
  assertEquals(result.includes("192.168.0.1"), false);
  assertEquals(result.startsWith("Server at "), true);
});

Deno.test("redact: masks URLs", () => {
  const result = Duckling([URL.parser]).redact(
    "Visit https://example.com/path?q=1",
  );
  assertEquals(result.includes("https://example.com"), false);
  assertEquals(result.startsWith("Visit "), true);
});

Deno.test("redact: masks phone numbers", () => {
  const result = Duckling([Phone.parser]).redact("Call +14155552671 now");
  assertEquals(result.includes("+14155552671"), false);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

Deno.test("redact: empty input", () => {
  const result = Duckling().redact("");
  assertEquals(result, "");
});

Deno.test("redact: multiple entities of same type", () => {
  const input = "SSN 123-45-6789 and 234-56-7890";
  const result = Duckling([SSN.parser]).redact(input);
  assertEquals(result.includes("123-45-6789"), false);
  assertEquals(result.includes("234-56-7890"), false);
  assertEquals(result.includes(" and "), true);
});

Deno.test("redact: preserves surrounding whitespace and punctuation", () => {
  const result = Duckling([SSN.parser]).redact("(SSN: 123-45-6789).");
  // Should keep parens, colon, period
  assertEquals(result.startsWith("(SSN: "), true);
  assertEquals(result.endsWith(")."), true);
});

Deno.test("redact: kinds + mask combined", () => {
  const input = "SSN 123-45-6789, email a@b.com";
  const result = Duckling().redact(input, { mask: "#", kinds: ["ssn"] });
  assertEquals(result.includes("###########"), true);
  assertEquals(result.includes("a@b.com"), true);
});

Deno.test("redact: with custom parser subset", () => {
  const d = Duckling([Email.parser, SSN.parser]);
  const input = "a@b.com 123-45-6789 https://example.com";
  const result = d.redact(input);
  // Email and SSN are in parser set, so masked
  assertEquals(result.includes("a@b.com"), false);
  assertEquals(result.includes("123-45-6789"), false);
  // URL is NOT in parser set, so it stays
  assertEquals(result.includes("https://example.com"), true);
});

Deno.test("redact: result length matches input length with single-char mask", () => {
  const input = "My SSN is 123-45-6789.";
  const result = Duckling([SSN.parser]).redact(input);
  assertEquals(result.length, input.length);
});
