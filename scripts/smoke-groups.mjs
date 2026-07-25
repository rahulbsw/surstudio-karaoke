import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  archiveGroup,
  createGroup,
  createGroupInvite,
  getGroup,
  getGroupInvitePreview,
  GroupStorageError,
  joinGroupWithInvite,
  listGroups,
  saveScore,
} from "../src/server/db.mjs";

const connectionString = String(process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
if (!connectionString) throw new Error("DATABASE_URL is required for the group database smoke test.");

const suffix = randomUUID();
const owner = { id: `smoke-owner-${suffix}`, email: `smoke-owner-${suffix}@surstudio.invalid`, name: "Smoke Owner", image: null };
const member = { id: `smoke-member-${suffix}`, email: `smoke-member-${suffix}@surstudio.invalid`, name: "Smoke Member", image: null };
const query = neon(connectionString);

try {
  const created = await createGroup(owner, { name: "Smoke Test Mehfil", description: "Temporary automated verification" });
  assert.equal(created.group.role, "owner");
  assert.equal(created.members.length, 1);

  const invitation = await createGroupInvite(owner, created.group.id);
  const preview = await getGroupInvitePreview(invitation.token);
  assert.equal(preview.available, true);

  const joined = await joinGroupWithInvite(member, invitation.token);
  assert.equal(joined.members.length, 2);

  const now = new Date().toISOString();
  await saveScore(owner, {
    id: `owner-score-${suffix}`,
    title: "Smoke Song",
    artist: "SurStudio",
    score: 8.7,
    metrics: { pitch: 87, timing: 84, range: 89, control: 85 },
    pitchStability: 87,
    tier: "Spotlight",
    createdAt: now,
  });
  await saveScore(member, {
    id: `member-score-${suffix}`,
    title: "Smoke Song",
    artist: "SurStudio",
    score: 9.1,
    metrics: { pitch: 91, timing: 90, range: 92, control: 89 },
    pitchStability: 91,
    tier: "Legendary",
    createdAt: now,
  });
  const leaderboard = await getGroup(owner, created.group.id);
  assert.equal(leaderboard.leaderboard[0].name, member.name);
  assert.equal(leaderboard.leaderboard[0].score, 9.1);

  await createGroup(owner, { name: "Smoke Two", description: "" });
  await createGroup(owner, { name: "Smoke Three", description: "" });
  await assert.rejects(
    () => createGroup(owner, { name: "Smoke Four", description: "" }),
    (error) => error instanceof GroupStorageError && error.code === "GROUP_LIMIT",
  );

  const collection = await listGroups(owner);
  assert.equal(collection.ownedActiveCount, 3);
  await archiveGroup(owner, created.group.id);
  await createGroup(owner, { name: "Smoke Replacement", description: "" });
  assert.equal((await listGroups(owner)).ownedActiveCount, 3);

  console.log("SurStudio group database smoke test passed.");
} finally {
  await query`DELETE FROM surstudio_users WHERE id IN (${owner.id}, ${member.id})`;
}
