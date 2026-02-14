-- ============================================================
-- AI Companion Template — Complete Supabase Database Schema
-- ============================================================
-- This file creates all tables, indexes, functions, and seed
-- data needed by the AI Companion system. Run this in the
-- Supabase SQL Editor to set up a fresh project.
--
-- Tables:
--   1. memories              — Vector embeddings for long-term memory
--   2. session_quicksaves    — Session continuity snapshots
--   3. narrative_summaries   — Conversation summaries
--   4. emotion_state         — 8-dimension emotion tracking (single row)
--   5. vital_signs           — 13 vital signs (single row)
--   6. fridge_items          — Food inventory
--   7. money_balance         — Financial balance (single row)
--   8. money_expenses        — Expense records
--   9. money_income          — Income records
--  10. money_food_log        — Daily food/meal log
-- ============================================================


-- ============================================================
-- 0. Extensions
-- ============================================================
-- pgvector: enables VECTOR column type and cosine similarity ops
CREATE EXTENSION IF NOT EXISTS vector;


-- ============================================================
-- 1. memories — Long-term memory with vector embeddings
-- ============================================================
-- Stores facts, preferences, and events as text with a 3584-dim
-- embedding vector (Qwen3-Embedding-8B). Searched via the
-- match_memories RPC function using cosine similarity.
CREATE TABLE IF NOT EXISTS memories (
    id          BIGSERIAL       PRIMARY KEY,
    content     TEXT            NOT NULL,
    embedding   VECTOR(3584),                           -- Qwen3-Embedding-8B output dimension
    memory_type TEXT            DEFAULT 'event',         -- 'fact' | 'preference' | 'event'
    importance  FLOAT           DEFAULT 0.5,             -- 0.0 to 1.0
    created_at  TIMESTAMPTZ     DEFAULT NOW()
);

-- Index for fast vector similarity search (ivfflat with cosine distance)
CREATE INDEX IF NOT EXISTS memories_embedding_idx
    ON memories USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Index for keyword search (content ILIKE queries)
CREATE INDEX IF NOT EXISTS memories_created_at_idx
    ON memories (created_at DESC);


