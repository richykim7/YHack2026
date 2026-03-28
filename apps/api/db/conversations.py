import os

from langchain_core.messages import AIMessage, HumanMessage
from supabase import Client, create_client

_client: Client | None = None


def _get_client() -> Client:
    """Lazy-init Supabase client."""
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY", "")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set"
            )
        _client = create_client(url, key)
    return _client


async def ensure_session(session_id: str) -> None:
    """Upsert a session row in scope_sessions."""
    client = _get_client()
    client.table("scope_sessions").upsert(
        {"id": session_id}, on_conflict="id"
    ).execute()


async def load_history(session_id: str) -> list:
    """Load conversation history as LangChain message objects."""
    client = _get_client()
    result = (
        client.table("scope_messages")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    messages = []
    for row in result.data:
        if row["role"] == "human":
            messages.append(HumanMessage(content=row["content"]))
        elif row["role"] == "ai":
            messages.append(AIMessage(content=row["content"]))
    return messages


async def save_message(session_id: str, role: str, content: str) -> None:
    """Insert a message into scope_messages."""
    client = _get_client()
    client.table("scope_messages").insert(
        {"session_id": session_id, "role": role, "content": content}
    ).execute()


async def save_crisis_profile(session_id: str, profile: dict) -> None:
    """Update the session with an extracted crisis profile."""
    client = _get_client()
    client.table("scope_sessions").update(
        {"crisis_profile": profile, "status": "extracting"}
    ).eq("id", session_id).execute()
