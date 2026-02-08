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

type IPAddressLanguage = {
  IPv4: () => Parser<string>;
  IPv6: () => Parser<string>;
  Full: () => Parser<IPAddressEntity>;
  Full6: () => Parser<IPAddressEntity>;
  parser: () => Parser<IPAddressEntity>;
};

export const IPAddress = createLanguageThis<IPAddressLanguage>({
  IPv4(): Parser<string> {
    // 0-255
    return regex(
      /(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}/,
      "ipv4",
    );
  },
  IPv6(): Parser<string> {
    // Deterministic "full" form only: 8 groups, no "::" compression.
    return regex(/[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){7}/, "ipv6");
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
