#!/usr/bin/env python3
"""Verify seed data produces correct gap analysis and catalog coverage.

Run: cd apps/api && python scripts/verify_seed.py
"""

import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv()

# Add parent dir to path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.crisis import CrisisProfile
from services.gap_analysis import compute_gap_locally
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]


async def main():
    # === 1. Gap Analysis Verification (DATA-01) ===
    profile_35 = CrisisProfile(
        crisis_type="layoffs",
        geography="Greater Philadelphia",
        severity=4,
        timeline_days=14,
        demand_delta_pct=35,
        affected_population=15000,
        notes="Steel plant closures",
    )
    gap_35 = await compute_gap_locally(profile_35)

    print("=== Gap Analysis (35% surge) ===")
    deficits_35 = []
    for g in gap_35.gaps_by_category:
        status = "DEFICIT" if g.gap_lbs < 0 else "SURPLUS"
        print(
            f"  {g.category:12s}: supply={g.supply_lbs:>10,.0f}"
            f"  demand={g.demand_lbs:>10,.0f}"
            f"  gap={g.gap_lbs:>+10,.0f}"
            f"  ratio={g.coverage_ratio:.2f}x"
            f"  [{status}]"
        )
        if g.gap_lbs < 0:
            deficits_35.append(g)

    # Check: at least 3 deficits
    assert len(deficits_35) >= 3, f"FAIL: Expected 3+ deficits at 35% surge, got {len(deficits_35)}"
    print(f"\n  PASS: {len(deficits_35)} deficit categories at 35% surge")

    # Check: protein and produce in deficits
    deficit_cats = {g.category for g in deficits_35}
    assert "protein" in deficit_cats, "FAIL: protein must be in deficit"
    assert "produce" in deficit_cats, "FAIL: produce must be in deficit"
    print("  PASS: protein and produce are both in deficit")

    # Check: protein and produce are among the worst 2 by gap magnitude
    sorted_by_gap = sorted(gap_35.gaps_by_category, key=lambda g: g.gap_lbs)
    worst_two = {sorted_by_gap[0].category, sorted_by_gap[1].category}
    assert "protein" in worst_two or "produce" in worst_two, (
        f"FAIL: worst two are {worst_two}, expected protein/produce"
    )
    print(
        f"  PASS: worst two deficits are {sorted_by_gap[0].category}"
        f" and {sorted_by_gap[1].category}"
    )

    # === 1b. Baseline check (no surge) ===
    profile_0 = CrisisProfile(
        crisis_type="layoffs",
        geography="Greater Philadelphia",
        severity=4,
        timeline_days=14,
        demand_delta_pct=0,
        affected_population=15000,
        notes="Baseline check",
    )
    gap_0 = await compute_gap_locally(profile_0)
    print("\n=== Baseline (0% surge) ===")
    for g in gap_0.gaps_by_category:
        status = "DEFICIT" if g.gap_lbs < 0 else "OK"
        print(f"  {g.category:12s}: ratio={g.coverage_ratio:.2f}x  [{status}]")

    # === 1c. 40% surge check (per D-05) ===
    profile_40 = CrisisProfile(
        crisis_type="layoffs",
        geography="Greater Philadelphia",
        severity=4,
        timeline_days=14,
        demand_delta_pct=40,
        affected_population=15000,
        notes="40% surge check",
    )
    gap_40 = await compute_gap_locally(profile_40)
    deficits_40 = [g for g in gap_40.gaps_by_category if g.gap_lbs < 0]
    print(f"\n=== Gap Analysis (40% surge) ===")
    for g in gap_40.gaps_by_category:
        status = "DEFICIT" if g.gap_lbs < 0 else "SURPLUS"
        print(
            f"  {g.category:12s}: gap={g.gap_lbs:>+10,.0f}"
            f"  ratio={g.coverage_ratio:.2f}x"
            f"  [{status}]"
        )
    assert len(deficits_40) >= 3, (
        f"FAIL: Expected 3+ deficits at 40% surge, got {len(deficits_40)}"
    )
    deficit_cats_40 = {g.category for g in deficits_40}
    assert "protein" in deficit_cats_40 and "produce" in deficit_cats_40, (
        "FAIL: protein and produce must be in deficit at 40%"
    )
    print(
        f"  PASS: {len(deficits_40)} deficit categories at 40% surge,"
        " protein and produce included"
    )

    # === 2. Supplier Catalog Verification (DATA-02) ===
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    suppliers_resp = sb.table("suppliers").select("id, name").execute()
    supplier_count = len(suppliers_resp.data)
    print(f"\n=== Supplier Catalog ===")
    print(f"  Suppliers: {supplier_count}")
    for s in suppliers_resp.data:
        print(f"    - {s['name']}")
    assert supplier_count >= 12, f"FAIL: Expected 12+ suppliers, got {supplier_count}"
    print(f"  PASS: {supplier_count} suppliers (>= 12)")

    catalog_resp = (
        sb.table("supplier_catalog").select("*, suppliers(name)").execute()
    )
    catalog_count = len(catalog_resp.data)
    print(f"  Catalog items: {catalog_count}")
    assert catalog_count >= 40, (
        f"FAIL: Expected 40+ catalog items, got {catalog_count}"
    )
    print(f"  PASS: {catalog_count} catalog items (>= 40)")

    # Check all 6 categories covered
    cats_in_catalog = set(item["food_category"] for item in catalog_resp.data)
    expected_cats = {"protein", "grains", "dairy", "produce", "canned", "beverages"}
    assert cats_in_catalog == expected_cats, (
        f"FAIL: Missing categories: {expected_cats - cats_in_catalog}"
    )
    print(f"  PASS: All 6 food categories covered")

    # Check supplier names in catalog
    supplier_names_in_catalog = set()
    for item in catalog_resp.data:
        if item.get("suppliers") and isinstance(item["suppliers"], dict):
            supplier_names_in_catalog.add(item["suppliers"]["name"])
    print(f"  Unique suppliers in catalog: {len(supplier_names_in_catalog)}")
    assert len(supplier_names_in_catalog) >= 12, (
        f"FAIL: Expected 12+ suppliers in catalog, got"
        f" {len(supplier_names_in_catalog)}"
    )
    print(
        f"  PASS: {len(supplier_names_in_catalog)} suppliers represented in catalog"
    )

    # Price tier distribution
    price_tiers = {
        "donated": 0,
        "usda": 0,
        "budget": 0,
        "standard": 0,
        "premium": 0,
    }
    for item in catalog_resp.data:
        p = float(item["price_per_lb"])
        if p == 0:
            price_tiers["donated"] += 1
        elif p <= 0.40:
            price_tiers["usda"] += 1
        elif p <= 1.50:
            price_tiers["budget"] += 1
        elif p <= 2.50:
            price_tiers["standard"] += 1
        else:
            price_tiers["premium"] += 1
    print(f"  Price tiers: {price_tiers}")
    assert price_tiers["donated"] >= 5, (
        f"FAIL: Need 5+ donated items, got {price_tiers['donated']}"
    )
    assert price_tiers["premium"] >= 3, (
        f"FAIL: Need 3+ premium items, got {price_tiers['premium']}"
    )
    print(f"  PASS: Price tier distribution has variety")

    print("\n=== ALL CHECKS PASSED ===")


asyncio.run(main())
