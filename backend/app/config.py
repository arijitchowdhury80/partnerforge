"""
PartnerForge Configuration

Centralized configuration management with environment variable support.
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
from typing import Optional, Union
import json


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "PartnerForge"
    APP_VERSION: str = "2.1.0"  # Bump for enrichment feature
    DEBUG: bool = False

    # Database
    # Default to SQLite for development (relative to project root)
    DATABASE_URL: str = "sqlite+aiosqlite:///data/partnerforge.db"
    DATABASE_POOL_SIZE: int = 10  # Ignored for SQLite
    DATABASE_MAX_OVERFLOW: int = 20  # Ignored for SQLite

    @property
    def is_sqlite(self) -> bool:
        """Check if using SQLite database."""
        return self.DATABASE_URL.startswith("sqlite")

    @property
    def is_postgres(self) -> bool:
        """Check if using PostgreSQL database."""
        return "postgres" in self.DATABASE_URL.lower()

    # Redis (for Celery)
    REDIS_URL: str = "redis://localhost:6379/0"

    # API Keys
    BUILTWITH_API_KEY: Optional[str] = None
    SIMILARWEB_API_KEY: Optional[str] = None
    YAHOO_FINANCE_API_KEY: Optional[str] = None

    # Rate Limits (requests per minute)
    BUILTWITH_RPM: int = 30
    SIMILARWEB_RPM: int = 60
    YAHOO_FINANCE_RPM: int = 100
    WEBSEARCH_RPM: int = 300

    # Concurrent Limits
    BUILTWITH_CONCURRENT: int = 5
    SIMILARWEB_CONCURRENT: int = 10
    YAHOO_FINANCE_CONCURRENT: int = 10
    WEBSEARCH_CONCURRENT: int = 20

    # Source Freshness (in days) - HARD REQUIREMENTS
    MAX_SOURCE_AGE_DAYS: int = 365  # 12 months - NEVER exceed this
    STOCK_PRICE_MAX_AGE_DAYS: int = 1
    TRAFFIC_MAX_AGE_DAYS: int = 30
    TECH_STACK_MAX_AGE_DAYS: int = 90
    QUARTERLY_FINANCIALS_MAX_AGE_DAYS: int = 120  # 4 months

    # Cache TTL (in seconds)
    CACHE_TTL_COMPANY: int = 604800  # 7 days
    CACHE_TTL_INTEL: int = 86400  # 1 day
    CACHE_TTL_TRAFFIC: int = 86400  # 1 day
    CACHE_TTL_FINANCIALS: int = 3600  # 1 hour

    # Enrichment
    ENRICHMENT_TIMEOUT_SECONDS: int = 300  # 5 minutes max per module
    WAVE_TIMEOUT_SECONDS: int = 600  # 10 minutes max per wave
    MAX_RETRY_ATTEMPTS: int = 3
    RETRY_DELAY_SECONDS: int = 30

    # CORS - Allow all origins for now (can restrict later)
    # Use str type to avoid pydantic-settings JSON parsing issues
    CORS_ORIGINS: str = "*"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, list]) -> str:
        """Parse CORS_ORIGINS from various formats to comma-separated string.

        Accepts:
        - JSON array: '["https://example.com", "https://app.example.com"]'
        - Comma-separated: "https://example.com,https://app.example.com"
        - Single URL: "https://example.com"
        - Wildcard: "*"
        - Empty/None: defaults to "*"
        """
        if v is None or v == "":
            return "*"

        # Already a list (from default or parsed JSON)
        if isinstance(v, list):
            return ",".join(v) if v else "*"

        # Try JSON parsing first
        v_str = str(v).strip()
        if v_str.startswith("["):
            try:
                parsed = json.loads(v_str)
                if isinstance(parsed, list):
                    return ",".join(parsed) if parsed else "*"
            except json.JSONDecodeError:
                pass

        # Return as-is (single URL, comma-separated, or wildcard)
        return v_str if v_str else "*"

    def get_cors_origins_list(self) -> list[str]:
        """Get CORS origins as a list for FastAPI middleware."""
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Module wave configuration
ENRICHMENT_WAVES = {
    "wave_1_foundation": {
        "parallel": True,
        "modules": ["m01_company_context", "m02_tech_stack", "m03_traffic", "m04_financials"],
        "workers": 4,
        "timeout": 60,
        "depends_on": [],
    },
    "wave_2_competitive": {
        "parallel": True,
        "modules": ["m05_competitors", "m06_hiring", "m07_strategic"],
        "workers": 3,
        "timeout": 90,
        "depends_on": ["wave_1_foundation"],
    },
    "wave_3_buying_signals": {
        "parallel": True,
        "modules": ["m08_investor", "m09_executive", "m10_buying_committee", "m11_displacement"],
        "workers": 4,
        "timeout": 120,
        "depends_on": ["wave_2_competitive"],
    },
    "wave_4_synthesis": {
        "parallel": True,
        "modules": ["m12_case_study", "m13_icp_priority", "m14_signal_scoring", "m15_strategic_brief"],
        "workers": 4,
        "timeout": 60,
        "depends_on": ["wave_3_buying_signals"],
    },
}


# ICP Scoring weights
ICP_SCORING = {
    "vertical": {
        "Commerce": 40,
        "Content": 25,
        "Support": 15,
        "Other": 10,
    },
    "traffic": {
        "50M+": 30,
        "10M-50M": 25,
        "1M-10M": 15,
        "100K-1M": 10,
        "<100K": 5,
    },
    "tech_spend": {
        "$100K+": 20,
        "$50K-100K": 15,
        "$25K-50K": 10,
        "<$25K": 5,
    },
    "partner_tech": {
        "Adobe AEM": 10,
        "Adobe Commerce": 10,
        "Shopify Plus": 7,
        "Shopify": 5,
        "Salesforce Commerce": 8,
        "Other": 3,
    },
}


# Signal scoring weights
SIGNAL_WEIGHTS = {
    "hiring_vp_ecommerce": 25,
    "hiring_director_digital": 20,
    "hiring_search_engineer": 30,
    "exec_quote_search": 25,
    "exec_quote_digital": 15,
    "exec_quote_conversion": 20,
    "sec_filing_digital": 15,
    "sec_filing_search": 20,
    "platform_migration": 25,
    "competitor_using_search": 20,
    "margin_pressure": 15,
}
