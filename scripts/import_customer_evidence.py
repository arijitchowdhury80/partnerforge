#!/usr/bin/env python3
"""
PartnerForge: Import Customer Evidence Excel into Database

This script reads the "Customer Evidence - Algolia.xlsx" file and imports
all relevant data into the PartnerForge database.

Usage:
    python import_customer_evidence.py [--db sqlite|supabase] [--supabase-url URL] [--supabase-key KEY]

Sheets imported:
    - Cust.Logos (1307 rows) → companies, customer_logos
    - Cust.Quotes (379 rows) → customer_quotes
    - Cust. Stories (82 rows) → case_studies
    - Cust. Proofpoints (81 rows) → proof_points
    - Case Studies (134 rows) → case_studies (merged)
    - Adobe (390 rows) → companies (with partner tech)
    - Vertical sheets (Fashion, Grocery, etc.) → enrichment
"""

import pandas as pd
import sqlite3
import json
import re
import os
from datetime import datetime
from typing import Optional, List, Any
import argparse

# Path to Excel file
EXCEL_PATH = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/Customer Evidence - Algolia.xlsx"
DB_PATH = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/PartnerForge/data/partnerforge.db"


def extract_domain(url_or_name: str) -> Optional[str]:
    """Extract domain from URL or company name."""
    if pd.isna(url_or_name):
        return None

    url_or_name = str(url_or_name).strip().lower()

    # If it looks like a URL
    if 'http' in url_or_name or '.' in url_or_name:
        # Remove protocol
        url_or_name = re.sub(r'^https?://', '', url_or_name)
        # Remove www
        url_or_name = re.sub(r'^www\.', '', url_or_name)
        # Get just the domain
        url_or_name = url_or_name.split('/')[0]
        return url_or_name if url_or_name else None

    return None


def clean_string(val: Any) -> Optional[str]:
    """Clean and normalize string values."""
    if pd.isna(val):
        return None
    val = str(val).strip()
    return val if val else None


def parse_date(val: Any) -> Optional[str]:
    """Parse date to ISO format."""
    if pd.isna(val):
        return None
    try:
        if isinstance(val, datetime):
            return val.strftime('%Y-%m-%d')
        return pd.to_datetime(val).strftime('%Y-%m-%d')
    except (ValueError, TypeError):
        return None


def parse_features(row: pd.Series, feature_columns: List[str]) -> List[str]:
    """Extract features that are marked with checkmarks."""
    features = []
    for col in feature_columns:
        if col in row.index:
            val = row[col]
            if pd.notna(val) and str(val).strip() in ['✅', 'Yes', 'TRUE', '1', 'X', 'x']:
                # Clean column name to feature name
                feature_name = col.replace('\n', ' ').strip()
                features.append(feature_name)
    return features


