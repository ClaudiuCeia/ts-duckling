import { bench, run } from "mitata";
import { Duckling, Language, Location, URL } from "../mod.ts";

const cases = [
  {
    name: "Language positive",
    extract: Duckling([Language.parser]).extract,
    input: "Traditional Mandarin Chinese",
    expected: 1,
  },
  {
    name: "Language negative",
    extract: Duckling([Language.parser]).extract,
    input: "zzzzzzzzzzzzzzzz",
    expected: 0,
  },
  {
    name: "Location positive",
    extract: Duckling([Location.parser]).extract,
    input: "Falkland Islands (Islas Malvinas)",
    expected: 1,
  },
  {
    name: "Location negative",
    extract: Duckling([Location.parser]).extract,
    input: "zzzzzzzzzzzzzzzz",
    expected: 0,
  },
  {
    name: "URL positive",
    extract: Duckling([URL.parser]).extract,
    input: "service.community",
    expected: 1,
  },
  {
    name: "URL negative",
    extract: Duckling([URL.parser]).extract,
    input: "service.notavalidtld",
    expected: 0,
  },
] as const;

for (const benchmark of cases) {
  bench(`generated vocabulary: ${benchmark.name}`, () => {
    const entities = benchmark.extract(benchmark.input);
    if (entities.length !== benchmark.expected) {
      throw new Error(`expected ${benchmark.expected} entities`);
    }
  });
}

await run();
