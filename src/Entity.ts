import type { Context } from "@claudiu-ceia/combine";

/**
 * Common shape for extracted entities.
 *
 * `start`/`end` are indices in the original input string, and `text` is the
 * matched substring.
 */
export type Entity<Kind, Value> = {
  value: Value;
  kind: Kind;
  start: number;
  end: number;
  text: string;
};

/**
 * Helper for constructing an `Entity` from a parse span.
 */
export const ent = <Kind, Value>(
  value: Value,
  kind: Kind,
  before: Context,
  after: Context,
): Entity<Kind, Value> => {
  return {
    value,
    kind,
    start: before.index,
    end: after.index,
    text: before.text.substring(before.index, after.index),
  };
};
