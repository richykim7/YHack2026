from typing import Literal, Union

from pydantic import BaseModel


# === Existing events (Phase 2-3) ===

class AgentStartEvent(BaseModel):
    type: Literal["agent_start"] = "agent_start"
    agent: str
    message: str
    timestamp: float


class AgentEndEvent(BaseModel):
    type: Literal["agent_end"] = "agent_end"
    agent: str
    message: str
    timestamp: float


class HexRunStartedEvent(BaseModel):
    type: Literal["hex_run_started"] = "hex_run_started"
    agent: str
    run_url: str
    timestamp: float


class HexRunCompletedEvent(BaseModel):
    type: Literal["hex_run_completed"] = "hex_run_completed"
    agent: str
    run_url: str
    status: str
    timestamp: float


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str
    timestamp: float
    agent: str | None = None


class CompleteEvent(BaseModel):
    """Legacy complete event. Pipeline.py emits this until Plan 03 rewrites it."""
    type: Literal["complete"] = "complete"
    message: str | None = None
    timestamp: float
    agent: str | None = None


class ScopeMessageEvent(BaseModel):
    type: Literal["scope_message"] = "scope_message"
    content: str
    timestamp: float


class ScopeCompleteEvent(BaseModel):
    type: Literal["scope_complete"] = "scope_complete"
    crisis_profile: dict  # CrisisProfile serialized
    timestamp: float


class AssessStartEvent(BaseModel):
    type: Literal["assess_start"] = "assess_start"
    timestamp: float


class AssessCompleteEvent(BaseModel):
    type: Literal["assess_complete"] = "assess_complete"
    gap_analysis: dict  # GapAnalysis serialized
    timestamp: float


class HexAssessReadyEvent(BaseModel):
    type: Literal["hex_assess_ready"] = "hex_assess_ready"
    run_url: str
    timestamp: float


# === New events (Phase 4 contract) ===

class DiscoverStartEvent(BaseModel):
    type: Literal["discover_start"] = "discover_start"
    timestamp: float


class SourceFoundEvent(BaseModel):
    """Streamed one at a time as DISCOVER finds sources."""
    type: Literal["source_found"] = "source_found"
    source: dict  # SourceOption serialized
    timestamp: float


class DiscoverCompleteEvent(BaseModel):
    type: Literal["discover_complete"] = "discover_complete"
    sources: list[dict]  # SourceOption[] serialized
    total_count: int
    timestamp: float


class OptimizeStartEvent(BaseModel):
    type: Literal["optimize_start"] = "optimize_start"
    timestamp: float


class PlansReadyEvent(BaseModel):
    type: Literal["plans_ready"] = "plans_ready"
    plans: list[dict]  # ResponsePlan[] serialized
    timestamp: float


class HexPlansReadyEvent(BaseModel):
    type: Literal["hex_plans_ready"] = "hex_plans_ready"
    run_url: str
    timestamp: float


class PipelineCompleteEvent(BaseModel):
    type: Literal["pipeline_complete"] = "pipeline_complete"
    timestamp: float


class LavaUsageEvent(BaseModel):
    type: Literal["lava_usage"] = "lava_usage"
    costs: dict  # LavaCostBreakdown serialized
    timestamp: float


# === Union of ALL event types ===

SSEEvent = Union[
    AgentStartEvent,
    AgentEndEvent,
    HexRunStartedEvent,
    HexRunCompletedEvent,
    ErrorEvent,
    CompleteEvent,
    ScopeMessageEvent,
    ScopeCompleteEvent,
    AssessStartEvent,
    AssessCompleteEvent,
    HexAssessReadyEvent,
    DiscoverStartEvent,
    SourceFoundEvent,
    DiscoverCompleteEvent,
    OptimizeStartEvent,
    PlansReadyEvent,
    HexPlansReadyEvent,
    PipelineCompleteEvent,
    LavaUsageEvent,
]

# All valid event type strings (for reference)
ALL_EVENT_TYPES = [
    "agent_start", "agent_end", "hex_run_started", "hex_run_completed",
    "error", "complete",
    "scope_message", "scope_complete", "assess_start", "assess_complete",
    "hex_assess_ready",
    "discover_start", "source_found", "discover_complete",
    "optimize_start", "plans_ready", "hex_plans_ready",
    "pipeline_complete", "lava_usage",
]


# === API Endpoint Contracts (Phase 5 will implement these) ===

class DiscoverRequest(BaseModel):
    """POST /api/discover -- input to DISCOVER agent."""
    gap_analysis: dict    # GapAnalysis serialized
    crisis_profile: dict  # CrisisProfile serialized


class DiscoverResponse(BaseModel):
    """POST /api/discover -- output from DISCOVER agent."""
    sources: list[dict]   # SourceOption[] serialized
    db_count: int
    web_count: int


class OptimizeRequest(BaseModel):
    """POST /api/optimize -- input to OPTIMIZE function."""
    gap_analysis: dict    # GapAnalysis serialized
    sources: list[dict]   # SourceOption[] serialized
    crisis_profile: dict  # CrisisProfile serialized


class OptimizeResponse(BaseModel):
    """POST /api/optimize -- output from OPTIMIZE function."""
    plans: list[dict]     # ResponsePlan[] serialized (always 3: fastest, cheapest, best_nutrition)


class FollowupRequest(BaseModel):
    """POST /api/followup -- follow-up question to Hex Threads."""
    question: str
    session_id: str
    crisis_context: dict | None = None  # optional crisis context for Hex


class FollowupResponse(BaseModel):
    """POST /api/followup -- response from Hex Threads."""
    answer: str
    chart_url: str | None = None  # Hex may return a chart
