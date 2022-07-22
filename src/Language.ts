import { any, Context, createLanguage, map, Parser } from "combine/mod.ts";
import { EntityLanguage, __, dot } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import languages from "https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-localenames-modern/main/en/languages.json" assert { type: "json" };
import { fuzzyCase } from "./parsers.ts";

export type LanguageEntity = Entity<
  "language",
  {
    name: string;
    code: string;
  }
>;

export const language = (
  value: LanguageEntity["value"],
  before: Context,
  after: Context
): LanguageEntity => {
  return ent(value, "language", before, after);
};

type LanguageEntityLanguage = EntityLanguage<
  {
    Language: Parser<LanguageEntity>;
  },
  LanguageEntity
>;

export const Language = createLanguage<LanguageEntityLanguage>({
  Language: () => {
    const langs = languages.main.en.localeDisplayNames.languages;
    const lang = (code: string, name: string) =>
      map(fuzzyCase(name), (_match, b, a) => language({ code, name }, b, a));

    return any(
      ...Object.entries(langs).map(([code, name]) => lang(code, name))
    );
  },
  parser: (s) => dot(any(s.Language)),
});
