/**
 * §46.3 — THE WON / CANCELLED TRANSITION RULES.
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
  ...flags,
});

const NEW = stage("new", { isOpen: true, defaultProbability: 5 });
const MEETING = stage("meeting", { isOpen: true, defaultProbability: 40 });
const NEGOTIATION = stage("negotiation", { isOpen: true, defaultProbability: 80 });
const WON = stage("won", { isWon: true, defaultProbability: 100 });
const LOST = stage("lost", { isLost: true });
const CANCELLED = stage("cancelled", { isCancelled: true });

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

describe("WON is otherwise terminal", () => {
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
