from pydantic import BaseModel


class CrisisProfile(BaseModel):
    crisis_type: str  # 'layoffs', 'natural_disaster', 'partner_shutdown', 'other'
    geography: str
    severity: int  # 1-5
    timeline_days: int
    demand_delta_pct: float
    affected_population: int
    notes: str


class ScopeChatRequest(BaseModel):
    session_id: str
    message: str


class ScopeChatResponse(BaseModel):
    response: str
    crisis_profile: CrisisProfile | None = None
    is_complete: bool = False
