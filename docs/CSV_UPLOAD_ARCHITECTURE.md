# CSV Upload Architecture

**Version:** 1.0
**Date:** 2026-02-25
**Priority:** P0 - Critical for Enterprise Adoption
**Status:** DESIGN COMPLETE

---

## 1. Overview

### The Problem

Marketing teams have sanitized target lists from:
- Salesforce (ABM campaigns, territory assignments)
- Demandbase (intent data, engagement scores)
- 6sense (predictive scores)
- Custom Excel analysis

**Current state:** Manual research takes 2-4 weeks per account.
**With PartnerForge:** Minutes per account, fully automated.

### The Solution

Upload a CSV → Parse → Validate → Queue for Enrichment → Return Strategic Intelligence

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   CSV File   │ →  │   Validate   │ →  │   Queue      │ →  │   Enrich     │
│   Upload     │    │   & Parse    │    │   Jobs       │    │   15 Modules │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                    ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Download   │ ←  │   Generate   │ ←  │   Score &    │ ←  │   Store      │
│   Results    │    │   Reports    │    │   Rank       │    │   Results    │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

---

## 2. Sample Input Analysis

### Example: Demandbase + Salesforce Export

**File:** `260225_DG_FY27_Q1_Whale_Final_ready_for_launch_accountsByStage.csv`
**Size:** 406 KB
**Rows:** 776 accounts

**Key Columns (45 total):**

| Column | Type | Required | Use |
|--------|------|----------|-----|
| `Account Name` | string | YES | Company display name |
| `Domain` | string | YES | **Primary key for enrichment** |
| `18 digit Account ID` | string | NO | Salesforce ID for CRM sync |
| `ABM ID` | integer | NO | Demandbase ID |
| `Journey Stage` | enum | NO | Awareness/Engagement/etc. |
| `Revenue` | number | NO | Pre-existing revenue data |
| `Industry` | string | NO | NAICS industry |
| `Traffic` | number | NO | Pre-existing traffic data |
| `Ticker Symbol` | string | NO | For public companies |
| `*_Technology` | boolean | NO | Tech stack flags from Demandbase |
| `Sales Region` | string | NO | Territory assignment |
| `Account Owner` | string | NO | AE assignment |

### Column Mapping Strategy

**Required Column (must have ONE):**
- `Domain` OR `Website` OR `Company Website` OR `URL`

**Auto-Detected Columns:**
```python
COLUMN_MAPPINGS = {
    # Domain (REQUIRED - one of these)
    "domain": ["domain", "website", "company_website", "url", "web", "company_domain"],

    # Company name
    "company_name": ["account_name", "company", "company_name", "name", "account"],

    # Identifiers
    "salesforce_id": ["account_id", "18_digit_account_id", "sf_id", "salesforce_id"],
    "demandbase_id": ["abm_id", "demandbase_id", "db_id"],

    # Pre-existing data (will be preserved, not overwritten unless stale)
    "revenue": ["revenue", "annual_revenue", "arr", "expected_revenue"],
    "traffic": ["traffic", "monthly_visits", "visits"],
    "industry": ["industry", "vertical", "demandbase_industry", "naics_description"],

    # Assignment
    "owner": ["account_owner", "owner", "sales_rep", "ae", "demandbase_account_owner_name"],
    "region": ["sales_region", "region", "territory", "account_region"],

    # ABM context
    "journey_stage": ["journey_stage", "stage", "abx_status"],
    "engagement_score": ["engagement_points", "engagement_score", "score"],
}
```

---

## 3. Database Schema

### New Tables

