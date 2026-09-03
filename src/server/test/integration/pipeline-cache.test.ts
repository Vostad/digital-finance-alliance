/**
 * THE PIPELINE-LADDER CACHE, under concurrency.
 *
 * This exists because of a real failure. The lead form asks for all three
 * ladders at once through `Promise.all`, and the cache stored the RESULT rather
 * than the in-flight promise — so on a cold process all three callers found an
 * empty cache, all three queried, and the screen returned a 500.
 *
 * It had been hidden for months by an accident: the old dashboard called
 * `conversionRates`, which warmed the cache before anyone reached the form.
 * Making the dashboard leaner removed that warming and the bug surfaced
 * immediately — which is the useful kind of regression, the kind that was
 * already there.
 *
 * The test asserts the property that matters: three concurrent cold callers all
 * receive COMPLETE ladders. It fails on the old implementation.
 */

import { describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { clearPipelineCache, loadStages, stagesFor } from "@/server/domain/pipeline";

const q = { directory: db } as never;

describe("loadStages is single-flight", () => {
  it("serves three concurrent cold callers complete ladders", async () => {
    clearPipelineCache();

    const [sponsor, delegate, speaker] = await Promise.all([
      stagesFor(q, "sponsor"),
      stagesFor(q, "delegate"),
      stagesFor(q, "speaker"),
    ]);

    /* The counts are §46.3's ladders. A short ladder here means rows were
       bucketed into the wrong object, which is exactly what the race did. */
    expect(sponsor).toHaveLength(9);
    expect(delegate).toHaveLength(8);
    expect(speaker).toHaveLength(7);
  });

  it("returns the same object to concurrent callers, not two copies", async () => {
    clearPipelineCache();
    const [a, b] = await Promise.all([loadStages(q), loadStages(q)]);
    /* Identity, not equality: two different objects would mean two queries. */
    expect(a).toBe(b);
  });

  it("still answers correctly after the cache is cleared mid-life", async () => {
    await loadStages(q);
    clearPipelineCache();
    const again = await loadStages(q);
    expect(again.sponsor).toHaveLength(9);
  });
});
