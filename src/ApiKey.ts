import {
  any,
  Context,
  createLanguageThis,
  map,
  regex,
  seq,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, Entity } from "./Entity.ts";

export type ApiKeyEntity = Entity<
  "api_key",
  {
    provider?: string;
    key: string;  
  }
>;

type ApiKeyLanguage = {
  Prefix: () => Parser<string>;
  PrefixKey: () => Parser<ApiKeyEntity["value"]>;
  Full: () => Parser<ApiKeyEntity>;
  parser: () => Parser<ApiKeyEntity>;
};

const ProviderPrefixes: Record<string, string> = {
  // Stripe
  "sk_live_": "stripe",
  "sk_test_": "stripe",
  "pk_live_": "stripe",
  "pk_test_": "stripe",
  "rk_live_": "stripe",
  "rk_test_": "stripe",

  // OpenAI
  "sk-": "openai",
  "sk-proj-": "openai",
  "sk-svcacct-": "openai",

  // Anthropic
  "sk-ant-": "anthropic",
  "sk-ant-api03-": "anthropic",

  // GitHub
  "ghp_": "github",
  "gho_": "github",
  "ghu_": "github",
  "ghs_": "github",
  "ghr_": "github",
  "github_pat_": "github",

  // GitLab
  "glpat-": "gitlab",

  // Slack
  "xoxb-": "slack",
  "xoxp-": "slack",
  "xoxa-": "slack",
  "xoxr-": "slack",
  "xapp-": "slack",

  // AWS access key IDs (public identifier, not the secret)
  "AKIA": "aws",
  "ASIA": "aws",
  "AIDA": "aws",
  "AGPA": "aws",
  "ANPA": "aws",
  "ANVA": "aws",
  "AROA": "aws",
  "AIPA": "aws",

  // Google API keys
  "AIza": "google",

  // SendGrid
  "SG.": "sendgrid",

  // Mailgun
  "key-": "mailgun",

  // Mapbox
  "pk.": "mapbox",
  "sk.": "mapbox",
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ProviderPrefixRegex = new RegExp(
  Object.keys(ProviderPrefixes)
    // Prefer longer prefixes first (e.g. "sk-ant-api03-" before "sk-")
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join("|"),
);

export const apiKey = (
  value: ApiKeyEntity["value"],
  before: Context,
  after: Context,
): ApiKeyEntity => {
  return ent(value, "api_key", before, after);
};

export const ApiKey = createLanguageThis<ApiKeyLanguage>({
  /**
   * Matches prefix for common API key formats, e.g. "sk-" for Stripe, "pk-" for some others, etc. 
   * This is optional since not all API keys have a prefix.
   * 
   * Returns a provider name if a known prefix is matched, or undefined otherwise.
   * This allows downstream code to potentially apply provider-specific validation or parsing logic.
   */
  Prefix(): Parser<string> {
    return map(
      regex(ProviderPrefixRegex, "api-key-prefix"),
      (prefix) => ProviderPrefixes[prefix],
    );
  },
  /**
   * Parses a known provider prefix + key body.
   */
  PrefixKey(): Parser<ApiKeyEntity["value"]> {
    return map(
      seq(
        regex(ProviderPrefixRegex, "api-key-prefix"),
        regex(/[A-Za-z0-9][A-Za-z0-9._-]{7,199}/, "api-key-body"),
      ),
      ([prefix, body]) => ({
        provider: ProviderPrefixes[prefix],
        key: `${prefix}${body}`,
      }),
    );
  },
  Full(): Parser<ApiKeyEntity> {
    return map(this.PrefixKey, (value, b, a) => apiKey(value, b, a));
  },
  parser(): Parser<ApiKeyEntity> {
    return dot(any(this.Full));
  },
});