```sql
-- Uploaded list metadata
CREATE TABLE uploaded_lists (
    id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),

    -- Who uploaded
    user_id VARCHAR(36) REFERENCES users(id),
    team_id VARCHAR(36) REFERENCES teams(id),

    -- List metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source VARCHAR(100),  -- "salesforce", "demandbase", "manual", "excel"

    -- File info
    original_filename VARCHAR(255) NOT NULL,
    file_size_bytes INTEGER,
    file_path VARCHAR(500),  -- Local or S3 path

    -- Parsing results
    total_rows INTEGER,
    valid_rows INTEGER,
    invalid_rows INTEGER,
    duplicate_rows INTEGER,

    -- Column mapping (user-confirmed or auto-detected)
    column_mapping JSONB,
    -- {"domain": "Domain", "company_name": "Account Name", ...}

    -- Processing status
    status VARCHAR(50) DEFAULT 'uploaded',
    -- uploaded, parsing, parsed, validating, validated, queued, processing, completed, failed

    -- Progress tracking
    processed_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,

    -- Timing
    created_at TIMESTAMP DEFAULT NOW(),
    parsing_started_at TIMESTAMP,
    parsing_completed_at TIMESTAMP,
    enrichment_started_at TIMESTAMP,
    enrichment_completed_at TIMESTAMP,

    -- Error handling
    error_message TEXT,
    error_details JSONB
);

CREATE INDEX idx_lists_user ON uploaded_lists(user_id);
CREATE INDEX idx_lists_status ON uploaded_lists(status);
CREATE INDEX idx_lists_created ON uploaded_lists(created_at);


-- Individual items from uploaded list
CREATE TABLE uploaded_list_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
    list_id VARCHAR(36) REFERENCES uploaded_lists(id) ON DELETE CASCADE,

    -- Row reference
    row_number INTEGER NOT NULL,

    -- Core data (parsed from CSV)
    domain VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),

    -- External IDs (for CRM sync)
    salesforce_id VARCHAR(50),
    demandbase_id VARCHAR(50),

    -- Pre-existing data from CSV (preserved)
    csv_data JSONB,  -- All original columns

    -- Processing status
    status VARCHAR(50) DEFAULT 'pending',
    -- pending, validating, valid, invalid, queued, enriching, enriched, failed

    -- Validation
    validation_errors JSONB,
    -- [{"field": "domain", "error": "Invalid format"}, ...]

    -- Enrichment job reference
    enrichment_job_id VARCHAR(36),

    -- Results reference (links to intel_* tables)
    displacement_target_id INTEGER REFERENCES displacement_targets(id),

    -- Timing
    created_at TIMESTAMP DEFAULT NOW(),
    validated_at TIMESTAMP,
    enrichment_started_at TIMESTAMP,
    enrichment_completed_at TIMESTAMP,

    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    UNIQUE(list_id, row_number)
);

CREATE INDEX idx_items_list ON uploaded_list_items(list_id);
CREATE INDEX idx_items_domain ON uploaded_list_items(domain);
CREATE INDEX idx_items_status ON uploaded_list_items(status);


-- Processing queue (optional - can use Redis instead)
CREATE TABLE list_processing_queue (
    id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
    list_id VARCHAR(36) REFERENCES uploaded_lists(id),
    item_id VARCHAR(36) REFERENCES uploaded_list_items(id),

    priority INTEGER DEFAULT 5,  -- 1=highest, 10=lowest

    status VARCHAR(50) DEFAULT 'queued',
    -- queued, processing, completed, failed, cancelled

    worker_id VARCHAR(100),  -- Which worker claimed this
    claimed_at TIMESTAMP,
    completed_at TIMESTAMP,

    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_queue_status ON list_processing_queue(status, priority);
CREATE INDEX idx_queue_list ON list_processing_queue(list_id);
```

---

## 4. File Storage Architecture

### Phase 1: Local Storage (MVP)

```
uploads/
├── lists/
│   ├── {list_id}/
│   │   ├── original.csv           # Original uploaded file
│   │   ├── parsed.json            # Parsed rows with detected columns
│   │   ├── validated.json         # After validation pass
│   │   ├── errors.json            # Validation errors
│   │   └── results/
│   │       ├── enriched.csv       # Final enriched output
│   │       ├── summary.json       # Processing summary
│   │       └── strategic_briefs/  # Per-company briefs
│   │           ├── {domain}.md
│   │           └── ...
│   └── ...
├── temp/                          # Staging area for uploads
└── archive/                       # Completed lists (older than 30 days)
```

