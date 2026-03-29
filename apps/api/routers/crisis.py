import asyncio
import json

from fastapi import APIRouter
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from agents.pipeline import run_pipeline, get_event_queue, cleanup_queue

router = APIRouter(prefix="/api/crisis", tags=["crisis"])


class LaunchRequest(BaseModel):
    session_id: str
    crisis_profile: dict


@router.post("/launch")
async def launch_pipeline(request: LaunchRequest):
    """Start the pipeline for a session. Returns immediately.

    Uses asyncio.create_task (not BackgroundTasks) so the pipeline starts
    on the event loop immediately — no race condition with the SSE stream.
    """
    # Pre-create the queue so the stream endpoint can connect to it
    get_event_queue(request.session_id)
    # Fire-and-forget on the event loop
    asyncio.create_task(run_pipeline(request.session_id, request.crisis_profile))
    return {"status": "started", "session_id": request.session_id}


@router.get("/stream/{session_id}")
async def stream_events(session_id: str):
    """SSE endpoint streaming pipeline events."""

    async def event_generator():
        queue = get_event_queue(session_id)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield {
                        "event": event["type"],
                        "data": json.dumps(event),
                    }
                    if event["type"] in ("complete", "pipeline_complete", "error"):
                        break
                except asyncio.TimeoutError:
                    yield {"comment": "keepalive"}
        finally:
            cleanup_queue(session_id)

    return EventSourceResponse(event_generator())
