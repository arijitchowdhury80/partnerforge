#!/usr/bin/env python3
"""
PartnerForge: Enhanced Dashboard Generator

Generates an interactive dashboard with:
- Live search/filtering
- Column sorting (click headers)
- CSV export
- Score breakdown tooltips
- Visual score progress bars
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

    # Get displacement targets
    cursor.execute("""
        SELECT
            id, company_name, domain, vertical, country,
            icp_tier, icp_tier_name, lead_score,
            sw_monthly_visits, tech_spend, partner_tech
        FROM displacement_targets
        ORDER BY
            CASE WHEN lead_score IS NULL THEN 1 ELSE 0 END,
            lead_score DESC,
            sw_monthly_visits DESC
    """)
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

    cursor.execute("SELECT COUNT(*) FROM displacement_targets WHERE lead_score >= 80")
    hot = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM displacement_targets WHERE lead_score >= 60 AND lead_score < 80")
    warm = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM displacement_targets WHERE lead_score >= 40 AND lead_score < 60")
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


def generate_html(data):
    """Generate the enhanced dashboard HTML."""

    # Convert targets to JSON for JavaScript
    targets_json = []
    verticals_set = set()
    for t in data["targets"]:
        vertical = t[3] or "—"
        verticals_set.add(vertical)
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
            "partner": t[10] or "Adobe AEM"
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

        /* Modal Overlay */
        .modal-overlay {{
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            z-index: 1000;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }}
        .modal-overlay.active {{
            display: flex;
        }}

        /* Modal Container */
        .modal {{
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 20px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
            max-width: 600px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            animation: modalSlideIn 0.3s ease-out;
        }}
        @keyframes modalSlideIn {{
            from {{
                opacity: 0;
                transform: translateY(-20px) scale(0.95);
            }}
            to {{
                opacity: 1;
                transform: translateY(0) scale(1);
            }}
        }}

        /* Modal Header */
        .modal-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 24px 28px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }}
        .modal-title-group {{
            display: flex;
            align-items: center;
            gap: 16px;
        }}
        .modal-header h2 {{
            font-size: 1.5em;
            font-weight: 700;
            color: #1e293b;
            margin: 0;
        }}
        .modal-header .priority-badge {{
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .modal-header .priority-badge.hot {{
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: white;
        }}
        .modal-header .priority-badge.warm {{
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: white;
        }}
        .modal-header .priority-badge.cool {{
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: white;
        }}
        .modal-close {{
            background: none;
            border: none;
            font-size: 1.5em;
            cursor: pointer;
            color: #64748b;
            padding: 4px 8px;
            border-radius: 8px;
            transition: all 0.2s;
        }}
        .modal-close:hover {{
            background: #f1f5f9;
            color: #1e293b;
        }}

        /* Modal Body */
        .modal-body {{
            padding: 24px 28px;
        }}

        /* Signal Indicators */
        .signal-indicators {{
            display: flex;
            gap: 16px;
            margin-bottom: 24px;
            flex-wrap: wrap;
        }}
        .signal-item {{
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            background: #f8fafc;
            border-radius: 10px;
            font-weight: 500;
        }}
        .signal-item .icon {{
            font-size: 1.2em;
        }}
        .signal-item.positive {{
            background: #dcfce7;
            color: #166534;
        }}
        .signal-item.negative {{
            background: #fef2f2;
            color: #991b1b;
        }}

        /* Glass Card */
        .glass-card {{
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            padding: 20px;
            margin-bottom: 20px;
        }}
        .glass-card h4 {{
            color: #003DFF;
            margin-bottom: 16px;
            font-size: 1em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}

        /* Metrics Grid */
        .metrics-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
        }}
        .metric-item {{
            text-align: center;
        }}
        .metric-item .value {{
            font-size: 1.6em;
            font-weight: 700;
            color: #1e293b;
        }}
        .metric-item .label {{
            font-size: 0.85em;
            color: #64748b;
            margin-top: 4px;
        }}

        /* Score Breakdown Visual */
        .score-breakdown {{
            margin-top: 8px;
        }}
        .score-breakdown-item {{
            display: flex;
            align-items: center;
            margin-bottom: 12px;
        }}
        .score-breakdown-item .category {{
            width: 100px;
            font-weight: 500;
            color: #475569;
            font-size: 0.9em;
        }}
        .score-breakdown-item .bar-container {{
            flex: 1;
            height: 10px;
            background: #e2e8f0;
            border-radius: 5px;
            margin: 0 12px;
            overflow: hidden;
        }}
        .score-breakdown-item .bar-fill {{
            height: 100%;
            border-radius: 5px;
            transition: width 0.5s ease;
        }}
        .score-breakdown-item .bar-fill.tier {{ background: linear-gradient(90deg, #5468FF, #003DFF); }}
        .score-breakdown-item .bar-fill.traffic {{ background: linear-gradient(90deg, #10b981, #059669); }}
        .score-breakdown-item .bar-fill.tech {{ background: linear-gradient(90deg, #f59e0b, #d97706); }}
        .score-breakdown-item .bar-fill.partner {{ background: linear-gradient(90deg, #8b5cf6, #7c3aed); }}
        .score-breakdown-item .points {{
            width: 50px;
            text-align: right;
            font-weight: 600;
            color: #1e293b;
            font-size: 0.9em;
        }}

        /* Domain Link */
        .modal-domain {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            background: #f8fafc;
            border-radius: 12px;
            margin-top: 8px;
        }}
        .modal-domain a {{
            color: #003DFF;
            font-weight: 600;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .modal-domain a:hover {{
            text-decoration: underline;
        }}
        .modal-domain .country {{
            color: #64748b;
            font-size: 0.9em;
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

    <!-- Company Detail Modal -->
    <div class="modal-overlay" id="companyModal">
        <div class="modal">
            <div class="modal-header">
                <div class="modal-title-group">
                    <h2 id="modalCompanyName">Company Name</h2>
                    <span class="priority-badge" id="modalPriorityBadge">HOT</span>
                </div>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <!-- Signal Indicators -->
                <div class="signal-indicators" id="modalSignals">
                    <div class="signal-item" id="signalBudget">
                        <span class="icon">💰</span>
                        <span>Budget</span>
                    </div>
                    <div class="signal-item" id="signalPain">
                        <span class="icon">🎯</span>
                        <span>Pain</span>
                    </div>
                    <div class="signal-item" id="signalTiming">
                        <span class="icon">⏱️</span>
                        <span>Timing</span>
                    </div>
                </div>

                <!-- Key Metrics Card -->
                <div class="glass-card">
                    <h4>Key Metrics</h4>
                    <div class="metrics-grid">
                        <div class="metric-item">
                            <div class="value" id="modalScore">85</div>
                            <div class="label">Lead Score</div>
                        </div>
                        <div class="metric-item">
                            <div class="value" id="modalTraffic">12.5M</div>
                            <div class="label">Monthly Traffic</div>
                        </div>
                        <div class="metric-item">
                            <div class="value" id="modalTechSpend">$75K</div>
                            <div class="label">Tech Spend</div>
                        </div>
                        <div class="metric-item">
                            <div class="value" id="modalTier">Commerce</div>
                            <div class="label">ICP Tier</div>
                        </div>
                    </div>
                </div>

                <!-- Score Breakdown -->
                <div class="glass-card">
                    <h4>Score Breakdown</h4>
                    <div class="score-breakdown" id="modalScoreBreakdown">
                        <div class="score-breakdown-item">
                            <span class="category">ICP Tier</span>
                            <div class="bar-container">
                                <div class="bar-fill tier" id="barTier" style="width: 100%"></div>
                            </div>
                            <span class="points" id="ptsTier">40/40</span>
                        </div>
                        <div class="score-breakdown-item">
                            <span class="category">Traffic</span>
                            <div class="bar-container">
                                <div class="bar-fill traffic" id="barTraffic" style="width: 83%"></div>
                            </div>
                            <span class="points" id="ptsTraffic">25/30</span>
                        </div>
                        <div class="score-breakdown-item">
                            <span class="category">Tech Spend</span>
                            <div class="bar-container">
                                <div class="bar-fill tech" id="barTech" style="width: 75%"></div>
                            </div>
                            <span class="points" id="ptsTech">15/20</span>
                        </div>
                        <div class="score-breakdown-item">
                            <span class="category">Partner</span>
                            <div class="bar-container">
                                <div class="bar-fill partner" id="barPartner" style="width: 100%"></div>
                            </div>
                            <span class="points" id="ptsPartner">10/10</span>
                        </div>
                    </div>
                </div>

                <!-- Domain & Country -->
                <div class="modal-domain">
                    <a id="modalDomainLink" href="#" target="_blank">
                        🔗 <span id="modalDomain">example.com</span>
                    </a>
                    <span class="country" id="modalCountry">🌍 United States</span>
                </div>
            </div>
        </div>
    </div>

    <script>
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

        // ===== COMPANY DETAIL MODAL =====
        function openModal(targetId) {{
            const target = allTargets.find(t => t.id === targetId);
            if (!target) return;

            // Calculate score breakdown
            const tierPts = target.tier === 1 ? 40 : target.tier === 2 ? 25 : target.tier === 3 ? 15 : 0;
            const trafficPts = target.traffic >= 50000000 ? 30 : target.traffic >= 10000000 ? 25 : target.traffic >= 5000000 ? 20 : target.traffic >= 1000000 ? 15 : target.traffic >= 500000 ? 10 : target.traffic >= 100000 ? 5 : 0;
            const techPts = target.techSpend >= 100000 ? 20 : target.techSpend >= 50000 ? 15 : target.techSpend >= 25000 ? 10 : target.techSpend >= 10000 ? 5 : 0;
            const partnerPts = target.partner.includes('Adobe') ? 10 : target.partner.includes('Shopify') ? 7 : 3;

            // Determine priority
            const priority = target.score >= 80 ? 'hot' : target.score >= 60 ? 'warm' : 'cool';
            const priorityLabel = priority.toUpperCase();

            // Update modal header
            document.getElementById('modalCompanyName').textContent = target.company;
            const badge = document.getElementById('modalPriorityBadge');
            badge.textContent = priorityLabel;
            badge.className = 'priority-badge ' + priority;

            // Update signal indicators (based on score components)
            const signalBudget = document.getElementById('signalBudget');
            const signalPain = document.getElementById('signalPain');
            const signalTiming = document.getElementById('signalTiming');

            // Budget signal: based on tech spend
            signalBudget.className = 'signal-item ' + (techPts >= 10 ? 'positive' : 'negative');
            signalBudget.innerHTML = '<span class="icon">' + (techPts >= 10 ? '✅' : '❌') + '</span><span>Budget</span>';

            // Pain signal: based on tier (commerce = most pain)
            signalPain.className = 'signal-item ' + (target.tier === 1 ? 'positive' : 'negative');
            signalPain.innerHTML = '<span class="icon">' + (target.tier === 1 ? '✅' : '❌') + '</span><span>Pain</span>';

            // Timing signal: based on traffic (high traffic = urgent need)
            signalTiming.className = 'signal-item ' + (trafficPts >= 15 ? 'positive' : 'negative');
            signalTiming.innerHTML = '<span class="icon">' + (trafficPts >= 15 ? '✅' : '❌') + '</span><span>Timing</span>';

            // Update key metrics
            document.getElementById('modalScore').textContent = target.score;
            document.getElementById('modalTraffic').textContent = target.trafficFmt;
            document.getElementById('modalTechSpend').textContent = target.techSpend >= 1000 ? '$' + Math.round(target.techSpend/1000) + 'K' : '$' + target.techSpend;
            document.getElementById('modalTier').textContent = target.tierName;

            // Update score breakdown bars
            document.getElementById('barTier').style.width = (tierPts / 40 * 100) + '%';
            document.getElementById('ptsTier').textContent = tierPts + '/40';

            document.getElementById('barTraffic').style.width = (trafficPts / 30 * 100) + '%';
            document.getElementById('ptsTraffic').textContent = trafficPts + '/30';

            document.getElementById('barTech').style.width = (techPts / 20 * 100) + '%';
            document.getElementById('ptsTech').textContent = techPts + '/20';

            document.getElementById('barPartner').style.width = (partnerPts / 10 * 100) + '%';
            document.getElementById('ptsPartner').textContent = partnerPts + '/10';

            // Update domain & country
            document.getElementById('modalDomain').textContent = target.domain;
            document.getElementById('modalDomainLink').href = 'https://' + target.domain;
            document.getElementById('modalCountry').textContent = '🌍 ' + target.country;

            // Show modal
            document.getElementById('companyModal').classList.add('active');
            document.body.style.overflow = 'hidden';
        }}

        function closeModal() {{
            document.getElementById('companyModal').classList.remove('active');
            document.body.style.overflow = '';
        }}

        // Close modal on overlay click
        document.getElementById('companyModal').addEventListener('click', (e) => {{
            if (e.target.classList.contains('modal-overlay')) {{
                closeModal();
            }}
        }});

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {{
            if (e.key === 'Escape') {{
                closeModal();
            }}
        }});

        // Add click handler to table rows
        document.getElementById('targetsBody').addEventListener('click', (e) => {{
            const row = e.target.closest('tr');
            if (row && row.dataset.id) {{
                // Don't open modal if clicking a link
                if (e.target.tagName === 'A') return;
                openModal(parseInt(row.dataset.id));
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
    print(f"   - Company detail modal (click any row)")
    print(f"   - Glassmorphism UI with signal indicators")


if __name__ == "__main__":
    main()
