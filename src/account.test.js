import assert from "node:assert/strict";
import test from "node:test";
import { mergeScores } from "./account.js";

test("mergeScores keeps local-only takes and prefers the synchronized copy", () => {
  const local = [
    { id: "local-1", score: 7.2, createdAt: "2026-07-20T00:00:00.000Z" },
    { id: "shared", score: 7.5, createdAt: "2026-07-21T00:00:00.000Z" },
  ];
  const remote = [
    { id: "shared", score: 8.4, createdAt: "2026-07-22T00:00:00.000Z" },
    { id: "remote-1", score: 9.0, createdAt: "2026-07-23T00:00:00.000Z" },
  ];

  assert.deepEqual(mergeScores(local, remote).map(({ id, score, synced }) => ({ id, score, synced })), [
    { id: "remote-1", score: 9, synced: true },
    { id: "shared", score: 8.4, synced: true },
    { id: "local-1", score: 7.2, synced: undefined },
  ]);
});

test("mergeScores enforces a bounded history", () => {
  const scores = Array.from({ length: 110 }, (_, index) => ({
    id: `score-${index}`,
    createdAt: new Date(2026, 0, index + 1).toISOString(),
  }));
  assert.equal(mergeScores(scores, []).length, 100);
});
