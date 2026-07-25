import {
  any,
  type Context,
  defineLanguage,
  map,
  regex,
  seq,
  str,
} from "@claudiu-ceia/combine";
import type { Language } from "@claudiu-ceia/combine";
import { crypto as stdCrypto } from "@std/crypto";
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

// Bech32 character class (case-insensitive: lowercase + uppercase equivalents,
// both excluding 1, b/B, i/I, o/O)
const bech32CharsCI = regex(
  /[023456789ac-hj-np-zAC-HJ-NP-Z]+/,
  "bech32-ci",
);

// 40 hex characters (ETH address body)
const hex40 = regex(/[0-9a-fA-F]{40}/, "hex-40");

// -- Base58Check validation --

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_MAP = new Map<string, bigint>(
  [...BASE58_ALPHABET].map((c, i) => [c, BigInt(i)]),
);

/**
 * Decode a Base58-encoded string to bytes.
 * Returns null if any character is not in the Base58 alphabet.
 * Leading '1' characters map to leading zero bytes.
 */
function base58Decode(s: string): Uint8Array | null {
  let leadingZeros = 0;
  for (const c of s) {
    if (c === "1") leadingZeros++;
    else break;
  }
  let n = 0n;
  for (const c of s) {
    const v = BASE58_MAP.get(c);
    if (v === undefined) return null;
    n = n * 58n + v;
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  return new Uint8Array([...Array(leadingZeros).fill(0), ...bytes]);
}

/**
 * Validate a BTC legacy address via full Base58Check decoding.
 * Verifies the 25-byte decoded length, version byte, and
 * 4-byte double-SHA-256 checksum.
 */
function isValidBase58CheckAddress(
  addr: string,
  versionByte: number,
): boolean {
  if (addr.length < 25 || addr.length > 34) return false;
  const decoded = base58Decode(addr);
  if (decoded === null || decoded.length !== 25) return false;
  if (decoded[0] !== versionByte) return false;
  const payload = decoded.slice(0, 21);
  const storedChecksum = decoded.slice(21);
  const hash1 = new Uint8Array(
    stdCrypto.subtle.digestSync("SHA-256", payload),
  );
  const hash2 = new Uint8Array(
    stdCrypto.subtle.digestSync("SHA-256", hash1),
  );
  return (
    hash2[0] === storedChecksum[0] &&
    hash2[1] === storedChecksum[1] &&
    hash2[2] === storedChecksum[2] &&
    hash2[3] === storedChecksum[3]
  );
}

// -- Bech32 / Bech32m validation --

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_MAP = new Map<string, number>(
  [...BECH32_CHARSET].map((c, i) => [c, i]),
);
const BECH32_CONST = 1;
const BECH32M_CONST = 0x2bc830a3;

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >>> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  const result: number[] = [];
  for (const c of hrp) result.push(c.charCodeAt(0) >> 5);
  result.push(0);
  for (const c of hrp) result.push(c.charCodeAt(0) & 31);
  return result;
}

/**
 * Full Bech32/Bech32m validation for Bitcoin segwit/taproot addresses.
 *
 * - Accepts all-lowercase or all-uppercase; rejects mixed case.
 * - Verifies the polymod checksum (Bech32 → 1, Bech32m → 0x2bc830a3).
 * - Validates witness program length (20 or 32 bytes for v0, 32 for v1)
 *   and zero-padding of the final 5-bit group.
 */
function isValidBech32Full(addr: string): boolean {
  const lower = addr.toLowerCase();
  const upper = addr.toUpperCase();
  if (addr !== lower && addr !== upper) return false;

  const normalized = lower;
  const sep = normalized.lastIndexOf("1");
  if (sep < 1 || sep + 7 > normalized.length) return false;

  const hrp = normalized.slice(0, sep);
  const data = normalized.slice(sep + 1);

  const values: number[] = [];
  for (const c of data) {
    const v = BECH32_MAP.get(c);
    if (v === undefined) return false;
    values.push(v);
  }

  const polymod = bech32Polymod([...bech32HrpExpand(hrp), ...values]);
  const isBech32 = polymod === BECH32_CONST;
  const isBech32m = polymod === BECH32M_CONST;
  if (!isBech32 && !isBech32m) return false;

  const witnessVersion = values[0];
  if (witnessVersion === 0 && !isBech32) return false;
  if (witnessVersion !== 0 && !isBech32m) return false;

  // Convert witness program from 5-bit to 8-bit groups.
  const programValues = values.slice(1, values.length - 6);
  let acc = 0;
  let bits = 0;
  const program: number[] = [];
  for (const v of programValues) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      program.push((acc >> bits) & 0xff);
    }
  }
  // Padding bits must be fewer than 5 and all zero.
  if (bits >= 5 || (acc & ((1 << bits) - 1)) !== 0) return false;

  if (program.length < 2 || program.length > 40) return false;
  if (witnessVersion === 0 && program.length !== 20 && program.length !== 32) {
    return false;
  }

  return true;
}

