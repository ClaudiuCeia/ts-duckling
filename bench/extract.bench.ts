import { FakeTime } from "@std/testing/time";
import {
  CreditCard,
  Duckling,
  Email,
  IPAddress,
  Phone,
  SSN,
  URL,
  UUID,
} from "../mod.ts";

const piiDuckling = Duckling([
  Email.parser,
  URL.parser,
  UUID.parser,
  Phone.parser,
  IPAddress.parser,
  SSN.parser,
  CreditCard.parser,
]);

const textPII = [
  "User: no-reply+foo@some.domain.dev",
  "Site: https://duckling.deno.dev/ and ftp://example.com/",
  "UUID: 550e8400-e29b-41d4-a716-446655440000",
  "Phone: +14155552671",
  "IP: 192.168.0.1 and 2001:0db8:85a3:0000:0000:8a2e:0370:7334",
  "SSN: 123-45-6789",
  "CC: 4242 4242 4242 4242",
].join(" | ");

Deno.bench("extract: PII-heavy (many matches)", () => {
  const entities = piiDuckling.extract(textPII);
  if (entities.length < 6) throw new Error("unexpected low match count");
});

const defaultDuckling = Duckling();
const textMixed = [
  "Please email me at no-reply+foo@some.domain.dev.",
  "Visit https://duckling.deno.dev/.",
  "We met 2 days ago (on Jan 5, 2022) and it was 20 C.",
  "My IP is 192.168.0.1 and my id is 550e8400-e29b-41d4-a716-446655440000.",
].join(" ");

Deno.bench("extract: default Duckling (mixed)", () => {
  using _time = new FakeTime("2022-01-07T12:00:00.000Z");
  const entities = defaultDuckling.extract(textMixed);
  if (!entities.some((e) => e.kind === "time")) {
    throw new Error("expected at least one time entity");
  }
});
