/**
 * PIPELINE REFERENCE — stages, loss reasons, cancellation reasons.
 *
 * Read from the database, never hardcoded. §10 says no commission rate is
 * hardcoded; the same reasoning applies here — an operator may tune a stage
 * probability (§4), and a copy of the ladder compiled into the bundle would
 * silently disagree with the one the forecast uses.
 *
 * Cached per process because it is reference data that changes about once a
 * year, and every opportunity read would otherwise carry a second round trip.
 * The cache is short enough that a probability edit shows up within a minute
 * without a deploy.
 */

import { asc, eq } from "drizzle-orm";

import { cancellationReasons, lossReasons, pipelineStages } from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { WorkFunction } from "../auth/permissions";

export type Stage = {
  key: string;
  label: string;
  sortOrder: number;
  defaultProbability: number;
  isOpen: boolean;
  isWon: boolean;
  isLost: boolean;
  isCancelled: boolean;
};

const TTL_MS = 60_000;
let cache: { at: number; stages: Record<WorkFunction, Stage[]> } | null = null;

export async function loadStages(q: ScopedQuery): Promise<Record<WorkFunction, Stage[]>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.stages;

  const rows = await q.directory
    .select({
      function: pipelineStages.function,
      key: pipelineStages.key,
      label: pipelineStages.label,
      sortOrder: pipelineStages.sortOrder,
      defaultProbability: pipelineStages.defaultProbability,
      isOpen: pipelineStages.isOpen,
      isWon: pipelineStages.isWon,
      isLost: pipelineStages.isLost,
      isCancelled: pipelineStages.isCancelled,
    })
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.sortOrder));

  const stages: Record<WorkFunction, Stage[]> = { sponsor: [], delegate: [], speaker: [] };
  for (const row of rows) {
    const { function: fn, ...stage } = row;
    stages[fn as WorkFunction].push(stage);
  }
  cache = { at: Date.now(), stages };
  return stages;
}

/** Tests and migrations change reference data underneath a live process. */
export function clearPipelineCache() {
  cache = null;
}

export async function stagesFor(q: ScopedQuery, fn: WorkFunction): Promise<Stage[]> {
  return (await loadStages(q))[fn];
}

export async function findStage(
  q: ScopedQuery,
  fn: WorkFunction,
  key: string,
): Promise<Stage | undefined> {
  return (await stagesFor(q, fn)).find((s) => s.key === key);
}

export async function loadLossReasons(q: ScopedQuery, fn: WorkFunction) {
  return q.directory
    .select({ key: lossReasons.key, label: lossReasons.label })
    .from(lossReasons)
    .where(eq(lossReasons.function, fn))
    .orderBy(asc(lossReasons.sortOrder));
}

export async function loadCancellationReasons(q: ScopedQuery) {
  return q.directory
    .select({ key: cancellationReasons.key, label: cancellationReasons.label })
    .from(cancellationReasons)
    .orderBy(asc(cancellationReasons.sortOrder));
}

/**
 * §46.3 — THE TRANSITION RULES, in one place.
 *
 * Stated as a function of (from, to) so there is exactly one implementation
 * for the API, the UI and the tests to agree on. Returns null when the move is
 * legal, or the sentence to show the person who attempted it.
 *
 *   CANCELLED is reachable ONLY from WON, and only for sponsor.
 *   An opportunity that was never WON becomes LOST, not CANCELLED.
 *   WON is otherwise terminal and cannot move backwards.
 */
export function transitionError(
  fn: WorkFunction,
  from: Stage | undefined,
  to: Stage,
): string | null {
  if (!from) return null;
  if (from.key === to.key) return null;

  if (to.isCancelled) {
    if (fn !== "sponsor") return "Only sponsor opportunities can be cancelled.";
    if (!from.isWon) {
      return "Cancelled is only reachable from Won. An opportunity that was never won is Lost, not Cancelled.";
    }
    return null;
  }

  if (from.isWon && !to.isCancelled) {
    return "Won is terminal. To undo a won deal, move it to Cancelled — that reverses its commission on the ledger.";
  }

  if (from.isCancelled) {
    return "Cancelled is terminal. Start a new workstream for this person and edition instead.";
  }

  return null;
}
