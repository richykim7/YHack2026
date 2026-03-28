from typing import Literal

from pydantic import BaseModel


class SSEEvent(BaseModel):
    type: Literal[
        "agent_start",
        "agent_end",
        "hex_run_started",
        "hex_run_completed",
        "error",
        "complete",
    ]
    agent: str | None = None
    message: str | None = None
    timestamp: float
    data: dict | None = None
