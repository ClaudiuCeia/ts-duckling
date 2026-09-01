import { assertEquals } from "@std/assert";
import { CryptoAddress, Duckling } from "../mod.ts";

// ---------------------------------------------------------------------------
// BTC P2PKH (Base58Check, version byte 0x00)
// ---------------------------------------------------------------------------

Deno.test("BTC P2PKH (legacy, starts with 1)", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "send to 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2 please",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.address, "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2");
  assertEquals(res[0].value.currency, "btc");
  assertEquals(res[0].value.format, "p2pkh");
});

Deno.test("BTC P2PKH one-char mutation rejected (bad checksum)", () => {
  // Last char changed: '2' → '3'; length and charset are valid but checksum fails.
  const res = Duckling([CryptoAddress.parser]).extract(
    "send to 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN3 ok",
  );
  assertEquals(res.length, 0);
});

// ---------------------------------------------------------------------------
// BTC P2SH (Base58Check, version byte 0x05)
// ---------------------------------------------------------------------------

Deno.test("BTC P2SH (script, starts with 3)", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "send to 3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy ok",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.address, "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy");
  assertEquals(res[0].value.currency, "btc");
  assertEquals(res[0].value.format, "p2sh");
});

Deno.test("BTC P2SH one-char mutation rejected (bad checksum)", () => {
  // Last char changed: 'y' → 'z'; length and charset are valid but checksum fails.
  const res = Duckling([CryptoAddress.parser]).extract(
    "send to 3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLz ok",
  );
  assertEquals(res.length, 0);
});

// ---------------------------------------------------------------------------
// BTC Bech32 (SegWit v0, P2WPKH) — BIP-0173 test vector
// ---------------------------------------------------------------------------

Deno.test("BTC Bech32 (segwit, bc1q) — BIP-0173 test vector", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "addr bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4 here",
  );
  assertEquals(res.length, 1);
  assertEquals(
    res[0].value.address,
    "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
  );
  assertEquals(res[0].value.currency, "btc");
  assertEquals(res[0].value.format, "bech32");
});

Deno.test("BTC Bech32 one-char mutation rejected (bad polymod)", () => {
  // Last char changed: '4' → '5'; length and charset are valid but polymod fails.
  const res = Duckling([CryptoAddress.parser]).extract(
    "addr bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5 here",
  );
  assertEquals(res.length, 0);
});

Deno.test("BTC Bech32 uppercase accepted (BIP-0173)", () => {
  // Uppercase variant of the BIP-0173 P2WPKH test vector.
  const res = Duckling([CryptoAddress.parser]).extract(
    "addr BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4 here",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.currency, "btc");
  assertEquals(res[0].value.format, "bech32");
  assertEquals(
    res[0].value.address,
    "BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4",
  );
});

Deno.test("BTC Bech32 accepts a 32-byte v0 witness program", () => {
  const address =
    "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3";
  const res = Duckling([CryptoAddress.parser]).extract(address);
  assertEquals(res.length, 1);
  assertEquals(res[0].value.address, address);
  assertEquals(res[0].value.format, "bech32");
});

// ---------------------------------------------------------------------------
// BTC Bech32m (Taproot / SegWit v1) — BIP-0350 test vector
// ---------------------------------------------------------------------------

Deno.test("BTC Taproot (bech32m, bc1p) — BIP-0350 test vector", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "taproot bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0 ok",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.currency, "btc");
  assertEquals(res[0].value.format, "bech32m");
  assertEquals(res[0].value.address.length, 62);
});

Deno.test("BTC Taproot one-char mutation rejected (bad polymod)", () => {
  // Last char changed: '0' → '2'; length and charset are valid but polymod fails.
  const res = Duckling([CryptoAddress.parser]).extract(
    "taproot bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj2 ok",
  );
  assertEquals(res.length, 0);
});

Deno.test("BTC Bech32m accepts witness versions 2 through 16", () => {
  const addresses = [
    // BIP-0350 v2, 16-byte witness program.
    "bc1zw508d6qejxtdg4y5r3zarvaryvaxxpcs",
    // BIP-0350 v16, minimum 2-byte witness program.
    "BC1SW50QGDZ25J",
  ];
  for (const address of addresses) {
    const res = Duckling([CryptoAddress.parser]).extract(address);
    assertEquals(res.length, 1, `expected ${address} to be accepted`);
    assertEquals(res[0].value.address, address);
    assertEquals(res[0].value.currency, "btc");
    assertEquals(res[0].value.format, "bech32m");
  }
});

