import assert from "node:assert/strict";
import test from "node:test";
import { GROUP_LIMITS, normalizeGroupId, normalizeGroupInput, normalizeInviteToken } from "./groupRules.js";

test("group limits keep the first release family-sized", () => {
  assert.deepEqual(GROUP_LIMITS, { owned: 3, members: 12, inviteDays: 7 });
});

test("normalizes safe group copy within database limits", () => {
  assert.deepEqual(normalizeGroupInput({ name: "  Friday   Mehfil ", description: "  Sing   together  " }), {
    name: "Friday Mehfil",
    description: "Sing together",
  });
  assert.equal(normalizeGroupInput({ name: "x" }), null);
});

test("accepts opaque invite tokens and rejects unsafe values", () => {
  assert.equal(normalizeInviteToken("abcdefghijklmnopqrstuvwx"), "abcdefghijklmnopqrstuvwx");
  assert.equal(normalizeInviteToken("../not-an-invite"), "");
});

test("accepts UUID group identifiers only", () => {
  assert.equal(normalizeGroupId("550e8400-e29b-41d4-a716-446655440000"), "550e8400-e29b-41d4-a716-446655440000");
  assert.equal(normalizeGroupId("all-groups"), "");
});
