import { Context, createLanguageThis, map, regex } from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import { guard } from "./guard.ts";

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

const isValidSSN = (s: string): boolean => {
  const m = /^(\d{3})-(\d{2})-(\d{4})$/.exec(s);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);

  // Basic SSA constraints; not exhaustive, but avoids obvious false positives.
  if (a === 0 || m[1] === "000") return false;
  if (m[2] === "00") return false;
  if (m[3] === "0000") return false;
  if (a === 666) return false;
  if (a >= 900) return false;
  if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(c)) {
    return false;
  }
  return true;
};

export const SSN = createLanguageThis({
  Full(): Parser<SSNEntity> {
    return map(
      guard(regex(/\d{3}-\d{2}-\d{4}/, "ssn"), isValidSSN, "ssn"),
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
