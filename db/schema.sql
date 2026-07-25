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
