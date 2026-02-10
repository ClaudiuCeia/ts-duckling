import {
  type Context,
  createLanguage,
  map,
  regex,
  seq,
  skip1,
  str,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { guard } from "./guard.ts";

/**
 * JSON Web Token entity.
 */
export type JWTEntity = Entity<
  "jwt",
  {
    jwt: string;
    /** Decoded header (if valid JSON). */
    header?: Record<string, unknown>;
  }
>;

/**
 * Helper for constructing a `JWTEntity`.
 */
export const jwt = (
  value: JWTEntity["value"],
  before: Context,
  after: Context,
): JWTEntity => {
  return ent(value, "jwt", before, after);
};

/**
 * Try to base64url-decode and JSON-parse the header segment.
 * Returns the parsed object if valid, undefined otherwise.
 */
const decodeHeader = (segment: string): Record<string, unknown> | undefined => {
  try {
    // base64url → base64
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    const obj = JSON.parse(json);
    if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
      return obj as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

// Leaf token: a run of base64url characters (A-Z, a-z, 0-9, -, _)
const b64urlChars = regex(/[A-Za-z0-9_-]+/, "base64url-chars");

type JWTLanguage = {
  /** JWT header segment — must start with "eyJ" (base64url for '{"') */
  Header: Parser<string>;
  /** Generic base64url segment (payload or signature) */
  Segment: Parser<string>;
  /** Three dot-separated segments, header-validated */
  Raw: Parser<[string, string, string]>;
  Full: Parser<JWTEntity>;
  parser: Parser<JWTEntity>;
};

/**
 * JWT parser language.
 *
 * Structure: three base64url segments separated by `"."`, where the first
 * segment starts with `eyJ` and decodes to JSON containing `alg` or `typ`.
 *
 * @example
 * `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U`
 */
export const JWT: JWTLanguage = createLanguage<JWTLanguage>({
  // Header: must begin with "eyJ" (base64url for '{"'), followed by more base64url chars
  Header: () =>
    map(
      seq(str("eyJ"), b64urlChars),
      ([prefix, rest]) => `${prefix}${rest}`,
    ),

  // Payload or signature: at least 2 base64url characters
  Segment: () => guard(b64urlChars, (s) => s.length >= 2),

  // Three dot-separated segments
  Raw: (s) =>
    guard(
      map(
        seq(s.Header, skip1(str(".")), s.Segment, skip1(str(".")), s.Segment),
        ([header, , payload, , signature]) =>
          [header, payload, signature] as [string, string, string],
      ),
      ([header]) => {
        const h = decodeHeader(header);
        if (!h) return false;
        return "alg" in h || "typ" in h;
      },
    ),

  Full: (s) =>
    map(s.Raw, ([header, payload, signature], b, a) => {
      const raw = `${header}.${payload}.${signature}`;
      return jwt({ jwt: raw, header: decodeHeader(header) }, b, a);
    }),

  parser: (s) => dot(s.Full),
});
