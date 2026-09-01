import { test } from "bun:test";
import { assertObjectMatch } from "./assert.ts";
import { nonWord, word } from "../src/common.ts";

test("word ok", () => {
  const res = word({
    text: `foo`,
    index: 0,
  });

  assertObjectMatch(res, {
    value: "foo",
    success: true,
  });
});

test("word fail", () => {
  const res = word({
    text: ` ?`,
    index: 0,
  });

  assertObjectMatch(res, {
    success: false,
  });
});

test("nonWord ok", () => {
  const res = nonWord({
    text: ` ?`,
    index: 0,
  });

  assertObjectMatch(res, {
    success: true,
    value: " ",
  });
});
