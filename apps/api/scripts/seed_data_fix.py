#!/usr/bin/env python3
"""Seed data fix for Phase 8: calibrate supply/demand and expand suppliers.

Run: cd apps/api && python scripts/seed_data_fix.py

This script is idempotent -- safe to re-run. It:
1. Renames existing suppliers to real Greater Philadelphia food bank names
2. Adds 5 new suppliers (reaching 12 total)
3. Clears and rebuilds supplier_catalog with 42 items
4. Clears and rebuilds inventory with calibrated supply totals
5. Updates demand_history rows with calibrated avg_weekly values
"""

import os
import sys
import random
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FOOD_CATEGORIES = ["protein", "grains", "dairy", "produce", "canned", "beverages"]

# Per-category expiration ranges (days from now)
EXPIRATION_RANGES = {
    "produce":   (3, 7),
    "dairy":     (7, 14),
    "protein":   (3, 5),
    "canned":    (180, 730),
    "grains":    (180, 730),
    "beverages": (180, 730),
}

PERISHABLE_CATEGORIES = {"produce", "dairy", "protein"}

# Existing supplier UUIDs (preserve FK references)
EXISTING_SUPPLIER_IDS = {
    "aaaa1111-1111-1111-1111-111111111111": "Philabundance",
    "aaaa2222-2222-2222-2222-222222222222": "SHARE Food Program",
    "aaaa3333-3333-3333-3333-333333333333": "Feeding America Eastern PA",
    "aaaa4444-4444-4444-4444-444444444444": "USDA TEFAP Program",
    "aaaa5555-5555-5555-5555-555555555555": "Chester County Food Bank",
    "aaaa6666-6666-6666-6666-666666666666": "MANNA",
    "aaaa7777-7777-7777-7777-777777777777": "Bucks County Opportunity Council",
}

NEW_SUPPLIER_IDS = {
    "aaaa8888-8888-8888-8888-888888888888": "Montgomery County Food Bank",
    "aaaa9999-9999-9999-9999-999999999999": "Lancaster Farm Fresh Cooperative",
    "aaaabbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb": "Delaware Valley Food Council",
    "aaaacccc-cccc-cccc-cccc-cccccccccccc": "ShopRite Partners",
    "aaaadddd-dddd-dddd-dddd-dddddddddddd": "US Foods Philadelphia",
}

# Site UUIDs (for inventory and demand distribution)
SITE_IDS = {
    "11111111-1111-1111-1111-111111111111": {"name": "Philabundance Warehouse", "type": "warehouse"},
    "22222222-2222-2222-2222-222222222222": {"name": "Share Food Program Warehouse", "type": "warehouse"},
    "33333333-3333-3333-3333-333333333333": {"name": "Camden County Food Bank", "type": "distribution_site"},
    "44444444-4444-4444-4444-444444444444": {"name": "Chester Aid Center", "type": "distribution_site"},
    "55555555-5555-5555-5555-555555555555": {"name": "Kensington Food Hub", "type": "distribution_site"},
    "66666666-6666-6666-6666-666666666666": {"name": "North Philly Distribution", "type": "distribution_site"},
    "77777777-7777-7777-7777-777777777777": {"name": "South Philly Pantry", "type": "distribution_site"},
    "88888888-8888-8888-8888-888888888888": {"name": "West Philly Community Center", "type": "distribution_site"},
}

DIST_SITES = [sid for sid, info in SITE_IDS.items() if info["type"] == "distribution_site"]
WAREHOUSE_SITES = [sid for sid, info in SITE_IDS.items() if info["type"] == "warehouse"]

# Stressed North Philly sites
STRESSED_SITES = [
    "55555555-5555-5555-5555-555555555555",  # Kensington Food Hub
    "66666666-6666-6666-6666-666666666666",  # North Philly Distribution
]

# ---------------------------------------------------------------------------
# Step 1: Rename/upsert existing suppliers
# ---------------------------------------------------------------------------

