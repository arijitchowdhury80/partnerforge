"""
API Adapters
============

Adapters for external data sources with built-in:
- Source citation enforcement (P0 requirement)
- Rate limiting (token bucket)
- Circuit breakers
- Retry with exponential backoff
- Cost tracking
- Caching with configurable TTL

Available Adapters:
- BuiltWithAdapter: Technology detection (7 endpoints)
  - domain-api, free-api, relationships-api, recommendations-api
  - financial-api, social-api, trust-api, keywords-api

- SimilarWebAdapter: Traffic intelligence (14 endpoints)
  - traffic, engagement, sources, geography, demographics
  - keywords, audience-interests, similar-sites, keywords-competitors
  - website-rank, referrals, popular-pages, leading-folders, landing-pages

- YahooFinanceAdapter: Financial data (7 endpoints)
  - stock-info, financials, recommendations, news
  - holders, earnings, history

References:
- docs/DATA-PIPELINE-FLOWS.md
- docs/SOURCE_CITATION_MANDATE.md
"""

from pipeline.adapters.base import (
    BaseAdapter,
    MockAdapter,
    SourcedResponse,
    CacheEntry,
    EndpointConfig,
    AdapterMetrics,
    AdapterError,
    RateLimitError,
    APIError,
    SourceCitationMissingError,
)

from pipeline.adapters.builtwith import (
    BuiltWithAdapter,
    Technology,
    DomainLookupResponse,
    DomainMeta,
    RelatedDomain,
    RelationshipsResponse,
    TechnologyRecommendation,
    RecommendationsResponse,
    TechnologySpend,
    FinancialResponse,
    SocialProfile,
    SocialResponse,
    TrustSignal,
    TrustResponse,
    TechnologyCategory,
)

from pipeline.adapters.similarweb import (
    SimilarWebAdapter,
    SimilarWebEndpoint,
    TrafficMetrics,
    EngagementMetrics,
    TrafficSourceBreakdown,
    CountryTraffic,
    GeographyData,
    DemographicsData,
    KeywordsData,
    SimilarSitesData,
    WebsiteRank,
    ReferralsData,
)

from pipeline.adapters.yahoo_finance import (
    YahooFinanceAdapter,
    YahooFinanceEndpoint,
    StockInfo,
    FinancialStatement,
    FinancialSummary,
    RecommendationSummary,
    NewsData,
    HoldersData,
    EarningsData,
)

__all__ = [
    # Base adapter
    "BaseAdapter",
    "MockAdapter",
    "SourcedResponse",
    "CacheEntry",
    "EndpointConfig",
    "AdapterMetrics",
    "AdapterError",
    "RateLimitError",
    "APIError",
    "SourceCitationMissingError",
    # BuiltWith adapter
    "BuiltWithAdapter",
    "Technology",
    "TechnologyCategory",
    "DomainLookupResponse",
    "DomainMeta",
    "RelatedDomain",
    "RelationshipsResponse",
    "TechnologyRecommendation",
    "RecommendationsResponse",
    "TechnologySpend",
    "FinancialResponse",
    "SocialProfile",
    "SocialResponse",
    "TrustSignal",
    "TrustResponse",
    # SimilarWeb adapter
    "SimilarWebAdapter",
    "SimilarWebEndpoint",
    "TrafficMetrics",
    "EngagementMetrics",
    "TrafficSourceBreakdown",
    "CountryTraffic",
    "GeographyData",
    "DemographicsData",
    "KeywordsData",
    "SimilarSitesData",
    "WebsiteRank",
    "ReferralsData",
    # Yahoo Finance adapter
    "YahooFinanceAdapter",
    "YahooFinanceEndpoint",
    "StockInfo",
    "FinancialStatement",
    "FinancialSummary",
    "RecommendationSummary",
    "NewsData",
    "HoldersData",
    "EarningsData",
]
