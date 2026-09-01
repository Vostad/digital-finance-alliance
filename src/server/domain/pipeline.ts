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
  /** D2 — fulfilment after converting. Delegate ATTENDED. */
  isAttendance: boolean;
  /** D4 — withdrawal after converting. Speaker WITHDRAWN. Not a loss. */
  isAttrition: boolean;
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
      isAttendance: pipelineStages.isAttendance,
      isAttrition: pipelineStages.isAttrition,
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
 * THE TRANSITION RULES (§4), in one place.
 *
 * Stated as a function of (function, from, to) so there is exactly one
 * implementation for the API, the UI and the tests to agree on. Returns null
 * when the move is legal, or the sentence to show the person who attempted it.
 */
export function transitionError(
  fn: WorkFunction,
  from: Stage | undefined,
  to: Stage,
): string | null {
  if (!from) return null;
  if (from.key === to.key) return null;

  /* CANCELLED — sponsor only, and only out of WON. */
  if (to.isCancelled) {
    if (fn !== "sponsor") return "Only sponsor opportunities can be cancelled.";
    if (!from.isWon) {
      return "Cancelled is only reachable from Won. An opportunity that was never won is Lost, not Cancelled.";
    }
    return null;
  }

  /* Terminal states nothing moves out of. A cancelled deal, a delegate who
     attended and a speaker who withdrew are all finished; the remedy in each
     case is a NEW workstream, not resurrecting the old one. */
  if (from.isCancelled) {
    return "Cancelled is terminal. Start a new workstream for this person and edition instead.";
  }
  if (from.isAttendance) {
    return "Attended is terminal — the edition happened. Start a new workstream for the next edition.";
  }
  if (from.isAttrition) {
    return "Withdrawn is terminal. Start a new workstream if they become available again.";
  }

  /**
   * D4 — WON IS TERMINAL FOR SPONSOR ONLY.
   *
   * A sponsor deal that is won is closed money, and the only way out is
   * CANCELLED, which reverses its commission. But CONFIRMED is the won stage
   * for delegates and speakers too, and both have legitimate successors:
   * a delegate goes on to ATTEND, a speaker may WITHDRAW. Applying the sponsor
   * rule to all three would make D2 and D4 unreachable — the very outcomes the
   * pipeline exists to record.
   */
  if (from.isWon) {
    if (fn === "sponsor") {
      return "Won is terminal. To undo a won deal, move it to Cancelled — that reverses its commission on the ledger.";
    }
    if (!to.isAttendance && !to.isAttrition) {
      return fn === "delegate"
        ? "A confirmed delegate can only go on to Attended, or Withdrawn if they drop out."
        : "A confirmed speaker can only go on to Withdrawn.";
    }
    return null;
  }

  /* Attendance and attrition are outcomes OF conversion. Reaching either
     without having converted first would produce an attendance with no
     confirmation behind it, and an attrition rate with no denominator. */
  if (to.isAttendance || to.isAttrition) {
    const label = to.isAttendance ? "Attended" : "Withdrawn";
    return `${label} follows Confirmed. Confirm this workstream first.`;
  }

  return null;
}

/**
 * ACHIEVEMENT (§4, §9), as SQL.
 *
 *   won_at IS NOT NULL   AND   the current stage is not attrition
 *
 * Reading the timestamp rather than the current stage flag is what makes D2
 * and D4 true simultaneously: a delegate who moves CONFIRMED -> ATTENDED keeps
 * the one achievement they earned, and a speaker who moves CONFIRMED ->
 * WITHDRAWN loses it. A flag-only rule cannot express both.
 */
export const ACHIEVEMENT_SQL = `
  o.won_at is not null
  and not exists (
    select 1 from pipeline_stages ps
    where ps.function = o.function and ps.key = o.stage_key and ps.is_attrition
  )
`;
