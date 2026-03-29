import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from supabase import create_client

from models.crisis import CrisisProfile
from models.assess import CategoryGap, GapAnalysis

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

FOOD_CATEGORIES = ["protein", "grains", "dairy", "produce", "canned", "beverages"]


async def compute_gap_locally(profile: CrisisProfile) -> GapAnalysis:
    """
    Marginal deficit model with baseline reservation.

    Food banks operate on continuous flow — inventory covers ~1 week of
    baseline demand while regular supply chains continue. The crisis creates
    incremental demand that must be sourced externally.

    Network-level demand per category:
      demand = avg_weekly × 1.0 (baseline from inventory)
             + avg_weekly × (demand_delta_pct/100) × (timeline_days/7) (crisis surge)
      gap = current_supply - demand
      external_need = max(0, -gap)

    Per-site needs are distributed by each site's demand share, then
    weighted by inverse health score for equity allocation.
    """
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. Current supply by site and category
    inv_resp = (
        supabase.table("inventory")
        .select("site_id, food_category, quantity_lbs")
        .eq("status", "available")
        .execute()
    )
    site_supply: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    supply_by_cat: dict[str, float] = {c: 0.0 for c in FOOD_CATEGORIES}
    for row in inv_resp.data:
        cat = row["food_category"]
        if cat in supply_by_cat:
            site_supply[row["site_id"]][cat] += float(row["quantity_lbs"])
            supply_by_cat[cat] += float(row["quantity_lbs"])

    # 2. Demand history: network-level avg and per-site breakdown
    demand_resp = (
        supabase.table("demand_history")
        .select("site_id, food_category, quantity_demanded_lbs")
        .execute()
    )

    network_demand_rows: dict[str, list[float]] = {c: [] for c in FOOD_CATEGORIES}
    site_demand_rows: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))

    for row in demand_resp.data:
        cat = row["food_category"]
        if cat in network_demand_rows:
            val = float(row["quantity_demanded_lbs"])
            network_demand_rows[cat].append(val)
            site_demand_rows[row["site_id"]][cat].append(val)

    # Network avg weekly demand per category
    network_avg_weekly: dict[str, float] = {}
    for cat in FOOD_CATEGORIES:
        vals = network_demand_rows[cat]
        network_avg_weekly[cat] = sum(vals) / max(len(vals), 1)

    # Per-site avg weekly demand (for demand share computation)
    site_avg_weekly: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for sid, cats in site_demand_rows.items():
        for cat, vals in cats.items():
            site_avg_weekly[sid][cat] = sum(vals) / max(len(vals), 1)

    # 3. Site health scores
    sites_resp = supabase.table("sites").select("id, health_score").execute()
    site_scores = {r["id"]: float(r["health_score"]) for r in sites_resp.data}

    # 4. Network-level demand & gap per category
    weeks = profile.timeline_days / 7.0
    delta_frac = profile.demand_delta_pct / 100.0

    cat_demand: dict[str, float] = {}  # total demand on the system
    cat_external_need: dict[str, float] = {}  # what must be sourced externally

    for cat in FOOD_CATEGORIES:
        avg_w = network_avg_weekly.get(cat, 0.0)
        supply = supply_by_cat.get(cat, 0.0)

        # Inventory must cover: 1 week of baseline ops + full crisis surge
        baseline_commitment = avg_w * 1.0
        surge = avg_w * delta_frac * weeks
        total_demand = baseline_commitment + surge

        cat_demand[cat] = total_demand
        cat_external_need[cat] = max(0.0, total_demand - supply)

    network_total_need = sum(cat_external_need.values())

    # 5. Per-site demand shares
    cat_site_total: dict[str, float] = defaultdict(float)
    for sid in site_avg_weekly:
        for cat in FOOD_CATEGORIES:
            cat_site_total[cat] += site_avg_weekly[sid].get(cat, 0.0)

    # 6. Per-site needs: distribute external need by demand share
    all_site_ids = set(site_supply.keys()) | set(site_demand_rows.keys()) | set(site_scores.keys())

    per_site_needs: dict[str, dict[str, float]] = {}
    for sid in all_site_ids:
        site_needs: dict[str, float] = {}
        for cat in FOOD_CATEGORIES:
            ext_need = cat_external_need.get(cat, 0.0)
            if ext_need <= 0:
                continue
            site_demand = site_avg_weekly[sid].get(cat, 0.0)
            total_demand_for_cat = cat_site_total.get(cat, 1.0)
            share = site_demand / total_demand_for_cat if total_demand_for_cat > 0 else 0.0
            need = ext_need * share
            if need > 0:
                site_needs[cat] = round(need, 1)
        if site_needs:
            per_site_needs[sid] = site_needs

    # 7. Equity-weighted site priorities
    site_priorities = _compute_site_priorities(per_site_needs, site_scores)

    # 8. Category-level gap display for frontend
    gaps: list[CategoryGap] = []
    total_supply = 0.0
    total_demand_sum = 0.0
    for cat in FOOD_CATEGORIES:
        s = supply_by_cat.get(cat, 0.0)
        d = cat_demand.get(cat, 0.0)
        total_supply += s
        total_demand_sum += d
        gap_val = round(s - d, 1)
        gaps.append(
            CategoryGap(
                category=cat,
                supply_lbs=s,
                demand_lbs=d,
                gap_lbs=gap_val,
                coverage_ratio=min(s / d, 1.0) if d > 0 else 1.0,
            )
        )

    # 9. Expiration risk
    cutoff = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    exp_resp = (
        supabase.table("inventory")
        .select("quantity_lbs")
        .eq("status", "available")
        .lt("expiration_date", cutoff)
        .execute()
    )
    expiration_risk = sum(float(r["quantity_lbs"]) for r in exp_resp.data)

    return GapAnalysis(
        total_supply_lbs=total_supply,
        total_demand_lbs=total_demand_sum,
        total_gap_lbs=round(total_supply - total_demand_sum, 1),
        gaps_by_category=gaps,
        expiration_risk_lbs=expiration_risk,
        site_health_scores=site_scores,
        ai_summary="",
        per_site_needs=per_site_needs,
        site_priorities=site_priorities,
        network_total_need_lbs=round(network_total_need, 1),
    )


def _compute_site_priorities(
    site_needs: dict[str, dict[str, float]],
    health_scores: dict[str, float],
) -> dict[str, float]:
    """Equity-weighted priority: sites with lower health and higher need get more.

    Returns {site_id: normalized_priority_share} summing to 1.0.
    """
    raw: dict[str, float] = {}
    for sid, cats in site_needs.items():
        need = sum(cats.values())
        hs = max(health_scores.get(sid, 0.5), 0.05)
        raw[sid] = need * (1.0 / hs)
    total = sum(raw.values()) or 1.0
    return {sid: round(w / total, 4) for sid, w in raw.items()}