### Phase 2: S3 Storage (Production)

```
s3://partnerforge-uploads/
├── {tenant_id}/
│   ├── lists/
│   │   └── {list_id}/
│   │       └── ... (same structure)
│   └── temp/
```

---

## 5. Processing Pipeline

### Step 1: Upload & Initial Validation

```python
# backend/app/services/csv_upload.py

from fastapi import UploadFile
import pandas as pd
from typing import Dict, List, Optional
import hashlib

class CSVUploadService:
    """Handles CSV upload, parsing, and validation."""

    MAX_FILE_SIZE_MB = 50
    MAX_ROWS = 10000
    REQUIRED_COLUMNS = ["domain"]  # At least one of these

    async def upload(
        self,
        file: UploadFile,
        user_id: str,
        team_id: str,
        name: Optional[str] = None,
        source: str = "manual"
    ) -> UploadedList:
        """
        Upload and initially process a CSV file.

        Returns:
            UploadedList with detected columns and validation status
        """
        # 1. Validate file
        await self._validate_file(file)

        # 2. Save to temp storage
        file_path = await self._save_temp_file(file)

        # 3. Parse CSV
        df = await self._parse_csv(file_path)

        # 4. Detect column mappings
        column_mapping = self._detect_column_mapping(df)

        # 5. Create list record
        uploaded_list = UploadedList(
            user_id=user_id,
            team_id=team_id,
            name=name or file.filename,
            source=source,
            original_filename=file.filename,
            file_size_bytes=file.size,
            total_rows=len(df),
            column_mapping=column_mapping,
            status="parsed"
        )

        # 6. Save list and items
        await self._save_list_items(uploaded_list, df)

        return uploaded_list

    def _detect_column_mapping(self, df: pd.DataFrame) -> Dict[str, str]:
        """Auto-detect column mappings from CSV headers."""
        mapping = {}
        headers_lower = {col.lower().replace(" ", "_"): col for col in df.columns}

        for field, candidates in COLUMN_MAPPINGS.items():
            for candidate in candidates:
                if candidate in headers_lower:
                    mapping[field] = headers_lower[candidate]
                    break

        return mapping
```

### Step 2: Validation

```python
# backend/app/services/csv_validation.py

class CSVValidationService:
    """Validates uploaded list items."""

    async def validate_list(self, list_id: str) -> ValidationResult:
        """
        Validate all items in an uploaded list.

        Checks:
        - Domain format (valid URL/domain)
        - Duplicate domains (within list and existing targets)
        - Required fields present
        - Data type validation
        """
        list_obj = await self._get_list(list_id)
        items = await self._get_list_items(list_id)

        valid_count = 0
        invalid_count = 0
        duplicate_count = 0

        seen_domains = set()
        existing_domains = await self._get_existing_domains()

        for item in items:
            errors = []

            # Check domain format
            if not self._is_valid_domain(item.domain):
                errors.append({"field": "domain", "error": "Invalid domain format"})

            # Check duplicates within list
            if item.domain in seen_domains:
                errors.append({"field": "domain", "error": "Duplicate within list"})
                duplicate_count += 1
            else:
                seen_domains.add(item.domain)

            # Check if already exists in system
            if item.domain in existing_domains:
                # Not an error, but flag for merge
                item.existing_target_id = existing_domains[item.domain]

            if errors:
                item.status = "invalid"
                item.validation_errors = errors
                invalid_count += 1
            else:
                item.status = "valid"
                valid_count += 1

            await self._update_item(item)

        # Update list status
        list_obj.valid_rows = valid_count
        list_obj.invalid_rows = invalid_count
        list_obj.duplicate_rows = duplicate_count
        list_obj.status = "validated"
        await self._update_list(list_obj)

        return ValidationResult(
            list_id=list_id,
            total=len(items),
            valid=valid_count,
            invalid=invalid_count,
            duplicates=duplicate_count
        )
```

### Step 3: Queue for Enrichment

