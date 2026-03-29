"""OPTIMIZE: Greedy algorithm producing 3 response plan variants.

Pure Python, no LLM dependency. Generates three plans:
- fastest: minimize delivery time
- cheapest: minimize total cost
- best_nutrition: maximize nutritional coverage via round-robin category selection
"""

import logging
import math
from collections import defaultdict

from models.assess import GapAnalysis
from models.crisis import CrisisProfile, PlanLineItem, ResponsePlan, SourceOption

logger = logging.getLogger(__name__)


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in miles between two lat/lon points."""
    R = 3959  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def generate_plans(
    gap: GapAnalysis,
    sources: list[SourceOption],
    profile: CrisisProfile,
) -> list[ResponsePlan]:
    """Generate 3 optimized response plans from available sources.

    Strategies:
        - fastest: sources sorted by lead_time_days ascending
        - cheapest: sources sorted by unit_cost_per_lb ascending
        - best_nutrition: round-robin across food categories for diversity

    Args:
        gap: Gap analysis with per-category deficits.
        sources: Available sourcing options from DISCOVER.
        profile: Crisis profile with affected_population.

    Returns:
        Exactly 3 ResponsePlan objects.
    """
    # Extract deficits (absolute values)
    deficits = {
        g.category: abs(g.gap_lbs)
        for g in gap.gaps_by_category
        if g.gap_lbs < 0
    }
    total_deficit = sum(deficits.values())

    # Use central Philadelphia as default target for delivery cost calculations
    # In a full system, this would come from the crisis-affected site
    target_lat = 39.95
    target_lng = -75.17

    # Guard: no deficit or no sources -> return 3 empty plans
    if total_deficit <= 0 or not sources:
        logger.info(
            "No deficit (%.1f lbs) or no sources (%d), returning empty plans",
            total_deficit,
            len(sources),
        )
        return [
            ResponsePlan(
                name=name,
                strategy=strategy,
                line_items=[],
                total_cost=0.0,
                coverage_pct=100.0,
                max_lead_time_days=0,
                estimated_people_served=profile.affected_population,
            )
            for name, strategy in [
                ("fastest", "No deficit to fill"),
                ("cheapest", "No deficit to fill"),
                ("best_nutrition", "No deficit to fill"),
            ]
        ]

    # Build per-category index for strategy filtering
    by_cat: dict[str, list[SourceOption]] = defaultdict(list)
    for s in sources:
        if s.food_category in deficits:
            by_cat[s.food_category].append(s)

    # Strategy 1: FASTEST -- top 2 sources per deficit category
    # (sorted by lead_time_days, then unit_cost as tiebreaker)
    # This produces ~12 line items with minimal lead time
    fast_pool: list[SourceOption] = []
    for cat in sorted(by_cat.keys()):
        sorted_cat = sorted(
            by_cat[cat],
            key=lambda s: (s.lead_time_days, s.unit_cost_per_lb),
        )
        fast_pool.extend(sorted_cat[:2])

    # Strategy 2: CHEAPEST -- only donated ($0) and low-cost (<= $0.50/lb)
    # sources, sorted by unit cost ascending
    cheap_pool = sorted(
        [s for s in sources if s.unit_cost_per_lb <= 0.50],
        key=lambda s: s.unit_cost_per_lb,
    )
    # Fallback: if too few cheap sources, include up to $1.00/lb
    if len(cheap_pool) < 5:
        cheap_pool = sorted(
            [s for s in sources if s.unit_cost_per_lb <= 1.00],
            key=lambda s: s.unit_cost_per_lb,
        )

    # Strategy 3: BEST NUTRITION -- round-robin for maximum category diversity
    # (existing behavior, uses ALL sources)
    nutrition_pool = _round_robin_sort(sources, set(deficits.keys()))

    strategies = [
        (
            "fastest",
            "Minimize delivery time (top 2 sources per category)",
            fast_pool,
        ),
        (
            "cheapest",
            "Minimize total cost (donated and low-cost sources only)",
            cheap_pool,
        ),
        (
            "best_nutrition",
            "Maximize nutritional coverage across all categories",
            nutrition_pool,
        ),
    ]

    plans: list[ResponsePlan] = []

    for name, strategy, sorted_sources in strategies:
        line_items, remaining = _greedy_fill(
            sorted_sources, dict(deficits), target_lat, target_lng
        )

        total_sourced = total_deficit - sum(remaining.values())
        coverage_pct = min(total_sourced / total_deficit * 100, 100.0)
        max_lead = max(
            (li.lead_time_days for li in line_items), default=0
        )
        total_cost = sum(li.cost + li.delivery_cost for li in line_items)
        estimated_served = int(
            profile.affected_population * coverage_pct / 100
        )

        plans.append(
            ResponsePlan(
                name=name,
                strategy=strategy,
                line_items=line_items,
                total_cost=round(total_cost, 2),
                coverage_pct=round(coverage_pct, 2),
                max_lead_time_days=max_lead,
                estimated_people_served=estimated_served,
            )
        )

    logger.info(
        "Generated 3 plans: %s",
        [(p.name, f"{p.coverage_pct}%", f"${p.total_cost}") for p in plans],
    )

    return plans


def _greedy_fill(
    sorted_sources: list[SourceOption],
    remaining_gaps: dict[str, float],
    target_lat: float = 39.95,
    target_lng: float = -75.17,
) -> tuple[list[PlanLineItem], dict[str, float]]:
    """Greedily fill category gaps using sources in the given order.

    Each source contributes up to its available quantity toward its
    food_category deficit. Sources for categories without a deficit
    are skipped. Delivery cost is computed via haversine distance.

    Args:
        sorted_sources: Sources in strategy-specific order.
        remaining_gaps: Mutable dict of {category: deficit_lbs}.
        target_lat: Latitude of delivery target site.
        target_lng: Longitude of delivery target site.

    Returns:
        Tuple of (line_items created, remaining unfilled gaps).
    """
    line_items: list[PlanLineItem] = []

    for src in sorted_sources:
        cat = src.food_category
        if cat not in remaining_gaps or remaining_gaps[cat] <= 0:
            continue

        qty = min(src.quantity_available_lbs, remaining_gaps[cat])
        remaining_gaps[cat] -= qty

        # Compute delivery cost based on haversine distance
        delivery_cost = 0.0
        distance_miles = 0.0
        if src.latitude and src.longitude:
            distance_miles = round(haversine_miles(src.latitude, src.longitude, target_lat, target_lng), 1)
            delivery_cost = round(75.0 + 3.50 * distance_miles + 0.02 * qty, 2)

        line_items.append(
            PlanLineItem(
                source_id=src.id,
                supplier_name=src.supplier_name,
                food_category=cat,
                item_name=src.item_name,
                quantity_lbs=qty,
                cost=round(qty * src.unit_cost_per_lb, 2),
                lead_time_days=src.lead_time_days,
                delivery_cost=delivery_cost,
                distance_miles=distance_miles,
            )
        )

    return line_items, remaining_gaps


def _round_robin_sort(
    sources: list[SourceOption],
    deficit_categories: set[str],
) -> list[SourceOption]:
    """Sort sources via round-robin across categories for nutritional diversity.

    Groups sources by food_category (only deficit categories), sorts each
    group by quantity_available_lbs DESC, then interleaves one source at a
    time from each category.

    Args:
        sources: All available sources.
        deficit_categories: Categories with deficits to fill.

    Returns:
        Sources ordered for maximum category diversity.
    """
    # Group by category, only deficit categories
    groups: dict[str, list[SourceOption]] = defaultdict(list)
    for src in sources:
        if src.food_category in deficit_categories:
            groups[src.food_category].append(src)

    # Sort each group by quantity DESC (biggest supplies first)
    for cat in groups:
        groups[cat].sort(key=lambda s: s.quantity_available_lbs, reverse=True)

    # Round-robin interleave
    result: list[SourceOption] = []
    category_keys = sorted(groups.keys())  # deterministic order
    indices = {cat: 0 for cat in category_keys}
    placed = True

    while placed:
        placed = False
        for cat in category_keys:
            idx = indices[cat]
            if idx < len(groups[cat]):
                result.append(groups[cat][idx])
                indices[cat] += 1
                placed = True

    return result
