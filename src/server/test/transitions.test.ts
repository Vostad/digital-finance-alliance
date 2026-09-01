/**
 * THE TRANSITION RULES (§4), including locked decisions D2 and D4.
 *
 * `transitionError` is a pure function of (function, from, to), which is what
 * lets the API, the UI and these tests agree on one implementation instead of
 * three that drift.
 */

import { describe, expect, it } from "vitest";

import { transitionError, type Stage } from "../domain/pipeline";

const stage = (key: string, flags: Partial<Stage> = {}): Stage => ({
  key,
  label: key,
  sortOrder: 0,
  defaultProbability: 0,
  isOpen: false,
  isWon: false,
  isLost: false,
  isCancelled: false,
  isAttendance: false,
  isAttrition: false,
  ...flags,
});

const NEW = stage("new", { isOpen: true, defaultProbability: 5 });
const MEETING = stage("meeting", { isOpen: true, defaultProbability: 40 });
const NEGOTIATION = stage("negotiation", { isOpen: true, defaultProbability: 80 });
const WON = stage("won", { isWon: true, defaultProbability: 100 });
const LOST = stage("lost", { isLost: true });
const CANCELLED = stage("cancelled", { isCancelled: true });

/* Delegate and speaker. CONFIRMED is their won stage — and unlike sponsor WON,
   it has legitimate successors. */
const CONFIRMED = stage("confirmed", { isWon: true, defaultProbability: 100 });
const INTERESTED = stage("interested", { isOpen: true, defaultProbability: 35 });
const ATTENDED = stage("attended", { isAttendance: true, defaultProbability: 100 });
const WITHDRAWN = stage("withdrawn", { isAttrition: true });
const DECLINED = stage("declined", { isLost: true });

describe("ordinary movement through an open pipeline", () => {
  it("moves forward", () => {
    expect(transitionError("sponsor", NEW, MEETING)).toBeNull();
    expect(transitionError("sponsor", MEETING, NEGOTIATION)).toBeNull();
  });

  it("moves backward — a deal can cool off", () => {
    expect(transitionError("sponsor", NEGOTIATION, MEETING)).toBeNull();
  });

  it("closes as won or lost", () => {
    expect(transitionError("sponsor", NEGOTIATION, WON)).toBeNull();
    expect(transitionError("sponsor", NEGOTIATION, LOST)).toBeNull();
  });

  it("a no-op move is not an error", () => {
    expect(transitionError("sponsor", WON, WON)).toBeNull();
  });
});

describe("CANCELLED is reachable ONLY from WON", () => {
  it("WON → CANCELLED is the one legal route", () => {
    expect(transitionError("sponsor", WON, CANCELLED)).toBeNull();
  });

  it.each([
    ["new", NEW],
    ["meeting", MEETING],
    ["negotiation", NEGOTIATION],
    ["lost", LOST],
  ])("%s → CANCELLED is refused", (_label, from) => {
    const error = transitionError("sponsor", from, CANCELLED);
    expect(error).toBeTruthy();
    expect(error).toMatch(/only reachable from Won/i);
  });

  it("names LOST as the correct alternative, so the operator knows what to do", () => {
    expect(transitionError("sponsor", NEGOTIATION, CANCELLED)).toMatch(/Lost, not Cancelled/i);
  });
});

describe("CANCELLED is a SPONSOR stage only", () => {
  it.each(["delegate", "speaker"] as const)("%s cannot be cancelled", (fn) => {
    expect(transitionError(fn, WON, CANCELLED)).toMatch(/Only sponsor/i);
  });
});

