from pydantic import BaseModel


class MonitorPost(BaseModel):
    """A social media or news post scanned by the monitor agent."""

    id: str
    source: str  # "twitter", "news", "community_alert"
    author: str
    content: str
    timestamp: float


class MonitorStartRequest(BaseModel):
    """POST /api/monitor/start -- starts autonomous crisis monitoring."""

    session_id: str


# Curated feed: 2 irrelevant posts, 1 early signal, 1 strong trigger, 1 unreachable
SIMULATED_POSTS = [
    MonitorPost(
        id="post-1",
        source="twitter",
        author="@PhillyFoodWatch",
        content="Beautiful day at the Reading Terminal Market! New vendor selling amazing empanadas. #PhillyEats",
        timestamp=0.0,
    ),
    MonitorPost(
        id="post-2",
        source="news",
        author="Philadelphia Inquirer",
        content="Eagles announce new community outreach program for youth sports in South Philly.",
        timestamp=0.0,
    ),
    MonitorPost(
        id="post-3",
        source="twitter",
        author="@NorthPhillyNews",
        content="Major layoffs announced at Apex Manufacturing in Kensington. 800+ workers affected. Union reps meeting tonight.",
        timestamp=0.0,
    ),
    MonitorPost(
        id="post-4",
        source="community_alert",
        author="Kensington Community Board",
        content="URGENT: Multiple factories in the Kensington corridor announcing closures. Estimated 2000+ jobs lost. Food pantry demand already spiking.",
        timestamp=0.0,
    ),
    MonitorPost(
        id="post-5",
        source="news",
        author="WHYY News",
        content="North Philadelphia manufacturing sector faces worst crisis in a decade. Steel and textile plants closing, thousands facing food insecurity.",
        timestamp=0.0,
    ),
]
