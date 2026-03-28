from fastapi import APIRouter

router = APIRouter(prefix="/api/crisis", tags=["crisis"])


@router.post("/launch")
async def launch_pipeline():
    """Stub -- implemented in Plan 03."""
    return {"status": "not_implemented"}


@router.get("/stream/{session_id}")
async def stream_events(session_id: str):
    """Stub -- implemented in Plan 03."""
    return {"status": "not_implemented"}
