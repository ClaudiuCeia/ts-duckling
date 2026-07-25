import type { ParserId } from "./parsers";

/** Parser metadata shown in the sidebar. */
export type ParserInfo = {
  id: ParserId;
  label: string;
  desc: string;
};

const parserInfo: Record<ParserId, Omit<ParserInfo, "id">> = {
  Range: {
    label: "Range",
    desc: "Intervals: time and temperature ranges",
  },
  Time: {
    label: "Time",
    desc: "Dates, relative time, day of week, circa",
  },
  Temperature: {
    label: "Temperature",
    desc: "Temperatures with optional unit",
  },
  Quantity: {
    label: "Quantity",
    desc: "Numbers: literals, commas, fractions",
  },
  Location: {
    label: "Location",
    desc: "Countries and cities (dataset-backed)",
  },
  URL: {
    label: "URL",
    desc: "Web URLs and bare domains",
  },
  Email: { label: "Email", desc: "Email addresses" },
  Institution: {
    label: "Institution",
    desc: "Town halls, schools, etc.",
  },
  Language: {
    label: "Language",
    desc: "Language names (dataset-backed)",
  },
  Phone: { label: "Phone", desc: "E.164 and formatted phone numbers" },
  IPAddress: { label: "IP address", desc: "IPv4 and IPv6" },
  SSN: { label: "SSN", desc: "US SSN: AAA-GG-SSSS (basic constraints)" },
  CreditCard: {
    label: "Credit card",
    desc: "13–19 digits (spaces/dashes) + Luhn",
  },
  UUID: { label: "UUID", desc: "Canonical 8-4-4-4-12 UUID" },
  ApiKey: { label: "API key", desc: "Common API key patterns" },
  IBAN: { label: "IBAN", desc: "International bank account numbers" },
  MACAddress: { label: "MAC address", desc: "Common IEEE 802 formats" },
  JWT: { label: "JWT", desc: "JSON Web Tokens" },
  CryptoAddress: {
    label: "Crypto address",
    desc: "Bitcoin and Ethereum wallet addresses",
  },
  BIC: { label: "BIC/SWIFT", desc: "ISO 9362 institution identifiers" },
};

export const PARSER_REGISTRY: ParserInfo[] = Object.entries(parserInfo).map(
  ([id, info]) => ({ id: id as ParserId, ...info }),
);

export const ALL_IDS = PARSER_REGISTRY.map((p) => p.id);

export const PII_IDS: ParserId[] = [
  "Email",
  "UUID",
  "Phone",
  "IPAddress",
  "SSN",
  "CreditCard",
  "ApiKey",
  "IBAN",
  "MACAddress",
  "JWT",
  "CryptoAddress",
  "BIC",
];

/** PII + protocol-qualified URLs (SensitiveParsers preset). */
export const SENSITIVE_IDS: ParserId[] = [
  ...PII_IDS,
  "URL",
];

/** Parser ordering sent to the worker (priority: specific → generic). */
export const PARSER_PRIORITY: ParserId[] = [
  "Email",
  "URL",
  "UUID",
  "Phone",
  "IPAddress",
  "SSN",
  "CreditCard",
  "ApiKey",
  "IBAN",
  "MACAddress",
  "JWT",
  "CryptoAddress",
  "BIC",
  "Time",
  "Temperature",
  "Range",
  "Location",
  "Institution",
  "Language",
  "Quantity",
];

export const PRESETS: Record<string, string> = {
  mixed: [
    "Email me at no-reply+foo@some.domain.dev.",
    "Visit https://duckling.deno.dev/.",
    "Call +14155552671.",
    "SSN 123-45-6789. CC 4242 4242 4242 4242.",
    "IP 192.168.0.1 and 2001:0db8:85a3:0000:0000:8a2e:0370:7334.",
    "We met 2 days ago and it was 20 C.",
    "id 550e8400-e29b-41d4-a716-446655440000",
  ].join(" "),
  pii: [
    "no-reply+foo@some.domain.dev",
    "+14155552671",
    "192.168.0.1",
    "123-45-6789",
    "4242 4242 4242 4242",
    "550e8400-e29b-41d4-a716-446655440000",
    "GB29NWBK60161331926819",
    "00:1A:2B:3C:4D:5E",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
    "0x52908400098527886E0F7030069857D2E4169EE7",
    "DEUTDEFF",
  ].join("\n"),
  article: [
    "Between 2018 and 2022, we saw a big shift in browser runtimes.",
    "On January 5, 2022, the project started shipping weekly releases.",
    "Reach out at hello@example.com or visit https://example.com/docs.",
  ].join("\n\n"),
};