```python
# backend/app/services/csv_enrichment.py

class CSVEnrichmentService:
    """Queues and manages enrichment for uploaded lists."""

    async def start_enrichment(
        self,
        list_id: str,
        priority: str = "normal",
        modules: List[str] = None  # None = all 15 modules
    ) -> EnrichmentJob:
        """
        Queue all valid items for enrichment.

        Uses wave-based parallel execution.
        """
        list_obj = await self._get_list(list_id)
        valid_items = await self._get_valid_items(list_id)

        # Create master job
        job = EnrichmentJob(
            list_id=list_id,
            total_items=len(valid_items),
            modules=modules or ALL_MODULES,
            priority=priority,
            status="queued"
        )
        await self._save_job(job)

        # Queue individual items
        for item in valid_items:
            await self._queue_item(job.id, item, priority)

        # Update list status
        list_obj.status = "queued"
        list_obj.enrichment_job_id = job.id
        await self._update_list(list_obj)

        # Trigger workers
        await self._notify_workers(job.id)

        return job

    async def _queue_item(
        self,
        job_id: str,
        item: UploadedListItem,
        priority: str
    ):
        """Queue a single item for enrichment."""
        queue_entry = ListProcessingQueue(
            list_id=item.list_id,
            item_id=item.id,
            priority=self._priority_to_int(priority),
            status="queued"
        )
        await self._save_queue_entry(queue_entry)

        # Also push to Redis for fast worker pickup
        await self.redis.lpush(
            f"enrichment:queue:{priority}",
            json.dumps({
                "job_id": job_id,
                "item_id": item.id,
                "domain": item.domain,
                "list_id": item.list_id
            })
        )
```

### Step 4: Worker Processing

```python
# backend/app/workers/list_enrichment_worker.py

class ListEnrichmentWorker:
    """Worker that processes uploaded list items."""

    async def process_item(self, item_id: str) -> EnrichmentResult:
        """
        Enrich a single list item.

        Uses the standard 4-wave enrichment pipeline.
        """
        item = await self._get_item(item_id)

        # Update status
        item.status = "enriching"
        item.enrichment_started_at = datetime.utcnow()
        await self._update_item(item)

        try:
            # Merge pre-existing data from CSV
            pre_existing_data = self._extract_pre_existing(item.csv_data)

            # Run 4-wave enrichment
            result = await self.orchestrator.execute_enrichment(
                domain=item.domain,
                pre_existing_data=pre_existing_data,
                modules=self.job.modules
            )

            # Create or update displacement target
            target = await self._upsert_displacement_target(
                domain=item.domain,
                company_name=item.company_name,
                enrichment_result=result,
                salesforce_id=item.salesforce_id,
                demandbase_id=item.demandbase_id
            )

            # Update item with results
            item.displacement_target_id = target.id
            item.status = "enriched"
            item.enrichment_completed_at = datetime.utcnow()
            await self._update_item(item)

            # Update list progress
            await self._increment_list_progress(item.list_id, success=True)

            return result

        except Exception as e:
            item.status = "failed"
            item.error_message = str(e)
            item.retry_count += 1
            await self._update_item(item)

            await self._increment_list_progress(item.list_id, success=False)

            raise

    def _extract_pre_existing(self, csv_data: Dict) -> Dict:
        """
        Extract pre-existing data from CSV to avoid redundant API calls.

        If CSV has revenue/traffic/tech stack, use it (if fresh enough).
        """
        pre_existing = {}

        # Revenue (use if less than 12 months old)
        if "Revenue" in csv_data and csv_data["Revenue"]:
            pre_existing["revenue"] = csv_data["Revenue"]
            pre_existing["revenue_source"] = "csv_import"

        # Traffic (use if less than 30 days old - assume CSV is recent)
        if "Traffic" in csv_data and csv_data["Traffic"]:
            pre_existing["traffic"] = csv_data["Traffic"]
            pre_existing["traffic_source"] = "csv_import"

        # Tech stack flags (from Demandbase)
        tech_flags = {}
        for col, val in csv_data.items():
            if col.endswith("_Technology") and val:
                tech_name = col.replace("_Technology", "").replace("_", " ")
                tech_flags[tech_name] = True
        if tech_flags:
            pre_existing["tech_stack_hints"] = tech_flags

        return pre_existing
```

