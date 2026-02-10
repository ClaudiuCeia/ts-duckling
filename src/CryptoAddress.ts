import {
  any,
  type Context,
  createLanguage,
  map,
  regex,
  seq,
  str,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { guard } from "./guard.ts";

/**
 * Cryptocurrency wallet address entity.
 */
export type CryptoAddressEntity = Entity<
  "crypto_address",
  {
    address: string;
    currency: "btc" | "eth";
    /** Address format variant. */
    format:
      | "p2pkh"
      | "p2sh"
      | "bech32"
      | "bech32m"
      | "erc20";
  }
>;

/**
 * Helper for constructing a `CryptoAddressEntity`.
 */
export const cryptoAddress = (
  value: CryptoAddressEntity["value"],
  before: Context,
  after: Context,
): CryptoAddressEntity => {
  return ent(value, "crypto_address", before, after);
};

// -- Leaf tokens --

// Base58 character class (no 0, O, I, l)
const base58Chars = regex(
  /[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+/,
  "base58",
);

// Bech32 character class (lowercase alphanumeric minus 1, b, i, o)
const bech32Chars = regex(/[023456789ac-hj-np-z]+/, "bech32");

// 40 hex characters (ETH address body)
const hex40 = regex(/[0-9a-fA-F]{40}/, "hex-40");

// -- Validation helpers --

/**
 * Validate that a base58 string has the right length for a BTC address.
 * Full Base58Check decoding would require sha256 — we validate the
 * character set and length (25-34 total including prefix).
 */
const isValidBase58Address = (addr: string): boolean =>
  addr.length >= 25 && addr.length <= 34;

/**
 * Validate bech32 address body length.
 * - bc1q (P2WPKH): total 42 chars (bc1q + 38)
 * - bc1q (P2WSH):  total 62 chars (bc1q + 58)
 * - bc1p (Taproot): total 62 chars (bc1p + 58)
 */
const isValidBech32 = (body: string, prefix: string): boolean => {
  const total = prefix.length + body.length;
  if (prefix === "bc1q") return total === 42 || total === 62;
  if (prefix === "bc1p") return total === 62;
  return false;
};

type CryptoAddressLanguage = {
  /** BTC P2PKH: `1` + 25-33 base58 chars */
  BtcP2PKH: Parser<CryptoAddressEntity>;
  /** BTC P2SH: `3` + 25-33 base58 chars */
  BtcP2SH: Parser<CryptoAddressEntity>;
  /** BTC Bech32/Bech32m: `bc1q...` or `bc1p...` */
  BtcBech32: Parser<CryptoAddressEntity>;
  /** ETH: `0x` + 40 hex chars */
  Eth: Parser<CryptoAddressEntity>;
  Full: Parser<CryptoAddressEntity>;
  parser: Parser<CryptoAddressEntity>;
};

/**
 * Cryptocurrency address parser language.
 *
 * Supports:
 * - **BTC P2PKH**: `1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2`
 * - **BTC P2SH**: `3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy`
 * - **BTC Bech32**: `bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq`
 * - **BTC Taproot**: `bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3s7a`
 * - **ETH (ERC-20)**: `0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18`
 */
export const CryptoAddress: CryptoAddressLanguage = createLanguage<
  CryptoAddressLanguage
>({
  // BTC Legacy (P2PKH): starts with "1", followed by base58 chars
  BtcP2PKH: () =>
    guard(
      map(
        seq(str("1"), base58Chars),
        ([prefix, body], b, a) =>
          cryptoAddress(
            {
              address: `${prefix}${body}`,
              currency: "btc",
              format: "p2pkh",
            },
            b,
            a,
          ),
      ),
      (e) => isValidBase58Address(e.value.address),
    ),

  // BTC Script (P2SH): starts with "3", followed by base58 chars
  BtcP2SH: () =>
    guard(
      map(
        seq(str("3"), base58Chars),
        ([prefix, body], b, a) =>
          cryptoAddress(
            {
              address: `${prefix}${body}`,
              currency: "btc",
              format: "p2sh",
            },
            b,
            a,
          ),
      ),
      (e) => isValidBase58Address(e.value.address),
    ),

  // BTC Bech32 (SegWit) / Bech32m (Taproot): bc1q... or bc1p...
  BtcBech32: () => {
    const prefix = any(str("bc1q"), str("bc1p"));
    return guard(
      map(
        seq(prefix, bech32Chars),
        ([pfx, body], b, a) =>
          cryptoAddress(
            {
              address: `${pfx}${body}`,
              currency: "btc",
              format: pfx === "bc1p" ? "bech32m" : "bech32",
            },
            b,
            a,
          ),
      ),
      (e) =>
        isValidBech32(
          e.value.address.slice(4),
          e.value.address.slice(0, 4),
        ),
    );
  },

  // ETH (ERC-20): 0x + 40 hex characters
  Eth: () =>
    map(
      seq(str("0x"), hex40),
      ([prefix, body], b, a) =>
        cryptoAddress(
          {
            address: `${prefix}${body}`,
            currency: "eth",
            format: "erc20",
          },
          b,
          a,
        ),
    ),

  Full: (s) => any(s.BtcBech32, s.BtcP2PKH, s.BtcP2SH, s.Eth),

  parser: (s) => dot(s.Full),
});