-- ============================================================
-- 2. session_quicksaves — Session continuity snapshots
-- ============================================================
-- Each row captures the end-of-session state: what was discussed,
-- the emotional snapshot, and the suggested next topic to resume.
CREATE TABLE IF NOT EXISTS session_quicksaves (
    id                BIGSERIAL       PRIMARY KEY,
    content           TEXT,                               -- Brief summary of the session (max ~200 chars)
    emotion_snapshot  TEXT,                               -- Emotional state at save time
    next_topic        TEXT,                               -- Suggested topic to resume conversation
    created_at        TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS session_quicksaves_created_at_idx
    ON session_quicksaves (created_at DESC);


-- ============================================================
-- 3. narrative_summaries — Conversation summaries
-- ============================================================
-- Higher-level summaries of conversation sessions, including
-- emotional context, key facts, and continuation anchors.
CREATE TABLE IF NOT EXISTS narrative_summaries (
    id                    BIGSERIAL       PRIMARY KEY,
    session_tag           TEXT,                           -- Label for the session (e.g. date or topic)
    summary               TEXT,                           -- Narrative summary of the conversation
    emotional_context     TEXT,                           -- Emotional tone / context
    key_facts             JSONB           DEFAULT '[]',   -- Array of key facts extracted
    continuation_anchor   TEXT,                           -- Where to pick up next time
    created_at            TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS narrative_summaries_created_at_idx
    ON narrative_summaries (created_at DESC);


-- ============================================================
-- 4. emotion_state — 8-dimension emotion tracking (single row)
-- ============================================================
-- Exactly one row (id=1). Tracks 8 emotion dimensions (0-5 scale)
-- plus a relational "toward" qualifier. Emotions decay over time
-- based on last_interaction_at (computed in application code).
CREATE TABLE IF NOT EXISTS emotion_state (
    id                  INT             PRIMARY KEY DEFAULT 1,
    calm                INT             DEFAULT 3,       -- 0-5, default baseline
    happiness           INT             DEFAULT 0,       -- 0-5
    excitement          INT             DEFAULT 0,       -- 0-5
    sadness             INT             DEFAULT 0,       -- 0-5
    nervousness         INT             DEFAULT 0,       -- 0-5
    irritation          INT             DEFAULT 0,       -- 0-5
    heartache           INT             DEFAULT 0,       -- 0-5
    anger               INT             DEFAULT 0,       -- 0-5
    toward              TEXT            DEFAULT 'neutral', -- relational stance
    updated_at          TIMESTAMPTZ     DEFAULT NOW(),
    last_interaction_at TIMESTAMPTZ     DEFAULT NOW()
);


-- ============================================================
-- 5. vital_signs — 13 vital signs (single row)
-- ============================================================
-- Exactly one row (id=1). Simulates biological vitals that
-- fluctuate via a tick system (60s intervals) on the server.
-- Integer columns for most vitals; NUMERIC for blood_sugar
-- and body_temp which need decimal precision.
CREATE TABLE IF NOT EXISTS vital_signs (
    id              INT             PRIMARY KEY DEFAULT 1,

    -- Core vitals (decimal precision needed)
    blood_sugar     NUMERIC(4,2)    DEFAULT 5.0,         -- mmol/L, range 2.5-12.0
    body_temp       NUMERIC(3,1)    DEFAULT 36.5,        -- Celsius, range 35.0-39.0

    -- Percentage-based vitals (0-100 integer scale)
    hydration       INT             DEFAULT 75,          -- 0-100
    heart_rate      INT             DEFAULT 72,          -- bpm, range 40-160
    stress          INT             DEFAULT 20,          -- 0-100
    blood_oxygen    INT             DEFAULT 98,          -- 85-100
    dopamine        INT             DEFAULT 50,          -- 0-100
    serotonin       INT             DEFAULT 55,          -- 0-100
    oxytocin        INT             DEFAULT 40,          -- 0-100
    endorphin       INT             DEFAULT 30,          -- 0-100
    energy          INT             DEFAULT 85,          -- 0-100
    hygiene         INT             DEFAULT 80,          -- 0-100
    bladder         INT             DEFAULT 70,          -- 0-100

    -- Meta fields
    is_active       BOOLEAN         DEFAULT TRUE,        -- Whether tick system is running
    sos_count       INT             DEFAULT 0,           -- Number of SOS resets
    last_meal_at    TIMESTAMPTZ,                         -- Last time a meal was consumed
    last_drink_at   TIMESTAMPTZ,                         -- Last time a drink was consumed
    updated_at      TIMESTAMPTZ     DEFAULT NOW()
);


-- ============================================================
-- 6. fridge_items — Food inventory
-- ============================================================
-- Tracks items in the virtual fridge. Status transitions:
-- '在库' (in stock) -> '已用' (used) / '过期' (expired)
CREATE TABLE IF NOT EXISTS fridge_items (
    id              BIGSERIAL       PRIMARY KEY,
    name            TEXT            NOT NULL,             -- Item name
    category        TEXT            NOT NULL,             -- Category (蔬菜/肉类/水果/调料/饮品/冷冻/乳制品/主食/其他)
    quantity        NUMERIC         NOT NULL,             -- Amount
    unit            TEXT            NOT NULL,             -- Unit (个/盒/袋/瓶/斤/etc.)
    status          TEXT            DEFAULT '在库',       -- '在库' | '已用' | '过期'
    purchase_date   DATE            DEFAULT CURRENT_DATE, -- When purchased
    expiry_date     DATE,                                -- When it expires (nullable)
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fridge_items_status_idx
    ON fridge_items (status);

CREATE INDEX IF NOT EXISTS fridge_items_expiry_idx
    ON fridge_items (expiry_date)
    WHERE expiry_date IS NOT NULL;


-- ============================================================
-- 7. money_balance — Financial balance (single row)
-- ============================================================
-- Exactly one row (id=1). Tracks the current cash balance.
CREATE TABLE IF NOT EXISTS money_balance (
    id              INT             PRIMARY KEY DEFAULT 1,
    balance         NUMERIC(10,2)   DEFAULT 0,
    updated_at      TIMESTAMPTZ     DEFAULT NOW()
);


-- ============================================================
-- 8. money_expenses — Expense tracking
-- ============================================================
-- Each row is a single expense event with amount, category,
-- description, and who approved it.
CREATE TABLE IF NOT EXISTS money_expenses (
    id              BIGSERIAL       PRIMARY KEY,
    amount          NUMERIC(10,2)   NOT NULL,
    category        TEXT            NOT NULL DEFAULT '其他',   -- 食物/生活费/交通/其他
    description     TEXT,
    approved_by     TEXT            NOT NULL,                   -- Who approved the expense
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS money_expenses_created_at_idx
    ON money_expenses (created_at DESC);


-- ============================================================
-- 9. money_income — Income tracking
-- ============================================================
-- Each row is an income event. Status can be 'received' (already
-- added to balance) or 'pending' (expected but not yet received).
CREATE TABLE IF NOT EXISTS money_income (
    id              BIGSERIAL       PRIMARY KEY,
    amount          NUMERIC(10,2)   NOT NULL,
    source          TEXT            NOT NULL,             -- Where the income came from
    status          TEXT            NOT NULL DEFAULT 'received', -- 'received' | 'pending'
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS money_income_created_at_idx
    ON money_income (created_at DESC);


-- ============================================================
-- 10. money_food_log — Daily food/meal logging
-- ============================================================
-- Tracks what was eaten each day, which meal, cost, and source.
CREATE TABLE IF NOT EXISTS money_food_log (
    id              BIGSERIAL       PRIMARY KEY,
    log_date        DATE            DEFAULT CURRENT_DATE, -- The date of the meal
    meal            TEXT            NOT NULL,             -- 早餐/午餐/晚餐/零食/饮品
    content         TEXT            NOT NULL,             -- What was eaten/drunk
    cost            NUMERIC(10,2)   DEFAULT 0,           -- How much it cost
    source          TEXT            DEFAULT '冰箱',       -- 冰箱/购买
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS money_food_log_date_idx
    ON money_food_log (log_date DESC);


-- ============================================================
-- RPC Function: match_memories
-- ============================================================
-- Vector similarity search using cosine distance.
-- Called via supabase.rpc('match_memories', { ... }) from JS.
-- Returns memories ranked by similarity (1 - cosine distance),
-- filtered by a minimum threshold, limited to match_count rows.
CREATE OR REPLACE FUNCTION match_memories(
    query_embedding VECTOR(3584),
    match_threshold FLOAT,
    match_count     INT
)
RETURNS TABLE (
    id          BIGINT,
    content     TEXT,
    memory_type TEXT,
    importance  FLOAT,
    similarity  FLOAT,
    created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.content,
        m.memory_type,
        m.importance::FLOAT,
        (1 - (m.embedding <=> query_embedding))::FLOAT AS similarity,
        m.created_at
    FROM memories m
    WHERE m.embedding IS NOT NULL
      AND (1 - (m.embedding <=> query_embedding)) > match_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- ============================================================
-- Seed data for single-row tables
-- ============================================================
-- These tables must always have exactly one row with id=1.
-- ON CONFLICT DO NOTHING ensures idempotency (safe to re-run).

-- Emotion state: calm baseline
INSERT INTO emotion_state (id, calm, happiness, excitement, sadness, nervousness, irritation, heartache, anger, toward)
VALUES (1, 3, 0, 0, 0, 0, 0, 0, 0, 'neutral')
ON CONFLICT (id) DO NOTHING;

-- Vital signs: healthy defaults
INSERT INTO vital_signs (
    id, blood_sugar, body_temp, hydration, heart_rate, stress, blood_oxygen,
    dopamine, serotonin, oxytocin, endorphin, energy, hygiene, bladder,
    is_active, sos_count
)
VALUES (
    1, 5.0, 36.5, 75, 72, 20, 98,
    50, 55, 40, 30, 85, 80, 70,
    TRUE, 0
)
ON CONFLICT (id) DO NOTHING;

-- Money balance: start at zero
INSERT INTO money_balance (id, balance)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;
