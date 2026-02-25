#!/usr/bin/env python3
"""
PartnerForge: Enhanced Dashboard Generator v3.0

Generates an interactive dashboard with:
- Live search/filtering
- Column sorting (click headers)
- CSV export
- Score breakdown tooltips
- Visual score progress bars
- FULL-PAGE detail view with:
  - Signal row (Budget/Pain/Timing)
  - Two-column layout with metrics + trigger events
  - Competitive advantage card (glassmorphism)
  - Executive quotes
  - Tabbed sections (Financials, Quotes, Hiring, Tech Stack, Full)
"""

import sqlite3
import json
from datetime import datetime

DB_PATH = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/PartnerForge/data/partnerforge.db"
OUTPUT_PATH = "/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/AI/MarketingProject/PartnerForge/index.html"

def fetch_data():
    """Fetch all data from SQLite."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check which columns exist in the table
    cursor.execute("PRAGMA table_info(displacement_targets)")
    existing_cols = {row[1] for row in cursor.fetchall()}

    # Build dynamic query based on available columns
    base_cols = [
        'id', 'company_name', 'domain', 'vertical', 'country',
        'icp_tier', 'icp_tier_name', 'icp_score',
        'sw_monthly_visits', 'tech_spend', 'partner_tech'
    ]

    # Extended columns (may not exist yet)
    extended_cols = [
        ('revenue', 'NULL'),
        ('gross_margin', 'NULL'),
        ('traffic_growth', 'NULL'),
        ('current_search', 'NULL'),
        ('trigger_events', 'NULL'),
        ('exec_quote', 'NULL'),
        ('exec_name', 'NULL'),
        ('exec_title', 'NULL'),
        ('quote_source', 'NULL'),
        ('competitors_using_algolia', 'NULL'),
        ('displacement_angle', 'NULL'),
        ('financials_json', 'NULL'),
        ('hiring_signals', 'NULL'),
        ('tech_stack_json', 'NULL'),
        ('last_enriched', 'NULL'),
        ('enrichment_level', "'basic'")
    ]

    # Build SELECT clause
    select_parts = base_cols.copy()
    for col, default in extended_cols:
        if col in existing_cols:
            select_parts.append(col)
        else:
            select_parts.append(f"{default} as {col}")

    query = f"""
        SELECT {', '.join(select_parts)}
        FROM displacement_targets
        ORDER BY
            CASE WHEN icp_score IS NULL THEN 1 ELSE 0 END,
            icp_score DESC,
            sw_monthly_visits DESC
    """
    cursor.execute(query)
    targets = cursor.fetchall()

    # Get competitive intel
    cursor.execute("""
        SELECT target_domain, competitor_domain, search_provider, has_algolia, partner_techs
        FROM competitive_intel
        ORDER BY target_domain
    """)
    comp_intel = cursor.fetchall()

    # Get stats
    cursor.execute("SELECT COUNT(*) FROM displacement_targets")
    total = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM displacement_targets WHERE icp_score >= 80")
    hot = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM displacement_targets WHERE icp_score >= 60 AND icp_score < 80")
    warm = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM displacement_targets WHERE icp_score >= 40 AND icp_score < 60")
    cool = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM displacement_targets WHERE icp_tier = 1")
    tier1 = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM displacement_targets WHERE icp_tier = 2")
    tier2 = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM displacement_targets WHERE icp_tier = 3")
    tier3 = cursor.fetchone()[0]

    conn.close()

    return {
        "targets": targets,
        "comp_intel": comp_intel,
        "stats": {
            "total": total,
            "hot": hot,
            "warm": warm,
            "cool": cool,
            "tier1": tier1,
            "tier2": tier2,
            "tier3": tier3,
            "pipeline": round(total * 23600, -3)  # Avg deal size estimate
        }
    }


def format_traffic(visits):
    """Format traffic number."""
    if visits is None or visits == 0:
        return "—"
    if visits >= 1_000_000:
        return f"{visits/1_000_000:.1f}M"
    if visits >= 1_000:
        return f"{visits/1_000:.0f}K"
    return str(visits)


def format_revenue(revenue):
    """Format revenue number."""
    if revenue is None or revenue == 0:
        return "—"
    if revenue >= 1_000_000_000:
        return f"${revenue/1_000_000_000:.1f}B"
    if revenue >= 1_000_000:
        return f"${revenue/1_000_000:.0f}M"
    if revenue >= 1_000:
        return f"${revenue/1_000:.0f}K"
    return f"${revenue}"


def format_percent(value):
    """Format percentage."""
    if value is None:
        return "—"
    return f"{value:.1f}%"


def generate_html(data):
    """Generate the enhanced dashboard HTML."""

    # Convert targets to JSON for JavaScript
    targets_json = []
    verticals_set = set()
    for t in data["targets"]:
        vertical = t[3] or "—"
        verticals_set.add(vertical)

        # Parse JSON fields safely
        financials = {}
        tech_stack = {}
        try:
            if t[22]:  # financials_json at index 22
                financials = json.loads(t[22]) if isinstance(t[22], str) else t[22]
        except:
            pass
        try:
            if t[24]:  # tech_stack_json at index 24
                tech_stack = json.loads(t[24]) if isinstance(t[24], str) else t[24]
        except:
            pass

        # Parse trigger events (newline-separated or JSON array)
        trigger_events = []
        if t[15]:
            try:
                trigger_events = json.loads(t[15]) if t[15].startswith('[') else t[15].split('\n')
            except:
                trigger_events = [t[15]] if t[15] else []

        targets_json.append({
            "id": t[0],
            "company": t[1] or "—",
            "domain": t[2],
            "vertical": vertical,
            "country": t[4] or "—",
            "tier": t[5] or 0,
            "tierName": t[6] or "Unknown",
            "score": t[7] or 0,
            "traffic": t[8] or 0,
            "trafficFmt": format_traffic(t[8]),
            "techSpend": t[9] or 0,
            "partner": t[10] or "Adobe AEM",
            # Extended fields for detail view
            "revenue": t[11] or 0,
            "revenueFmt": format_revenue(t[11]),
            "grossMargin": t[12] or 0,
            "grossMarginFmt": format_percent(t[12]),
            "trafficGrowth": t[13] or 0,
            "trafficGrowthFmt": format_percent(t[13]),
            "currentSearch": t[14] or "Unknown",
            "triggerEvents": trigger_events,
            "execQuote": t[16] or "",
            "execName": t[17] or "",
            "execTitle": t[18] or "",
            "quoteSource": t[19] or "",
            "competitorsUsingAlgolia": t[20] or "",
            "displacementAngle": t[21] if isinstance(t[21], str) and not t[21].startswith('{') else "",
            "financials": financials,
            "hiringSignals": t[23] or "",
            "techStack": tech_stack,
            "lastEnriched": t[25] or None,
            "enrichmentLevel": t[26] or "basic"
        })

    # Sort verticals for dropdown
    verticals_list = sorted([v for v in verticals_set if v != "—"]) + (["—"] if "—" in verticals_set else [])

    stats = data["stats"]
    date_str = datetime.now().strftime("%B %d, %Y")

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PartnerForge | Executive Dashboard</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}

        :root {{
            --bg-dark: #1a1a2e;
            --bg-card: #16213e;
            --bg-card-hover: #1f2b4d;
            --accent-gold: #fbbf24;
            --accent-amber: #f59e0b;
            --accent-orange: #ea580c;
            --text-primary: #ffffff;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --border-color: rgba(255,255,255,0.1);
            --success: #10b981;
            --danger: #ef4444;
            --algolia-blue: #003DFF;
            --algolia-purple: #5468FF;
        }}

        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
        }}

        .header {{
            background: linear-gradient(135deg, #003DFF 0%, #5468FF 50%, #8B5CF6 100%);
            color: white;
            padding: 40px;
        }}
        .header h1 {{ font-size: 2.5em; margin-bottom: 8px; }}
        .header .subtitle {{ font-size: 1.2em; opacity: 0.9; }}
        .header .date {{ font-size: 0.9em; opacity: 0.7; margin-top: 10px; }}

        .container {{ max-width: 1400px; margin: 0 auto; padding: 30px; }}

        /* Search Bar */
        .search-container {{
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.06);
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 100;
        }}
        .search-input {{
            flex: 1;
            min-width: 300px;
            padding: 12px 20px;
            font-size: 1em;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            outline: none;
            transition: border-color 0.2s;
        }}
        .search-input:focus {{ border-color: #003DFF; }}
        .search-input::placeholder {{ color: #94a3b8; }}

        .filter-select {{
            padding: 12px 20px;
            font-size: 1em;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            background: white;
            cursor: pointer;
        }}

        .btn {{
            padding: 12px 24px;
            font-size: 1em;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }}
        .btn-primary {{
            background: #003DFF;
            color: white;
        }}
        .btn-primary:hover {{ background: #0033cc; }}
        .btn-secondary {{
            background: #f1f5f9;
            color: #475569;
        }}
        .btn-secondary:hover {{ background: #e2e8f0; }}

        .view-btn {{
            padding: 6px 14px;
            font-size: 0.85em;
            font-weight: 600;
            border: none;
            border-radius: 6px;
            background: linear-gradient(135deg, #003DFF, #5468FF);
            color: white;
            cursor: pointer;
            transition: all 0.2s;
        }}
        .view-btn:hover {{
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0, 61, 255, 0.3);
        }}

        .search-stats {{
            font-size: 0.9em;
            color: #64748b;
        }}

        /* Stats */
        .stats {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; margin-bottom: 30px; }}
        @media (max-width: 1000px) {{ .stats {{ grid-template-columns: repeat(3, 1fr); }} }}
        @media (max-width: 600px) {{ .stats {{ grid-template-columns: repeat(2, 1fr); }} }}
        .stat {{ background: white; border-radius: 12px; padding: 25px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.06); }}
        .stat .num {{ font-size: 2.8em; font-weight: 800; }}
        .stat .label {{ color: #64748b; margin-top: 5px; }}
        .stat.hot .num {{ color: #ef4444; }}
        .stat.warm .num {{ color: #f59e0b; }}
        .stat.cool .num {{ color: #3b82f6; }}
        .stat.primary .num {{ color: #003DFF; }}
        .stat.green .num {{ color: #10b981; }}

        /* Logic Box */
        .logic-box {{
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.06);
        }}
        .logic-box h2 {{ color: #003DFF; margin-bottom: 20px; }}
        .logic-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 20px; }}
        @media (max-width: 900px) {{ .logic-grid {{ grid-template-columns: repeat(2, 1fr); }} }}
        .logic-step {{
            background: #f8fafc;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
        }}
        .logic-step .icon {{ font-size: 2em; margin-bottom: 10px; }}
        .logic-step h4 {{ color: #1e293b; margin-bottom: 8px; }}
        .logic-step p {{ font-size: 0.9em; color: #64748b; }}

        .formula {{
            background: #1e293b;
            color: white;
            padding: 20px 30px;
            border-radius: 10px;
            font-family: monospace;
            font-size: 1.15em;
            text-align: center;
            margin: 20px 0;
        }}
        .formula .highlight {{ color: #10b981; font-weight: 700; }}

        /* Scoring */
        .scoring {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 25px 0; }}
        @media (max-width: 800px) {{ .scoring {{ grid-template-columns: repeat(2, 1fr); }} }}
        .score-item {{
            background: #fef3c7;
            border: 2px solid #fbbf24;
            border-radius: 10px;
            padding: 15px;
            text-align: center;
        }}
        .score-item .pts {{ font-size: 1.8em; font-weight: 800; color: #f59e0b; }}
        .score-item h4 {{ margin: 5px 0; }}
        .score-item p {{ font-size: 0.8em; color: #92400e; }}

        /* Tabs */
        .tabs-container {{ background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); margin-bottom: 30px; overflow: hidden; }}
        .tabs {{
            display: flex;
            background: #f1f5f9;
            border-bottom: 2px solid #e2e8f0;
            overflow-x: auto;
        }}
        .tab {{
            padding: 15px 25px;
            cursor: pointer;
            border: none;
            background: transparent;
            font-size: 1em;
            font-weight: 500;
            color: #64748b;
            white-space: nowrap;
            transition: all 0.2s;
        }}
        .tab:hover {{ background: #e2e8f0; }}
        .tab.active {{
            background: white;
            color: #003DFF;
            border-bottom: 3px solid #003DFF;
            margin-bottom: -2px;
        }}
        .tab .count {{
            background: #e2e8f0;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 0.85em;
            margin-left: 8px;
        }}
        .tab.active .count {{ background: #dbeafe; color: #003DFF; }}

        .tab-content {{ display: none; padding: 25px; }}
        .tab-content.active {{ display: block; }}
        .tab-content h3 {{ margin-bottom: 20px; color: #1e293b; }}

        /* Tables */
        .table-wrapper {{ overflow-x: auto; }}
        table {{ width: 100%; border-collapse: collapse; min-width: 800px; }}
        th {{
            background: #f8fafc;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #475569;
            border-bottom: 2px solid #e2e8f0;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }}
        th:hover {{ background: #f1f5f9; }}
        th .sort-icon {{ margin-left: 5px; opacity: 0.5; }}
        th.sorted .sort-icon {{ opacity: 1; }}
        td {{ padding: 12px; border-bottom: 1px solid #f1f5f9; }}
        tr:hover {{ background: #f8fafc; }}
        tr.hidden {{ display: none; }}
        a {{ color: #003DFF; text-decoration: none; }}
        a:hover {{ text-decoration: underline; }}
        .traffic {{ color: #64748b; }}
        .note {{ color: #94a3b8; font-size: 0.9em; margin-top: 15px; text-align: center; }}

        /* Score Bar */
        .score-cell {{
            position: relative;
        }}
        .score-bar {{
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .score-bar-bg {{
            width: 60px;
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
        }}
        .score-bar-fill {{
            height: 100%;
            border-radius: 4px;
            transition: width 0.3s;
        }}
        .score-bar-fill.hot {{ background: #ef4444; }}
        .score-bar-fill.warm {{ background: #f59e0b; }}
        .score-bar-fill.cool {{ background: #3b82f6; }}
        .score-bar-fill.cold {{ background: #94a3b8; }}

        /* Tooltip */
        .tooltip {{
            position: relative;
            cursor: help;
        }}
        .tooltip .tooltip-content {{
            visibility: hidden;
            position: absolute;
            z-index: 100;
            bottom: 125%;
            left: 50%;
            transform: translateX(-50%);
            background: #1e293b;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 0.85em;
            white-space: nowrap;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }}
        .tooltip .tooltip-content::after {{
            content: "";
            position: absolute;
            top: 100%;
            left: 50%;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: #1e293b transparent transparent transparent;
        }}
        .tooltip:hover .tooltip-content {{ visibility: visible; }}

        /* Excel-style Column Filters */
        .column-filter {{
            position: relative;
            display: inline-block;
        }}
        .filter-icon {{
            cursor: pointer;
            margin-left: 4px;
            opacity: 0.5;
            font-size: 0.8em;
            vertical-align: middle;
        }}
        .filter-icon:hover, .filter-icon.active {{
            opacity: 1;
        }}
        .filter-dropdown {{
            position: absolute;
            top: 100%;
            left: 0;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 1000;
            min-width: 200px;
            max-height: 350px;
            display: none;
        }}
        .filter-dropdown.open {{
            display: block;
        }}
        .filter-dropdown-header {{
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            gap: 8px;
        }}
        .filter-dropdown-header button {{
            flex: 1;
            padding: 6px 10px;
            font-size: 0.85em;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            background: #f8fafc;
            cursor: pointer;
        }}
        .filter-dropdown-header button:hover {{
            background: #e2e8f0;
        }}
        .filter-dropdown-list {{
            max-height: 250px;
            overflow-y: auto;
            padding: 8px 0;
        }}
        .filter-dropdown-item {{
            padding: 6px 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
        }}
        .filter-dropdown-item:hover {{
            background: #f8fafc;
        }}
        .filter-dropdown-item input {{
            margin: 0;
            cursor: pointer;
        }}
        .filter-dropdown-item label {{
            flex: 1;
            cursor: pointer;
            font-size: 0.9em;
        }}
        .filter-dropdown-footer {{
            padding: 10px 12px;
            border-top: 1px solid #e2e8f0;
        }}
        .filter-dropdown-footer button {{
            width: 100%;
            padding: 8px 12px;
            font-size: 0.9em;
            font-weight: 600;
            border: none;
            border-radius: 4px;
            background: #003DFF;
            color: white;
            cursor: pointer;
        }}
        .filter-dropdown-footer button:hover {{
            background: #0033cc;
        }}
        .filter-active {{
            color: #003DFF;
        }}

        /* Badges */
        .badge {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: 600;
        }}
        .badge.hot {{ background: #fef2f2; color: #dc2626; }}
        .badge.warm {{ background: #fffbeb; color: #d97706; }}
        .badge.cool {{ background: #eff6ff; color: #2563eb; }}
        .badge.commerce {{ background: #dcfce7; color: #166534; }}
        .badge.content {{ background: #dbeafe; color: #1e40af; }}
        .badge.support {{ background: #fef3c7; color: #92400e; }}
        .badge.unknown {{ background: #f1f5f9; color: #475569; }}

        /* Section */
        .section {{ background: white; border-radius: 12px; padding: 30px; margin-bottom: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); }}
        .section h2 {{ margin-bottom: 20px; }}

        footer {{ text-align: center; padding: 30px; color: #64748b; }}

        /* No results */
        .no-results {{
            text-align: center;
            padding: 60px 20px;
            color: #64748b;
        }}
        .no-results h3 {{ margin-bottom: 10px; color: #1e293b; }}

        /* ===== FULL-PAGE DETAIL VIEW ===== */
        .detail-overlay {{
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--bg-dark);
            z-index: 1000;
            overflow-y: auto;
        }}
        .detail-overlay.active {{
            display: block;
        }}

        /* Detail Header */
        .detail-header {{
            background: linear-gradient(135deg, var(--bg-card) 0%, #0f172a 100%);
            border-bottom: 1px solid var(--border-color);
            padding: 24px 40px;
            position: sticky;
            top: 0;
            z-index: 10;
        }}
        .detail-header-top {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
        }}
        .detail-title-group {{
            display: flex;
            align-items: center;
            gap: 20px;
            flex-wrap: wrap;
        }}
        .detail-title-group h1 {{
            font-size: 2em;
            font-weight: 700;
            color: var(--text-primary);
            margin: 0;
        }}
        .detail-meta {{
            display: flex;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
        }}
        .detail-meta .domain {{
            color: var(--text-secondary);
            font-size: 1em;
        }}
        .detail-meta .vertical-badge {{
            background: rgba(255,255,255,0.1);
            color: var(--text-primary);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85em;
        }}
        .detail-meta .country {{
            color: var(--text-muted);
            font-size: 0.9em;
        }}

        /* Priority Badge */
        .priority-badge {{
            padding: 8px 20px;
            border-radius: 25px;
            font-size: 0.9em;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        .priority-badge.hot {{
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: white;
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
        }}
        .priority-badge.warm {{
            background: linear-gradient(135deg, var(--accent-gold), var(--accent-amber));
            color: #1a1a2e;
            box-shadow: 0 4px 15px rgba(251, 191, 36, 0.4);
        }}
        .priority-badge.cool {{
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: white;
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
        }}

        /* Score Display */
        .detail-score {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .detail-score .score-value {{
            font-size: 2.5em;
            font-weight: 800;
            color: var(--accent-gold);
        }}
        .detail-score .score-label {{
            color: var(--text-muted);
            font-size: 0.9em;
        }}

        .detail-close {{
            background: rgba(255,255,255,0.1);
            border: 1px solid var(--border-color);
            font-size: 1.5em;
            cursor: pointer;
            color: var(--text-secondary);
            padding: 8px 16px;
            border-radius: 12px;
            transition: all 0.2s;
        }}
        .detail-close:hover {{
            background: rgba(255,255,255,0.2);
            color: var(--text-primary);
        }}

        .detail-actions {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}

        .enrichment-status {{
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
        }}
        .enrichment-status.fresh {{
            background: rgba(16, 185, 129, 0.2);
            color: #10b981;
        }}
        .enrichment-status.stale {{
            background: rgba(245, 158, 11, 0.2);
            color: #f59e0b;
        }}
        .enrichment-status.never {{
            background: rgba(148, 163, 184, 0.2);
            color: #94a3b8;
        }}

        .refresh-btn {{
            padding: 8px 16px;
            background: linear-gradient(135deg, #003DFF, #5468FF);
            border: none;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }}
        .refresh-btn:hover {{
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(0, 61, 255, 0.4);
        }}
        .refresh-btn.loading {{
            opacity: 0.7;
            cursor: wait;
        }}

        .loading-overlay {{
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(26, 26, 46, 0.95);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        }}
        .loading-overlay.hidden {{
            display: none;
        }}
        .loading-spinner {{
            width: 50px;
            height: 50px;
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-left-color: #5468FF;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }}
        @keyframes spin {{
            to {{ transform: rotate(360deg); }}
        }}
        .loading-text {{
            margin-top: 20px;
            color: white;
            font-size: 1.1em;
        }}

        /* Signal Row */
        .signal-row {{
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
        }}
        .signal-chip {{
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--border-color);
            border-radius: 30px;
            font-weight: 600;
            font-size: 0.95em;
            transition: all 0.2s;
        }}
        .signal-chip.positive {{
            background: rgba(16, 185, 129, 0.15);
            border-color: rgba(16, 185, 129, 0.3);
            color: #34d399;
        }}
        .signal-chip.negative {{
            background: rgba(239, 68, 68, 0.15);
            border-color: rgba(239, 68, 68, 0.3);
            color: #f87171;
        }}

        /* Detail Body */
        .detail-body {{
            padding: 30px 40px;
            max-width: 1600px;
            margin: 0 auto;
        }}

        /* Two Column Layout */
        .detail-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }}
        @media (max-width: 1000px) {{
            .detail-grid {{
                grid-template-columns: 1fr;
            }}
        }}

        /* Glass Card (Dark Theme) */
        .glass-card {{
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(20px);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 24px;
        }}
        .glass-card h3 {{
            color: var(--accent-gold);
            margin-bottom: 20px;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            font-weight: 600;
        }}

        /* Key Metrics */
        .key-metrics {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
        }}
        .metric-box {{
            background: rgba(255,255,255,0.02);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 16px;
            text-align: center;
        }}
        .metric-box .value {{
            font-size: 1.8em;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 4px;
        }}
        .metric-box .value.gold {{ color: var(--accent-gold); }}
        .metric-box .value.green {{ color: var(--success); }}
        .metric-box .label {{
            font-size: 0.8em;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}

        /* Trigger Events */
        .trigger-list {{
            list-style: none;
        }}
        .trigger-list li {{
            padding: 14px 0;
            border-bottom: 1px solid var(--border-color);
            color: var(--text-primary);
            font-size: 0.95em;
            line-height: 1.6;
        }}
        .trigger-list li:last-child {{
            border-bottom: none;
        }}
        .trigger-list .source-link {{
            color: var(--accent-gold);
            font-size: 0.85em;
            margin-left: 8px;
            text-decoration: none;
        }}
        .trigger-list .source-link:hover {{
            text-decoration: underline;
        }}

        /* Competitive Advantage Card */
        .competitive-card {{
            background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%);
            border: 1px solid rgba(251, 191, 36, 0.3);
        }}
        .competitive-row {{
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid var(--border-color);
        }}
        .competitive-row:last-child {{
            border-bottom: none;
        }}
        .competitive-row .key {{
            color: var(--text-muted);
            font-size: 0.9em;
        }}
        .competitive-row .val {{
            color: var(--text-primary);
            font-weight: 600;
        }}
        .competitive-row .val.highlight {{
            color: var(--accent-gold);
        }}

        /* Executive Quote */
        .quote-card {{
            background: linear-gradient(135deg, rgba(84, 104, 255, 0.1) 0%, rgba(0, 61, 255, 0.05) 100%);
            border: 1px solid rgba(84, 104, 255, 0.3);
            margin-bottom: 30px;
        }}
        .quote-text {{
            font-size: 1.2em;
            font-style: italic;
            color: var(--text-primary);
            line-height: 1.7;
            margin-bottom: 16px;
        }}
        .quote-text::before {{
            content: '"';
            font-size: 2em;
            color: var(--algolia-purple);
            line-height: 0;
            vertical-align: -0.3em;
            margin-right: 4px;
        }}
        .quote-attribution {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }}
        .quote-speaker {{
            color: var(--text-primary);
            font-weight: 600;
        }}
        .quote-title {{
            color: var(--text-muted);
            font-size: 0.9em;
        }}
        .quote-source {{
            color: var(--accent-gold);
            text-decoration: none;
            font-size: 0.85em;
        }}
        .quote-source:hover {{
            text-decoration: underline;
        }}

        /* Detail Tabs */
        .detail-tabs {{
            display: flex;
            gap: 8px;
            margin-bottom: 24px;
            flex-wrap: wrap;
            background: rgba(255,255,255,0.02);
            padding: 8px;
            border-radius: 16px;
            border: 1px solid var(--border-color);
        }}
        .detail-tab {{
            padding: 12px 24px;
            cursor: pointer;
            border: none;
            background: transparent;
            font-size: 0.95em;
            font-weight: 500;
            color: var(--text-muted);
            border-radius: 10px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .detail-tab:hover {{
            background: rgba(255,255,255,0.05);
            color: var(--text-secondary);
        }}
        .detail-tab.active {{
            background: var(--accent-gold);
            color: var(--bg-dark);
            font-weight: 600;
        }}
        .detail-tab .emoji {{
            font-size: 1.1em;
        }}

        .detail-tab-content {{
            display: none;
        }}
        .detail-tab-content.active {{
            display: block;
        }}

        /* Financials Table */
        .financials-table {{
            width: 100%;
            border-collapse: collapse;
        }}
        .financials-table th,
        .financials-table td {{
            padding: 14px 16px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }}
        .financials-table th {{
            color: var(--text-muted);
            font-weight: 500;
            font-size: 0.85em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: rgba(255,255,255,0.02);
        }}
        .financials-table td {{
            color: var(--text-primary);
        }}
        .financials-table .trend-up {{
            color: var(--success);
        }}
        .financials-table .trend-down {{
            color: var(--danger);
        }}
        .financials-sources {{
            margin-top: 16px;
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
        }}
        .financials-sources a {{
            color: var(--text-muted);
            font-size: 0.85em;
            text-decoration: none;
            padding: 6px 12px;
            background: rgba(255,255,255,0.05);
            border-radius: 6px;
            transition: all 0.2s;
        }}
        .financials-sources a:hover {{
            background: rgba(255,255,255,0.1);
            color: var(--accent-gold);
        }}

        /* Hiring Signals */
        .hiring-list {{
            list-style: none;
        }}
        .hiring-list li {{
            padding: 12px 16px;
            background: rgba(255,255,255,0.02);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            margin-bottom: 10px;
            color: var(--text-primary);
        }}
        .hiring-list .role {{
            font-weight: 600;
            color: var(--accent-gold);
        }}

        /* Tech Stack Grid */
        .tech-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 16px;
        }}
        .tech-item {{
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 16px;
        }}
        .tech-item .category {{
            color: var(--text-muted);
            font-size: 0.75em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }}
        .tech-item .name {{
            color: var(--text-primary);
            font-weight: 600;
        }}

        /* Full Intel Section */
        .full-intel {{
            color: var(--text-secondary);
            line-height: 1.8;
        }}
        .full-intel h4 {{
            color: var(--accent-gold);
            margin: 24px 0 12px;
            font-size: 1em;
        }}
        .full-intel h4:first-child {{
            margin-top: 0;
        }}

        /* Clickable rows */
        #targetsTable tbody tr {{
            cursor: pointer;
            transition: all 0.2s;
        }}
        #targetsTable tbody tr:hover {{
            background: #eff6ff;
            transform: translateX(4px);
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 PartnerForge</h1>
        <div class="subtitle">Partner Intelligence Platform for Algolia Sales</div>
        <div class="date">Executive Dashboard | {date_str}</div>
    </div>

    <div class="container">
        <!-- Search Bar (Sticky) -->
        <div class="search-container">
            <input type="text" class="search-input" id="searchInput" placeholder="🔍 Search by company, domain, or vertical...">
            <select class="filter-select" id="tierFilter">
                <option value="">All Tiers</option>
                <option value="1">Tier 1: Commerce</option>
                <option value="2">Tier 2: Content</option>
                <option value="3">Tier 3: Support</option>
                <option value="0">Unknown</option>
            </select>
            <select class="filter-select" id="verticalFilter">
                <option value="">All Verticals</option>
                {''.join(f'<option value="{v}">{v}</option>' for v in verticals_list)}
            </select>
            <select class="filter-select" id="scoreFilter">
                <option value="">All Scores</option>
                <option value="hot">🔥 Hot (80+)</option>
                <option value="warm">🌡️ Warm (60-79)</option>
                <option value="cool">❄️ Cool (40-59)</option>
                <option value="cold">Below 40</option>
            </select>
            <button class="btn btn-primary" onclick="exportCSV()">📥 Export CSV</button>
            <button class="btn btn-secondary" onclick="resetFilters()">↺ Reset</button>
            <span class="search-stats" id="searchStats">Showing all {stats['total']:,} targets</span>
        </div>

        <!-- Stats -->
        <div class="stats">
            <div class="stat primary">
                <div class="num">{stats['total']:,}</div>
                <div class="label">Total Targets</div>
            </div>
            <div class="stat hot">
                <div class="num">{stats['hot']}</div>
                <div class="label">🔥 Hot (80+)</div>
            </div>
            <div class="stat warm">
                <div class="num">{stats['warm']}</div>
                <div class="label">🌡️ Warm (60-79)</div>
            </div>
            <div class="stat cool">
                <div class="num">{stats['cool']}</div>
                <div class="label">❄️ Cool (40-59)</div>
            </div>
            <div class="stat green">
                <div class="num">${stats['pipeline']/1_000_000:.1f}M</div>
                <div class="label">Est. Pipeline</div>
            </div>
        </div>

        <!-- Logic Box -->
        <div class="logic-box">
            <h2>🎯 What We're Doing & Why</h2>
            <p style="font-size: 1.1em; margin-bottom: 15px;">
                <strong>Goal:</strong> Find companies using Algolia partner technologies (Adobe AEM) who could benefit from Algolia but aren't using it yet.
            </p>

            <div class="formula">
                <span class="highlight">Displacement Targets</span> = AEM Users (BuiltWith) − Algolia Customers (Internal DB)
            </div>

            <div class="logic-grid">
                <div class="logic-step">
                    <div class="icon">📥</div>
                    <h4>1. Identify</h4>
                    <p>Pull AEM users from BuiltWith API</p>
                </div>
                <div class="logic-step">
                    <div class="icon">➖</div>
                    <h4>2. Filter</h4>
                    <p>Remove existing Algolia customers</p>
                </div>
                <div class="logic-step">
                    <div class="icon">📊</div>
                    <h4>3. Score</h4>
                    <p>Apply ICP scoring (0-100)</p>
                </div>
                <div class="logic-step">
                    <div class="icon">🎯</div>
                    <h4>4. Prioritize</h4>
                    <p>Rank by score + traffic</p>
                </div>
            </div>

            <h3 style="margin-top: 30px; margin-bottom: 15px;">📈 How Scoring Works (0-100 points)</h3>
            <div class="scoring">
                <div class="score-item">
                    <div class="pts">40</div>
                    <h4>ICP Tier</h4>
                    <p>Commerce = 40<br>Content = 25<br>Support = 15</p>
                </div>
                <div class="score-item">
                    <div class="pts">30</div>
                    <h4>Traffic</h4>
                    <p>50M+ = 30<br>10M+ = 25<br>1M+ = 15</p>
                </div>
                <div class="score-item">
                    <div class="pts">20</div>
                    <h4>Tech Spend</h4>
                    <p>$100K+ = 20<br>$50K+ = 15<br>$25K+ = 10</p>
                </div>
                <div class="score-item">
                    <div class="pts">10</div>
                    <h4>Partner</h4>
                    <p>Adobe = 10<br>Shopify = 7<br>Other = 3</p>
                </div>
            </div>
        </div>

        <!-- Results Table -->
        <div class="section">
            <h2>📋 Displacement Targets</h2>
            <p style="color: #64748b; margin-bottom: 20px;">Click a row to view details. Click column headers to sort. Hover on scores to see breakdown.</p>
            <p style="color: #94a3b8; margin-bottom: 20px; font-size: 0.95em; font-style: italic;">Click 'View' to see full intelligence</p>
            <div class="table-wrapper">
                <table id="targetsTable">
                    <thead>
                        <tr>
                            <th data-sort="company">Company <span class="sort-icon">↕</span></th>
                            <th data-sort="domain">Domain <span class="sort-icon">↕</span></th>
                            <th data-sort="vertical">
                                Vertical <span class="sort-icon">↕</span>
                                <span class="column-filter" data-filter="vertical">
                                    <span class="filter-icon" onclick="toggleFilterDropdown(event, 'vertical')">▼</span>
                                    <div class="filter-dropdown" id="filter-dropdown-vertical"></div>
                                </span>
                            </th>
                            <th data-sort="tierName">
                                Tier <span class="sort-icon">↕</span>
                                <span class="column-filter" data-filter="tierName">
                                    <span class="filter-icon" onclick="toggleFilterDropdown(event, 'tierName')">▼</span>
                                    <div class="filter-dropdown" id="filter-dropdown-tierName"></div>
                                </span>
                            </th>
                            <th data-sort="score" class="sorted">Score <span class="sort-icon">↓</span></th>
                            <th data-sort="traffic">Traffic <span class="sort-icon">↕</span></th>
                            <th data-sort="country">
                                Country <span class="sort-icon">↕</span>
                                <span class="column-filter" data-filter="country">
                                    <span class="filter-icon" onclick="toggleFilterDropdown(event, 'country')">▼</span>
                                    <div class="filter-dropdown" id="filter-dropdown-country"></div>
                                </span>
                            </th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody id="targetsBody">
                        <!-- Populated by JavaScript -->
                    </tbody>
                </table>
            </div>
            <div class="no-results" id="noResults" style="display: none;">
                <h3>No results found</h3>
                <p>Try adjusting your search or filters</p>
            </div>
        </div>

        <!-- Data Persistence Note -->
        <div class="section" style="background: #f0fdf4; border: 2px solid #10b981;">
            <h2 style="color: #166534;">💾 Data Persistence</h2>
            <p style="color: #166534; font-size: 1.05em;">
                All data is cached in <strong>SQLite database</strong> (partnerforge.db).
                API calls are only made once per company, then stored locally. This saves BuiltWith/SimilarWeb credits.
            </p>
        </div>
    </div>

    <footer>
        <p><strong>PartnerForge v2.0</strong> | Partner Intelligence Platform | Built with Claude Code</p>
    </footer>

    <!-- Full-Page Company Detail View -->
    <div class="detail-overlay" id="companyDetail">
        <!-- Header -->
        <div class="detail-header">
            <div class="detail-header-top">
                <div>
                    <div class="detail-title-group">
                        <h1 id="detailCompanyName">Company Name</h1>
                        <span class="priority-badge" id="detailPriorityBadge">HOT</span>
                        <div class="detail-score">
                            <span class="score-value" id="detailScoreValue">85</span>
                            <span class="score-label">/ 100</span>
                        </div>
                    </div>
                    <div class="detail-meta">
                        <span class="domain" id="detailDomain">example.com</span>
                        <span class="vertical-badge" id="detailVertical">Retail</span>
                        <span class="country" id="detailCountry">United States</span>
                    </div>
                </div>
                <div class="detail-actions">
                    <span class="enrichment-status" id="enrichmentStatus">Not enriched</span>
                    <button class="refresh-btn" id="refreshDataBtn" onclick="refreshCompanyData()">🔄 Refresh Data</button>
                    <button class="detail-close" onclick="closeDetail()">&times; Close</button>
                </div>
            </div>
            <!-- Signal Row -->
            <div class="signal-row">
                <div class="signal-chip" id="signalBudget">
                    <span>Budget</span>
                </div>
                <div class="signal-chip" id="signalPain">
                    <span>Pain</span>
                </div>
                <div class="signal-chip" id="signalTiming">
                    <span>Timing</span>
                </div>
            </div>
        </div>

        <!-- Body -->
        <div class="detail-body">
            <!-- Two Column Layout -->
            <div class="detail-grid">
                <!-- LEFT: Company Info + Key Metrics -->
                <div class="glass-card">
                    <h3>Key Metrics</h3>
                    <div class="key-metrics">
                        <div class="metric-box">
                            <div class="value gold" id="detailRevenue">$12.4B</div>
                            <div class="label">Revenue</div>
                        </div>
                        <div class="metric-box">
                            <div class="value" id="detailMargin">38.2%</div>
                            <div class="label">Gross Margin</div>
                        </div>
                        <div class="metric-box">
                            <div class="value" id="detailTraffic">45.2M</div>
                            <div class="label">Monthly Visits</div>
                        </div>
                        <div class="metric-box">
                            <div class="value green" id="detailGrowth">+12.4%</div>
                            <div class="label">Traffic Growth</div>
                        </div>
                    </div>
                </div>

                <!-- RIGHT: Trigger Events -->
                <div class="glass-card">
                    <h3>Trigger Events</h3>
                    <ul class="trigger-list" id="detailTriggers">
                        <li>RichRelevance REMOVED → Recommendations gap <a href="#" class="source-link">[BuiltWith ↗]</a></li>
                        <li>New CDO (ex-Alibaba) → New broom sweeps clean <a href="#" class="source-link">[LinkedIn ↗]</a></li>
                        <li>Q4 earnings: "investing heavily in digital" <a href="#" class="source-link">[10-K ↗]</a></li>
                    </ul>
                </div>
            </div>

            <!-- Competitive Advantage Card -->
            <div class="glass-card competitive-card">
                <h3>Competitive Advantage</h3>
                <div class="competitive-row">
                    <span class="key">Their Current Search</span>
                    <span class="val highlight" id="detailCurrentSearch">Elasticsearch</span>
                </div>
                <div class="competitive-row">
                    <span class="key">Displacement Angle</span>
                    <span class="val" id="detailDisplacement">Legacy search cannot handle 50M SKU catalog at scale</span>
                </div>
                <div class="competitive-row">
                    <span class="key">Competitors Using Algolia</span>
                    <span class="val" id="detailAlgoliaCompetitors">Wayfair, Target, Overstock</span>
                </div>
            </div>

            <!-- Executive Quote -->
            <div class="glass-card quote-card" id="quoteSection">
                <h3>Executive Quote</h3>
                <p class="quote-text" id="detailQuote">We need to fundamentally transform how customers discover products. Our current search experience is not meeting expectations.</p>
                <div class="quote-attribution">
                    <div>
                        <span class="quote-speaker" id="detailExecName">John Smith</span>
                        <span class="quote-title" id="detailExecTitle">, CEO</span>
                    </div>
                    <a href="#" class="quote-source" id="detailQuoteSource" target="_blank">[Q4 Earnings Call ↗]</a>
                </div>
            </div>

            <!-- Tabs -->
            <div class="detail-tabs">
                <button class="detail-tab active" data-tab="financials">
                    <span class="emoji">💰</span> Financials
                </button>
                <button class="detail-tab" data-tab="quotes">
                    <span class="emoji">📜</span> Quotes
                </button>
                <button class="detail-tab" data-tab="hiring">
                    <span class="emoji">👔</span> Hiring
                </button>
                <button class="detail-tab" data-tab="techstack">
                    <span class="emoji">🔧</span> Tech Stack
                </button>
                <button class="detail-tab" data-tab="full">
                    <span class="emoji">📄</span> Full Intel
                </button>
            </div>

            <!-- Tab Content: Financials -->
            <div class="detail-tab-content active" id="tab-financials">
                <div class="glass-card">
                    <table class="financials-table">
                        <thead>
                            <tr>
                                <th>Metric</th>
                                <th>FY2023</th>
                                <th>FY2024</th>
                                <th>FY2025</th>
                                <th>CAGR</th>
                                <th>Trend</th>
                            </tr>
                        </thead>
                        <tbody id="financialsTableBody">
                            <tr>
                                <td>Revenue</td>
                                <td>$10.2B</td>
                                <td>$11.1B</td>
                                <td>$12.4B</td>
                                <td>10.2%</td>
                                <td class="trend-up">↑</td>
                            </tr>
                            <tr>
                                <td>Net Income</td>
                                <td>$820M</td>
                                <td>$910M</td>
                                <td>$1.1B</td>
                                <td>15.8%</td>
                                <td class="trend-up">↑</td>
                            </tr>
                            <tr>
                                <td>E-comm Revenue</td>
                                <td>$2.1B</td>
                                <td>$2.8B</td>
                                <td>$3.5B</td>
                                <td>29.1%</td>
                                <td class="trend-up">↑</td>
                            </tr>
                            <tr>
                                <td>Tech Capex</td>
                                <td>$180M</td>
                                <td>$220M</td>
                                <td>$280M</td>
                                <td>24.7%</td>
                                <td class="trend-up">↑</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="financials-sources">
                        <a href="#" id="source10K" target="_blank">📄 10-K FY2025</a>
                        <a href="#" id="sourceYahoo" target="_blank">📊 Yahoo Finance</a>
                    </div>
                </div>
            </div>

            <!-- Tab Content: Quotes -->
            <div class="detail-tab-content" id="tab-quotes">
                <div class="glass-card" id="quotesContent">
                    <p style="color: var(--text-muted);">Additional executive quotes will appear here when available.</p>
                </div>
            </div>

            <!-- Tab Content: Hiring -->
            <div class="detail-tab-content" id="tab-hiring">
                <div class="glass-card">
                    <ul class="hiring-list" id="hiringList">
                        <li><span class="role">Director of Search Engineering</span> - Remote, US</li>
                        <li><span class="role">Senior ML Engineer, Search Relevance</span> - Seattle, WA</li>
                        <li><span class="role">Product Manager, Discovery</span> - New York, NY</li>
                    </ul>
                </div>
            </div>

            <!-- Tab Content: Tech Stack -->
            <div class="detail-tab-content" id="tab-techstack">
                <div class="glass-card">
                    <div class="tech-grid" id="techStackGrid">
                        <div class="tech-item">
                            <div class="category">Search</div>
                            <div class="name">Elasticsearch</div>
                        </div>
                        <div class="tech-item">
                            <div class="category">CMS</div>
                            <div class="name">Adobe AEM</div>
                        </div>
                        <div class="tech-item">
                            <div class="category">E-commerce</div>
                            <div class="name">Salesforce Commerce Cloud</div>
                        </div>
                        <div class="tech-item">
                            <div class="category">CDN</div>
                            <div class="name">Akamai</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab Content: Full Intel -->
            <div class="detail-tab-content" id="tab-full">
                <div class="glass-card">
                    <div class="full-intel" id="fullIntelContent">
                        <h4>Company Overview</h4>
                        <p>Full intelligence report content will be displayed here...</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading Overlay -->
        <div class="loading-overlay hidden" id="detailLoadingOverlay">
            <div class="loading-spinner"></div>
            <div class="loading-text" id="loadingText">Enriching company data...</div>
        </div>
    </div>

    <script>
        // ===== API CONFIGURATION =====
        const API_BASE_URL = 'http://localhost:8000';
        let currentTargetDomain = null;

        // ===== API FUNCTIONS =====
        async function fetchCompanyFromAPI(domain) {{
            try {{
                const response = await fetch(`${{API_BASE_URL}}/api/company/${{domain}}`);
                if (!response.ok) return null;
                const data = await response.json();
                return data.company;
            }} catch (error) {{
                console.error('API fetch error:', error);
                return null;
            }}
        }}

        async function enrichCompanyFromAPI(domain, force = false) {{
            try {{
                const url = `${{API_BASE_URL}}/api/enrich/${{domain}}${{force ? '?force=true' : ''}}`;
                const response = await fetch(url, {{ method: 'POST' }});
                return await response.json();
            }} catch (error) {{
                console.error('API enrichment error:', error);
                return {{ success: false, error: error.message }};
            }}
        }}

        function showLoading(message = 'Enriching company data...') {{
            const overlay = document.getElementById('detailLoadingOverlay');
            const textEl = document.getElementById('loadingText');
            if (overlay && textEl) {{
                textEl.textContent = message;
                overlay.classList.remove('hidden');
            }}
        }}

        function hideLoading() {{
            const overlay = document.getElementById('detailLoadingOverlay');
            if (overlay) overlay.classList.add('hidden');
        }}

        function updateEnrichmentStatus(lastEnriched, enrichmentLevel) {{
            const statusEl = document.getElementById('enrichmentStatus');
            if (!statusEl) return;

            if (enrichmentLevel === 'full' && lastEnriched) {{
                const enrichedDate = new Date(lastEnriched);
                const daysSince = Math.floor((new Date() - enrichedDate) / (1000 * 60 * 60 * 24));
                if (daysSince < 7) {{
                    statusEl.textContent = 'Data fresh';
                    statusEl.className = 'enrichment-status fresh';
                }} else {{
                    statusEl.textContent = `Updated ${{daysSince}}d ago`;
                    statusEl.className = 'enrichment-status stale';
                }}
            }} else {{
                statusEl.textContent = 'Not enriched';
                statusEl.className = 'enrichment-status never';
            }}
        }}

        async function refreshCompanyData() {{
            if (!currentTargetDomain) return;

            const refreshBtn = document.getElementById('refreshDataBtn');
            if (refreshBtn) {{
                refreshBtn.classList.add('loading');
                refreshBtn.disabled = true;
            }}

            showLoading('Fetching data from BuiltWith, SimilarWeb, Yahoo Finance...');

            try {{
                const result = await enrichCompanyFromAPI(currentTargetDomain, true);

                if (result.success && result.result && result.result.company) {{
                    updateDetailViewWithAPIData(result.result.company);
                    hideLoading();
                }} else if (result.cached) {{
                    hideLoading();
                    alert('Data is already fresh (cached). No update needed.');
                }} else {{
                    hideLoading();
                    const errors = result.errors ? result.errors.join(', ') : 'Unknown error';
                    alert('Enrichment partially completed. Errors: ' + errors);
                    const company = await fetchCompanyFromAPI(currentTargetDomain);
                    if (company) updateDetailViewWithAPIData(company);
                }}
            }} catch (error) {{
                hideLoading();
                console.error('Refresh error:', error);
                alert('Failed to refresh data. Is the API server running at ' + API_BASE_URL + '?');
            }} finally {{
                if (refreshBtn) {{
                    refreshBtn.classList.remove('loading');
                    refreshBtn.disabled = false;
                }}
            }}
        }}

        function updateDetailViewWithAPIData(apiData) {{
            updateEnrichmentStatus(apiData.last_enriched, apiData.enrichment_level);

            // Update metrics
            if (apiData.revenue) {{
                const revFmt = formatCurrency(apiData.revenue);
                const el = document.getElementById('detailRevenue');
                if (el) el.textContent = revFmt;
            }}
            if (apiData.gross_margin) {{
                const el = document.getElementById('detailMargin');
                if (el) el.textContent = (apiData.gross_margin * 100).toFixed(1) + '%';
            }}
            if (apiData.sw_monthly_visits) {{
                const el = document.getElementById('detailTraffic');
                if (el) el.textContent = formatTraffic(apiData.sw_monthly_visits);
            }}

            // Update tech stack
            if (apiData.tech_stack_json) {{
                let techStack = apiData.tech_stack_json;
                if (typeof techStack === 'string') {{
                    try {{ techStack = JSON.parse(techStack); }} catch(e) {{}}
                }}
                if (Array.isArray(techStack) && techStack.length > 0) {{
                    const techGrid = document.getElementById('techStackGrid');
                    if (techGrid) {{
                        techGrid.innerHTML = techStack.slice(0, 12).map(tech => `
                            <div class="tech-item">
                                <div class="category">${{tech.category || 'Technology'}}</div>
                                <div class="name">${{tech.name}}</div>
                            </div>
                        `).join('');
                    }}
                }}
            }}
        }}

        function formatCurrency(value) {{
            if (!value) return '—';
            if (value >= 1e12) return '$' + (value / 1e12).toFixed(1) + 'T';
            if (value >= 1e9) return '$' + (value / 1e9).toFixed(1) + 'B';
            if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
            if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
            return '$' + value.toFixed(0);
        }}

        function formatTraffic(value) {{
            if (!value) return '—';
            if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
            if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
            if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
            return value.toString();
        }}

        // Data
        const allTargets = {json.dumps(targets_json)};

        // State
        let filteredTargets = [...allTargets];
        let sortColumn = 'score';
        let sortDirection = 'desc';

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {{
            renderTable();
            setupEventListeners();
        }});

        function setupEventListeners() {{
            // Search
            document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 200));

            // Filters
            document.getElementById('tierFilter').addEventListener('change', applyFilters);
            document.getElementById('verticalFilter').addEventListener('change', applyFilters);
            document.getElementById('scoreFilter').addEventListener('change', applyFilters);

            // Sorting
            document.querySelectorAll('th[data-sort]').forEach(th => {{
                th.addEventListener('click', () => {{
                    const column = th.dataset.sort;
                    if (sortColumn === column) {{
                        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                    }} else {{
                        sortColumn = column;
                        sortDirection = 'desc';
                    }}
                    sortTargets();
                    updateSortIndicators();
                    renderTable();
                }});
            }});
        }}

        function applyFilters() {{
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const tierFilter = document.getElementById('tierFilter').value;
            const verticalFilter = document.getElementById('verticalFilter').value;
            const scoreFilter = document.getElementById('scoreFilter').value;

            filteredTargets = allTargets.filter(t => {{
                // Search
                const matchesSearch = !searchTerm ||
                    t.company.toLowerCase().includes(searchTerm) ||
                    t.domain.toLowerCase().includes(searchTerm) ||
                    t.vertical.toLowerCase().includes(searchTerm) ||
                    t.country.toLowerCase().includes(searchTerm);

                // Tier (from dropdown)
                const matchesTier = !tierFilter || t.tier == tierFilter;

                // Vertical (from dropdown)
                const matchesVertical = !verticalFilter || t.vertical === verticalFilter;

                // Score
                let matchesScore = true;
                if (scoreFilter === 'hot') matchesScore = t.score >= 80;
                else if (scoreFilter === 'warm') matchesScore = t.score >= 60 && t.score < 80;
                else if (scoreFilter === 'cool') matchesScore = t.score >= 40 && t.score < 60;
                else if (scoreFilter === 'cold') matchesScore = t.score < 40;

                // Excel-style column filters
                const matchesColumnVertical = columnFilterSelections.vertical.size === 0 ||
                    columnFilterSelections.vertical.has(t.vertical);
                const matchesColumnTier = columnFilterSelections.tierName.size === 0 ||
                    columnFilterSelections.tierName.has(t.tierName);
                const matchesColumnCountry = columnFilterSelections.country.size === 0 ||
                    columnFilterSelections.country.has(t.country);

                return matchesSearch && matchesTier && matchesVertical && matchesScore &&
                       matchesColumnVertical && matchesColumnTier && matchesColumnCountry;
            }});

            sortTargets();
            renderTable();
            updateStats();
        }}

        function sortTargets() {{
            filteredTargets.sort((a, b) => {{
                let aVal = a[sortColumn];
                let bVal = b[sortColumn];

                // Handle nulls
                if (aVal === null || aVal === '—') aVal = sortDirection === 'asc' ? Infinity : -Infinity;
                if (bVal === null || bVal === '—') bVal = sortDirection === 'asc' ? Infinity : -Infinity;

                // Numeric comparison for numbers
                if (typeof aVal === 'number' && typeof bVal === 'number') {{
                    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                }}

                // String comparison
                aVal = String(aVal).toLowerCase();
                bVal = String(bVal).toLowerCase();
                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            }});
        }}

        function renderTable() {{
            const tbody = document.getElementById('targetsBody');
            const noResults = document.getElementById('noResults');

            if (filteredTargets.length === 0) {{
                tbody.innerHTML = '';
                noResults.style.display = 'block';
                return;
            }}

            noResults.style.display = 'none';

            // Limit to 500 for performance
            const displayTargets = filteredTargets.slice(0, 500);

            tbody.innerHTML = displayTargets.map(t => {{
                const scoreClass = t.score >= 80 ? 'hot' : t.score >= 60 ? 'warm' : t.score >= 40 ? 'cool' : 'cold';
                const tierClass = t.tier === 1 ? 'commerce' : t.tier === 2 ? 'content' : t.tier === 3 ? 'support' : 'unknown';

                // Calculate score breakdown
                const tierPts = t.tier === 1 ? 40 : t.tier === 2 ? 25 : t.tier === 3 ? 15 : 0;
                const trafficPts = t.traffic >= 50000000 ? 30 : t.traffic >= 10000000 ? 25 : t.traffic >= 5000000 ? 20 : t.traffic >= 1000000 ? 15 : t.traffic >= 500000 ? 10 : t.traffic >= 100000 ? 5 : 0;
                const techPts = t.techSpend >= 100000 ? 20 : t.techSpend >= 50000 ? 15 : t.techSpend >= 25000 ? 10 : t.techSpend >= 10000 ? 5 : 0;
                const partnerPts = t.partner.includes('Adobe') ? 10 : t.partner.includes('Shopify') ? 7 : 3;

                return `<tr data-id="${{t.id}}">
                    <td><strong>${{t.company}}</strong></td>
                    <td><a href="https://${{t.domain}}" target="_blank">${{t.domain}}</a></td>
                    <td>${{t.vertical}}</td>
                    <td><span class="badge ${{tierClass}}">${{t.tierName}}</span></td>
                    <td class="score-cell">
                        <div class="tooltip">
                            <div class="score-bar">
                                <div class="score-bar-bg">
                                    <div class="score-bar-fill ${{scoreClass}}" style="width: ${{t.score}}%"></div>
                                </div>
                                <span class="badge ${{scoreClass}}">${{t.score}}</span>
                            </div>
                            <div class="tooltip-content">
                                <strong>Score Breakdown</strong><br>
                                ICP Tier: ${{tierPts}}/40<br>
                                Traffic: ${{trafficPts}}/30<br>
                                Tech Spend: ${{techPts}}/20<br>
                                Partner: ${{partnerPts}}/10
                            </div>
                        </div>
                    </td>
                    <td class="traffic">${{t.trafficFmt}}</td>
                    <td>${{t.country}}</td>
                    <td><button class="view-btn" onclick="event.stopPropagation(); openDetail(${{t.id}})">View →</button></td>
                </tr>`;
            }}).join('');
        }}

        function updateStats() {{
            const stats = document.getElementById('searchStats');
            const total = filteredTargets.length;
            const allTotal = allTargets.length;

            if (total === allTotal) {{
                stats.textContent = `Showing all ${{total.toLocaleString()}} targets`;
            }} else {{
                stats.textContent = `Showing ${{total.toLocaleString()}} of ${{allTotal.toLocaleString()}} targets`;
            }}
        }}

        function updateSortIndicators() {{
            document.querySelectorAll('th[data-sort]').forEach(th => {{
                th.classList.remove('sorted');
                th.querySelector('.sort-icon').textContent = '↕';
            }});

            const activeTh = document.querySelector(`th[data-sort="${{sortColumn}}"]`);
            if (activeTh) {{
                activeTh.classList.add('sorted');
                activeTh.querySelector('.sort-icon').textContent = sortDirection === 'asc' ? '↑' : '↓';
            }}
        }}

        function resetFilters() {{
            document.getElementById('searchInput').value = '';
            document.getElementById('tierFilter').value = '';
            document.getElementById('verticalFilter').value = '';
            document.getElementById('scoreFilter').value = '';

            // Reset column filters (select all)
            Object.keys(columnFilters).forEach(col => {{
                columnFilterSelections[col] = new Set(columnFilters[col]);
                updateFilterCheckboxes(col);
                // Reset filter icon style
                const filterIcon = document.querySelector(`[data-filter="${{col}}"] .filter-icon`);
                if (filterIcon) filterIcon.classList.remove('active');
            }});

            filteredTargets = [...allTargets];
            sortColumn = 'score';
            sortDirection = 'desc';
            sortTargets();
            updateSortIndicators();
            renderTable();
            updateStats();
        }}

        function exportCSV() {{
            const headers = ['Company', 'Domain', 'Vertical', 'Tier', 'Score', 'Traffic', 'Country'];
            const rows = filteredTargets.map(t => [
                t.company,
                t.domain,
                t.vertical,
                t.tierName,
                t.score,
                t.traffic,
                t.country
            ]);

            const csv = [headers, ...rows].map(row =>
                row.map(cell => `"${{String(cell).replace(/"/g, '""')}}"`).join(',')
            ).join('\\n');

            const blob = new Blob([csv], {{ type: 'text/csv' }});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `partnerforge_targets_${{new Date().toISOString().split('T')[0]}}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }}

        function debounce(func, wait) {{
            let timeout;
            return function(...args) {{
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            }};
        }}

        // Excel-style Column Filters
        const columnFilters = {{
            vertical: new Set(),
            tierName: new Set(),
            country: new Set()
        }};
        const columnFilterSelections = {{
            vertical: new Set(),
            tierName: new Set(),
            country: new Set()
        }};

        function initColumnFilters() {{
            // Build unique values for each filterable column
            allTargets.forEach(t => {{
                columnFilters.vertical.add(t.vertical);
                columnFilters.tierName.add(t.tierName);
                columnFilters.country.add(t.country);
            }});

            // Initialize selections (all selected by default)
            Object.keys(columnFilters).forEach(col => {{
                columnFilterSelections[col] = new Set(columnFilters[col]);
            }});

            // Build dropdown content for each filter
            buildFilterDropdown('vertical');
            buildFilterDropdown('tierName');
            buildFilterDropdown('country');
        }}

        function buildFilterDropdown(column) {{
            const dropdown = document.getElementById(`filter-dropdown-${{column}}`);
            const values = Array.from(columnFilters[column]).sort((a, b) => {{
                if (a === '—' || a === 'Unknown') return 1;
                if (b === '—' || b === 'Unknown') return -1;
                return a.localeCompare(b);
            }});

            dropdown.innerHTML = `
                <div class="filter-dropdown-header">
                    <button onclick="selectAllFilter(event, '${{column}}')">Select All</button>
                    <button onclick="clearAllFilter(event, '${{column}}')">Clear All</button>
                </div>
                <div class="filter-dropdown-list">
                    ${{values.map(val => `
                        <div class="filter-dropdown-item">
                            <input type="checkbox" id="filter-${{column}}-${{val.replace(/[^a-zA-Z0-9]/g, '_')}}"
                                   data-column="${{column}}" data-value="${{val}}"
                                   ${{columnFilterSelections[column].has(val) ? 'checked' : ''}}
                                   onchange="updateFilterSelection('${{column}}', '${{val.replace(/'/g, "\\\\'")}}')" />
                            <label for="filter-${{column}}-${{val.replace(/[^a-zA-Z0-9]/g, '_')}}">${{val}}</label>
                        </div>
                    `).join('')}}
                </div>
                <div class="filter-dropdown-footer">
                    <button onclick="applyColumnFilter(event, '${{column}}')">Apply</button>
                </div>
            `;
        }}

        function toggleFilterDropdown(event, column) {{
            event.stopPropagation();
            event.preventDefault();

            // Close all other dropdowns
            document.querySelectorAll('.filter-dropdown').forEach(dd => {{
                if (dd.id !== `filter-dropdown-${{column}}`) {{
                    dd.classList.remove('open');
                }}
            }});

            const dropdown = document.getElementById(`filter-dropdown-${{column}}`);
            dropdown.classList.toggle('open');
        }}

        function selectAllFilter(event, column) {{
            event.stopPropagation();
            columnFilterSelections[column] = new Set(columnFilters[column]);
            updateFilterCheckboxes(column);
        }}

        function clearAllFilter(event, column) {{
            event.stopPropagation();
            columnFilterSelections[column] = new Set();
            updateFilterCheckboxes(column);
        }}

        function updateFilterCheckboxes(column) {{
            const dropdown = document.getElementById(`filter-dropdown-${{column}}`);
            dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {{
                cb.checked = columnFilterSelections[column].has(cb.dataset.value);
            }});
        }}

        function updateFilterSelection(column, value) {{
            if (columnFilterSelections[column].has(value)) {{
                columnFilterSelections[column].delete(value);
            }} else {{
                columnFilterSelections[column].add(value);
            }}
        }}

        function applyColumnFilter(event, column) {{
            event.stopPropagation();
            const dropdown = document.getElementById(`filter-dropdown-${{column}}`);
            dropdown.classList.remove('open');

            // Update filter icon style
            const filterIcon = document.querySelector(`[data-filter="${{column}}"] .filter-icon`);
            const allSelected = columnFilterSelections[column].size === columnFilters[column].size;
            filterIcon.classList.toggle('active', !allSelected);

            applyFilters();
        }}

        // Close dropdowns when clicking outside
        document.addEventListener('click', (event) => {{
            if (!event.target.closest('.column-filter')) {{
                document.querySelectorAll('.filter-dropdown').forEach(dd => {{
                    dd.classList.remove('open');
                }});
            }}
        }});

        // Initialize column filters on load
        document.addEventListener('DOMContentLoaded', () => {{
            initColumnFilters();
        }});

        // ===== FULL-PAGE DETAIL VIEW =====
        function openDetail(targetId) {{
            const target = allTargets.find(t => t.id === targetId);
            if (!target) return;

            // Set current domain for API calls
            currentTargetDomain = target.domain;

            // Update enrichment status
            updateEnrichmentStatus(target.lastEnriched, target.enrichmentLevel || 'basic');

            // Calculate score breakdown
            const tierPts = target.tier === 1 ? 40 : target.tier === 2 ? 25 : target.tier === 3 ? 15 : 0;
            const trafficPts = target.traffic >= 50000000 ? 30 : target.traffic >= 10000000 ? 25 : target.traffic >= 5000000 ? 20 : target.traffic >= 1000000 ? 15 : target.traffic >= 500000 ? 10 : target.traffic >= 100000 ? 5 : 0;
            const techPts = target.techSpend >= 100000 ? 20 : target.techSpend >= 50000 ? 15 : target.techSpend >= 25000 ? 10 : target.techSpend >= 10000 ? 5 : 0;

            // Determine priority
            const priority = target.score >= 80 ? 'hot' : target.score >= 60 ? 'warm' : 'cool';
            const priorityLabel = priority.toUpperCase();

            // Update header
            document.getElementById('detailCompanyName').textContent = target.company;
            document.getElementById('detailScoreValue').textContent = target.score;
            document.getElementById('detailDomain').textContent = target.domain;
            document.getElementById('detailVertical').textContent = target.vertical;
            document.getElementById('detailCountry').textContent = target.country;

            const badge = document.getElementById('detailPriorityBadge');
            badge.textContent = priorityLabel;
            badge.className = 'priority-badge ' + priority;

            // Update signal indicators
            const signalBudget = document.getElementById('signalBudget');
            const signalPain = document.getElementById('signalPain');
            const signalTiming = document.getElementById('signalTiming');

            signalBudget.className = 'signal-chip ' + (techPts >= 10 ? 'positive' : 'negative');
            signalBudget.innerHTML = (techPts >= 10 ? '✅' : '❌') + ' Budget';

            signalPain.className = 'signal-chip ' + (target.tier === 1 ? 'positive' : 'negative');
            signalPain.innerHTML = (target.tier === 1 ? '✅' : '❌') + ' Pain';

            signalTiming.className = 'signal-chip ' + (trafficPts >= 15 ? 'positive' : 'negative');
            signalTiming.innerHTML = (trafficPts >= 15 ? '✅' : '❌') + ' Timing';

            // Update key metrics
            document.getElementById('detailRevenue').textContent = target.revenueFmt || '—';
            document.getElementById('detailMargin').textContent = target.grossMarginFmt || '—';
            document.getElementById('detailTraffic').textContent = target.trafficFmt;
            const growthEl = document.getElementById('detailGrowth');
            growthEl.textContent = target.trafficGrowth > 0 ? '+' + target.trafficGrowthFmt : target.trafficGrowthFmt;
            growthEl.className = 'value ' + (target.trafficGrowth >= 0 ? 'green' : '');

            // Update trigger events
            const triggersEl = document.getElementById('detailTriggers');
            if (target.triggerEvents && target.triggerEvents.length > 0) {{
                triggersEl.innerHTML = target.triggerEvents
                    .filter(e => e && e.trim())
                    .map(event => `<li>${{event}}</li>`)
                    .join('');
            }} else {{
                triggersEl.innerHTML = '<li style="color: var(--text-muted);">No trigger events identified yet</li>';
            }}

            // Update competitive advantage
            document.getElementById('detailCurrentSearch').textContent = target.currentSearch || 'Unknown';
            document.getElementById('detailDisplacement').textContent = target.displacementAngle || 'Analysis pending';
            document.getElementById('detailAlgoliaCompetitors').textContent = target.competitorsUsingAlgolia || 'None identified';

            // Update executive quote
            const quoteSection = document.getElementById('quoteSection');
            if (target.execQuote) {{
                quoteSection.style.display = 'block';
                document.getElementById('detailQuote').textContent = target.execQuote;
                document.getElementById('detailExecName').textContent = target.execName || 'Executive';
                document.getElementById('detailExecTitle').textContent = target.execTitle ? ', ' + target.execTitle : '';
                const sourceLink = document.getElementById('detailQuoteSource');
                if (target.quoteSource) {{
                    sourceLink.href = target.quoteSource;
                    sourceLink.textContent = '[Source ↗]';
                    sourceLink.style.display = 'inline';
                }} else {{
                    sourceLink.style.display = 'none';
                }}
            }} else {{
                quoteSection.style.display = 'none';
            }}

            // Update financials table
            if (target.financials && Object.keys(target.financials).length > 0) {{
                // If we have structured financial data, populate table
                const tbody = document.getElementById('financialsTableBody');
                // Keep default table for demo - real implementation would parse target.financials
            }}

            // Update hiring signals
            const hiringList = document.getElementById('hiringList');
            if (target.hiringSignals) {{
                const signals = target.hiringSignals.split('\\n').filter(s => s.trim());
                if (signals.length > 0) {{
                    hiringList.innerHTML = signals.map(s => `<li>${{s}}</li>`).join('');
                }} else {{
                    hiringList.innerHTML = '<li style="color: var(--text-muted);">No hiring signals identified</li>';
                }}
            }} else {{
                hiringList.innerHTML = '<li style="color: var(--text-muted);">No hiring signals identified</li>';
            }}

            // Update tech stack
            const techGrid = document.getElementById('techStackGrid');
            if (target.techStack && Object.keys(target.techStack).length > 0) {{
                techGrid.innerHTML = Object.entries(target.techStack)
                    .map(([cat, name]) => `
                        <div class="tech-item">
                            <div class="category">${{cat}}</div>
                            <div class="name">${{name}}</div>
                        </div>
                    `).join('');
            }} else {{
                techGrid.innerHTML = `
                    <div class="tech-item">
                        <div class="category">Partner Tech</div>
                        <div class="name">${{target.partner}}</div>
                    </div>
                `;
            }}

            // Update full intel
            const fullIntel = document.getElementById('fullIntelContent');
            fullIntel.innerHTML = `
                <h4>Company Overview</h4>
                <p><strong>${{target.company}}</strong> operates in the <strong>${{target.vertical}}</strong> vertical with approximately <strong>${{target.trafficFmt}}</strong> monthly visits.</p>

                <h4>ICP Analysis</h4>
                <p>Tier: <strong>${{target.tierName}}</strong> (Score component: ${{tierPts}}/40)<br>
                Partner Technology: <strong>${{target.partner}}</strong></p>

                <h4>Search Infrastructure</h4>
                <p>Current search provider: <strong>${{target.currentSearch || 'Unknown'}}</strong></p>
                ${{target.displacementAngle ? `<p>Displacement opportunity: ${{target.displacementAngle}}</p>` : ''}}

                <h4>Competitive Landscape</h4>
                <p>Competitors using Algolia: <strong>${{target.competitorsUsingAlgolia || 'None identified'}}</strong></p>
            `;

            // Reset tabs to financials
            document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.detail-tab[data-tab="financials"]').classList.add('active');
            document.querySelectorAll('.detail-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('tab-financials').classList.add('active');

            // Show detail view
            document.getElementById('companyDetail').classList.add('active');
            document.body.style.overflow = 'hidden';
        }}

        function closeDetail() {{
            document.getElementById('companyDetail').classList.remove('active');
            document.body.style.overflow = '';
        }}

        // Tab switching
        document.querySelectorAll('.detail-tab').forEach(tab => {{
            tab.addEventListener('click', () => {{
                const tabName = tab.dataset.tab;

                // Update active tab
                document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Show corresponding content
                document.querySelectorAll('.detail-tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById('tab-' + tabName).classList.add('active');
            }});
        }});

        // Close on Escape key
        document.addEventListener('keydown', (e) => {{
            if (e.key === 'Escape') {{
                closeDetail();
            }}
        }});

        // Add click handler to table rows
        document.getElementById('targetsBody').addEventListener('click', (e) => {{
            const row = e.target.closest('tr');
            if (row && row.dataset.id) {{
                // Don't open detail if clicking a link
                if (e.target.tagName === 'A') return;
                openDetail(parseInt(row.dataset.id));
            }}
        }});
    </script>
</body>
</html>'''

    return html


def main():
    print("🔧 Generating enhanced PartnerForge dashboard...")

    # Fetch data
    print("   📥 Fetching data from SQLite...")
    data = fetch_data()
    print(f"   ✅ Loaded {len(data['targets']):,} targets")

    # Generate HTML
    print("   🎨 Generating enhanced HTML...")
    html = generate_html(data)

    # Write file
    with open(OUTPUT_PATH, 'w') as f:
        f.write(html)

    print(f"   💾 Saved to {OUTPUT_PATH}")
    print(f"\n✅ Dashboard generated successfully!")
    print(f"   - Search bar with live filtering")
    print(f"   - Column sorting (click headers)")
    print(f"   - CSV export button")
    print(f"   - Score breakdown tooltips")
    print(f"   - Visual score progress bars")
    print(f"   - FULL-PAGE detail view (click any row):")
    print(f"     • Dark theme (#1a1a2e background)")
    print(f"     • Signal row (Budget/Pain/Timing)")
    print(f"     • Two-column layout (Metrics + Trigger Events)")
    print(f"     • Competitive Advantage card (glassmorphism)")
    print(f"     • Executive Quote section")
    print(f"     • Tabbed sections: Financials | Quotes | Hiring | Tech Stack | Full Intel")


if __name__ == "__main__":
    main()
