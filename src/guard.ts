import { failure, type Parser } from "@claudiu-ceia/combine";

// Run a semantic check after parsing without consuming input on failure.
export const guard = <T>(
  p: Parser<T>,
  pred: (value: T) => boolean,
  expected = "guard",
): Parser<T> => {
  return (ctx) => {
    const res = p(ctx);
    if (!res.success) return res;
    return pred(res.value) ? res : failure(ctx, expected);
  };
};
