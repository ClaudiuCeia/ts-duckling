import { assertEquals } from "@std/assert";
import { Duckling, Email, PIIParsers, Quantity, SSN, URL } from "../mod.ts";

const inputs = [
  "Email me at a@b.com",
  "Visit https://example.com/path?q=1",
  "SSN 123-45-6789 and CC 4242 4242 4242 4242",
  "Call +14155552671, IP 192.168.0.1",
  "UUID 550e8400-e29b-41d4-a716-446655440000",
  "",
  "No entities here just plain text",
  "Multiple: a@b.com and c@d.org or +14155552672",
];

for (const input of inputs) {
  Deno.test(`extractAsync matches extract: "${input.slice(0, 50)}…"`, async () => {
    const d = Duckling(PIIParsers);
    const sync = d.extract(input);
    const async_ = await d.extractAsync(input, { yieldEvery: 4 });

    assertEquals(
      async_.map((e) => ({
        kind: e.kind,
        start: e.start,
        end: e.end,
        text: e.text,
      })),
      sync.map((e) => ({
        kind: e.kind,
        start: e.start,
        end: e.end,
        text: e.text,
      })),
    );
  });
}

Deno.test("extractAsync: all parsers match same entities as sync", async () => {
  const d = Duckling();
  // Avoid relative time ("tomorrow") which depends on current time
  const text =
    "Email a@b.com, visit https://x.com on Jan 5, 2022 in Germany. IP: 10.0.0.1";

  const sync = d.extract(text);
  const async_ = await d.extractAsync(text, { yieldEvery: 8 });

  assertEquals(
    async_.map((e) => ({ kind: e.kind, text: e.text })),
    sync.map((e) => ({ kind: e.kind, text: e.text })),
  );
});

Deno.test("extractAsync: custom parser subset", async () => {
  const d = Duckling([Email.parser, URL.parser]);
  const text = "Reach me at a@b.com or https://example.com — ignore 12345";

  const sync = d.extract(text);
  const async_ = await d.extractAsync(text);

  assertEquals(
    async_.map((e) => ({ kind: e.kind, text: e.text })),
    sync.map((e) => ({ kind: e.kind, text: e.text })),
  );
});

Deno.test("extractAsync: respects AbortSignal", async () => {
  const controller = new AbortController();
  controller.abort();

  const d = Duckling();
  let threw = false;
  try {
    await d.extractAsync("some text here", { signal: controller.signal });
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("extractAsync: interleaves with other async work", async () => {
  const log: string[] = [];

  // Schedule a setTimeout(0) that should fire while extractAsync yields
  const sideTask = new Promise<void>((resolve) => {
    setTimeout(() => {
      log.push("side");
      resolve();
    }, 0);
  });

  // Use yieldEvery=1 to force yielding on every position
  const chunk = "Hello world a@b.com end of text";
  const d = Duckling([Email.parser]);
  const extractPromise = d.extractAsync(chunk, { yieldEvery: 1 }).then(
    (result) => {
      log.push("extract");
      return result;
    },
  );

  await Promise.all([extractPromise, sideTask]);

  // The side task should have fired before extract completed
  const sideIdx = log.indexOf("side");
  const extractIdx = log.indexOf("extract");
  if (sideIdx < 0 || extractIdx < 0) {
    throw new Error(`Missing log entries: ${JSON.stringify(log)}`);
  }
  // "side" should appear before "extract" since extractAsync yields
  if (sideIdx >= extractIdx) {
    throw new Error(
      `Side task did not interleave (side=${sideIdx}, extract=${extractIdx}): ${
        JSON.stringify(log)
      }`,
    );
  }
});

Deno.test("renderAsync matches render", async () => {
  const d = Duckling([Email.parser, URL.parser]);
  const text = "Reach a@b.com or https://example.com";
  const fn = (
    { entity, children }: { entity: { kind: string }; children: string },
  ) => `<${entity.kind}>${children}</${entity.kind}>`;

  const sync = d.render(text, fn);
  const async_ = await d.renderAsync(text, fn, { yieldEvery: 4 });

  assertEquals(async_, sync);
});

Deno.test("renderMapAsync matches renderMap", async () => {
  const d = Duckling([Email.parser, URL.parser]);
  const text = "Reach a@b.com or https://example.com";
  const fn = (
    { entity, children }: {
      entity: { kind: string };
      children: (string | string)[];
    },
  ) => `[${entity.kind}:${children.join("")}]`;

  const sync = d.renderMap(text, fn);
  const async_ = await d.renderMapAsync(text, fn, { yieldEvery: 4 });

  assertEquals(async_, sync);
});

Deno.test("extractAsync: handles nested entities (SSN + Quantity)", async () => {
  const d = Duckling([Quantity.parser, SSN.parser]);
  const text = "SSN 123-45-6789";

  const sync = d.extract(text);
  const async_ = await d.extractAsync(text, { yieldEvery: 2 });

  assertEquals(
    async_.map((e) => ({ kind: e.kind, start: e.start, end: e.end })),
    sync.map((e) => ({ kind: e.kind, start: e.start, end: e.end })),
  );
});

Deno.test("extractAsync: large repeated input produces same results", async () => {
  const chunk = "Email a@b.com and visit https://x.com. ";
  const text = chunk.repeat(50); // ~2000 chars

  const d = Duckling([Email.parser, URL.parser]);
  const sync = d.extract(text);
  const async_ = await d.extractAsync(text, { yieldEvery: 64 });

  assertEquals(async_.length, sync.length);
  assertEquals(
    async_.map((e) => ({ kind: e.kind, text: e.text })),
    sync.map((e) => ({ kind: e.kind, text: e.text })),
  );
});

Deno.test("extractAsync: empty input returns empty array", async () => {
  const d = Duckling();
  const result = await d.extractAsync("");
  assertEquals(result, []);
});
