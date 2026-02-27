/**
 * Create whale_composite table directly via Supabase
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xbitqeejsgqnwvxlnjra.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS whale_composite (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) UNIQUE NOT NULL,
    account_name VARCHAR(255),
    salesforce_account_id VARCHAR(18),
    abm_id VARCHAR(50),
    acc_id INTEGER,
    zoominfo_company_id BIGINT,
    journey_stage VARCHAR(50),
    days_in_journey_stage INTEGER,
    date_of_last_web_activity TIMESTAMP WITH TIME ZONE,
    engaged_known_people INTEGER,
    engagement_points_3mo DECIMAL(10,5),
    target_account VARCHAR(100),
    abx_status VARCHAR(100),
    abx_status_reason VARCHAR(255),
    abx_status_reason_description TEXT,
    gtm_tag TEXT,
    billing_country VARCHAR(100),
    naics_code VARCHAR(20),
    naics_code_priority_1 VARCHAR(20),
    naics_description_priority_1 VARCHAR(255),
    industry VARCHAR(100),
    demandbase_industry VARCHAR(100),
    demandbase_sub_industry VARCHAR(100),
    revenue BIGINT,
    revenue_range VARCHAR(50),
    expected_revenue DECIMAL(15,2),
    arr DECIMAL(15,2),
    traffic BIGINT,
    local_segment VARCHAR(50),
    account_region VARCHAR(50),
    demandbase_account_owner VARCHAR(255),
    sales_region VARCHAR(100),
    sales_sub_region VARCHAR(100),
    sales_segment VARCHAR(50),
    has_bigcommerce BOOLEAN DEFAULT FALSE,
    has_commercetools BOOLEAN DEFAULT FALSE,
    has_magento BOOLEAN DEFAULT FALSE,
    has_magento_open_source BOOLEAN DEFAULT FALSE,
    has_salesforce_b2b_commerce BOOLEAN DEFAULT FALSE,
    has_salesforce_commerce_cloud BOOLEAN DEFAULT FALSE,
    has_shopify_hosted BOOLEAN DEFAULT FALSE,
    has_shopify_plus BOOLEAN DEFAULT FALSE,
    has_shopify BOOLEAN DEFAULT FALSE,
    has_spryker BOOLEAN DEFAULT FALSE,
    zi_company_name VARCHAR(255),
    zi_company_description TEXT,
    zi_website VARCHAR(255),
    zi_founded_year INTEGER,
    zi_company_hq_phone VARCHAR(50),
    zi_fax VARCHAR(50),
    zi_ticker VARCHAR(20),
    zi_revenue_thousands BIGINT,
    zi_revenue_range VARCHAR(50),
    zi_est_marketing_budget_thousands BIGINT,
    zi_est_finance_budget_thousands BIGINT,
    zi_est_it_budget_thousands BIGINT,
    zi_est_hr_budget_thousands BIGINT,
    zi_employees INTEGER,
    zi_employee_range VARCHAR(50),
    zi_employee_growth_1yr DECIMAL(8,4),
    zi_employee_growth_2yr DECIMAL(8,4),
    zi_sic_code_1 VARCHAR(20),
    zi_sic_code_2 VARCHAR(20),
    zi_sic_codes TEXT,
    zi_naics_code_1 VARCHAR(20),
    zi_naics_code_2 VARCHAR(20),
    zi_naics_codes TEXT,
    zi_primary_industry VARCHAR(100),
    zi_primary_sub_industry VARCHAR(100),
    zi_all_industries TEXT,
    zi_all_sub_industries TEXT,
    zi_industry_hierarchical_category VARCHAR(100),
    zi_secondary_industry_hierarchical_category VARCHAR(100),
    zi_alexa_rank INTEGER,
    zi_profile_url VARCHAR(500),
    zi_linkedin_url VARCHAR(500),
    zi_facebook_url VARCHAR(500),
    zi_twitter_url VARCHAR(500),
    zi_ownership_type VARCHAR(50),
    zi_business_model VARCHAR(50),
    zi_certified_active VARCHAR(10),
    zi_certification_date VARCHAR(50),
    zi_defunct_company VARCHAR(10),
    zi_company_is_acquired VARCHAR(10),
    zi_number_of_locations INTEGER,
    zi_total_funding_thousands BIGINT,
    zi_recent_funding_thousands BIGINT,
    zi_recent_funding_round VARCHAR(50),
    zi_recent_funding_date VARCHAR(50),
    zi_recent_investors TEXT,
    zi_all_investors TEXT,
    zi_street_address VARCHAR(255),
    zi_city VARCHAR(100),
    zi_state VARCHAR(100),
    zi_zip_code VARCHAR(20),
    zi_country VARCHAR(100),
    zi_full_address TEXT,
    zi_ultimate_parent_id VARCHAR(50),
    zi_ultimate_parent_name VARCHAR(255),
    zi_immediate_parent_id VARCHAR(50),
    zi_immediate_parent_name VARCHAR(255),
    zi_immediate_parent_relationship VARCHAR(100),
    zi_match_status VARCHAR(50),
    zi_match_insight_name VARCHAR(50),
    zi_match_insight_domain VARCHAR(50),
    zi_match_insight_address VARCHAR(50),
    zi_match_insight_phone VARCHAR(50),
    zi_match_insight_id VARCHAR(50),
    zi_match_insight_social VARCHAR(50),
    source_file VARCHAR(255),
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

async function main() {
  console.log('Creating whale_composite table...');

  const { error } = await supabase.rpc('exec_sql', { sql: CREATE_TABLE_SQL });

  if (error) {
    // Try alternative: just insert a test row to see if table exists
    console.log('RPC not available, checking if table exists...');
    const { data, error: selectError } = await supabase
      .from('whale_composite')
      .select('id')
      .limit(1);

    if (selectError && selectError.code === '42P01') {
      console.error('Table does not exist. Please run the migration SQL manually:');
      console.error('Go to Supabase Dashboard > SQL Editor and run:');
      console.error('supabase/migrations/20260227_whale_composite.sql');
      process.exit(1);
    } else if (selectError) {
      console.error('Error:', selectError);
      process.exit(1);
    } else {
      console.log('Table already exists!');
    }
  } else {
    console.log('Table created successfully!');
  }
}

main();
