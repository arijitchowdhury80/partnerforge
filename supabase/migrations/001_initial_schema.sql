-- Arian Initial Schema
-- Run this in Supabase SQL Editor or via CLI

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

-- Companies master table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    vertical VARCHAR(100),
    sub_vertical VARCHAR(100),
    country VARCHAR(100),
    country_code VARCHAR(2),
    city VARCHAR(100),
    state VARCHAR(100),

    -- BuiltWith data
    bw_spend_estimate INTEGER,
    bw_first_indexed TIMESTAMP,
    bw_last_indexed TIMESTAMP,
    bw_company_name VARCHAR(255),

    -- SimilarWeb data
    sw_monthly_visits BIGINT,
    sw_visits_growth_pct DECIMAL(5,2),
    sw_bounce_rate DECIMAL(5,2),
    sw_pages_per_visit DECIMAL(5,2),
    sw_avg_visit_duration INTEGER, -- seconds
    sw_search_traffic_pct DECIMAL(5,2), -- KEY ALGOLIA SIGNAL
    sw_organic_search_pct DECIMAL(5,2),
    sw_paid_search_pct DECIMAL(5,2),
    sw_rank_global INTEGER,
    sw_rank_country INTEGER,

    -- Algolia status
    is_algolia_customer BOOLEAN DEFAULT FALSE,
    algolia_customer_since DATE,
    algolia_arr DECIMAL(12,2),
    algolia_products TEXT[], -- ARRAY['Search', 'Recommend', 'NeuralSearch']
    algolia_cs_coverage VARCHAR(50), -- 'High Touch', 'Low Touch', 'Tech Touch'

    -- Consent/Rights
    has_logo_rights BOOLEAN DEFAULT FALSE,
    has_case_study_consent BOOLEAN DEFAULT FALSE,
    has_reference_consent BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    bw_updated_at TIMESTAMP WITH TIME ZONE,
    sw_updated_at TIMESTAMP WITH TIME ZONE
);

-- Technologies catalog
CREATE TABLE technologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100), -- 'CMS', 'Search', 'Ecommerce', 'CDP', 'Analytics'
    sub_category VARCHAR(100),
    is_partner BOOLEAN DEFAULT FALSE,
    is_competitor BOOLEAN DEFAULT FALSE,
    builtwith_name VARCHAR(255), -- Exact name in BuiltWith API
    description TEXT,
    website_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Company-Technology junction
CREATE TABLE company_technologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    technology_id UUID REFERENCES technologies(id) ON DELETE CASCADE,
    first_seen TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE,
    is_live BOOLEAN DEFAULT TRUE,
    source VARCHAR(50) NOT NULL, -- 'builtwith', 'similarweb', 'manual', 'case_study'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, technology_id, source)
);

-- Competitor relationships between companies
CREATE TABLE competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_a_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    company_b_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL, -- 'similarweb', 'builtwith', 'manual'
    confidence_score INTEGER CHECK (confidence_score BETWEEN 1 AND 100),
    similarity_score DECIMAL(5,4), -- SimilarWeb similarity (0.0000 - 1.0000)
    relationship_type VARCHAR(50), -- 'audience_overlap', 'same_owner', 'industry_peer'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_a_id, company_b_id, source)
);

-- ============================================
-- CUSTOMER EVIDENCE TABLES
-- ============================================

