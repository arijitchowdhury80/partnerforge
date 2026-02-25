#!/usr/bin/env python3
"""
PartnerForge: Enhanced ICP Scoring Model

Based on Algolia's ICP Tier definitions:
- Tier 1 (Commerce): Fashion & General Retail E-commerce
  - Revenue: $140M - $7.7B
  - Employees: 229 - 58k
  - Platforms: Shopify Plus, Adobe Commerce, Amplience, Adobe AEM
  - Primary KPI: Conversion rate uplift

- Tier 2 (Content): Digital Publishing & Media Platforms
  - Revenue: $35M - $81B
  - Employees: 150 - 109k
  - Platforms: Adobe AEM, Adobe Analytics
  - Primary KPI: Time-on-site / articles read

- Tier 3 (Internal Support): Knowledge & Support Portals
  - Revenue: $900M - $25B
  - Employees: 2.5k - 99k
  - Platforms: Zendesk Suite, DocSearch, SharePoint
  - Primary KPI: Ticket deflection / self-service rate
"""

import sqlite3
import json
from typing import Dict, List, Tuple, Optional

DB_PATH = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/PartnerForge/data/partnerforge.db"

# ICP Tier definitions from PDFs
ICP_TIERS = {
    1: {
        "name": "Commerce",
        "description": "Fashion & General Retail E-commerce",
        "revenue_min": 140_000_000,  # $140M
        "revenue_max": 7_700_000_000,  # $7.7B
        "employees_min": 229,
        "employees_max": 58_000,
        "primary_kpi": "Conversion rate uplift",
        "platforms": [
            "Shopify", "Shopify Plus", "Adobe Commerce", "Magento",
            "commercetools", "BigCommerce", "SAP Commerce Cloud",
            "Salesforce Commerce Cloud", "VTEX"
        ],
        "cms_partners": ["Amplience", "Adobe AEM", "Adobe Experience Manager"],
        "verticals": [
            "Retail", "E-commerce", "Fashion", "Apparel", "Consumer Goods",
            "Sporting Goods", "Home & Garden", "Beauty", "Cosmetics",
            "Jewelry", "Luxury", "Department Store", "Marketplace",
            "Automotive Parts", "Pet Supplies", "Electronics", "Furniture"
        ],
        "buying_triggers": [
            "Headless/MACH re-platform launch",
            "BOPIS rollout",
            "New country storefront",
            "Peak-season traffic planning"
        ],
        "weight": 40  # Highest priority
    },
    2: {
        "name": "Content",
        "description": "Digital Publishing & Media Platforms",
        "revenue_min": 35_000_000,  # $35M
        "revenue_max": 81_000_000_000,  # $81B
        "employees_min": 150,
        "employees_max": 109_000,
        "primary_kpi": "Time-on-site / articles read",
        "platforms": ["Adobe AEM", "Adobe Experience Manager", "Adobe Analytics"],
        "verticals": [
            "Media", "Publishing", "News", "Entertainment", "Gaming",
            "Music", "Video", "Streaming", "Broadcasting", "Magazine",
            "Blog", "Content Platform"
        ],
        "buying_triggers": [
            "Rapid growth in content library size",
            "Plateauing ad or subscription revenue"
        ],
        "weight": 25
    },
    3: {
        "name": "Internal Support",
        "description": "Knowledge & Support Portals",
        "revenue_min": 900_000_000,  # $900M
        "revenue_max": 25_000_000_000,  # $25B
        "employees_min": 2_500,
        "employees_max": 99_000,
        "primary_kpi": "Ticket deflection / self-service rate",
        "platforms": [
            "Zendesk", "Zendesk Suite", "SharePoint", "Confluence",
            "ServiceNow", "Freshdesk", "Intercom"
        ],
        "verticals": [
            "SaaS", "Software", "Technology", "Telecommunications",
            "Financial Services", "Banking", "Insurance", "Healthcare",
            "Professional Services", "B2B"
        ],
        "buying_triggers": [
            "Support-volume spike",
            "New product/API launch",
            "Mandate to improve CSAT or reduce AHT"
        ],
        "weight": 15
    }
}

# Vertical to ICP Tier mapping
VERTICAL_TIER_MAP = {
    # Tier 1 Commerce verticals
    "retail": 1, "e-commerce": 1, "ecommerce": 1, "fashion": 1, "apparel": 1,
    "consumer goods": 1, "sporting goods": 1, "home & garden": 1, "beauty": 1,
    "cosmetics": 1, "jewelry": 1, "luxury": 1, "department store": 1,
    "marketplace": 1, "automotive parts": 1, "pet supplies": 1, "electronics": 1,
    "furniture": 1, "grocery": 1, "food & beverage": 1, "party supplies": 1,
    "outdoor": 1, "arts & crafts": 1, "hardware": 1, "automotive": 1,

    # Tier 2 Content verticals
    "media": 2, "publishing": 2, "news": 2, "entertainment": 2, "gaming": 2,
    "music": 2, "video": 2, "streaming": 2, "broadcasting": 2, "magazine": 2,

    # Tier 3 Internal Support verticals
    "saas": 3, "software": 3, "technology": 3, "telecommunications": 3,
    "financial services": 3, "banking": 3, "insurance": 3, "healthcare": 3,
    "professional services": 3, "b2b": 3, "fintech": 3, "edtech": 3,

    # Mixed - default to most common tier
    "travel": 1, "hospitality": 1, "education": 3, "government": 3,
    "non-profit": 3, "manufacturing": 3
}


