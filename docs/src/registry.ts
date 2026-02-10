/** Parser metadata shown in the sidebar. */
export type ParserInfo = {
  id: string;
  label: string;
  desc: string;
};

export const PARSER_REGISTRY: ParserInfo[] = [
  {
    id: "Range",
    label: "Range",
    desc: "Intervals: time and temperature ranges",
  },
  {
    id: "Time",
    label: "Time",
    desc: "Dates, relative time, day of week, circa",
  },
  {
    id: "Temperature",
    label: "Temperature",
    desc: "Temperatures with optional unit",
  },
  {
    id: "Quantity",
    label: "Quantity",
    desc: "Numbers: literals, commas, fractions",
  },
  {
    id: "Location",
    label: "Location",
    desc: "Countries and cities (dataset-backed)",
  },
  {
    id: "URL",
    label: "URL",
    desc: "http/https/ftp URLs (domain + optional port)",
  },
  { id: "Email", label: "Email", desc: "Email addresses" },
  {
    id: "Institution",
    label: "Institution",
    desc: "Town halls, schools, etc.",
  },
  {
    id: "Language",
    label: "Language",
    desc: "Language names (dataset-backed)",
  },
  { id: "Phone", label: "Phone", desc: "E.164: +<digits> (8–15)" },
  { id: "IPAddress", label: "IP address", desc: "IPv4 + IPv6 full form" },
  { id: "SSN", label: "SSN", desc: "US SSN: AAA-GG-SSSS (basic constraints)" },
  {
    id: "CreditCard",
    label: "Credit card",
    desc: "13–19 digits (spaces/dashes) + Luhn",
  },
  { id: "UUID", label: "UUID", desc: "Canonical 8-4-4-4-12 UUID" },
  { id: "ApiKey", label: "API key", desc: "Common API key patterns" },
];

export const ALL_IDS = PARSER_REGISTRY.map((p) => p.id);

export const PII_IDS = [
  "Email",
  "URL",
  "UUID",
  "Phone",
  "IPAddress",
  "SSN",
  "CreditCard",
  "ApiKey",
];

/** Parser ordering sent to the worker (priority: specific → generic). */
export const PARSER_PRIORITY = [
  "Email",
  "URL",
  "UUID",
  "Phone",
  "IPAddress",
  "SSN",
  "CreditCard",
  "ApiKey",
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
    "https://duckling.deno.dev/",
    "+14155552671",
    "192.168.0.1",
    "123-45-6789",
    "4242 4242 4242 4242",
    "550e8400-e29b-41d4-a716-446655440000",
  ].join("\n"),
  article: [
    "Between 2018 and 2022, we saw a big shift in browser runtimes.",
    "On January 5, 2022, the project started shipping weekly releases.",
    "Reach out at hello@example.com or visit https://example.com/docs.",
  ].join("\n\n"),
};