-- Case studies (from "Case Studies" and "Cust. Stories" sheets)
CREATE TABLE case_studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(255) NOT NULL,
    customer_domain VARCHAR(255),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

    -- Location
    country VARCHAR(100),
    region VARCHAR(50), -- 'North America', 'EMEA', 'APAC', 'LATAM', 'MEA'

    -- Classification
    vertical VARCHAR(100),
    sub_vertical VARCHAR(100),
    use_case VARCHAR(100), -- 'B2C E-commerce', 'B2B E-commerce', 'SaaS', 'Media'
    customer_type VARCHAR(100), -- Persona type

    -- Content
    story_url TEXT,
    slide_deck_url TEXT,
    pdf_url TEXT,
    status VARCHAR(50) DEFAULT 'Complete', -- 'Complete', 'DRAFT', 'Webinar'

    -- Features used (checkboxes from Cust. Stories)
    features_used TEXT[], -- ARRAY['NeuralSearch', 'Personalization', 'Recommend', 'A/B Testing']

    -- Integration & Competition
    partner_integrations TEXT[], -- ARRAY['Adobe Commerce', 'Shopify']
    competitor_takeout VARCHAR(255), -- Previous search provider

    -- Results
    key_results TEXT,
    key_metrics JSONB, -- {"conversion_lift": "15%", "search_revenue": "$2M"}

    -- Localization
    localized_urls JSONB, -- {"fr": "url", "de": "url"}

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer quotes/testimonials (from "Cust.Quotes" sheet)
CREATE TABLE customer_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(255),
    customer_domain VARCHAR(255),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

    contact_name VARCHAR(255),
    contact_title VARCHAR(255),
    vertical VARCHAR(100),
    country VARCHAR(100),

    quote_text TEXT NOT NULL,
    evidence_type VARCHAR(100), -- 'Survey Response', 'Interview', 'Review'
    source VARCHAR(100), -- 'TechValidate', 'G2', 'TrustRadius', 'Gong Call'
    source_date DATE,

    tags TEXT[],
    is_approved BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proof points - aggregated stats (from "Cust. Proofpoints" sheet)
CREATE TABLE proof_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical VARCHAR(100),
    theme VARCHAR(100), -- 'Conversion', 'Revenue', 'Speed', 'Implementation'
    customer_name VARCHAR(255), -- Could be specific customer or 'Aggregated'

    result_text TEXT NOT NULL,
    metric_type VARCHAR(50), -- 'percentage', 'currency', 'time', 'multiplier'
    metric_value DECIMAL(12,2),
    metric_unit VARCHAR(20), -- '%', '$', 'ms', 'x'

    source VARCHAR(100),
    is_shareable BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer logos (from "Cust.Logos" sheet)
CREATE TABLE customer_logos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    company_domain VARCHAR(255),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

    signed_date DATE,
    vertical VARCHAR(100),

    has_case_study_in_contract BOOLEAN DEFAULT FALSE,
    has_logo_rights BOOLEAN DEFAULT FALSE,
    social_completed BOOLEAN DEFAULT FALSE,
    is_reference BOOLEAN DEFAULT FALSE,
    has_press_release BOOLEAN DEFAULT FALSE,

    partner VARCHAR(255),
    tech_platform VARCHAR(255), -- Platform built on
    competitor_displaced VARCHAR(255),

    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LEAD LISTS & WORKFLOWS
-- ============================================

-- Saved lead lists
CREATE TABLE lead_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID, -- Supabase Auth user ID

    list_type VARCHAR(50) NOT NULL, -- 'cosell', 'displacement', 'competitive', 'custom'

    -- Filter criteria
    partner_tech VARCHAR(255),
    target_company_domain VARCHAR(255),
    filters JSONB, -- {"country": "US", "min_traffic": 100000, "vertical": "Fashion"}

    -- Stats
    company_count INTEGER DEFAULT 0,

    -- Sharing
    is_public BOOLEAN DEFAULT FALSE,
    shared_with UUID[], -- Array of user IDs

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead list members
CREATE TABLE lead_list_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID REFERENCES lead_lists(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- Scoring
    score INTEGER, -- 0-100 lead score
    score_breakdown JSONB, -- {"traffic": 20, "engagement": 15, "tech_fit": 25}

    -- Status tracking
    status VARCHAR(50) DEFAULT 'new', -- 'new', 'contacted', 'qualified', 'disqualified', 'converted'

    -- Notes
    notes TEXT,
    matched_case_studies UUID[], -- Array of case_study IDs

    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(list_id, company_id)
);

-- ============================================
-- SYNC & AUDIT TABLES
-- ============================================

