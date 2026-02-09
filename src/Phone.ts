import {
  type Context,
  createLanguageThis,
  map,
  regex,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";

/**
 * Phone number entity (strict-ish E.164).
 */
export type PhoneEntity = Entity<
  "phone",
  {
    // Strict-ish E.164 (no spaces/hyphens): +<country><national number>
    phone: string;
  }
>;

/**
 * Helper for constructing a `PhoneEntity`.
 */
export const phone = (
  value: PhoneEntity["value"],
  before: Context,
  after: Context,
): PhoneEntity => {
  return ent(value, "phone", before, after);
};

type PhoneLanguage = {
  Full: () => Parser<PhoneEntity>;
  parser: () => Parser<PhoneEntity>;
};

/**
 * Phone number parser language (E.164: `+` followed by 8-15 digits).
 */
export const Phone: ReturnType<typeof createLanguageThis<PhoneLanguage>> =
  createLanguageThis<PhoneLanguage>({
    Full(): Parser<PhoneEntity> {
      return map(
        regex(/\+\d{8,15}/, "phone"),
        (m, b, a) =>
          phone(
            {
              phone: m,
            },
            b,
            a,
          ),
      );
    },
    parser(): Parser<PhoneEntity> {
      return dot(this.Full);
    },
  });
