-- ============================================================
-- Línea 1.5 v3 — Schema para Azure Database for PostgreSQL
-- Ejecutar una sola vez al crear la base de datos
-- ============================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── USUARIOS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username         TEXT UNIQUE NOT NULL,
  name             TEXT NOT NULL,
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,           -- bcrypt hash
  role             TEXT NOT NULL DEFAULT 'viewer'
                     CHECK (role IN ('admin','lider','analista','auditor','viewer')),
  active           BOOLEAN NOT NULL DEFAULT true,
  project_perms    JSONB NOT NULL DEFAULT '{}',
  failed_attempts  INTEGER NOT NULL DEFAULT 0,
  locked_until     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PROYECTOS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  publish_date     DATE,
  responsible      TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  archived_at      TIMESTAMPTZ,
  finalized_by     TEXT,
  finalized_by_role TEXT,
  stats            JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CONTROLES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS controls (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code             TEXT NOT NULL,
  causa_base       TEXT,
  causas_asociadas TEXT,
  control_base     TEXT,
  compliance       TEXT NOT NULL DEFAULT '',
  ri_niv           TEXT,
  rr_niv           TEXT,
  normatividad     JSONB NOT NULL DEFAULT '{}',
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_controls_project ON controls(project_id);

-- ── EVIDENCIAS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  control_id  UUID NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'Documento',
  description TEXT NOT NULL,
  date        DATE,
  notes       TEXT NOT NULL DEFAULT '',
  reviewer    TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'en_revision'
                CHECK (status IN ('en_revision','aprobada','rechazada')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidences_project ON evidences(project_id);
CREATE INDEX IF NOT EXISTS idx_evidences_control ON evidences(control_id);

-- ── ARCHIVOS DE EVIDENCIA ────────────────────────────────────
-- storage_path = ruta en Azure Blob Storage
CREATE TABLE IF NOT EXISTS evidence_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id  UUID NOT NULL REFERENCES evidences(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT '',
  size         INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,            -- ruta en Azure Blob Storage
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_files_ev ON evidence_files(evidence_id);

-- ── AUDIT LOGS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type      TEXT NOT NULL,
  category  TEXT NOT NULL DEFAULT 'Sistema',
  user_name TEXT,
  user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  detail    TEXT NOT NULL DEFAULT '',
  project   TEXT NOT NULL DEFAULT '',
  ip        TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_ts ON audit_logs(timestamp DESC);

-- ============================================================
-- NOTA: Para migrar datos desde Supabase ejecuta:
--   pg_dump --no-owner -t profiles -t projects -t controls \
--           -t evidences -t evidence_files -t audit_logs \
--           postgresql://[supabase-connection-string] > dump.sql
-- Luego adapta los nombres de tabla (profiles → users) y
-- restaura con psql en tu Azure PostgreSQL.
-- ============================================================
