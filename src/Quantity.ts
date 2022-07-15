import {
  any,
  createLanguage,
  number,
  seq,
  signed,
  str,
  map,
  Context,
} from "https://deno.land/x/combine@v0.0.5/mod.ts";
import { __ } from "./common.ts";
import { ent, Entity } from "./Entity.ts";

export type QuantityEntity = Entity<
  "quantity",
  {
    amount: number;
  }
>;

const quantity = (
  value: {
    amount: number;
  },
  before: Context,
  after: Context
): QuantityEntity => {
  return ent(
    {
      ...value,
    },
    "quantity",
    before,
    after
  );
};

export const Quantity = createLanguage({
  Under: () => __(any(str("under"), str("less than"), str("lower than"))),
  parser: (s) =>
    map(
      __(
        any(
          map(seq(s.Under, number()), ([, n]) => -n),
          signed(),
          number()
        )
      ),
      (n, b, a) => quantity({ amount: n }, b, a)
    ),
});
