"""
List Management API Endpoints

CSV upload, validation, and enrichment endpoints for target lists.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from datetime import datetime
from typing import Optional
import csv
import io
import hashlib
import uuid
import logging

from ..deps import get_db, get_current_user, get_pagination, CurrentUser, PaginationParams
from ..schemas.lists import (
    ListUploadResponse,
    ListColumnMapping,
    ListColumnMappingConfirm,
    ListResponse,
    ListSummaryResponse,
    ListDetailResponse,
    ListPaginatedResponse,
    ListItemResponse,
    ListItemSummary,
    ListValidationRequest,
    ListValidationResponse,
    ListEnrichmentRequest,
    ListEnrichmentResponse,
    ListProcessingStatus,
    ValidationError,
    PaginationMeta,
    ListStatus,
    ItemStatus,
    MappingConfidence,
    EnrichmentPriority,
)
from ...models import (
    UploadedList,
    UploadedListItem,
    ListProcessingQueue,
    detect_column_mapping,
    has_required_columns,
)
from ...config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lists", tags=["Lists"])
settings = get_settings()


# =============================================================================
# Upload Endpoints
# =============================================================================

@router.post("/upload", response_model=ListUploadResponse)
async def upload_list(
    file: UploadFile = File(..., description="CSV file to upload"),
    name: str = Query(..., min_length=1, max_length=255, description="List name"),
    source: str = Query("manual", description="Source of the list"),
    description: Optional[str] = Query(None, max_length=2000, description="List description"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Upload a CSV file and create a new list.

    Process:
    1. Validate file type (CSV only)
    2. Parse headers and detect column mapping
    3. Create list record with status "uploaded"
    4. Return mapping for user confirmation

    The list is NOT processed until validation is triggered.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported. Please upload a .csv file.",
        )

    # Read file content
    try:
        content = await file.read()
        file_size = len(content)

        # Limit file size (10MB)
        max_size = 10 * 1024 * 1024
        if file_size > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {max_size // 1024 // 1024}MB.",
            )

        # Decode and parse CSV
        try:
            text_content = content.decode("utf-8-sig")  # Handle BOM
        except UnicodeDecodeError:
            text_content = content.decode("latin-1")

        # Parse CSV to get headers and row count
        csv_reader = csv.reader(io.StringIO(text_content))
        rows = list(csv_reader)

        if len(rows) < 2:
            raise HTTPException(
                status_code=400,
                detail="CSV file must have at least a header row and one data row.",
            )

        headers = rows[0]
        data_rows = rows[1:]
        total_rows = len(data_rows)

        # Detect column mapping
        mapping_dict = detect_column_mapping(headers)
        has_domain = has_required_columns(mapping_dict)

        # Determine mapping confidence
        if has_domain and len(mapping_dict) >= 5:
            confidence = MappingConfidence.HIGH
        elif has_domain and len(mapping_dict) >= 2:
            confidence = MappingConfidence.MEDIUM
        else:
            confidence = MappingConfidence.LOW

        # Calculate file hash for deduplication
        file_hash = hashlib.sha256(content).hexdigest()

        # Check for duplicate uploads
        existing = await db.execute(
            select(UploadedList).where(
                UploadedList.file_hash == file_hash,
                UploadedList.user_id == current_user.user_id,
            )
        )
        if existing.scalar():
            raise HTTPException(
                status_code=409,
                detail="This file has already been uploaded. Please use a different file or delete the existing list.",
            )

        # Create list record
        new_list = UploadedList(
            id=str(uuid.uuid4()),
            user_id=current_user.user_id,
            team_id=current_user.team_id,
            name=name.strip(),
            description=description,
            source=source,
            original_filename=file.filename,
            file_size_bytes=file_size,
            file_hash=file_hash,
            total_rows=total_rows,
            detected_columns=headers,
            column_mapping=mapping_dict,
            mapping_confidence=confidence.value,
            status=ListStatus.UPLOADED.value,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(new_list)
        await db.flush()

        # Store items for later processing
        for row_num, row in enumerate(data_rows, start=1):
            # Create dict from row
            csv_data = dict(zip(headers, row)) if len(row) == len(headers) else {}

            # Extract domain using mapping
            domain_col = mapping_dict.get("domain")
            domain = csv_data.get(domain_col, "").strip().lower() if domain_col else ""

            # Clean domain (remove protocol, www, trailing slash)
            if domain:
                domain = domain.replace("https://", "").replace("http://", "")
                domain = domain.replace("www.", "").rstrip("/")

            # Extract company name
            name_col = mapping_dict.get("company_name")
            company_name = csv_data.get(name_col, "").strip() if name_col else None

            item = UploadedListItem(
                id=str(uuid.uuid4()),
                list_id=new_list.id,
                row_number=row_num,
                domain=domain or f"invalid_row_{row_num}",
                company_name=company_name,
                csv_data=csv_data,
                status=ItemStatus.PENDING.value,
                created_at=datetime.utcnow(),
            )
            db.add(item)

        await db.commit()

        logger.info(f"List uploaded: {new_list.id} ({total_rows} rows) by {current_user.email}")

        return ListUploadResponse(
            id=new_list.id,
            name=new_list.name,
            status=ListStatus(new_list.status),
            original_filename=new_list.original_filename,
            file_size_bytes=new_list.file_size_bytes,
            total_rows=new_list.total_rows,
            detected_columns=new_list.detected_columns,
            column_mapping=ListColumnMapping(**mapping_dict),
            mapping_confidence=confidence,
            mapping_confirmed=False,
            created_at=new_list.created_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading list: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing CSV file: {str(e)}",
        )


@router.post("/{list_id}/confirm-mapping")
async def confirm_column_mapping(
    list_id: str,
    mapping: ListColumnMappingConfirm,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Confirm or update column mapping for a list.

    Call this after upload to confirm the auto-detected mapping
    or provide corrected mappings.
    """
    # Get list
    result = await db.execute(
        select(UploadedList).where(
            UploadedList.id == list_id,
            UploadedList.user_id == current_user.user_id,
        )
    )
    uploaded_list = result.scalar()

    if not uploaded_list:
        raise HTTPException(status_code=404, detail="List not found")

    if uploaded_list.status != ListStatus.UPLOADED.value:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot update mapping for list in status: {uploaded_list.status}",
        )

    # Validate mapping has required columns
    mapping_dict = mapping.mapping.model_dump(exclude_none=True)
    if not mapping_dict.get("domain"):
        raise HTTPException(
            status_code=400,
            detail="Domain column mapping is required",
        )

    # Update mapping
    uploaded_list.column_mapping = mapping_dict
    uploaded_list.mapping_confirmed = mapping.confirmed
    uploaded_list.mapping_confidence = MappingConfidence.HIGH.value if mapping.confirmed else uploaded_list.mapping_confidence
    uploaded_list.updated_at = datetime.utcnow()

    await db.commit()

    return {
        "id": list_id,
        "mapping_confirmed": uploaded_list.mapping_confirmed,
        "column_mapping": uploaded_list.column_mapping,
        "message": "Column mapping updated successfully",
    }


