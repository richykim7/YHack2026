import asyncio
import json

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from agents.pipeline import run_pipeline, get_event_queue, cleanup_queue

router = APIRouter(prefix="/api/crisis", tags=["crisis"])


class LaunchRequest(BaseModel):
    session_id: str
    crisis_profile: dict


@router.post("/launch")
async def launch_pipeline(request: LaunchRequest, background_tasks: BackgroundTasks):
    """Start the pipeline for a session. Returns immediately."""
    background_tasks.add_task(run_pipeline, request.session_id, request.crisis_profile)
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
                    if event["type"] in ("complete", "error"):
                        break
                except asyncio.TimeoutError:
                    # Send keepalive comment
                    yield {"comment": "keepalive"}
        finally:
            cleanup_queue(session_id)

    return EventSourceResponse(event_generator())
