"""
PartnerForge API Configuration

Configuration settings loaded from environment variables.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / ".env")

# API Keys
BUILTWITH_API_KEY = os.getenv("BUILTWITH_API_KEY", "")
SIMILARWEB_API_KEY = os.getenv("SIMILARWEB_API_KEY", "")

# Database
DATABASE_PATH = PROJECT_ROOT / "data" / "partnerforge.db"

# API Base URLs
BUILTWITH_FREE_API_URL = "https://api.builtwith.com/free1/api.json"
SIMILARWEB_API_BASE = "https://api.similarweb.com/v1/website"

# Enrichment settings
CACHE_TTL_DAYS = 7  # Days before cached data is considered stale

# CORS settings
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
    "https://partnerforge.vercel.app",
    "null",  # For file:// URLs
]

# Allow additional origins via environment variable
extra_origins = os.getenv("CORS_EXTRA_ORIGINS", "")
if extra_origins:
    CORS_ORIGINS.extend([o.strip() for o in extra_origins.split(",") if o.strip()])
