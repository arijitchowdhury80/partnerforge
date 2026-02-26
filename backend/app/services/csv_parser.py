"""
CSV Parser Service
==================

Production-ready CSV parsing with:
- Automatic encoding detection (UTF-8, Latin-1, Windows-1252, etc.)
- Delimiter detection (comma, semicolon, tab, pipe)
- Large file handling with chunking
- Robust error handling

Supports files up to 50MB and 10,000 rows.
"""

import csv
import io
import hashlib
import logging
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Iterator, Any, BinaryIO
from dataclasses import dataclass, field
from enum import Enum
import chardet

logger = logging.getLogger(__name__)


class CSVParseError(Exception):
    """Base exception for CSV parsing errors."""
    pass


class EncodingDetectionError(CSVParseError):
    """Raised when encoding cannot be detected."""
    pass


class FileTooLargeError(CSVParseError):
    """Raised when file exceeds size limits."""
    pass


class TooManyRowsError(CSVParseError):
    """Raised when file exceeds row limits."""
    pass


class InvalidCSVError(CSVParseError):
    """Raised when CSV structure is invalid."""
    pass


class Encoding(str, Enum):
    """Supported file encodings."""
    UTF8 = "utf-8"
    UTF8_BOM = "utf-8-sig"
    LATIN1 = "latin-1"
    WINDOWS_1252 = "cp1252"
    ASCII = "ascii"
    ISO_8859_1 = "iso-8859-1"


class Delimiter(str, Enum):
    """Supported CSV delimiters."""
    COMMA = ","
    SEMICOLON = ";"
    TAB = "\t"
    PIPE = "|"


@dataclass
class ParsedRow:
    """Represents a single parsed CSV row."""
    row_number: int
    data: Dict[str, Any]
    raw_values: List[str]
    is_valid: bool = True
    parse_errors: List[str] = field(default_factory=list)


