import { expect, test } from "bun:test";
import { isValidElement, type JSX } from "react";
import { Duckling, Time, URL } from "@claudiu-ceia/ts-duckling";

test("React renderMap example", () => {
  const text = "Review May 18, 2024 at https://example.com";
  const parts = Duckling([Time.parser, URL.parser]).renderMap<JSX.Element>(
    text,
    ({ entity, children }) => (
      <mark key={entity.start} data-kind={entity.kind}>
        {children}
      </mark>
    ),
  );

  expect(parts.filter(isValidElement)).toHaveLength(2);
});
