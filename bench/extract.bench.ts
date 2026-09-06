import { setSystemTime } from "bun:test";
import { bench, run } from "mitata";
import { Duckling, PIIParsers } from "../mod.ts";

const piiDuckling = Duckling(PIIParsers);
const expectedPIIKinds = [
  "email",
  "phone",
  "ip",
  "ssn",
  "credit_card",
  "uuid",
  "api_key",
  "iban",
  "mac_address",
  "jwt",
  "crypto_address",
  "bic",
] as const;

const assertPIIMatches = (
  entities: ReturnType<typeof piiDuckling.extract>,
  repetitions = 1,
) => {
  for (const kind of expectedPIIKinds) {
    const count = entities.filter((entity) => entity.kind === kind).length;
    if (count < repetitions) {
      throw new Error(`expected ${repetitions} ${kind} matches, got ${count}`);
    }
  }
};

const textPII = [
  "User: no-reply+foo@some.domain.dev",
  "UUID: 550e8400-e29b-41d4-a716-446655440000",
  "Phone: +14155552671",
  "IP: 192.168.0.1",
  "SSN: 123-45-6789",
  "CC: 4242 4242 4242 4242",
  `API: sk_live_${"a".repeat(24)}`,
  "IBAN: GB29 NWBK 6016 1331 9268 19",
  "MAC: 00:1A:2B:3C:4D:5E",
  "JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
  "BTC: 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
  "BIC: DEUTDEFF",
].join(" | ");

bench("extract: PII-heavy (many matches)", () => {
  const entities = piiDuckling.extract(textPII);
  assertPIIMatches(entities);
});

const textNoPII =
  "ordinary prose with punctuation, words, and harmless numbers 42 1088. ".repeat(
    20,
  );

bench("extract: PII long no-match prose", () => {
  const entities = piiDuckling.extract(textNoPII);
  if (entities.length !== 0) throw new Error("unexpected PII match");
});

const defaultDuckling = Duckling();
const textMixed = [
  "Please email me at no-reply+foo@some.domain.dev.",
  "Visit https://duckling.deno.dev/.",
  "We met 2 days ago (on Jan 5, 2022) and it was 20 C.",
  "My IP is 192.168.0.1 and my id is 550e8400-e29b-41d4-a716-446655440000.",
].join(" ");

bench("extract: default Duckling (mixed)", () => {
  setSystemTime(new Date("2022-01-07T12:00:00.000Z"));
  try {
    const entities = defaultDuckling.extract(textMixed);
    if (!entities.some((e) => e.kind === "time")) {
      throw new Error("expected at least one time entity");
    }
  } finally {
    setSystemTime();
  }
});

// ---------------------------------------------------------------------------
// Async benchmarks
// ---------------------------------------------------------------------------

// Compare sync vs async overhead on PII-heavy text
bench("extractAsync: PII-heavy (yieldEvery=512)", async () => {
  const entities = await piiDuckling.extractAsync(textPII, { yieldEvery: 512 });
  assertPIIMatches(entities);
});

bench("extractAsync: PII-heavy (yieldEvery=64)", async () => {
  const entities = await piiDuckling.extractAsync(textPII, { yieldEvery: 64 });
  assertPIIMatches(entities);
});

bench("extractAsync: PII-heavy (yieldEvery=8)", async () => {
  const entities = await piiDuckling.extractAsync(textPII, { yieldEvery: 8 });
  assertPIIMatches(entities);
});

// Large input: 5x repeated PII text (~1 KB)
const textLarge = (textPII + " ").repeat(5);

bench("extract: PII-heavy ×5 (sync)", () => {
  const entities = piiDuckling.extract(textLarge);
  assertPIIMatches(entities, 5);
});

bench("extractAsync: PII-heavy ×5 (yieldEvery=512)", async () => {
  const entities = await piiDuckling.extractAsync(textLarge, {
    yieldEvery: 512,
  });
  assertPIIMatches(entities, 5);
});

bench("extractAsync: PII-heavy ×5 (yieldEvery=64)", async () => {
  const entities = await piiDuckling.extractAsync(textLarge, {
    yieldEvery: 64,
  });
  assertPIIMatches(entities, 5);
});

await run();
