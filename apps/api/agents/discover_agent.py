"""DISCOVER agent: dual-channel source discovery (DB + Tavily web search).

Finds sourcing options matching deficit categories from:
1. Supabase supplier_catalog table (reliable, structured data)
2. Tavily web search (broader reach, sensible defaults)

Deduplicates results with DB sources winning on conflict.
"""

import asyncio
import logging
import os
import uuid
from typing import Awaitable, Callable

from supabase import create_client

from models.assess import GapAnalysis
from models.crisis import CrisisProfile, SourceOption

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


async def discover_sources(
    gap: GapAnalysis,
    profile: CrisisProfile,
    on_source_found: Callable[[SourceOption], Awaitable[None]] | None = None,
) -> list[SourceOption]:
    """Discover sourcing options via dual-channel: DB + Tavily web search.

    Args:
        gap: Gap analysis with per-category deficits.
        profile: Crisis profile with geography and context.
        on_source_found: Optional async callback invoked per source for SSE streaming.

    Returns:
        Deduplicated list of SourceOption, DB sources winning on conflict.
    """
    deficit_categories = [
        g.category for g in gap.gaps_by_category if g.gap_lbs < 0
    ]

    if not deficit_categories:
        logger.info("No deficit categories found, skipping discovery")
        return []

    # Run DB and Tavily concurrently
    db_task = asyncio.to_thread(
        _query_supplier_catalog, deficit_categories, profile
    )
    tavily_task = _search_tavily(deficit_categories, profile.geography)

    db_sources, web_sources = await asyncio.gather(db_task, tavily_task)

    # Stream DB sources via callback
    if on_source_found:
        for src in db_sources:
            await on_source_found(src)

    # Stream web sources via callback
    if on_source_found:
        for src in web_sources:
            await on_source_found(src)

    # Deduplicate with DB winning on conflict
    combined = _deduplicate(db_sources + web_sources)

    logger.info(
        "Discovered %d sources (%d DB, %d web, %d after dedup)",
        len(db_sources) + len(web_sources),
        len(db_sources),
        len(web_sources),
        len(combined),
    )

    return combined


def _query_supplier_catalog(
    categories: list[str], profile: CrisisProfile
) -> list[SourceOption]:
    """Query Supabase supplier_catalog for sources matching deficit categories.

    Args:
        categories: Food categories with deficits.
        profile: Crisis profile (unused currently, available for future filtering).

    Returns:
        List of SourceOption from database.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.warning("Supabase credentials not set, skipping DB query")
        return []

    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        response = (
            supabase.table("supplier_catalog")
            .select("*")
            .in_("food_category", categories)
            .order("reliability_score", desc=True)
            .order("unit_cost_per_lb", desc=False)
            .execute()
        )

        sources = []
        for row in response.data:
            src = _row_to_source_option(row)
            if src is not None:
                sources.append(src)

        logger.info(
            "Found %d supplier_catalog rows for categories %s",
            len(sources),
            categories,
        )
        return sources

    except Exception as e:
        logger.warning("supplier_catalog query failed: %s", e)
        return []


def _row_to_source_option(row: dict) -> SourceOption | None:
    """Map a supplier_catalog DB row to a SourceOption.

    Generates a slug-based id from supplier_name + item_name.
    Uses .get() with defaults for graceful handling of column mismatches.
    """
    try:
        supplier_name = row.get("supplier_name", "Unknown")
        item_name = row.get("item_name", "Unknown Item")
        slug = f"{supplier_name}-{item_name}".lower().replace(" ", "-")

        return SourceOption(
            id=slug,
            supplier_name=supplier_name,
            food_category=row.get("food_category", ""),
            item_name=item_name,
            quantity_available_lbs=float(
                row.get("quantity_available_lbs", 0.0)
            ),
            unit_cost_per_lb=float(row.get("unit_cost_per_lb", 0.0)),
            lead_time_days=int(row.get("lead_time_days", 7)),
            reliability_score=float(row.get("reliability_score", 0.5)),
            source_type="database",
            notes=row.get("notes", ""),
        )
    except Exception as e:
        logger.warning("Failed to map supplier_catalog row: %s", e)
        return None


async def _search_tavily(
    categories: list[str], geography: str
) -> list[SourceOption]:
    """Search Tavily for emergency food suppliers matching deficit categories.

    Args:
        categories: Food categories to search for.
        geography: Geographic region for the search query.

    Returns:
        List of SourceOption from web search (max 5 total).
    """
    api_key = os.environ.get("TAVILY_API_KEY", "")
    if not api_key:
        logger.warning("TAVILY_API_KEY not set, skipping web search")
        return []

    try:
        from tavily import TavilyClient

        client = TavilyClient(api_key=api_key)
        sources: list[SourceOption] = []

        for cat in categories:
            if len(sources) >= 5:
                break

            query = f"emergency food supplier {cat} {geography}"
            results = await asyncio.to_thread(
                client.search, query, max_results=2
            )

            for result in results.get("results", []):
                if len(sources) >= 5:
                    break
                src = _tavily_result_to_source_option(result, cat)
                sources.append(src)

        logger.info("Tavily returned %d web sources", len(sources))
        return sources

    except Exception as e:
        logger.warning("Tavily search failed: %s", e)
        return []


def _tavily_result_to_source_option(
    result: dict, category: str
) -> SourceOption:
    """Map a Tavily search result to a SourceOption with sensible defaults.

    Web sources get conservative defaults:
    - quantity: 1000 lbs (reasonable minimum order)
    - cost: $2.50/lb (average wholesale)
    - lead_time: 3 days
    - reliability: 0.5 (unknown supplier)
    """
    return SourceOption(
        id=str(uuid.uuid4()),
        supplier_name=result.get("title", "Unknown Supplier")[:100],
        food_category=category,
        item_name=f"{category} (web sourced)",
        quantity_available_lbs=1000.0,
        unit_cost_per_lb=2.50,
        lead_time_days=3,
        reliability_score=0.5,
        source_type="web_search",
        notes=result.get("url", ""),
    )


def _deduplicate(sources: list[SourceOption]) -> list[SourceOption]:
    """Deduplicate sources. DB sources win on conflict.

    Dedup key: (supplier_name.lower(), food_category, item_name.lower())
    Sources are processed DB-first so DB versions take precedence.
    """
    # Sort so database sources come first
    sorted_sources = sorted(
        sources, key=lambda s: (0 if s.source_type == "database" else 1)
    )

    seen: dict[tuple[str, str, str], SourceOption] = {}
    for src in sorted_sources:
        key = (
            src.supplier_name.lower(),
            src.food_category,
            src.item_name.lower(),
        )
        if key not in seen:
            seen[key] = src

    return list(seen.values())
