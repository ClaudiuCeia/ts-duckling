import { any, Context, createLanguageThis, map } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import languages from "@data/languages-en" with { type: "json" };
import { fuzzyCase } from "./parsers.ts";

type CldrLanguages = {
  main: {
    en: {
      localeDisplayNames: {
        languages: Record<string, string>;
      };
    };
  };
};

const cldr = languages as CldrLanguages;

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
  after: Context,
): LanguageEntity => {
  return ent(value, "language", before, after);
};

export const Language = createLanguageThis({
  Language() {
    const langs = cldr.main.en.localeDisplayNames.languages;
    const lang = (code: string, name: string) =>
      map(fuzzyCase(name), (_match, b, a) => language({ code, name }, b, a));

    return any(
      ...Object.entries(langs).map(([code, name]) => lang(code, name)),
    );
  },
  parser() {
    return dot(any(this.Language));
  },
});
