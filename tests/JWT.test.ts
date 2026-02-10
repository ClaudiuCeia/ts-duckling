import { assertEquals } from "@std/assert";
import { Duckling, JWT } from "../mod.ts";

// A well-known test JWT (HS256, sub=1234567890)
const TEST_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";

Deno.test("JWT valid token", () => {
  const res = Duckling([JWT.parser]).extract(`token: ${TEST_JWT} end`);
  assertEquals(res.length, 1);
  assertEquals(res[0].kind, "jwt");
  assertEquals(res[0].value.jwt, TEST_JWT);
  assertEquals(res[0].value.header?.alg, "HS256");
  assertEquals(res[0].value.header?.typ, "JWT");
});

Deno.test("JWT extracts header fields", () => {
  // RS256 token header: {"alg":"RS256","typ":"JWT"}
  const rs256 =
    "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123def456";
  const res = Duckling([JWT.parser]).extract(rs256);
  assertEquals(res.length, 1);
  assertEquals(res[0].value.header?.alg, "RS256");
});

Deno.test("JWT rejects non-JWT base64", () => {
  // Does not start with eyJ and has no alg/typ
  const res = Duckling([JWT.parser]).extract(
    "data: aGVsbG8.d29ybGQ.Zm9vYmFy end",
  );
  assertEquals(res.length, 0);
});

Deno.test("JWT rejects two-segment string", () => {
  // Only two segments, not a valid JWT
  const res = Duckling([JWT.parser]).extract(
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0 end",
  );
  assertEquals(res.length, 0);
});

Deno.test("JWT in Duckling default parsers", () => {
  const res = Duckling().extract(`Bearer ${TEST_JWT}`);
  assertEquals(
    res.some((e) => e.kind === "jwt"),
    true,
  );
});
