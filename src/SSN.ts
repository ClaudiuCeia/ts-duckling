import { Context, createLanguageThis, map, regex } from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, Entity } from "./Entity.ts";

export type SSNEntity = Entity<
  "ssn",
  {
    ssn: string;
  }
>;

export const ssn = (
  value: SSNEntity["value"],
  before: Context,
  after: Context,
): SSNEntity => {
  return ent(value, "ssn", before, after);
};

export const SSN = createLanguageThis({
  Full(): Parser<SSNEntity> {
    return map(
      // Basic SSA constraints; not exhaustive, but avoids obvious false positives.
      regex(
        /(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}/,
        "ssn",
      ),
      (m, b, a) =>
        ssn(
          {
            ssn: m,
          },
          b,
          a,
        ),
    );
  },
  parser(): Parser<SSNEntity> {
    return dot(this.Full);
  },
});