def determine_icp_tier(vertical: str, tech_stack: List[str] = None,
                       revenue: float = None, employees: int = None) -> Tuple[int, float]:
    """
    Determine ICP tier based on vertical, tech stack, and company attributes.

    Returns:
        Tuple of (tier_number, confidence_score)
    """
    if not vertical:
        return (0, 0.0)  # Unknown

    vertical_lower = vertical.lower().strip()
    tech_stack = tech_stack or []

    # Try exact vertical match first
    tier = VERTICAL_TIER_MAP.get(vertical_lower)

    if tier:
        confidence = 0.8  # Good confidence from vertical match
    else:
        # Try partial match
        for v_name, t in VERTICAL_TIER_MAP.items():
            if v_name in vertical_lower or vertical_lower in v_name:
                tier = t
                confidence = 0.6
                break

    if not tier:
        # Default based on tech stack
        for tech in tech_stack:
            tech_lower = tech.lower()
            for tier_num, tier_def in ICP_TIERS.items():
                if any(p.lower() in tech_lower for p in tier_def["platforms"]):
                    tier = tier_num
                    confidence = 0.5
                    break
            if tier:
                break

    if not tier:
        tier = 1  # Default to Commerce (largest TAM)
        confidence = 0.3

    # Boost confidence if revenue/employees match tier ranges
    if tier and revenue:
        tier_def = ICP_TIERS[tier]
        if tier_def["revenue_min"] <= revenue <= tier_def["revenue_max"]:
            confidence = min(1.0, confidence + 0.15)

    if tier and employees:
        tier_def = ICP_TIERS[tier]
        if tier_def["employees_min"] <= employees <= tier_def["employees_max"]:
            confidence = min(1.0, confidence + 0.10)

    return (tier, confidence)


def calculate_lead_score(
    vertical: str,
    monthly_visits: int = None,
    tech_spend: int = None,
    partner_tech: str = None,
    has_competitor_search: bool = False,
    tier: int = None
) -> Dict:
    """
    Calculate lead score (0-100) based on ICP criteria.

    Scoring breakdown:
    - Vertical/Tier fit: 40 points
    - Traffic volume: 30 points
    - Tech spend: 20 points
    - Partner tech bonus: 10 points
    - Competitor displacement: +5 bonus
    """
    score = 0
    breakdown = {}

    # 1. Vertical/Tier scoring (40 points max)
    if tier is None:
        tier, _ = determine_icp_tier(vertical)

    if tier == 1:  # Commerce - highest priority
        vertical_score = 40
    elif tier == 2:  # Content
        vertical_score = 25
    elif tier == 3:  # Internal Support
        vertical_score = 15
    else:
        vertical_score = 5  # Unknown

    score += vertical_score
    breakdown["vertical"] = vertical_score

    # 2. Traffic volume scoring (30 points max)
    traffic_score = 0
    if monthly_visits:
        if monthly_visits >= 50_000_000:
            traffic_score = 30
        elif monthly_visits >= 10_000_000:
            traffic_score = 25
        elif monthly_visits >= 5_000_000:
            traffic_score = 20
        elif monthly_visits >= 1_000_000:
            traffic_score = 15
        elif monthly_visits >= 500_000:
            traffic_score = 10
        elif monthly_visits >= 100_000:
            traffic_score = 5

    score += traffic_score
    breakdown["traffic"] = traffic_score

    # 3. Tech spend scoring (20 points max)
    spend_score = 0
    if tech_spend:
        if tech_spend >= 100_000:
            spend_score = 20
        elif tech_spend >= 50_000:
            spend_score = 15
        elif tech_spend >= 25_000:
            spend_score = 10
        elif tech_spend >= 10_000:
            spend_score = 5

    score += spend_score
    breakdown["tech_spend"] = spend_score

    # 4. Partner tech bonus (10 points max)
    partner_score = 0
    if partner_tech:
        partner_lower = partner_tech.lower()
        # Premium partners
        if any(p in partner_lower for p in ["adobe", "salesforce", "shopify plus"]):
            partner_score = 10
        # Standard partners
        elif any(p in partner_lower for p in ["shopify", "commercetools", "bigcommerce"]):
            partner_score = 7
        else:
            partner_score = 3

    score += partner_score
    breakdown["partner_tech"] = partner_score

    # 5. Competitor displacement bonus
    if has_competitor_search:
        score += 5
        breakdown["competitor_bonus"] = 5

    return {
        "score": min(100, score),
        "tier": tier,
        "tier_name": ICP_TIERS.get(tier, {}).get("name", "Unknown"),
        "breakdown": breakdown
    }


