import { assertEquals } from "@std/assert";
import { Duckling, MACAddress } from "../mod.ts";

Deno.test("MAC address colon-separated", () => {
  const res = Duckling([MACAddress.parser]).extract(
    "device 00:1A:2B:3C:4D:5E connected",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].kind, "mac_address");
  assertEquals(res[0].text, "00:1A:2B:3C:4D:5E");
  assertEquals(res[0].value.normalized, "00:1a:2b:3c:4d:5e");
});

Deno.test("MAC address hyphen-separated", () => {
  const res = Duckling([MACAddress.parser]).extract(
    "device 00-1A-2B-3C-4D-5E connected",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].text, "00-1A-2B-3C-4D-5E");
  assertEquals(res[0].value.normalized, "00:1a:2b:3c:4d:5e");
});

Deno.test("MAC address Cisco dot notation", () => {
  const res = Duckling([MACAddress.parser]).extract(
    "interface 001A.2B3C.4D5E up",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].text, "001A.2B3C.4D5E");
  assertEquals(res[0].value.normalized, "001a:2b3c:4d5e");
});

Deno.test("MAC address lowercase", () => {
  const res = Duckling([MACAddress.parser]).extract("mac aa:bb:cc:dd:ee:ff ok");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.normalized, "aa:bb:cc:dd:ee:ff");
});

Deno.test("MAC not enough octets rejected", () => {
  const res = Duckling([MACAddress.parser]).extract("bad 00:1A:2B:3C:4D ok");
  assertEquals(res.length, 0);
});

Deno.test("MAC in Duckling default parsers", () => {
  const res = Duckling().extract("MAC is 00:1A:2B:3C:4D:5E here");
  assertEquals(
    res.some((e) => e.kind === "mac_address"),
    true,
  );
});
