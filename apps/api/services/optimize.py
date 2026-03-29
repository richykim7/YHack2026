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
from models.crisis import CrisisProfile, PlanLineItem, ResponsePlan, SourceOption, TransferItem

logger = logging.getLogger(__name__)


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in miles between two lat/lon points."""
    R = 3959  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


FOOD_CATEGORIES = ["protein", "grains", "dairy", "produce", "canned", "beverages"]


def compute_transfers(
    gap: GapAnalysis,
    max_distance: float | None = None,
) -> list[TransferItem]:
    """Match surplus sites to deficit sites via inter-site transfers.

    Surplus threshold: site supply > demand * 1.5 in a category.
    Transfer cost is delivery-only ($0 procurement).

    Args:
        gap: Gap analysis with site_health_scores (used for site context).
        max_distance: Maximum transfer distance in miles (None = no limit, 15.0 for fastest).

    Returns:
        List of TransferItem for inter-site food transfers.
    """
    import os
    from supabase import create_client

    SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
    SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []

    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

        # Get site coordinates and names
        sites_resp = supabase.table("sites").select("id, name, lat, lng").execute()
        sites_coords: dict[str, tuple[float, float]] = {}
        sites_names: dict[str, str] = {}
        for s in sites_resp.data:
            sites_coords[s["id"]] = (float(s["lat"]), float(s["lng"]))
            sites_names[s["id"]] = s["name"]

        # Get per-site supply
        inv_resp = supabase.table("inventory").select("site_id, food_category, quantity_lbs").eq("status", "available").execute()
        sites_supply: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        for row in inv_resp.data:
            sites_supply[row["site_id"]][row["food_category"]] += float(row["quantity_lbs"])

        # Get per-site demand (average weekly)
        demand_resp = supabase.table("demand_history").select("site_id, food_category, quantity_demanded_lbs").execute()
        demand_counts: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
        for row in demand_resp.data:
            demand_counts[row["site_id"]][row["food_category"]].append(float(row["quantity_demanded_lbs"]))

        sites_demand: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        for site_id, cats in demand_counts.items():
            for cat, vals in cats.items():
                sites_demand[site_id][cat] = sum(vals) / max(len(vals), 1)

        transfers: list[TransferItem] = []

        for cat in FOOD_CATEGORIES:
            surplus_sites: list[tuple[str, float]] = []  # (site_id, surplus_amount)
            deficit_sites: list[tuple[str, float]] = []   # (site_id, deficit_amount)

            for site_id in sites_coords:
                supply = sites_supply[site_id].get(cat, 0)
                demand = sites_demand[site_id].get(cat, 0)
                if supply > demand * 1.5:
                    surplus_sites.append((site_id, supply - demand * 1.5))
                elif supply < demand:
                    deficit_sites.append((site_id, demand - supply))

            # Match surplus to deficit (greedy by proximity)
            for def_id, deficit_remaining in deficit_sites:
                if def_id not in sites_coords:
                    continue
                for i, (sur_id, surplus_remaining) in enumerate(surplus_sites):
                    if surplus_remaining <= 0:
                        continue
                    if sur_id not in sites_coords:
                        continue
                    dist = haversine_miles(*sites_coords[sur_id], *sites_coords[def_id])
                    if max_distance is not None and dist > max_distance:
                        continue
                    qty = min(surplus_remaining, deficit_remaining)
                    delivery_cost = round(75.0 + 3.50 * dist + 0.02 * qty, 2)
                    transfers.append(TransferItem(
                        from_site_id=sur_id,
                        from_site_name=sites_names.get(sur_id, "Unknown"),
                        to_site_id=def_id,
                        to_site_name=sites_names.get(def_id, "Unknown"),
                        food_category=cat,
                        quantity_lbs=round(qty, 1),
                        delivery_cost=delivery_cost,
                        distance_miles=round(dist, 1),
                    ))
                    surplus_sites[i] = (sur_id, surplus_remaining - qty)
                    deficit_remaining -= qty
                    if deficit_remaining <= 0:
                        break

        return transfers
    except Exception as e:
        logger.warning("Transfer computation failed: %s", e)
        return []


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

    # Strategy 1: FASTEST -- lead time fallback chain
    # Primary: <= 2 days, Fallback 1: <= 3 days, Fallback 2: top 50% by lead time
    # Then top 2 per category; always include nearby transfers
    fast_pool: list[SourceOption] = []
    for cat in sorted(by_cat.keys()):
        cat_sources = by_cat[cat]
        # Fallback chain for lead time filtering
        pool = [s for s in cat_sources if s.lead_time_days <= 2]
        if len(pool) < 2:
            pool = [s for s in cat_sources if s.lead_time_days <= 3]
        if len(pool) < 2:
            sorted_by_lt = sorted(cat_sources, key=lambda s: s.lead_time_days)
            pool = sorted_by_lt[:max(2, len(sorted_by_lt) // 2)]
        # Sort by lead time then cost, take top 2
        pool.sort(key=lambda s: (s.lead_time_days, s.unit_cost_per_lb))
        fast_pool.extend(pool[:2])

    # Strategy 2: CHEAPEST -- sort by unit_cost + delivery_cost_per_lb
    # Includes all sources, sorted by effective cost (procurement + estimated delivery per lb)
    def effective_cost(s: SourceOption) -> float:
        if s.latitude and s.longitude:
            dist = haversine_miles(s.latitude, s.longitude, target_lat, target_lng)
            delivery_per_lb = (75.0 + 3.50 * dist) / max(s.quantity_available_lbs, 1) + 0.02
        else:
            delivery_per_lb = 0.0
        return s.unit_cost_per_lb + delivery_per_lb

    cheap_pool = sorted(
        [s for s in sources if s.food_category in deficits],
        key=effective_cost,
    )

    # Strategy 3: BEST NUTRITION -- round-robin with diversity penalty
    # Deprioritize categories at >= 80% coverage to encourage diversity
    nutrition_pool = _round_robin_sort(sources, set(deficits.keys()))

    strategies = [
        (
            "fastest",
            "Fastest delivery: sources arriving within 2 days (fallback 3 days), plus nearby inter-site transfers within 15 miles",
            fast_pool,
        ),
        (
            "cheapest",
            "Lowest total cost: sources ranked by unit cost plus estimated delivery cost per pound, including $0-procurement inter-site transfers",
            cheap_pool,
        ),
        (
            "best_nutrition",
            "Maximum nutritional diversity: round-robin across food categories to ensure balanced coverage, with inter-site transfers for surplus redistribution",
            nutrition_pool,
        ),
    ]

    # Compute inter-site transfers
    fast_transfers = compute_transfers(gap, max_distance=15.0)  # Fastest: nearby only
    all_transfers = compute_transfers(gap, max_distance=None)    # Others: no distance limit

    plans: list[ResponsePlan] = []

    for name, strategy, sorted_sources in strategies:
        line_items, remaining = _greedy_fill(
            sorted_sources, dict(deficits), target_lat, target_lng
        )

        # Select strategy-appropriate transfers
        if name == "fastest":
            plan_transfers = fast_transfers
        else:
            plan_transfers = all_transfers

        # Add transfer coverage to totals
        transfer_coverage = sum(t.quantity_lbs for t in plan_transfers)
        total_sourced = total_deficit - sum(remaining.values()) + transfer_coverage
        coverage_pct = min(total_sourced / total_deficit * 100, 100.0)

        max_lead = max(
            (li.lead_time_days for li in line_items), default=0
        )

        # Add transfer delivery costs to total
        transfer_delivery_cost = sum(t.delivery_cost for t in plan_transfers)
        total_cost = sum(li.cost + li.delivery_cost for li in line_items) + transfer_delivery_cost

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
                transfers=plan_transfers,
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