---

## 6. API Endpoints

### Upload Endpoints

```python
# backend/app/api/routes/lists.py

from fastapi import APIRouter, UploadFile, File, Depends, BackgroundTasks

router = APIRouter(prefix="/api/v1/lists", tags=["lists"])


@router.post("/upload")
async def upload_list(
    file: UploadFile = File(...),
    name: str = None,
    source: str = "manual",
    user: User = Depends(get_current_user),
    upload_service: CSVUploadService = Depends()
) -> UploadedListResponse:
    """
    Upload a CSV file of target accounts.

    Returns:
        - List ID
        - Detected column mappings
        - Row counts
        - Validation status
    """
    uploaded_list = await upload_service.upload(
        file=file,
        user_id=user.id,
        team_id=user.team_id,
        name=name,
        source=source
    )

    return UploadedListResponse(
        id=uploaded_list.id,
        name=uploaded_list.name,
        total_rows=uploaded_list.total_rows,
        column_mapping=uploaded_list.column_mapping,
        status=uploaded_list.status,
        requires_mapping_confirmation=not uploaded_list.has_domain_column
    )


@router.post("/{list_id}/confirm-mapping")
async def confirm_column_mapping(
    list_id: str,
    mapping: ColumnMappingRequest,
    upload_service: CSVUploadService = Depends()
) -> UploadedListResponse:
    """
    Confirm or correct auto-detected column mappings.

    Required if domain column wasn't auto-detected.
    """
    return await upload_service.update_mapping(list_id, mapping.mapping)


@router.post("/{list_id}/validate")
async def validate_list(
    list_id: str,
    background_tasks: BackgroundTasks,
    validation_service: CSVValidationService = Depends()
) -> ValidationResponse:
    """
    Validate all items in the uploaded list.

    Runs asynchronously for large lists.
    """
    # For small lists, validate synchronously
    list_obj = await upload_service.get_list(list_id)

    if list_obj.total_rows <= 100:
        result = await validation_service.validate_list(list_id)
        return ValidationResponse.from_result(result)
    else:
        # Queue for background validation
        background_tasks.add_task(validation_service.validate_list, list_id)
        return ValidationResponse(
            list_id=list_id,
            status="validating",
            message="Validation started. Check status endpoint for progress."
        )


@router.post("/{list_id}/enrich")
async def start_enrichment(
    list_id: str,
    priority: str = "normal",
    modules: List[str] = None,
    enrichment_service: CSVEnrichmentService = Depends()
) -> EnrichmentJobResponse:
    """
    Start enrichment for all valid items in the list.

    Args:
        priority: "high", "normal", "low"
        modules: Specific modules to run (default: all 15)

    Returns:
        Job ID and estimated completion time
    """
    job = await enrichment_service.start_enrichment(
        list_id=list_id,
        priority=priority,
        modules=modules
    )

    return EnrichmentJobResponse(
        job_id=job.id,
        list_id=list_id,
        total_items=job.total_items,
        status=job.status,
        estimated_time_seconds=job.total_items * 60 / 4  # ~60s per item, 4 parallel
    )


@router.get("/{list_id}/status")
async def get_list_status(
    list_id: str,
    upload_service: CSVUploadService = Depends()
) -> ListStatusResponse:
    """
    Get current status of an uploaded list.

    Includes progress counts and any errors.
    """
    list_obj = await upload_service.get_list(list_id)

    return ListStatusResponse(
        id=list_obj.id,
        name=list_obj.name,
        status=list_obj.status,
        total_rows=list_obj.total_rows,
        valid_rows=list_obj.valid_rows,
        invalid_rows=list_obj.invalid_rows,
        processed_count=list_obj.processed_count,
        success_count=list_obj.success_count,
        error_count=list_obj.error_count,
        progress_percent=self._calculate_progress(list_obj),
        created_at=list_obj.created_at,
        enrichment_started_at=list_obj.enrichment_started_at,
        enrichment_completed_at=list_obj.enrichment_completed_at
    )


@router.get("/{list_id}/results")
async def get_list_results(
    list_id: str,
    format: str = "json",  # "json", "csv"
    include_errors: bool = False,
    upload_service: CSVUploadService = Depends()
) -> Union[ListResultsResponse, StreamingResponse]:
    """
    Get enrichment results for a completed list.

    Args:
        format: "json" for API response, "csv" for download
        include_errors: Include failed items in output

    Returns:
        Enriched data for all successfully processed items
    """
    if format == "csv":
        return await upload_service.generate_results_csv(list_id, include_errors)
    else:
        return await upload_service.get_results_json(list_id, include_errors)


@router.get("/{list_id}/items")
async def get_list_items(
    list_id: str,
    status: str = None,  # Filter by status
    page: int = 1,
    page_size: int = 50,
    upload_service: CSVUploadService = Depends()
) -> PaginatedListItemsResponse:
    """
    Get individual items from an uploaded list.

    Useful for reviewing validation errors or enrichment status.
    """
    return await upload_service.get_items(
        list_id=list_id,
        status=status,
        page=page,
        page_size=page_size
    )


@router.delete("/{list_id}")
async def delete_list(
    list_id: str,
    user: User = Depends(get_current_user),
    upload_service: CSVUploadService = Depends()
) -> DeleteResponse:
    """
    Delete an uploaded list and all its items.

    Note: Does not delete enrichment results (displacement targets).
    """
    await upload_service.delete_list(list_id, user.id)
    return DeleteResponse(success=True, message="List deleted")
```

