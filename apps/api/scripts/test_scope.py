#!/usr/bin/env python3
"""Test SCOPE chat. Run with: python scripts/test_scope.py

Sends a crisis description and prints the extracted profile.
"""
import httpx
import json
import time

BASE = "http://localhost:8000"
SESSION = f"scope-{int(time.time())}"

print("=== CrisisGrid SCOPE Chat Test ===\n")

message = "Major layoffs at steel plants in Kensington, about 2000 workers losing their jobs next week"
print(f"User: {message}\n")

r = httpx.post(
    f"{BASE}/api/scope/chat",
    json={"session_id": SESSION, "message": message},
    timeout=30.0,
)
data = r.json()

if r.status_code != 200:
    print(f"ERROR {r.status_code}: {json.dumps(data, indent=2)}")
else:
    print(f"AI: {data['response']}\n")
    if data["is_complete"]:
        print("Crisis Profile Extracted:")
        cp = data["crisis_profile"]
        print(f"  Type:       {cp['crisis_type']}")
        print(f"  Geography:  {cp['geography']}")
        print(f"  Severity:   {cp['severity']}/5")
        print(f"  Timeline:   {cp['timeline_days']} days")
        print(f"  Demand +%:  {cp['demand_delta_pct']}%")
        print(f"  Population: {cp['affected_population']:,}")
    else:
        print("(Profile not yet complete — send more messages)")