describe("D2 — a confirmed delegate goes on to ATTENDED", () => {
  it("CONFIRMED → ATTENDED is legal", () => {
    expect(transitionError("delegate", CONFIRMED, ATTENDED)).toBeNull();
  });

  it("ATTENDED cannot be reached without confirming first", () => {
    /* An attendance with no confirmation behind it is a number with no
       conversion to divide by. */
    expect(transitionError("delegate", INTERESTED, ATTENDED)).toMatch(/follows Confirmed/i);
  });

  it("ATTENDED is terminal — the edition happened", () => {
    expect(transitionError("delegate", ATTENDED, INTERESTED)).toMatch(/Attended is terminal/i);
    expect(transitionError("delegate", ATTENDED, CONFIRMED)).toMatch(/Attended is terminal/i);
  });

  it("a confirmed delegate cannot slide back into an open stage", () => {
    expect(transitionError("delegate", CONFIRMED, INTERESTED)).toMatch(/only go on to Attended/i);
  });
});

describe("D4 — a confirmed speaker who leaves is WITHDRAWN, not lost", () => {
  it("CONFIRMED → WITHDRAWN is legal", () => {
    expect(transitionError("speaker", CONFIRMED, WITHDRAWN)).toBeNull();
  });

  it("WITHDRAWN cannot be reached without confirming first", () => {
    /* Someone who never confirmed and then said no is DECLINED — a loss.
       Letting them reach WITHDRAWN would inflate attrition and deflate the
       loss rate at the same time. */
    expect(transitionError("speaker", INTERESTED, WITHDRAWN)).toMatch(/follows Confirmed/i);
  });

  it("DECLINED remains reachable from an open stage — it IS a loss", () => {
    expect(transitionError("speaker", INTERESTED, DECLINED)).toBeNull();
  });

  it("WITHDRAWN is terminal", () => {
    expect(transitionError("speaker", WITHDRAWN, CONFIRMED)).toMatch(/Withdrawn is terminal/i);
  });

  it("a confirmed speaker cannot be marked DECLINED — that is not what happened", () => {
    expect(transitionError("speaker", CONFIRMED, DECLINED)).toMatch(/only go on to Withdrawn/i);
  });
});

describe("WON is terminal for SPONSOR ONLY", () => {
  it("the sponsor rule does not leak onto delegate or speaker", () => {
    /* Applying it to all three would make D2 and D4 unreachable — the very
       outcomes the pipeline exists to record. */
    expect(transitionError("delegate", CONFIRMED, ATTENDED)).toBeNull();
    expect(transitionError("speaker", CONFIRMED, WITHDRAWN)).toBeNull();
  });

  it("and delegate/speaker cannot be cancelled either", () => {
    expect(transitionError("delegate", CONFIRMED, CANCELLED)).toMatch(/Only sponsor/i);
    expect(transitionError("speaker", CONFIRMED, CANCELLED)).toMatch(/Only sponsor/i);
  });
});

describe("sponsor WON is otherwise terminal", () => {
  it.each([
    ["new", NEW],
    ["meeting", MEETING],
    ["negotiation", NEGOTIATION],
  ])("WON cannot move backwards to %s", (_label, to) => {
    const error = transitionError("sponsor", WON, to);
    expect(error).toBeTruthy();
    expect(error).toMatch(/Won is terminal/i);
  });

  it("WON cannot become LOST — that would erase a real closed deal", () => {
    expect(transitionError("sponsor", WON, LOST)).toMatch(/Won is terminal/i);
  });

  it("tells the operator the actual route out of WON", () => {
    expect(transitionError("sponsor", WON, LOST)).toMatch(/move it to Cancelled/i);
  });
});

describe("CANCELLED is terminal", () => {
  it.each([
    ["new", NEW],
    ["won", WON],
  ])("CANCELLED cannot move to %s", (_label, to) => {
    expect(transitionError("sponsor", CANCELLED, to)).toMatch(/Cancelled is terminal/i);
  });

  it("points at the correct remedy — a NEW workstream, not a resurrection", () => {
    expect(transitionError("sponsor", CANCELLED, NEW)).toMatch(/new workstream/i);
  });
});

describe("a brand new opportunity has no origin stage", () => {
  it("permits any entry", () => {
    expect(transitionError("sponsor", undefined, NEW)).toBeNull();
  });
});