---

## 7. Frontend Components

### Upload Component

```tsx
// frontend/src/components/lists/ListUpload.tsx

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileCheck, AlertCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { uploadList } from '@/services/api';

interface ListUploadProps {
  onUploadComplete: (listId: string) => void;
}

export function ListUpload({ onUploadComplete }: ListUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [listName, setListName] = useState('');
  const [source, setSource] = useState('salesforce');

  const uploadMutation = useMutation({
    mutationFn: uploadList,
    onSuccess: (data) => {
      onUploadComplete(data.id);
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setListName(acceptedFiles[0].name.replace('.csv', ''));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', listName);
    formData.append('source', source);

    uploadMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-200
          ${isDragActive
            ? 'border-algolia-500 bg-algolia-500/10'
            : 'border-white/20 hover:border-white/40 bg-white/5'}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-white/60" />
        {isDragActive ? (
          <p className="text-white">Drop your CSV here...</p>
        ) : (
          <>
            <p className="text-white font-medium">
              Drag & drop your CSV file here
            </p>
            <p className="text-white/60 text-sm mt-2">
              or click to browse (max 50MB, 10,000 rows)
            </p>
          </>
        )}
      </div>

      {/* File preview */}
      {file && (
        <div className="bg-white/5 rounded-lg p-4 flex items-center gap-4">
          <FileCheck className="w-8 h-8 text-green-400" />
          <div className="flex-1">
            <p className="text-white font-medium">{file.name}</p>
            <p className="text-white/60 text-sm">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
      )}

      {/* Options */}
      {file && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-white/60 text-sm mb-2">List Name</label>
            <input
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
            >
              <option value="salesforce">Salesforce</option>
              <option value="demandbase">Demandbase</option>
              <option value="6sense">6sense</option>
              <option value="manual">Manual/Excel</option>
            </select>
          </div>
        </div>
      )}

      {/* Upload button */}
      {file && (
        <button
          onClick={handleUpload}
          disabled={uploadMutation.isPending}
          className="w-full bg-algolia-500 hover:bg-algolia-600 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
        >
          {uploadMutation.isPending ? 'Uploading...' : 'Upload & Continue'}
        </button>
      )}

      {/* Error display */}
      {uploadMutation.isError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{uploadMutation.error.message}</p>
        </div>
      )}
    </div>
  );
}
```

