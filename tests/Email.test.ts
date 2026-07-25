import { assertEquals } from "@std/assert";
import { Duckling, Email } from "../mod.ts";

Deno.test("Email in sentence", () => {
  const res = Duckling().extract(
    "I've never emailed no-reply+foo@some.domain.dev before",
  );

  assertEquals(res, [
    {
      end: 47,
      kind: "email",
      start: 19,
      text: "no-reply+foo@some.domain.dev",
      value: {
        email: "no-reply+foo@some.domain.dev",
      },
    },
  ]);
});

Deno.test("Email with underscore in local part", () => {
  const res = Duckling([Email.parser]).extract(
    "mail user_name@example.com end",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.email, "user_name@example.com");
});

Deno.test("Email minimal address", () => {
  const res = Duckling([Email.parser]).extract("send to a@b.co now");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.email, "a@b.co");
});

Deno.test("Email with subdomain", () => {
  const res = Duckling([Email.parser]).extract("at user@sub.domain.com ok");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.email, "user@sub.domain.com");
});

Deno.test("Email supports practical local parts and domains", () => {
  const input = [
    "first.last@my-company.COM",
    "o'hara@example.com",
    "customer/department=shipping@example.com",
    "user@xn--mnchen-3ya.de",
  ].join(" ");
  const res = Duckling([Email.parser]).extract(input);

  assertEquals(
    res.map((entity) => entity.value.email),
    [
      "first.last@my-company.COM",
      "o'hara@example.com",
      "customer/department=shipping@example.com",
      "user@xn--mnchen-3ya.de",
    ],
  );
});

Deno.test("Email rejects malformed addresses and partial matches", () => {
  const invalid = [
    "@example.com",
    ".user@example.com",
    "user.@example.com",
    "user..name@example.com",
    "user@example-.com",
    `${"a".repeat(65)}@example.com`,
  ];

  for (const input of invalid) {
    assertEquals(Duckling([Email.parser]).extract(input), [], input);
  }
});
