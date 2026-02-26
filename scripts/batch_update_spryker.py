#!/usr/bin/env python3
"""
Batch Update Spryker Companies in Supabase

Consolidates all enrichment data from parallel agents and updates
Supabase in a single batch operation for efficiency.
"""

import json
import os
import requests
from datetime import datetime

# Supabase Configuration
SUPABASE_URL = "https://xbitqeejsgqnwvxlnjra.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA4NTU0MCwiZXhwIjoyMDg3NjYxNTQwfQ.tVnqtUbxS55dNnUiKY6_LBqVYYLhGztWoagg-efc3Ac"

# Data file paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "data")

# =============================================================================
# Load enrichment data from all sources
# =============================================================================

def load_json(filename):
    """Load JSON file from data directory."""
    filepath = os.path.join(DATA_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            return json.load(f)
    return None


# Load all enrichment sources
deep_enrichment = load_json("spryker_deep_enrichment.json") or []
strategic_insights = load_json("spryker_strategic_insights.json") or {}
tech_stack = load_json("spryker_customers_tech_stack.json") or {}
financials = load_json("spryker_public_customers_financials.json") or {}

# Build lookup dictionaries
strategic_by_domain = {}
for company in strategic_insights.get("companies", []):
    domain = company.get("domain", "").lower()
    strategic_by_domain[domain] = company

tech_by_domain = {}
for company in tech_stack.get("companies", []):
    domain = company.get("domain", "").lower()
    tech_by_domain[domain] = company

financial_by_domain = {}
for company in financials.get("companies", []):
    domain = company.get("domain", "").lower()
    financial_by_domain[domain] = company

# =============================================================================
# Executive quotes data (from the agent research)
# =============================================================================

EXEC_QUOTES = {
    "ricoh.com": {
        "exec_quote": "The Ricoh Group is steadfastly advancing its transformation into a digital services company. Our objective is to build a robust and adaptable operational foundation, one capable of thriving amidst change.",
        "exec_name": "Akira Oyama",
        "exec_title": "President and CEO",
    },
    "hilti.com": {
        "exec_quote": "Our ambition is to be our customers' best partner for productivity, and that means that next to bringing products and solutions that improve on-site work, we feel that there is a big potential in helping customers to improve their business processes. And for that, you need software.",
        "exec_name": "Christoph Loos",
        "exec_title": "Chairman of the Board (former CEO)",
    },
    "aldi-sued.de": {
        "exec_quote": "ALDI DX underlines our unique culture of trusting and respectful collaboration, openness for continuous learning and working towards one common goal. Together, we rethink retail with the aim of jointly bringing the Aldi Süd discount concept into the future.",
        "exec_name": "Wolfgang Frisch",
        "exec_title": "CIO / Head of Aldi DX",
    },
}

# =============================================================================
# Search provider mapping from tech stack research
# =============================================================================

SEARCH_PROVIDERS = {
    "siemens.com": "AWS Bedrock AI",
    "jungheinrich.com": "Elasticsearch",
    "bosch.com": "Bloomreach",
}

# =============================================================================
# Financial data for public companies
# =============================================================================

PUBLIC_COMPANIES = {
    "siemens.com": {
        "ticker": "SIEGY",
        "is_public": True,
        "market_cap": 238740000000,  # $238.7B
        "revenue": 85000000000,  # ~$85B EUR annual
    },
    "siemens-healthineers.com": {
        "ticker": "SMMNY",
        "is_public": True,
        "market_cap": 63300000000,  # $63.3B
        "revenue": 23375000000,  # €23.4B
    },
    "daimlertruck.com": {
        "ticker": "DTRUY",
        "is_public": True,
        "market_cap": 33000000000,  # ~$33B
        "revenue": 50840000000,  # €50.8B
    },
    "ricoh.com": {
        "ticker": "RICOY",
        "is_public": True,
        "market_cap": 6110000000,  # $6.1B
        "revenue": 17100000000,  # $17.1B
    },
    "metro.de": {
        "ticker": "B4B",
        "is_public": True,
        "market_cap": 2170000000,  # $2.17B
        "revenue": 33900000000,  # $33.9B
    },
    "jungheinrich.com": {
        "ticker": "JGHHY",
        "is_public": True,
        "market_cap": 3660000000,  # €3.66B
        "revenue": 5000000000,  # Estimated ~€5B
    },
    "toyotamaterial.com": {
        "ticker": "TYIDY",
        "is_public": True,
        "market_cap": 39220000000,  # $39.2B
        "revenue": 30000000000,  # ~$30B (4T JPY)
    },
}

# =============================================================================
# Displacement angles from strategic research
# =============================================================================

DISPLACEMENT_ANGLES = {
    "ricoh.com": "DIGITAL_SERVICES_TRANSFORMATION",
    "hilti.com": "B2B_SOFTWARE_INVESTMENT",
    "aldi-sued.de": "ALDI_DX_DIGITAL_INITIATIVE",
    "siemens.com": "AWS_AI_INCUMBENT",
    "bosch.com": "BLOOMREACH_INCUMBENT",
    "metro.de": "SPRYKER_NATIVE_GREENFIELD",
    "jungheinrich.com": "ELASTICSEARCH_DISPLACEMENT",
    "zf.com": "GREENFIELD_AFTERMARKET",
    "swisskrono.com": "SPRYKER_NATIVE_GREENFIELD",
    "toyotamaterial.com": "MIRAKL_NATIVE",
}

# =============================================================================
# Batch update function
# =============================================================================

def batch_update_supabase(updates: list) -> dict:
    """
    Update multiple records in Supabase.

    Uses individual PATCH requests (Supabase REST doesn't support bulk PATCH),
    but batches them efficiently.
    """
    results = {"success": 0, "failed": 0, "errors": []}

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    for update in updates:
        domain = update.pop("domain")
        url = f"{SUPABASE_URL}/rest/v1/displacement_targets?domain=eq.{domain}"

        try:
            response = requests.patch(url, headers=headers, json=update)
            if response.status_code in (200, 204):
                results["success"] += 1
            else:
                results["failed"] += 1
                results["errors"].append({
                    "domain": domain,
                    "status": response.status_code,
                    "error": response.text[:200],
                })
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({
                "domain": domain,
                "error": str(e),
            })

    return results


# =============================================================================
# Build consolidated updates
# =============================================================================

def build_updates():
    """Build the list of updates for all Spryker companies."""
    updates = []

    for company in deep_enrichment:
        domain = company.get("domain", "").lower()

        update = {
            "domain": domain,
            "last_enriched": datetime.now().isoformat(),
            "enrichment_level": "deep",
        }

        # SimilarWeb data - cast to integer for database
        sw = company.get("similarweb", {})
        if sw.get("total_visits") and sw["total_visits"] > 0:
            update["sw_monthly_visits"] = int(sw["total_visits"])

        # ICP score from deep enrichment - must be integer
        if company.get("icp_score"):
            update["icp_score"] = int(company["icp_score"])

        # ICP tier name (string: hot, warm, cold)
        if company.get("icp_tier"):
            update["icp_tier_name"] = str(company["icp_tier"])

        # ICP tier (integer: 1=hot, 2=warm, 3=cold)
        tier_map = {"hot": 1, "warm": 2, "cold": 3}
        if company.get("icp_tier") and company["icp_tier"] in tier_map:
            update["icp_tier"] = tier_map[company["icp_tier"]]

        # Search provider (string)
        if domain in SEARCH_PROVIDERS:
            update["current_search"] = str(SEARCH_PROVIDERS[domain])
        elif company.get("current_search"):
            update["current_search"] = str(company["current_search"])

        # Displacement angle (string)
        if domain in DISPLACEMENT_ANGLES:
            update["displacement_angle"] = str(DISPLACEMENT_ANGLES[domain])
        elif company.get("displacement_analysis", {}).get("displacement_angle"):
            update["displacement_angle"] = str(company["displacement_analysis"]["displacement_angle"])

        # Executive quotes (strings)
        if domain in EXEC_QUOTES:
            eq = EXEC_QUOTES[domain]
            if eq.get("exec_quote"):
                update["exec_quote"] = str(eq["exec_quote"])[:500]  # Limit length
            if eq.get("exec_name"):
                update["exec_name"] = str(eq["exec_name"])
            if eq.get("exec_title"):
                update["exec_title"] = str(eq["exec_title"])

        # Financial data for public companies
        if domain in PUBLIC_COMPANIES:
            fin = PUBLIC_COMPANIES[domain]
            update["is_public"] = bool(fin.get("is_public", False))
            if fin.get("ticker"):
                update["ticker"] = str(fin["ticker"])
            if fin.get("revenue"):
                update["revenue"] = int(fin["revenue"])

        # Competitors (using correct column name)
        if company.get("competitors"):
            # Store as comma-separated string (Supabase text field)
            update["competitors_using_algolia"] = ",".join(company["competitors"][:5])

        updates.append(update)

    return updates


# =============================================================================
# Main
# =============================================================================

def main():
    print("\n" + "=" * 70)
    print("  BATCH UPDATE: SPRYKER COMPANIES IN SUPABASE")
    print("  Date: " + datetime.now().strftime("%Y-%m-%d %H:%M"))
    print("=" * 70)

    # Build updates
    print("\nBuilding consolidated updates...")
    updates = build_updates()
    print(f"  Prepared {len(updates)} company updates")

    # Show sample
    print("\n  Sample update (Ricoh):")
    ricoh = next((u for u in updates if "ricoh" in u.get("domain", "")), None)
    if ricoh:
        for k, v in list(ricoh.items())[:6]:
            if k != "domain":
                print(f"    {k}: {str(v)[:50]}")

    # Execute batch update
    print("\nExecuting batch update...")
    results = batch_update_supabase(updates)

    # Report results
    print("\n" + "=" * 70)
    print("  BATCH UPDATE COMPLETE")
    print("=" * 70)
    print(f"\n  Successful: {results['success']}/{len(updates)}")
    print(f"  Failed: {results['failed']}/{len(updates)}")

    if results["errors"]:
        print("\n  Errors:")
        for err in results["errors"][:5]:
            print(f"    - {err.get('domain')}: {err.get('error', '')[:50]}")

    # Save consolidated enrichment
    output_file = os.path.join(DATA_DIR, "spryker_consolidated_enrichment.json")

    consolidated = {
        "generated_date": datetime.now().isoformat(),
        "total_companies": len(deep_enrichment),
        "sources": [
            "spryker_deep_enrichment.json (SimilarWeb)",
            "spryker_strategic_insights.json (WebSearch)",
            "spryker_customers_tech_stack.json (BuiltWith/WebSearch)",
            "spryker_public_customers_financials.json (Yahoo Finance)",
        ],
        "companies": deep_enrichment,
        "update_results": results,
    }

    with open(output_file, "w") as f:
        json.dump(consolidated, f, indent=2)

    print(f"\n  Consolidated data saved to: {output_file}")
    print("=" * 70)


if __name__ == "__main__":
    main()