### Column Mapping Component

```tsx
// frontend/src/components/lists/ColumnMapping.tsx

interface ColumnMappingProps {
  listId: string;
  detectedMapping: Record<string, string>;
  csvHeaders: string[];
  onConfirm: () => void;
}

export function ColumnMapping({
  listId,
  detectedMapping,
  csvHeaders,
  onConfirm
}: ColumnMappingProps) {
  const [mapping, setMapping] = useState(detectedMapping);

  const requiredFields = ['domain'];
  const optionalFields = ['company_name', 'salesforce_id', 'revenue', 'industry'];

  return (
    <div className="space-y-6">
      <div className="bg-white/5 rounded-lg p-6">
        <h3 className="text-white font-semibold mb-4">Column Mapping</h3>
        <p className="text-white/60 text-sm mb-6">
          We detected the following column mappings. Please verify or correct.
        </p>

        {/* Required fields */}
        <div className="space-y-4">
          <h4 className="text-white/80 text-sm font-medium">Required</h4>
          {requiredFields.map(field => (
            <FieldMapping
              key={field}
              field={field}
              currentMapping={mapping[field]}
              csvHeaders={csvHeaders}
              onChange={(header) => setMapping({...mapping, [field]: header})}
              required
            />
          ))}
        </div>

        {/* Optional fields */}
        <div className="space-y-4 mt-6">
          <h4 className="text-white/80 text-sm font-medium">Optional</h4>
          {optionalFields.map(field => (
            <FieldMapping
              key={field}
              field={field}
              currentMapping={mapping[field]}
              csvHeaders={csvHeaders}
              onChange={(header) => setMapping({...mapping, [field]: header})}
            />
          ))}
        </div>
      </div>

      <button
        onClick={() => onConfirm(mapping)}
        className="w-full bg-algolia-500 text-white py-3 rounded-lg"
      >
        Confirm Mapping & Validate
      </button>
    </div>
  );
}
```

### Progress Tracker Component