@dataclass
class ParseResult:
    """Result of CSV parsing operation."""
    success: bool
    headers: List[str]
    rows: List[ParsedRow]
    total_rows: int
    parsed_rows: int
    error_rows: int
    encoding: str
    delimiter: str
    file_hash: str
    file_size_bytes: int
    error_message: Optional[str] = None
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response."""
        return {
            "success": self.success,
            "headers": self.headers,
            "total_rows": self.total_rows,
            "parsed_rows": self.parsed_rows,
            "error_rows": self.error_rows,
            "encoding": self.encoding,
            "delimiter": self.delimiter,
            "file_hash": self.file_hash,
            "file_size_bytes": self.file_size_bytes,
            "error_message": self.error_message,
            "warnings": self.warnings,
        }


class CSVParserService:
    """
    Production-ready CSV parser with encoding and delimiter detection.

    Features:
    - Auto-detect encoding (UTF-8, Latin-1, Windows-1252, etc.)
    - Auto-detect delimiter (comma, semicolon, tab, pipe)
    - Large file support with chunked reading
    - Comprehensive error handling
    - File hash computation for deduplication

    Usage:
        parser = CSVParserService()
        result = await parser.parse_file(file_content, filename="targets.csv")

        if result.success:
            for row in result.rows:
                print(row.data)
    """

    # Limits
    MAX_FILE_SIZE_MB = 50
    MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
    MAX_ROWS = 10_000
    CHUNK_SIZE = 8192  # 8KB chunks for reading

    # Detection settings
    ENCODING_SAMPLE_SIZE = 65536  # 64KB for encoding detection
    DELIMITER_SAMPLE_LINES = 20

    # Supported delimiters for detection
    DELIMITERS = [",", ";", "\t", "|"]

    def __init__(
        self,
        max_file_size_mb: int = MAX_FILE_SIZE_MB,
        max_rows: int = MAX_ROWS,
    ):
        """
        Initialize parser with configurable limits.

        Args:
            max_file_size_mb: Maximum file size in megabytes (default: 50)
            max_rows: Maximum number of rows to process (default: 10,000)
        """
        self.max_file_size_bytes = max_file_size_mb * 1024 * 1024
        self.max_rows = max_rows

    async def parse_file(
        self,
        content: bytes,
        filename: str = "upload.csv",
        encoding: Optional[str] = None,
        delimiter: Optional[str] = None,
    ) -> ParseResult:
        """
        Parse a CSV file from bytes content.

        Args:
            content: Raw file bytes
            filename: Original filename (for logging)
            encoding: Force specific encoding (auto-detect if None)
            delimiter: Force specific delimiter (auto-detect if None)

        Returns:
            ParseResult with parsed data or error information
        """
        logger.info(f"Parsing CSV file: {filename} ({len(content)} bytes)")

        try:
            # Validate file size
            self._validate_file_size(content)

            # Compute file hash for deduplication
            file_hash = self._compute_hash(content)

            # Detect or use provided encoding
            detected_encoding = encoding or self._detect_encoding(content)
            logger.debug(f"Using encoding: {detected_encoding}")

            # Decode content
            try:
                text_content = content.decode(detected_encoding)
            except UnicodeDecodeError as e:
                # Fallback to latin-1 which accepts all byte values
                logger.warning(f"Encoding error with {detected_encoding}, falling back to latin-1: {e}")
                text_content = content.decode("latin-1")
                detected_encoding = "latin-1"

            # Detect or use provided delimiter
            detected_delimiter = delimiter or self._detect_delimiter(text_content)
            logger.debug(f"Using delimiter: {repr(detected_delimiter)}")

            # Parse CSV
            headers, rows, warnings = self._parse_content(
                text_content,
                detected_delimiter,
            )

            # Count valid/error rows
            error_rows = sum(1 for row in rows if not row.is_valid)

            logger.info(
                f"Parsed {filename}: {len(rows)} rows, {error_rows} errors, "
                f"encoding={detected_encoding}, delimiter={repr(detected_delimiter)}"
            )

            return ParseResult(
                success=True,
                headers=headers,
                rows=rows,
                total_rows=len(rows),
                parsed_rows=len(rows) - error_rows,
                error_rows=error_rows,
                encoding=detected_encoding,
                delimiter=detected_delimiter,
                file_hash=file_hash,
                file_size_bytes=len(content),
                warnings=warnings,
            )

        except CSVParseError as e:
            logger.error(f"CSV parse error for {filename}: {e}")
            return ParseResult(
                success=False,
                headers=[],
                rows=[],
                total_rows=0,
                parsed_rows=0,
                error_rows=0,
                encoding=encoding or "unknown",
                delimiter=delimiter or "unknown",
                file_hash=self._compute_hash(content) if content else "",
                file_size_bytes=len(content) if content else 0,
                error_message=str(e),
            )
        except Exception as e:
            logger.exception(f"Unexpected error parsing {filename}: {e}")
            return ParseResult(
                success=False,
                headers=[],
                rows=[],
                total_rows=0,
                parsed_rows=0,
                error_rows=0,
                encoding=encoding or "unknown",
                delimiter=delimiter or "unknown",
                file_hash="",
                file_size_bytes=len(content) if content else 0,
                error_message=f"Unexpected error: {str(e)}",
            )

    async def parse_file_path(
        self,
        file_path: Path,
        encoding: Optional[str] = None,
        delimiter: Optional[str] = None,
    ) -> ParseResult:
        """
        Parse a CSV file from filesystem path.

        Args:
            file_path: Path to the CSV file
            encoding: Force specific encoding (auto-detect if None)
            delimiter: Force specific delimiter (auto-detect if None)

        Returns:
            ParseResult with parsed data or error information
        """
        if not file_path.exists():
            return ParseResult(
                success=False,
                headers=[],
                rows=[],
                total_rows=0,
                parsed_rows=0,
                error_rows=0,
                encoding=encoding or "unknown",
                delimiter=delimiter or "unknown",
                file_hash="",
                file_size_bytes=0,
                error_message=f"File not found: {file_path}",
            )

        content = file_path.read_bytes()
        return await self.parse_file(content, filename=file_path.name, encoding=encoding, delimiter=delimiter)

    def _validate_file_size(self, content: bytes) -> None:
        """Validate file size is within limits."""
        if len(content) > self.max_file_size_bytes:
            raise FileTooLargeError(
                f"File size {len(content) / 1024 / 1024:.2f}MB exceeds "
                f"maximum allowed {self.max_file_size_bytes / 1024 / 1024}MB"
            )

    def _compute_hash(self, content: bytes) -> str:
        """Compute SHA-256 hash of file content for deduplication."""
        return hashlib.sha256(content).hexdigest()

    def _detect_encoding(self, content: bytes) -> str:
        """
        Detect file encoding using chardet.

        Args:
            content: Raw file bytes

        Returns:
            Detected encoding string
        """
        # Take sample for detection (first 64KB)
        sample = content[:self.ENCODING_SAMPLE_SIZE]

        # Check for BOM (Byte Order Mark)
        if sample.startswith(b'\xef\xbb\xbf'):
            return "utf-8-sig"
        if sample.startswith(b'\xff\xfe'):
            return "utf-16-le"
        if sample.startswith(b'\xfe\xff'):
            return "utf-16-be"

        # Use chardet for detection
        detection = chardet.detect(sample)
        encoding = detection.get("encoding", "utf-8")
        confidence = detection.get("confidence", 0)

        logger.debug(f"Encoding detection: {encoding} (confidence: {confidence:.2%})")

        if encoding is None or confidence < 0.5:
            # Low confidence, default to UTF-8 with fallback
            logger.warning(f"Low encoding confidence ({confidence:.2%}), defaulting to UTF-8")
            encoding = "utf-8"

        # Normalize encoding names
        encoding_map = {
            "ascii": "utf-8",  # ASCII is subset of UTF-8
            "iso-8859-1": "latin-1",
            "windows-1252": "cp1252",
        }

        return encoding_map.get(encoding.lower(), encoding.lower())

    def _detect_delimiter(self, text: str) -> str:
        """
        Detect CSV delimiter by analyzing sample lines.

        Strategy:
        1. Take first N lines
        2. Count occurrences of each potential delimiter
        3. Check consistency across lines
        4. Choose delimiter with most consistent count > 0

        Args:
            text: Decoded text content

        Returns:
            Detected delimiter character
        """
        lines = text.split('\n')[:self.DELIMITER_SAMPLE_LINES]

        if not lines:
            return ","  # Default to comma

        # Score each delimiter
        delimiter_scores: Dict[str, Tuple[int, float]] = {}

        for delim in self.DELIMITERS:
            counts = [line.count(delim) for line in lines if line.strip()]

            if not counts or max(counts) == 0:
                continue

            # Calculate consistency (std deviation / mean)
            mean_count = sum(counts) / len(counts)
            if mean_count == 0:
                continue

            variance = sum((c - mean_count) ** 2 for c in counts) / len(counts)
            std_dev = variance ** 0.5
            consistency = 1.0 - (std_dev / mean_count) if mean_count > 0 else 0

            delimiter_scores[delim] = (int(mean_count), consistency)

        if not delimiter_scores:
            logger.warning("No delimiter detected, defaulting to comma")
            return ","

        # Sort by consistency first, then by count
        best_delimiter = max(
            delimiter_scores.items(),
            key=lambda x: (x[1][1], x[1][0])
        )[0]

        logger.debug(f"Delimiter scores: {delimiter_scores}, selected: {repr(best_delimiter)}")
        return best_delimiter

    def _parse_content(
        self,
        text: str,
        delimiter: str,
    ) -> Tuple[List[str], List[ParsedRow], List[str]]:
        """
        Parse CSV content into headers and rows.

        Args:
            text: Decoded text content
            delimiter: CSV delimiter to use

        Returns:
            Tuple of (headers, rows, warnings)
        """
        warnings: List[str] = []

        # Use csv.reader with detected delimiter
        reader = csv.reader(io.StringIO(text), delimiter=delimiter)

        try:
            # Read headers
            headers = next(reader)
            headers = [h.strip() for h in headers]

            if not headers or all(not h for h in headers):
                raise InvalidCSVError("CSV file has no valid headers")

        except StopIteration:
            raise InvalidCSVError("CSV file is empty")

        # Clean up header names (remove BOM, whitespace)
        headers = self._clean_headers(headers)

        # Check for duplicate headers
        seen_headers = set()
        for i, header in enumerate(headers):
            if header in seen_headers:
                original = header
                header = f"{header}_{i}"
                headers[i] = header
                warnings.append(f"Duplicate header '{original}' renamed to '{header}'")
            seen_headers.add(header)

        # Parse rows
        rows: List[ParsedRow] = []
        row_number = 1  # 1-indexed (header is row 0)

        for raw_row in reader:
            row_number += 1

            # Check row limit
            if len(rows) >= self.max_rows:
                warnings.append(
                    f"File truncated at row {row_number}: exceeded maximum of {self.max_rows} rows"
                )
                break

            # Skip completely empty rows
            if not raw_row or all(not cell.strip() for cell in raw_row):
                continue

            # Parse row
            parsed_row = self._parse_row(row_number, raw_row, headers)
            rows.append(parsed_row)

        return headers, rows, warnings

    def _clean_headers(self, headers: List[str]) -> List[str]:
        """
        Clean header names.

        - Remove BOM characters
        - Strip whitespace
        - Replace problematic characters
        """
        cleaned = []
        for header in headers:
            # Remove BOM
            header = header.lstrip('\ufeff')
            # Strip whitespace
            header = header.strip()
            # Remove null characters
            header = header.replace('\x00', '')
            # Default name for empty headers
            if not header:
                header = f"column_{len(cleaned) + 1}"
            cleaned.append(header)
        return cleaned

    def _parse_row(
        self,
        row_number: int,
        raw_values: List[str],
        headers: List[str],
    ) -> ParsedRow:
        """
        Parse a single CSV row into structured data.

        Args:
            row_number: 1-indexed row number
            raw_values: List of cell values
            headers: Column headers

        Returns:
            ParsedRow with data dictionary
        """
        errors: List[str] = []

        # Handle row with different number of columns than headers
        if len(raw_values) < len(headers):
            # Pad with empty values
            raw_values = raw_values + [''] * (len(headers) - len(raw_values))
            errors.append(f"Row has fewer columns ({len(raw_values)}) than headers ({len(headers)})")
        elif len(raw_values) > len(headers):
            # Truncate extra values
            errors.append(f"Row has more columns ({len(raw_values)}) than headers ({len(headers)})")
            raw_values = raw_values[:len(headers)]

        # Build data dictionary
        data = {}
        for header, value in zip(headers, raw_values):
            # Clean value
            cleaned_value = value.strip() if value else ""
            data[header] = cleaned_value

        return ParsedRow(
            row_number=row_number,
            data=data,
            raw_values=raw_values,
            is_valid=len(errors) == 0,
            parse_errors=errors,
        )

    def get_sample_rows(
        self,
        result: ParseResult,
        count: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Get sample rows for preview.

        Args:
            result: ParseResult from parsing
            count: Number of sample rows to return

        Returns:
            List of row data dictionaries
        """
        return [row.data for row in result.rows[:count]]

    def get_column_stats(
        self,
        result: ParseResult,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Get statistics for each column.

        Args:
            result: ParseResult from parsing

        Returns:
            Dictionary of column stats including:
            - non_empty_count: Number of non-empty values
            - empty_count: Number of empty values
            - sample_values: First 3 unique values
        """
        stats: Dict[str, Dict[str, Any]] = {}

        for header in result.headers:
            values = [row.data.get(header, "") for row in result.rows]
            non_empty = [v for v in values if v]
            unique_values = list(dict.fromkeys(non_empty))[:3]  # First 3 unique

            stats[header] = {
                "non_empty_count": len(non_empty),
                "empty_count": len(values) - len(non_empty),
                "fill_rate": len(non_empty) / len(values) if values else 0,
                "sample_values": unique_values,
            }

        return stats