def step1_upsert_existing_suppliers():
    print("Step 1: Renaming existing suppliers to real Greater Philadelphia names...")

    suppliers = [
        {
            "id": "aaaa1111-1111-1111-1111-111111111111",
            "name": "Philabundance",
            "address": "3616 S Galloway St, Philadelphia, PA 19148",
            "lat": 39.9097,
            "lng": -75.1603,
            "type": "partner_food_bank",
            "relationship_status": "active_partner",
            "typical_lead_time_hours": 6,
            "reliability_score": 0.95,
            "max_delivery_radius_miles": 40,
        },
        {
            "id": "aaaa2222-2222-2222-2222-222222222222",
            "name": "SHARE Food Program",
            "address": "2901 W Hunting Park Ave, Philadelphia, PA 19129",
            "lat": 39.9916,
            "lng": -75.1680,
            "type": "partner_food_bank",
            "relationship_status": "active_partner",
            "typical_lead_time_hours": 8,
            "reliability_score": 0.92,
            "max_delivery_radius_miles": 35,
        },
        {
            "id": "aaaa3333-3333-3333-3333-333333333333",
            "name": "Feeding America Eastern PA",
            "address": "1 Penn Center, 1617 JFK Blvd, Philadelphia, PA 19103",
            "lat": 39.9536,
            "lng": -75.1674,
            "type": "partner_food_bank",
            "relationship_status": "active_partner",
            "typical_lead_time_hours": 24,
            "reliability_score": 0.90,
            "max_delivery_radius_miles": 60,
        },
        {
            "id": "aaaa4444-4444-4444-4444-444444444444",
            "name": "USDA TEFAP Program",
            "address": "1400 Independence Ave SW, Washington, DC 20250",
            "lat": 38.8867,
            "lng": -77.0300,
            "type": "usda_program",
            "relationship_status": "active_partner",
            "typical_lead_time_hours": 120,
            "reliability_score": 0.85,
            "max_delivery_radius_miles": 200,
        },
        {
            "id": "aaaa5555-5555-5555-5555-555555555555",
            "name": "Chester County Food Bank",
            "address": "660 Downingtown Pike, West Chester, PA 19380",
            "lat": 39.9607,
            "lng": -75.6055,
            "type": "partner_food_bank",
            "relationship_status": "active_partner",
            "typical_lead_time_hours": 24,
            "reliability_score": 0.88,
            "max_delivery_radius_miles": 40,
        },
        {
            "id": "aaaa6666-6666-6666-6666-666666666666",
            "name": "MANNA",
            "address": "420 N 20th St, Philadelphia, PA 19130",
            "lat": 39.9621,
            "lng": -75.1734,
            "type": "partner_food_bank",
            "relationship_status": "active_partner",
            "typical_lead_time_hours": 12,
            "reliability_score": 0.90,
            "max_delivery_radius_miles": 25,
        },
        {
            "id": "aaaa7777-7777-7777-7777-777777777777",
            "name": "Bucks County Opportunity Council",
            "address": "721 Bath Rd, Bristol, PA 19007",
            "lat": 40.1051,
            "lng": -74.8599,
            "type": "partner_food_bank",
            "relationship_status": "active_partner",
            "typical_lead_time_hours": 18,
            "reliability_score": 0.86,
            "max_delivery_radius_miles": 35,
        },
    ]

    sb.table("suppliers").upsert(suppliers).execute()
    print(f"  Upserted {len(suppliers)} existing suppliers")


# ---------------------------------------------------------------------------
# Step 2: Add new suppliers
# ---------------------------------------------------------------------------

def step2_add_new_suppliers():
    print("Step 2: Adding 5 new suppliers...")

    new_suppliers = [
        {
            "id": "aaaa8888-8888-8888-8888-888888888888",
            "name": "Montgomery County Food Bank",
            "address": "1 W Main St, Lansdale, PA 19446",
            "lat": 40.2415,
            "lng": -75.2838,
            "type": "partner_food_bank",
            "relationship_status": "active_partner",
            "typical_lead_time_hours": 24,
            "reliability_score": 0.87,
            "max_delivery_radius_miles": 40,
        },
        {
            "id": "aaaa9999-9999-9999-9999-999999999999",
            "name": "Lancaster Farm Fresh Cooperative",
            "address": "512 W Chestnut St, Lancaster, PA 17603",
            "lat": 40.0379,
            "lng": -76.3055,
            "type": "wholesale",
            "relationship_status": "active_partner",
            "typical_lead_time_hours": 36,
            "reliability_score": 0.82,
            "max_delivery_radius_miles": 60,
        },
        {
            "id": "aaaabbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "name": "Delaware Valley Food Council",
            "address": "30 S 15th St, Philadelphia, PA 19102",
            "lat": 39.9512,
            "lng": -75.1660,
            "type": "partner_food_bank",
            "relationship_status": "active_partner",
            "typical_lead_time_hours": 48,
            "reliability_score": 0.80,
            "max_delivery_radius_miles": 40,
        },
        {
            "id": "aaaacccc-cccc-cccc-cccc-cccccccccccc",
            "name": "ShopRite Partners",
            "address": "2 Paragon Dr, Montvale, NJ 07645",
            "lat": 41.0465,
            "lng": -74.0538,
            "type": "grocery_chain",
            "relationship_status": "active_partner",
            "typical_lead_time_hours": 12,
            "reliability_score": 0.92,
            "max_delivery_radius_miles": 40,
        },
        {
            "id": "aaaadddd-dddd-dddd-dddd-dddddddddddd",
            "name": "US Foods Philadelphia",
            "address": "300 Commerce Dr, Swedesboro, NJ 08085",
            "lat": 39.7476,
            "lng": -75.3105,
            "type": "wholesale",
            "relationship_status": "active_partner",
            "typical_lead_time_hours": 8,
            "reliability_score": 0.93,
            "max_delivery_radius_miles": 40,
        },
    ]

    sb.table("suppliers").upsert(new_suppliers).execute()
    print(f"  Added {len(new_suppliers)} new suppliers (12 total)")


