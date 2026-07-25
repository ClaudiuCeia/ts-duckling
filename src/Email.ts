import {
  any,
  type Context,
  defineLanguage,
  failure,
  map,
  type Parser,
  regex,
} from "@claudiu-ceia/combine";
import type { Language as DefinedLanguage } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";

const localAtom = "A-Za-z0-9!#$%&'*+/=?^_`{|}~\\-";
const domainLabel = "[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?";
const terminalLabel = "(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{2,59})";
const emailPattern = new RegExp(
  `(?=[${localAtom}.]{1,64}@)[${localAtom}]+(?:\\.[${localAtom}]+)*@(?:${domainLabel}\\.)+${terminalLabel}`,
  "i",
);
const emailContinuation = new RegExp(`[${localAtom}.@]`);

const candidate: Parser<string> = (ctx) => {
  if (ctx.index > 0 && emailContinuation.test(ctx.text[ctx.index - 1])) {
    return failure(ctx, "email boundary");
  }

  const result = regex(emailPattern, "email")(ctx);
  if (!result.success) return result;

  const raw = result.value;
  const domain = raw.slice(raw.lastIndexOf("@") + 1);
  if (
    domain.length > 253 ||
    emailContinuation.test(result.ctx.text[result.ctx.index] ?? "")
  ) {
    return failure(ctx, "email boundary");
  }

  return result;
};

/**
 * Email address entity.
 */
export type EmailEntity = Entity<
  "email",
  {
    email: string;
  }
>;

/**
 * Helper for constructing an `EmailEntity`.
 */
export const email = (
  value: EmailEntity["value"],
  before: Context,
  after: Context,
): EmailEntity => {
  return ent(value, "email", before, after);
};

type EmailOutputs = {
  Full: EmailEntity;
  parser: EmailEntity;
};

/**
 * Email address parser language.
 */
export const Email: DefinedLanguage<EmailOutputs> = defineLanguage<
  EmailOutputs
>({
  Full: () =>
    map(
      candidate,
      (raw, b, a) =>
        email(
          {
            email: raw,
          },
          b,
          a,
        ),
    ),
  parser: (s) => dot(any(s.Full)),
});
