"""Initial schema with all 51 tables

Revision ID: 001
Revises:
Create Date: 2026-02-25

This migration creates all tables for PartnerForge v3.0:
- Core: companies, technologies, company_technologies, customer_logos (4)
- Targets: displacement_targets, competitive_intel (2)
- Evidence: case_studies, customer_quotes, proof_points, verified_case_studies (4)
- Enrichment: company_financials, executive_quotes, hiring_signals, strategic_triggers, buying_committee, enrichment_status (6)
- Intelligence: intel_* tables (15)
- Versioning: intel_snapshots, change_events, snapshot_comparisons (3)
- Alerts: alert_rules, alerts, alert_digests, alert_preferences (4)
- Platform: users, teams, territories, account_assignments, api_usage, api_budgets, api_cost_config, audit_log, system_metrics, job_executions (10)
- Lists: uploaded_lists, uploaded_list_items, list_processing_queue (3)

Total: 51 tables
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all 51 tables for PartnerForge."""

    # =========================================================================
    # CORE TABLES
    # =========================================================================

    # companies - Algolia customer companies
    op.create_table(
        'companies',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=True),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('vertical', sa.String(100), nullable=True),
        sa.Column('sub_vertical', sa.String(100), nullable=True),
        sa.Column('country', sa.String(100), nullable=True),
        sa.Column('country_code', sa.String(10), nullable=True),
        sa.Column('is_algolia_customer', sa.Boolean(), default=True, nullable=True),
        sa.Column('algolia_arr', sa.Float(), nullable=True),
        sa.Column('algolia_products', sa.Text(), nullable=True),
        sa.Column('algolia_cs_coverage', sa.String(100), nullable=True),
        sa.Column('has_logo_rights', sa.Boolean(), default=False, nullable=True),
        sa.Column('has_case_study_consent', sa.Boolean(), default=False, nullable=True),
        sa.Column('has_reference_consent', sa.Boolean(), default=False, nullable=True),
        sa.Column('partner_populations', sa.Text(), nullable=True),
        sa.Column('signed_date', sa.String(50), nullable=True),
        sa.Column('competitor_displaced', sa.String(255), nullable=True),
        sa.Column('tech_platform', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_companies_domain', 'companies', ['domain'], unique=True)
    op.create_index('ix_companies_vertical', 'companies', ['vertical'], unique=False)

    # technologies - Technology catalog
    op.create_table(
        'technologies',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('is_partner', sa.Boolean(), default=False, nullable=True),
        sa.Column('is_competitor', sa.Boolean(), default=False, nullable=True),
        sa.Column('builtwith_name', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # company_technologies - M2M relationship
    op.create_table(
        'company_technologies',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('technology_id', sa.Integer(), nullable=False),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('is_live', sa.Boolean(), default=True, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.ForeignKeyConstraint(['technology_id'], ['technologies.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'technology_id', 'source', name='uq_company_tech_source')
    )

    # customer_logos - Logo consent tracking
    op.create_table(
        'customer_logos',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('company_name', sa.String(255), nullable=False),
        sa.Column('company_domain', sa.String(255), nullable=True),
        sa.Column('company_id', sa.Integer(), nullable=True),
        sa.Column('signed_date', sa.String(50), nullable=True),
        sa.Column('vertical', sa.String(100), nullable=True),
        sa.Column('has_case_study_in_contract', sa.Boolean(), default=False, nullable=True),
        sa.Column('has_logo_rights', sa.Boolean(), default=False, nullable=True),
        sa.Column('social_completed', sa.Boolean(), default=False, nullable=True),
        sa.Column('is_reference', sa.Boolean(), default=False, nullable=True),
        sa.Column('has_press_release', sa.Boolean(), default=False, nullable=True),
        sa.Column('partner', sa.String(255), nullable=True),
        sa.Column('tech_platform', sa.String(255), nullable=True),
        sa.Column('competitor_displaced', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # =========================================================================
    # TARGET TABLES
    # =========================================================================

    # displacement_targets - Non-Algolia targets using partner tech
    op.create_table(
        'displacement_targets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=True),
        sa.Column('company_name', sa.String(255), nullable=True),
        sa.Column('partner_tech', sa.String(255), nullable=True),
        sa.Column('vertical', sa.String(100), nullable=True),
        sa.Column('country', sa.String(100), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('tech_spend', sa.Integer(), nullable=True),
        sa.Column('emails', sa.Text(), nullable=True),
        sa.Column('phones', sa.Text(), nullable=True),
        sa.Column('socials', sa.Text(), nullable=True),
        sa.Column('exec_titles', sa.Text(), nullable=True),
        sa.Column('sw_monthly_visits', sa.Integer(), nullable=True),
        sa.Column('sw_bounce_rate', sa.Float(), nullable=True),
        sa.Column('sw_pages_per_visit', sa.Float(), nullable=True),
        sa.Column('sw_avg_duration', sa.Integer(), nullable=True),
        sa.Column('sw_search_traffic_pct', sa.Float(), nullable=True),
        sa.Column('sw_rank_global', sa.Integer(), nullable=True),
        sa.Column('matched_case_studies', sa.Text(), nullable=True),
        sa.Column('lead_score', sa.Integer(), nullable=True),
        sa.Column('icp_tier', sa.Integer(), nullable=True),
        sa.Column('icp_score', sa.Integer(), nullable=True),
        sa.Column('icp_tier_name', sa.String(50), nullable=True),
        sa.Column('score_reasons', sa.Text(), nullable=True),
        sa.Column('score_breakdown', sa.Text(), nullable=True),
        sa.Column('ticker', sa.String(20), nullable=True),
        sa.Column('is_public', sa.Boolean(), default=False, nullable=True),
        sa.Column('revenue', sa.Float(), nullable=True),
        sa.Column('gross_margin', sa.Float(), nullable=True),
        sa.Column('traffic_growth', sa.Float(), nullable=True),
        sa.Column('current_search', sa.String(255), nullable=True),
        sa.Column('trigger_events', sa.Text(), nullable=True),
        sa.Column('exec_quote', sa.Text(), nullable=True),
        sa.Column('exec_name', sa.String(255), nullable=True),
        sa.Column('exec_title', sa.String(255), nullable=True),
        sa.Column('quote_source', sa.String(500), nullable=True),
        sa.Column('competitors_using_algolia', sa.Text(), nullable=True),
        sa.Column('displacement_angle', sa.Text(), nullable=True),
        sa.Column('financials_json', sa.Text(), nullable=True),
        sa.Column('hiring_signals', sa.Text(), nullable=True),
        sa.Column('tech_stack_json', sa.Text(), nullable=True),
        sa.Column('enrichment_level', sa.String(50), default='basic', nullable=True),
        sa.Column('last_enriched', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_displacement_targets_domain', 'displacement_targets', ['domain'], unique=True)
    op.create_index('idx_targets_icp_score', 'displacement_targets', ['icp_score'], unique=False)
    op.create_index('idx_targets_vertical', 'displacement_targets', ['vertical'], unique=False)
    op.create_index('idx_targets_partner', 'displacement_targets', ['partner_tech'], unique=False)
    op.create_index('idx_targets_public', 'displacement_targets', ['is_public'], unique=False)

    # competitive_intel - SimilarWeb competitor analysis
    op.create_table(
        'competitive_intel',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('target_domain', sa.String(255), nullable=False),
        sa.Column('competitor_domain', sa.String(255), nullable=False),
        sa.Column('similarity_score', sa.Float(), nullable=True),
        sa.Column('search_provider', sa.String(255), nullable=True),
        sa.Column('has_algolia', sa.Boolean(), nullable=True),
        sa.Column('partner_techs', sa.Text(), nullable=True),
        sa.Column('is_displacement_target', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_comp_intel_target', 'competitive_intel', ['target_domain'], unique=False)
    op.create_index('idx_comp_intel_competitor', 'competitive_intel', ['competitor_domain'], unique=False)

    # =========================================================================
    # EVIDENCE TABLES
    # =========================================================================

    # case_studies - Algolia customer success stories
    op.create_table(
        'case_studies',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('customer_name', sa.String(255), nullable=False),
        sa.Column('customer_domain', sa.String(255), nullable=True),
        sa.Column('company_id', sa.Integer(), nullable=True),
        sa.Column('country', sa.String(100), nullable=True),
        sa.Column('region', sa.String(100), nullable=True),
        sa.Column('vertical', sa.String(100), nullable=True),
        sa.Column('sub_vertical', sa.String(100), nullable=True),
        sa.Column('use_case', sa.String(255), nullable=True),
        sa.Column('customer_type', sa.String(100), nullable=True),
        sa.Column('story_url', sa.String(500), nullable=True),
        sa.Column('slide_deck_url', sa.String(500), nullable=True),
        sa.Column('pdf_url', sa.String(500), nullable=True),
        sa.Column('status', sa.String(50), default='Complete', nullable=True),
        sa.Column('features_used', sa.Text(), nullable=True),
        sa.Column('partner_integrations', sa.Text(), nullable=True),
        sa.Column('competitor_takeout', sa.String(255), nullable=True),
        sa.Column('key_results', sa.Text(), nullable=True),
        sa.Column('localized_urls', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_case_studies_vertical', 'case_studies', ['vertical'], unique=False)

    # customer_quotes - Attributed customer quotes
    op.create_table(
        'customer_quotes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('customer_name', sa.String(255), nullable=True),
        sa.Column('customer_domain', sa.String(255), nullable=True),
        sa.Column('company_id', sa.Integer(), nullable=True),
        sa.Column('contact_name', sa.String(255), nullable=True),
        sa.Column('contact_title', sa.String(255), nullable=True),
        sa.Column('vertical', sa.String(100), nullable=True),
        sa.Column('country', sa.String(100), nullable=True),
        sa.Column('quote_text', sa.Text(), nullable=False),
        sa.Column('evidence_type', sa.String(100), nullable=True),
        sa.Column('source', sa.String(500), nullable=True),
        sa.Column('source_date', sa.String(50), nullable=True),
        sa.Column('tags', sa.Text(), nullable=True),
        sa.Column('is_approved', sa.Boolean(), default=True, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_quotes_vertical', 'customer_quotes', ['vertical'], unique=False)

    # proof_points - Result metrics
    op.create_table(
        'proof_points',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('vertical', sa.String(100), nullable=True),
        sa.Column('theme', sa.String(255), nullable=True),
        sa.Column('customer_name', sa.String(255), nullable=True),
        sa.Column('result_text', sa.Text(), nullable=False),
        sa.Column('source', sa.String(500), nullable=True),
        sa.Column('is_shareable', sa.Boolean(), default=True, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # verified_case_studies - Verified case study URLs
    op.create_table(
        'verified_case_studies',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('company_name', sa.String(255), nullable=False),
        sa.Column('vertical', sa.String(100), nullable=True),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('headline', sa.String(500), nullable=True),
        sa.Column('result_metric', sa.String(255), nullable=True),
        sa.Column('is_verified', sa.Boolean(), default=False, nullable=True),
        sa.Column('last_verified', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_name')
    )

    # =========================================================================
    # ENRICHMENT TABLES
    # =========================================================================

    # company_financials - Yahoo Finance data
    op.create_table(
        'company_financials',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('ticker', sa.String(20), nullable=True),
        sa.Column('company_name', sa.String(255), nullable=True),
        sa.Column('revenue_fy2023', sa.Float(), nullable=True),
        sa.Column('revenue_fy2024', sa.Float(), nullable=True),
        sa.Column('revenue_fy2025', sa.Float(), nullable=True),
        sa.Column('revenue_cagr', sa.Float(), nullable=True),
        sa.Column('net_income_fy2023', sa.Float(), nullable=True),
        sa.Column('net_income_fy2024', sa.Float(), nullable=True),
        sa.Column('net_income_fy2025', sa.Float(), nullable=True),
        sa.Column('ebitda_fy2025', sa.Float(), nullable=True),
        sa.Column('ebitda_margin', sa.Float(), nullable=True),
        sa.Column('margin_zone', sa.String(20), nullable=True),
        sa.Column('ecommerce_revenue', sa.Float(), nullable=True),
        sa.Column('ecommerce_percent', sa.Float(), nullable=True),
        sa.Column('ecommerce_growth', sa.Float(), nullable=True),
        sa.Column('market_cap', sa.Float(), nullable=True),
        sa.Column('stock_price', sa.Float(), nullable=True),
        sa.Column('price_change_1y', sa.Float(), nullable=True),
        sa.Column('analyst_rating', sa.String(50), nullable=True),
        sa.Column('analyst_target_price', sa.Float(), nullable=True),
        sa.Column('data_source', sa.String(100), default='yahoo_finance', nullable=True),
        sa.Column('confidence', sa.String(20), default='high', nullable=True),
        sa.Column('last_updated', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_company_financials_domain', 'company_financials', ['domain'], unique=True)

    # executive_quotes - Earnings call quotes
    op.create_table(
        'executive_quotes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('speaker_name', sa.String(255), nullable=False),
        sa.Column('speaker_title', sa.String(255), nullable=True),
        sa.Column('quote', sa.Text(), nullable=False),
        sa.Column('source_type', sa.String(100), nullable=True),
        sa.Column('source_name', sa.String(255), nullable=True),
        sa.Column('source_url', sa.String(500), nullable=True),
        sa.Column('quote_date', sa.String(50), nullable=True),
        sa.Column('maps_to_product', sa.String(100), nullable=True),
        sa.Column('relevance_score', sa.Integer(), default=0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('domain', 'quote', name='uq_exec_quote')
    )
    op.create_index('idx_exec_quotes_domain', 'executive_quotes', ['domain'], unique=False)

    # hiring_signals - Job posting signals
    op.create_table(
        'hiring_signals',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('role_title', sa.String(255), nullable=False),
        sa.Column('team', sa.String(100), nullable=True),
        sa.Column('seniority', sa.String(50), nullable=True),
        sa.Column('signal_type', sa.String(50), nullable=True),
        sa.Column('signal_reason', sa.String(255), nullable=True),
        sa.Column('keywords_found', sa.String(500), nullable=True),
        sa.Column('careers_url', sa.String(500), nullable=True),
        sa.Column('job_url', sa.String(500), nullable=True),
        sa.Column('last_seen', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('domain', 'role_title', name='uq_hiring_role')
    )
    op.create_index('idx_hiring_domain', 'hiring_signals', ['domain'], unique=False)

    # strategic_triggers - Trigger events
    op.create_table(
        'strategic_triggers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('trigger_type', sa.String(100), nullable=False),
        sa.Column('trigger_category', sa.String(50), nullable=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('algolia_angle', sa.Text(), nullable=True),
        sa.Column('source_url', sa.String(500), nullable=True),
        sa.Column('source_date', sa.String(50), nullable=True),
        sa.Column('priority', sa.Integer(), default=0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('domain', 'title', name='uq_trigger_title')
    )
    op.create_index('idx_triggers_domain', 'strategic_triggers', ['domain'], unique=False)

    # buying_committee - Key decision makers
    op.create_table(
        'buying_committee',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('linkedin_url', sa.String(500), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('buyer_role', sa.String(50), nullable=True),
        sa.Column('priority', sa.String(50), nullable=True),
        sa.Column('priority_reason', sa.String(255), nullable=True),
        sa.Column('tenure', sa.String(100), nullable=True),
        sa.Column('previous_company', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('domain', 'name', name='uq_committee_member')
    )
    op.create_index('idx_committee_domain', 'buying_committee', ['domain'], unique=False)

    # enrichment_status - Enrichment tracking
    op.create_table(
        'enrichment_status',
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('financials_enriched', sa.Boolean(), default=False, nullable=True),
        sa.Column('quotes_enriched', sa.Boolean(), default=False, nullable=True),
        sa.Column('hiring_enriched', sa.Boolean(), default=False, nullable=True),
        sa.Column('triggers_enriched', sa.Boolean(), default=False, nullable=True),
        sa.Column('committee_enriched', sa.Boolean(), default=False, nullable=True),
        sa.Column('last_enriched', sa.DateTime(), nullable=True),
        sa.Column('enrichment_errors', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('domain')
    )
    op.create_index('ix_enrichment_status_domain', 'enrichment_status', ['domain'], unique=False)

    # =========================================================================
    # INTELLIGENCE TABLES (15 modules)
    # =========================================================================

    # intel_company_context - M01
    op.create_table(
        'intel_company_context',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('company_name', sa.String(255), nullable=True),
        sa.Column('legal_name', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('founded_year', sa.Integer(), nullable=True),
        sa.Column('employee_count', sa.Integer(), nullable=True),
        sa.Column('employee_range', sa.String(50), nullable=True),
        sa.Column('industry', sa.String(100), nullable=True),
        sa.Column('vertical', sa.String(100), nullable=True),
        sa.Column('sub_vertical', sa.String(100), nullable=True),
        sa.Column('business_model', sa.String(100), nullable=True),
        sa.Column('headquarters_city', sa.String(100), nullable=True),
        sa.Column('headquarters_state', sa.String(100), nullable=True),
        sa.Column('headquarters_country', sa.String(100), nullable=True),
        sa.Column('regions_active', sa.JSON(), nullable=True),
        sa.Column('website_url', sa.String(500), nullable=True),
        sa.Column('linkedin_url', sa.String(500), nullable=True),
        sa.Column('twitter_handle', sa.String(100), nullable=True),
        sa.Column('parent_company', sa.String(255), nullable=True),
        sa.Column('brands', sa.JSON(), nullable=True),
        sa.Column('recent_news', sa.JSON(), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_company_context_domain', 'intel_company_context', ['domain'], unique=True)

    # intel_technology_stack - M02
    op.create_table(
        'intel_technology_stack',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('tech_spend_estimate', sa.Integer(), nullable=True),
        sa.Column('tech_spend_tier', sa.String(50), nullable=True),
        sa.Column('total_technologies', sa.Integer(), nullable=True),
        sa.Column('partner_technologies', sa.JSON(), nullable=True),
        sa.Column('primary_partner', sa.String(100), nullable=True),
        sa.Column('partner_score', sa.Integer(), nullable=True),
        sa.Column('competitor_technologies', sa.JSON(), nullable=True),
        sa.Column('current_search_provider', sa.String(100), nullable=True),
        sa.Column('has_algolia', sa.Boolean(), default=False, nullable=True),
        sa.Column('ecommerce_platform', sa.String(100), nullable=True),
        sa.Column('payment_providers', sa.JSON(), nullable=True),
        sa.Column('analytics_tools', sa.JSON(), nullable=True),
        sa.Column('full_stack', sa.JSON(), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_technology_stack_domain', 'intel_technology_stack', ['domain'], unique=True)

    # intel_traffic_analysis - M03
    op.create_table(
        'intel_traffic_analysis',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('monthly_visits', sa.Integer(), nullable=True),
        sa.Column('monthly_visits_trend', sa.Float(), nullable=True),
        sa.Column('unique_visitors', sa.Integer(), nullable=True),
        sa.Column('global_rank', sa.Integer(), nullable=True),
        sa.Column('country_rank', sa.Integer(), nullable=True),
        sa.Column('pages_per_visit', sa.Float(), nullable=True),
        sa.Column('avg_visit_duration', sa.Integer(), nullable=True),
        sa.Column('bounce_rate', sa.Float(), nullable=True),
        sa.Column('direct_traffic_pct', sa.Float(), nullable=True),
        sa.Column('search_traffic_pct', sa.Float(), nullable=True),
        sa.Column('paid_search_pct', sa.Float(), nullable=True),
        sa.Column('organic_search_pct', sa.Float(), nullable=True),
        sa.Column('social_traffic_pct', sa.Float(), nullable=True),
        sa.Column('referral_traffic_pct', sa.Float(), nullable=True),
        sa.Column('email_traffic_pct', sa.Float(), nullable=True),
        sa.Column('top_countries', sa.JSON(), nullable=True),
        sa.Column('desktop_pct', sa.Float(), nullable=True),
        sa.Column('mobile_pct', sa.Float(), nullable=True),
        sa.Column('top_organic_keywords', sa.JSON(), nullable=True),
        sa.Column('top_paid_keywords', sa.JSON(), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_traffic_analysis_domain', 'intel_traffic_analysis', ['domain'], unique=True)

    # intel_financial_profile - M04
    op.create_table(
        'intel_financial_profile',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('ticker', sa.String(20), nullable=True),
        sa.Column('is_public', sa.Boolean(), default=False, nullable=True),
        sa.Column('revenue_current', sa.Float(), nullable=True),
        sa.Column('revenue_prior_year', sa.Float(), nullable=True),
        sa.Column('revenue_2_years_ago', sa.Float(), nullable=True),
        sa.Column('revenue_cagr', sa.Float(), nullable=True),
        sa.Column('fiscal_year_end', sa.String(20), nullable=True),
        sa.Column('gross_margin', sa.Float(), nullable=True),
        sa.Column('operating_margin', sa.Float(), nullable=True),
        sa.Column('net_margin', sa.Float(), nullable=True),
        sa.Column('ebitda', sa.Float(), nullable=True),
        sa.Column('ebitda_margin', sa.Float(), nullable=True),
        sa.Column('margin_zone', sa.String(20), nullable=True),
        sa.Column('margin_pressure', sa.Boolean(), default=False, nullable=True),
        sa.Column('ecommerce_revenue', sa.Float(), nullable=True),
        sa.Column('ecommerce_percent', sa.Float(), nullable=True),
        sa.Column('digital_revenue', sa.Float(), nullable=True),
        sa.Column('digital_percent', sa.Float(), nullable=True),
        sa.Column('market_cap', sa.Float(), nullable=True),
        sa.Column('stock_price', sa.Float(), nullable=True),
        sa.Column('price_change_ytd', sa.Float(), nullable=True),
        sa.Column('price_change_1y', sa.Float(), nullable=True),
        sa.Column('analyst_rating', sa.String(50), nullable=True),
        sa.Column('analyst_target_price', sa.Float(), nullable=True),
        sa.Column('analyst_count', sa.Integer(), nullable=True),
        sa.Column('addressable_revenue', sa.Float(), nullable=True),
        sa.Column('roi_scenario_low', sa.Float(), nullable=True),
        sa.Column('roi_scenario_mid', sa.Float(), nullable=True),
        sa.Column('roi_scenario_high', sa.Float(), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_financial_profile_domain', 'intel_financial_profile', ['domain'], unique=True)

    # intel_competitor_intelligence - M05
    op.create_table(
        'intel_competitor_intelligence',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('competitors', sa.JSON(), nullable=True),
        sa.Column('competitor_count', sa.Integer(), nullable=True),
        sa.Column('competitors_with_algolia', sa.JSON(), nullable=True),
        sa.Column('competitors_with_elasticsearch', sa.JSON(), nullable=True),
        sa.Column('competitors_with_coveo', sa.JSON(), nullable=True),
        sa.Column('competitors_with_other', sa.JSON(), nullable=True),
        sa.Column('market_position', sa.String(50), nullable=True),
        sa.Column('market_share_estimate', sa.Float(), nullable=True),
        sa.Column('first_mover_opportunity', sa.Boolean(), default=False, nullable=True),
        sa.Column('competitive_pressure_score', sa.Integer(), nullable=True),
        sa.Column('displacement_angle', sa.Text(), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_competitor_intelligence_domain', 'intel_competitor_intelligence', ['domain'], unique=True)

    # intel_hiring_signals - M06
    op.create_table(
        'intel_hiring_signals',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('total_roles', sa.Integer(), nullable=True),
        sa.Column('hot_signals', sa.Integer(), nullable=True),
        sa.Column('warm_signals', sa.Integer(), nullable=True),
        sa.Column('caution_signals', sa.Integer(), nullable=True),
        sa.Column('signals', sa.JSON(), nullable=True),
        sa.Column('signal_score', sa.Integer(), nullable=True),
        sa.Column('vp_roles', sa.JSON(), nullable=True),
        sa.Column('director_roles', sa.JSON(), nullable=True),
        sa.Column('technical_roles', sa.JSON(), nullable=True),
        sa.Column('search_keywords_found', sa.Boolean(), default=False, nullable=True),
        sa.Column('algolia_mentioned', sa.Boolean(), default=False, nullable=True),
        sa.Column('elasticsearch_mentioned', sa.Boolean(), default=False, nullable=True),
        sa.Column('budget_owner_hiring', sa.Boolean(), default=False, nullable=True),
        sa.Column('team_expansion', sa.Boolean(), default=False, nullable=True),
        sa.Column('careers_url', sa.String(500), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_hiring_signals_domain', 'intel_hiring_signals', ['domain'], unique=True)

    # intel_strategic_context - M07
    op.create_table(
        'intel_strategic_context',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('strategic_priorities', sa.JSON(), nullable=True),
        sa.Column('digital_transformation', sa.Boolean(), default=False, nullable=True),
        sa.Column('platform_migration', sa.Boolean(), default=False, nullable=True),
        sa.Column('trigger_events', sa.JSON(), nullable=True),
        sa.Column('trigger_score', sa.Integer(), nullable=True),
        sa.Column('recent_announcements', sa.JSON(), nullable=True),
        sa.Column('press_releases', sa.JSON(), nullable=True),
        sa.Column('leadership_changes', sa.JSON(), nullable=True),
        sa.Column('industry_trends', sa.JSON(), nullable=True),
        sa.Column('regulatory_factors', sa.JSON(), nullable=True),
        sa.Column('fiscal_year_end', sa.String(20), nullable=True),
        sa.Column('budget_cycle', sa.String(50), nullable=True),
        sa.Column('renewal_timing', sa.String(100), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_strategic_context_domain', 'intel_strategic_context', ['domain'], unique=True)

    # intel_investor_intelligence - M08
    op.create_table(
        'intel_investor_intelligence',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('latest_10k_date', sa.DateTime(), nullable=True),
        sa.Column('latest_10q_date', sa.DateTime(), nullable=True),
        sa.Column('sec_risk_factors', sa.JSON(), nullable=True),
        sa.Column('sec_digital_mentions', sa.JSON(), nullable=True),
        sa.Column('latest_earnings_date', sa.DateTime(), nullable=True),
        sa.Column('earnings_themes', sa.JSON(), nullable=True),
        sa.Column('analyst_questions', sa.JSON(), nullable=True),
        sa.Column('investor_day_date', sa.DateTime(), nullable=True),
        sa.Column('strategic_initiatives', sa.JSON(), nullable=True),
        sa.Column('executive_quotes', sa.JSON(), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_investor_intelligence_domain', 'intel_investor_intelligence', ['domain'], unique=True)

    # intel_executive_intelligence - M09
    op.create_table(
        'intel_executive_intelligence',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('executives', sa.JSON(), nullable=True),
        sa.Column('quotes', sa.JSON(), nullable=True),
        sa.Column('digital_transformation_mentions', sa.Integer(), default=0, nullable=True),
        sa.Column('customer_experience_mentions', sa.Integer(), default=0, nullable=True),
        sa.Column('search_mentions', sa.Integer(), default=0, nullable=True),
        sa.Column('conversion_mentions', sa.Integer(), default=0, nullable=True),
        sa.Column('personalization_mentions', sa.Integer(), default=0, nullable=True),
        sa.Column('key_themes', sa.JSON(), nullable=True),
        sa.Column('algolia_mapping', sa.JSON(), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_executive_intelligence_domain', 'intel_executive_intelligence', ['domain'], unique=True)

    # intel_buying_committee - M10
    op.create_table(
        'intel_buying_committee',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('members', sa.JSON(), nullable=True),
        sa.Column('economic_buyer', sa.JSON(), nullable=True),
        sa.Column('technical_buyer', sa.JSON(), nullable=True),
        sa.Column('user_buyer', sa.JSON(), nullable=True),
        sa.Column('champion', sa.JSON(), nullable=True),
        sa.Column('hot_contacts', sa.JSON(), nullable=True),
        sa.Column('warm_contacts', sa.JSON(), nullable=True),
        sa.Column('cold_contacts', sa.JSON(), nullable=True),
        sa.Column('total_contacts', sa.Integer(), nullable=True),
        sa.Column('contacts_with_linkedin', sa.Integer(), nullable=True),
        sa.Column('contacts_with_email', sa.Integer(), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_buying_committee_domain', 'intel_buying_committee', ['domain'], unique=True)

    # intel_displacement_analysis - M11
    op.create_table(
        'intel_displacement_analysis',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('current_search_provider', sa.String(100), nullable=True),
        sa.Column('current_search_stack', sa.JSON(), nullable=True),
        sa.Column('estimated_current_spend', sa.Float(), nullable=True),
        sa.Column('displacement_score', sa.Integer(), nullable=True),
        sa.Column('displacement_difficulty', sa.String(50), nullable=True),
        sa.Column('displacement_timeline', sa.String(50), nullable=True),
        sa.Column('primary_angle', sa.Text(), nullable=True),
        sa.Column('secondary_angles', sa.JSON(), nullable=True),
        sa.Column('algolia_advantages', sa.JSON(), nullable=True),
        sa.Column('competitor_weaknesses', sa.JSON(), nullable=True),
        sa.Column('switching_barriers', sa.JSON(), nullable=True),
        sa.Column('risk_factors', sa.JSON(), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_displacement_analysis_domain', 'intel_displacement_analysis', ['domain'], unique=True)

    # intel_case_study_matches - M12
    op.create_table(
        'intel_case_study_matches',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('matches', sa.JSON(), nullable=True),
        sa.Column('total_matches', sa.Integer(), nullable=True),
        sa.Column('vertical_matches', sa.Integer(), nullable=True),
        sa.Column('use_case_matches', sa.Integer(), nullable=True),
        sa.Column('competitor_takeout_matches', sa.Integer(), nullable=True),
        sa.Column('primary_match', sa.JSON(), nullable=True),
        sa.Column('secondary_matches', sa.JSON(), nullable=True),
        sa.Column('relevant_proof_points', sa.JSON(), nullable=True),
        sa.Column('relevant_quotes', sa.JSON(), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_case_study_matches_domain', 'intel_case_study_matches', ['domain'], unique=True)

    # intel_icp_priority_mapping - M13
    op.create_table(
        'intel_icp_priority_mapping',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('icp_score', sa.Integer(), nullable=True),
        sa.Column('icp_tier', sa.String(20), nullable=True),
        sa.Column('vertical_score', sa.Integer(), nullable=True),
        sa.Column('traffic_score', sa.Integer(), nullable=True),
        sa.Column('tech_spend_score', sa.Integer(), nullable=True),
        sa.Column('partner_tech_score', sa.Integer(), nullable=True),
        sa.Column('score_breakdown', sa.JSON(), nullable=True),
        sa.Column('score_reasons', sa.JSON(), nullable=True),
        sa.Column('timing_factor', sa.Float(), nullable=True),
        sa.Column('competitive_factor', sa.Float(), nullable=True),
        sa.Column('budget_factor', sa.Float(), nullable=True),
        sa.Column('priority_score', sa.Integer(), nullable=True),
        sa.Column('priority_rank', sa.Integer(), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_icp_priority_mapping_domain', 'intel_icp_priority_mapping', ['domain'], unique=True)

    # intel_signal_scoring - M14
    op.create_table(
        'intel_signal_scoring',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('signal_score', sa.Integer(), nullable=True),
        sa.Column('signal_tier', sa.String(20), nullable=True),
        sa.Column('hiring_signal_score', sa.Integer(), nullable=True),
        sa.Column('executive_signal_score', sa.Integer(), nullable=True),
        sa.Column('financial_signal_score', sa.Integer(), nullable=True),
        sa.Column('competitive_signal_score', sa.Integer(), nullable=True),
        sa.Column('trigger_signal_score', sa.Integer(), nullable=True),
        sa.Column('top_signals', sa.JSON(), nullable=True),
        sa.Column('signal_summary', sa.Text(), nullable=True),
        sa.Column('urgency_score', sa.Integer(), nullable=True),
        sa.Column('optimal_timing', sa.String(100), nullable=True),
        sa.Column('recommended_actions', sa.JSON(), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_signal_scoring_domain', 'intel_signal_scoring', ['domain'], unique=True)

    # intel_strategic_signal_briefs - M15
    op.create_table(
        'intel_strategic_signal_briefs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('brief_version', sa.Integer(), default=1, nullable=True),
        sa.Column('generated_at', sa.DateTime(), nullable=True),
        sa.Column('sixty_second_story', sa.Text(), nullable=True),
        sa.Column('company_snapshot', sa.JSON(), nullable=True),
        sa.Column('timing_signals', sa.JSON(), nullable=True),
        sa.Column('in_their_own_words', sa.JSON(), nullable=True),
        sa.Column('people', sa.JSON(), nullable=True),
        sa.Column('money', sa.JSON(), nullable=True),
        sa.Column('gaps', sa.JSON(), nullable=True),
        sa.Column('competitive_landscape', sa.JSON(), nullable=True),
        sa.Column('recommended_approach', sa.Text(), nullable=True),
        sa.Column('discovery_questions', sa.JSON(), nullable=True),
        sa.Column('objection_handling', sa.JSON(), nullable=True),
        sa.Column('case_study_matches', sa.JSON(), nullable=True),
        sa.Column('full_brief_markdown', sa.Text(), nullable=True),
        sa.Column('is_approved', sa.Boolean(), default=False, nullable=True),
        sa.Column('approved_by', sa.String(255), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=False),
        sa.Column('source_date', sa.DateTime(), nullable=False),
        sa.Column('source_type', sa.String(50), default='api', nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.Column('is_stale', sa.Boolean(), default=False, nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_intel_strategic_signal_briefs_domain', 'intel_strategic_signal_briefs', ['domain'], unique=True)

    # =========================================================================
    # VERSIONING TABLES
    # =========================================================================

    # intel_snapshots - Point-in-time snapshots
    op.create_table(
        'intel_snapshots',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('module_type', sa.String(50), nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('record_id', sa.Integer(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('snapshot_at', sa.DateTime(), nullable=False),
        sa.Column('snapshot_type', sa.String(20), default='auto', nullable=True),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('source_url', sa.String(1000), nullable=True),
        sa.Column('source_date', sa.DateTime(), nullable=True),
        sa.Column('job_id', sa.String(36), nullable=True),
        sa.Column('triggered_by', sa.String(255), nullable=True),
        sa.Column('diff_from_previous', sa.JSON(), nullable=True),
        sa.Column('has_changes', sa.Boolean(), default=False, nullable=True),
        sa.Column('change_count', sa.Integer(), default=0, nullable=True),
        sa.Column('highest_significance', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('module_type', 'domain', 'version', name='uq_snapshot_version')
    )
    op.create_index('idx_snapshots_module_domain', 'intel_snapshots', ['module_type', 'domain'], unique=False)
    op.create_index('idx_snapshots_date', 'intel_snapshots', ['snapshot_at'], unique=False)
    op.create_index('idx_snapshots_has_changes', 'intel_snapshots', ['has_changes'], unique=False)
    op.create_index('ix_intel_snapshots_domain', 'intel_snapshots', ['domain'], unique=False)

    # change_events - Detected changes
    op.create_table(
        'change_events',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('snapshot_id', sa.String(36), nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('module_type', sa.String(50), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('significance', sa.String(20), nullable=False),
        sa.Column('field', sa.String(100), nullable=False),
        sa.Column('old_value', sa.JSON(), nullable=True),
        sa.Column('new_value', sa.JSON(), nullable=True),
        sa.Column('summary', sa.String(500), nullable=True),
        sa.Column('algolia_relevance', sa.String(500), nullable=True),
        sa.Column('detected_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['snapshot_id'], ['intel_snapshots.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_changes_domain', 'change_events', ['domain'], unique=False)
    op.create_index('idx_changes_category', 'change_events', ['category'], unique=False)
    op.create_index('idx_changes_significance', 'change_events', ['significance'], unique=False)
    op.create_index('idx_changes_date', 'change_events', ['detected_at'], unique=False)

    # snapshot_comparisons - Cached comparisons
    op.create_table(
        'snapshot_comparisons',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('module_type', sa.String(50), nullable=False),
        sa.Column('snapshot_old_id', sa.String(36), nullable=True),
        sa.Column('snapshot_new_id', sa.String(36), nullable=True),
        sa.Column('version_old', sa.Integer(), nullable=True),
        sa.Column('version_new', sa.Integer(), nullable=True),
        sa.Column('full_diff', sa.JSON(), nullable=True),
        sa.Column('change_summary', sa.JSON(), nullable=True),
        sa.Column('total_changes', sa.Integer(), nullable=True),
        sa.Column('highest_significance', sa.String(20), nullable=True),
        sa.Column('comparison_type', sa.String(50), nullable=True),
        sa.Column('computed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['snapshot_old_id'], ['intel_snapshots.id']),
        sa.ForeignKeyConstraint(['snapshot_new_id'], ['intel_snapshots.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_comparison_domain_module', 'snapshot_comparisons', ['domain', 'module_type'], unique=False)
    op.create_index('ix_snapshot_comparisons_domain', 'snapshot_comparisons', ['domain'], unique=False)

    # =========================================================================
    # PLATFORM TABLES (Users, Teams, API)
    # =========================================================================

    # teams - Must be created before users due to FK
    op.create_table(
        'teams',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('manager_id', sa.String(36), nullable=True),
        sa.Column('default_territory_id', sa.String(36), nullable=True),
        sa.Column('monthly_api_budget_usd', sa.Float(), default=1000.0, nullable=True),
        sa.Column('current_month_spend_usd', sa.Float(), default=0.0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_teams_name', 'teams', ['name'], unique=False)

    # users
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('role', sa.String(20), default='ae', nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=True),
        sa.Column('is_admin', sa.Boolean(), default=False, nullable=True),
        sa.Column('team_id', sa.String(36), nullable=True),
        sa.Column('timezone', sa.String(50), default='America/Los_Angeles', nullable=True),
        sa.Column('notification_settings', sa.JSON(), nullable=True),
        sa.Column('auth_provider', sa.String(50), nullable=True),
        sa.Column('auth_provider_id', sa.String(255), nullable=True),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index('idx_users_email', 'users', ['email'], unique=False)
    op.create_index('idx_users_team', 'users', ['team_id'], unique=False)
    op.create_index('idx_users_active', 'users', ['is_active'], unique=False)

    # Add manager_id FK to teams now that users exists
    op.create_foreign_key('fk_teams_manager', 'teams', 'users', ['manager_id'], ['id'])

    # territories
    op.create_table(
        'territories',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('team_id', sa.String(36), nullable=True),
        sa.Column('filters', sa.JSON(), nullable=True),
        sa.Column('account_count', sa.Integer(), default=0, nullable=True),
        sa.Column('hot_lead_count', sa.Integer(), default=0, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_territories_team', 'territories', ['team_id'], unique=False)

    # Add default_territory_id FK to teams now that territories exists
    op.create_foreign_key('fk_teams_territory', 'teams', 'territories', ['default_territory_id'], ['id'])

    # account_assignments
    op.create_table(
        'account_assignments',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('role', sa.String(20), default='owner', nullable=True),
        sa.Column('territory_id', sa.String(36), nullable=True),
        sa.Column('assigned_at', sa.DateTime(), nullable=True),
        sa.Column('assigned_by', sa.String(36), nullable=True),
        sa.Column('last_viewed', sa.DateTime(), nullable=True),
        sa.Column('last_enriched', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['assigned_by'], ['users.id']),
        sa.ForeignKeyConstraint(['territory_id'], ['territories.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('domain', 'user_id', name='uq_account_user')
    )
    op.create_index('idx_assignments_domain', 'account_assignments', ['domain'], unique=False)
    op.create_index('idx_assignments_user', 'account_assignments', ['user_id'], unique=False)
    op.create_index('idx_assignments_territory', 'account_assignments', ['territory_id'], unique=False)

    # api_usage
    op.create_table(
        'api_usage',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('endpoint', sa.String(100), nullable=False),
        sa.Column('method', sa.String(10), default='GET', nullable=True),
        sa.Column('domain', sa.String(255), nullable=True),
        sa.Column('job_id', sa.String(36), nullable=True),
        sa.Column('module_type', sa.String(50), nullable=True),
        sa.Column('user_id', sa.String(36), nullable=True),
        sa.Column('team_id', sa.String(36), nullable=True),
        sa.Column('triggered_by', sa.String(50), default='system', nullable=True),
        sa.Column('cost_usd', sa.Float(), default=0.0, nullable=True),
        sa.Column('cost_credits', sa.Float(), default=0.0, nullable=True),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('response_time_ms', sa.Integer(), nullable=True),
        sa.Column('success', sa.Boolean(), default=True, nullable=True),
        sa.Column('error_message', sa.String(500), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_usage_provider', 'api_usage', ['provider'], unique=False)
    op.create_index('idx_usage_domain', 'api_usage', ['domain'], unique=False)
    op.create_index('idx_usage_timestamp', 'api_usage', ['timestamp'], unique=False)
    op.create_index('idx_usage_team', 'api_usage', ['team_id'], unique=False)

    # api_budgets
    op.create_table(
        'api_budgets',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('scope_type', sa.String(20), nullable=False),
        sa.Column('scope_id', sa.String(36), nullable=True),
        sa.Column('period', sa.String(20), default='monthly', nullable=True),
        sa.Column('period_start', sa.DateTime(), nullable=True),
        sa.Column('period_end', sa.DateTime(), nullable=True),
        sa.Column('budget_usd', sa.Float(), nullable=False),
        sa.Column('alert_threshold_pct', sa.Integer(), default=80, nullable=True),
        sa.Column('hard_cap', sa.Boolean(), default=True, nullable=True),
        sa.Column('current_spend_usd', sa.Float(), default=0.0, nullable=True),
        sa.Column('current_call_count', sa.Integer(), default=0, nullable=True),
        sa.Column('spend_by_provider', sa.JSON(), nullable=True),
        sa.Column('alert_sent_50', sa.Boolean(), default=False, nullable=True),
        sa.Column('alert_sent_80', sa.Boolean(), default=False, nullable=True),
        sa.Column('alert_sent_100', sa.Boolean(), default=False, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_budget_scope', 'api_budgets', ['scope_type', 'scope_id'], unique=False)
    op.create_index('idx_budget_period', 'api_budgets', ['period_start', 'period_end'], unique=False)

    # api_cost_config
    op.create_table(
        'api_cost_config',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('endpoint', sa.String(100), nullable=False),
        sa.Column('cost_per_call_usd', sa.Float(), nullable=False),
        sa.Column('cost_per_credit', sa.Float(), default=1.0, nullable=True),
        sa.Column('rate_limit_rpm', sa.Integer(), nullable=True),
        sa.Column('rate_limit_daily', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=True),
        sa.Column('effective_from', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('provider', 'endpoint', name='uq_cost_config')
    )
    op.create_index('idx_cost_provider', 'api_cost_config', ['provider'], unique=False)

    # audit_log
    op.create_table(
        'audit_log',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=True),
        sa.Column('user_email', sa.String(255), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=True),
        sa.Column('resource_id', sa.String(255), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('session_id', sa.String(100), nullable=True),
        sa.Column('status', sa.String(20), default='success', nullable=True),
        sa.Column('error_message', sa.String(500), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_audit_user', 'audit_log', ['user_id'], unique=False)
    op.create_index('idx_audit_action', 'audit_log', ['action'], unique=False)
    op.create_index('idx_audit_resource', 'audit_log', ['resource_type', 'resource_id'], unique=False)
    op.create_index('idx_audit_timestamp', 'audit_log', ['timestamp'], unique=False)

    # system_metrics
    op.create_table(
        'system_metrics',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('metric_name', sa.String(100), nullable=False),
        sa.Column('metric_type', sa.String(20), nullable=False),
        sa.Column('labels', sa.JSON(), nullable=True),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('bucket', sa.String(50), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_metrics_name', 'system_metrics', ['metric_name'], unique=False)
    op.create_index('idx_metrics_timestamp', 'system_metrics', ['timestamp'], unique=False)
    op.create_index('idx_metrics_name_time', 'system_metrics', ['metric_name', 'timestamp'], unique=False)

    # job_executions
    op.create_table(
        'job_executions',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('job_type', sa.String(50), nullable=False),
        sa.Column('domain', sa.String(255), nullable=True),
        sa.Column('batch_domains', sa.JSON(), nullable=True),
        sa.Column('modules', sa.JSON(), nullable=True),
        sa.Column('waves', sa.JSON(), nullable=True),
        sa.Column('force', sa.Boolean(), default=False, nullable=True),
        sa.Column('status', sa.String(20), default='queued', nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('total_steps', sa.Integer(), nullable=True),
        sa.Column('completed_steps', sa.Integer(), nullable=True),
        sa.Column('current_step', sa.String(100), nullable=True),
        sa.Column('modules_completed', sa.JSON(), nullable=True),
        sa.Column('modules_failed', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('triggered_by', sa.String(255), nullable=True),
        sa.Column('trigger_source', sa.String(50), nullable=True),
        sa.Column('checkpoint', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_jobs_domain', 'job_executions', ['domain'], unique=False)
    op.create_index('idx_jobs_status', 'job_executions', ['status'], unique=False)
    op.create_index('idx_jobs_created', 'job_executions', ['created_at'], unique=False)

    # =========================================================================
    # ALERT TABLES
    # =========================================================================

    # alert_rules
    op.create_table(
        'alert_rules',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=True),
        sa.Column('conditions', sa.JSON(), nullable=False),
        sa.Column('channels', sa.JSON(), nullable=True),
        sa.Column('frequency', sa.String(20), default='immediate', nullable=True),
        sa.Column('trigger_count', sa.Integer(), default=0, nullable=True),
        sa.Column('last_triggered', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_rules_user', 'alert_rules', ['user_id'], unique=False)
    op.create_index('idx_rules_active', 'alert_rules', ['is_active'], unique=False)

    # alerts
    op.create_table(
        'alerts',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('rule_id', sa.String(36), nullable=True),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('module_type', sa.String(50), nullable=True),
        sa.Column('snapshot_id', sa.String(36), nullable=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('summary', sa.String(1000), nullable=True),
        sa.Column('changes', sa.JSON(), nullable=True),
        sa.Column('significance', sa.String(20), nullable=True),
        sa.Column('recommended_action', sa.String(500), nullable=True),
        sa.Column('algolia_opportunity', sa.String(500), nullable=True),
        sa.Column('status', sa.String(20), default='unread', nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('dismissed_at', sa.DateTime(), nullable=True),
        sa.Column('acted_at', sa.DateTime(), nullable=True),
        sa.Column('delivered_channels', sa.JSON(), nullable=True),
        sa.Column('delivery_status', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['rule_id'], ['alert_rules.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['snapshot_id'], ['intel_snapshots.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_alerts_user', 'alerts', ['user_id'], unique=False)
    op.create_index('idx_alerts_domain', 'alerts', ['domain'], unique=False)
    op.create_index('idx_alerts_status', 'alerts', ['status'], unique=False)
    op.create_index('idx_alerts_created', 'alerts', ['created_at'], unique=False)
    op.create_index('idx_alerts_significance', 'alerts', ['significance'], unique=False)

    # alert_digests
    op.create_table(
        'alert_digests',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('digest_type', sa.String(20), nullable=False),
        sa.Column('period_start', sa.DateTime(), nullable=False),
        sa.Column('period_end', sa.DateTime(), nullable=False),
        sa.Column('alert_count', sa.Integer(), default=0, nullable=True),
        sa.Column('alert_ids', sa.JSON(), nullable=True),
        sa.Column('critical_count', sa.Integer(), default=0, nullable=True),
        sa.Column('high_count', sa.Integer(), default=0, nullable=True),
        sa.Column('medium_count', sa.Integer(), default=0, nullable=True),
        sa.Column('summary_by_category', sa.JSON(), nullable=True),
        sa.Column('summary_by_domain', sa.JSON(), nullable=True),
        sa.Column('html_content', sa.Text(), nullable=True),
        sa.Column('text_content', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), default='pending', nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.String(500), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_digests_user', 'alert_digests', ['user_id'], unique=False)
    op.create_index('idx_digests_period', 'alert_digests', ['period_start', 'period_end'], unique=False)
    op.create_index('idx_digests_status', 'alert_digests', ['status'], unique=False)

    # alert_preferences
    op.create_table(
        'alert_preferences',
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('alerts_enabled', sa.Boolean(), default=True, nullable=True),
        sa.Column('email_enabled', sa.Boolean(), default=True, nullable=True),
        sa.Column('slack_enabled', sa.Boolean(), default=False, nullable=True),
        sa.Column('in_app_enabled', sa.Boolean(), default=True, nullable=True),
        sa.Column('digest_frequency', sa.String(20), default='daily', nullable=True),
        sa.Column('digest_time', sa.String(10), default='09:00', nullable=True),
        sa.Column('quiet_hours_enabled', sa.Boolean(), default=False, nullable=True),
        sa.Column('quiet_hours_start', sa.String(10), nullable=True),
        sa.Column('quiet_hours_end', sa.String(10), nullable=True),
        sa.Column('quiet_hours_timezone', sa.String(50), nullable=True),
        sa.Column('min_significance_email', sa.String(20), default='high', nullable=True),
        sa.Column('min_significance_slack', sa.String(20), default='critical', nullable=True),
        sa.Column('slack_channel_id', sa.String(50), nullable=True),
        sa.Column('slack_dm_enabled', sa.Boolean(), default=True, nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('user_id')
    )

    # =========================================================================
    # LIST TABLES (CSV Import)
    # =========================================================================

    # uploaded_lists
    op.create_table(
        'uploaded_lists',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('team_id', sa.String(36), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('source', sa.String(100), default='manual', nullable=True),
        sa.Column('original_filename', sa.String(255), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('file_path', sa.String(500), nullable=True),
        sa.Column('file_hash', sa.String(64), nullable=True),
        sa.Column('total_rows', sa.Integer(), default=0, nullable=True),
        sa.Column('valid_rows', sa.Integer(), default=0, nullable=True),
        sa.Column('invalid_rows', sa.Integer(), default=0, nullable=True),
        sa.Column('duplicate_rows', sa.Integer(), default=0, nullable=True),
        sa.Column('skipped_rows', sa.Integer(), default=0, nullable=True),
        sa.Column('detected_columns', sa.JSON(), nullable=True),
        sa.Column('column_mapping', sa.JSON(), nullable=True),
        sa.Column('mapping_confidence', sa.String(20), nullable=True),
        sa.Column('mapping_confirmed', sa.Boolean(), default=False, nullable=True),
        sa.Column('status', sa.String(50), default='uploaded', nullable=True),
        sa.Column('processed_count', sa.Integer(), default=0, nullable=True),
        sa.Column('success_count', sa.Integer(), default=0, nullable=True),
        sa.Column('error_count', sa.Integer(), default=0, nullable=True),
        sa.Column('enrichment_job_id', sa.String(36), nullable=True),
        sa.Column('enrichment_modules', sa.JSON(), nullable=True),
        sa.Column('enrichment_priority', sa.String(20), default='normal', nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('parsing_started_at', sa.DateTime(), nullable=True),
        sa.Column('parsing_completed_at', sa.DateTime(), nullable=True),
        sa.Column('validation_started_at', sa.DateTime(), nullable=True),
        sa.Column('validation_completed_at', sa.DateTime(), nullable=True),
        sa.Column('enrichment_started_at', sa.DateTime(), nullable=True),
        sa.Column('enrichment_completed_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_details', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_lists_user', 'uploaded_lists', ['user_id'], unique=False)
    op.create_index('idx_lists_team', 'uploaded_lists', ['team_id'], unique=False)
    op.create_index('idx_lists_status', 'uploaded_lists', ['status'], unique=False)
    op.create_index('idx_lists_created', 'uploaded_lists', ['created_at'], unique=False)
    op.create_index('idx_lists_source', 'uploaded_lists', ['source'], unique=False)

    # uploaded_list_items
    op.create_table(
        'uploaded_list_items',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('list_id', sa.String(36), nullable=False),
        sa.Column('row_number', sa.Integer(), nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('company_name', sa.String(255), nullable=True),
        sa.Column('salesforce_id', sa.String(50), nullable=True),
        sa.Column('demandbase_id', sa.String(50), nullable=True),
        sa.Column('hubspot_id', sa.String(50), nullable=True),
        sa.Column('csv_data', sa.JSON(), nullable=True),
        sa.Column('pre_existing_revenue', sa.JSON(), nullable=True),
        sa.Column('pre_existing_traffic', sa.JSON(), nullable=True),
        sa.Column('pre_existing_tech_stack', sa.JSON(), nullable=True),
        sa.Column('pre_existing_industry', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(50), default='pending', nullable=True),
        sa.Column('validation_errors', sa.JSON(), nullable=True),
        sa.Column('validated_at', sa.DateTime(), nullable=True),
        sa.Column('enrichment_job_id', sa.String(36), nullable=True),
        sa.Column('enrichment_started_at', sa.DateTime(), nullable=True),
        sa.Column('enrichment_completed_at', sa.DateTime(), nullable=True),
        sa.Column('displacement_target_id', sa.Integer(), nullable=True),
        sa.Column('existing_target_id', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), default=0, nullable=True),
        sa.Column('last_error_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['list_id'], ['uploaded_lists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['displacement_target_id'], ['displacement_targets.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('list_id', 'row_number', name='uq_item_row')
    )
    op.create_index('idx_items_list', 'uploaded_list_items', ['list_id'], unique=False)
    op.create_index('idx_items_domain', 'uploaded_list_items', ['domain'], unique=False)
    op.create_index('idx_items_status', 'uploaded_list_items', ['status'], unique=False)
    op.create_index('idx_items_salesforce', 'uploaded_list_items', ['salesforce_id'], unique=False)

    # list_processing_queue
    op.create_table(
        'list_processing_queue',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('list_id', sa.String(36), nullable=True),
        sa.Column('item_id', sa.String(36), nullable=True),
        sa.Column('priority', sa.Integer(), default=5, nullable=True),
        sa.Column('status', sa.String(50), default='queued', nullable=True),
        sa.Column('worker_id', sa.String(100), nullable=True),
        sa.Column('claimed_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('attempts', sa.Integer(), default=0, nullable=True),
        sa.Column('max_attempts', sa.Integer(), default=3, nullable=True),
        sa.Column('next_retry_at', sa.DateTime(), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['list_id'], ['uploaded_lists.id']),
        sa.ForeignKeyConstraint(['item_id'], ['uploaded_list_items.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_queue_status_priority', 'list_processing_queue', ['status', 'priority'], unique=False)
    op.create_index('idx_queue_list', 'list_processing_queue', ['list_id'], unique=False)
    op.create_index('idx_queue_next_retry', 'list_processing_queue', ['next_retry_at'], unique=False)


def downgrade() -> None:
    """Drop all tables in reverse order."""
    # Lists
    op.drop_table('list_processing_queue')
    op.drop_table('uploaded_list_items')
    op.drop_table('uploaded_lists')

    # Alerts
    op.drop_table('alert_preferences')
    op.drop_table('alert_digests')
    op.drop_table('alerts')
    op.drop_table('alert_rules')

    # Platform
    op.drop_table('job_executions')
    op.drop_table('system_metrics')
    op.drop_table('audit_log')
    op.drop_table('api_cost_config')
    op.drop_table('api_budgets')
    op.drop_table('api_usage')
    op.drop_table('account_assignments')

    # Drop FK constraints before dropping tables
    op.drop_constraint('fk_teams_territory', 'teams', type_='foreignkey')
    op.drop_table('territories')
    op.drop_constraint('fk_teams_manager', 'teams', type_='foreignkey')
    op.drop_table('users')
    op.drop_table('teams')

    # Versioning
    op.drop_table('snapshot_comparisons')
    op.drop_table('change_events')
    op.drop_table('intel_snapshots')

    # Intelligence (M15 to M01)
    op.drop_table('intel_strategic_signal_briefs')
    op.drop_table('intel_signal_scoring')
    op.drop_table('intel_icp_priority_mapping')
    op.drop_table('intel_case_study_matches')
    op.drop_table('intel_displacement_analysis')
    op.drop_table('intel_buying_committee')
    op.drop_table('intel_executive_intelligence')
    op.drop_table('intel_investor_intelligence')
    op.drop_table('intel_strategic_context')
    op.drop_table('intel_hiring_signals')
    op.drop_table('intel_competitor_intelligence')
    op.drop_table('intel_financial_profile')
    op.drop_table('intel_traffic_analysis')
    op.drop_table('intel_technology_stack')
    op.drop_table('intel_company_context')

    # Enrichment
    op.drop_table('enrichment_status')
    op.drop_table('buying_committee')
    op.drop_table('strategic_triggers')
    op.drop_table('hiring_signals')
    op.drop_table('executive_quotes')
    op.drop_table('company_financials')

    # Evidence
    op.drop_table('verified_case_studies')
    op.drop_table('proof_points')
    op.drop_table('customer_quotes')
    op.drop_table('case_studies')

    # Targets
    op.drop_table('competitive_intel')
    op.drop_table('displacement_targets')

    # Core
    op.drop_table('customer_logos')
    op.drop_table('company_technologies')
    op.drop_table('technologies')
    op.drop_table('companies')
