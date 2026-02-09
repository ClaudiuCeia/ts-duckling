import {
  any,
  type Context,
  createLanguage,
  either,
  letter,
  many,
  many1,
  manyTill,
  map,
  optional,
  peek,
  regex,
  sepBy1,
  seq,
  space,
  str,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { __, dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { fuzzyCase } from "./parsers.ts";

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

type InstitutionLanguage = {
  Capitalized: Parser<string>;
  Educational: Parser<string>;
  Administrative: Parser<string>;
  EducationalFull: Parser<InstitutionEntity>;
  AdministrativeFull: Parser<InstitutionEntity>;
  parser: Parser<InstitutionEntity>;
};

/**
 * Institution parser language.
 */
export const Institution: InstitutionLanguage = createLanguage<
  InstitutionLanguage
>({
  Capitalized: (): Parser<string> => {
    return map(
      seq(regex(/[A-Z]/, "capital-letter"), many(letter())),
      ([capital, rest]) => `${capital}${rest.join("")}`,
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
    return any(
      map(
        seq(
          __(s.Educational),
          optional(__(str("of"))),
          optional(__(str("the"))),
          sepBy1(s.Capitalized, space()),
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
        seq(
          many1(s.Capitalized),
          s.Educational,
          optional(__(str("of"))),
          optional(__(str("the"))),
          many(s.Capitalized),
        ),
        ([, educational], b, a) =>
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
        seq(
          __(s.Capitalized),
          either(
            peek(s.Administrative),
            manyTill(__(s.Capitalized), peek(s.Administrative)),
          ),
          s.Administrative,
        ),
        ([, , administrative], b, a) =>
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
          sepBy1(s.Capitalized, space()),
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
