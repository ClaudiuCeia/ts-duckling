import { Duckling } from "@claudiu-ceia/ts-duckling";

const parser = Duckling();
const cryptoAddress = (input) =>
  parser.extract(input).find(({ kind }) => kind === "crypto_address");

if (parser.extract("a@b.com")[0]?.kind !== "email") {
  throw new Error("email extraction failed");
}
if (
  cryptoAddress("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2")?.value.currency !== "btc"
) {
  throw new Error("Bitcoin Base58Check extraction failed");
}
if (cryptoAddress("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN3") !== undefined) {
  throw new Error("invalid Bitcoin checksum was accepted");
}
if (
  cryptoAddress("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed")?.value
    .currency !== "eth"
) {
  throw new Error("Ethereum EIP-55 extraction failed");
}
if (cryptoAddress("0x5aaeb6053F3E94C9b9A09f33669435E7Ef1BeAed") !== undefined) {
  throw new Error("invalid Ethereum checksum was accepted");
}
