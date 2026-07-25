import {
  any,
  type Context,
  defineLanguage,
  failure,
  map,
  optional,
  regex,
  repeat,
  seq,
  skip1,
  str,
} from "@claudiu-ceia/combine";
import type {
  Language as DefinedLanguage,
  Parser,
} from "@claudiu-ceia/combine";
import { strictBoundary } from "./common.ts";
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

// Regex for zero or more hex groups each with a trailing colon, e.g. "ffff:a:".
// Used in IPv4-mapped IPv6 to match middle groups before the IPv4 suffix.
// Unlike hexChain this stops as soon as the next group would not be followed
// by ":" — so for "ffff:192.0.2.128" it matches only "ffff:" because "192."
// has no trailing colon.
const hexGroupsPrefix = regex(
  /(?:[0-9a-fA-F]{1,4}:)*/,
  "hex-groups-prefix",
);

/**
 * Zero-width IPv4 boundary.
 *
 * Rejects word characters (via the base `boundary` check) and also rejects
 * "." immediately followed by a digit, which indicates a fifth octet rather
 * than a sentence-ending period (e.g. "192.168.0.1.5" → no match, but
 * "192.168.0.1." → match).
 */
const ipv4Boundary = <T>(p: Parser<T>): Parser<T> =>
  (ctx) => {
    const res = p(ctx);
    if (!res.success) return res;
    const after = res.ctx;
    if (after.index < after.text.length) {
      const c = after.text[after.index];
      if (/\w/.test(c)) return failure(ctx, "ipv4-boundary");
      if (
        c === "." &&
        after.index + 1 < after.text.length &&
        /\d/.test(after.text[after.index + 1])
      ) {
        return failure(ctx, "ipv4-boundary");
      }
    }
    return res;
  };

/**
 * Zero-width IPv6-compressed boundary.
 *
 * Rejects ":" (more groups) and also rejects "." immediately followed by a
 * digit. The dot+digit lookahead lets "::1." (sentence period) succeed while
 * preventing "::ffff:192" from being accepted as a prefix of "::ffff:192.0.2.128"
 * (the full IPv4-mapped form is handled by `Full6v4` instead).
 */
const ipv6CompBoundary = <T>(p: Parser<T>): Parser<T> =>
  (ctx) => {
    const res = p(ctx);
    if (!res.success) return res;
    const after = res.ctx;
    if (after.index < after.text.length) {
      const c = after.text[after.index];
      if (/\w/.test(c) || c === ":") return failure(ctx, "ipv6-boundary");
      if (
        c === "." &&
        after.index + 1 < after.text.length &&
        /\d/.test(after.text[after.index + 1])
      ) {
        return failure(ctx, "ipv6-boundary");
      }
    }
    return res;
  };

type IPAddressOutputs = {
  /** Dotted-decimal IPv4: four octets 0-255 separated by dots */
  IPv4: string;
  /** Full IPv6: eight colon-separated hex groups */
  IPv6Full: string;
  /** Compressed IPv6 with :: */
  IPv6Compressed: string;
  /** IPv4-mapped/IPv4-compatible IPv6: `::ffff:a.b.c.d`, `::a.b.c.d`, etc. */
  IPv6v4Mapped: string;
  Full4: IPAddressEntity;
  Full6: IPAddressEntity;
  Full6c: IPAddressEntity;
  Full6v4: IPAddressEntity;
  parser: IPAddressEntity;
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
 * - IPv4-mapped/-compatible IPv6: `::ffff:192.0.2.128`, `::192.0.2.128`
 */
export const IPAddress: DefinedLanguage<IPAddressOutputs> = defineLanguage<
  IPAddressOutputs
>({
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

  // IPv4-mapped and IPv4-compatible IPv6 addresses (RFC 4291 §2.2).
  //
  // General form: [leftHexGroups]::([middleHexGroups:]IPv4address)
  //   e.g. ::ffff:192.0.2.128  (IPv4-mapped)
  //        ::192.0.2.128       (IPv4-compatible, deprecated but parseable)
  //        2001:db8::ffff:192.0.2.128
  //
  // The `hexGroupsPrefix` regex matches zero-or-more "hex:" tokens and stops
  // before the IPv4 octet because IPv4 octets are not followed by ":".
  // This prevents `hexChain` from greedily consuming "ffff:192" as two hex
  // groups and then failing on the trailing ".".
  IPv6v4Mapped: (s) =>
    guard(
      map(
        seq(
          optional(hexChain), // optional leading hex groups before "::"
          str("::"),
          hexGroupsPrefix, // zero or more "hex:" groups before IPv4
          s.IPv4, // IPv4 address occupying the last 32 bits
        ),
        (_, b, a) => b.text.substring(b.index, a.index),
      ),
      (addr) => {
        const dcolonIdx = addr.indexOf("::");
        if (dcolonIdx === -1) return false;
        const leftStr = addr.slice(0, dcolonIdx);
        const rightStr = addr.slice(dcolonIdx + 2);
        const leftGroups = leftStr ? leftStr.split(":") : [];
        // Isolate the IPv4 suffix at the end of the right side
        const ipv4Match = rightStr.match(/\d+\.\d+\.\d+\.\d+$/);
        if (!ipv4Match) return false;
        const hexPart = rightStr.slice(0, rightStr.length - ipv4Match[0].length)
          .replace(/:$/, "");
        const middleGroups = hexPart ? hexPart.split(":") : [];
        // IPv4 counts as 2 groups (32 bits ÷ 16 bits/group).
        // Total explicit groups + 2 must be < 8 so "::" can expand to ≥ 1 group.
        const total = leftGroups.length + middleGroups.length + 2;
        return total < 8;
      },
    ),

  Full4: (s) => map(s.IPv4, (_, b, a) => mkIP(4, b, a)),
  Full6: (s) => map(s.IPv6Full, (_, b, a) => mkIP(6, b, a)),
  Full6c: (s) => map(s.IPv6Compressed, (_, b, a) => mkIP(6, b, a)),
  Full6v4: (s) => map(s.IPv6v4Mapped, (_, b, a) => mkIP(6, b, a)),
  parser: (s) =>
    // Format-specific boundaries prevent prefix matches:
    //  • IPv4: rejects adjacent digit (via \w) or "." followed by digit
    //  • IPv6 full: rejects adjacent ":" (would form a 9th group)
    //  • IPv6 v4-mapped: tried before compressed so ::ffff:a.b.c.d is fully matched
    //  • IPv6 compressed: rejects ":" and "." followed by digit
    any(
      ipv4Boundary(s.Full4),
      strictBoundary(s.Full6, /[:]/),
      ipv6CompBoundary(s.Full6v4),
      ipv6CompBoundary(s.Full6c),
    ),
});
