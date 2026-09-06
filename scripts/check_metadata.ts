export {};

const packageJson = await Bun.file("package.json").json();
const denoJson = await Bun.file("deno.json").json();
const playgroundJson = await Bun.file("docs/package.json").json();

if (packageJson.version !== denoJson.version) {
  throw new Error(
    `package.json version ${packageJson.version} does not match deno.json version ${denoJson.version}`,
  );
}

const npmCombine = packageJson.dependencies?.["@claudiu-ceia/combine"];
const jsrCombine = denoJson.imports?.["@claudiu-ceia/combine"];
const playgroundCombine =
  playgroundJson.dependencies?.["@claudiu-ceia/combine"];
const jsrVersion = /^jsr:@claudiu-ceia\/combine@(.+)$/.exec(jsrCombine)?.[1];

if (
  !npmCombine ||
  !jsrVersion ||
  npmCombine !== jsrVersion ||
  npmCombine !== playgroundCombine
) {
  throw new Error(
    `Combine dependency mismatch: npm=${String(npmCombine)}, JSR=${String(jsrCombine)}, playground=${String(playgroundCombine)}`,
  );
}

const readme = await Bun.file("README.md").text();
const example = await Bun.file("examples/readme.test.ts").text();
const packageImport = 'from "@claudiu-ceia/ts-duckling"';

if (!readme.includes(packageImport) || !example.includes(packageImport)) {
  throw new Error("README examples must use the released package entrypoint");
}

const prose = readme.replace(/```[\s\S]*?```/g, "").replace(/<[^>]+>/g, "");
const forbiddenPresentationCopy = [
  "tiny",
  "runs everywhere",
  "perfect for",
  "great fit",
  "rich highlights",
  "real-time",
  "same input always produces the same output",
  "no ML",
  "Times Square",
];

for (const phrase of forbiddenPresentationCopy) {
  if (prose.toLowerCase().includes(phrase.toLowerCase())) {
    throw new Error(`README contains forbidden presentation copy: ${phrase}`);
  }
}

if (/[—–;]/u.test(prose)) {
  throw new Error("README prose must not contain dash glyphs or semicolons");
}

console.log(
  `metadata aligned at ${packageJson.version} with Combine ${npmCombine}`,
);
