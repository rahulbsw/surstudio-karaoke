import "./env.mjs";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

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