class PartnerForgeImporter:
    def __init__(self, db_type: str = 'sqlite', supabase_url: str = None, supabase_key: str = None):
        self.db_type = db_type
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.conn = None
        self.stats = {
            'companies': 0,
            'customer_logos': 0,
            'customer_quotes': 0,
            'case_studies': 0,
            'proof_points': 0,
            'company_technologies': 0,
        }

    def connect(self):
        """Connect to database."""
        if self.db_type == 'sqlite':
            os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
            self.conn = sqlite3.connect(DB_PATH)
            self.conn.row_factory = sqlite3.Row
            self._create_sqlite_schema()
        else:
            # Supabase connection would go here
            raise NotImplementedError("Supabase import not yet implemented")

    def _create_sqlite_schema(self):
        """Create SQLite schema (simplified version of Supabase schema)."""
        cursor = self.conn.cursor()

        # Companies table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT UNIQUE,
                name TEXT,
                vertical TEXT,
                sub_vertical TEXT,
                country TEXT,
                country_code TEXT,

                -- Algolia status
                is_algolia_customer INTEGER DEFAULT 1,
                algolia_arr REAL,
                algolia_products TEXT,  -- JSON array
                algolia_cs_coverage TEXT,

                -- Consent
                has_logo_rights INTEGER DEFAULT 0,
                has_case_study_consent INTEGER DEFAULT 0,
                has_reference_consent INTEGER DEFAULT 0,

                -- Partner info
                partner_populations TEXT,  -- JSON array

                -- Metadata
                signed_date TEXT,
                competitor_displaced TEXT,
                tech_platform TEXT,
                notes TEXT,

                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Technologies table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS technologies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                category TEXT,
                is_partner INTEGER DEFAULT 0,
                is_competitor INTEGER DEFAULT 0,
                builtwith_name TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Company-Technology junction
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS company_technologies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER REFERENCES companies(id),
                technology_id INTEGER REFERENCES technologies(id),
                source TEXT,
                is_live INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_id, technology_id, source)
            )
        ''')

        # Customer logos
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS customer_logos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_name TEXT NOT NULL,
                company_domain TEXT,
                company_id INTEGER REFERENCES companies(id),

                signed_date TEXT,
                vertical TEXT,

                has_case_study_in_contract INTEGER DEFAULT 0,
                has_logo_rights INTEGER DEFAULT 0,
                social_completed INTEGER DEFAULT 0,
                is_reference INTEGER DEFAULT 0,
                has_press_release INTEGER DEFAULT 0,

                partner TEXT,
                tech_platform TEXT,
                competitor_displaced TEXT,
                notes TEXT,

                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Case studies
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS case_studies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_name TEXT NOT NULL,
                customer_domain TEXT,
                company_id INTEGER REFERENCES companies(id),

                country TEXT,
                region TEXT,
                vertical TEXT,
                sub_vertical TEXT,
                use_case TEXT,
                customer_type TEXT,

                story_url TEXT,
                slide_deck_url TEXT,
                pdf_url TEXT,
                status TEXT DEFAULT 'Complete',

                features_used TEXT,  -- JSON array
                partner_integrations TEXT,  -- JSON array
                competitor_takeout TEXT,
                key_results TEXT,

                localized_urls TEXT,  -- JSON object

                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Customer quotes
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS customer_quotes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_name TEXT,
                customer_domain TEXT,
                company_id INTEGER REFERENCES companies(id),

                contact_name TEXT,
                contact_title TEXT,
                vertical TEXT,
                country TEXT,

                quote_text TEXT NOT NULL,
                evidence_type TEXT,
                source TEXT,
                source_date TEXT,

                tags TEXT,  -- JSON array
                is_approved INTEGER DEFAULT 1,

                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Proof points
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS proof_points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vertical TEXT,
                theme TEXT,
                customer_name TEXT,

                result_text TEXT NOT NULL,
                source TEXT,
                is_shareable INTEGER DEFAULT 1,

                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Create indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_companies_vertical ON companies(vertical)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_case_studies_vertical ON case_studies(vertical)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_quotes_vertical ON customer_quotes(vertical)')

        self.conn.commit()
        print("✅ SQLite schema created")

    def _get_or_create_company(self, domain: str, name: str = None, **kwargs) -> int:
        """Get existing company or create new one."""
        cursor = self.conn.cursor()

        if domain:
            cursor.execute('SELECT id FROM companies WHERE domain = ?', (domain,))
            row = cursor.fetchone()
            if row:
                return row[0]

        # Create new company
        columns = ['domain', 'name'] + list(kwargs.keys())
        values = [domain, name] + list(kwargs.values())
        placeholders = ','.join(['?' for _ in values])

        cursor.execute(f'''
            INSERT INTO companies ({','.join(columns)})
            VALUES ({placeholders})
        ''', values)

        self.conn.commit()
        self.stats['companies'] += 1
        return cursor.lastrowid

    def _get_or_create_technology(self, name: str, category: str = None, is_partner: int = 0) -> int:
        """Get existing technology or create new one."""
        cursor = self.conn.cursor()

        cursor.execute('SELECT id FROM technologies WHERE name = ?', (name,))
        row = cursor.fetchone()
        if row:
            return row[0]

        cursor.execute('''
            INSERT INTO technologies (name, category, is_partner)
            VALUES (?, ?, ?)
        ''', (name, category, is_partner))

        self.conn.commit()
        return cursor.lastrowid

    def import_customer_logos(self, xlsx: pd.ExcelFile):
        """Import Cust.Logos sheet."""
        print("\n📋 Importing Cust.Logos...")

        df = pd.read_excel(xlsx, sheet_name='Cust.Logos', header=1)

        # Find actual column names (they vary)
        col_map = {}
        for col in df.columns:
            col_lower = str(col).lower()
            if 'company' in col_lower and 'unnamed' not in col_lower:
                col_map['company'] = col
            elif 'industry' in col_lower:
                col_map['industry'] = col
            elif 'case study' in col_lower and 'contract' in col_lower:
                col_map['case_study_contract'] = col
            elif 'logo' in col_lower and 'right' in col_lower:
                col_map['logo_rights'] = col
            elif 'social' in col_lower:
                col_map['social'] = col
            elif 'reference' in col_lower:
                col_map['reference'] = col
            elif 'press' in col_lower:
                col_map['press'] = col
            elif 'partner' in col_lower:
                col_map['partner'] = col
            elif 'tech' in col_lower and 'platform' in col_lower:
                col_map['tech_platform'] = col
            elif 'competitor' in col_lower:
                col_map['competitor'] = col
            elif 'note' in col_lower:
                col_map['notes'] = col
            elif 'signed' in col_lower or 'date' in col_lower:
                col_map['signed_date'] = col

        cursor = self.conn.cursor()
        imported = 0

        for _, row in df.iterrows():
            company_name = clean_string(row.get(col_map.get('company')))
            if not company_name:
                continue

            vertical = clean_string(row.get(col_map.get('industry')))

            # Try to get domain from company name
            domain = extract_domain(company_name)

            # Get or create company
            company_id = None
            if domain:
                company_id = self._get_or_create_company(
                    domain=domain,
                    name=company_name,
                    vertical=vertical,
                    is_algolia_customer=1
                )

            # Insert logo record
            cursor.execute('''
                INSERT INTO customer_logos (
                    company_name, company_domain, company_id, vertical,
                    signed_date, has_case_study_in_contract, has_logo_rights,
                    social_completed, is_reference, has_press_release,
                    partner, tech_platform, competitor_displaced, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                company_name,
                domain,
                company_id,
                vertical,
                parse_date(row.get(col_map.get('signed_date'))),
                1 if clean_string(row.get(col_map.get('case_study_contract'))) in ['Yes', 'yes', '1', 'TRUE'] else 0,
                1 if clean_string(row.get(col_map.get('logo_rights'))) in ['Yes', 'yes', '1', 'TRUE'] else 0,
                1 if pd.notna(row.get(col_map.get('social'))) else 0,
                1 if clean_string(row.get(col_map.get('reference'))) in ['Yes', 'yes', '1', 'TRUE'] else 0,
                1 if clean_string(row.get(col_map.get('press'))) in ['Yes', 'yes', '1', 'TRUE'] else 0,
                clean_string(row.get(col_map.get('partner'))),
                clean_string(row.get(col_map.get('tech_platform'))),
                clean_string(row.get(col_map.get('competitor'))),
                clean_string(row.get(col_map.get('notes')))
            ))
            imported += 1

        self.conn.commit()
        self.stats['customer_logos'] = imported
        print(f"   ✅ Imported {imported} customer logos")

    def import_customer_quotes(self, xlsx: pd.ExcelFile):
        """Import Cust.Quotes sheet."""
        print("\n💬 Importing Cust.Quotes...")

        df = pd.read_excel(xlsx, sheet_name='Cust.Quotes')

        cursor = self.conn.cursor()
        imported = 0

        for _, row in df.iterrows():
            quote_text = clean_string(row.get('Evidence (Check out the full reviews on TrustRadius and G2)'))
            if not quote_text:
                continue

            customer_name = clean_string(row.get('Customer'))
            domain = extract_domain(customer_name)

            cursor.execute('''
                INSERT INTO customer_quotes (
                    customer_name, customer_domain, contact_name, contact_title,
                    vertical, country, quote_text, evidence_type, source,
                    source_date, tags
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                customer_name,
                domain,
                clean_string(row.get('Name')),
                clean_string(row.get('Title')),
                clean_string(row.get('Industry')),
                clean_string(row.get('Country')),
                quote_text,
                clean_string(row.get('Evidence Type')),
                clean_string(row.get('Source')),
                parse_date(row.get('Date')),
                json.dumps([clean_string(row.get('Notes/Tags'))]) if pd.notna(row.get('Notes/Tags')) else None
            ))
            imported += 1

        self.conn.commit()
        self.stats['customer_quotes'] = imported
        print(f"   ✅ Imported {imported} customer quotes")

    def import_customer_stories(self, xlsx: pd.ExcelFile):
        """Import Cust. Stories sheet (detailed case studies with features)."""
        print("\n📖 Importing Cust. Stories...")

        df = pd.read_excel(xlsx, sheet_name='Cust. Stories')

        # Feature columns to check
        feature_cols = [
            'A/B Testing', 'Advanced Perso \n(AI Perso)', 'Agent Studio', 'Analytics',
            'Autocomplete', 'Browse', 'Data Enrichment', 'Data Transformation',
            'DRR', 'Dynamic Synonyms', 'Facets and Filters', 'Generative Experiences',
            'Merch. Studio', 'Multi Signal Ranking ', 'NeuralSearch', 'Personalization',
            'Query Categorization', 'Query Suggestions', 'Recommend', 'Rules', 'Visual Editor'
        ]

        cursor = self.conn.cursor()
        imported = 0

        for _, row in df.iterrows():
            customer_name = clean_string(row.get(' Customer'))  # Note: leading space in column name
            if not customer_name:
                continue

            url = clean_string(row.get(' URL'))
            domain = extract_domain(url) or extract_domain(customer_name)

            # Extract features used
            features = parse_features(row, feature_cols)

            # Extract localized URLs
            localized = {}
            if pd.notna(row.get('FR URL ')):
                localized['fr'] = clean_string(row.get('FR URL '))
            if pd.notna(row.get('GE URL ')):
                localized['de'] = clean_string(row.get('GE URL '))
            if pd.notna(row.get('ES URL ')):
                localized['es'] = clean_string(row.get('ES URL '))
            if pd.notna(row.get('PT URL ')):
                localized['pt'] = clean_string(row.get('PT URL '))

            cursor.execute('''
                INSERT INTO case_studies (
                    customer_name, customer_domain, country, region, vertical,
                    use_case, story_url, status, features_used, localized_urls
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                customer_name,
                domain,
                clean_string(row.get('Country')),
                clean_string(row.get('Region')),
                clean_string(row.get('Industry')),
                clean_string(row.get('Use Case')),
                url,
                'Complete',
                json.dumps(features) if features else None,
                json.dumps(localized) if localized else None
            ))
            imported += 1

        self.conn.commit()
        self.stats['case_studies'] += imported
        print(f"   ✅ Imported {imported} customer stories")

    def import_case_studies(self, xlsx: pd.ExcelFile):
        """Import Case Studies sheet."""
        print("\n📚 Importing Case Studies...")

        df = pd.read_excel(xlsx, sheet_name='Case Studies')

        cursor = self.conn.cursor()
        imported = 0

        for _, row in df.iterrows():
            customer_name = clean_string(row.get('Customer'))
            if not customer_name:
                continue

            # Check if already exists from Cust. Stories
            cursor.execute('SELECT id FROM case_studies WHERE customer_name = ?', (customer_name,))
            existing = cursor.fetchone()

            story_link = clean_string(row.get('Story Link'))
            slide_deck = clean_string(row.get('Slide Deck'))

            # Parse partner integrations
            partners = clean_string(row.get('Partners/Integrations'))
            partner_list = [p.strip() for p in partners.split(',')] if partners else []

            if existing:
                # Update existing record
                cursor.execute('''
                    UPDATE case_studies SET
                        story_url = COALESCE(?, story_url),
                        slide_deck_url = ?,
                        status = ?,
                        customer_type = ?,
                        sub_vertical = ?,
                        competitor_takeout = ?,
                        partner_integrations = ?,
                        key_results = ?
                    WHERE id = ?
                ''', (
                    story_link,
                    slide_deck,
                    clean_string(row.get('Status')),
                    clean_string(row.get('Customer Type/Persona')),
                    clean_string(row.get('Sub Category')),
                    clean_string(row.get('Competitor Takeout')),
                    json.dumps(partner_list) if partner_list else None,
                    clean_string(row.get('Key Results / Metrics')),
                    existing[0]
                ))
            else:
                # Insert new record
                cursor.execute('''
                    INSERT INTO case_studies (
                        customer_name, country, vertical, customer_type,
                        sub_vertical, story_url, slide_deck_url, status,
                        competitor_takeout, partner_integrations, key_results
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    customer_name,
                    clean_string(row.get('Country')),
                    clean_string(row.get('Customer Type/Persona')),  # This sheet uses this as vertical
                    clean_string(row.get('Customer Type/Persona')),
                    clean_string(row.get('Sub Category')),
                    story_link,
                    slide_deck,
                    clean_string(row.get('Status')) or 'Complete',
                    clean_string(row.get('Competitor Takeout')),
                    json.dumps(partner_list) if partner_list else None,
                    clean_string(row.get('Key Results / Metrics'))
                ))
                imported += 1

        self.conn.commit()
        self.stats['case_studies'] += imported
        print(f"   ✅ Imported/updated {imported} case studies")

    def import_proof_points(self, xlsx: pd.ExcelFile):
        """Import Cust. Proofpoints sheet."""
        print("\n📊 Importing Cust. Proofpoints...")

        df = pd.read_excel(xlsx, sheet_name='Cust. Proofpoints')

        cursor = self.conn.cursor()
        imported = 0

        for _, row in df.iterrows():
            result_text = clean_string(row.get('Results / Quotes '))
            if not result_text:
                continue

            cursor.execute('''
                INSERT INTO proof_points (
                    vertical, theme, customer_name, result_text, source, is_shareable
                ) VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                clean_string(row.get('Industry')),
                clean_string(row.get('Customer / Theme')),
                clean_string(row.get('Customer / Theme')),
                result_text,
                clean_string(row.get('Source of the results')),
                1 if clean_string(row.get('Can you share this data ? ')) == 'Yes' else 0
            ))
            imported += 1

        self.conn.commit()
        self.stats['proof_points'] = imported
        print(f"   ✅ Imported {imported} proof points")

    def import_adobe_customers(self, xlsx: pd.ExcelFile):
        """Import Adobe sheet - customers using both Algolia and Adobe products."""
        print("\n🅰️ Importing Adobe customers...")

        df = pd.read_excel(xlsx, sheet_name='Adobe')

        cursor = self.conn.cursor()
        imported = 0
        tech_links = 0

        # Create Adobe technologies if not exist
        tech_map = {
            '~Adobe Commerce Customers': ('Adobe Commerce', 'Ecommerce'),
            '~AEM Customers': ('Adobe Experience Manager', 'CMS'),
            '~AEP Customers': ('Adobe Experience Platform', 'CDP'),
        }

        for bw_name, (tech_name, category) in tech_map.items():
            self._get_or_create_technology(tech_name, category, is_partner=1)

        for _, row in df.iterrows():
            account_name = clean_string(row.get('Account Name'))
            if not account_name:
                continue

            partner_pop = clean_string(row.get('Partner Populations'))
            arr = row.get('ARR')
            arr_value = float(arr) if pd.notna(arr) else None

            # Try to extract domain from account name
            domain = extract_domain(account_name)

            # Get or create company
            company_id = self._get_or_create_company(
                domain=domain or account_name.lower().replace(' ', ''),
                name=account_name,
                is_algolia_customer=1,
                algolia_arr=arr_value,
                algolia_cs_coverage=clean_string(row.get('cs_coverage')),
                has_logo_rights=1 if row.get('consent_logo__c') == 1 else 0,
                has_case_study_consent=1 if row.get('consent_casestudy__c') else 0,
                has_reference_consent=1 if row.get('consent_referencecall__c') == 1 else 0,
                partner_populations=json.dumps([partner_pop]) if partner_pop else None
            )

            # Link to Adobe technology
            if partner_pop and partner_pop in tech_map:
                tech_name = tech_map[partner_pop][0]
                cursor.execute('SELECT id FROM technologies WHERE name = ?', (tech_name,))
                tech_row = cursor.fetchone()
                if tech_row:
                    try:
                        cursor.execute('''
                            INSERT INTO company_technologies (company_id, technology_id, source)
                            VALUES (?, ?, ?)
                        ''', (company_id, tech_row[0], 'customer_evidence'))
                        tech_links += 1
                    except sqlite3.IntegrityError:
                        pass  # Already linked

            imported += 1

        self.conn.commit()
        self.stats['company_technologies'] = tech_links
        print(f"   ✅ Imported {imported} Adobe customers, {tech_links} tech links")

    def import_vertical_sheets(self, xlsx: pd.ExcelFile):
        """Import vertical-specific sheets for enrichment."""
        print("\n🏷️ Importing vertical sheets...")

        vertical_sheets = {
            'Fashion': 'Fashion',
            'Grocery': 'Grocery',
            'Luxury': 'Luxury',
            'Travel': 'Travel',
            'FinServ': 'Financial Services'
        }

        cursor = self.conn.cursor()
        enriched = 0

        for sheet_name, vertical_name in vertical_sheets.items():
            try:
                df = pd.read_excel(xlsx, sheet_name=sheet_name)

                # Find company name column
                name_col = None
                for col in df.columns:
                    if 'account' in str(col).lower() or 'company' in str(col).lower() or 'customer' in str(col).lower():
                        name_col = col
                        break

                if not name_col:
                    name_col = df.columns[0]

                for _, row in df.iterrows():
                    company_name = clean_string(row.get(name_col))
                    if not company_name:
                        continue

                    # Update company vertical if exists
                    cursor.execute('''
                        UPDATE companies SET vertical = ? WHERE name LIKE ?
                    ''', (vertical_name, f'%{company_name}%'))

                    if cursor.rowcount > 0:
                        enriched += 1

                print(f"   📁 {sheet_name}: {len(df)} rows")

            except Exception as e:
                print(f"   ⚠️ Could not import {sheet_name}: {e}")

        self.conn.commit()
        print(f"   ✅ Enriched {enriched} companies with vertical data")

    def print_summary(self):
        """Print import summary."""
        print("\n" + "="*50)
        print("📊 IMPORT SUMMARY")
        print("="*50)

        cursor = self.conn.cursor()

        for table, count in self.stats.items():
            cursor.execute(f'SELECT COUNT(*) FROM {table}')
            actual = cursor.fetchone()[0]
            print(f"   {table}: {actual} records")

        # Additional stats
        cursor.execute('SELECT COUNT(DISTINCT vertical) FROM companies WHERE vertical IS NOT NULL')
        verticals = cursor.fetchone()[0]
        print(f"\n   Unique verticals: {verticals}")

        cursor.execute('SELECT vertical, COUNT(*) FROM companies WHERE vertical IS NOT NULL GROUP BY vertical ORDER BY COUNT(*) DESC LIMIT 10')
        print("\n   Top verticals:")
        for row in cursor.fetchall():
            print(f"      {row[0]}: {row[1]}")

        print(f"\n   Database: {DB_PATH}")
        print("="*50)

    def run(self):
        """Run full import."""
        print("🚀 PartnerForge Data Import")
        print(f"   Source: {EXCEL_PATH}")
        print(f"   Target: {DB_PATH}")

        # Load Excel
        print("\n📂 Loading Excel file...")
        xlsx = pd.ExcelFile(EXCEL_PATH)
        print(f"   Found {len(xlsx.sheet_names)} sheets")

        # Connect to database
        self.connect()

        # Import each sheet
        self.import_customer_logos(xlsx)
        self.import_customer_quotes(xlsx)
        self.import_customer_stories(xlsx)
        self.import_case_studies(xlsx)
        self.import_proof_points(xlsx)
        self.import_adobe_customers(xlsx)
        self.import_vertical_sheets(xlsx)

        # Print summary
        self.print_summary()

        self.conn.close()
        print("\n✅ Import complete!")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Import Customer Evidence into PartnerForge database')
    parser.add_argument('--db', choices=['sqlite', 'supabase'], default='sqlite', help='Database type')
    parser.add_argument('--supabase-url', help='Supabase project URL')
    parser.add_argument('--supabase-key', help='Supabase service role key')

    args = parser.parse_args()

    importer = PartnerForgeImporter(
        db_type=args.db,
        supabase_url=args.supabase_url,
        supabase_key=args.supabase_key
    )
    importer.run()
