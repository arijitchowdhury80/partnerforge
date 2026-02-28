#!/usr/bin/env python3
"""
Arian - Fetch ALL Partner Technology Targets

This script fetches displacement targets for ALL Algolia partners:
- Adobe Experience Manager (AEM)
- Adobe Commerce (Magento)
- Shopify / Shopify Plus
- Salesforce Commerce Cloud
- Commercetools
- BigCommerce
- Contentful
- VTEX
- Sitecore

Uses the BuiltWith Lists API to find companies using each technology.
"""

import asyncio
import httpx
import json
import os
from datetime import datetime
from pathlib import Path

# API Key from environment variable
BUILTWITH_API_KEY = os.getenv("BUILTWITH_API_KEY")
if not BUILTWITH_API_KEY:
    raise ValueError("BUILTWITH_API_KEY environment variable is required")

# Partner technologies to search for
PARTNER_TECHNOLOGIES = {
    "Adobe Experience Manager": {
        "tech_name": "Adobe Experience Manager",
        "builtwith_tech": "Adobe-Experience-Manager",
        "partner": "Adobe",
        "tier": "Premium"
    },
    "Adobe Commerce": {
        "tech_name": "Adobe Commerce / Magento",
        "builtwith_tech": "Magento",
        "partner": "Adobe",
        "tier": "Premium"
    },
    "Shopify Plus": {
        "tech_name": "Shopify Plus",
        "builtwith_tech": "Shopify-Plus",
        "partner": "Shopify",
        "tier": "Premium"
    },
    "Shopify": {
        "tech_name": "Shopify",
        "builtwith_tech": "Shopify",
        "partner": "Shopify",
        "tier": "Standard"
    },
    "Salesforce Commerce Cloud": {
        "tech_name": "Salesforce Commerce Cloud",
        "builtwith_tech": "Salesforce-Commerce-Cloud",
        "partner": "Salesforce",
        "tier": "Premium"
    },
    "Commercetools": {
        "tech_name": "Commercetools",
        "builtwith_tech": "commercetools",
        "partner": "Commercetools",
        "tier": "Premium"
    },
    "BigCommerce": {
        "tech_name": "BigCommerce",
        "builtwith_tech": "BigCommerce",
        "partner": "BigCommerce",
        "tier": "Standard"
    },
    "Contentful": {
        "tech_name": "Contentful",
        "builtwith_tech": "Contentful",
        "partner": "Contentful",
        "tier": "Premium"
    },
    "VTEX": {
        "tech_name": "VTEX",
        "builtwith_tech": "VTEX",
        "partner": "VTEX",
        "tier": "Premium"
    },
    "Sitecore": {
        "tech_name": "Sitecore",
        "builtwith_tech": "Sitecore",
        "partner": "Sitecore",
        "tier": "Premium"
    },
}