# ---------------------------------------------------------------------------
# Step 3: Clear and rebuild supplier_catalog (42 items)
# ---------------------------------------------------------------------------

def step3_rebuild_catalog():
    print("Step 3: Clearing and rebuilding supplier_catalog with 42 items...")

    # Delete all existing catalog rows
    # Supabase requires a filter for delete -- use neq on a non-null field
    sb.table("supplier_catalog").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    catalog_items = [
        # ---- PROTEIN (8 items) ----
        {
            "supplier_id": "aaaa1111-1111-1111-1111-111111111111",
            "food_category": "protein",
            "subcategory": "frozen chicken breast",
            "estimated_qty_available_lbs": 3000,
            "price_per_lb": 0.00,
            "min_order_lbs": 200,
        },
        {
            "supplier_id": "aaaa4444-4444-4444-4444-444444444444",
            "food_category": "protein",
            "subcategory": "USDA commodity beef",
            "estimated_qty_available_lbs": 5000,
            "price_per_lb": 0.25,
            "min_order_lbs": 500,
        },
        {
            "supplier_id": "aaaa5555-5555-5555-5555-555555555555",
            "food_category": "protein",
            "subcategory": "canned tuna",
            "estimated_qty_available_lbs": 2000,
            "price_per_lb": 0.00,
            "min_order_lbs": 100,
        },
        {
            "supplier_id": "aaaa2222-2222-2222-2222-222222222222",
            "food_category": "protein",
            "subcategory": "frozen ground turkey",
            "estimated_qty_available_lbs": 2500,
            "price_per_lb": 0.35,
            "min_order_lbs": 300,
        },
        {
            "supplier_id": "aaaadddd-dddd-dddd-dddd-dddddddddddd",
            "food_category": "protein",
            "subcategory": "fresh chicken thighs",
            "estimated_qty_available_lbs": 4000,
            "price_per_lb": 1.80,
            "min_order_lbs": 200,
        },
        {
            "supplier_id": "aaaacccc-cccc-cccc-cccc-cccccccccccc",
            "food_category": "protein",
            "subcategory": "frozen salmon portions",
            "estimated_qty_available_lbs": 1500,
            "price_per_lb": 3.20,
            "min_order_lbs": 100,
        },
        {
            "supplier_id": "aaaa8888-8888-8888-8888-888888888888",
            "food_category": "protein",
            "subcategory": "canned chicken",
            "estimated_qty_available_lbs": 1800,
            "price_per_lb": 0.00,
            "min_order_lbs": 150,
        },
        {
            "supplier_id": "aaaa9999-9999-9999-9999-999999999999",
            "food_category": "protein",
            "subcategory": "farm-raised eggs (by weight)",
            "estimated_qty_available_lbs": 1000,
            "price_per_lb": 2.80,
            "min_order_lbs": 100,
        },

        # ---- PRODUCE (8 items) ----
        {
            "supplier_id": "aaaa9999-9999-9999-9999-999999999999",
            "food_category": "produce",
            "subcategory": "seasonal vegetable mix",
            "estimated_qty_available_lbs": 5000,
            "price_per_lb": 1.30,
            "min_order_lbs": 200,
        },
        {
            "supplier_id": "aaaa1111-1111-1111-1111-111111111111",
            "food_category": "produce",
            "subcategory": "donated fresh fruit",
            "estimated_qty_available_lbs": 2000,
            "price_per_lb": 0.00,
            "min_order_lbs": 100,
        },
        {
            "supplier_id": "aaaabbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "food_category": "produce",
            "subcategory": "community garden surplus",
            "estimated_qty_available_lbs": 1500,
            "price_per_lb": 0.00,
            "min_order_lbs": 50,
        },
        {
            "supplier_id": "aaaa2222-2222-2222-2222-222222222222",
            "food_category": "produce",
            "subcategory": "root vegetables",
            "estimated_qty_available_lbs": 2500,
            "price_per_lb": 0.90,
            "min_order_lbs": 200,
        },
        {
            "supplier_id": "aaaacccc-cccc-cccc-cccc-cccccccccccc",
            "food_category": "produce",
            "subcategory": "bagged salad mix",
            "estimated_qty_available_lbs": 3000,
            "price_per_lb": 2.50,
            "min_order_lbs": 100,
        },
        {
            "supplier_id": "aaaa5555-5555-5555-5555-555555555555",
            "food_category": "produce",
            "subcategory": "canned tomatoes",
            "estimated_qty_available_lbs": 2000,
            "price_per_lb": 0.20,
            "min_order_lbs": 200,
        },
        {
            "supplier_id": "aaaadddd-dddd-dddd-dddd-dddddddddddd",
            "food_category": "produce",
            "subcategory": "frozen mixed vegetables",
            "estimated_qty_available_lbs": 3500,
            "price_per_lb": 1.10,
            "min_order_lbs": 300,
        },
        {
            "supplier_id": "aaaa8888-8888-8888-8888-888888888888",
            "food_category": "produce",
            "subcategory": "fresh apples",
            "estimated_qty_available_lbs": 1800,
            "price_per_lb": 0.80,
            "min_order_lbs": 150,
        },

        # ---- DAIRY (7 items) ----
        {
            "supplier_id": "aaaa4444-4444-4444-4444-444444444444",
            "food_category": "dairy",
            "subcategory": "USDA commodity cheese",
            "estimated_qty_available_lbs": 3000,
            "price_per_lb": 0.30,
            "min_order_lbs": 500,
        },
        {
            "supplier_id": "aaaa1111-1111-1111-1111-111111111111",
            "food_category": "dairy",
            "subcategory": "donated yogurt",
            "estimated_qty_available_lbs": 1500,
            "price_per_lb": 0.00,
            "min_order_lbs": 100,
        },
        {
            "supplier_id": "aaaacccc-cccc-cccc-cccc-cccccccccccc",
            "food_category": "dairy",
            "subcategory": "whole milk (gallons)",
            "estimated_qty_available_lbs": 2500,
            "price_per_lb": 1.50,
            "min_order_lbs": 200,
        },
        {
            "supplier_id": "aaaa2222-2222-2222-2222-222222222222",
            "food_category": "dairy",
            "subcategory": "shelf-stable milk",
            "estimated_qty_available_lbs": 2000,
            "price_per_lb": 0.85,
            "min_order_lbs": 150,
        },
        {
            "supplier_id": "aaaa9999-9999-9999-9999-999999999999",
            "food_category": "dairy",
            "subcategory": "artisan cheese",
            "estimated_qty_available_lbs": 800,
            "price_per_lb": 3.50,
            "min_order_lbs": 50,
        },
        {
            "supplier_id": "aaaa7777-7777-7777-7777-777777777777",
            "food_category": "dairy",
            "subcategory": "butter and cream",
            "estimated_qty_available_lbs": 1200,
            "price_per_lb": 2.20,
            "min_order_lbs": 100,
        },
        {
            "supplier_id": "aaaa8888-8888-8888-8888-888888888888",
            "food_category": "dairy",
            "subcategory": "donated milk",
            "estimated_qty_available_lbs": 1800,
            "price_per_lb": 0.00,
            "min_order_lbs": 100,
        },

        # ---- GRAINS (7 items) ----
        {
            "supplier_id": "aaaa3333-3333-3333-3333-333333333333",
            "food_category": "grains",
            "subcategory": "bulk rice",
            "estimated_qty_available_lbs": 6000,
            "price_per_lb": 0.15,
            "min_order_lbs": 500,
        },
        {
            "supplier_id": "aaaa4444-4444-4444-4444-444444444444",
            "food_category": "grains",
            "subcategory": "USDA commodity flour",
            "estimated_qty_available_lbs": 4000,
            "price_per_lb": 0.20,
            "min_order_lbs": 500,
        },
        {
            "supplier_id": "aaaa2222-2222-2222-2222-222222222222",
            "food_category": "grains",
            "subcategory": "donated bread",
            "estimated_qty_available_lbs": 2000,
            "price_per_lb": 0.00,
            "min_order_lbs": 100,
        },
        {
            "supplier_id": "aaaa7777-7777-7777-7777-777777777777",
            "food_category": "grains",
            "subcategory": "bulk pasta",
            "estimated_qty_available_lbs": 3000,
            "price_per_lb": 0.00,
            "min_order_lbs": 200,
        },
        {
            "supplier_id": "aaaacccc-cccc-cccc-cccc-cccccccccccc",
            "food_category": "grains",
            "subcategory": "whole wheat bread",
            "estimated_qty_available_lbs": 2500,
            "price_per_lb": 1.40,
            "min_order_lbs": 100,
        },
        {
            "supplier_id": "aaaadddd-dddd-dddd-dddd-dddddddddddd",
            "food_category": "grains",
            "subcategory": "bulk oats",
            "estimated_qty_available_lbs": 3500,
            "price_per_lb": 0.90,
            "min_order_lbs": 300,
        },
        {
            "supplier_id": "aaaa6666-6666-6666-6666-666666666666",
            "food_category": "grains",
            "subcategory": "prepared grain bowls",
            "estimated_qty_available_lbs": 1000,
            "price_per_lb": 2.80,
            "min_order_lbs": 50,
        },

        # ---- CANNED (6 items) ----
        {
            "supplier_id": "aaaa3333-3333-3333-3333-333333333333",
            "food_category": "canned",
            "subcategory": "canned soup variety",
            "estimated_qty_available_lbs": 4000,
            "price_per_lb": 0.00,
            "min_order_lbs": 200,
        },
        {
            "supplier_id": "aaaa4444-4444-4444-4444-444444444444",
            "food_category": "canned",
            "subcategory": "USDA canned vegetables",
            "estimated_qty_available_lbs": 3500,
            "price_per_lb": 0.18,
            "min_order_lbs": 500,
        },
        {
            "supplier_id": "aaaa1111-1111-1111-1111-111111111111",
            "food_category": "canned",
            "subcategory": "canned fruit",
            "estimated_qty_available_lbs": 2500,
            "price_per_lb": 0.00,
            "min_order_lbs": 150,
        },
        {
            "supplier_id": "aaaa5555-5555-5555-5555-555555555555",
            "food_category": "canned",
            "subcategory": "canned beans variety",
            "estimated_qty_available_lbs": 2000,
            "price_per_lb": 0.15,
            "min_order_lbs": 200,
        },
        {
            "supplier_id": "aaaa8888-8888-8888-8888-888888888888",
            "food_category": "canned",
            "subcategory": "donated canned meals",
            "estimated_qty_available_lbs": 1500,
            "price_per_lb": 0.00,
            "min_order_lbs": 100,
        },
        {
            "supplier_id": "aaaacccc-cccc-cccc-cccc-cccccccccccc",
            "food_category": "canned",
            "subcategory": "premium canned goods",
            "estimated_qty_available_lbs": 2000,
            "price_per_lb": 1.20,
            "min_order_lbs": 100,
        },

        # ---- BEVERAGES (6 items) ----
        {
            "supplier_id": "aaaa1111-1111-1111-1111-111111111111",
            "food_category": "beverages",
            "subcategory": "donated bottled water",
            "estimated_qty_available_lbs": 3000,
            "price_per_lb": 0.00,
            "min_order_lbs": 200,
        },
        {
            "supplier_id": "aaaa2222-2222-2222-2222-222222222222",
            "food_category": "beverages",
            "subcategory": "juice boxes",
            "estimated_qty_available_lbs": 2000,
            "price_per_lb": 0.80,
            "min_order_lbs": 150,
        },
        {
            "supplier_id": "aaaabbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "food_category": "beverages",
            "subcategory": "community water drive",
            "estimated_qty_available_lbs": 1500,
            "price_per_lb": 0.00,
            "min_order_lbs": 100,
        },
        {
            "supplier_id": "aaaacccc-cccc-cccc-cccc-cccccccccccc",
            "food_category": "beverages",
            "subcategory": "shelf-stable juice",
            "estimated_qty_available_lbs": 2500,
            "price_per_lb": 1.10,
            "min_order_lbs": 100,
        },
        {
            "supplier_id": "aaaadddd-dddd-dddd-dddd-dddddddddddd",
            "food_category": "beverages",
            "subcategory": "bulk coffee",
            "estimated_qty_available_lbs": 1000,
            "price_per_lb": 3.00,
            "min_order_lbs": 50,
        },
        {
            "supplier_id": "aaaa3333-3333-3333-3333-333333333333",
            "food_category": "beverages",
            "subcategory": "donated sports drinks",
            "estimated_qty_available_lbs": 1800,
            "price_per_lb": 0.00,
            "min_order_lbs": 100,
        },
    ]

    sb.table("supplier_catalog").insert(catalog_items).execute()
    print(f"  Inserted {len(catalog_items)} catalog items")


