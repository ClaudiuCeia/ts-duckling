import { any, type Context, defineLanguage, map } from "@claudiu-ceia/combine";
import type { Language as DefinedLanguage } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import languages from "@data/languages-en" with { type: "json" };
import { fuzzyCase } from "./parsers.ts";

type CldrLanguages = {
  names: Record<string, string>;
  aliases: Record<string, string[]>;
  compatibility: Record<string, string[]>;
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

type LanguageOutputs = {
  Language: LanguageEntity;
  parser: LanguageEntity;
};

/**
 * Language name parser language (English language names from CLDR).
 */
export const Language: DefinedLanguage<LanguageOutputs> = defineLanguage<
  LanguageOutputs
>({
  Language: () => {
    const lang = (code: string, name: string) =>
      map(fuzzyCase(name), (_match, b, a) => language({ code, name }, b, a));
    const names = Object.entries(cldr.names).flatMap(([code, name]) => [
      [code, name] as const,
      ...(cldr.aliases[code] ?? []).map((alias) => [code, alias] as const),
    ]).concat(
      Object.entries(cldr.compatibility).flatMap(([code, aliases]) =>
        aliases.map((alias) => [code, alias] as const)
      ),
    ).sort(([, a], [, b]) => b.length - a.length || a.localeCompare(b));

    return any(...names.map(([code, name]) => lang(code, name)));
  },
  parser: (s) => dot(any(s.Language)),
});
