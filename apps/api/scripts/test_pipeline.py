#!/usr/bin/env python3
"""End-to-end pipeline test. Run with: python scripts/test_pipeline.py

Launches pipeline and streams SSE events, printing each one.
"""
import httpx
import time
import sys

BASE = "http://localhost:8000"
SESSION = f"test-{int(time.time())}"

print(f"=== CrisisGrid Pipeline Test ===\n")

# 1. Health check
r = httpx.get(f"{BASE}/")
print(f"[1] Health: {r.json()}")

# 2. Launch pipeline
payload = {
    "session_id": SESSION,
    "crisis_profile": {
        "crisis_type": "layoffs",
        "geography": "Greater Philadelphia",
        "severity": 4,
        "timeline_days": 14,
        "demand_delta_pct": 35,
        "affected_population": 15000,
        "notes": "Steel plant closures",
        "food_categories": [],
        "description": "Mass layoffs at Greater Philadelphia manufacturing plants",
    },
}
r = httpx.post(f"{BASE}/api/crisis/launch", json=payload)
print(f"[2] Launch: {r.json()}")

# 3. Stream SSE events
print(f"[3] Streaming events for session {SESSION}...\n")
event_count = 0
with httpx.stream("GET", f"{BASE}/api/crisis/stream/{SESSION}", timeout=45.0) as response:
    for line in response.iter_lines():
        if line.startswith("event:"):
            event_type = line.split(":", 1)[1].strip()
        elif line.startswith("data:"):
            event_count += 1
            import json
            data = json.loads(line.split(":", 1)[1].strip())
            etype = data.get("type", "?")

            if etype == "assess_complete":
                gap = data["gap_analysis"]
                deficits = [g for g in gap["gaps_by_category"] if g["gap_lbs"] < 0]
                print(f"  [{event_count}] {etype}: {len(deficits)} deficit categories")
                for d in deficits:
                    print(f"       {d['category']}: {d['gap_lbs']:+,.0f} lbs")
                summary = gap.get("ai_summary", "")
                if summary:
                    print(f"       AI: {summary[:120]}...")
            elif etype == "hex_assess_ready":
                print(f"  [{event_count}] {etype}: {data.get('run_url', '?')[:80]}")
            elif etype == "source_found":
                s = data["source"]
                print(f"  [{event_count}] {etype}: [{s['source_type']}] {s['supplier_name'][:40]} - {s['item_name']}")
            elif etype == "discover_complete":
                print(f"  [{event_count}] {etype}: {data['total_count']} total sources")
            elif etype == "plans_ready":
                plans = data["plans"]
                print(f"  [{event_count}] {etype}: {len(plans)} plans")
                for p in plans:
                    print(f"       {p['name']}: ${p['total_cost']:,.0f} | {p['coverage_pct']:.0f}% coverage | {p['max_lead_time_days']}d lead")
            elif etype == "pipeline_complete":
                print(f"  [{event_count}] {etype}")
            elif etype == "error":
                print(f"  [{event_count}] ERROR: {data.get('message', '?')}")
            else:
                print(f"  [{event_count}] {etype}")

            if etype in ("pipeline_complete", "error"):
                break

print(f"\n=== Done: {event_count} events ===")
