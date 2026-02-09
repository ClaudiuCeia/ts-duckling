import {
  type Context,
  createLanguage,
  map,
  regex,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";

/**
 * UUID entity (canonical 8-4-4-4-12 form).
 */
export type UUIDEntity = Entity<
  "uuid",
  {
    uuid: string;
  }
>;

/**
 * Helper for constructing a `UUIDEntity`.
 */
export const uuid = (
  value: UUIDEntity["value"],
  before: Context,
  after: Context,
): UUIDEntity => {
  return ent(value, "uuid", before, after);
};

type UUIDLanguage = {
  Full: Parser<UUIDEntity>;
  parser: Parser<UUIDEntity>;
};

/**
 * UUID parser language.
 */
export const UUID: UUIDLanguage = createLanguage<UUIDLanguage>({
  Full: (): Parser<UUIDEntity> => {
    return map(
      regex(
        /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
        "uuid",
      ),
      (m, b, a) =>
        uuid(
          {
            uuid: m.toLowerCase(),
          },
          b,
          a,
        ),
    );
  },
  parser: (s): Parser<UUIDEntity> => {
    return dot(s.Full);
  },
});
