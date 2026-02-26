"""
Progress Tracking Module
========================

Real-time progress tracking for enrichment orchestration.

Provides:
- Module-level status tracking (pending/running/completed/failed)
- Estimated time remaining calculations
- WebSocket/SSE support for live updates
- Progress persistence for recovery

References:
- docs/PARALLEL_EXECUTION_ARCHITECTURE.md
- docs/ORCHESTRATOR_DESIGN.md
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional, Set

from pipeline.modules.base import ModuleStatus

logger = logging.getLogger(__name__)


class ProgressStatus(str, Enum):
    """Overall job progress status."""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"
    CANCELLED = "cancelled"


@dataclass
class ModuleProgress:
    """Progress state for a single module."""

    module_id: str
    status: ModuleStatus = ModuleStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: float = 0.0
    progress_percent: int = 0
    error_message: Optional[str] = None
    retry_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "module_id": self.module_id,
            "status": self.status.value,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_ms": self.duration_ms,
            "progress_percent": self.progress_percent,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
        }


@dataclass
class WaveProgress:
    """Progress state for a wave."""

    wave_number: int
    modules: List[str] = field(default_factory=list)
    status: str = "pending"
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "wave": self.wave_number,
            "modules": self.modules,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_ms": self.duration_ms,
        }


@dataclass
class JobProgress:
    """Complete progress state for an enrichment job."""

    job_id: str
    domain: str
    status: ProgressStatus = ProgressStatus.QUEUED
    current_wave: int = 0
    total_waves: int = 4

    # Timing
    queued_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Module tracking
    modules: Dict[str, ModuleProgress] = field(default_factory=dict)
    waves: Dict[int, WaveProgress] = field(default_factory=dict)

    # Estimates
    estimated_total_seconds: float = 60.0
    elapsed_seconds: float = 0.0

    # Errors
    critical_errors: List[str] = field(default_factory=list)

    @property
    def completed_modules(self) -> List[str]:
        """Get list of completed module IDs."""
        return [
            m_id for m_id, m in self.modules.items()
            if m.status == ModuleStatus.SUCCESS
        ]

    @property
    def failed_modules(self) -> List[str]:
        """Get list of failed module IDs."""
        return [
            m_id for m_id, m in self.modules.items()
            if m.status == ModuleStatus.FAILED
        ]

    @property
    def pending_modules(self) -> List[str]:
        """Get list of pending module IDs."""
        return [
            m_id for m_id, m in self.modules.items()
            if m.status == ModuleStatus.PENDING
        ]

    @property
    def running_modules(self) -> List[str]:
        """Get list of currently running module IDs."""
        return [
            m_id for m_id, m in self.modules.items()
            if m.status == ModuleStatus.RUNNING
        ]

    @property
    def overall_percent(self) -> int:
        """Calculate overall progress percentage."""
        if not self.modules:
            return 0

        completed = len(self.completed_modules) + len(self.failed_modules)
        total = len(self.modules)

        return int((completed / total) * 100) if total > 0 else 0

    @property
    def estimated_remaining_seconds(self) -> float:
        """Estimate remaining time based on progress."""
        if self.status in (ProgressStatus.COMPLETED, ProgressStatus.FAILED):
            return 0.0

        progress = self.overall_percent / 100.0
        if progress <= 0:
            return self.estimated_total_seconds

        # Use elapsed time to estimate total
        if self.elapsed_seconds > 0:
            estimated_total = self.elapsed_seconds / progress
            return max(0, estimated_total - self.elapsed_seconds)

        return self.estimated_total_seconds * (1 - progress)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response."""
        return {
            "job_id": self.job_id,
            "domain": self.domain,
            "status": self.status.value,
            "current_wave": self.current_wave,
            "total_waves": self.total_waves,
            "overall_percent": self.overall_percent,
            "queued_at": self.queued_at.isoformat() if self.queued_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "elapsed_seconds": round(self.elapsed_seconds, 1),
            "estimated_remaining_seconds": round(self.estimated_remaining_seconds, 1),
            "modules": {
                m_id: m.to_dict() for m_id, m in self.modules.items()
            },
            "waves": {
                str(w_num): w.to_dict() for w_num, w in self.waves.items()
            },
            "completed_modules": self.completed_modules,
            "failed_modules": self.failed_modules,
            "pending_modules": self.pending_modules,
            "critical_errors": self.critical_errors,
        }


