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
  assertEquals(res[0].value.normalized, "00:1a:2b:3c:4d:5e");
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

Deno.test("MAC with extra octet is rejected", () => {
  // Seven colon-separated pairs — parser must not yield the first six as a prefix
  const res = Duckling([MACAddress.parser]).extract("00:1A:2B:3C:4D:5E:6F");
  assertEquals(res.length, 0);
});

Deno.test("MAC formats reject extra leading and trailing groups", () => {
  for (
    const input of [
      "00-1A-2B-3C-4D-5E-6F",
      "001A.2B3C.4D5E.6F70",
      "00:1A:2B:3C:4D:5E:6F",
    ]
  ) {
    assertEquals(
      Duckling([MACAddress.parser]).extract(input),
      [],
      `expected no match for: ${input}`,
    );
  }
});

Deno.test("MAC parsers still accept common label separators", () => {
  const res = Duckling([MACAddress.parser]).extract(
    "MAC:00:1A:2B:3C:4D:5E MAC-00-1A-2B-3C-4D-5E",
  );
  assertEquals(res.map((entity) => entity.text), [
    "00:1A:2B:3C:4D:5E",
    "00-1A-2B-3C-4D-5E",
  ]);
});

Deno.test("MAC at end of sentence (trailing period) still matches", () => {
  const res = Duckling([MACAddress.parser]).extract(
    "The MAC is 00:1A:2B:3C:4D:5E.",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.normalized, "00:1a:2b:3c:4d:5e");
});

Deno.test("Cisco MAC at end of sentence still matches", () => {
  const res = Duckling([MACAddress.parser]).extract("Use 001A.2B3C.4D5E.");
  assertEquals(res.map((entity) => entity.text), ["001A.2B3C.4D5E"]);
});

Deno.test("MAC in Duckling default parsers", () => {
  const res = Duckling().extract("MAC is 00:1A:2B:3C:4D:5E here");
  assertEquals(
    res.some((e) => e.kind === "mac_address"),
    true,
  );
});