# ---------------------------------------------------------------------------
# Step 4: Clear and rebuild inventory with calibrated supply totals
# ---------------------------------------------------------------------------

def step4_rebuild_inventory():
    print("Step 4: Clearing and rebuilding inventory with calibrated supply totals...")

    # Delete all existing inventory
    sb.table("inventory").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    # Target supply totals (network-wide)
    # protein: 20,000 | grains: 26,000 | dairy: 11,000
    # produce: 13,000 | canned: 24,000 | beverages: 8,500
    supply_targets = {
        "protein": 20000,
        "grains": 26000,
        "dairy": 11000,
        "produce": 13000,
        "canned": 24000,
        "beverages": 8500,
    }

    # Source type and cost by category
    category_meta = {
        "protein":    {"source_type": "purchased", "unit_cost_dollars": 1.50, "subcategory": "mixed protein"},
        "grains":     {"source_type": "usda_commodity", "unit_cost_dollars": 0.25, "subcategory": "mixed grains"},
        "dairy":      {"source_type": "purchased", "unit_cost_dollars": 1.50, "subcategory": "mixed dairy"},
        "produce":    {"source_type": "purchased", "unit_cost_dollars": 1.50, "subcategory": "mixed produce"},
        "canned":     {"source_type": "donated", "unit_cost_dollars": 0.00, "subcategory": "mixed canned goods"},
        "beverages":  {"source_type": "donated", "unit_cost_dollars": 0.00, "subcategory": "mixed beverages"},
    }

    # Distribution percentages across sites:
    # 2 warehouses get ~25% each (50% total)
    # 4 healthy dist sites get ~8% each (32% total)
    # 2 stressed sites get ~9% each (18% total) -- but for protein/produce, stressed get less
    #
    # For protein/produce (stressed sites get LESS supply -- they're pre-stressed):
    #   warehouse 1: 17%, warehouse 2: 17%, healthy sites: 10% each, stressed: 7% each
    # For other categories (normal distribution):
    #   warehouse 1: 15%, warehouse 2: 15%, healthy sites: 10% each, stressed: 10% each

    now = datetime.now(timezone.utc)
    received = (now - timedelta(days=7)).strftime("%Y-%m-%d")

    # Seeded RNG for deterministic expiration date generation
    rng = random.Random(42)

    def make_expiration(category: str, near_term: bool = False) -> str:
        """Generate expiration date based on category and near-term flag."""
        if near_term:
            ranges = {"produce": (1, 4), "dairy": (2, 7), "protein": (1, 4)}
            lo, hi = ranges.get(category, (1, 7))
        else:
            lo, hi = EXPIRATION_RANGES[category]
        days = rng.randint(lo, hi)
        return (now + timedelta(days=days)).strftime("%Y-%m-%d")

    inventory_rows = []

    healthy_dist = [s for s in DIST_SITES if s not in STRESSED_SITES]

    for cat, total in supply_targets.items():
        meta = category_meta[cat]

        if cat in ("protein", "produce"):
            # Stressed sites get less supply
            w1_pct, w2_pct = 0.17, 0.17
            healthy_pct = 0.10  # per site, 4 sites = 40%
            stressed_pct = 0.07  # per site, 2 sites = 14%
            # Remaining adjusts: 17+17+40+14 = 88, distribute remainder to warehouses
            remainder = total - int(total * (w1_pct + w2_pct + 4 * healthy_pct + 2 * stressed_pct))
        else:
            w1_pct, w2_pct = 0.15, 0.15
            healthy_pct = 0.10
            stressed_pct = 0.10
            remainder = total - int(total * (w1_pct + w2_pct + 4 * healthy_pct + 2 * stressed_pct))

        def _add_inventory_rows(site_id: str, qty: int, cat: str = cat, meta: dict = meta):
            """Add one or two inventory rows depending on perishability."""
            if cat in PERISHABLE_CATEGORIES:
                # Split: ~70% normal expiration, ~30% near-term expiration
                qty_normal = int(qty * 0.70)
                qty_near = qty - qty_normal
                inventory_rows.append({
                    "site_id": site_id,
                    "food_category": cat,
                    "subcategory": meta["subcategory"],
                    "quantity_lbs": qty_normal,
                    "unit_cost_dollars": meta["unit_cost_dollars"],
                    "expiration_date": make_expiration(cat, near_term=False),
                    "received_date": received,
                    "source_type": meta["source_type"],
                    "status": "available",
                })
                inventory_rows.append({
                    "site_id": site_id,
                    "food_category": cat,
                    "subcategory": meta["subcategory"],
                    "quantity_lbs": qty_near,
                    "unit_cost_dollars": meta["unit_cost_dollars"],
                    "expiration_date": make_expiration(cat, near_term=True),
                    "received_date": received,
                    "source_type": meta["source_type"],
                    "status": "available",
                })
            else:
                # Non-perishable: single row with normal expiration
                inventory_rows.append({
                    "site_id": site_id,
                    "food_category": cat,
                    "subcategory": meta["subcategory"],
                    "quantity_lbs": qty,
                    "unit_cost_dollars": meta["unit_cost_dollars"],
                    "expiration_date": make_expiration(cat, near_term=False),
                    "received_date": received,
                    "source_type": meta["source_type"],
                    "status": "available",
                })

        # Warehouse 1
        qty_w1 = int(total * w1_pct) + remainder // 2
        _add_inventory_rows(WAREHOUSE_SITES[0], qty_w1)

        # Warehouse 2
        qty_w2 = int(total * w2_pct) + (remainder - remainder // 2)
        _add_inventory_rows(WAREHOUSE_SITES[1], qty_w2)

        # 4 healthy dist sites
        for site_id in healthy_dist:
            qty = int(total * healthy_pct)
            _add_inventory_rows(site_id, qty)

        # 2 stressed sites
        for site_id in STRESSED_SITES:
            qty = int(total * stressed_pct)
            _add_inventory_rows(site_id, qty)

    sb.table("inventory").insert(inventory_rows).execute()

    # Verify totals
    print(f"  Inserted {len(inventory_rows)} inventory rows")
    for cat in FOOD_CATEGORIES:
        cat_total = sum(r["quantity_lbs"] for r in inventory_rows if r["food_category"] == cat)
        print(f"    {cat:12s}: {cat_total:>8,} lbs")

    # Report near-term expiration for perishables
    near_term_lbs = sum(
        r["quantity_lbs"] for r in inventory_rows
        if r["food_category"] in PERISHABLE_CATEGORIES
        and datetime.strptime(r["expiration_date"], "%Y-%m-%d").replace(tzinfo=timezone.utc) < now + timedelta(days=14)
    )
    total_lbs = sum(r["quantity_lbs"] for r in inventory_rows)
    print(f"\n  Near-term expiration (14-day): {near_term_lbs:,.0f} lbs ({near_term_lbs/total_lbs*100:.1f}% of total)")


# ---------------------------------------------------------------------------
# Step 5: Update demand_history to hit target avg_weekly values
# ---------------------------------------------------------------------------

def step5_update_demand_history():
    print("Step 5: Updating demand_history to calibrated avg_weekly values...")

    # Target avg_weekly values (mean across ALL demand_history rows for each category)
    # With 48 rows per category (6 sites x 8 weeks), sum = target * 48
    targets = {
        "protein": 9500,
        "grains": 7500,
        "dairy": 5000,
        "produce": 6500,
        "canned": 7000,
        "beverages": 3800,
    }

    # Query all demand_history rows
    resp = sb.table("demand_history").select("id, site_id, food_category, quantity_demanded_lbs").execute()
    rows = resp.data

    # Group by category
    by_category = {cat: [] for cat in FOOD_CATEGORIES}
    for row in rows:
        cat = row["food_category"]
        if cat in by_category:
            by_category[cat].append(row)

    random.seed(42)  # Reproducible variation

    for cat, cat_rows in by_category.items():
        target_avg = targets[cat]
        n = len(cat_rows)
        if n == 0:
            print(f"  WARNING: No demand_history rows for {cat}")
            continue

        # Compute base value per row so average = target
        # Sum of all values / n = target_avg
        # So total sum = target_avg * n
        total_needed = target_avg * n

        # Distribute with variation: each row gets base +/- 10%
        # North Philly stressed sites get 15-20% above average for protein and produce
        values = []
        for row in cat_rows:
            is_stressed = row["site_id"] in STRESSED_SITES
            if is_stressed and cat in ("protein", "produce"):
                # Stressed sites have HIGHER demand (they need more food)
                base = target_avg * 1.18
            elif is_stressed:
                base = target_avg * 1.08
            else:
                base = target_avg * 0.96  # slightly below to compensate
            # Add random variation +/- 10%
            val = base * (1 + random.uniform(-0.10, 0.10))
            values.append(val)

        # Scale values so they sum to total_needed exactly
        current_sum = sum(values)
        scale_factor = total_needed / current_sum
        values = [v * scale_factor for v in values]

        # Update each row
        for row, val in zip(cat_rows, values):
            sb.table("demand_history").update(
                {"quantity_demanded_lbs": round(val, 1)}
            ).eq("id", row["id"]).execute()

        actual_avg = sum(values) / n
        print(f"    {cat:12s}: target_avg={target_avg:>8,}  actual_avg={actual_avg:>10,.1f}  rows={n}")


# ---------------------------------------------------------------------------
# Step 6: Print summary
# ---------------------------------------------------------------------------

def step6_summary():
    print("\n" + "=" * 60)
    print("SEED DATA FIX COMPLETE")
    print("=" * 60)

    # Count suppliers
    suppliers = sb.table("suppliers").select("id, name").execute()
    print(f"\nSuppliers: {len(suppliers.data)}")
    for s in suppliers.data:
        print(f"  - {s['name']}")

    # Count catalog items
    catalog = sb.table("supplier_catalog").select("id, food_category").execute()
    print(f"\nCatalog items: {len(catalog.data)}")
    cats = {}
    for item in catalog.data:
        c = item["food_category"]
        cats[c] = cats.get(c, 0) + 1
    for c, count in sorted(cats.items()):
        print(f"  {c:12s}: {count} items")

    # Count inventory
    inv = sb.table("inventory").select("food_category, quantity_lbs").eq("status", "available").execute()
    print(f"\nInventory rows: {len(inv.data)}")
    inv_totals = {}
    for row in inv.data:
        c = row["food_category"]
        inv_totals[c] = inv_totals.get(c, 0) + float(row["quantity_lbs"])
    for c in FOOD_CATEGORIES:
        print(f"  {c:12s}: {inv_totals.get(c, 0):>10,.0f} lbs")

    # Demand history stats
    demand = sb.table("demand_history").select("food_category, quantity_demanded_lbs").execute()
    print(f"\nDemand history rows: {len(demand.data)}")
    demand_by_cat = {c: [] for c in FOOD_CATEGORIES}
    for row in demand.data:
        c = row["food_category"]
        if c in demand_by_cat:
            demand_by_cat[c].append(float(row["quantity_demanded_lbs"]))
    for c in FOOD_CATEGORIES:
        vals = demand_by_cat[c]
        avg = sum(vals) / len(vals) if vals else 0
        print(f"  {c:12s}: avg_weekly={avg:>10,.1f}  rows={len(vals)}")


# ---------------------------------------------------------------------------
# Step 7: Recompute health scores for all sites (per A1)
# ---------------------------------------------------------------------------

def step7_recompute_health_scores():
    """Recompute health scores for all sites after inventory rebuild.

    Calls the compute_health_score Postgres RPC function for each site
    and prints before/after comparison for coherence verification.
    """
    print("\nStep 7: Recomputing health scores for all sites...")

    # Get current (stale) health scores
    sites = sb.table("sites").select("id, name, type, health_score").execute()

    before_scores = {}
    for s in sites.data:
        before_scores[s["id"]] = {
            "name": s["name"],
            "site_type": s.get("type", "unknown"),
            "old_score": float(s["health_score"]) if s["health_score"] is not None else 0.0,
        }

    # Recompute each site's health score via RPC and update the table
    for site_id, info in before_scores.items():
        try:
            result = sb.rpc("compute_health_score", {"target_site_id": site_id}).execute()
            new_score = float(result.data) if result.data is not None else 0.0
            # RPC returns value but does not update the table -- do it explicitly
            sb.table("sites").update({"health_score": round(new_score, 4)}).eq("id", site_id).execute()
        except Exception as e:
            print(f"  WARNING: compute_health_score failed for {info['name']}: {e}")
            new_score = info["old_score"]

        info["new_score"] = new_score

    # Read back final scores from DB
    final_sites = sb.table("sites").select("id, health_score").execute()
    final_scores = {s["id"]: float(s["health_score"]) if s["health_score"] is not None else 0.0 for s in final_sites.data}

    # Print coherence report
    print(f"\n  {'Site':<35s} {'Type':<20s} {'Before':>8s} {'After':>8s} {'DB':>8s}")
    print(f"  {'-'*35} {'-'*20} {'-'*8} {'-'*8} {'-'*8}")
    for site_id, info in before_scores.items():
        db_score = final_scores.get(site_id, 0.0)
        print(f"  {info['name']:<35s} {info['site_type']:<20s} {info['old_score']:>8.3f} {info['new_score']:>8.3f} {db_score:>8.3f}")

    # Get inventory per site for coherence check
    inv_resp = sb.table("inventory").select("site_id, food_category, quantity_lbs").eq("status", "available").execute()
    site_inv: dict[str, dict[str, float]] = {}
    for row in inv_resp.data:
        sid = row["site_id"]
        if sid not in site_inv:
            site_inv[sid] = {"total_lbs": 0.0, "categories": set()}
        site_inv[sid]["total_lbs"] += float(row["quantity_lbs"])
        site_inv[sid]["categories"].add(row["food_category"])

    print(f"\n  Health Score Coherence Report:")
    print(f"  {'Site':<35s} {'Score':>8s} {'Inv (lbs)':>12s} {'Categories':>12s}")
    print(f"  {'-'*35} {'-'*8} {'-'*12} {'-'*12}")
    for site_id, info in before_scores.items():
        inv = site_inv.get(site_id, {"total_lbs": 0.0, "categories": set()})
        score = final_scores.get(site_id, 0.0)
        n_cats = len(inv["categories"]) if isinstance(inv["categories"], set) else 0
        print(f"  {info['name']:<35s} {score:>8.3f} {inv['total_lbs']:>12,.0f} {n_cats:>12d}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("CrisisGrid Seed Data Fix (Phase 8 + Phase 13)")
    print("=" * 60)
    print()

    step1_upsert_existing_suppliers()
    step2_add_new_suppliers()
    step3_rebuild_catalog()
    step4_rebuild_inventory()
    step5_update_demand_history()
    step6_summary()
    step7_recompute_health_scores()

    print("\nDone! Run 'python scripts/verify_seed.py' to verify gap analysis.")
