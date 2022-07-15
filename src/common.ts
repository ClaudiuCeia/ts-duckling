import {
  eof,
  map,
  Parser,
  peek,
  regex,
  seqNonNull,
  skip1,
  space,
} from "https://deno.land/x/combine@v0.0.5/mod.ts";
import { any } from "../../combine/src/combinators.ts";

export const dot = <T>(p: Parser<T>): Parser<T> =>
  map(seqNonNull(p, any(skip1(separator), skip1(space()), peek(eof()))), ([m]) => m);

export const __ = <T>(p: Parser<T>): Parser<T> =>
  map(seqNonNull(p, skip1(space())), ([m]) => m);

export const separator = __(regex(/\W/, "non-word"));
export const word = __(regex(/\w+/, "word"));