def classify_and_score_targets(conn: sqlite3.Connection, table_name: str = "displacement_targets"):
    """Apply ICP classification and scoring to displacement targets."""
    cursor = conn.cursor()

    # Check if columns exist, add if not
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [col[1] for col in cursor.fetchall()]

    new_columns = [
        ("icp_tier", "INTEGER"),
        ("icp_tier_name", "TEXT"),
        ("lead_score", "INTEGER"),
        ("score_breakdown", "TEXT")
    ]

    for col_name, col_type in new_columns:
        if col_name not in columns:
            cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}")

    conn.commit()

    # Fetch all targets
    cursor.execute(f"SELECT id, vertical, sw_monthly_visits, tech_spend, partner_tech FROM {table_name}")
    targets = cursor.fetchall()

    print(f"\n🎯 Scoring {len(targets)} displacement targets...")

    tier_counts = {1: 0, 2: 0, 3: 0, 0: 0}
    score_ranges = {"80+": 0, "60-79": 0, "40-59": 0, "20-39": 0, "<20": 0}

    for target in targets:
        target_id, vertical, visits, spend, partner = target

        # Calculate score
        result = calculate_lead_score(
            vertical=vertical,
            monthly_visits=visits,
            tech_spend=spend,
            partner_tech=partner
        )

        # Update record
        cursor.execute(f"""
            UPDATE {table_name} SET
                icp_tier = ?,
                icp_tier_name = ?,
                lead_score = ?,
                score_breakdown = ?
            WHERE id = ?
        """, (
            result["tier"],
            result["tier_name"],
            result["score"],
            json.dumps(result["breakdown"]),
            target_id
        ))

        # Track stats
        tier_counts[result["tier"]] = tier_counts.get(result["tier"], 0) + 1

        if result["score"] >= 80:
            score_ranges["80+"] += 1
        elif result["score"] >= 60:
            score_ranges["60-79"] += 1
        elif result["score"] >= 40:
            score_ranges["40-59"] += 1
        elif result["score"] >= 20:
            score_ranges["20-39"] += 1
        else:
            score_ranges["<20"] += 1

    conn.commit()

    # Print summary
    print("\n📊 ICP Tier Distribution:")
    for tier_num in [1, 2, 3, 0]:
        tier_name = ICP_TIERS.get(tier_num, {}).get("name", "Unknown")
        print(f"   Tier {tier_num} ({tier_name}): {tier_counts[tier_num]}")

    print("\n📈 Score Distribution:")
    for range_name, count in score_ranges.items():
        print(f"   Score {range_name}: {count}")

    return tier_counts, score_ranges


def get_matching_case_studies(conn: sqlite3.Connection, vertical: str, partner_tech: str = None) -> List[Dict]:
    """Find relevant case studies for a target based on vertical and tech stack."""
    cursor = conn.cursor()

    # Build query
    query = """
        SELECT customer_name, vertical, story_url, partner_integrations, key_results
        FROM case_studies
        WHERE status = 'Complete'
    """
    params = []

    if vertical:
        # Try to match vertical
        query += " AND (vertical LIKE ? OR sub_vertical LIKE ?)"
        params.extend([f"%{vertical}%", f"%{vertical}%"])

    query += " ORDER BY customer_name LIMIT 5"

    cursor.execute(query, params)
    results = cursor.fetchall()

    case_studies = []
    for row in results:
        case_studies.append({
            "customer": row[0],
            "vertical": row[1],
            "url": row[2],
            "partners": json.loads(row[3]) if row[3] else [],
            "results": row[4]
        })

    return case_studies


if __name__ == "__main__":
    print("🎯 PartnerForge ICP Scoring Module")
    print("="*50)

    conn = sqlite3.connect(DB_PATH)

    # Run scoring
    tier_counts, score_ranges = classify_and_score_targets(conn)

    # Show top leads
    cursor = conn.cursor()
    cursor.execute("""
        SELECT company_name, domain, vertical, icp_tier_name, lead_score, sw_monthly_visits
        FROM displacement_targets
        WHERE lead_score IS NOT NULL
        ORDER BY lead_score DESC, sw_monthly_visits DESC
        LIMIT 20
    """)

    print("\n🏆 Top 20 Leads by Score:")
    print("-"*100)
    print(f"{'Company':<40} {'Domain':<25} {'Tier':<12} {'Score':<8} {'Traffic':<15}")
    print("-"*100)

    for row in cursor.fetchall():
        company = row[0][:38] if row[0] else "N/A"
        domain = row[1][:23] if row[1] else "N/A"
        tier = row[3] or "N/A"
        score = row[4] or 0
        traffic = f"{row[5]:,}" if row[5] else "N/A"
        print(f"{company:<40} {domain:<25} {tier:<12} {score:<8} {traffic:<15}")

    conn.close()
    print("\n✅ Scoring complete!")
