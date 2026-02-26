"""
Unit Tests for CSV Upload Services
===================================

Comprehensive tests for the CSV upload pipeline:
1. CSVParserService - Parsing, encoding, delimiter detection
2. ColumnMappingService - Auto-detection, source system identification
3. CSVValidationService - Domain validation, duplicate detection
4. ListEnrichmentService - Queue management, progress tracking

Run:
    pytest tests/unit/services/test_csv_services.py -v
    pytest tests/unit/services/test_csv_services.py -v -k "test_parser"
    pytest tests/unit/services/test_csv_services.py -v -k "test_mapping"
    pytest tests/unit/services/test_csv_services.py -v -k "test_validation"
    pytest tests/unit/services/test_csv_services.py -v -k "test_enrichment"
"""

import pytest
from datetime import datetime, timedelta
from typing import Dict, List, Any
import io

from backend.app.services.csv_parser import (
    CSVParserService,
    CSVParseError,
    FileTooLargeError,
    TooManyRowsError,
    InvalidCSVError,
    ParseResult,
    ParsedRow,
)
from backend.app.services.column_mapping import (
    ColumnMappingService,
    SourceSystem,
    MappingConfidence,
    MappingResult,
    COLUMN_MAPPINGS,
)
from backend.app.services.csv_validation import (
    CSVValidationService,
    ValidationErrorType,
    ValidationStatus,
    ValidationReport,
    RowValidationResult,
)
from backend.app.services.list_enrichment import (
    ListEnrichmentService,
    EnrichmentPriority,
    EnrichmentStatus,
    EnrichmentModule,
    EnrichmentJob,
    DEFAULT_MODULES,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def parser():
    """Create a CSVParserService instance."""
    return CSVParserService()


@pytest.fixture
def mapping_service():
    """Create a ColumnMappingService instance."""
    return ColumnMappingService()


@pytest.fixture
def validation_service():
    """Create a CSVValidationService instance."""
    return CSVValidationService()


@pytest.fixture
def enrichment_service():
    """Create a ListEnrichmentService instance."""
    return ListEnrichmentService()


@pytest.fixture
def simple_csv_bytes() -> bytes:
    """Simple UTF-8 CSV content."""
    content = """Domain,Company Name,Revenue,Industry
costco.com,Costco Wholesale,254000000000,Retail
walmart.com,Walmart Inc,611000000000,Retail
target.com,Target Corporation,109000000000,Retail"""
    return content.encode("utf-8")


@pytest.fixture
def salesforce_csv_bytes() -> bytes:
    """Salesforce export format CSV."""
    content = """Account Name,18 Digit Account ID,Domain,Annual Revenue,Sales Region,Account Owner
Costco Wholesale,001ABC123456789XYZ,costco.com,254000000000,West,John Smith
Walmart Inc,001DEF456789012ABC,walmart.com,611000000000,Central,Jane Doe
Target Corporation,001GHI789012345DEF,target.com,109000000000,Central,Bob Wilson"""
    return content.encode("utf-8")


@pytest.fixture
def demandbase_csv_bytes() -> bytes:
    """Demandbase export format CSV."""
    content = """Account Name,Domain,ABM ID,Journey Stage,Engagement Points,Demandbase Industry,Algolia_Technology
Costco Wholesale,costco.com,DB123456,Engagement,850,Retail,True
Walmart Inc,walmart.com,DB789012,Awareness,450,Retail,False
Target Corporation,target.com,DB345678,Decision,1200,Retail,True"""
    return content.encode("utf-8")


@pytest.fixture
def semicolon_csv_bytes() -> bytes:
    """CSV with semicolon delimiter (European format)."""
    content = """Domain;Company;Revenue
costco.com;Costco;254000000000
walmart.com;Walmart;611000000000"""
    return content.encode("utf-8")


@pytest.fixture
def latin1_csv_bytes() -> bytes:
    """CSV with Latin-1 encoding (ISO-8859-1)."""
    content = "Domain,Company\ncostco.com,Costco\nmueller.de,M\xfcller GmbH"
    return content.encode("latin-1")


@pytest.fixture
def parsed_rows_for_validation() -> List[Dict[str, Any]]:
    """Sample parsed rows for validation testing."""
    return [
        {"row_number": 1, "domain": "costco.com", "company_name": "Costco"},
        {"row_number": 2, "domain": "walmart.com", "company_name": "Walmart"},
        {"row_number": 3, "domain": "target.com", "company_name": "Target"},
        {"row_number": 4, "domain": "invalid", "company_name": "Invalid Co"},
        {"row_number": 5, "domain": "costco.com", "company_name": "Duplicate Costco"},  # Duplicate
        {"row_number": 6, "domain": "", "company_name": "No Domain"},  # Empty
        {"row_number": 7, "domain": "https://www.example.org/path", "company_name": "URL Format"},
    ]


# ============================================================================
# CSVParserService Tests
# ============================================================================

class TestCSVParserServiceBasics:
    """Test basic CSV parsing functionality."""

    @pytest.mark.asyncio
    async def test_parse_simple_csv(self, parser, simple_csv_bytes):
        """Parse a simple UTF-8 CSV file."""
        result = await parser.parse_file(simple_csv_bytes, filename="test.csv")

        assert result.success is True
        assert result.total_rows == 3
        assert result.parsed_rows == 3
        assert result.error_rows == 0
        assert result.encoding == "utf-8"
        assert result.delimiter == ","
        assert len(result.headers) == 4
        assert "Domain" in result.headers
        assert "Company Name" in result.headers

    @pytest.mark.asyncio
    async def test_parse_extracts_data_correctly(self, parser, simple_csv_bytes):
        """Parsed rows contain correct data."""
        result = await parser.parse_file(simple_csv_bytes)

        assert len(result.rows) == 3
        first_row = result.rows[0]
        assert first_row.data["Domain"] == "costco.com"
        assert first_row.data["Company Name"] == "Costco Wholesale"
        assert first_row.data["Revenue"] == "254000000000"
        assert first_row.row_number == 2  # Header is row 1

    @pytest.mark.asyncio
    async def test_parse_computes_file_hash(self, parser, simple_csv_bytes):
        """File hash is computed for deduplication."""
        result = await parser.parse_file(simple_csv_bytes)

        assert result.file_hash is not None
        assert len(result.file_hash) == 64  # SHA-256 hex length

        # Same content should produce same hash
        result2 = await parser.parse_file(simple_csv_bytes)
        assert result.file_hash == result2.file_hash

    @pytest.mark.asyncio
    async def test_parse_returns_file_size(self, parser, simple_csv_bytes):
        """File size is tracked."""
        result = await parser.parse_file(simple_csv_bytes)

        assert result.file_size_bytes == len(simple_csv_bytes)


class TestCSVParserEncodingDetection:
    """Test encoding detection functionality."""

    @pytest.mark.asyncio
    async def test_detect_utf8(self, parser, simple_csv_bytes):
        """Detect UTF-8 encoding."""
        result = await parser.parse_file(simple_csv_bytes)
        assert result.encoding == "utf-8"

    @pytest.mark.asyncio
    async def test_detect_latin1(self, parser, latin1_csv_bytes):
        """Detect and handle Latin-1 encoding."""
        result = await parser.parse_file(latin1_csv_bytes)

        assert result.success is True
        # Check the special character was preserved
        muller_row = next(
            (r for r in result.rows if "mueller.de" in r.data.get("Domain", "")),
            None
        )
        assert muller_row is not None

    @pytest.mark.asyncio
    async def test_detect_utf8_bom(self, parser):
        """Detect UTF-8 with BOM."""
        content = b'\xef\xbb\xbfDomain,Company\ncostco.com,Costco'
        result = await parser.parse_file(content)

        assert result.success is True
        assert result.encoding == "utf-8-sig"
        # BOM should be stripped from header
        assert "Domain" in result.headers

    @pytest.mark.asyncio
    async def test_force_encoding(self, parser, simple_csv_bytes):
        """Allow forcing a specific encoding."""
        result = await parser.parse_file(
            simple_csv_bytes,
            encoding="utf-8"
        )

        assert result.success is True
        assert result.encoding == "utf-8"


class TestCSVParserDelimiterDetection:
    """Test delimiter detection functionality."""

    @pytest.mark.asyncio
    async def test_detect_comma(self, parser, simple_csv_bytes):
        """Detect comma delimiter."""
        result = await parser.parse_file(simple_csv_bytes)
        assert result.delimiter == ","

    @pytest.mark.asyncio
    async def test_detect_semicolon(self, parser, semicolon_csv_bytes):
        """Detect semicolon delimiter (European format)."""
        result = await parser.parse_file(semicolon_csv_bytes)

        assert result.success is True
        assert result.delimiter == ";"
        assert len(result.rows) == 2

    @pytest.mark.asyncio
    async def test_detect_tab(self, parser):
        """Detect tab delimiter."""
        content = b"Domain\tCompany\tRevenue\ncostco.com\tCostco\t254B"
        result = await parser.parse_file(content)

        assert result.success is True
        assert result.delimiter == "\t"

    @pytest.mark.asyncio
    async def test_force_delimiter(self, parser, semicolon_csv_bytes):
        """Allow forcing a specific delimiter."""
        result = await parser.parse_file(
            semicolon_csv_bytes,
            delimiter=";"
        )

        assert result.success is True
        assert result.delimiter == ";"


class TestCSVParserErrorHandling:
    """Test error handling and edge cases."""

    @pytest.mark.asyncio
    async def test_empty_file(self, parser):
        """Handle empty file."""
        result = await parser.parse_file(b"")

        assert result.success is False
        assert "empty" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_header_only_file(self, parser):
        """Handle file with only headers."""
        content = b"Domain,Company,Revenue"
        result = await parser.parse_file(content)

        assert result.success is True
        assert result.total_rows == 0
        assert len(result.headers) == 3

    @pytest.mark.asyncio
    async def test_file_too_large(self):
        """Reject files exceeding size limit."""
        parser = CSVParserService(max_file_size_mb=1)  # 1MB limit
        large_content = b"Domain,Company\n" + b"x" * (2 * 1024 * 1024)  # 2MB

        result = await parser.parse_file(large_content)

        assert result.success is False
        assert "size" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_too_many_rows(self):
        """Handle row limit."""
        parser = CSVParserService(max_rows=5)
        rows = "\n".join([f"domain{i}.com,Company{i}" for i in range(20)])
        content = f"Domain,Company\n{rows}".encode()

        result = await parser.parse_file(content)

        assert result.success is True
        assert len(result.rows) == 5  # Truncated
        assert len(result.warnings) > 0
        assert "truncated" in result.warnings[0].lower()

    @pytest.mark.asyncio
    async def test_inconsistent_columns(self, parser):
        """Handle rows with different column counts."""
        content = b"Domain,Company,Revenue\ncostco.com,Costco\nwalmart.com,Walmart,611B,Extra"

        result = await parser.parse_file(content)

        assert result.success is True
        # Both rows should be parseable with warnings
        assert len(result.rows) == 2

    @pytest.mark.asyncio
    async def test_duplicate_headers(self, parser):
        """Handle duplicate column headers."""
        content = b"Domain,Company,Domain,Revenue\ncostco.com,Costco,costco.com,254B"

        result = await parser.parse_file(content)

        assert result.success is True
        assert len(result.warnings) > 0
        # Duplicate header should be renamed
        assert any("duplicate" in w.lower() for w in result.warnings)


class TestCSVParserHelperMethods:
    """Test helper methods."""

    @pytest.mark.asyncio
    async def test_get_sample_rows(self, parser, simple_csv_bytes):
        """Get sample rows for preview."""
        result = await parser.parse_file(simple_csv_bytes)
        samples = parser.get_sample_rows(result, count=2)

        assert len(samples) == 2
        assert samples[0]["Domain"] == "costco.com"

    @pytest.mark.asyncio
    async def test_get_column_stats(self, parser, simple_csv_bytes):
        """Get column statistics."""
        result = await parser.parse_file(simple_csv_bytes)
        stats = parser.get_column_stats(result)

        assert "Domain" in stats
        assert stats["Domain"]["non_empty_count"] == 3
        assert stats["Domain"]["fill_rate"] == 1.0
        assert len(stats["Domain"]["sample_values"]) <= 3


# ============================================================================
# ColumnMappingService Tests
# ============================================================================

class TestColumnMappingServiceDetection:
    """Test column mapping detection."""

    def test_detect_domain_column(self, mapping_service):
        """Detect domain column from various names."""
        test_cases = [
            (["Domain", "Company"], "Domain"),
            (["Website", "Name"], "Website"),
            (["company_website", "name"], "company_website"),
            (["URL", "Business"], "URL"),
        ]

        for headers, expected in test_cases:
            result = mapping_service.detect_mappings(headers)
            assert result.has_domain_column, f"Failed for headers: {headers}"
            assert result.mappings["domain"] == expected

    def test_detect_salesforce_columns(self, mapping_service):
        """Detect Salesforce-specific columns."""
        headers = [
            "Account Name", "18 Digit Account ID", "Domain",
            "Annual Revenue", "Sales Region", "Account Owner"
        ]

        result = mapping_service.detect_mappings(headers)

        assert result.has_domain_column
        assert result.detected_source == SourceSystem.SALESFORCE
        assert "salesforce_id" in result.mappings
        assert result.mappings["salesforce_id"] == "18 Digit Account ID"

    def test_detect_demandbase_columns(self, mapping_service):
        """Detect Demandbase-specific columns."""
        headers = [
            "Account Name", "Domain", "ABM ID",
            "Journey Stage", "Engagement Points", "Demandbase Industry"
        ]

        result = mapping_service.detect_mappings(headers)

        assert result.has_domain_column
        assert result.detected_source == SourceSystem.DEMANDBASE
        assert "demandbase_id" in result.mappings
        assert "journey_stage" in result.mappings
        assert "engagement_score" in result.mappings

    def test_detect_hubspot_columns(self, mapping_service):
        """Detect HubSpot-specific columns."""
        headers = [
            "Company Name", "Website", "HubSpot ID",
            "Industry", "Annual Revenue"
        ]

        result = mapping_service.detect_mappings(headers)

        assert result.has_domain_column
        assert result.detected_source == SourceSystem.HUBSPOT
        assert "hubspot_id" in result.mappings

    def test_missing_domain_column(self, mapping_service):
        """Handle missing domain column."""
        headers = ["Company Name", "Revenue", "Industry"]

        result = mapping_service.detect_mappings(headers)

        assert result.has_domain_column is False
        assert len(result.warnings) > 0
        assert any("domain" in w.lower() for w in result.warnings)


class TestColumnMappingServiceConfidence:
    """Test mapping confidence calculation."""

    def test_high_confidence_exact_match(self, mapping_service):
        """Exact column name matches get high confidence."""
        headers = ["domain", "company_name", "revenue", "industry"]

        result = mapping_service.detect_mappings(headers)

        assert result.overall_confidence == MappingConfidence.HIGH

    def test_medium_confidence_partial_match(self, mapping_service):
        """Partial matches get medium confidence."""
        headers = ["Domain", "Company Display Name", "Est Revenue"]

        result = mapping_service.detect_mappings(headers)

        # Has domain (required) but some fuzzy matches
        assert result.has_domain_column

    def test_unmapped_columns_tracked(self, mapping_service):
        """Unmapped columns are tracked."""
        headers = ["Domain", "Company", "Custom Field 1", "Custom Field 2"]

        result = mapping_service.detect_mappings(headers)

        assert "Custom Field 1" in result.unmapped_columns
        assert "Custom Field 2" in result.unmapped_columns


class TestColumnMappingServiceManualOverride:
    """Test manual mapping updates."""

    def test_update_mapping(self, mapping_service):
        """Update a mapping manually."""
        headers = ["Website URL", "Business Name", "Revenue"]
        initial_result = mapping_service.detect_mappings(headers)

        # Manually correct the domain mapping
        updated_result = mapping_service.update_mapping(
            initial_result,
            field="domain",
            csv_column="Website URL"
        )

        assert updated_result.has_domain_column
        assert updated_result.mappings["domain"] == "Website URL"

    def test_validate_mapping(self, mapping_service):
        """Validate a mapping configuration."""
        headers = ["Domain", "Company", "Revenue"]

        # Valid mapping
        is_valid, errors = mapping_service.validate_mapping(
            {"domain": "Domain", "company_name": "Company"},
            headers
        )
        assert is_valid is True
        assert len(errors) == 0

        # Invalid - domain column doesn't exist
        is_valid, errors = mapping_service.validate_mapping(
            {"domain": "Website"},  # "Website" not in headers
            headers
        )
        assert is_valid is False
        assert len(errors) > 0


# ============================================================================
# CSVValidationService Tests
# ============================================================================

class TestCSVValidationServiceDomainValidation:
    """Test domain validation."""

    def test_validate_simple_domain(self, validation_service):
        """Validate simple domain."""
        is_valid, normalized, errors = validation_service.validate_domain("costco.com")

        assert is_valid is True
        assert normalized == "costco.com"
        assert len(errors) == 0

    def test_validate_www_domain(self, validation_service):
        """Strip www prefix."""
        is_valid, normalized, errors = validation_service.validate_domain("www.costco.com")

        assert is_valid is True
        assert normalized == "costco.com"

    def test_validate_full_url(self, validation_service):
        """Extract domain from full URL."""
        test_cases = [
            ("https://www.costco.com", "costco.com"),
            ("https://www.costco.com/electronics", "costco.com"),
            ("http://costco.com/path?query=1", "costco.com"),
            ("https://shop.costco.com", "shop.costco.com"),
        ]

        for url, expected in test_cases:
            is_valid, normalized, errors = validation_service.validate_domain(url)
            assert is_valid is True, f"Failed for URL: {url}"
            assert normalized == expected, f"Expected {expected}, got {normalized}"

    def test_validate_empty_domain(self, validation_service):
        """Reject empty domain."""
        test_cases = ["", "   ", None]

        for value in test_cases:
            is_valid, normalized, errors = validation_service.validate_domain(value)
            assert is_valid is False
            assert len(errors) > 0

    def test_validate_invalid_domain(self, validation_service):
        """Reject invalid domain formats."""
        test_cases = [
            "invalid",
            "no-tld",
            "just words here",
            "@#$%.com",
            "-invalid.com",
        ]

        for value in test_cases:
            is_valid, normalized, errors = validation_service.validate_domain(value)
            assert is_valid is False, f"Should reject: {value}"

    def test_blocked_test_domains(self, validation_service):
        """Reject common test/placeholder domains."""
        blocked = ["example.com", "test.com", "localhost", "your-domain.com"]

        for domain in blocked:
            is_valid, normalized, errors = validation_service.validate_domain(domain)
            assert is_valid is False, f"Should block: {domain}"

    def test_allow_blocked_domains_flag(self):
        """Allow blocked domains when flag is set."""
        service = CSVValidationService(allow_blocked_domains=True)

        is_valid, normalized, errors = service.validate_domain("example.com")

        assert is_valid is True


class TestCSVValidationServiceListValidation:
    """Test bulk list validation."""

    @pytest.mark.asyncio
    async def test_validate_list_basic(
        self, validation_service, parsed_rows_for_validation
    ):
        """Validate a list of rows."""
        report = await validation_service.validate_list(
            list_id="test-list-123",
            rows=parsed_rows_for_validation,
            domain_column="domain",
        )

        assert report.list_id == "test-list-123"
        assert report.total_rows == 7

    @pytest.mark.asyncio
    async def test_detect_duplicates_in_list(
        self, validation_service, parsed_rows_for_validation
    ):
        """Detect duplicate domains within the list."""
        report = await validation_service.validate_list(
            list_id="test-list",
            rows=parsed_rows_for_validation,
            domain_column="domain",
        )

        # Row 5 is a duplicate of row 1 (both costco.com)
        assert report.duplicate_rows >= 1

        duplicate_results = validation_service.get_duplicate_rows(report)
        assert len(duplicate_results) >= 1
        assert any(r.domain == "costco.com" for r in duplicate_results)

    @pytest.mark.asyncio
    async def test_detect_existing_domains(
        self, validation_service, parsed_rows_for_validation
    ):
        """Detect domains already in the system."""
        existing_domains = {"walmart.com": 42}

        report = await validation_service.validate_list(
            list_id="test-list",
            rows=parsed_rows_for_validation,
            domain_column="domain",
            existing_domains=existing_domains,
        )

        assert report.existing_rows >= 1

        # Find the walmart.com result
        walmart_result = next(
            (r for r in report.row_results if r.normalized_domain == "walmart.com"),
            None
        )
        assert walmart_result is not None
        assert walmart_result.status == ValidationStatus.EXISTING
        assert walmart_result.existing_target_id == 42

    @pytest.mark.asyncio
    async def test_validation_report_summary(
        self, validation_service, parsed_rows_for_validation
    ):
        """Validation report includes summary statistics."""
        report = await validation_service.validate_list(
            list_id="test-list",
            rows=parsed_rows_for_validation,
            domain_column="domain",
        )

        assert "unique_domains" in report.summary
        assert "ready_for_enrichment" in report.summary
        assert report.validation_completed_at is not None

    @pytest.mark.asyncio
    async def test_get_valid_rows(
        self, validation_service, parsed_rows_for_validation
    ):
        """Filter to get only valid rows."""
        report = await validation_service.validate_list(
            list_id="test-list",
            rows=parsed_rows_for_validation,
            domain_column="domain",
        )

        valid_rows = validation_service.get_valid_rows(report)

        # Should include valid and existing, but not invalid or duplicate
        for row in valid_rows:
            assert row.status in (ValidationStatus.VALID, ValidationStatus.EXISTING)


# ============================================================================
# ListEnrichmentService Tests
# ============================================================================

class TestListEnrichmentServiceJobManagement:
    """Test enrichment job management."""

    @pytest.mark.asyncio
    async def test_start_enrichment_creates_job(self, enrichment_service):
        """Starting enrichment creates a job."""
        valid_items = [
            {"domain": "costco.com", "company_name": "Costco"},
            {"domain": "walmart.com", "company_name": "Walmart"},
        ]

        job = await enrichment_service.start_enrichment(
            list_id="test-list-123",
            valid_items=valid_items,
        )

        assert job.id is not None
        assert job.list_id == "test-list-123"
        assert job.total_items == 2
        assert job.status == EnrichmentStatus.QUEUED

    @pytest.mark.asyncio
    async def test_enrichment_priority_levels(self, enrichment_service):
        """Different priority levels are supported."""
        valid_items = [{"domain": "test.org", "company_name": "Test"}]

        for priority in EnrichmentPriority:
            job = await enrichment_service.start_enrichment(
                list_id=f"test-{priority.value}",
                valid_items=valid_items,
                priority=priority,
            )

            assert job.priority == priority

    @pytest.mark.asyncio
    async def test_get_job(self, enrichment_service):
        """Retrieve job by ID."""
        valid_items = [{"domain": "test.com"}]
        job = await enrichment_service.start_enrichment(
            list_id="test-list",
            valid_items=valid_items,
        )

        retrieved = await enrichment_service.get_job(job.id)

        assert retrieved is not None
        assert retrieved.id == job.id

    @pytest.mark.asyncio
    async def test_cancel_job(self, enrichment_service):
        """Cancel an enrichment job."""
        valid_items = [{"domain": "test.com"}]
        job = await enrichment_service.start_enrichment(
            list_id="test-list",
            valid_items=valid_items,
        )

        result = await enrichment_service.cancel_job(job.id)

        assert result is True
        updated_job = await enrichment_service.get_job(job.id)
        assert updated_job.status == EnrichmentStatus.CANCELLED


class TestListEnrichmentServiceProgress:
    """Test progress tracking."""

    @pytest.mark.asyncio
    async def test_get_progress(self, enrichment_service):
        """Get job progress."""
        valid_items = [
            {"domain": "costco.com"},
            {"domain": "walmart.com"},
        ]
        job = await enrichment_service.start_enrichment(
            list_id="test-list",
            valid_items=valid_items,
        )

        progress = await enrichment_service.get_progress(job.id)

        assert progress is not None
        assert progress.job_id == job.id
        assert progress.total_items == 2
        assert progress.progress_percent == 0.0

    @pytest.mark.asyncio
    async def test_update_item_status(self, enrichment_service):
        """Update individual item status."""
        valid_items = [{"domain": "costco.com"}]
        job = await enrichment_service.start_enrichment(
            list_id="test-list",
            valid_items=valid_items,
        )

        # Get item ID
        items = enrichment_service._items.get(job.id, [])
        assert len(items) > 0
        item = items[0]

        # Simulate enrichment
        await enrichment_service.update_item_status(
            job_id=job.id,
            item_id=item.id,
            status=EnrichmentStatus.ENRICHING,
        )

        # Verify job status updated
        updated_job = await enrichment_service.get_job(job.id)
        assert updated_job.status == EnrichmentStatus.PROCESSING

        # Complete the item
        await enrichment_service.update_item_status(
            job_id=job.id,
            item_id=item.id,
            status=EnrichmentStatus.COMPLETED,
            result={"icp_score": 85},
        )

        updated_job = await enrichment_service.get_job(job.id)
        assert updated_job.success_count == 1
        assert updated_job.status == EnrichmentStatus.COMPLETED


class TestListEnrichmentServicePreExistingData:
    """Test pre-existing data extraction and merging."""

    @pytest.mark.asyncio
    async def test_extract_pre_existing_from_csv(self, enrichment_service):
        """Extract pre-existing data from CSV fields."""
        row_data = {
            "domain": "costco.com",
            "revenue": "254000000000",
            "traffic": "150000000",
            "industry": "Retail",
            "employees": "300000",
            "engagement_score": "850",
            "Algolia_Technology": "True",
        }

        pre_existing = enrichment_service._extract_pre_existing_from_csv(row_data)

        assert "revenue" in pre_existing
        assert pre_existing["revenue"]["value"] == 254000000000.0

        assert "traffic" in pre_existing
        assert pre_existing["traffic"]["value"] == 150000000.0

        assert "industry" in pre_existing
        assert pre_existing["industry"]["value"] == "Retail"

        assert "employee_count" in pre_existing
        assert pre_existing["employee_count"]["value"] == 300000

        assert "tech_stack_hints" in pre_existing
        assert pre_existing["tech_stack_hints"]["value"]["Algolia"] is True

    @pytest.mark.asyncio
    async def test_parse_revenue_formats(self, enrichment_service):
        """Parse various revenue formats."""
        test_cases = [
            ("254000000000", 254000000000.0),
            ("$254,000,000,000", 254000000000.0),
            ("254B", 254000000000.0),
            ("254M", 254000000.0),
            ("254K", 254000.0),
            ("invalid", None),
        ]

        for value, expected in test_cases:
            result = enrichment_service._parse_numeric(value)
            assert result == expected, f"Failed for {value}"

    @pytest.mark.asyncio
    async def test_merge_enrichment_with_csv(self, enrichment_service):
        """Merge enrichment results with CSV data."""
        enrichment_result = {
            "icp_score": 85,
            "traffic": 160000000,  # API value
            "tech_stack": ["Algolia", "React"],
        }

        pre_existing = {
            "revenue": {"value": 254000000000, "source": "csv_import"},
            "industry": {"value": "Retail", "source": "csv_import"},
        }

        merged = await enrichment_service.merge_enrichment_with_csv(
            enrichment_result,
            pre_existing,
        )

        # Enrichment data preserved
        assert merged["icp_score"] == 85
        assert merged["traffic"] == 160000000

        # CSV data fills gaps
        assert merged["revenue"] == 254000000000
        assert merged["revenue_source"] == "csv_import"
        assert merged["industry"] == "Retail"


class TestListEnrichmentServiceModules:
    """Test enrichment module configuration."""

    @pytest.mark.asyncio
    async def test_default_modules(self, enrichment_service):
        """Default modules are applied."""
        valid_items = [{"domain": "test.com"}]

        job = await enrichment_service.start_enrichment(
            list_id="test-list",
            valid_items=valid_items,
        )

        assert job.modules == DEFAULT_MODULES
        assert EnrichmentModule.COMPANY_CONTEXT in job.modules
        assert EnrichmentModule.ICP_SCORING in job.modules

    @pytest.mark.asyncio
    async def test_custom_modules(self, enrichment_service):
        """Custom module selection."""
        valid_items = [{"domain": "test.com"}]
        custom_modules = [
            EnrichmentModule.COMPANY_CONTEXT,
            EnrichmentModule.FINANCIAL_DATA,
        ]

        job = await enrichment_service.start_enrichment(
            list_id="test-list",
            valid_items=valid_items,
            modules=custom_modules,
        )

        assert job.modules == custom_modules


class TestListEnrichmentServiceStats:
    """Test service statistics."""

    @pytest.mark.asyncio
    async def test_get_stats(self, enrichment_service):
        """Get service statistics."""
        # Create some jobs
        await enrichment_service.start_enrichment(
            list_id="list-1",
            valid_items=[{"domain": "a.com"}],
        )
        await enrichment_service.start_enrichment(
            list_id="list-2",
            valid_items=[{"domain": "b.com"}, {"domain": "c.com"}],
        )

        stats = enrichment_service.get_stats()

        assert stats["total_jobs"] == 2
        assert stats["active_jobs"] == 2
        assert stats["total_items_queued"] == 3


# ============================================================================
# Integration Tests (Services Working Together)
# ============================================================================

class TestCSVUploadPipelineIntegration:
    """Test the full CSV upload pipeline."""

    @pytest.mark.asyncio
    async def test_full_pipeline_salesforce_csv(
        self,
        parser,
        mapping_service,
        validation_service,
        enrichment_service,
        salesforce_csv_bytes,
    ):
        """Complete pipeline: Parse -> Map -> Validate -> Queue."""
        # Step 1: Parse
        parse_result = await parser.parse_file(salesforce_csv_bytes)
        assert parse_result.success is True
        assert parse_result.total_rows == 3

        # Step 2: Map columns
        mapping_result = mapping_service.detect_mappings(parse_result.headers)
        assert mapping_result.has_domain_column
        assert mapping_result.detected_source == SourceSystem.SALESFORCE

        # Step 3: Build rows for validation
        domain_col = mapping_result.mappings["domain"]
        rows_for_validation = [
            {
                "row_number": row.row_number,
                "domain": row.data.get(domain_col),
                "company_name": row.data.get(
                    mapping_result.mappings.get("company_name", "")
                ),
                **row.data,
            }
            for row in parse_result.rows
        ]

        # Step 4: Validate
        validation_report = await validation_service.validate_list(
            list_id="sf-upload-001",
            rows=rows_for_validation,
            domain_column="domain",
        )
        assert validation_report.valid_rows == 3
        assert validation_report.invalid_rows == 0

        # Step 5: Queue for enrichment
        valid_rows = validation_service.get_valid_rows(validation_report)
        valid_items = [
            {
                "domain": r.normalized_domain,
                "company_name": rows_for_validation[i].get("company_name"),
                **rows_for_validation[i],
            }
            for i, r in enumerate(valid_rows)
        ]

        job = await enrichment_service.start_enrichment(
            list_id="sf-upload-001",
            valid_items=valid_items,
            priority=EnrichmentPriority.NORMAL,
        )

        assert job.total_items == 3
        assert job.status == EnrichmentStatus.QUEUED

    @pytest.mark.asyncio
    async def test_full_pipeline_demandbase_csv(
        self,
        parser,
        mapping_service,
        validation_service,
        enrichment_service,
        demandbase_csv_bytes,
    ):
        """Complete pipeline with Demandbase format."""
        # Step 1: Parse
        parse_result = await parser.parse_file(demandbase_csv_bytes)
        assert parse_result.success is True

        # Step 2: Map columns
        mapping_result = mapping_service.detect_mappings(parse_result.headers)
        assert mapping_result.has_domain_column
        assert mapping_result.detected_source == SourceSystem.DEMANDBASE
        assert "demandbase_id" in mapping_result.mappings
        assert "engagement_score" in mapping_result.mappings

        # Step 3: Build rows with pre-existing data
        domain_col = mapping_result.mappings["domain"]
        rows_for_validation = [
            {
                "row_number": row.row_number,
                "domain": row.data.get(domain_col),
                **row.data,
            }
            for row in parse_result.rows
        ]

        # Step 4: Validate
        validation_report = await validation_service.validate_list(
            list_id="db-upload-001",
            rows=rows_for_validation,
            domain_column="domain",
        )
        assert validation_report.valid_rows == 3

        # Step 5: Queue with pre-existing data
        valid_rows = validation_service.get_valid_rows(validation_report)
        valid_items = [
            {
                "domain": r.normalized_domain,
                "normalized_domain": r.normalized_domain,
                **rows_for_validation[i],
            }
            for i, r in enumerate(valid_rows)
        ]

        job = await enrichment_service.start_enrichment(
            list_id="db-upload-001",
            valid_items=valid_items,
        )

        # Verify pre-existing data was extracted
        items = enrichment_service._items.get(job.id, [])
        costco_item = next(
            (i for i in items if i.domain == "costco.com"),
            None
        )
        assert costco_item is not None
        assert "engagement_score" in costco_item.pre_existing_data
        assert "tech_stack_hints" in costco_item.pre_existing_data


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================

class TestEdgeCases:
    """Test edge cases across all services."""

    @pytest.mark.asyncio
    async def test_unicode_company_names(self, parser):
        """Handle Unicode characters in company names."""
        content = "Domain,Company\nmueller.de,Muller GmbH\ntokyo.jp,Japanese Company".encode("utf-8")

        result = await parser.parse_file(content)

        assert result.success is True
        assert len(result.rows) == 2

    @pytest.mark.asyncio
    async def test_very_long_domain(self, validation_service):
        """Handle very long domain names."""
        long_domain = "a" * 250 + ".com"

        is_valid, normalized, errors = validation_service.validate_domain(long_domain)

        assert is_valid is False  # Exceeds max length

    @pytest.mark.asyncio
    async def test_international_tlds(self, validation_service):
        """Handle international TLDs."""
        international_domains = [
            "company.co.uk",
            "business.com.br",
            "firma.de",
            "company.io",
        ]

        for domain in international_domains:
            is_valid, normalized, errors = validation_service.validate_domain(domain)
            assert is_valid is True, f"Should accept: {domain}"

    @pytest.mark.asyncio
    async def test_subdomain_handling(self, validation_service):
        """Handle subdomains appropriately."""
        # Shop subdomain should be preserved (different from www)
        is_valid, normalized, errors = validation_service.validate_domain(
            "shop.costco.com"
        )
        assert is_valid is True
        assert normalized == "shop.costco.com"

        # www should be stripped
        is_valid, normalized, errors = validation_service.validate_domain(
            "www.costco.com"
        )
        assert is_valid is True
        assert normalized == "costco.com"

    @pytest.mark.asyncio
    async def test_empty_enrichment_list(self, enrichment_service):
        """Handle empty list for enrichment."""
        job = await enrichment_service.start_enrichment(
            list_id="empty-list",
            valid_items=[],
        )

        assert job.total_items == 0
        assert job.status == EnrichmentStatus.QUEUED
