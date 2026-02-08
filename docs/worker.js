// deno-lint-ignore-file no-import-prefix
import {
  CreditCard,
  Duckling,
  Email,
  Institution,
  IPAddress,
  Language,
  Location,
  Phone,
  Quantity,
  Range,
  SSN,
  Temperature,
  Time,
  URL,
  UUID,
} from "https://esm.sh/gh/ClaudiuCeia/ts-duckling@main/mod.ts";

const registry = {
  Range: Range.parser,
  Time: Time.parser,
  Temperature: Temperature.parser,
  Quantity: Quantity.parser,
  Location: Location.parser,
  URL: URL.parser,
  Email: Email.parser,
  Institution: Institution.parser,
  Language: Language.parser,
  Phone: Phone.parser,
  IPAddress: IPAddress.parser,
  SSN: SSN.parser,
  CreditCard: CreditCard.parser,
  UUID: UUID.parser,
};

self.onmessage = (ev) => {
  const msg = ev.data;
  if (!msg || msg.type !== "extract") return;

  const { reqId, text, ids, maxChars } = msg;
  const source = typeof text === "string" ? text : "";
  const max = Number.isFinite(maxChars) ? Math.max(0, Math.trunc(maxChars)) : 0;
  const truncated = max > 0 && source.length > max;
  const input = truncated ? source.slice(0, max) : source;

  const parsers = Array.isArray(ids)
    ? ids.map((id) => registry[id]).filter(Boolean)
    : [];

  const t0 = performance.now();
  const res = Duckling(parsers).extract({ text: input, index: 0 });
  const ms = performance.now() - t0;

  const entities = res.success ? res.value : [];
  self.postMessage({
    type: "result",
    reqId,
    entities,
    ms,
    truncated,
    length: input.length,
  });
};
