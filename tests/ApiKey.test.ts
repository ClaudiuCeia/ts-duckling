import { assertEquals } from "@std/assert";
import { ApiKey } from "../src/ApiKey.ts";

const parseAtToken = (text: string, token: string) => {
  const index = text.indexOf(token);
  if (index === -1) {
    throw new Error(`Token not found in text: ${token}`);
  }
  return ApiKey.parser({ text, index });
};

Deno.test("ApiKey: Stripe sk_live_", () => {
  const token = `sk_live_${"a".repeat(24)}`;
  const text = `use ${token} please`;
  const res = parseAtToken(text, token);

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value.kind, "api_key");
    assertEquals(res.value.text, token);
    assertEquals(res.value.value.provider, "stripe");
    assertEquals(res.value.value.key, token);
  }
});

Deno.test("ApiKey: OpenAI sk-proj- wins over sk-", () => {
  const token = `sk-proj-${"b".repeat(24)}`;
  const text = `hello ${token} world`;
  const res = parseAtToken(text, token);

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value.value.provider, "openai");
    assertEquals(res.value.value.key, token);
    assertEquals(res.value.text.startsWith("sk-proj-"), true);
  }
});

Deno.test("ApiKey: Anthropic sk-ant-api03-", () => {
  const token = `sk-ant-api03-${"c".repeat(24)}`;
  const text = `${token}`; // EOF boundary should be accepted.
  const res = parseAtToken(text, token);

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value.value.provider, "anthropic");
    assertEquals(res.value.value.key, token);
  }
});

Deno.test("ApiKey: GitHub ghp_", () => {
  const token = `ghp_${"d".repeat(32)}`;
  const text = `token=${token};`;
  const res = parseAtToken(text, token);

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value.value.provider, "github");
    assertEquals(res.value.value.key, token);
  }
});

Deno.test("ApiKey: GitLab glpat-", () => {
  const token = `glpat-${"e".repeat(24)}`;
  const text = `Bearer ${token} `;
  const res = parseAtToken(text, token);

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value.value.provider, "gitlab");
    assertEquals(res.value.value.key, token);
  }
});

Deno.test("ApiKey: Slack xoxb-", () => {
  const token = `xoxb-${"f".repeat(30)}`;
  const text = `slack=${token}\n`;
  const res = parseAtToken(text, token);

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value.value.provider, "slack");
    assertEquals(res.value.value.key, token);
  }
});

Deno.test("ApiKey: AWS access key id AKIA...", () => {
  const token = `AKIA${"G".repeat(16)}`;
  const text = `aws ${token} ok`;
  const res = parseAtToken(text, token);

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value.value.provider, "aws");
    assertEquals(res.value.value.key, token);
  }
});

Deno.test("ApiKey: Google API key AIza...", () => {
  const token = `AIza${"h".repeat(32)}`;
  const text = `key: ${token} `;
  const res = parseAtToken(text, token);

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value.value.provider, "google");
    assertEquals(res.value.value.key, token);
  }
});

Deno.test("ApiKey: SendGrid SG. token", () => {
  const token = `SG.${"i".repeat(10)}.${"j".repeat(20)}`;
  const text = `sendgrid=${token} `;
  const res = parseAtToken(text, token);

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value.value.provider, "sendgrid");
    assertEquals(res.value.value.key, token);
  }
});

Deno.test("ApiKey: does not match too-short body", () => {
  const token = "ghp_1234567"; // 7 chars body, min is 8
  const text = `${token} `;
  const res = parseAtToken(text, token);

  assertEquals(res.success, false);
});

Deno.test("ApiKey: does not include trailing punctuation", () => {
  const token = `sk_test_${"k".repeat(16)}`;
  const text = `${token};`; // ';' is not part of the body; should stop before it.
  const res = parseAtToken(text, token);

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value.text, token);
    assertEquals(res.value.value.provider, "stripe");
    assertEquals(res.value.value.key, token);
  }
});
