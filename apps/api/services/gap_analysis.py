import os
from datetime import datetime, timedelta, timezone

from supabase import create_client

from models.assess import CategoryGap, CrisisProfile, GapAnalysis

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

FOOD_CATEGORIES = ["protein", "grains", "dairy", "produce", "canned", "beverages"]


async def compute_gap_locally(profile: CrisisProfile) -> GapAnalysis:
    """
    Deterministic gap analysis. No LLM needed for the math.
    1. Query inventory: SUM(quantity_lbs) by food_category WHERE status='available'
    2. Query demand_history: AVG(quantity_demanded_lbs) by food_category (last 4 weeks)
    3. Projected demand = avg_weekly * (1 + demand_delta_pct/100) * (timeline_days/7)
    4. Gap = supply - projected_demand per category
    5. Expiration risk: SUM(quantity_lbs) WHERE expiration_date < now() + 7 days
    6. Site health scores: SELECT id, health_score FROM sites
    """
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. Current supply by category
    inv_resp = (
        supabase.table("inventory")
        .select("food_category, quantity_lbs")
        .eq("status", "available")
        .execute()
    )
    supply_by_cat: dict[str, float] = {c: 0.0 for c in FOOD_CATEGORIES}
    for row in inv_resp.data:
        cat = row["food_category"]
        if cat in supply_by_cat:
            supply_by_cat[cat] += float(row["quantity_lbs"])

    # 2. Average weekly demand by category (last 4 weeks)
    demand_resp = (
        supabase.table("demand_history")
        .select("food_category, quantity_demanded_lbs")
        .execute()
    )
    demand_counts: dict[str, list[float]] = {c: [] for c in FOOD_CATEGORIES}
    for row in demand_resp.data:
        cat = row["food_category"]
        if cat in demand_counts:
            demand_counts[cat].append(float(row["quantity_demanded_lbs"]))

    # 3. Projected demand
    demand_by_cat: dict[str, float] = {}
    for cat in FOOD_CATEGORIES:
        vals = demand_counts[cat]
        avg_weekly = sum(vals) / max(len(vals), 1)
        projected = avg_weekly * (1 + profile.demand_delta_pct / 100) * (profile.timeline_days / 7)
        demand_by_cat[cat] = projected

    # 4. Gaps per category
    gaps: list[CategoryGap] = []
    total_supply = 0.0
    total_demand = 0.0
    for cat in FOOD_CATEGORIES:
        s = supply_by_cat[cat]
        d = demand_by_cat[cat]
        total_supply += s
        total_demand += d
        gaps.append(
            CategoryGap(
                category=cat,
                supply_lbs=s,
                demand_lbs=d,
                gap_lbs=s - d,
                coverage_ratio=s / d if d > 0 else 1.0,
            )
        )

    # 5. Expiration risk
    cutoff = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    exp_resp = (
        supabase.table("inventory")
        .select("quantity_lbs")
        .eq("status", "available")
        .lt("expiration_date", cutoff)
        .execute()
    )
    expiration_risk = sum(float(r["quantity_lbs"]) for r in exp_resp.data)

    # 6. Site health scores (pre-computed by Postgres function)
    sites_resp = supabase.table("sites").select("id, health_score").execute()
    site_scores = {r["id"]: float(r["health_score"]) for r in sites_resp.data}

    return GapAnalysis(
        total_supply_lbs=total_supply,
        total_demand_lbs=total_demand,
        total_gap_lbs=total_supply - total_demand,
        gaps_by_category=gaps,
        expiration_risk_lbs=expiration_risk,
        site_health_scores=site_scores,
        ai_summary="",  # Filled by ASSESS LLM call in the router
    )
