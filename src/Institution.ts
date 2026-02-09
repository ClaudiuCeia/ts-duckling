import {
  any,
  type Context,
  createLanguageThis,
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
  after: Context,
): InstitutionEntity => {
  return ent(value, "institution", before, after);
};

type InstitutionLanguage = {
  Capitalized: () => Parser<string>;
  Educational: () => Parser<string>;
  Administrative: () => Parser<string>;
  EducationalFull: () => Parser<InstitutionEntity>;
  AdministrativeFull: () => Parser<InstitutionEntity>;
  parser: () => Parser<InstitutionEntity>;
};

export const Institution: ReturnType<
  typeof createLanguageThis<InstitutionLanguage>
> = createLanguageThis<InstitutionLanguage>({
  Capitalized: function (): Parser<string> {
    return map(
      seq(regex(/[A-Z]/, "capital-letter"), many(letter())),
      ([capital, rest]) => `${capital}${rest.join("")}`,
    );
  },
  Educational: function (): Parser<string> {
    return any(
      fuzzyCase("university"),
      fuzzyCase("college"),
      fuzzyCase("school"),
    );
  },
  Administrative: function (): Parser<string> {
    return any(fuzzyCase("city hall"), fuzzyCase("town hall"));
  },
  EducationalFull: function (): Parser<InstitutionEntity> {
    return any(
      map(
        seq(
          __(this.Educational),
          optional(__(str("of"))),
          optional(__(str("the"))),
          sepBy1(this.Capitalized, space()),
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
          many1(this.Capitalized),
          this.Educational,
          optional(__(str("of"))),
          optional(__(str("the"))),
          many(this.Capitalized),
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
  AdministrativeFull: function (): Parser<InstitutionEntity> {
    return any(
      map(
        seq(
          __(this.Capitalized),
          either(
            peek(this.Administrative),
            manyTill(__(this.Capitalized), peek(this.Administrative)),
          ),
          this.Administrative,
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
          __(this.Administrative),
          optional(__(str("of"))),
          optional(__(str("the"))),
          sepBy1(this.Capitalized, space()),
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
  parser: function (): Parser<InstitutionEntity> {
    return dot(any(this.EducationalFull, this.AdministrativeFull));
  },
});
