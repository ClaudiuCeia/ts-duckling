import {
  any,
  Context,
  createLanguage,
  map,
  Parser,
  seq,
  str,
  letter,
  many,
  regex,
  optional,
  many1,
  manyTill,
  peek,
} from "https://deno.land/x/combine@v0.0.8/mod.ts";
import { EntityLanguage, __, dot } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import { fuzzyCase } from "./parsers.ts";

export type InstitutionEntity = Entity<
  "institution",
  {
    name: string;
    type: "university" | "college" | "school" | "city hall" | "town hall";
  }
>;

export const institution = (
  value: InstitutionEntity["value"],
  before: Context,
  after: Context
): InstitutionEntity => {
  return ent(value, "institution", before, after);
};

type InstitutionEntityLanguage = EntityLanguage<
  {
    Educational: Parser<string>;
    Administrative: Parser<string>;
    Capitalized: Parser<string>;
    EducationalFull: Parser<InstitutionEntity>;
    AdministrativeFull: Parser<InstitutionEntity>;
  },
  InstitutionEntity
>;

export const Institution = createLanguage<InstitutionEntityLanguage>({
  Capitalized: () =>
    map(
      seq(regex(/[A-Z]/, "capital-letter"), __(many(letter()))),
      ([capital, rest]) => `${capital}${rest.join("")}`
    ),
  Educational: () =>
    __(any(fuzzyCase("university"), fuzzyCase("college"), fuzzyCase("school"))),
  Administrative: () => __(any(fuzzyCase("city hall"), fuzzyCase("town hall"))),
  EducationalFull: (s) =>
    any(
      map(
        seq(
          s.Educational,
          optional(__(str("of"))),
          optional(__(str("the"))),
          many1(s.Capitalized)
        ),
        ([educational], b, a) =>
          institution(
            {
              name: b.text.substring(b.index, a.index),
              type: educational.toLowerCase() as InstitutionEntity["value"]["type"],
            },
            b,
            a
          )
      ),
      map(
        seq(
          many1(s.Capitalized),
          s.Educational,
          optional(__(str("of"))),
          optional(__(str("the"))),
          many(s.Capitalized)
        ),
        ([, educational], b, a) =>
          institution(
            {
              name: b.text.substring(b.index, a.index),
              type: educational.toLowerCase() as InstitutionEntity["value"]["type"],
            },
            b,
            a
          )
      )
    ),
  AdministrativeFull: (s) =>
    any(
      map(
        seq(
          s.Capitalized,
          manyTill(s.Capitalized, peek(s.Administrative)),
          s.Administrative
        ),
        ([, , administrative], b, a) =>
          institution(
            {
              name: b.text.substring(b.index, a.index),
              type: administrative.toLowerCase() as InstitutionEntity["value"]["type"],
            },
            b,
            a
          )
      ),
      map(
        seq(
          s.Administrative,
          optional(__(str("of"))),
          optional(__(str("the"))),
          many1(s.Capitalized)
        ),
        ([administrative], b, a) =>
          institution(
            {
              name: b.text.substring(b.index, a.index),
              type: administrative.toLowerCase() as InstitutionEntity["value"]["type"],
            },
            b,
            a
          )
      )
    ),
  parser: (s) => dot(any(s.EducationalFull, s.AdministrativeFull)),
});
