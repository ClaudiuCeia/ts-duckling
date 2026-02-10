/// <reference lib="webworker" />
import type { Parser } from "@claudiu-ceia/combine";
import {
  Duckling,
  Range,
  Time,
  Temperature,
  Quantity,
  Location,
  URL,
  Email,
  Institution,
  Language,
  Phone,
  IPAddress,
  SSN,
  CreditCard,
  UUID,
  ApiKey,
} from "@claudiu-ceia/ts-duckling";
import type { WorkerRequest, WorkerResponse } from "./types";

// deno-lint-ignore no-explicit-any
const registry: Record<string, Parser<any>> = {
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
  ApiKey: ApiKey.parser,
};

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
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
  const entities = parsers.length > 0
    ? Duckling(parsers).extract(input)
    : Duckling().extract(input);
  const ms = performance.now() - t0;

  self.postMessage({
    type: "result",
    reqId,
    entities,
    ms,
    truncated,
    length: input.length,
  } satisfies WorkerResponse);
};
