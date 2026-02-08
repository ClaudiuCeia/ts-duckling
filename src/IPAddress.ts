import {
  any,
  Context,
  createLanguageThis,
  map,
  regex,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import { guard } from "./guard.ts";

export type IPAddressEntity = Entity<
  "ip",
  {
    ip: string;
    version: 4 | 6;
  }
>;

export const ipAddress = (
  value: IPAddressEntity["value"],
  before: Context,
  after: Context,
): IPAddressEntity => {
  return ent(value, "ip", before, after);
};

const isValidIPv4 = (s: string): boolean => {
  const parts = s.split(".");
  if (parts.length !== 4) return false;
  for (const p of parts) {
    if (p.length < 1 || p.length > 3) return false;
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return false;
  }
  return true;
};

const isValidIPv6Full = (s: string): boolean => {
  // Deterministic "full" form only: 8 groups, no "::" compression.
  const parts = s.split(":");
  if (parts.length !== 8) return false;
  for (const p of parts) {
    if (p.length < 1 || p.length > 4) return false;
    if (!/^[0-9a-fA-F]+$/.test(p)) return false;
  }
  return true;
};

type IPAddressLanguage = {
  IPv4: () => Parser<string>;
  IPv6: () => Parser<string>;
  Full: () => Parser<IPAddressEntity>;
  Full6: () => Parser<IPAddressEntity>;
  parser: () => Parser<IPAddressEntity>;
};

export const IPAddress = createLanguageThis<IPAddressLanguage>({
  IPv4(): Parser<string> {
    return guard(regex(/\d{1,3}(?:\.\d{1,3}){3}/, "ipv4"), isValidIPv4, "ipv4");
  },
  IPv6(): Parser<string> {
    return guard(
      regex(/[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){7}/, "ipv6"),
      isValidIPv6Full,
      "ipv6",
    );
  },
  Full(): Parser<IPAddressEntity> {
    return map(
      this.IPv4,
      (ip, b, a) =>
        ipAddress(
          {
            ip,
            version: 4,
          },
          b,
          a,
        ),
    );
  },
  Full6(): Parser<IPAddressEntity> {
    return map(
      this.IPv6,
      (ip, b, a) =>
        ipAddress(
          {
            ip,
            version: 6,
          },
          b,
          a,
        ),
    );
  },
  parser(): Parser<IPAddressEntity> {
    return dot(any(this.Full, this.Full6));
  },
});
