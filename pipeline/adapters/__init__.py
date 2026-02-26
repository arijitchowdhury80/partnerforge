"""
API Adapters
============

Adapters for external data sources with built-in:
- Source citation enforcement
- Rate limiting
- Circuit breakers
- Retry logic

Available Adapters:
- BuiltWithAdapter: Technology detection (6 endpoints)
- SimilarWebAdapter: Traffic intelligence (11 endpoints)
- YahooFinanceAdapter: Financial data (5 endpoints)
- SECEdgarAdapter: SEC filings (3 endpoints)
- WebSearchAdapter: Fallback search
"""

from pipeline.adapters.base import BaseAdapter, SourcedResponse
from pipeline.adapters.builtwith import BuiltWithAdapter
from pipeline.adapters.similarweb import SimilarWebAdapter
from pipeline.adapters.yahoo_finance import YahooFinanceAdapter

__all__ = [
    "BaseAdapter",
    "SourcedResponse",
    "BuiltWithAdapter",
    "SimilarWebAdapter",
    "YahooFinanceAdapter",
]
