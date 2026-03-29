"""Hex Threads MCP client — connects to app.hex.tech/mcp for Thread operations.

Provides:
- FileTokenStorage: persists OAuth tokens to disk for reuse across restarts
- HexThreadsClient: calls create_thread / get_thread / continue_thread via MCP
"""

import asyncio
import json
import logging
import os
from pathlib import Path

import httpx
from mcp.client.auth import OAuthClientProvider, TokenStorage
from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.shared.auth import OAuthClientInformationFull, OAuthClientMetadata, OAuthToken

logger = logging.getLogger(__name__)

HEX_MCP_URL = "https://app.hex.tech/mcp"
HEX_SERVER_URL = "https://app.hex.tech"
TOKEN_FILE = Path(os.getenv(
    "HEX_OAUTH_TOKEN_FILE",
    str(Path(__file__).resolve().parent.parent / ".hex_oauth_tokens.json"),
))


class FileTokenStorage(TokenStorage):
    """Persist OAuth tokens + client registration to a JSON file."""

    def __init__(self, path: Path = TOKEN_FILE):
        self.path = path

    def _read(self) -> dict:
        if self.path.exists():
            return json.loads(self.path.read_text())
        return {}

    def _write(self, data: dict) -> None:
        self.path.write_text(json.dumps(data, indent=2))

    async def get_tokens(self) -> OAuthToken | None:
        data = self._read()
        if "tokens" in data:
            return OAuthToken(**data["tokens"])
        return None

    async def set_tokens(self, tokens: OAuthToken) -> None:
        data = self._read()
        data["tokens"] = tokens.model_dump(mode="json", exclude_none=True)
        self._write(data)

    async def get_client_info(self) -> OAuthClientInformationFull | None:
        data = self._read()
        if "client_info" in data:
            return OAuthClientInformationFull(**data["client_info"])
        return None

    async def set_client_info(self, client_info: OAuthClientInformationFull) -> None:
        data = self._read()
        data["client_info"] = client_info.model_dump(mode="json", exclude_none=True)
        self._write(data)


def _build_client_metadata() -> OAuthClientMetadata:
    """Build OAuth client metadata for dynamic registration."""
    return OAuthClientMetadata(
        redirect_uris=["http://localhost:8921/callback"],
        client_name="CrisisGrid API",
        grant_types=["authorization_code", "refresh_token"],
        response_types=["code"],
        token_endpoint_auth_method="none",
    )


def _build_oauth_provider(
    storage: FileTokenStorage,
    redirect_handler=None,
    callback_handler=None,
) -> OAuthClientProvider:
    """Create an OAuthClientProvider with given storage and handlers."""
    return OAuthClientProvider(
        server_url=HEX_SERVER_URL,
        client_metadata=_build_client_metadata(),
        storage=storage,
        redirect_handler=redirect_handler,
        callback_handler=callback_handler,
    )


class HexThreadsClient:
    """High-level client for Hex Threads operations via MCP.

    Usage:
        client = HexThreadsClient()
        answer = await client.ask("Which warehouses have the lowest protein?",
                                   crisis_context="layoffs in Greater Philadelphia")
    """

    def __init__(self, storage: FileTokenStorage | None = None):
        self.storage = storage or FileTokenStorage()

    async def is_authenticated(self) -> bool:
        """Check if we have stored OAuth tokens."""
        tokens = await self.storage.get_tokens()
        return tokens is not None

    async def ask(
        self,
        question: str,
        crisis_context: str = "",
        timeout_seconds: int = 180,
        poll_interval: float = 3.0,
    ) -> dict:
        """Ask a question via Hex Threads. Returns {answer, thread_url, thread_id}.

        Creates a new Thread with the contextualized question, polls until idle,
        and extracts the text response.
        """
        if not await self.is_authenticated():
            raise RuntimeError(
                "No Hex OAuth tokens found. Run 'python scripts/hex_oauth_setup.py' first."
            )

        # Build the contextualized prompt
        prompt = question
        if crisis_context:
            prompt = (
                f"Context: {crisis_context}. "
                f"Our database has tables: sites, inventory, suppliers, supplier_catalog, "
                f"demand_history, crisis_events. All sites are in 'Greater Philadelphia'.\n\n"
                f"Question: {question}\n\n"
                f"Please query the CrisisGrid Supabase database to answer this."
            )

        oauth_provider = _build_oauth_provider(self.storage)
        http_client = httpx.AsyncClient(auth=oauth_provider)

        try:
            async with streamable_http_client(
                HEX_MCP_URL, http_client=http_client
            ) as (read_stream, write_stream, _get_session_id):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()

                    # Create thread
                    logger.info("Creating Hex Thread for question: %s", question[:80])
                    create_result = await session.call_tool(
                        "create_thread", {"prompt": prompt}
                    )
                    thread_info = self._parse_tool_result(create_result)
                    thread_id = thread_info.get("thread_id", "")
                    thread_url = thread_info.get("thread_url", "")

                    if not thread_id:
                        # Try to extract from the raw text
                        raw_text = self._extract_text(create_result)
                        logger.warning(
                            "Could not parse thread_id from create_thread result: %s",
                            raw_text[:200],
                        )
                        return {
                            "answer": raw_text or "Thread created but could not parse response.",
                            "thread_url": thread_url,
                            "thread_id": thread_id,
                        }

                    # Poll until idle
                    logger.info("Polling thread %s for completion...", thread_id)
                    elapsed = 0.0
                    final_result = None
                    while elapsed < timeout_seconds:
                        await asyncio.sleep(poll_interval)
                        elapsed += poll_interval

                        get_result = await session.call_tool(
                            "get_thread", {"thread_id": thread_id}
                        )
                        parsed = self._parse_tool_result(get_result)
                        status = parsed.get("status", "")

                        if status == "idle" or "idle" in str(get_result).lower():
                            final_result = get_result
                            logger.info("Thread %s completed after %.1fs", thread_id, elapsed)
                            break

                        logger.debug(
                            "Thread %s status: %s (%.1fs elapsed)", thread_id, status, elapsed
                        )

                    if final_result is None:
                        return {
                            "answer": f"Thread analysis timed out after {timeout_seconds}s. "
                                      f"You can check the result at: {thread_url}",
                            "thread_url": thread_url,
                            "thread_id": thread_id,
                        }

                    # Extract the answer text
                    answer = self._extract_text(final_result)

                    return {
                        "answer": answer or "Analysis complete — see thread for details.",
                        "thread_url": thread_url,
                        "thread_id": thread_id,
                    }
        finally:
            await http_client.aclose()

    @staticmethod
    def _parse_tool_result(result) -> dict:
        """Try to parse structured data from an MCP tool result."""
        # MCP tool results have a .content list of TextContent/ImageContent etc.
        if hasattr(result, "content"):
            for block in result.content:
                if hasattr(block, "text"):
                    text = block.text
                    # Try JSON parse
                    try:
                        return json.loads(text)
                    except (json.JSONDecodeError, TypeError):
                        pass
                    # Try to find JSON embedded in text
                    for start_char in ["{", "["]:
                        idx = text.find(start_char)
                        if idx >= 0:
                            try:
                                return json.loads(text[idx:])
                            except (json.JSONDecodeError, TypeError):
                                pass
        return {}

    @staticmethod
    def _extract_text(result) -> str:
        """Extract plain text from an MCP tool result."""
        parts = []
        if hasattr(result, "content"):
            for block in result.content:
                if hasattr(block, "text"):
                    parts.append(block.text)
        return "\n".join(parts)
