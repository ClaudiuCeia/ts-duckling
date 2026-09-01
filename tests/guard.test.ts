import { test } from "bun:test";
import { assertEquals } from "./assert.ts";
import { map, str } from "@claudiu-ceia/combine";
import { guard, safe } from "../src/guard.ts";

test("guard: passes when predicate returns true", () => {
  const p = guard(str("abc"), (v) => v === "abc", "expected abc");
  const res = p({ text: "abc", index: 0 });
  assertEquals(res.success, true);
  if (res.success) assertEquals(res.value, "abc");
});

test("guard: fails when predicate returns false", () => {
  const p = guard(str("abc"), () => false, "rejected");
  const res = p({ text: "abc", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected, "rejected");
});

test("guard: propagates inner parser failure", () => {
  const p = guard(str("abc"), () => true, "guard");
  const res = p({ text: "xyz", index: 0 });
  assertEquals(res.success, false);
});

test("guard: does not consume input on predicate failure", () => {
  const p = guard(str("abc"), () => false, "rejected");
  const res = p({ text: "abcdef", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.ctx.index, 0);
});

test("safe: passes through successful parse", () => {
  const p = safe(str("ok"), "safe");
  const res = p({ text: "ok", index: 0 });
  assertEquals(res.success, true);
  if (res.success) assertEquals(res.value, "ok");
});

test("safe: passes through normal parse failure", () => {
  const p = safe(str("ok"), "safe");
  const res = p({ text: "no", index: 0 });
  assertEquals(res.success, false);
});

test("safe: catches thrown exception and returns failure", () => {
  const throwing = map(str("boom"), () => {
    throw new Error("kaboom");
  });
  const p = safe(throwing, "caught");
  const res = p({ text: "boom", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected, "caught");
});

test("safe: does not consume input when exception is caught", () => {
  const throwing = map(str("boom"), () => {
    throw new Error("kaboom");
  });
  const p = safe(throwing, "caught");
  const res = p({ text: "boomstuff", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.ctx.index, 0);
});

test("safe: catches invalid Date toISOString", () => {
  const dateParser = map(str("bad-date"), () => {
    return new Date("not-a-date").toISOString();
  });
  const p = safe(dateParser, "valid date");
  const res = p({ text: "bad-date", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected, "valid date");
});
