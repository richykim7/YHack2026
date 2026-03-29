"""OPTIMIZE: Site-priority-aware plan generation with supplier consolidation.

Pure Python, no LLM dependency. Generates three plans:
- fastest: minimize delivery time
- cheapest: minimize total cost (consolidated per-supplier delivery)
- best_nutrition: maximize nutritional coverage via round-robin category selection

Key improvements over v1:
- Allocates to sites in equity-weighted priority order (sicker sites first)
- Consolidates delivery cost per supplier (one $75 trip, not per line item)
- Uses marginal deficit model from gap_analysis (surge + safety stock shortfall)
"""

import copy
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

# Central Philadelphia fallback for delivery distance
DEFAULT_TARGET_LAT = 39.95
DEFAULT_TARGET_LNG = -75.17


def generate_plans(
    gap: GapAnalysis,
    sources: list[SourceOption],
    profile: CrisisProfile,
) -> list[ResponsePlan]:
    """Generate 3 optimized response plans from available sources.

    Uses per-site needs and equity-weighted priorities from the gap analysis.
    Delivery costs are consolidated per-supplier (one trip per supplier).
    """
    # Use per-site needs if available, else fall back to category-level deficits
    if gap.per_site_needs and gap.site_priorities:
        return _generate_site_aware_plans(gap, sources, profile)
    else:
        # Fallback: old-style category-level allocation
        return _generate_category_plans(gap, sources, profile)


def _generate_site_aware_plans(
    gap: GapAnalysis,
    sources: list[SourceOption],
    profile: CrisisProfile,
) -> list[ResponsePlan]:
    """Generate plans that allocate to sites in priority order."""

    total_need = gap.network_total_need_lbs
    logger.info("OPTIMIZE v2: site-aware plans, total_need=%.1f, sources=%d, sites=%d",
                total_need, len(sources), len(gap.site_priorities))
    if total_need <= 0 or not sources:
        return _empty_plans(profile)

    # Pre-compute distance from each source to target (central Philly)
    for s in sources:
        if not hasattr(s, '_distance'):
            if s.latitude and s.longitude:
                s._distance = haversine_miles(s.latitude, s.longitude, DEFAULT_TARGET_LAT, DEFAULT_TARGET_LNG)
            else:
                s._distance = 0.0

    # Pre-compute landed cost per lb for each source (for cheapest ranking)
    # Use consolidated model: delivery fee amortized over source's full available qty
    source_landed: dict[str, float] = {}
    for s in sources:
        dist = s._distance if hasattr(s, '_distance') else 0.0
        if s.quantity_available_lbs > 0 and dist > 0:
            delivery_per_lb = (75.0 + 3.50 * dist) / s.quantity_available_lbs
        else:
            delivery_per_lb = 0.0
        source_landed[s.id] = s.unit_cost_per_lb + delivery_per_lb

    # Sort sites by priority (highest first)
    sorted_sites = sorted(
        gap.site_priorities.keys(),
        key=lambda sid: gap.site_priorities.get(sid, 0),
        reverse=True,
    )

    # Strategy pools
    strategies = [
        ("fastest", _sort_fastest(sources), "Fastest delivery: sources within 2 days prioritized, allocated to highest-need sites first"),
        ("cheapest", _sort_cheapest(sources, source_landed), "Lowest total cost: consolidated per-supplier delivery, equity-weighted site allocation"),
        ("best_nutrition", _sort_nutrition(sources, gap.per_site_needs), "Balanced nutrition: round-robin across food categories, sicker sites served first"),
    ]

    plans: list[ResponsePlan] = []

    for name, sorted_pool, strategy_desc in strategies:
        # Deep copy source availability AND site needs for each strategy
        avail = {s.id: s.quantity_available_lbs for s in sorted_pool}
        remaining_needs = {sid: dict(cats) for sid, cats in gap.per_site_needs.items()}

        line_items: list[PlanLineItem] = []
        total_filled = 0.0

        for sid in sorted_sites:
            site_cats = remaining_needs.get(sid, {})
            for src in sorted_pool:
                if avail[src.id] <= 0:
                    continue
                cat = src.food_category
                needed = site_cats.get(cat, 0.0)
                if needed <= 0:
                    continue

                qty = min(needed, avail[src.id])
                avail[src.id] -= qty
                site_cats[cat] = needed - qty
                total_filled += qty

                dist = src._distance if hasattr(src, '_distance') else 0.0

                line_items.append(PlanLineItem(
                    source_id=src.id,
                    supplier_name=src.supplier_name,
                    food_category=cat,
                    item_name=src.item_name,
                    quantity_lbs=round(qty, 1),
                    cost=round(qty * src.unit_cost_per_lb, 2),
                    lead_time_days=src.lead_time_days,
                    delivery_cost=0.0,  # filled by consolidation below
                    distance_miles=round(dist, 1),
                ))

        # Consolidate delivery costs per supplier (one trip each)
        supplier_lbs: dict[str, float] = defaultdict(float)
        supplier_dist: dict[str, float] = {}
        for li in line_items:
            supplier_lbs[li.supplier_name] += li.quantity_lbs
            if li.supplier_name not in supplier_dist:
                supplier_dist[li.supplier_name] = li.distance_miles

        # Distribute consolidated delivery cost across line items proportionally
        for li in line_items:
            sname = li.supplier_name
            dist = supplier_dist.get(sname, 0.0)
            total_sup_lbs = supplier_lbs.get(sname, 1.0)
            if dist > 0 and total_sup_lbs > 0:
                # One delivery fee per supplier, split by weight share
                full_delivery = 75.0 + 3.50 * dist + 0.02 * total_sup_lbs
                li.delivery_cost = round(full_delivery * (li.quantity_lbs / total_sup_lbs), 2)

        # Plan-level stats
        total_procurement = sum(li.cost for li in line_items)
        total_delivery = sum(li.delivery_cost for li in line_items)
        total_cost = total_procurement + total_delivery
        coverage_pct = min(total_filled / total_need * 100, 100.0) if total_need > 0 else 100.0
        max_lead = max((li.lead_time_days for li in line_items), default=0)
        estimated_served = int(profile.affected_population * coverage_pct / 100)

        plans.append(ResponsePlan(
            name=name,
            strategy=strategy_desc,
            line_items=line_items,
            total_cost=round(total_cost, 2),
            coverage_pct=round(coverage_pct, 2),
            max_lead_time_days=max_lead,
            estimated_people_served=estimated_served,
            transfers=[],  # transfers skipped per spec
        ))

    logger.info(
        "Generated 3 plans: %s",
        [(p.name, f"{p.coverage_pct}%", f"${p.total_cost}") for p in plans],
    )
    return plans


