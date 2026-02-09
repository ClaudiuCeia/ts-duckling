import { assertEquals } from "@std/assert";
import { Duckling } from "../mod.ts";

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
