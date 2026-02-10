import { assertEquals } from "@std/assert";
import { Duckling, IPAddress } from "../mod.ts";

Deno.test("IPv4", () => {
  const res = Duckling([IPAddress.parser]).extract("ping 192.168.0.1 please");

  assertEquals(res, [
    {
      start: 5,
      end: 16,
      kind: "ip",
      text: "192.168.0.1",
      value: {
        ip: "192.168.0.1",
        version: 4,
      },
    },
  ]);
});

Deno.test("IPv4 invalid octet does not parse", () => {
  const res = Duckling([IPAddress.parser]).extract("ping 999.1.1.1 please");

  assertEquals(res, []);
});

Deno.test("IPv6 full form", () => {
  const res = Duckling([IPAddress.parser]).extract(
    "addr 2001:0db8:85a3:0000:0000:8a2e:0370:7334 ok",
  );

  assertEquals(res, [
    {
      start: 5,
      end: 44,
      kind: "ip",
      text: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      value: {
        ip: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        version: 6,
      },
    },
  ]);
});

Deno.test("IPv6 compressed loopback ::1", () => {
  const res = Duckling([IPAddress.parser]).extract("lo ::1 ok");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.ip, "::1");
  assertEquals(res[0].value.version, 6);
});

Deno.test("IPv6 compressed 2001:db8::1", () => {
  const res = Duckling([IPAddress.parser]).extract("addr 2001:db8::1 ok");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.ip, "2001:db8::1");
  assertEquals(res[0].value.version, 6);
});

Deno.test("IPv6 compressed fe80::1", () => {
  const res = Duckling([IPAddress.parser]).extract("link fe80::1 ok");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.ip, "fe80::1");
  assertEquals(res[0].value.version, 6);
});

Deno.test("IPv6 compressed all-zeros ::", () => {
  const res = Duckling([IPAddress.parser]).extract("unspecified :: ok");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.ip, "::");
  assertEquals(res[0].value.version, 6);
});