-- API sync jobs
CREATE TABLE sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL, -- 'builtwith_tech', 'similarweb_enrich', 'case_study_import'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'

    parameters JSONB, -- Job-specific params

    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    errors JSONB,

    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Companies
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_vertical ON companies(vertical);
CREATE INDEX idx_companies_country ON companies(country_code);
CREATE INDEX idx_companies_is_algolia ON companies(is_algolia_customer);
CREATE INDEX idx_companies_sw_traffic ON companies(sw_monthly_visits DESC);
CREATE INDEX idx_companies_sw_search ON companies(sw_search_traffic_pct DESC);

-- Company Technologies
CREATE INDEX idx_company_tech_company ON company_technologies(company_id);
CREATE INDEX idx_company_tech_tech ON company_technologies(technology_id);
CREATE INDEX idx_company_tech_live ON company_technologies(is_live) WHERE is_live = TRUE;

-- Competitors
CREATE INDEX idx_competitors_a ON competitors(company_a_id);
CREATE INDEX idx_competitors_b ON competitors(company_b_id);

-- Case Studies
CREATE INDEX idx_case_studies_vertical ON case_studies(vertical);
CREATE INDEX idx_case_studies_region ON case_studies(region);
CREATE INDEX idx_case_studies_company ON case_studies(company_id);
CREATE INDEX idx_case_studies_features ON case_studies USING GIN(features_used);
CREATE INDEX idx_case_studies_partners ON case_studies USING GIN(partner_integrations);

-- Quotes
CREATE INDEX idx_quotes_vertical ON customer_quotes(vertical);
CREATE INDEX idx_quotes_company ON customer_quotes(company_id);

-- Lead Lists
CREATE INDEX idx_lead_lists_created_by ON lead_lists(created_by);
CREATE INDEX idx_lead_lists_type ON lead_lists(list_type);
CREATE INDEX idx_lead_list_members_list ON lead_list_members(list_id);
CREATE INDEX idx_lead_list_members_company ON lead_list_members(company_id);
CREATE INDEX idx_lead_list_members_status ON lead_list_members(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE technologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_technologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_logos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- Basic policies: Allow authenticated users to read all data
CREATE POLICY "Allow authenticated read" ON companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON technologies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON company_technologies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON competitors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON case_studies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON customer_quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON proof_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON customer_logos FOR SELECT TO authenticated USING (true);

-- Lead lists: Users can see their own + public + shared with them
CREATE POLICY "Users can view own and shared lists" ON lead_lists FOR SELECT TO authenticated
    USING (created_by = auth.uid() OR is_public = TRUE OR auth.uid() = ANY(shared_with));

CREATE POLICY "Users can create lists" ON lead_lists FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own lists" ON lead_lists FOR UPDATE TO authenticated
    USING (created_by = auth.uid());

CREATE POLICY "Users can delete own lists" ON lead_lists FOR DELETE TO authenticated
    USING (created_by = auth.uid());

-- Lead list members inherit from list permissions
CREATE POLICY "Users can view list members" ON lead_list_members FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM lead_lists
        WHERE lead_lists.id = lead_list_members.list_id
        AND (lead_lists.created_by = auth.uid() OR lead_lists.is_public = TRUE OR auth.uid() = ANY(lead_lists.shared_with))
    ));

-- Sync jobs: Users can view all, only admins can create (handled by Edge Function)
CREATE POLICY "Users can view sync jobs" ON sync_jobs FOR SELECT TO authenticated USING (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_case_studies_updated_at BEFORE UPDATE ON case_studies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_lead_lists_updated_at BEFORE UPDATE ON lead_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_lead_list_members_updated_at BEFORE UPDATE ON lead_list_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to update lead list company count
CREATE OR REPLACE FUNCTION update_list_company_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'DELETE' THEN
        UPDATE lead_lists
        SET company_count = (
            SELECT COUNT(*) FROM lead_list_members WHERE list_id = COALESCE(NEW.list_id, OLD.list_id)
        )
        WHERE id = COALESCE(NEW.list_id, OLD.list_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_list_count_on_member_change
    AFTER INSERT OR DELETE ON lead_list_members
    FOR EACH ROW EXECUTE FUNCTION update_list_company_count();