```tsx
// frontend/src/components/lists/EnrichmentProgress.tsx

interface EnrichmentProgressProps {
  listId: string;
}

export function EnrichmentProgress({ listId }: EnrichmentProgressProps) {
  const { data: status } = useQuery({
    queryKey: ['list-status', listId],
    queryFn: () => getListStatus(listId),
    refetchInterval: 2000, // Poll every 2 seconds
  });

  if (!status) return <Spinner />;

  const progress = (status.processed_count / status.total_rows) * 100;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-sm text-white/60 mb-2">
          <span>Processing {status.name}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-algolia-500 to-algolia-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total"
          value={status.total_rows}
          icon={FileText}
        />
        <StatCard
          label="Processed"
          value={status.processed_count}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          label="Success"
          value={status.success_count}
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          label="Errors"
          value={status.error_count}
          icon={AlertCircle}
          color="red"
        />
      </div>

      {/* Estimated time */}
      {status.status === 'processing' && (
        <div className="text-center text-white/60 text-sm">
          Estimated time remaining: {formatDuration(status.estimated_remaining_seconds)}
        </div>
      )}

      {/* Complete message */}
      {status.status === 'completed' && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
          <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-green-400 font-medium">Enrichment Complete!</p>
          <p className="text-white/60 text-sm mt-1">
            {status.success_count} accounts enriched successfully
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## 8. Data Flow Diagram

```
                                    CSV UPLOAD FLOW
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  USER                                                                       │
│    │                                                                        │
│    ▼                                                                        │
│  ┌─────────────┐   POST /upload   ┌─────────────┐                          │
│  │  Upload     │ ───────────────► │  Validate   │                          │
│  │  CSV File   │                  │  File       │                          │
│  └─────────────┘                  └─────────────┘                          │
│                                         │                                   │
│                                         ▼                                   │
│                                   ┌─────────────┐                          │
│                                   │  Parse CSV  │                          │
│                                   │  Detect     │                          │
│                                   │  Columns    │                          │
│                                   └─────────────┘                          │
│                                         │                                   │
│                     ┌───────────────────┴───────────────────┐              │
│                     ▼                                       ▼              │
│               ┌───────────┐                          ┌───────────┐         │
│               │  Domain   │ NO                       │  Domain   │ YES     │
│               │  Found?   │───► Prompt for mapping   │  Found?   │         │
│               └───────────┘                          └───────────┘         │
│                                                            │               │
│                     ┌──────────────────────────────────────┘               │
│                     ▼                                                       │
│               ┌─────────────┐                                              │
│               │  Validate   │                                              │
│               │  Each Row   │                                              │
│               └─────────────┘                                              │
│                     │                                                       │
│       ┌─────────────┴─────────────┐                                        │
│       ▼                           ▼                                        │
│  ┌─────────┐                ┌─────────┐                                    │
│  │ Invalid │                │  Valid  │                                    │
│  │ Rows    │                │  Rows   │                                    │
│  └─────────┘                └─────────┘                                    │
│       │                           │                                        │
│       ▼                           ▼                                        │
│  ┌─────────────┐           ┌─────────────┐                                 │
│  │  Error      │           │  Queue for  │                                 │
│  │  Report     │           │  Enrichment │                                 │
│  └─────────────┘           └─────────────┘                                 │
│                                   │                                        │
│                    ┌──────────────┴──────────────┐                         │
│                    ▼              ▼              ▼                         │
│              ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│              │ Worker 1 │  │ Worker 2 │  │ Worker N │                      │
│              │ (Wave 1) │  │ (Wave 1) │  │ (Wave 1) │                      │
│              └──────────┘  └──────────┘  └──────────┘                      │
│                    │              │              │                         │
│                    └──────────────┼──────────────┘                         │
│                                   ▼                                        │
│                            ┌─────────────┐                                 │
│                            │  4-Wave     │                                 │
│                            │  Enrichment │                                 │
│                            │  Pipeline   │                                 │
│                            └─────────────┘                                 │
│                                   │                                        │
│                                   ▼                                        │
│                            ┌─────────────┐                                 │
│                            │  Store      │                                 │
│                            │  Results    │                                 │
│                            └─────────────┘                                 │
│                                   │                                        │
│                    ┌──────────────┴──────────────┐                         │
│                    ▼                             ▼                         │
│             ┌─────────────┐              ┌─────────────┐                   │
│             │ displacement │              │   intel_*   │                   │
│             │ _targets     │              │   tables    │                   │
│             └─────────────┘              └─────────────┘                   │
│                                                                             │
│  USER                                                                       │
│    │                                                                        │
│    ▼                                                                        │
│  ┌─────────────┐                                                           │
│  │  Download   │                                                           │
│  │  Results    │  (CSV or Dashboard view)                                  │
│  └─────────────┘                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Implementation Priority

### Phase 1: MVP (Week 1)
- [ ] Database schema (uploaded_lists, uploaded_list_items)
- [ ] Basic upload endpoint (file storage, parsing)
- [ ] Column detection and validation
- [ ] Simple enrichment queue (serial processing)
- [ ] Basic progress tracking
- [ ] Results download (CSV)

### Phase 2: Scale (Week 2)
- [ ] Parallel worker processing
- [ ] Redis queue integration
- [ ] Real-time progress (WebSocket/SSE)
- [ ] Error handling and retry
- [ ] Pre-existing data merging

### Phase 3: Polish (Week 3)
- [ ] Frontend upload component
- [ ] Column mapping UI
- [ ] Progress dashboard
- [ ] Batch operations
- [ ] S3 storage migration

---

## 10. Testing Requirements

### Unit Tests
- CSV parsing with various encodings
- Column detection accuracy
- Domain validation rules
- Duplicate detection

### Integration Tests
- Upload → Parse → Validate → Enrich flow
- Large file handling (1000+ rows)
- Error recovery and retry

### E2E Tests
- Upload real Demandbase export
- Complete enrichment cycle
- Download results

---

*Document Version: 1.0*
*Last Updated: 2026-02-25*
*Status: APPROVED - Ready for implementation*
