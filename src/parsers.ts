import {
  Parser,
  success,
  failure,
} from "https://deno.land/x/combine@v0.0.8/mod.ts";

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
