import {
  eof,
  map,
  Parser,
  regex,
  seqNonNull,
  skip1,
  space,
} from "combine/mod.ts";
import { any } from "../../combine/src/combinators.ts";

export const dot = <T>(p: Parser<T>): Parser<T> =>
  map(
    seqNonNull(p, any(skip1(nonWord), skip1(space()), skip1(eof()))),
    ([m]) => m
  );

export const __ = <T>(p: Parser<T>): Parser<T> =>
  map(seqNonNull(p, skip1(space())), ([m]) => m);

export const nonWord = regex(/\W-?/, "non-word");
export const separator = __(nonWord);
export const word = regex(/\w+/, "word");

export type EntityLanguage<T, E> = T & { parser: Parser<E> };
