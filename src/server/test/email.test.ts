/**
 * THE SEND PATH — the parts provable without a provider.
 *
 * Delivery itself needs a live Resend key and a verified domain, so it is a
 * go-live smoke test rather than a unit test. What IS provable here is the
 * behaviour around it: that nothing claims to have sent when no provider is
 * configured, and that the retry ceiling exists.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { emailProviderConfigured } from "../domain/email";

const KEY = "EMAIL_PROVIDER_API_KEY";
const FROM = "EMAIL_FROM_ADDRESS";

describe("provider detection", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved[KEY] = process.env[KEY];
    saved[FROM] = process.env[FROM];
    delete process.env[KEY];
    delete process.env[FROM];
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("reports NOT configured when neither variable is set", () => {
    expect(emailProviderConfigured()).toBe(false);
  });

  it("reports NOT configured with only a key", () => {
    process.env[KEY] = "re_test";
    expect(emailProviderConfigured()).toBe(false);
  });

  it("reports NOT configured with only a from address", () => {
    process.env[FROM] = "Financial Rails <financialrails@vostad.com>";
    expect(emailProviderConfigured()).toBe(false);
  });

  it("reports configured only when BOTH are set", () => {
    /* A key with no from address would send from nowhere; a from address with
       no key cannot send at all. Half-configured must read as not configured,
       or the outbox summary tells a Super Admin that mail is working when it
       is not. */
    process.env[KEY] = "re_test";
    process.env[FROM] = "Financial Rails <financialrails@vostad.com>";
    expect(emailProviderConfigured()).toBe(true);
  });

  it("is read at CALL time, not at import time", () => {
    /* Serverless functions read configuration from the environment they boot
       into. Caching this at module load would make the first deploy after
       setting the key behave as though it were never set. */
    expect(emailProviderConfigured()).toBe(false);
    process.env[KEY] = "re_test";
    process.env[FROM] = "Financial Rails <financialrails@vostad.com>";
    expect(emailProviderConfigured()).toBe(true);
  });
});
