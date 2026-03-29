"""Audit trail models for pipeline provenance tracking."""

from pydantic import BaseModel


class AuditEntry(BaseModel):
    """Single audit log entry for a pipeline action."""

    timestamp: float
    agent: str  # "scope", "assess", "discover", "optimize", "monitor", "orchestrator"
    action: str  # "start", "complete", "error", "llm_call", "hex_trigger"
    model: str = ""  # LLM model name (e.g., "claude-sonnet-4")
    input_summary: str = ""  # Brief description of input
    output_summary: str = ""  # Brief description of output
    token_count: int = 0
    cost_usd: float = 0.0
    lava_request_id: str = ""
    duration_ms: int = 0
