import {
  any,
  createLanguage,
  either,
  eof,
  manyTill,
  map,
  skip1,
  seq,
} from "https://deno.land/x/combine@v0.0.5/mod.ts";
import { space } from "../combine/src/parsers.ts";
import { word, __, dot } from "./src/common.ts";
import { Temperature } from "./src/Temperature.ts";

export const Duckling = createLanguage({
  Entity: () => any(Temperature.Exact),
  Unstructured: () => either(dot(__(word)), __(word)),
  Extract: (s) =>
    map(
      seq(
        space(),
        map(
          manyTill(any(s.Entity, skip1(s.Unstructured)), skip1(eof())),
          ([...matches]) => {
            return matches.filter((m) => !!m);
          }
        )
      ),
      ([, res]) => res
    ),
});
