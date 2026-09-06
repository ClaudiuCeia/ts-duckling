export {};

const packageJson = await Bun.file("package.json").json();
const denoJson = await Bun.file("deno.json").json();
const playgroundJson = await Bun.file("docs/package.json").json();

if (packageJson.version !== denoJson.version) {
  throw new Error(
    `package.json version ${packageJson.version} does not match deno.json version ${denoJson.version}`,
  );
}

const npmVersion = packageJson.dependencies?.["@claudiu-ceia/combine"];
const jsrSpecifier = denoJson.imports?.["@claudiu-ceia/combine"];
const playgroundVersion =
  playgroundJson.dependencies?.["@claudiu-ceia/combine"];
const jsrVersion = /^jsr:@claudiu-ceia\/combine@(.+)$/.exec(jsrSpecifier)?.[1];

if (
  !npmVersion ||
  !jsrVersion ||
  npmVersion !== jsrVersion ||
  npmVersion !== playgroundVersion
) {
  throw new Error(
    `combine dependency mismatch: npm=${String(npmVersion)}, JSR=${String(jsrSpecifier)}, playground=${String(playgroundVersion)}`,
  );
}

const readme = await Bun.file("README.md").text();
const example = await Bun.file("examples/readme.test.ts").text();
const packageImport = 'from "@claudiu-ceia/ts-duckling"';

if (!readme.includes(packageImport) || !example.includes(packageImport)) {
  throw new Error("README examples must use the released package entrypoint");
}

console.log(
  `metadata aligned at ${packageJson.version} with combine ${npmVersion}`,
);
