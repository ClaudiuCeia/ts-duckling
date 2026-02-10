import { assertEquals } from "@std/assert";
import { CryptoAddress, Duckling } from "../mod.ts";

Deno.test("BTC P2PKH (legacy, starts with 1)", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "send to 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2 please",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.address, "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2");
  assertEquals(res[0].value.currency, "btc");
  assertEquals(res[0].value.format, "p2pkh");
});

Deno.test("BTC P2SH (script, starts with 3)", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "send to 3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy ok",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.address, "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy");
  assertEquals(res[0].value.currency, "btc");
  assertEquals(res[0].value.format, "p2sh");
});

Deno.test("BTC Bech32 (segwit, bc1q)", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "addr bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq here",
  );
  assertEquals(res.length, 1);
  assertEquals(
    res[0].value.address,
    "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
  );
  assertEquals(res[0].value.currency, "btc");
  assertEquals(res[0].value.format, "bech32");
});

Deno.test("BTC Taproot (bech32m, bc1p)", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "taproot bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3s7a ok",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.currency, "btc");
  assertEquals(res[0].value.format, "bech32m");
  assertEquals(res[0].value.address.length, 62);
});

Deno.test("ETH address (0x + 40 hex)", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "eth 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18 here",
  );
  assertEquals(res.length, 1);
  assertEquals(
    res[0].value.address,
    "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
  );
  assertEquals(res[0].value.currency, "eth");
  assertEquals(res[0].value.format, "erc20");
});

Deno.test("ETH all-lowercase", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.currency, "eth");
});

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

Deno.test("crypto in Duckling default parsers", () => {
  const res = Duckling().extract(
    "send 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18 now",
  );
  assertEquals(
    res.some((e) =>
      e.kind === "crypto_address" &&
      e.text === "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
    ),
    true,
  );
});

Deno.test("multiple crypto addresses in one string", () => {
  const res = Duckling([CryptoAddress.parser]).extract(
    "BTC: 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2 ETH: 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
  );
  assertEquals(res.length, 2);
  assertEquals(res[0].value.currency, "btc");
  assertEquals(res[1].value.currency, "eth");
});