def _sort_fastest(sources: list[SourceOption]) -> list[SourceOption]:
    """Fastest: filter to <=2 day lead time, fallback chain."""
    pool = [s for s in sources if s.lead_time_days <= 2]
    if len(pool) < 2:
        pool = [s for s in sources if s.lead_time_days <= 3]
    if len(pool) < 2:
        pool = sorted(sources, key=lambda s: s.lead_time_days)[:max(len(sources) // 2, 2)]
    pool.sort(key=lambda s: (s.lead_time_days, s.unit_cost_per_lb))
    return pool


def _sort_cheapest(sources: list[SourceOption], landed: dict[str, float]) -> list[SourceOption]:
    """Cheapest: sort by landed cost (unit + amortized delivery)."""
    pool = list(sources)
    pool.sort(key=lambda s: landed.get(s.id, s.unit_cost_per_lb))
    return pool


def _sort_nutrition(sources: list[SourceOption], per_site_needs: dict[str, dict[str, float]]) -> list[SourceOption]:
    """Best nutrition: round-robin across deficit categories."""
    # Determine which categories have need
    deficit_cats: set[str] = set()
    for cats in per_site_needs.values():
        deficit_cats.update(cats.keys())

    groups: dict[str, list[SourceOption]] = defaultdict(list)
    for src in sources:
        if src.food_category in deficit_cats:
            groups[src.food_category].append(src)

    # Sort each group by cost ASC (cheapest first), then quantity DESC as tiebreaker.
    # This keeps nutritional diversity (round-robin across categories) without
    # blindly picking expensive commercial suppliers over free donations.
    for cat in groups:
        groups[cat].sort(key=lambda s: (s.unit_cost_per_lb, -s.quantity_available_lbs))

    # Round-robin interleave
    result: list[SourceOption] = []
    category_keys = sorted(groups.keys())
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


def _empty_plans(profile: CrisisProfile) -> list[ResponsePlan]:
    """Return 3 empty plans when there's no deficit or no sources."""
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


def _generate_category_plans(
    gap: GapAnalysis,
    sources: list[SourceOption],
    profile: CrisisProfile,
) -> list[ResponsePlan]:
    """Fallback: category-level greedy fill (no per-site data)."""
    deficits = {
        g.category: abs(g.gap_lbs)
        for g in gap.gaps_by_category
        if g.gap_lbs < 0
    }
    total_deficit = sum(deficits.values())

    if total_deficit <= 0 or not sources:
        return _empty_plans(profile)

    # Pre-compute distances
    for s in sources:
        if not hasattr(s, '_distance'):
            if s.latitude and s.longitude:
                s._distance = haversine_miles(s.latitude, s.longitude, DEFAULT_TARGET_LAT, DEFAULT_TARGET_LNG)
            else:
                s._distance = 0.0

    source_landed: dict[str, float] = {}
    for s in sources:
        dist = s._distance if hasattr(s, '_distance') else 0.0
        if s.quantity_available_lbs > 0 and dist > 0:
            delivery_per_lb = (75.0 + 3.50 * dist) / s.quantity_available_lbs
        else:
            delivery_per_lb = 0.0
        source_landed[s.id] = s.unit_cost_per_lb + delivery_per_lb

    deficit_cats = set(deficits.keys())

    strategies = [
        ("fastest", _sort_fastest(sources), "Fastest delivery: sources within 2 days prioritized"),
        ("cheapest", _sort_cheapest(sources, source_landed), "Lowest total cost: consolidated per-supplier delivery"),
        ("best_nutrition", _sort_nutrition(sources, {"_": {c: 1 for c in deficit_cats}}), "Balanced nutrition: round-robin across food categories"),
    ]

    plans: list[ResponsePlan] = []
    for name, sorted_pool, strategy_desc in strategies:
        line_items, remaining = _greedy_fill(sorted_pool, dict(deficits))

        # Consolidate delivery costs
        _consolidate_delivery(line_items)

        total_filled = total_deficit - sum(remaining.values())
        coverage_pct = min(total_filled / total_deficit * 100, 100.0) if total_deficit > 0 else 100.0
        max_lead = max((li.lead_time_days for li in line_items), default=0)
        total_cost = sum(li.cost + li.delivery_cost for li in line_items)
        estimated_served = int(profile.affected_population * coverage_pct / 100)

        plans.append(ResponsePlan(
            name=name,
            strategy=strategy_desc,
            line_items=line_items,
            total_cost=round(total_cost, 2),
            coverage_pct=round(coverage_pct, 2),
            max_lead_time_days=max_lead,
            estimated_people_served=estimated_served,
            transfers=[],
        ))

    return plans


def _greedy_fill(
    sorted_sources: list[SourceOption],
    remaining_gaps: dict[str, float],
) -> tuple[list[PlanLineItem], dict[str, float]]:
    """Greedily fill category gaps using sources in the given order."""
    line_items: list[PlanLineItem] = []

    for src in sorted_sources:
        cat = src.food_category
        if cat not in remaining_gaps or remaining_gaps[cat] <= 0:
            continue

        qty = min(src.quantity_available_lbs, remaining_gaps[cat])
        remaining_gaps[cat] -= qty

        dist = src._distance if hasattr(src, '_distance') else 0.0

        line_items.append(
            PlanLineItem(
                source_id=src.id,
                supplier_name=src.supplier_name,
                food_category=cat,
                item_name=src.item_name,
                quantity_lbs=round(qty, 1),
                cost=round(qty * src.unit_cost_per_lb, 2),
                lead_time_days=src.lead_time_days,
                delivery_cost=0.0,  # filled by consolidation
                distance_miles=round(dist, 1),
            )
        )

    return line_items, remaining_gaps


def _consolidate_delivery(line_items: list[PlanLineItem]) -> None:
    """Assign consolidated delivery costs per supplier (one trip each)."""
    supplier_lbs: dict[str, float] = defaultdict(float)
    supplier_dist: dict[str, float] = {}
    for li in line_items:
        supplier_lbs[li.supplier_name] += li.quantity_lbs
        if li.supplier_name not in supplier_dist:
            supplier_dist[li.supplier_name] = li.distance_miles

    for li in line_items:
        sname = li.supplier_name
        dist = supplier_dist.get(sname, 0.0)
        total_sup_lbs = supplier_lbs.get(sname, 1.0)
        if dist > 0 and total_sup_lbs > 0:
            full_delivery = 75.0 + 3.50 * dist + 0.02 * total_sup_lbs
            li.delivery_cost = round(full_delivery * (li.quantity_lbs / total_sup_lbs), 2)
