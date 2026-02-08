import { assertEquals } from "@std/assert";
import { Duckling, IPAddress } from "../mod.ts";

Deno.test("IPv4", () => {
  const res = Duckling([IPAddress.parser]).extract({
    text: "ping 192.168.0.1 please",
    index: 0,
  });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, [
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
  }
});

Deno.test("IPv4 invalid octet does not parse", () => {
  const res = Duckling([IPAddress.parser]).extract({
    text: "ping 999.1.1.1 please",
    index: 0,
  });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, []);
  }
});

Deno.test("IPv6 full form", () => {
  const res = Duckling([IPAddress.parser]).extract({
    text: "addr 2001:0db8:85a3:0000:0000:8a2e:0370:7334 ok",
    index: 0,
  });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, [
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
  }
});
