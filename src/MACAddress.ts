import {
  any,
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

/**
 * MAC address entity (IEEE 802).
 */
export type MACAddressEntity = Entity<
  "mac_address",
  {
    mac: string;
    /** Normalized to lowercase colon-separated form (aa:bb:cc:dd:ee:ff). */
    normalized: string;
  }
>;

/**
 * Helper for constructing a `MACAddressEntity`.
 */
export const macAddress = (
  value: MACAddressEntity["value"],
  before: Context,
  after: Context,
): MACAddressEntity => {
  return ent(value, "mac_address", before, after);
};

const normalizeMac = (raw: string): string =>
  raw.replace(/[-. ]/g, ":").toLowerCase();

// Leaf tokens — character class is the natural expression for "two hex digits"
const hexPair = regex(/[0-9a-fA-F]{2}/, "hex-pair");
const hexQuad = regex(/[0-9a-fA-F]{4}/, "hex-quad");

// 6 hex pairs separated by a delimiter — expressed as combinator structure
const sixPairs = (sep: Parser<string>): Parser<string[]> =>
  map(
    seq(
      hexPair,
      skip1(sep),
      hexPair,
      skip1(sep),
      hexPair,
      skip1(sep),
      hexPair,
      skip1(sep),
      hexPair,
      skip1(sep),
      hexPair,
    ),
    (parts) => parts.filter((p): p is string => p !== null),
  );

// 3 hex quads separated by dots
const threeQuads: Parser<string[]> = map(
  seq(hexQuad, skip1(str(".")), hexQuad, skip1(str(".")), hexQuad),
  (parts) => parts.filter((p): p is string => p !== null),
);

const mkMac = (b: Context, a: Context): MACAddressEntity => {
  const raw = b.text.substring(b.index, a.index);
  return macAddress({ mac: raw, normalized: normalizeMac(raw) }, b, a);
};

type MACAddressLanguage = {
  /** Colon-separated: AA:BB:CC:DD:EE:FF */
  Colon: Parser<MACAddressEntity>;
  /** Hyphen-separated: AA-BB-CC-DD-EE-FF */
  Hyphen: Parser<MACAddressEntity>;
  /** Dot-separated Cisco style: AABB.CCDD.EEFF */
  Dot: Parser<MACAddressEntity>;
  parser: Parser<MACAddressEntity>;
};

/**
 * MAC address parser language.
 *
 * Structure: six hex-pair octets joined by a delimiter (`:`, `-`, or Cisco `.`
 * notation with three quad groups). Case-insensitive.
 */
export const MACAddress: MACAddressLanguage = createLanguage<
  MACAddressLanguage
>({
  Colon: () => map(sixPairs(str(":")), (_, b, a) => mkMac(b, a)),
  Hyphen: () => map(sixPairs(str("-")), (_, b, a) => mkMac(b, a)),
  Dot: () => map(threeQuads, (_, b, a) => mkMac(b, a)),
  parser: (s) => dot(any(s.Colon, s.Hyphen, s.Dot)),
});
