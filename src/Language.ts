import { any, type Context, createLanguage, map } from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
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

/**
 * Language name entity (CLDR-backed).
 */
export type LanguageEntity = Entity<
  "language",
  {
    name: string;
    code: string;
  }
>;

/**
 * Helper for constructing a `LanguageEntity`.
 */
export const language = (
  value: LanguageEntity["value"],
  before: Context,
  after: Context,
): LanguageEntity => {
  return ent(value, "language", before, after);
};

type LanguageLanguage = {
  Language: Parser<LanguageEntity>;
  parser: Parser<LanguageEntity>;
};

/**
 * Language name parser language (English language names from CLDR).
 */
export const Language: LanguageLanguage = createLanguage<LanguageLanguage>({
  Language: () => {
    const langs = cldr.main.en.localeDisplayNames.languages;
    const lang = (code: string, name: string) =>
      map(fuzzyCase(name), (_match, b, a) => language({ code, name }, b, a));

    return any(
      ...Object.entries(langs).map(([code, name]) => lang(code, name)),
    );
  },
  parser: (s) => dot(any(s.Language)),
});
