CREATE TABLE IF NOT EXISTS surstudio_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

CREATE INDEX IF NOT EXISTS surstudio_scores_user_recorded_idx
ON surstudio_scores (user_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS surstudio_groups (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES surstudio_users(id) ON DELETE CASCADE,
  owner_slot SMALLINT NOT NULL CHECK (owner_slot BETWEEN 1 AND 3),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS surstudio_groups_active_owner_slot_idx
ON surstudio_groups (owner_user_id, owner_slot)
WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS surstudio_group_members (
  group_id TEXT NOT NULL REFERENCES surstudio_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES surstudio_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  member_slot SMALLINT NOT NULL CHECK (member_slot BETWEEN 1 AND 12),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id),
  UNIQUE (group_id, member_slot)
);

CREATE INDEX IF NOT EXISTS surstudio_group_members_user_idx
ON surstudio_group_members (user_id, joined_at DESC);

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
);

CREATE INDEX IF NOT EXISTS surstudio_group_invites_group_idx
ON surstudio_group_invites (group_id, created_at DESC);