Deno.test("BTC Bech32m accepts a maximum 40-byte witness program", () => {
  const address =
    "bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kt5nd6y";
  const res = Duckling([CryptoAddress.parser]).extract(address);
  assertEquals(res.length, 1);
  assertEquals(res[0].value.address, address);
  assertEquals(res[0].value.format, "bech32m");
});

Deno.test("BTC Bech32/Bech32m invalid BIP-0350 vectors rejected", () => {
  const addresses = [
    // Bech32 checksum used for v1 instead of Bech32m.
    "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqh2y7hd",
    // Bech32m checksum used for v0 instead of Bech32.
    "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kemeawh",
    // Witness version 17 is outside the 0-16 range.
    "BC130XLXVLHEMJA6C4DQV22UAPCTQUPFHLXM9H8Z3K2E72Q4K9HCZ7VQ7ZWS8R",
    // Witness programs below 2 bytes and above 40 bytes.
    "bc1pw5dgrnzv",
    "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7v8n0nx0muaewav253zgeav",
    // A v0 witness program that is neither 20 nor 32 bytes.
    "BC1QR508D6QEJXTDG4Y5R3ZARVARYV98GJ9P",
    // More than four zero-padding bits.
    "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7v07qwwzcrf",
  ];
  for (const address of addresses) {
    const res = Duckling([CryptoAddress.parser]).extract(address);
    assertEquals(res.length, 0, `expected ${address} to be rejected`);
  }
});

Deno.test("BTC Bech32m mixed case rejected", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "bc1p0xLxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0",
  );
  assertEquals(res.length, 0);
});

// ---------------------------------------------------------------------------
// ETH (ERC-20) — EIP-55 checksum
// ---------------------------------------------------------------------------

Deno.test("ETH valid EIP-55 mixed-case accepted", () => {
  // Addresses from the EIP-55 specification.
  const eip55Addrs = [
    "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
    "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
    "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
  ];
  for (const addr of eip55Addrs) {
    const res = Duckling([CryptoAddress.parser]).extract(`eth ${addr} here`);
    assertEquals(res.length, 1, `expected ${addr} to be accepted`);
    assertEquals(res[0].value.address, addr);
    assertEquals(res[0].value.currency, "eth");
    assertEquals(res[0].value.format, "erc20");
  }
});

Deno.test("ETH EIP-55 one-case-bit flip rejected", () => {
  // 'A' at body position 2 flipped to 'a' — nibble requires uppercase.
  const res = Duckling([CryptoAddress.parser]).extract(
    "0x5aaeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
  );
  assertEquals(res.length, 0);
});

Deno.test("ETH all-lowercase accepted", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.currency, "eth");
});

Deno.test("ETH all-uppercase accepted", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "0xDE0B295669A9FD93D5F28D9EC85E40F4CB697BAE",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.currency, "eth");
});

// ---------------------------------------------------------------------------
// Shape-only rejections (unchanged behavior)
// ---------------------------------------------------------------------------

Deno.test("too-short BTC address rejected", () => {
  // 24 chars total — below the 25-char minimum
  const res = Duckling([CryptoAddress.parser]).extract(
    "send to 1BvBMSEYstWetqTFn5Au4m4 ok",
  );
  assertEquals(res.length, 0);
});

Deno.test("wrong-length bech32 rejected", () => {
  // bc1q + only 10 chars — not 38 or 58
  const res = Duckling([CryptoAddress.parser]).extract(
    "addr bc1qar0srrr7x here",
  );
  assertEquals(res.length, 0);
});

Deno.test("ETH too-short hex rejected", () => {
  // 0x + 38 hex chars — needs exactly 40
  const res = Duckling([CryptoAddress.parser]).extract(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD ok",
  );
  assertEquals(res.length, 0);
});

// ---------------------------------------------------------------------------
// Integration
// ---------------------------------------------------------------------------

Deno.test("crypto in Duckling default parsers", () => {
  const res = Duckling().extract(
    "send 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed now",
  );
  assertEquals(
    res.some((e) =>
      e.kind === "crypto_address" &&
      e.text === "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"
    ),
    true,
  );
});

Deno.test("multiple crypto addresses in one string", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "BTC: 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2 ETH: 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
  );
  assertEquals(res.length, 2);
  assertEquals(res[0].value.currency, "btc");
  assertEquals(res[1].value.currency, "eth");
});
