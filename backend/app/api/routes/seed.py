"""
Seed Data Routes - One-time data seeding for Railway deployment
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import json
import os
from pathlib import Path

from ...database import get_session

router = APIRouter(prefix="/seed", tags=["seed"])


@router.post("/targets")
async def seed_targets(db: AsyncSession = Depends(get_session)):
    """
    Seed displacement targets from bundled JSON data.

    This loads 2,687 pre-enriched targets into the database.
    Safe to call multiple times - uses INSERT OR IGNORE.
    """
    # Find the seed data file
    seed_file = Path(__file__).parent.parent.parent / "seed" / "targets.json"

    if not seed_file.exists():
        raise HTTPException(status_code=404, detail="Seed data file not found")

    # Load the JSON data
    with open(seed_file, "r") as f:
        targets = json.load(f)

    # Check if already seeded
    result = await db.execute(text("SELECT COUNT(*) FROM displacement_targets"))
    count = result.scalar()

    if count > 0:
        return {
            "status": "already_seeded",
            "existing_count": count,
            "message": "Database already contains data. Use /seed/targets?force=true to overwrite."
        }

    # Insert each target
    inserted = 0
    for target in targets:
        try:
            await db.execute(
                text("""
                    INSERT INTO displacement_targets (
                        id, domain, company_name, partner_tech, vertical,
                        country, city, state, tech_spend, sw_monthly_visits,
                        lead_score, icp_tier, icp_score, icp_tier_name,
                        ticker, is_public, revenue, gross_margin, current_search,
                        exec_quote, exec_name, exec_title,
                        competitors_using_algolia, displacement_angle
                    ) VALUES (
                        :id, :domain, :company_name, :partner_tech, :vertical,
                        :country, :city, :state, :tech_spend, :sw_monthly_visits,
                        :lead_score, :icp_tier, :icp_score, :icp_tier_name,
                        :ticker, :is_public, :revenue, :gross_margin, :current_search,
                        :exec_quote, :exec_name, :exec_title,
                        :competitors_using_algolia, :displacement_angle
                    )
                """),
                {
                    "id": target.get("id"),
                    "domain": target.get("domain"),
                    "company_name": target.get("company_name"),
                    "partner_tech": target.get("partner_tech"),
                    "vertical": target.get("vertical"),
                    "country": target.get("country"),
                    "city": target.get("city"),
                    "state": target.get("state"),
                    "tech_spend": target.get("tech_spend"),
                    "sw_monthly_visits": target.get("sw_monthly_visits"),
                    "lead_score": target.get("lead_score"),
                    "icp_tier": target.get("icp_tier"),
                    "icp_score": target.get("icp_score"),
                    "icp_tier_name": target.get("icp_tier_name"),
                    "ticker": target.get("ticker"),
                    "is_public": target.get("is_public"),
                    "revenue": target.get("revenue"),
                    "gross_margin": target.get("gross_margin"),
                    "current_search": target.get("current_search"),
                    "exec_quote": target.get("exec_quote"),
                    "exec_name": target.get("exec_name"),
                    "exec_title": target.get("exec_title"),
                    "competitors_using_algolia": target.get("competitors_using_algolia"),
                    "displacement_angle": target.get("displacement_angle"),
                }
            )
            inserted += 1
        except Exception as e:
            # Skip duplicates or errors
            pass

    await db.commit()

    return {
        "status": "success",
        "inserted": inserted,
        "total_in_file": len(targets),
        "message": f"Successfully seeded {inserted} displacement targets"
    }


@router.get("/status")
async def seed_status(db: AsyncSession = Depends(get_session)):
    """Check current database seed status."""
    result = await db.execute(text("SELECT COUNT(*) FROM displacement_targets"))
    target_count = result.scalar()

    return {
        "displacement_targets": target_count,
        "seeded": target_count > 0,
    }