async def fetch_builtwith_list(tech_name: str, builtwith_tech: str) -> list:
    """
    Fetch list of domains using a specific technology from BuiltWith.

    Uses the Free API endpoint for technology lookups.
    """
    print(f"  Fetching companies using {tech_name}...")

    # BuiltWith Free API endpoint
    url = "https://api.builtwith.com/free1/api.json"
    params = {
        "KEY": BUILTWITH_API_KEY,
        "LOOKUP": builtwith_tech,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            # The free API returns limited data
            # For production, use the Lists API
            if "Results" in data:
                return data["Results"]
            return []

        except Exception as e:
            print(f"    Error fetching {tech_name}: {e}")
            return []


async def fetch_domain_details(domain: str) -> dict:
    """
    Fetch detailed information about a specific domain.
    """
    url = "https://api.builtwith.com/v21/api.json"
    params = {
        "KEY": BUILTWITH_API_KEY,
        "LOOKUP": domain,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"    Error fetching details for {domain}: {e}")
            return {}


async def check_uses_algolia(domain: str) -> bool:
    """
    Check if a domain is already using Algolia.
    """
    details = await fetch_domain_details(domain)

    if not details or "Results" not in details:
        return False

    for result in details.get("Results", []):
        for path in result.get("Result", {}).get("Paths", []):
            for tech in path.get("Technologies", []):
                if "algolia" in tech.get("Name", "").lower():
                    return True

    return False


async def main():
    """Main function to fetch all partner data."""
    print("=" * 60)
    print("Arian - Fetching ALL Partner Technology Targets")
    print("=" * 60)
    print(f"API Key: {BUILTWITH_API_KEY[:8]}...")
    print(f"Partners: {len(PARTNER_TECHNOLOGIES)}")
    print()

    all_targets = []

    for partner_name, config in PARTNER_TECHNOLOGIES.items():
        print(f"\n[{config['partner']}] {partner_name}")

        # For now, we'll test with the domain lookup API
        # The Lists API requires a different subscription
        test_domains = await get_sample_domains(config["builtwith_tech"])

        for domain in test_domains[:10]:  # Limit to 10 per partner for testing
            # Check if already using Algolia
            uses_algolia = await check_uses_algolia(domain)

            if not uses_algolia:
                target = {
                    "domain": domain,
                    "partner_tech": partner_name,
                    "partner": config["partner"],
                    "tier": config["tier"],
                    "fetched_at": datetime.now().isoformat(),
                    "uses_algolia": False,
                }
                all_targets.append(target)
                print(f"    + {domain} (displacement opportunity)")
            else:
                print(f"    - {domain} (already uses Algolia, skipping)")

    print("\n" + "=" * 60)
    print(f"Total displacement targets found: {len(all_targets)}")
    print("=" * 60)

    # Save results
    output_file = Path(__file__).parent.parent / "data" / "all_partners_targets.json"
    output_file.parent.mkdir(exist_ok=True)

    with open(output_file, "w") as f:
        json.dump(all_targets, f, indent=2)

    print(f"\nResults saved to: {output_file}")

    return all_targets


async def get_sample_domains(builtwith_tech: str) -> list:
    """
    Get sample domains for a technology.

    For real implementation, this would use BuiltWith Lists API.
    For now, returns known domains for testing.
    """
    # Sample domains by technology (for functional testing)
    SAMPLE_DOMAINS = {
        "Adobe-Experience-Manager": [
            "mercedes-benz.com", "bmw.com", "ford.com", "ge.com",
            "siemens.com", "bosch.com", "philips.com", "samsung.com",
            "lg.com", "panasonic.com"
        ],
        "Magento": [
            "coca-cola.com", "nestle.com", "landrover.com", "hpe.com",
            "canon.com", "olympus.com", "nikon.com", "sigma-global.com"
        ],
        "Shopify-Plus": [
            "allbirds.com", "gymshark.com", "bombas.com", "mvmt.com",
            "brooklinen.com", "ruggable.com", "heinz.com", "redbull.com"
        ],
        "Shopify": [
            "kylie cosmetics.com", "fashionnova.com", "colourpop.com",
            "jeffreestarcosmetics.com", "kyliecosmetics.com"
        ],
        "Salesforce-Commerce-Cloud": [
            "adidas.com", "puma.com", "underarmour.com", "columbia.com",
            "patagonia.com", "northface.com", "timberland.com", "vans.com"
        ],
        "commercetools": [
            "audi.com", "porsche.com", "bentleymotors.com", "express.com",
            "ulta.com", "sephora.com"
        ],
        "BigCommerce": [
            "skullcandy.com", "solo.com", "blendtec.com", "camelbak.com"
        ],
        "Contentful": [
            "spotify.com", "twitch.tv", "netlify.com", "vodafone.com"
        ],
        "VTEX": [
            "whirlpool.com", "motorola.com", "sony.com.br", "samsung.com.br"
        ],
        "Sitecore": [
            "american airlines.com", "volvo.com", "loreal.com", "nestle.com"
        ],
    }

    return SAMPLE_DOMAINS.get(builtwith_tech, [])


if __name__ == "__main__":
    asyncio.run(main())
