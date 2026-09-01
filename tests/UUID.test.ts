import { assertEquals } from "@std/assert";
import { Duckling, UUID } from "../mod.ts";

Deno.test("UUID", () => {
  const res = Duckling().extract(
    "id 550e8400-e29b-41d4-a716-446655440000 ok",
  );

  assertEquals(res, [
    {
      start: 3,
      end: 39,
      kind: "uuid",
      text: "550e8400-e29b-41d4-a716-446655440000",
      value: {
        uuid: "550e8400-e29b-41d4-a716-446655440000",
      },
    },
  ]);
});

Deno.test("UUID with extra hyphen section is rejected", () => {
  // A valid UUID followed by "-dead" must not yield the UUID prefix
  const res = Duckling([UUID.parser]).extract(
    "550e8400-e29b-41d4-a716-446655440000-dead",
  );
  assertEquals(res, []);
});

Deno.test("UUID after an extra hyphen section is rejected", () => {
  const res = Duckling([UUID.parser]).extract(
    "dead-550e8400-e29b-41d4-a716-446655440000",
  );
  assertEquals(res, []);
});

Deno.test("UUID at end of sentence (trailing period) still matches", () => {
  const res = Duckling().extract(
    "The ID is 550e8400-e29b-41d4-a716-446655440000.",
  );
  assertEquals(
    res.some((e) => e.kind === "uuid"),
    true,
  );
});
