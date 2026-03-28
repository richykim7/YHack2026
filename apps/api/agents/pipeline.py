import asyncio
import time
from typing import Dict

from models.events import SSEEvent

# Session -> Queue mapping for SSE event routing
_event_queues: Dict[str, asyncio.Queue] = {}


def get_event_queue(session_id: str) -> asyncio.Queue:
    if session_id not in _event_queues:
        _event_queues[session_id] = asyncio.Queue()
    return _event_queues[session_id]


def cleanup_queue(session_id: str):
    _event_queues.pop(session_id, None)


async def run_pipeline(session_id: str, crisis_profile: dict):
    """
    Stub pipeline that emits fake events simulating SCOPE -> ASSESS flow.
    Phase 3 will replace with real ASSESS agent logic.
    """
    queue = get_event_queue(session_id)

    try:
        # Emit SCOPE agent complete (it already ran via chat)
        await queue.put(SSEEvent(
            type="agent_start",
            agent="scope",
            message="SCOPE analysis complete. Starting pipeline.",
            timestamp=time.time(),
        ).model_dump())

        await asyncio.sleep(0.5)

        await queue.put(SSEEvent(
            type="agent_end",
            agent="scope",
            message="Crisis profile confirmed.",
            timestamp=time.time(),
        ).model_dump())

        await asyncio.sleep(1.0)

        # Simulate ASSESS agent
        await queue.put(SSEEvent(
            type="agent_start",
            agent="assess",
            message="Starting gap analysis...",
            timestamp=time.time(),
        ).model_dump())

        await asyncio.sleep(2.0)

        await queue.put(SSEEvent(
            type="agent_end",
            agent="assess",
            message="Gap analysis complete. Supply shortfall identified.",
            timestamp=time.time(),
        ).model_dump())

        await asyncio.sleep(0.5)

        # Pipeline complete
        await queue.put(SSEEvent(
            type="complete",
            message="Pipeline complete. Results ready.",
            timestamp=time.time(),
        ).model_dump())

    except Exception as e:
        await queue.put(SSEEvent(
            type="error",
            message=f"Pipeline error: {str(e)}",
            timestamp=time.time(),
        ).model_dump())
