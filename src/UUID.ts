import {
  type Context,
  createLanguageThis,
  map,
  regex,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";

export type UUIDEntity = Entity<
  "uuid",
  {
    uuid: string;
  }
>;

export const uuid = (
  value: UUIDEntity["value"],
  before: Context,
  after: Context,
): UUIDEntity => {
  return ent(value, "uuid", before, after);
};

type UUIDLanguage = {
  Full: () => Parser<UUIDEntity>;
  parser: () => Parser<UUIDEntity>;
};

export const UUID: ReturnType<typeof createLanguageThis<UUIDLanguage>> =
  createLanguageThis<UUIDLanguage>({
    Full(): Parser<UUIDEntity> {
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
    parser(): Parser<UUIDEntity> {
      return dot(this.Full);
    },
  });
