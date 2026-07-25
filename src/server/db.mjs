import "./env.mjs";
import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { GROUP_LIMITS } from "../groupRules.js";

const connectionString = String(process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();

export const databaseConfigured = Boolean(connectionString);

let sqlClient;
let schemaPromise;

function sql() {
  if (!databaseConfigured) throw new Error("SurStudio score storage is not configured.");
  if (!sqlClient) sqlClient = neon(connectionString);
  return sqlClient;
}

export function ensureScoreSchema() {
  if (!databaseConfigured) return Promise.resolve(false);
  if (!schemaPromise) {
    const query = sql();
    schemaPromise = (async () => {
      await query`
        CREATE TABLE IF NOT EXISTS surstudio_users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT,
          image_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await query`
        CREATE TABLE IF NOT EXISTS surstudio_scores (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES surstudio_users(id) ON DELETE CASCADE,
          client_take_id TEXT NOT NULL,
          title TEXT NOT NULL,
          artist TEXT NOT NULL DEFAULT '',
          score NUMERIC(4, 2) NOT NULL CHECK (score >= 0 AND score <= 10),
          pitch SMALLINT CHECK (pitch >= 0 AND pitch <= 100),
          timing SMALLINT CHECK (timing >= 0 AND timing <= 100),
          vocal_range SMALLINT CHECK (vocal_range >= 0 AND vocal_range <= 100),
          control SMALLINT CHECK (control >= 0 AND control <= 100),
          pitch_stability SMALLINT CHECK (pitch_stability >= 0 AND pitch_stability <= 100),
          tier TEXT,
          recorded_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, client_take_id)
        )
      `;
      await query`
        CREATE INDEX IF NOT EXISTS surstudio_scores_user_recorded_idx
        ON surstudio_scores (user_id, recorded_at DESC)
      `;
      await query`
        CREATE TABLE IF NOT EXISTS surstudio_groups (
          id TEXT PRIMARY KEY,
          owner_user_id TEXT NOT NULL REFERENCES surstudio_users(id) ON DELETE CASCADE,
          owner_slot SMALLINT NOT NULL CHECK (owner_slot BETWEEN 1 AND 3),
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          archived_at TIMESTAMPTZ
        )
      `;
      await query`
        CREATE UNIQUE INDEX IF NOT EXISTS surstudio_groups_active_owner_slot_idx
        ON surstudio_groups (owner_user_id, owner_slot)
        WHERE archived_at IS NULL
      `;
      await query`
        CREATE TABLE IF NOT EXISTS surstudio_group_members (
          group_id TEXT NOT NULL REFERENCES surstudio_groups(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES surstudio_users(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
          member_slot SMALLINT NOT NULL CHECK (member_slot BETWEEN 1 AND 12),
          joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (group_id, user_id),
          UNIQUE (group_id, member_slot)
        )
      `;
      await query`
        CREATE INDEX IF NOT EXISTS surstudio_group_members_user_idx
        ON surstudio_group_members (user_id, joined_at DESC)
      `;
      await query`
        CREATE TABLE IF NOT EXISTS surstudio_group_invites (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL REFERENCES surstudio_groups(id) ON DELETE CASCADE,
          created_by TEXT NOT NULL REFERENCES surstudio_users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          max_uses SMALLINT NOT NULL DEFAULT 11 CHECK (max_uses BETWEEN 1 AND 11),
          use_count SMALLINT NOT NULL DEFAULT 0 CHECK (use_count >= 0),
          revoked_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await query`
        CREATE INDEX IF NOT EXISTS surstudio_group_invites_group_idx
        ON surstudio_group_invites (group_id, created_at DESC)
      `;
      return true;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function mapScore(row) {
  return {
    id: row.client_take_id,
    remoteId: row.id,
    title: row.title,
    artist: row.artist,
    score: Number(row.score),
    pitchStability: row.pitch_stability == null ? null : Number(row.pitch_stability),
    metrics: {
      pitch: Number(row.pitch ?? 0),
      timing: Number(row.timing ?? 0),
      range: Number(row.vocal_range ?? 0),
      control: Number(row.control ?? 0),
    },
    tier: row.tier || "",
    createdAt: new Date(row.recorded_at).toISOString(),
    synced: true,
  };
}

async function upsertUser(user) {
  const query = sql();
  await query`
    INSERT INTO surstudio_users (id, email, name, image_url)
    VALUES (${user.id}, ${user.email}, ${user.name}, ${user.image})
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      image_url = EXCLUDED.image_url,
      updated_at = NOW()
  `;
}

export async function listScores(user) {
  await ensureScoreSchema();
  await upsertUser(user);
  const rows = await sql()`
    SELECT id, client_take_id, title, artist, score, pitch, timing, vocal_range,
      control, pitch_stability, tier, recorded_at
    FROM surstudio_scores
    WHERE user_id = ${user.id}
    ORDER BY recorded_at DESC
    LIMIT 100
  `;
  return rows.map(mapScore);
}

export async function saveScore(user, score) {
  await ensureScoreSchema();
  await upsertUser(user);
  const rows = await sql()`
    INSERT INTO surstudio_scores (
      id, user_id, client_take_id, title, artist, score, pitch, timing,
      vocal_range, control, pitch_stability, tier, recorded_at
    )
    VALUES (
      ${randomUUID()}, ${user.id}, ${score.id}, ${score.title}, ${score.artist},
      ${score.score}, ${score.metrics.pitch}, ${score.metrics.timing},
      ${score.metrics.range}, ${score.metrics.control}, ${score.pitchStability},
      ${score.tier}, ${score.createdAt}
    )
    ON CONFLICT (user_id, client_take_id) DO UPDATE SET
      title = EXCLUDED.title,
      artist = EXCLUDED.artist,
      score = EXCLUDED.score,
      pitch = EXCLUDED.pitch,
      timing = EXCLUDED.timing,
      vocal_range = EXCLUDED.vocal_range,
      control = EXCLUDED.control,
      pitch_stability = EXCLUDED.pitch_stability,
      tier = EXCLUDED.tier,
      recorded_at = EXCLUDED.recorded_at,
      updated_at = NOW()
    RETURNING id, client_take_id, title, artist, score, pitch, timing, vocal_range,
      control, pitch_stability, tier, recorded_at
  `;
  return mapScore(rows[0]);
}

export async function deleteScore(userId, clientTakeId) {
  await ensureScoreSchema();
  const rows = await sql()`
    DELETE FROM surstudio_scores
    WHERE user_id = ${userId} AND client_take_id = ${clientTakeId}
    RETURNING id
  `;
  return rows.length > 0;
}

export class GroupStorageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GroupStorageError";
    this.code = code;
  }
}

function hashInviteToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function mapGroup(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    role: row.role,
    owner: {
      id: row.owner_user_id,
      name: row.owner_name || "SurStudio singer",
      image: row.owner_image_url || null,
    },
    memberCount: Number(row.member_count || 0),
    weeklyTopScore: row.weekly_top_score == null ? null : Number(row.weekly_top_score),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function weekStartsAt() {
  const now = new Date();
  const day = now.getUTCDay();
  now.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
  now.setUTCHours(0, 0, 0, 0);
  return now.toISOString();
}

export async function listGroups(user) {
  await ensureScoreSchema();
  await upsertUser(user);
  const query = sql();
  const rows = await query`
    SELECT g.id, g.name, g.description, g.owner_user_id, g.created_at, membership.role,
      owner.name AS owner_name, owner.image_url AS owner_image_url,
      (SELECT COUNT(*) FROM surstudio_group_members members WHERE members.group_id = g.id) AS member_count,
      (
        SELECT MAX(scores.score)
        FROM surstudio_scores scores
        JOIN surstudio_group_members scoring_member
          ON scoring_member.user_id = scores.user_id AND scoring_member.group_id = g.id
        WHERE scores.recorded_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      ) AS weekly_top_score
    FROM surstudio_group_members membership
    JOIN surstudio_groups g ON g.id = membership.group_id
    JOIN surstudio_users owner ON owner.id = g.owner_user_id
    WHERE membership.user_id = ${user.id} AND g.archived_at IS NULL
    ORDER BY CASE WHEN membership.role = 'owner' THEN 0 ELSE 1 END, g.updated_at DESC
  `;
  const ownedRows = await query`
    SELECT COUNT(*) AS count
    FROM surstudio_groups
    WHERE owner_user_id = ${user.id} AND archived_at IS NULL
  `;
  return {
    groups: rows.map(mapGroup),
    ownedActiveCount: Number(ownedRows[0]?.count || 0),
    limits: GROUP_LIMITS,
  };
}

export async function getGroup(user, groupId) {
  await ensureScoreSchema();
  await upsertUser(user);
  const query = sql();
  const groupRows = await query`
    SELECT g.id, g.name, g.description, g.owner_user_id, g.created_at, membership.role,
      owner.name AS owner_name, owner.image_url AS owner_image_url,
      (SELECT COUNT(*) FROM surstudio_group_members members WHERE members.group_id = g.id) AS member_count,
      (
        SELECT MAX(scores.score)
        FROM surstudio_scores scores
        JOIN surstudio_group_members scoring_member
          ON scoring_member.user_id = scores.user_id AND scoring_member.group_id = g.id
        WHERE scores.recorded_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      ) AS weekly_top_score
    FROM surstudio_groups g
    JOIN surstudio_group_members membership ON membership.group_id = g.id
    JOIN surstudio_users owner ON owner.id = g.owner_user_id
    WHERE g.id = ${groupId} AND membership.user_id = ${user.id} AND g.archived_at IS NULL
    LIMIT 1
  `;
  if (!groupRows.length) return null;

  const memberRows = await query`
    SELECT membership.user_id, membership.role, membership.joined_at,
      singer.name, singer.image_url
    FROM surstudio_group_members membership
    JOIN surstudio_users singer ON singer.id = membership.user_id
    WHERE membership.group_id = ${groupId}
    ORDER BY CASE WHEN membership.role = 'owner' THEN 0 ELSE 1 END, membership.joined_at
  `;
  const leaderboardRows = await query`
    WITH weekly_best AS (
      SELECT DISTINCT ON (scores.user_id)
        scores.user_id, scores.title, scores.artist, scores.score, scores.tier, scores.recorded_at
      FROM surstudio_scores scores
      JOIN surstudio_group_members scoring_member
        ON scoring_member.user_id = scores.user_id
      WHERE scoring_member.group_id = ${groupId}
        AND scores.recorded_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      ORDER BY scores.user_id, scores.score DESC, scores.recorded_at DESC
    )
    SELECT membership.user_id, singer.name, singer.image_url, weekly_best.title,
      weekly_best.artist, weekly_best.score, weekly_best.tier, weekly_best.recorded_at,
      CASE WHEN weekly_best.score IS NULL THEN NULL
        ELSE RANK() OVER (ORDER BY weekly_best.score DESC NULLS LAST)
      END AS rank
    FROM surstudio_group_members membership
    JOIN surstudio_users singer ON singer.id = membership.user_id
    LEFT JOIN weekly_best ON weekly_best.user_id = membership.user_id
    WHERE membership.group_id = ${groupId}
    ORDER BY weekly_best.score DESC NULLS LAST, weekly_best.recorded_at DESC NULLS LAST, singer.name
  `;
  const group = mapGroup(groupRows[0]);
  const inviteRows = group.role === "owner" ? await query`
    SELECT id, expires_at, max_uses, use_count, created_at
    FROM surstudio_group_invites
    WHERE group_id = ${groupId} AND revoked_at IS NULL AND expires_at > NOW() AND use_count < max_uses
    ORDER BY created_at DESC
    LIMIT 1
  ` : [];
  return {
    group,
    members: memberRows.map((row) => ({
      id: row.user_id,
      name: row.name || "SurStudio singer",
      image: row.image_url || null,
      role: row.role,
      joinedAt: new Date(row.joined_at).toISOString(),
      isCurrentUser: row.user_id === user.id,
    })),
    leaderboard: leaderboardRows.map((row) => ({
      userId: row.user_id,
      name: row.name || "SurStudio singer",
      image: row.image_url || null,
      rank: row.rank == null ? null : Number(row.rank),
      score: row.score == null ? null : Number(row.score),
      title: row.title || "",
      artist: row.artist || "",
      tier: row.tier || "",
      recordedAt: row.recorded_at ? new Date(row.recorded_at).toISOString() : null,
      isCurrentUser: row.user_id === user.id,
    })),
    activeInvite: inviteRows[0] ? {
      id: inviteRows[0].id,
      expiresAt: new Date(inviteRows[0].expires_at).toISOString(),
      remainingUses: Number(inviteRows[0].max_uses) - Number(inviteRows[0].use_count),
    } : null,
    weekStartsAt: weekStartsAt(),
    limits: GROUP_LIMITS,
  };
}

export async function createGroup(user, input) {
  await ensureScoreSchema();
  await upsertUser(user);
  const query = sql();
  let groupId = "";
  for (let attempt = 0; attempt < GROUP_LIMITS.owned; attempt += 1) {
    const candidateId = randomUUID();
    const rows = await query`
      WITH available_slot AS (
        SELECT slot
        FROM generate_series(1, ${GROUP_LIMITS.owned}::integer) AS slot
        WHERE NOT EXISTS (
          SELECT 1 FROM surstudio_groups existing
          WHERE existing.owner_user_id = ${user.id}
            AND existing.owner_slot = slot
            AND existing.archived_at IS NULL
        )
        ORDER BY slot
        LIMIT 1
      )
      INSERT INTO surstudio_groups (id, owner_user_id, owner_slot, name, description)
      SELECT ${candidateId}, ${user.id}, slot, ${input.name}, ${input.description}
      FROM available_slot
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (rows[0]?.id) {
      groupId = rows[0].id;
      break;
    }
  }
  if (!groupId) {
    throw new GroupStorageError("GROUP_LIMIT", `You can create up to ${GROUP_LIMITS.owned} active groups.`);
  }
  await query`
    INSERT INTO surstudio_group_members (group_id, user_id, role, member_slot)
    VALUES (${groupId}, ${user.id}, 'owner', 1)
  `;
  return getGroup(user, groupId);
}

export async function createGroupInvite(user, groupId) {
  await ensureScoreSchema();
  await upsertUser(user);
  const query = sql();
  const ownerRows = await query`
    SELECT id FROM surstudio_groups
    WHERE id = ${groupId} AND owner_user_id = ${user.id} AND archived_at IS NULL
  `;
  if (!ownerRows.length) throw new GroupStorageError("NOT_OWNER", "Only the group owner can create invitation links.");

  await query`
    UPDATE surstudio_group_invites
    SET revoked_at = NOW()
    WHERE group_id = ${groupId} AND revoked_at IS NULL
  `;
  const token = randomBytes(24).toString("base64url");
  const inviteId = randomUUID();
  const rows = await query`
    INSERT INTO surstudio_group_invites (
      id, group_id, created_by, token_hash, expires_at, max_uses
    )
    VALUES (
      ${inviteId}, ${groupId}, ${user.id}, ${hashInviteToken(token)},
      NOW() + (${GROUP_LIMITS.inviteDays}::text || ' days')::interval,
      ${GROUP_LIMITS.members - 1}
    )
    RETURNING id, expires_at, max_uses
  `;
  return {
    token,
    invite: {
      id: rows[0].id,
      expiresAt: new Date(rows[0].expires_at).toISOString(),
      remainingUses: Number(rows[0].max_uses),
    },
  };
}

export async function revokeGroupInvite(user, groupId, inviteId) {
  await ensureScoreSchema();
  const rows = await sql()`
    UPDATE surstudio_group_invites invite
    SET revoked_at = NOW()
    FROM surstudio_groups group_record
    WHERE invite.id = ${inviteId}
      AND invite.group_id = ${groupId}
      AND group_record.id = invite.group_id
      AND group_record.owner_user_id = ${user.id}
      AND invite.revoked_at IS NULL
    RETURNING invite.id
  `;
  if (!rows.length) throw new GroupStorageError("NOT_OWNER", "This invitation could not be revoked.");
  return true;
}

export async function getGroupInvitePreview(token) {
  await ensureScoreSchema();
  const rows = await sql()`
    SELECT invite.id, invite.expires_at, invite.max_uses, invite.use_count, invite.revoked_at,
      group_record.id AS group_id, group_record.name, group_record.description,
      group_record.archived_at, owner.name AS owner_name, owner.image_url AS owner_image_url,
      (SELECT COUNT(*) FROM surstudio_group_members members WHERE members.group_id = group_record.id) AS member_count,
      (invite.expires_at <= NOW()) AS expired
    FROM surstudio_group_invites invite
    JOIN surstudio_groups group_record ON group_record.id = invite.group_id
    JOIN surstudio_users owner ON owner.id = group_record.owner_user_id
    WHERE invite.token_hash = ${hashInviteToken(token)}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    description: row.description || "",
    ownerName: row.owner_name || "SurStudio singer",
    ownerImage: row.owner_image_url || null,
    memberCount: Number(row.member_count || 0),
    expiresAt: new Date(row.expires_at).toISOString(),
    available: !row.revoked_at && !row.archived_at && !row.expired
      && Number(row.use_count) < Number(row.max_uses)
      && Number(row.member_count) < GROUP_LIMITS.members,
    reason: row.revoked_at ? "revoked" : row.archived_at ? "archived" : row.expired ? "expired"
      : Number(row.member_count) >= GROUP_LIMITS.members ? "full"
      : Number(row.use_count) >= Number(row.max_uses) ? "used" : "",
    limits: GROUP_LIMITS,
  };
}

export async function joinGroupWithInvite(user, token) {
  await ensureScoreSchema();
  await upsertUser(user);
  const query = sql();
  const tokenHash = hashInviteToken(token);
  const inviteRows = await query`
    SELECT invite.id, invite.group_id, invite.expires_at, invite.max_uses, invite.use_count,
      invite.revoked_at, group_record.archived_at
    FROM surstudio_group_invites invite
    JOIN surstudio_groups group_record ON group_record.id = invite.group_id
    WHERE invite.token_hash = ${tokenHash}
    LIMIT 1
  `;
  const invite = inviteRows[0];
  if (!invite || invite.revoked_at || invite.archived_at) {
    throw new GroupStorageError("INVITE_INVALID", "This group invitation is no longer available.");
  }
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    throw new GroupStorageError("INVITE_EXPIRED", "This group invitation has expired.");
  }
  if (Number(invite.use_count) >= Number(invite.max_uses)) {
    throw new GroupStorageError("GROUP_FULL", "This group invitation has reached its member limit.");
  }
  const existing = await query`
    SELECT group_id FROM surstudio_group_members
    WHERE group_id = ${invite.group_id} AND user_id = ${user.id}
  `;
  if (existing.length) return getGroup(user, invite.group_id);

  let inserted = false;
  for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
    const rows = await query`
      WITH available_slot AS (
        SELECT slot
        FROM generate_series(2, ${GROUP_LIMITS.members}::integer) AS slot
        WHERE NOT EXISTS (
          SELECT 1 FROM surstudio_group_members member
          WHERE member.group_id = ${invite.group_id} AND member.member_slot = slot
        )
        ORDER BY slot
        LIMIT 1
      )
      INSERT INTO surstudio_group_members (group_id, user_id, role, member_slot)
      SELECT ${invite.group_id}, ${user.id}, 'member', slot
      FROM available_slot
      ON CONFLICT DO NOTHING
      RETURNING group_id
    `;
    inserted = Boolean(rows.length);
  }
  if (!inserted) throw new GroupStorageError("GROUP_FULL", `This group already has ${GROUP_LIMITS.members} members.`);
  await query`
    UPDATE surstudio_group_invites
    SET use_count = use_count + 1
    WHERE id = ${invite.id}
  `;
  return getGroup(user, invite.group_id);
}

export async function removeGroupMember(user, groupId, memberId) {
  await ensureScoreSchema();
  const ownerRows = await sql()`
    SELECT owner_user_id FROM surstudio_groups
    WHERE id = ${groupId} AND owner_user_id = ${user.id} AND archived_at IS NULL
  `;
  if (!ownerRows.length) throw new GroupStorageError("NOT_OWNER", "Only the group owner can remove members.");
  if (memberId === user.id) throw new GroupStorageError("OWNER_REQUIRED", "Archive the group instead of removing its owner.");
  const rows = await sql()`
    DELETE FROM surstudio_group_members
    WHERE group_id = ${groupId} AND user_id = ${memberId} AND role = 'member'
    RETURNING user_id
  `;
  if (!rows.length) throw new GroupStorageError("NOT_MEMBER", "That singer is not an active group member.");
  return true;
}

export async function leaveGroup(user, groupId) {
  await ensureScoreSchema();
  const rows = await sql()`
    DELETE FROM surstudio_group_members
    WHERE group_id = ${groupId} AND user_id = ${user.id} AND role = 'member'
    RETURNING user_id
  `;
  if (!rows.length) throw new GroupStorageError("OWNER_REQUIRED", "Group owners must archive their group instead.");
  return true;
}

export async function archiveGroup(user, groupId) {
  await ensureScoreSchema();
  const query = sql();
  const rows = await query`
    UPDATE surstudio_groups
    SET archived_at = NOW(), updated_at = NOW()
    WHERE id = ${groupId} AND owner_user_id = ${user.id} AND archived_at IS NULL
    RETURNING id
  `;
  if (!rows.length) throw new GroupStorageError("NOT_OWNER", "Only the group owner can archive this group.");
  await query`
    UPDATE surstudio_group_invites
    SET revoked_at = NOW()
    WHERE group_id = ${groupId} AND revoked_at IS NULL
  `;
  return true;
}