class ProgressTracker:
    """
    Real-time progress tracking for enrichment jobs.

    Features:
    - Module-level progress updates
    - Wave-level aggregation
    - Event emission for SSE/WebSocket
    - In-memory storage (can be extended to Redis)
    """

    def __init__(
        self,
        job_id: str,
        domain: str,
        modules: List[str],
        estimated_seconds: float = 60.0,
    ):
        """
        Initialize progress tracker.

        Args:
            job_id: Unique job identifier
            domain: Domain being enriched
            modules: List of module IDs to track
            estimated_seconds: Estimated total time
        """
        self.job_id = job_id
        self._progress = JobProgress(
            job_id=job_id,
            domain=domain,
            queued_at=datetime.utcnow(),
            estimated_total_seconds=estimated_seconds,
        )

        # Initialize module progress
        for module_id in modules:
            self._progress.modules[module_id] = ModuleProgress(module_id=module_id)

        # Event subscribers
        self._subscribers: List[asyncio.Queue] = []
        self._lock = asyncio.Lock()

        # Start time tracking
        self._start_time: Optional[float] = None

        self.logger = logging.getLogger(f"{__name__}.{job_id[:8]}")

    @property
    def progress(self) -> JobProgress:
        """Get current progress state."""
        # Update elapsed time
        if self._start_time:
            self._progress.elapsed_seconds = time.time() - self._start_time
        return self._progress

    async def start(self) -> None:
        """Mark job as started."""
        async with self._lock:
            self._progress.status = ProgressStatus.RUNNING
            self._progress.started_at = datetime.utcnow()
            self._start_time = time.time()

            await self._emit_event("job_start", {
                "job_id": self.job_id,
                "domain": self._progress.domain,
                "total_modules": len(self._progress.modules),
            })

    async def complete(self, success: bool = True) -> None:
        """Mark job as completed."""
        async with self._lock:
            self._progress.completed_at = datetime.utcnow()

            if self._start_time:
                self._progress.elapsed_seconds = time.time() - self._start_time

            if success:
                self._progress.status = ProgressStatus.COMPLETED
            elif self._progress.completed_modules:
                self._progress.status = ProgressStatus.PARTIAL
            else:
                self._progress.status = ProgressStatus.FAILED

            await self._emit_event("job_complete", {
                "job_id": self.job_id,
                "status": self._progress.status.value,
                "duration_seconds": self._progress.elapsed_seconds,
                "completed_modules": len(self._progress.completed_modules),
                "failed_modules": len(self._progress.failed_modules),
            })

    async def start_wave(self, wave_number: int, modules: List[str]) -> None:
        """Mark a wave as started."""
        async with self._lock:
            self._progress.current_wave = wave_number
            self._progress.waves[wave_number] = WaveProgress(
                wave_number=wave_number,
                modules=modules,
                status="running",
                started_at=datetime.utcnow(),
            )

            await self._emit_event("wave_start", {
                "wave": wave_number,
                "modules": modules,
            })

    async def complete_wave(
        self,
        wave_number: int,
        success: bool = True,
        duration_ms: float = 0.0,
    ) -> None:
        """Mark a wave as completed."""
        async with self._lock:
            if wave_number in self._progress.waves:
                wave = self._progress.waves[wave_number]
                wave.status = "completed" if success else "failed"
                wave.completed_at = datetime.utcnow()
                wave.duration_ms = duration_ms

            await self._emit_event("wave_complete", {
                "wave": wave_number,
                "status": "completed" if success else "failed",
                "duration_ms": duration_ms,
            })

    async def start_module(self, module_id: str) -> None:
        """Mark a module as started."""
        async with self._lock:
            if module_id in self._progress.modules:
                module = self._progress.modules[module_id]
                module.status = ModuleStatus.RUNNING
                module.started_at = datetime.utcnow()

            await self._emit_event("module_start", {
                "module": module_id,
            })

    async def complete_module(
        self,
        module_id: str,
        success: bool = True,
        duration_ms: float = 0.0,
        error_message: Optional[str] = None,
    ) -> None:
        """Mark a module as completed."""
        async with self._lock:
            if module_id in self._progress.modules:
                module = self._progress.modules[module_id]
                module.status = ModuleStatus.SUCCESS if success else ModuleStatus.FAILED
                module.completed_at = datetime.utcnow()
                module.duration_ms = duration_ms
                module.progress_percent = 100
                module.error_message = error_message

            await self._emit_event("module_complete", {
                "module": module_id,
                "status": "success" if success else "failed",
                "duration_ms": duration_ms,
                "error": error_message,
            })

    async def update_module_progress(
        self,
        module_id: str,
        percent: int,
    ) -> None:
        """Update progress percentage for a running module."""
        async with self._lock:
            if module_id in self._progress.modules:
                self._progress.modules[module_id].progress_percent = percent

            await self._emit_event("module_progress", {
                "module": module_id,
                "percent": percent,
            })

    async def add_error(self, error: str, critical: bool = False) -> None:
        """Add an error to the progress record."""
        async with self._lock:
            if critical:
                self._progress.critical_errors.append(error)

            await self._emit_event("error", {
                "error": error,
                "critical": critical,
            })

    async def subscribe(self) -> asyncio.Queue:
        """
        Subscribe to progress events.

        Returns:
            Queue that will receive progress events
        """
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        """Unsubscribe from progress events."""
        if queue in self._subscribers:
            self._subscribers.remove(queue)

    async def event_stream(self) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Async generator for SSE/WebSocket streaming.

        Yields events as they occur. Completes when job finishes.
        """
        queue = await self.subscribe()

        try:
            while True:
                event = await queue.get()

                yield event

                # Stop when job completes
                if event.get("event") in ("job_complete", "job_error"):
                    break

        finally:
            self.unsubscribe(queue)

    async def _emit_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Emit an event to all subscribers."""
        event = {
            "event": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
            "job_id": self.job_id,
            "overall_percent": self._progress.overall_percent,
        }

        for subscriber in self._subscribers:
            try:
                await subscriber.put(event)
            except Exception as e:
                self.logger.warning(f"Failed to emit event to subscriber: {e}")

    def get_snapshot(self) -> Dict[str, Any]:
        """Get a snapshot of current progress state."""
        if self._start_time:
            self._progress.elapsed_seconds = time.time() - self._start_time
        return self._progress.to_dict()


