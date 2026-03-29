import asyncio
import json

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from agents.monitor_agent import run_monitor
from agents.pipeline import get_event_queue, cleanup_queue
from models.monitor import MonitorStartRequest

router = APIRouter(prefix="/api/monitor", tags=["monitor"])


@router.post("/start")
async def start_monitor(request: MonitorStartRequest):
    """Start the autonomous crisis monitor. Returns immediately.

    Launches the monitor feed scan as a fire-and-forget task.
    The monitor scans posts, classifies via LLM, and auto-triggers
    the pipeline when a crisis is detected.
    """
    # Pre-create the queue so the stream endpoint can connect
    get_event_queue(request.session_id)
    # Fire-and-forget on the event loop
    asyncio.create_task(run_monitor(request.session_id))
    return {"status": "started", "session_id": request.session_id}


@router.get("/stream/{session_id}")
async def stream_monitor(session_id: str):
    """SSE endpoint streaming monitor + pipeline events.

    Streams the full event sequence:
    1. monitor_post / monitor_classification events (feed scan)
    2. crisis_detected (when crisis found)
    3. orchestrator_start / orchestrator_step / crisis_profile_ready (profile assembly)
    4. agent_start through pipeline_complete (existing pipeline)
    """
    async def event_generator():
        queue = get_event_queue(session_id)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=60.0)
                    yield {
                        "event": event["type"],
                        "data": json.dumps(event),
                    }
                    if event["type"] in ("pipeline_complete", "error"):
                        break
                except asyncio.TimeoutError:
                    yield {"comment": "keepalive"}
        finally:
            cleanup_queue(session_id)

    return EventSourceResponse(event_generator())
