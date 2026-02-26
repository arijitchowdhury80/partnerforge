"""
PartnerForge Enrichment Orchestrator

Orchestrates the 4-wave enrichment process for domains.

Wave Architecture:
- Wave 1 (Foundation): M01-M04 - Company context, tech stack, traffic, financials
- Wave 2 (Competitive): M05-M07 - Competitors, hiring, strategic
- Wave 3 (Buying Signals): M08-M11 - Investor, executive, buying committee, displacement
- Wave 4 (Synthesis): M12-M15 - Case study, ICP priority, signal scoring, brief

Each wave runs modules in parallel, with waves running sequentially
(wave N+1 depends on wave N completion).

CRITICAL: All module results must have source_url and source_date.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Set
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import logging
import uuid

from ..models.platform import JobExecution
from ..config import get_settings, ENRICHMENT_WAVES

logger = logging.getLogger(__name__)
settings = get_settings()


# Module definitions with metadata
MODULE_DEFINITIONS = {
    "m01_company_context": {
        "wave": 1,
        "name": "Company Context",
        "description": "Basic company information and context",
        "providers": ["builtwith", "websearch"],
        "timeout_seconds": 60,
    },
    "m02_tech_stack": {
        "wave": 1,
        "name": "Tech Stack Analysis",
        "description": "Technology stack including search provider",
        "providers": ["builtwith"],
        "timeout_seconds": 45,
    },
    "m03_traffic": {
        "wave": 1,
        "name": "Traffic Intelligence",
        "description": "Traffic metrics and sources",
        "providers": ["similarweb"],
        "timeout_seconds": 60,
    },
    "m04_financials": {
        "wave": 1,
        "name": "Financial Data",
        "description": "Public financial information",
        "providers": ["yahoo_finance"],
        "timeout_seconds": 45,
    },
    "m05_competitors": {
        "wave": 2,
        "name": "Competitor Analysis",
        "description": "Competitor identification and comparison",
        "providers": ["similarweb", "builtwith"],
        "timeout_seconds": 90,
        "depends_on": ["m03_traffic"],
    },
    "m06_hiring": {
        "wave": 2,
        "name": "Hiring Signals",
        "description": "Job postings and hiring patterns",
        "providers": ["websearch"],
        "timeout_seconds": 60,
    },
    "m07_strategic": {
        "wave": 2,
        "name": "Strategic Intelligence",
        "description": "Strategic themes and initiatives",
        "providers": ["websearch"],
        "timeout_seconds": 60,
        "depends_on": ["m01_company_context"],
    },
    "m08_investor": {
        "wave": 3,
        "name": "Investor Intelligence",
        "description": "Investor calls and SEC filings",
        "providers": ["websearch", "yahoo_finance"],
        "timeout_seconds": 120,
        "depends_on": ["m04_financials"],
    },
    "m09_executive": {
        "wave": 3,
        "name": "Executive Intelligence",
        "description": "Executive quotes and themes",
        "providers": ["websearch"],
        "timeout_seconds": 90,
        "depends_on": ["m01_company_context"],
    },
    "m10_buying_committee": {
        "wave": 3,
        "name": "Buying Committee",
        "description": "Key decision makers",
        "providers": ["websearch"],
        "timeout_seconds": 60,
        "depends_on": ["m09_executive"],
    },
    "m11_displacement": {
        "wave": 3,
        "name": "Displacement Analysis",
        "description": "Current search provider and pain points",
        "providers": ["builtwith"],
        "timeout_seconds": 45,
        "depends_on": ["m02_tech_stack"],
    },
    "m12_case_study": {
        "wave": 4,
        "name": "Case Study Matching",
        "description": "Relevant Algolia case studies",
        "providers": [],
        "timeout_seconds": 30,
        "depends_on": ["m01_company_context", "m02_tech_stack"],
    },
    "m13_icp_priority": {
        "wave": 4,
        "name": "ICP Priority Scoring",
        "description": "ICP fit score calculation",
        "providers": [],
        "timeout_seconds": 30,
        "depends_on": ["m03_traffic", "m04_financials", "m06_hiring"],
    },
    "m14_signal_scoring": {
        "wave": 4,
        "name": "Signal Scoring",
        "description": "Buying signal score",
        "providers": [],
        "timeout_seconds": 30,
        "depends_on": ["m08_investor", "m09_executive", "m06_hiring"],
    },
    "m15_strategic_brief": {
        "wave": 4,
        "name": "Strategic Brief",
        "description": "Synthesized strategic brief",
        "providers": [],
        "timeout_seconds": 60,
        "depends_on": ["m12_case_study", "m13_icp_priority", "m14_signal_scoring"],
    },
}


class EnrichmentOrchestrator:
    """
    Orchestrates multi-wave domain enrichment.

    This service:
    - Manages job execution lifecycle
    - Coordinates wave execution
    - Runs modules in parallel within waves
    - Handles checkpointing for resumption
    - Tracks progress and status

    Methods:
        enrich_domain: Start enrichment for a domain
        execute_wave: Execute a single wave
        get_job_status: Get status of a job
        cancel_job: Cancel a running job
        resume_job: Resume a paused/failed job
    """

    def __init__(self, session: AsyncSession):
        """
        Initialize the orchestrator.

        Args:
            session: Async database session
        """
        self.session = session
        self._active_jobs: Dict[str, asyncio.Task] = {}
        self._module_executors: Dict[str, Any] = {}  # Module executor functions

    def register_module_executor(
        self,
        module_type: str,
        executor: Any,
    ) -> None:
        """
        Register a module executor function.

        Args:
            module_type: Module identifier (e.g., "m01_company_context")
            executor: Async function(domain, context) -> Dict
        """
        self._module_executors[module_type] = executor
        logger.debug(f"Registered executor for {module_type}")

    async def enrich_domain(
        self,
        domain: str,
        modules: Optional[List[str]] = None,
        waves: Optional[List[int]] = None,
        force: bool = False,
        triggered_by: Optional[str] = None,
        trigger_source: str = "api",
    ) -> JobExecution:
        """
        Start enrichment for a domain.

        Args:
            domain: Target domain to enrich
            modules: Specific modules to run (None = all)
            waves: Specific waves to run (None = all)
            force: Force re-enrichment even if fresh
            triggered_by: User email or "system"
            trigger_source: "api", "ui", "scheduled", "webhook"

        Returns:
            JobExecution: The created job record
        """
        # Determine job type
        if modules:
            job_type = "module_enrichment"
        elif waves:
            job_type = "wave_enrichment"
        else:
            job_type = "full_enrichment"

        # Determine modules to run
        target_modules = self._resolve_modules(modules, waves)
        total_steps = len(target_modules)

        # Create job record
        job = JobExecution(
            id=str(uuid.uuid4()),
            job_type=job_type,
            domain=domain,
            modules=target_modules,
            waves=waves or [1, 2, 3, 4],
            force=force,
            status="queued",
            total_steps=total_steps,
            completed_steps=0,
            current_step=None,
            modules_completed=[],
            modules_failed=[],
            triggered_by=triggered_by,
            trigger_source=trigger_source,
            checkpoint={},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.session.add(job)
        await self.session.flush()

        logger.info(
            f"Created enrichment job {job.id} for {domain} "
            f"({total_steps} modules, force={force})"
        )

        return job

    async def execute_job(self, job_id: str) -> JobExecution:
        """
        Execute an enrichment job.

        This is the main execution entry point. It:
        1. Updates job status to running
        2. Executes waves in sequence
        3. Updates progress and checkpoints
        4. Handles failures and cancellation

        Args:
            job_id: ID of the job to execute

        Returns:
            JobExecution: The completed/failed job
        """
        # Get job
        query = select(JobExecution).where(JobExecution.id == job_id)
        result = await self.session.execute(query)
        job = result.scalar_one_or_none()

        if job is None:
            raise ValueError(f"Job not found: {job_id}")

        if job.status not in ["queued", "running"]:
            raise ValueError(f"Job cannot be executed: status={job.status}")

        # Update status
        job.status = "running"
        job.started_at = datetime.utcnow()
        await self.session.flush()

        try:
            # Get waves to execute
            waves_to_run = job.waves or [1, 2, 3, 4]
            context: Dict[str, Any] = job.checkpoint or {}

            for wave_num in sorted(waves_to_run):
                # Check for cancellation
                if job.status == "cancelled":
                    break

                # Execute wave
                job.current_step = f"wave_{wave_num}"
                await self.session.flush()

                wave_result = await self.execute_wave(
                    wave_number=wave_num,
                    domain=job.domain,
                    context=context,
                    target_modules=job.modules,
                    job=job,
                )

                # Update context with wave results
                context.update(wave_result)
                job.checkpoint = context

            # Mark completed
            job.status = "completed"
            job.completed_at = datetime.utcnow()
            job.duration_seconds = (
                job.completed_at - job.started_at
            ).total_seconds()

        except asyncio.CancelledError:
            job.status = "cancelled"
            job.error_message = "Job was cancelled"
            logger.info(f"Job {job_id} was cancelled")

        except Exception as e:
            job.status = "failed"
            job.error_message = str(e)
            logger.error(f"Job {job_id} failed: {e}")

        finally:
            job.updated_at = datetime.utcnow()
            await self.session.flush()

        return job

    async def execute_wave(
        self,
        wave_number: int,
        domain: str,
        context: Dict[str, Any],
        target_modules: Optional[List[str]] = None,
        job: Optional[JobExecution] = None,
    ) -> Dict[str, Any]:
        """
        Execute a single wave of enrichment.

        Runs all modules in the wave in parallel (within configured limits).

        Args:
            wave_number: Wave number (1-4)
            domain: Target domain
            context: Context from previous waves
            target_modules: Optional filter for specific modules
            job: Optional job for progress tracking

        Returns:
            Dict with module results
        """
        wave_config = self._get_wave_config(wave_number)
        modules_in_wave = wave_config["modules"]

        # Filter to target modules if specified
        if target_modules:
            modules_in_wave = [m for m in modules_in_wave if m in target_modules]

        if not modules_in_wave:
            logger.debug(f"No modules to run in wave {wave_number}")
            return {}

        logger.info(
            f"Executing wave {wave_number} for {domain}: {modules_in_wave}"
        )

        # Create tasks for parallel execution
        tasks = []
        for module_type in modules_in_wave:
            # Check dependencies
            module_def = MODULE_DEFINITIONS.get(module_type, {})
            deps = module_def.get("depends_on", [])

            # Verify dependencies are met
            missing_deps = [d for d in deps if d not in context]
            if missing_deps:
                logger.warning(
                    f"Skipping {module_type}: missing deps {missing_deps}"
                )
                continue

            task = self._execute_module(
                module_type=module_type,
                domain=domain,
                context=context,
                timeout=module_def.get("timeout_seconds", settings.ENRICHMENT_TIMEOUT_SECONDS),
            )
            tasks.append((module_type, task))

        # Execute in parallel
        results = {}
        completed = []
        failed = []

        for module_type, task in tasks:
            try:
                result = await task
                results[module_type] = result
                completed.append(module_type)

                # Update job progress
                if job:
                    job.modules_completed = (job.modules_completed or []) + [module_type]
                    job.completed_steps = len(job.modules_completed)
                    await self.session.flush()

            except asyncio.TimeoutError:
                logger.error(f"Module {module_type} timed out for {domain}")
                failed.append(module_type)
                if job:
                    job.modules_failed = (job.modules_failed or []) + [module_type]

            except Exception as e:
                logger.error(f"Module {module_type} failed for {domain}: {e}")
                failed.append(module_type)
                if job:
                    job.modules_failed = (job.modules_failed or []) + [module_type]

        logger.info(
            f"Wave {wave_number} complete for {domain}: "
            f"{len(completed)} succeeded, {len(failed)} failed"
        )

        return results

    async def _execute_module(
        self,
        module_type: str,
        domain: str,
        context: Dict[str, Any],
        timeout: int,
    ) -> Dict[str, Any]:
        """
        Execute a single module with timeout.

        Args:
            module_type: Module identifier
            domain: Target domain
            context: Context from previous modules/waves
            timeout: Timeout in seconds

        Returns:
            Module result dict
        """
        executor = self._module_executors.get(module_type)

        if executor is None:
            # Return placeholder if no executor registered
            logger.warning(f"No executor for {module_type}, returning placeholder")
            return {
                "module": module_type,
                "status": "not_implemented",
                "source_url": f"https://partnerforge.app/placeholder/{module_type}",
                "source_date": datetime.utcnow().isoformat(),
            }

        # Execute with timeout
        result = await asyncio.wait_for(
            executor(domain, context),
            timeout=timeout,
        )

        return result

    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the status of a job.

        Args:
            job_id: Job ID

        Returns:
            Dict with job status or None if not found
        """
        query = select(JobExecution).where(JobExecution.id == job_id)
        result = await self.session.execute(query)
        job = result.scalar_one_or_none()

        if job is None:
            return None

        return {
            "id": job.id,
            "job_type": job.job_type,
            "domain": job.domain,
            "status": job.status,
            "progress": {
                "total_steps": job.total_steps,
                "completed_steps": job.completed_steps,
                "current_step": job.current_step,
                "percentage": (
                    (job.completed_steps / job.total_steps * 100)
                    if job.total_steps else 0
                ),
            },
            "modules_completed": job.modules_completed,
            "modules_failed": job.modules_failed,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "duration_seconds": job.duration_seconds,
            "error_message": job.error_message,
            "triggered_by": job.triggered_by,
        }

    async def cancel_job(self, job_id: str) -> bool:
        """
        Cancel a running job.

        Args:
            job_id: Job ID to cancel

        Returns:
            True if cancelled, False if not found or not cancellable
        """
        query = select(JobExecution).where(JobExecution.id == job_id)
        result = await self.session.execute(query)
        job = result.scalar_one_or_none()

        if job is None:
            return False

        if job.status not in ["queued", "running"]:
            return False

        job.status = "cancelled"
        job.error_message = "Cancelled by user"
        job.updated_at = datetime.utcnow()

        # Cancel the task if running
        task = self._active_jobs.get(job_id)
        if task and not task.done():
            task.cancel()

        await self.session.flush()

        logger.info(f"Cancelled job {job_id}")
        return True

    async def get_recent_jobs(
        self,
        domain: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Get recent jobs.

        Args:
            domain: Filter by domain
            status: Filter by status
            limit: Maximum jobs to return

        Returns:
            List of job status dicts
        """
        from sqlalchemy import desc

        conditions = []
        if domain:
            conditions.append(JobExecution.domain == domain)
        if status:
            conditions.append(JobExecution.status == status)

        if conditions:
            query = (
                select(JobExecution)
                .where(*conditions)
                .order_by(desc(JobExecution.created_at))
                .limit(limit)
            )
        else:
            query = (
                select(JobExecution)
                .order_by(desc(JobExecution.created_at))
                .limit(limit)
            )

        result = await self.session.execute(query)
        jobs = result.scalars().all()

        return [
            {
                "id": j.id,
                "job_type": j.job_type,
                "domain": j.domain,
                "status": j.status,
                "progress_pct": (
                    (j.completed_steps / j.total_steps * 100)
                    if j.total_steps else 0
                ),
                "created_at": j.created_at.isoformat(),
                "triggered_by": j.triggered_by,
            }
            for j in jobs
        ]

    # =========================================================================
    # Private Helper Methods
    # =========================================================================

    def _resolve_modules(
        self,
        modules: Optional[List[str]],
        waves: Optional[List[int]],
    ) -> List[str]:
        """Resolve which modules to run based on parameters."""
        if modules:
            return modules

        if waves:
            result = []
            for wave_num in waves:
                wave_config = self._get_wave_config(wave_num)
                result.extend(wave_config.get("modules", []))
            return result

        # All modules
        return list(MODULE_DEFINITIONS.keys())

    def _get_wave_config(self, wave_number: int) -> Dict[str, Any]:
        """Get configuration for a specific wave."""
        wave_names = {
            1: "wave_1_foundation",
            2: "wave_2_competitive",
            3: "wave_3_buying_signals",
            4: "wave_4_synthesis",
        }

        wave_name = wave_names.get(wave_number)
        if wave_name and wave_name in ENRICHMENT_WAVES:
            return ENRICHMENT_WAVES[wave_name]

        # Fallback: derive from module definitions
        modules = [
            m for m, d in MODULE_DEFINITIONS.items()
            if d.get("wave") == wave_number
        ]

        return {
            "parallel": True,
            "modules": modules,
            "workers": 4,
            "timeout": 120,
        }

    def _get_modules_for_wave(self, wave_number: int) -> List[str]:
        """Get all modules in a specific wave."""
        return [
            module_type
            for module_type, definition in MODULE_DEFINITIONS.items()
            if definition.get("wave") == wave_number
        ]


# Utility functions for external use
def get_module_info(module_type: str) -> Optional[Dict[str, Any]]:
    """Get metadata for a module."""
    return MODULE_DEFINITIONS.get(module_type)


def get_all_modules() -> List[str]:
    """Get list of all module identifiers."""
    return list(MODULE_DEFINITIONS.keys())


def get_modules_by_wave(wave_number: int) -> List[str]:
    """Get modules in a specific wave."""
    return [
        m for m, d in MODULE_DEFINITIONS.items()
        if d.get("wave") == wave_number
    ]
