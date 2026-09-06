import { expect, test } from "bun:test";
import { defineLanguage, map, regex } from "@claudiu-ceia/combine";
import {
  Duckling,
  Email,
  ent,
  type Entity,
  PIIParsers,
  Time,
  URL,
} from "@claudiu-ceia/ts-duckling";

const primaryText =
  "The review is on May 18, 2024. Notes are at https://example.com/brief and contact alex@company.io";

const primaryOutput = [
  'time [17, 29) May 18, 2024 {"when":{"type":"date","year":2024,"month":5,"day":18},"grain":"day","era":"CE"}',
  'url [44, 69) https://example.com/brief {"url":"https://example.com/brief"}',
  'email [82, 97) alex@company.io {"email":"alex@company.io"}',
].join("\n");

test("primary extraction example and documented output", async () => {
  const entities = Duckling([Time.parser, URL.parser, Email.parser]).extract(
    primaryText,
  );
  const output = entities
    .map(
      (entity) =>
        `${entity.kind} [${entity.start}, ${entity.end}) ${entity.text} ${JSON.stringify(entity.value)}`,
    )
    .join("\n");

  expect(output).toBe(primaryOutput);
  expect(await Bun.file("README.md").text()).toContain(primaryOutput);
});

test("selected parser and cooperative async examples", async () => {
  const duckling = Duckling([Time.parser, URL.parser]);
  const text = "Review May 18, 2024 at https://example.com";

  expect(await duckling.extractAsync(text)).toEqual(duckling.extract(text));
});

test("rendering examples", () => {
  const text = "Review May 18, 2024 at https://example.com";
  const parts = Duckling([Time.parser, URL.parser]).renderMap(
    text,
    ({ entity, children }) => ({ kind: entity.kind, children }),
  );

  expect(parts).toHaveLength(4);
  expect(parts[1]).toEqual({
    kind: "time",
    children: ["May 18, 2024"],
  });
  expect(parts[3]).toEqual({
    kind: "url",
    children: ["https://example.com"],
  });
});

test("sensitive value redaction example", () => {
  const scrubbed = Duckling(PIIParsers).redact("Email alex@company.io");
  expect(scrubbed).toBe("Email ███████████████");
});

type HashtagEntity = Entity<"hashtag", { tag: string }>;

const Hashtag = defineLanguage<{
  Full: HashtagEntity;
  parser: HashtagEntity;
}>({
  Full: () =>
    map(regex(/#[A-Za-z0-9_]{2,64}/, "hashtag"), (match, before, after) =>
      ent({ tag: match.slice(1) }, "hashtag", before, after),
    ),
  parser: (symbol) => symbol.Full,
});

test("custom entity example", () => {
  expect(Duckling([Hashtag.parser]).extract("Ship #duckling")).toEqual([
    {
      kind: "hashtag",
      value: { tag: "duckling" },
      start: 5,
      end: 14,
      text: "#duckling",
    },
  ]);
});
