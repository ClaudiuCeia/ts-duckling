import { assertEquals } from "@std/assert";
import {
  Duckling,
  Email,
  PIIParsers,
  Quantity,
  SSN,
  URL,
  UUID,
} from "../mod.ts";

// ── Basic behaviour ─────────────────────────────────────────────────

Deno.test("render: returns input unchanged when callback returns undefined", () => {
  const input = "Email me at foo@bar.com";
  const result = Duckling([Email.parser]).render(input, () => undefined);
  assertEquals(result, input);
});

Deno.test("render: returns input unchanged when no entities found", () => {
  const input = "no entities here";
  const result = Duckling([Email.parser]).render(
    input,
    ({ entity }) => `[${entity.kind}]`,
  );
  assertEquals(result, input);
});

Deno.test("render: wraps entity in brackets", () => {
  const result = Duckling([Email.parser]).render(
    "Contact foo@bar.com please",
    ({ entity }) => `[${entity.kind}]`,
  );
  assertEquals(result, "Contact [email] please");
});

Deno.test("render: wraps entity in HTML tags", () => {
  const result = Duckling([Email.parser]).render(
    "Email me at a@b.com",
    ({ entity, children }) =>
      `<mark data-kind="${entity.kind}">${children}</mark>`,
  );
  assertEquals(result, 'Email me at <mark data-kind="email">a@b.com</mark>');
});

// ── Multiple entities ───────────────────────────────────────────────

Deno.test("render: handles multiple entities", () => {
  const result = Duckling([Email.parser, URL.parser]).render(
    "Reach a@b.com or https://example.com",
    ({ entity }) => `[${entity.kind}]`,
  );
  assertEquals(result, "Reach [email] or [url]");
});

Deno.test("render: selective rendering — only transform specific kinds", () => {
  const result = Duckling([Email.parser, URL.parser]).render(
    "Reach a@b.com or https://example.com",
    ({ entity, children }) => {
      if (entity.kind === "url") return `<a href="${children}">${children}</a>`;
      return children; // leave email as-is
    },
  );
  assertEquals(
    result,
    'Reach a@b.com or <a href="https://example.com">https://example.com</a>',
  );
});

// ── Nested entity rendering (tree-based) ────────────────────────────

Deno.test("render: SSN with nested quantities — flat render masks whole SSN", () => {
  const result = Duckling([Quantity.parser, SSN.parser]).render(
    "SSN 123-45-6789",
    ({ entity }) => {
      if (entity.kind === "ssn") return "[REDACTED]";
      // quantity sub-parts won't be reached — SSN is the outer span
      return undefined;
    },
  );
  assertEquals(result, "SSN [REDACTED]");
});

Deno.test("render: SSN with nested quantities — nested rendering wraps both", () => {
  const result = Duckling([Quantity.parser, SSN.parser]).render(
    "SSN 123-45-6789",
    ({ entity, children }) => `<${entity.kind}>${children}</${entity.kind}>`,
  );
  assertEquals(
    result,
    "SSN <ssn><quantity>123</quantity>-<quantity>45</quantity>-<quantity>6789</quantity></ssn>",
  );
});

Deno.test("render: nested children text is passed pre-rendered", () => {
  // When rendering an SSN, `children` should already have the inner
  // quantities rendered
  const calls: { kind: string; children: string }[] = [];
  Duckling([Quantity.parser, SSN.parser]).render(
    "SSN 123-45-6789",
    ({ entity, children }) => {
      calls.push({ kind: entity.kind, children });
      return `[${entity.kind}]`;
    },
  );

  const ssnCall = calls.find((c) => c.kind === "ssn");
  assertEquals(ssnCall !== undefined, true);
  // The SSN's children should contain the rendered quantities
  assertEquals(ssnCall!.children, "[quantity]-[quantity]-[quantity]");
});

// ── Edge cases ──────────────────────────────────────────────────────

Deno.test("render: empty input", () => {
  const result = Duckling([Email.parser]).render(
    "",
    ({ entity }) => `[${entity.kind}]`,
  );
  assertEquals(result, "");
});

Deno.test("render: entity at start of string", () => {
  const result = Duckling([Email.parser]).render(
    "a@b.com is my email",
    ({ entity }) => `[${entity.kind}]`,
  );
  assertEquals(result, "[email] is my email");
});

Deno.test("render: entity at end of string", () => {
  const result = Duckling([Email.parser]).render(
    "my email is a@b.com",
    ({ entity }) => `[${entity.kind}]`,
  );
  assertEquals(result, "my email is [email]");
});

Deno.test("render: entire input is one entity", () => {
  const result = Duckling([Email.parser]).render(
    "a@b.com",
    ({ entity }) => `[${entity.kind}]`,
  );
  assertEquals(result, "[email]");
});

Deno.test("render: replacement longer than original", () => {
  const result = Duckling([Email.parser]).render(
    "a@b.com",
    ({ entity }) => `[REDACTED_${entity.kind.toUpperCase()}_ADDRESS]`,
  );
  assertEquals(result, "[REDACTED_EMAIL_ADDRESS]");
});

Deno.test("render: replacement shorter than original", () => {
  const result = Duckling([UUID.parser]).render(
    "id: 550e8400-e29b-41d4-a716-446655440000",
    () => "***",
  );
  assertEquals(result, "id: ***");
});