// -- EIP-55 validation --

/**
 * Validate an Ethereum address against the EIP-55 mixed-case checksum.
 *
 * - All-lowercase and all-uppercase addresses are always accepted.
 * - Mixed-case addresses must satisfy EIP-55: each alphabetic hex character
 *   must be uppercased iff the corresponding nibble of Keccak-256(lowercase
 *   address) is >= 8.
 */
function isValidEip55(addr: string): boolean {
  const body = addr.slice(2); // strip "0x"
  if (body === body.toLowerCase() || body === body.toUpperCase()) return true;

  const lowerBody = body.toLowerCase();
  const hashBytes = new Uint8Array(
    stdCrypto.subtle.digestSync(
      "KECCAK-256",
      new TextEncoder().encode(lowerBody),
    ),
  );

  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c >= "0" && c <= "9") continue;
    // High nibble for even positions, low nibble for odd positions.
    const nibble = i % 2 === 0
      ? (hashBytes[Math.floor(i / 2)] >> 4) & 0xf
      : hashBytes[Math.floor(i / 2)] & 0xf;
    if (nibble >= 8) {
      if (c !== c.toUpperCase()) return false;
    } else {
      if (c !== c.toLowerCase()) return false;
    }
  }
  return true;
}

type CryptoAddressOutputs = {
  /** BTC P2PKH: `1` + 25-33 base58 chars */
  BtcP2PKH: CryptoAddressEntity;
  /** BTC P2SH: `3` + 25-33 base58 chars */
  BtcP2SH: CryptoAddressEntity;
  /** BTC Bech32/Bech32m: `bc1q...` or `bc1p...` (and uppercase variants) */
  BtcBech32: CryptoAddressEntity;
  /** ETH: `0x` + 40 hex chars */
  Eth: CryptoAddressEntity;
  Full: CryptoAddressEntity;
  parser: CryptoAddressEntity;
};

/**
 * Cryptocurrency address parser language.
 *
 * Supports:
 * - **BTC P2PKH**: `1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2`
 * - **BTC P2SH**: `3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy`
 * - **BTC Bech32**: `bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq`
 * - **BTC Taproot**: `bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3s7a`
 * - **ETH (ERC-20)**: `0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed`
 */
export const CryptoAddress: Language<CryptoAddressOutputs> = defineLanguage<
  CryptoAddressOutputs
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
      (e) => isValidBase58CheckAddress(e.value.address, 0x00),
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
      (e) => isValidBase58CheckAddress(e.value.address, 0x05),
    ),

  // BTC Bech32 (SegWit) / Bech32m (Taproot): bc1q... or bc1p... and uppercase
  BtcBech32: () => {
    const prefix = any(
      str("bc1q"),
      str("bc1p"),
      str("BC1Q"),
      str("BC1P"),
    );
    return guard(
      map(
        seq(prefix, bech32CharsCI),
        ([pfx, body], b, a) => {
          const addr = `${pfx}${body}`;
          const normalizedPfx = pfx.toLowerCase();
          return cryptoAddress(
            {
              address: addr,
              currency: "btc",
              format: normalizedPfx === "bc1p" ? "bech32m" : "bech32",
            },
            b,
            a,
          );
        },
      ),
      (e) => isValidBech32Full(e.value.address),
    );
  },

  // ETH (ERC-20): 0x + 40 hex characters with EIP-55 checksum for mixed-case
  Eth: () =>
    guard(
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
      (e) => isValidEip55(e.value.address),
    ),

  Full: (s) => any(s.BtcBech32, s.BtcP2PKH, s.BtcP2SH, s.Eth),

  parser: (s) => dot(s.Full),
});