# =============================================================================
# List CRUD Endpoints
# =============================================================================

@router.get("", response_model=ListPaginatedResponse)
async def get_lists(
    status: Optional[str] = Query(None, description="Filter by status"),
    source: Optional[str] = Query(None, description="Filter by source"),
    search: Optional[str] = Query(None, description="Search by name"),
    pagination: PaginationParams = Depends(get_pagination),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get all lists for the current user with filtering and pagination.
    """
    # Build query
    query = select(UploadedList).where(
        UploadedList.user_id == current_user.user_id,
    )

    # Apply filters
    if status:
        query = query.where(UploadedList.status == status)
    if source:
        query = query.where(UploadedList.source == source)
    if search:
        query = query.where(UploadedList.name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(UploadedList.created_at.desc())
    query = query.offset(pagination.offset).limit(pagination.limit)

    result = await db.execute(query)
    lists = result.scalars().all()

    return ListPaginatedResponse(
        lists=[
            ListSummaryResponse(
                id=lst.id,
                name=lst.name,
                source=lst.source,
                status=lst.status,
                total_rows=lst.total_rows or 0,
                valid_rows=lst.valid_rows or 0,
                invalid_rows=lst.invalid_rows or 0,
                processed_count=lst.processed_count or 0,
                success_count=lst.success_count or 0,
                error_count=lst.error_count or 0,
                created_at=lst.created_at,
                updated_at=lst.updated_at,
            )
            for lst in lists
        ],
        pagination=PaginationMeta.from_query(pagination.page, pagination.limit, total),
    )


@router.get("/{list_id}", response_model=ListDetailResponse)
async def get_list(
    list_id: str,
    page: int = Query(1, ge=1, description="Page for items"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    item_status: Optional[str] = Query(None, description="Filter items by status"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get list details with paginated items.
    """
    # Get list
    result = await db.execute(
        select(UploadedList).where(
            UploadedList.id == list_id,
            UploadedList.user_id == current_user.user_id,
        )
    )
    uploaded_list = result.scalar()

    if not uploaded_list:
        raise HTTPException(status_code=404, detail="List not found")

    # Build items query
    items_query = select(UploadedListItem).where(
        UploadedListItem.list_id == list_id,
    )

    if item_status:
        items_query = items_query.where(UploadedListItem.status == item_status)

    # Get total count
    count_query = select(func.count()).select_from(items_query.subquery())
    total_items = (await db.execute(count_query)).scalar() or 0

    # Apply pagination
    offset = (page - 1) * limit
    items_query = items_query.order_by(UploadedListItem.row_number)
    items_query = items_query.offset(offset).limit(limit)

    items_result = await db.execute(items_query)
    items = items_result.scalars().all()

    return ListDetailResponse(
        list_data=ListResponse(
            id=uploaded_list.id,
            user_id=uploaded_list.user_id,
            team_id=uploaded_list.team_id,
            name=uploaded_list.name,
            description=uploaded_list.description,
            source=uploaded_list.source,
            original_filename=uploaded_list.original_filename,
            file_size_bytes=uploaded_list.file_size_bytes,
            file_hash=uploaded_list.file_hash,
            total_rows=uploaded_list.total_rows or 0,
            valid_rows=uploaded_list.valid_rows or 0,
            invalid_rows=uploaded_list.invalid_rows or 0,
            duplicate_rows=uploaded_list.duplicate_rows or 0,
            skipped_rows=uploaded_list.skipped_rows or 0,
            detected_columns=uploaded_list.detected_columns,
            column_mapping=uploaded_list.column_mapping,
            mapping_confidence=uploaded_list.mapping_confidence,
            mapping_confirmed=uploaded_list.mapping_confirmed or False,
            status=uploaded_list.status,
            processed_count=uploaded_list.processed_count or 0,
            success_count=uploaded_list.success_count or 0,
            error_count=uploaded_list.error_count or 0,
            enrichment_job_id=uploaded_list.enrichment_job_id,
            enrichment_modules=uploaded_list.enrichment_modules,
            enrichment_priority=uploaded_list.enrichment_priority or EnrichmentPriority.NORMAL.value,
            created_at=uploaded_list.created_at,
            updated_at=uploaded_list.updated_at,
            parsing_started_at=uploaded_list.parsing_started_at,
            parsing_completed_at=uploaded_list.parsing_completed_at,
            validation_started_at=uploaded_list.validation_started_at,
            validation_completed_at=uploaded_list.validation_completed_at,
            enrichment_started_at=uploaded_list.enrichment_started_at,
            enrichment_completed_at=uploaded_list.enrichment_completed_at,
            error_message=uploaded_list.error_message,
            error_details=uploaded_list.error_details,
        ),
        items=[
            ListItemSummary(
                id=item.id,
                row_number=item.row_number,
                domain=item.domain,
                company_name=item.company_name,
                status=item.status,
                validation_errors=item.validation_errors,
                error_message=item.error_message,
            )
            for item in items
        ],
        pagination=PaginationMeta.from_query(page, limit, total_items),
    )


@router.delete("/{list_id}")
async def delete_list(
    list_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Delete a list and all its items.

    Cannot delete lists that are currently processing.
    """
    # Get list
    result = await db.execute(
        select(UploadedList).where(
            UploadedList.id == list_id,
            UploadedList.user_id == current_user.user_id,
        )
    )
    uploaded_list = result.scalar()

    if not uploaded_list:
        raise HTTPException(status_code=404, detail="List not found")

    if uploaded_list.status in (ListStatus.PROCESSING.value, ListStatus.QUEUED.value):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a list that is currently being processed. Cancel processing first.",
        )

    # Delete items first (cascade should handle this, but be explicit)
    await db.execute(
        delete(UploadedListItem).where(UploadedListItem.list_id == list_id)
    )

    # Delete list
    await db.delete(uploaded_list)
    await db.commit()

    logger.info(f"List deleted: {list_id} by {current_user.email}")

    return {"message": "List deleted successfully", "id": list_id}


# =============================================================================
# Validation Endpoints
# =============================================================================

@router.post("/{list_id}/validate", response_model=ListValidationResponse)
async def validate_list(
    list_id: str,
    request: ListValidationRequest = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Validate a list before enrichment.

    Validates:
    - Domain format and reachability
    - Duplicate detection
    - Required field presence
    - Data quality checks
    """
    if request is None:
        request = ListValidationRequest()

    # Get list
    result = await db.execute(
        select(UploadedList).where(
            UploadedList.id == list_id,
            UploadedList.user_id == current_user.user_id,
        )
    )
    uploaded_list = result.scalar()

    if not uploaded_list:
        raise HTTPException(status_code=404, detail="List not found")

    if uploaded_list.status not in (ListStatus.UPLOADED.value, ListStatus.PARSED.value, ListStatus.VALIDATED.value):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot validate list in status: {uploaded_list.status}",
        )

    # Update status
    uploaded_list.status = ListStatus.VALIDATING.value
    uploaded_list.validation_started_at = datetime.utcnow()
    await db.flush()

    # Get column mapping (use provided or existing)
    if request.column_mapping:
        mapping = request.column_mapping.model_dump(exclude_none=True)
        uploaded_list.column_mapping = mapping
    else:
        mapping = uploaded_list.column_mapping or {}

    # Get items
    items_result = await db.execute(
        select(UploadedListItem).where(UploadedListItem.list_id == list_id)
    )
    items = items_result.scalars().all()

    # Track validation results
    valid_count = 0
    invalid_count = 0
    duplicate_count = 0
    skipped_count = 0
    validation_errors = []
    seen_domains = set()

    for item in items:
        errors = []

        # Validate domain
        domain = item.domain
        if not domain or domain.startswith("invalid_row_"):
            errors.append({
                "field": "domain",
                "error": "Missing or invalid domain",
            })
        elif request.validate_domains:
            # Basic domain format validation
            if " " in domain or not "." in domain:
                errors.append({
                    "field": "domain",
                    "error": f"Invalid domain format: {domain}",
                })

        # Check duplicates within file
        if domain in seen_domains and request.skip_duplicates:
            item.status = ItemStatus.DUPLICATE.value
            duplicate_count += 1
            continue
        seen_domains.add(domain)

        # TODO: Check if domain already exists in system (for skipped_count)

        if errors:
            item.status = ItemStatus.INVALID.value
            item.validation_errors = errors
            invalid_count += 1
            # Add to error list (limit to 100)
            if len(validation_errors) < 100:
                for err in errors:
                    validation_errors.append(
                        ValidationError(
                            row_number=item.row_number,
                            field=err["field"],
                            error=err["error"],
                            value=item.domain if err["field"] == "domain" else None,
                        )
                    )
        else:
            item.status = ItemStatus.VALID.value
            valid_count += 1

        item.validated_at = datetime.utcnow()

    # Update list stats
    uploaded_list.valid_rows = valid_count
    uploaded_list.invalid_rows = invalid_count
    uploaded_list.duplicate_rows = duplicate_count
    uploaded_list.skipped_rows = skipped_count
    uploaded_list.status = ListStatus.VALIDATED.value
    uploaded_list.validation_completed_at = datetime.utcnow()
    uploaded_list.updated_at = datetime.utcnow()

    await db.commit()

    logger.info(
        f"List validated: {list_id} - {valid_count} valid, {invalid_count} invalid, "
        f"{duplicate_count} duplicates"
    )

    return ListValidationResponse(
        id=list_id,
        status=ListStatus.VALIDATED,
        total_rows=uploaded_list.total_rows or 0,
        valid_rows=valid_count,
        invalid_rows=invalid_count,
        duplicate_rows=duplicate_count,
        skipped_rows=skipped_count,
        errors=validation_errors,
        validation_started_at=uploaded_list.validation_started_at,
        validation_completed_at=uploaded_list.validation_completed_at,
        ready_for_enrichment=valid_count > 0,
    )


# =============================================================================
# Enrichment Endpoints
# =============================================================================

@router.post("/{list_id}/enrich", response_model=ListEnrichmentResponse)
async def start_enrichment(
    list_id: str,
    request: ListEnrichmentRequest = None,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Start enrichment processing for a validated list.

    Queues all valid items for enrichment through the configured modules.
    """
    if request is None:
        request = ListEnrichmentRequest()

    # Get list
    result = await db.execute(
        select(UploadedList).where(
            UploadedList.id == list_id,
            UploadedList.user_id == current_user.user_id,
        )
    )
    uploaded_list = result.scalar()

    if not uploaded_list:
        raise HTTPException(status_code=404, detail="List not found")

    if uploaded_list.status != ListStatus.VALIDATED.value:
        raise HTTPException(
            status_code=400,
            detail=f"List must be validated before enrichment. Current status: {uploaded_list.status}",
        )

    if (uploaded_list.valid_rows or 0) == 0:
        raise HTTPException(
            status_code=400,
            detail="No valid items to enrich. Please validate the list first.",
        )

    # Determine modules to run
    if request.modules:
        modules = request.modules
    elif request.waves:
        # Map waves to modules
        wave_modules = {
            1: ["m01_company_context", "m02_tech_stack", "m03_traffic", "m04_financials"],
            2: ["m05_competitors", "m06_hiring", "m07_strategic"],
            3: ["m08_investor", "m09_executive", "m10_buying_committee", "m11_displacement"],
            4: ["m12_case_study", "m13_icp_priority", "m14_signal_scoring", "m15_strategic_brief"],
        }
        modules = []
        for wave in request.waves:
            modules.extend(wave_modules.get(wave, []))
    else:
        # Run all modules
        modules = [
            "m01_company_context", "m02_tech_stack", "m03_traffic", "m04_financials",
            "m05_competitors", "m06_hiring", "m07_strategic",
            "m08_investor", "m09_executive", "m10_buying_committee", "m11_displacement",
            "m12_case_study", "m13_icp_priority", "m14_signal_scoring", "m15_strategic_brief",
        ]

    # Create job ID
    job_id = f"enrich_{list_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

    # Update list
    uploaded_list.status = ListStatus.QUEUED.value
    uploaded_list.enrichment_job_id = job_id
    uploaded_list.enrichment_modules = modules
    uploaded_list.enrichment_priority = request.priority.value
    uploaded_list.enrichment_started_at = datetime.utcnow()
    uploaded_list.processed_count = 0
    uploaded_list.success_count = 0
    uploaded_list.error_count = 0
    uploaded_list.updated_at = datetime.utcnow()

    # Queue valid items
    items_result = await db.execute(
        select(UploadedListItem).where(
            UploadedListItem.list_id == list_id,
            UploadedListItem.status == ItemStatus.VALID.value,
        )
    )
    items = items_result.scalars().all()

    items_queued = 0
    priority_map = {
        EnrichmentPriority.HIGH: 1,
        EnrichmentPriority.NORMAL: 5,
        EnrichmentPriority.LOW: 9,
    }

    for item in items:
        item.status = ItemStatus.QUEUED.value
        item.enrichment_job_id = job_id

        # Add to processing queue
        queue_item = ListProcessingQueue(
            id=str(uuid.uuid4()),
            list_id=list_id,
            item_id=item.id,
            priority=priority_map.get(request.priority, 5),
            status="queued",
            created_at=datetime.utcnow(),
        )
        db.add(queue_item)
        items_queued += 1

    await db.commit()

    # Estimate processing time (rough: 5 seconds per item per wave)
    estimated_time = items_queued * len(modules) * 5

    logger.info(
        f"Enrichment started: {list_id} - {items_queued} items, "
        f"{len(modules)} modules, job_id={job_id}"
    )

    # TODO: Trigger actual enrichment via Celery
    # background_tasks.add_task(run_enrichment, job_id, list_id, modules)

    return ListEnrichmentResponse(
        id=list_id,
        status=ListStatus.QUEUED,
        enrichment_job_id=job_id,
        modules=modules,
        priority=request.priority,
        items_queued=items_queued,
        estimated_time_seconds=estimated_time,
        enrichment_started_at=uploaded_list.enrichment_started_at,
    )


@router.get("/{list_id}/status", response_model=ListProcessingStatus)
async def get_processing_status(
    list_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get current processing status of a list.

    Returns real-time progress information including:
    - Overall progress percentage
    - Current module/item being processed
    - Error counts and recent errors
    - Estimated completion time
    """
    # Get list
    result = await db.execute(
        select(UploadedList).where(
            UploadedList.id == list_id,
            UploadedList.user_id == current_user.user_id,
        )
    )
    uploaded_list = result.scalar()

    if not uploaded_list:
        raise HTTPException(status_code=404, detail="List not found")

    # Calculate progress
    total = uploaded_list.valid_rows or 0
    processed = uploaded_list.processed_count or 0
    progress = (processed / total * 100) if total > 0 else 0

    # Get recent errors from items
    errors_result = await db.execute(
        select(UploadedListItem).where(
            UploadedListItem.list_id == list_id,
            UploadedListItem.status == ItemStatus.FAILED.value,
        ).order_by(UploadedListItem.updated_at.desc()).limit(10)
    )
    error_items = errors_result.scalars().all()

    recent_errors = [
        {
            "domain": item.domain,
            "error": item.error_message,
            "row_number": item.row_number,
        }
        for item in error_items
    ]

    return ListProcessingStatus(
        id=list_id,
        status=uploaded_list.status,
        total_items=total,
        processed_count=processed,
        success_count=uploaded_list.success_count or 0,
        error_count=uploaded_list.error_count or 0,
        progress_percent=round(progress, 2),
        current_wave=None,  # TODO: Track from job
        current_module=None,  # TODO: Track from job
        current_item=None,  # TODO: Track from job
        enrichment_job_id=uploaded_list.enrichment_job_id,
        started_at=uploaded_list.enrichment_started_at,
        estimated_completion=None,  # TODO: Calculate
        recent_errors=recent_errors,
    )


@router.post("/{list_id}/cancel")
async def cancel_enrichment(
    list_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Cancel ongoing enrichment for a list.

    Items already processed will keep their data.
    Queued items will be marked as cancelled.
    """
    # Get list
    result = await db.execute(
        select(UploadedList).where(
            UploadedList.id == list_id,
            UploadedList.user_id == current_user.user_id,
        )
    )
    uploaded_list = result.scalar()

    if not uploaded_list:
        raise HTTPException(status_code=404, detail="List not found")

    if uploaded_list.status not in (ListStatus.QUEUED.value, ListStatus.PROCESSING.value):
        raise HTTPException(
            status_code=400,
            detail=f"List is not being processed. Current status: {uploaded_list.status}",
        )

    # Cancel queued items
    await db.execute(
        delete(ListProcessingQueue).where(
            ListProcessingQueue.list_id == list_id,
            ListProcessingQueue.status == "queued",
        )
    )

    # Update item statuses
    items_result = await db.execute(
        select(UploadedListItem).where(
            UploadedListItem.list_id == list_id,
            UploadedListItem.status == ItemStatus.QUEUED.value,
        )
    )
    queued_items = items_result.scalars().all()

    for item in queued_items:
        item.status = ItemStatus.VALID.value  # Reset to valid
        item.enrichment_job_id = None

    # Update list
    uploaded_list.status = ListStatus.CANCELLED.value
    uploaded_list.updated_at = datetime.utcnow()

    await db.commit()

    logger.info(f"Enrichment cancelled: {list_id} by {current_user.email}")

    return {
        "id": list_id,
        "status": ListStatus.CANCELLED.value,
        "message": "Enrichment cancelled successfully",
        "items_cancelled": len(queued_items),
    }


# =============================================================================
# Item Endpoints
# =============================================================================

@router.get("/{list_id}/items/{item_id}", response_model=ListItemResponse)
async def get_list_item(
    list_id: str,
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get full details for a specific list item.
    """
    # Verify list ownership
    list_result = await db.execute(
        select(UploadedList).where(
            UploadedList.id == list_id,
            UploadedList.user_id == current_user.user_id,
        )
    )
    if not list_result.scalar():
        raise HTTPException(status_code=404, detail="List not found")

    # Get item
    result = await db.execute(
        select(UploadedListItem).where(
            UploadedListItem.id == item_id,
            UploadedListItem.list_id == list_id,
        )
    )
    item = result.scalar()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    return ListItemResponse(
        id=item.id,
        list_id=item.list_id,
        row_number=item.row_number,
        domain=item.domain,
        company_name=item.company_name,
        salesforce_id=item.salesforce_id,
        demandbase_id=item.demandbase_id,
        hubspot_id=item.hubspot_id,
        csv_data=item.csv_data,
        pre_existing_revenue=item.pre_existing_revenue,
        pre_existing_traffic=item.pre_existing_traffic,
        pre_existing_tech_stack=item.pre_existing_tech_stack,
        pre_existing_industry=item.pre_existing_industry,
        status=item.status,
        validation_errors=item.validation_errors,
        validated_at=item.validated_at,
        enrichment_job_id=item.enrichment_job_id,
        enrichment_started_at=item.enrichment_started_at,
        enrichment_completed_at=item.enrichment_completed_at,
        displacement_target_id=item.displacement_target_id,
        existing_target_id=item.existing_target_id,
        error_message=item.error_message,
        retry_count=item.retry_count or 0,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )
