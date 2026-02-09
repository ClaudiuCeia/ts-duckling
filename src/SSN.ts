import {
  type Context,
  createLanguageThis,
  map,
  seq,
  skip1,
  str,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { guard } from "./guard.ts";
import { IntN, type QuantityEntity } from "./Quantity.ts";

/**
 * US Social Security Number entity (AAA-GG-SSSS).
 */
export type SSNEntity = Entity<
  "ssn",
  {
    ssn: string;
    area: QuantityEntity;
    group: QuantityEntity;
    serial: QuantityEntity;
  }
>;

/**
 * Helper for constructing an `SSNEntity`.
 */
export const ssn = (
  value: SSNEntity["value"],
  before: Context,
  after: Context,
): SSNEntity => {
  return ent(value, "ssn", before, after);
};

type SSNLanguage = {
  Parts: () => Parser<{
    area: QuantityEntity;
    group: QuantityEntity;
    serial: QuantityEntity;
  }>;
  Full: () => Parser<SSNEntity>;
  parser: () => Parser<SSNEntity>;
};

/**
 * SSN parser language with basic SSA constraints to avoid false positives.
 */
export const SSN: ReturnType<typeof createLanguageThis<SSNLanguage>> =
  createLanguageThis<SSNLanguage>({
    Parts(): Parser<{
      area: QuantityEntity;
      group: QuantityEntity;
      serial: QuantityEntity;
    }> {
      return guard(
        map(
          seq(
            IntN(3),
            skip1(str("-")),
            IntN(2),
            skip1(str("-")),
            IntN(4),
          ),
          ([area, , group, , serial]) => ({ area, group, serial }),
        ),
        ({ area, group, serial }) => {
          const a = area.value.amount;
          const g = group.value.amount;
          const s = serial.value.amount;

          // Basic SSA constraints; not exhaustive, but avoids obvious false positives.
          if (
            !Number.isInteger(a) || !Number.isInteger(g) || !Number.isInteger(s)
          ) {
            return false;
          }
          if (a < 1 || a > 899 || a === 666) return false;
          if (g < 1 || g > 99) return false;
          if (s < 1 || s > 9999) return false;

          return true;
        },
        "ssn",
      );
    },
    Full(): Parser<SSNEntity> {
      return map(
        this.Parts,
        ({ area, group, serial }, b, a) =>
          ssn(
            {
              ssn: b.text.substring(b.index, a.index),
              area,
              group,
              serial,
            },
            b,
            a,
          ),
      );
    },
    parser(): Parser<SSNEntity> {
      // Use dot to ensure we end on a token boundary (like other entities).
      return dot(this.Full);
    },
  });
