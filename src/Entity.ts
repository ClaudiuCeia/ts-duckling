import { Context } from "/combine";

export type Entity<Kind, Value> = {
  value: Value;
  kind: Kind;
  start: number;
  end: number;
  text: string;
}

export const ent = <Kind, Value>(
  value: Value,
  kind: Kind,
  before: Context,
  after: Context
): Entity<Kind, Value> => {
  return {
    value,
    kind,
    start: before.index,
    end: after.index,
    text: before.text.substring(before.index, after.index),
  };
};
