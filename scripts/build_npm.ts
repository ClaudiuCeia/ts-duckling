import { build, emptyDir } from "@deno/dnt";

const denoJson = JSON.parse(await Deno.readTextFile("./deno.json")) as {
  version: string;
};

await emptyDir("./npm");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  importMap: "deno.json",
  test: false,
  esModule: true,
  scriptModule: false,
  typeCheck: "single",
  compilerOptions: {
    target: "ES2022",
    lib: ["ES2022", "DOM"],
    sourceMap: false,
    inlineSources: false,
  },
  shims: {
    deno: false,
    weakRef: false,
    webSocket: false,
    blob: false,
    crypto: false,
    domException: false,
    fetch: false,
    file: false,
    fileReader: false,
    formData: false,
    headers: false,
    httpClient: false,
    readFile: false,
    timers: false,
    url: false,
    urlSearchParams: false,
  },
  package: {
    name: "@claudiu-ceia/ts-duckling",
    version: denoJson.version,
    description: "A tiny, deterministic entity extractor for TypeScript.",
    license: "MIT",
    keywords: [
      "entity-extraction",
      "parser",
      "pii",
      "redaction",
      "typescript",
    ],
    repository: {
      type: "git",
      url: "git+https://github.com/ClaudiuCeia/ts-duckling.git",
    },
    bugs: {
      url: "https://github.com/ClaudiuCeia/ts-duckling/issues",
    },
    homepage: "https://github.com/ClaudiuCeia/ts-duckling#readme",
    engines: {
      node: ">=18",
    },
  },
  postBuild() {
    Deno.copyFileSync("README.md", "npm/README.md");
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("THIRD_PARTY_NOTICES.md", "npm/THIRD_PARTY_NOTICES.md");
    Deno.writeTextFileSync(
      "npm/.npmignore",
      [
        "/src/",
        "**/*.d.ts.map",
        "**/*.js.map",
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
      ].join("\n") + "\n",
    );
  },
});