Deno.test("render: replacement is empty string", () => {
  const result = Duckling([Email.parser]).render(
    "Contact a@b.com please",
    () => "",
  );
  assertEquals(result, "Contact  please");
});

// ── Composability with PIIParsers ───────────────────────────────────

Deno.test("render: PIIParsers — mask only emails, linkify nothing", () => {
  const result = Duckling(PIIParsers).render(
    "Email foo@bar.com, phone +14155552671",
    ({ entity }) => `[${entity.kind.toUpperCase()}]`,
  );
  assertEquals(result, "Email [EMAIL], phone [PHONE]");
});

// ── Redact is consistent with render ────────────────────────────────

Deno.test("render: can replicate redact behaviour", () => {
  const input = "Contact foo@bar.com, SSN 123-45-6789";
  const mask = "█";

  const redacted = Duckling(PIIParsers).redact(input);
  const rendered = Duckling(PIIParsers).render(
    input,
    ({ entity }) => mask.repeat(entity.end - entity.start),
  );

  assertEquals(rendered, redacted);
});

// ── renderMap: generic segment-based rendering ──────────────────────

Deno.test("renderMap: returns segments with plain text and mapped entities", () => {
  type Tag = { tag: string; text: string };

  const segments = Duckling([Email.parser]).renderMap<Tag>(
    "Contact a@b.com please",
    ({ entity }) => ({ tag: entity.kind, text: entity.text }),
  );

  assertEquals(segments, [
    "Contact ",
    { tag: "email", text: "a@b.com" },
    " please",
  ]);
});

Deno.test("renderMap: returns single-element array for no entities", () => {
  const segments = Duckling([Email.parser]).renderMap<string>(
    "no entities here",
    ({ entity }) => `[${entity.kind}]`,
  );
  assertEquals(segments, ["no entities here"]);
});

Deno.test("renderMap: entity at start", () => {
  type Tag = { kind: string };
  const segments = Duckling([Email.parser]).renderMap<Tag>(
    "a@b.com is mine",
    ({ entity }) => ({ kind: entity.kind }),
  );
  assertEquals(segments, [{ kind: "email" }, " is mine"]);
});

Deno.test("renderMap: entity at end", () => {
  type Tag = { kind: string };
  const segments = Duckling([Email.parser]).renderMap<Tag>(
    "email: a@b.com",
    ({ entity }) => ({ kind: entity.kind }),
  );
  assertEquals(segments, ["email: ", { kind: "email" }]);
});

Deno.test("renderMap: entire input is one entity", () => {
  type Tag = { kind: string };
  const segments = Duckling([Email.parser]).renderMap<Tag>(
    "a@b.com",
    ({ entity }) => ({ kind: entity.kind }),
  );
  assertEquals(segments, [{ kind: "email" }]);
});

Deno.test("renderMap: multiple entities produce interleaved segments", () => {
  type Tag = { kind: string };
  const segments = Duckling([Email.parser, URL.parser]).renderMap<Tag>(
    "Reach a@b.com or https://example.com",
    ({ entity }) => ({ kind: entity.kind }),
  );
  assertEquals(segments, [
    "Reach ",
    { kind: "email" },
    " or ",
    { kind: "url" },
  ]);
});

Deno.test("renderMap: nested entities — children are segments", () => {
  // When SSN wraps quantities, children should be (string | R)[]
  type Tag = { kind: string; children: (string | Tag)[] };
  const segments = Duckling([Quantity.parser, SSN.parser]).renderMap<Tag>(
    "SSN 123-45-6789",
    ({ entity, children }) => ({ kind: entity.kind, children }),
  );

  // The outer array should be ["SSN ", <ssn-tag>]
  assertEquals(segments.length, 2);
  assertEquals(segments[0], "SSN ");

  const ssn = segments[1] as Tag;
  assertEquals(ssn.kind, "ssn");

  // SSN's children should contain quantity tags interleaved with dashes
  const childKinds = ssn.children
    .filter((c): c is Tag => typeof c !== "string")
    .map((c) => c.kind);
  assertEquals(childKinds, ["quantity", "quantity", "quantity"]);

  const childStrings = ssn.children.filter((c) => typeof c === "string");
  assertEquals(childStrings, ["-", "-"]);
});

Deno.test("renderMap: children array passed to callback for leaf entities", () => {
  // A leaf entity (no nested children) should receive children = [entity.text]
  const calls: { kind: string; children: (string | unknown)[] }[] = [];

  Duckling([Email.parser]).renderMap<string>(
    "hi a@b.com",
    ({ entity, children }) => {
      calls.push({ kind: entity.kind, children: [...children] });
      return `[${entity.kind}]`;
    },
  );

  assertEquals(calls.length, 1);
  assertEquals(calls[0].kind, "email");
  // Leaf entity: children is the raw text as a single string segment
  assertEquals(calls[0].children, ["a@b.com"]);
});

Deno.test("renderMap: can be used to implement render (join segments)", () => {
  const input = "Contact a@b.com please";

  const rendered = Duckling([Email.parser]).render(
    input,
    ({ entity, children }) =>
      `<mark data-kind="${entity.kind}">${children}</mark>`,
  );

  const segments = Duckling([Email.parser]).renderMap<string>(
    input,
    ({ entity, children }) =>
      `<mark data-kind="${entity.kind}">${children.join("")}</mark>`,
  );

  assertEquals(segments.join(""), rendered);
});
