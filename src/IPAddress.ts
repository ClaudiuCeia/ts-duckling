import {
  any,
  type Context,
  createLanguage,
  map,
  optional,
  regex,
  repeat,
  seq,
  skip1,
  str,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { guard } from "./guard.ts";

/**
 * IP address entity (IPv4 or IPv6).
 */
export type IPAddressEntity = Entity<
  "ip",
  {
    ip: string;
    version: 4 | 6;
  }
>;

/**
 * Helper for constructing an `IPAddressEntity`.
 */
export const ipAddress = (
  value: IPAddressEntity["value"],
  before: Context,
  after: Context,
): IPAddressEntity => {
  return ent(value, "ip", before, after);
};

// Leaf: 1-4 hex digits (character class is fine as regex)
const hexGroup = regex(/[0-9a-fA-F]{1,4}/, "hex-group");

// Leaf: 1-3 decimal digits
const decDigits = regex(/\d{1,3}/, "1-3 digits");

// An IPv4 octet: parse 1-3 digits, then guard that the value is 0-255
const octet: Parser<number> = guard(
  map(decDigits, (s) => parseInt(s, 10)),
  (n) => n >= 0 && n <= 255,
  "octet 0-255",
);

// Leaf: a chain of 1+ hex groups separated by single colons (e.g. "2001:db8").
// The regex naturally stops before "::" because after consuming a ":",
// the quantifier requires hex digits — a second ":" causes backtracking.
const hexChain = regex(/[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*/, "hex-chain");

type IPAddressLanguage = {
  /** Dotted-decimal IPv4: four octets 0-255 separated by dots */
  IPv4: Parser<string>;
  /** Full IPv6: eight colon-separated hex groups */
  IPv6Full: Parser<string>;
  /** Compressed IPv6 with :: */
  IPv6Compressed: Parser<string>;
  Full4: Parser<IPAddressEntity>;
  Full6: Parser<IPAddressEntity>;
  Full6c: Parser<IPAddressEntity>;
  parser: Parser<IPAddressEntity>;
};

const mkIP = (version: 4 | 6, b: Context, a: Context): IPAddressEntity => {
  const ip = b.text.substring(b.index, a.index);
  return ipAddress({ ip, version }, b, a);
};

/**
 * IP address parser language.
 *
 * Supports:
 * - IPv4: `192.168.1.1` with 0-255 octet validation via `guard`
 * - IPv6 full form: `2001:0db8:85a3:0000:0000:8a2e:0370:7334`
 * - IPv6 compressed: `::1`, `2001:db8::1`, `fe80::1`, `::`
 */
export const IPAddress: IPAddressLanguage = createLanguage<IPAddressLanguage>({
  // Four octets separated by dots
  IPv4: () =>
    map(
      seq(
        octet,
        skip1(str(".")),
        octet,
        skip1(str(".")),
        octet,
        skip1(str(".")),
        octet,
      ),
      ([a, , b, , c, , d]) => `${a}.${b}.${c}.${d}`,
    ),

  // Full form: exactly 8 hex groups separated by colons
  IPv6Full: () =>
    map(
      seq(hexGroup, repeat(7, seq(skip1(str(":")), hexGroup))),
      ([first, rest]) => [first, ...rest.map(([, g]) => g)].join(":"),
    ),

  // Compressed form with :: — structural parse then semantic validation.
  // The hex chain on each side of "::" is a leaf token (colon-separated hex
  // groups are character-level). The "::" itself is the structural separator,
  // expressed with combinators. Guard validates total group count ≤ 7.
  IPv6Compressed: () =>
    guard(
      map(
        seq(optional(hexChain), str("::"), optional(hexChain)),
        ([left, , right]) => {
          const l = left ?? "";
          const r = right ?? "";
          if (l && r) return `${l}::${r}`;
          if (l) return `${l}::`;
          if (r) return `::${r}`;
          return "::";
        },
      ),
      (addr) => {
        const parts = addr.split("::");
        if (parts.length !== 2) return false;
        const left = parts[0] === "" ? [] : parts[0].split(":");
        const right = parts[1] === "" ? [] : parts[1].split(":");
        const total = left.length + right.length;
        if (total > 7) return false;
        return [...left, ...right].every((g) => /^[0-9a-fA-F]{1,4}$/.test(g));
      },
    ),

  Full4: (s) => map(s.IPv4, (_, b, a) => mkIP(4, b, a)),
  Full6: (s) => map(s.IPv6Full, (_, b, a) => mkIP(6, b, a)),
  Full6c: (s) => map(s.IPv6Compressed, (_, b, a) => mkIP(6, b, a)),
  parser: (s) => dot(any(s.Full4, s.Full6, s.Full6c)),
});
