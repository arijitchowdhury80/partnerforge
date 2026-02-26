"""
PartnerForge Data Pipeline
==========================

Enterprise-grade enrichment pipeline for ABM intelligence gathering.

Modules:
- utils: Retry, circuit breaker, rate limiting utilities
- adapters: API adapters for BuiltWith, SimilarWeb, Yahoo Finance, etc.
- modules: Intelligence modules (M01-M15)
- validators: Pydantic validation schemas
- models: Data models with mandatory source citation

Architecture:
- 4-Wave parallel execution
- Source citation mandate enforced at all layers
- Circuit breakers prevent cascade failures
- Redis-backed global rate limiting

Version: 1.0.0
Date: 2026-02-25
"""

from pipeline.models.source import SourceCitation, SourcedDataPoint

# Optional imports for modules that may not exist yet
try:
    from pipeline.orchestrator import EnrichmentOrchestrator
except ImportError:
    EnrichmentOrchestrator = None

try:
    from pipeline.aggregator import ResultAggregator
except ImportError:
    ResultAggregator = None

__version__ = "1.0.0"
__all__ = [
    "SourceCitation",
    "SourcedDataPoint",
]

# Add optional exports if they exist
if EnrichmentOrchestrator is not None:
    __all__.append("EnrichmentOrchestrator")
if ResultAggregator is not None:
    __all__.append("ResultAggregator")
