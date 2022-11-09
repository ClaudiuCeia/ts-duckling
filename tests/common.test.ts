import { assertObjectMatch } from "https://deno.land/std@0.149.0/testing/asserts.ts";
import { nonWord, word } from "../src/common.ts";

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
