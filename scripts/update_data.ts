// Fetch and vendor external JSON datasets so the library doesn't depend on
// network access at runtime, and so CI/test runs are reproducible.

const DATA_DIR = new URL("../data/", import.meta.url);

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

async function writeJson(path: URL, value: unknown) {
  const text = JSON.stringify(value, null, 2) + "\n";
  await Deno.writeTextFile(path, text);
}

function jsdelivrNpmMetaUrl(pkg: string) {
  return `https://data.jsdelivr.com/v1/package/npm/${pkg}`;
}

function jsdelivrGhMetaUrl(repo: string) {
  return `https://data.jsdelivr.com/v1/package/gh/${repo}`;
}

async function getJsdelivrNpmLatestVersion(pkg: string): Promise<string> {
  const meta = await fetchJson(jsdelivrNpmMetaUrl(pkg)) as {
    tags?: Record<string, string>;
  };
  const latest = meta.tags?.latest;
  if (!latest) throw new Error(`could not determine latest version for ${pkg}`);
  return latest;
}

async function getJsdelivrGhLatestRef(repo: string): Promise<string> {
  const meta = await fetchJson(jsdelivrGhMetaUrl(repo)) as {
    tags?: Record<string, string>;
    versions?: string[];
  };
  // Some GH packages don't expose tags.latest, but do expose a versions list.
  return meta.tags?.latest ?? meta.versions?.[0] ??
    (() => {
      throw new Error(`could not determine latest ref for ${repo}`);
    })();
}

await Deno.mkdir(DATA_DIR, { recursive: true });

// Countries (English, US) - keep using upstream's current latest tag.
{
  const repo = "umpirsky/country-list";
  const tag = await getJsdelivrGhLatestRef(repo);
  const url =
    `https://cdn.jsdelivr.net/gh/${repo}@${tag}/data/en_US/country.json`;
  const countries = await fetchJson(url);
  await writeJson(new URL("countries-en-us.json", DATA_DIR), countries);
  console.log(`updated data/countries-en-us.json (${repo}@${tag})`);
}

// Languages (English names) - pull the latest CLDR localenames dataset from npm.
{
  const pkg = "cldr-localenames-modern";
  const version = await getJsdelivrNpmLatestVersion(pkg);
  const url =
    `https://cdn.jsdelivr.net/npm/${pkg}@${version}/main/en/languages.json`;
  const languages = await fetchJson(url);
  await writeJson(new URL("languages-en.json", DATA_DIR), languages);
  console.log(`updated data/languages-en.json (${pkg}@${version})`);
}

// TLDs - use upstream's JSON list (lowercase entries).
{
  const url =
    "https://cdn.jsdelivr.net/gh/incognico/list-of-top-level-domains/formats/json/tld-list.json";
  const tlds = await fetchJson(url) as unknown;
  await writeJson(new URL("tlds.json", DATA_DIR), tlds);
  console.log("updated data/tlds.json");
}
