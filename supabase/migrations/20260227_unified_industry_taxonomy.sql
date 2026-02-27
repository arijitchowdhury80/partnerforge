-- ============================================================================
-- UNIFIED INDUSTRY TAXONOMY
-- ============================================================================
-- Description: Normalized industry classification tables that unify Demandbase
--              and ZoomInfo taxonomies. Used as the canonical industry layer
--              across whale_composite, ICP, Crossbeam, and all account data.
--
-- Design:
--   - industries: 30 unified industries (Demandbase-based, more granular)
--   - sub_industries: ~270 sub-industries linked to parent industry
--   - whale_composite gets FK references for consistent filtering
--
-- Created: 2026-02-27
-- ============================================================================

-- ===========================================
-- INDUSTRIES (Primary Industry Taxonomy)
-- ===========================================
CREATE TABLE IF NOT EXISTS industries (
    id SERIAL PRIMARY KEY,

    -- Canonical name (what we display/filter on)
    name VARCHAR(100) UNIQUE NOT NULL,

    -- Slug for URLs/codes
    slug VARCHAR(100) UNIQUE NOT NULL,

    -- Source mappings (for data import matching)
    demandbase_name VARCHAR(100),           -- Original Demandbase name
    zoominfo_names TEXT[],                  -- Array of ZoomInfo names that map here

    -- Metadata
    description TEXT,
    display_order INTEGER DEFAULT 999,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- SUB-INDUSTRIES (Child of Industries)
-- ===========================================
CREATE TABLE IF NOT EXISTS sub_industries (
    id SERIAL PRIMARY KEY,

    -- Parent industry FK
    industry_id INTEGER REFERENCES industries(id) ON DELETE CASCADE,

    -- Canonical name
    name VARCHAR(150) UNIQUE NOT NULL,

    -- Slug for URLs/codes
    slug VARCHAR(150) UNIQUE NOT NULL,

    -- Source mappings
    demandbase_name VARCHAR(150),           -- Original Demandbase sub-industry
    zoominfo_names TEXT[],                  -- Array of ZoomInfo sub-industries that map here

    -- Metadata
    description TEXT,
    display_order INTEGER DEFAULT 999,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX idx_industries_slug ON industries(slug);
CREATE INDEX idx_industries_demandbase ON industries(demandbase_name);
CREATE INDEX idx_sub_industries_industry_id ON sub_industries(industry_id);
CREATE INDEX idx_sub_industries_slug ON sub_industries(slug);
CREATE INDEX idx_sub_industries_demandbase ON sub_industries(demandbase_name);

-- ===========================================
-- ADD FK COLUMNS TO WHALE_COMPOSITE
-- ===========================================
ALTER TABLE whale_composite
ADD COLUMN IF NOT EXISTS unified_industry_id INTEGER REFERENCES industries(id),
ADD COLUMN IF NOT EXISTS unified_sub_industry_id INTEGER REFERENCES sub_industries(id);

CREATE INDEX IF NOT EXISTS idx_whale_composite_unified_industry ON whale_composite(unified_industry_id);
CREATE INDEX IF NOT EXISTS idx_whale_composite_unified_sub_industry ON whale_composite(unified_sub_industry_id);

-- ===========================================
-- TABLE COMMENTS
-- ===========================================
COMMENT ON TABLE industries IS
'Unified industry taxonomy (30 industries). Primary source is Demandbase taxonomy
(more granular than ZoomInfo). Used as canonical layer across whale_composite,
ICP classification, Crossbeam lists, and all account data.';

COMMENT ON TABLE sub_industries IS
'Sub-industry taxonomy (~270 sub-industries). Linked to parent industry.
Primary source is Demandbase, with ZoomInfo mappings for import matching.';

COMMENT ON COLUMN whale_composite.unified_industry_id IS
'FK to industries table - canonical industry classification';

COMMENT ON COLUMN whale_composite.unified_sub_industry_id IS
'FK to sub_industries table - canonical sub-industry classification';

-- ===========================================
-- RLS POLICIES
-- ===========================================
ALTER TABLE industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_industries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "industries_read_all" ON industries FOR SELECT USING (true);
CREATE POLICY "industries_insert" ON industries FOR INSERT WITH CHECK (true);
CREATE POLICY "industries_update" ON industries FOR UPDATE USING (true);

CREATE POLICY "sub_industries_read_all" ON sub_industries FOR SELECT USING (true);
CREATE POLICY "sub_industries_insert" ON sub_industries FOR INSERT WITH CHECK (true);
CREATE POLICY "sub_industries_update" ON sub_industries FOR UPDATE USING (true);
