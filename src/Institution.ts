import {
  any,
  type Context,
  defineLanguage,
  map,
  optional,
  regex,
  repeat,
  seq,
  skip1,
  space,
  str,
} from "@claudiu-ceia/combine";
import type {
  Language as DefinedLanguage,
  Parser,
} from "@claudiu-ceia/combine";
import { __, dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { fuzzyCase } from "./parsers.ts";

const MAX_NAME_WORDS = 8;
const whitespace = skip1(space());

const phraseOfLength = (
  word: Parser<string>,
  length: number,
): Parser<string> =>
  map(
    seq(
      word,
      repeat(
        length - 1,
        map(seq(whitespace, word), ([, next]) => next),
      ),
    ),
    ([first, rest]) => [first, ...rest].join(" "),
  );

const boundedPhrase = (word: Parser<string>): Parser<string> =>
  any(
    ...Array.from(
      { length: MAX_NAME_WORDS },
      (_, index) => phraseOfLength(word, MAX_NAME_WORDS - index),
    ),
  );

const phraseBefore = <T>(
  word: Parser<string>,
  anchor: Parser<T>,
): Parser<[string, T]> =>
  any(
    ...Array.from(
      { length: MAX_NAME_WORDS },
      (_, index) =>
        map(
          seq(
            phraseOfLength(word, MAX_NAME_WORDS - index),
            whitespace,
            anchor,
          ),
          ([name, , value]) => [name, value] as [string, T],
        ),
    ),
  );

/**
 * Institution entity (schools, universities, town/city halls).
 */
export type InstitutionEntity = Entity<
  "institution",
  {
    name: string;
    type: "university" | "college" | "school" | "city hall" | "town hall";
  }
>;

/**
 * Helper for constructing an `InstitutionEntity`.
 */
export const institution = (
  value: InstitutionEntity["value"],
  before: Context,
  after: Context,
): InstitutionEntity => {
  return ent(value, "institution", before, after);
};

type InstitutionOutputs = {
  Capitalized: string;
  Educational: string;
  Administrative: string;
  EducationalFull: InstitutionEntity;
  AdministrativeFull: InstitutionEntity;
  parser: InstitutionEntity;
};

/**
 * Institution parser language.
 */
export const Institution: DefinedLanguage<InstitutionOutputs> = defineLanguage<
  InstitutionOutputs
>({
  Capitalized: (): Parser<string> => {
    return regex(
      /\p{Lu}[\p{L}\p{M}\d]*(?:[&'’.-][\p{L}\p{M}\d]+)*\.?/u,
      "capitalized institution word",
    );
  },
  Educational: (): Parser<string> => {
    return any(
      fuzzyCase("university"),
      fuzzyCase("college"),
      fuzzyCase("school"),
    );
  },
  Administrative: (): Parser<string> => {
    return any(fuzzyCase("city hall"), fuzzyCase("town hall"));
  },
  EducationalFull: (s): Parser<InstitutionEntity> => {
    const trailingName = optional(
      any(
        map(
          seq(
            whitespace,
            __(str("of")),
            optional(__(str("the"))),
            boundedPhrase(s.Capitalized),
          ),
          ([, , , name]) => name,
        ),
        map(seq(whitespace, boundedPhrase(s.Capitalized)), ([, name]) => name),
      ),
    );

    return any(
      map(
        seq(
          __(s.Educational),
          optional(__(str("of"))),
          optional(__(str("the"))),
          boundedPhrase(s.Capitalized),
        ),
        ([educational], b, a) =>
          institution(
            {
              name: b.text.substring(b.index, a.index),
              type: educational
                .toLowerCase() as InstitutionEntity["value"]["type"],
            },
            b,
            a,
          ),
      ),
      map(
        seq(phraseBefore(s.Capitalized, s.Educational), trailingName),
        ([[, educational]], b, a) =>
          institution(
            {
              name: b.text.substring(b.index, a.index),
              type: educational
                .toLowerCase() as InstitutionEntity["value"]["type"],
            },
            b,
            a,
          ),
      ),
    );
  },
  AdministrativeFull: (s): Parser<InstitutionEntity> => {
    return any(
      map(
        phraseBefore(s.Capitalized, s.Administrative),
        ([, administrative], b, a) =>
          institution(
            {
              name: b.text.substring(b.index, a.index),
              type: administrative
                .toLowerCase() as InstitutionEntity["value"]["type"],
            },
            b,
            a,
          ),
      ),
      map(
        seq(
          __(s.Administrative),
          optional(__(str("of"))),
          optional(__(str("the"))),
          boundedPhrase(s.Capitalized),
        ),
        ([administrative], b, a) =>
          institution(
            {
              name: b.text.substring(b.index, a.index),
              type: administrative
                .toLowerCase() as InstitutionEntity["value"]["type"],
            },
            b,
            a,
          ),
      ),
    );
  },
  parser: (s): Parser<InstitutionEntity> => {
    return dot(any(s.EducationalFull, s.AdministrativeFull));
  },
});