class ProgressManager:
    """
    Manages progress trackers for multiple jobs.

    Provides:
    - Job progress lookup
    - Cleanup of completed jobs
    - Global statistics
    """

    def __init__(self, retention_seconds: int = 3600):
        """
        Initialize progress manager.

        Args:
            retention_seconds: How long to keep completed job progress
        """
        self._trackers: Dict[str, ProgressTracker] = {}
        self._retention_seconds = retention_seconds
        self._lock = asyncio.Lock()

    async def create_tracker(
        self,
        job_id: str,
        domain: str,
        modules: List[str],
        estimated_seconds: float = 60.0,
    ) -> ProgressTracker:
        """Create and register a new progress tracker."""
        async with self._lock:
            tracker = ProgressTracker(
                job_id=job_id,
                domain=domain,
                modules=modules,
                estimated_seconds=estimated_seconds,
            )
            self._trackers[job_id] = tracker
            return tracker

    async def get_tracker(self, job_id: str) -> Optional[ProgressTracker]:
        """Get a progress tracker by job ID."""
        return self._trackers.get(job_id)

    async def get_progress(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get progress snapshot for a job."""
        tracker = self._trackers.get(job_id)
        if tracker:
            return tracker.get_snapshot()
        return None

    async def list_active_jobs(self) -> List[Dict[str, Any]]:
        """List all active (non-completed) jobs."""
        active = []
        for tracker in self._trackers.values():
            if tracker.progress.status == ProgressStatus.RUNNING:
                active.append({
                    "job_id": tracker.job_id,
                    "domain": tracker.progress.domain,
                    "percent": tracker.progress.overall_percent,
                    "current_wave": tracker.progress.current_wave,
                })
        return active

    async def cleanup_old_jobs(self) -> int:
        """Remove completed jobs older than retention period."""
        async with self._lock:
            now = datetime.utcnow()
            to_remove = []

            for job_id, tracker in self._trackers.items():
                if tracker.progress.status in (
                    ProgressStatus.COMPLETED,
                    ProgressStatus.FAILED,
                    ProgressStatus.PARTIAL,
                ):
                    if tracker.progress.completed_at:
                        age = (now - tracker.progress.completed_at).total_seconds()
                        if age > self._retention_seconds:
                            to_remove.append(job_id)

            for job_id in to_remove:
                del self._trackers[job_id]

            return len(to_remove)


# Global progress manager instance
_progress_manager: Optional[ProgressManager] = None


def get_progress_manager() -> ProgressManager:
    """Get or create the global progress manager."""
    global _progress_manager
    if _progress_manager is None:
        _progress_manager = ProgressManager()
    return _progress_manager
