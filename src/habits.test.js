import test from "node:test";
import assert from "node:assert/strict";
import { getPracticeRhythm, localDateKey, mergeDailyActivity } from "./habits.js";

test("uses local calendar dates for practice activity", () => {
  assert.equal(localDateKey(new Date(2026, 6, 20, 23, 30)), "2026-07-20");
});

test("merges practice wins without duplicating a day", () => {
  const now = new Date(2026, 6, 20, 12);
  const started = mergeDailyActivity([], { started: true, title: "Kesariya" }, now);
  const practiced = mergeDailyActivity(started, { practiced: true }, now);
  assert.equal(practiced.length, 1);
  assert.deepEqual(practiced[0], { date: "2026-07-20", started: true, title: "Kesariya", practiced: true });
});

test("practice rhythm counts meaningful practice instead of app opens", () => {
  const now = new Date(2026, 6, 20, 12);
  const rhythm = getPracticeRhythm([
    { date: "2026-07-19", started: true },
    { date: "2026-07-20", practiced: true },
  ], now);
  assert.equal(rhythm.at(-2).active, false);
  assert.equal(rhythm.at(-1).active, true);
});
