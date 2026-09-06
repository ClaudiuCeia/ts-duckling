import { test } from "bun:test";
import { assertEquals, assertStrictEquals } from "./assert.ts";
import { longestLiteral } from "../src/parsers.ts";

test("longestLiteral matches the longest terminal prefix", () => {
  const result = longestLiteral(["com", "community"])({
    text: "community-led",
    index: 0,
  });

  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.value, "community");
    assertEquals(result.ctx.index, 9);
  }
});

test("longestLiteral returns configured casing for insensitive matches", () => {
  const result = longestLiteral(["French"], { caseInsensitive: true })({
    text: "fReNcH",
    index: 0,
  });

  assertEquals(result.success, true);
  if (result.success) assertEquals(result.value, "French");
});

test("longestLiteral matches Unicode literals", () => {
  const result = longestLiteral(["Cura", "Curaçao"], {
    caseInsensitive: true,
  })({ text: "CURAÇAO", index: 0 });

  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.value, "Curaçao");
    assertEquals(result.ctx.index, 7);
  }
});

test("longestLiteral failure preserves the input context", () => {
  const context = { text: "xxunknown", index: 2 };
  const result = longestLiteral(["known"])(context);

  assertEquals(result.success, false);
  assertStrictEquals(result.ctx, context);
});
