#!/usr/bin/env python3
"""One-time OAuth setup for Hex MCP server.

Run this script interactively — it opens a browser for Hex login,
captures the OAuth token, and saves it for the CrisisGrid API to reuse.

Usage:
    cd apps/api
    python scripts/hex_oauth_setup.py

After success, tokens are stored in .hex_oauth_tokens.json.
The followup endpoint will use them automatically.
"""

import asyncio
import sys
import webbrowser
from pathlib import Path

# Add parent dir to path so we can import from services/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from aiohttp import web

from mcp.client.auth import OAuthClientProvider
from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.shared.auth import OAuthClientMetadata

import httpx

from services.hex_threads import FileTokenStorage, TOKEN_FILE

CALLBACK_PORT = 8921
CALLBACK_PATH = "/callback"


async def main():
    print("=" * 60)
    print("  Hex MCP OAuth Setup for CrisisGrid")
    print("=" * 60)
    print()

    storage = FileTokenStorage()

    # Check if we already have tokens
    existing = await storage.get_tokens()
    if existing:
        print(f"Found existing tokens in {TOKEN_FILE}")
        print("Testing connection...")
        if await test_connection(storage):
            print("\nTokens are valid! No setup needed.")
            return
        print("Existing tokens are invalid/expired. Re-authenticating...\n")

    # Set up OAuth callback handler
    auth_code_future: asyncio.Future[tuple[str, str | None]] = asyncio.get_event_loop().create_future()

    # aiohttp server to receive the OAuth callback
    async def handle_callback(request: web.Request):
        code = request.query.get("code", "")
        state = request.query.get("state")
        if code:
            auth_code_future.set_result((code, state))
            return web.Response(
                text="<html><body><h1>Authorization successful!</h1>"
                     "<p>You can close this tab and return to the terminal.</p>"
                     "</body></html>",
                content_type="text/html",
            )
        error = request.query.get("error", "unknown")
        auth_code_future.set_exception(RuntimeError(f"OAuth error: {error}"))
        return web.Response(text=f"Authorization failed: {error}", status=400)

    app = web.Application()
    app.router.add_get(CALLBACK_PATH, handle_callback)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "localhost", CALLBACK_PORT)
    await site.start()
    print(f"OAuth callback server listening on http://localhost:{CALLBACK_PORT}{CALLBACK_PATH}")

    async def redirect_handler(auth_url: str) -> None:
        """Open the browser for Hex OAuth login."""
        print(f"\nOpening browser for Hex authorization...")
        print(f"If the browser doesn't open, visit:\n  {auth_url}\n")
        webbrowser.open(auth_url)

    async def callback_handler() -> tuple[str, str | None]:
        """Wait for the OAuth callback."""
        print("Waiting for authorization callback...")
        return await auth_code_future

    client_metadata = OAuthClientMetadata(
        redirect_uris=[f"http://localhost:{CALLBACK_PORT}{CALLBACK_PATH}"],
        client_name="CrisisGrid API",
        grant_types=["authorization_code", "refresh_token"],
        response_types=["code"],
        token_endpoint_auth_method="none",
    )

    oauth_provider = OAuthClientProvider(
        server_url="https://app.hex.tech",
        client_metadata=client_metadata,
        storage=storage,
        redirect_handler=redirect_handler,
        callback_handler=callback_handler,
    )

    print("\nConnecting to Hex MCP server...")
    http_client = httpx.AsyncClient(auth=oauth_provider)

    try:
        async with streamable_http_client(
            "https://app.hex.tech/mcp", http_client=http_client
        ) as (read_stream, write_stream, _):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()

                # List available tools to verify connection
                tools = await session.list_tools()
                tool_names = [t.name for t in tools.tools]
                print(f"\nConnected! Available tools: {tool_names}")

                # Verify tokens were saved
                saved = await storage.get_tokens()
                if saved:
                    print(f"\nOAuth tokens saved to: {TOKEN_FILE}")
                    print("The CrisisGrid API will use these automatically.")
                else:
                    print("\nWARNING: Connection worked but tokens were not saved!")

    except Exception as e:
        print(f"\nError connecting to Hex MCP: {e}")
        print("Please check your Hex account has Explorer role or higher.")
        sys.exit(1)
    finally:
        await http_client.aclose()
        await runner.cleanup()

    print("\n" + "=" * 60)
    print("  Setup complete! You can now use /api/crisis/followup")
    print("=" * 60)


async def test_connection(storage: FileTokenStorage) -> bool:
    """Quick test if existing tokens work."""
    oauth_provider = OAuthClientProvider(
        server_url="https://app.hex.tech",
        client_metadata=OAuthClientMetadata(
            redirect_uris=[f"http://localhost:{CALLBACK_PORT}{CALLBACK_PATH}"],
            client_name="CrisisGrid API",
            grant_types=["authorization_code", "refresh_token"],
            response_types=["code"],
            token_endpoint_auth_method="none",
        ),
        storage=storage,
    )
    http_client = httpx.AsyncClient(auth=oauth_provider)
    try:
        async with streamable_http_client(
            "https://app.hex.tech/mcp", http_client=http_client
        ) as (read_stream, write_stream, _):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                tools = await session.list_tools()
                tool_names = [t.name for t in tools.tools]
                print(f"  Tools available: {tool_names}")
                return True
    except Exception as e:
        print(f"  Connection test failed: {e}")
        return False
    finally:
        await http_client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
