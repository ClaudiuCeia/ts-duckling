import { assertEquals, assertObjectMatch } from "@std/assert";
import { str } from "@claudiu-ceia/combine";
import { boundary, nonWord, strictBoundary, word } from "../src/common.ts";

Deno.test("word ok", () => {
  const res = word({
    text: `foo`,
    index: 0,
  });

  assertObjectMatch(res, {
    value: "foo",
    success: true,
  });
});

Deno.test("word fail", () => {
  const res = word({
    text: ` ?`,
    index: 0,
  });

  assertObjectMatch(res, {
    success: false,
  });
});

Deno.test("nonWord ok", () => {
  const res = nonWord({
    text: ` ?`,
    index: 0,
  });

  assertObjectMatch(res, {
    success: true,
    value: " ",
  });
});

Deno.test("boundary is zero-width and rejects a word continuation", () => {
  const parser = boundary(str("token"));

  const punctuation = parser({ text: "token+next", index: 0 });
  assertEquals(punctuation.success, true);
  if (punctuation.success) assertEquals(punctuation.ctx.index, 5);

  assertEquals(parser({ text: "tokenNext", index: 0 }).success, false);
  assertEquals(parser({ text: "token", index: 0 }).success, true);
});

Deno.test("strictBoundary rejects right and format-aware left continuations", () => {
  const parser = strictBoundary(
    str("token"),
    /^-/,
    /(?:^|[^\w])dead-$/,
  );

  assertEquals(parser({ text: "token-dead", index: 0 }).success, false);
  assertEquals(parser({ text: "dead-token", index: 5 }).success, false);
  assertEquals(parser({ text: "label-token", index: 6 }).success, true);
  assertEquals(parser({ text: "xtoken", index: 1 }).success, false);
});
