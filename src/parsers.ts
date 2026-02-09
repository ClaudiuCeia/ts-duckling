import { failure, type Parser, success } from "@claudiu-ceia/combine";

// Match string regardless of casing
export const fuzzyCase = (match: string): Parser<string> => {
  return (ctx) => {
    const endIdx = ctx.index + match.length;
    if (
      ctx.text.substring(ctx.index, endIdx).toLowerCase() ===
        match.toLowerCase()
    ) {
      return success({ ...ctx, index: endIdx }, match);
    } else {
      return failure(ctx, match);
    }
  };
};
