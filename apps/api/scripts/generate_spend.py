#!/usr/bin/env python3
"""
Generate spend on Gemini 2.5 Flash and GPT-4.1-mini via Lava gateway.

Calls each model repeatedly until target spend is reached:
  - gemini-2.5-flash: $0.05
  - gpt-4.1-mini: $0.04

Run with: python3 scripts/generate_spend.py
"""

import os
import json
import time
import httpx
import threading
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

LAVA_SPEND_KEY = os.environ.get("LAVA_SPEND_KEY", "")
LAVA_SECRET_KEY = os.environ.get("LAVA_API_TOKEN", "")
LAVA_BASE = os.environ.get("LAVA_BASE_URL", "https://api.lava.so")

if not LAVA_SPEND_KEY:
    print("ERROR: LAVA_SPEND_KEY not set in .env — spend won't be tracked per-model")
    sys.exit(1)

# Use spend key for all LLM calls so costs are tracked and attributable
HEADERS = {
    "Authorization": f"Bearer {LAVA_SPEND_KEY}",
    "Content-Type": "application/json",
}

# Targets in dollars
TARGETS = {
    "gemini-2.5-flash": 0.05,
    "gpt-4.1-mini": 0.04,
}

# Long prompt to maximize input tokens, plus instructions that force long output
SYSTEM_PROMPT = """You are a world-class researcher who writes extremely detailed, comprehensive reports.
You MUST write at least 2000 words in your response. Include specific dates, statistics, names,
and citations. Never abbreviate or summarize. Write the full detailed analysis."""

USER_PROMPT = """Write an extremely detailed and comprehensive report on ALL of the following topics.
You must cover EVERY topic listed below in depth with at least 200 words each:

1. The complete history of food banks in America from 1967 to present day, including founding of
   Feeding America (formerly Second Harvest), key legislation like the Emergency Food Assistance Act,
   and the impact of every major recession on food insecurity.

2. A detailed analysis of supply chain logistics in modern food banking, including cold chain management,
   last-mile delivery challenges, warehouse operations, inventory management systems, and how
   organizations like the Greater Philadelphia Coalition Against Hunger operate.

3. The role of artificial intelligence and machine learning in crisis response coordination, including
   demand forecasting models, route optimization algorithms, donor matching systems, and real-time
   supply-demand gap analysis.

4. A comprehensive overview of federal nutrition assistance programs (SNAP, WIC, TEFAP, CSFP, SFSP)
   including eligibility criteria, benefit levels, participation rates by state, and proposed reforms.

5. Climate change impacts on food security including disruptions to agricultural supply chains,
   extreme weather events affecting food distribution, and adaptation strategies for food banks.

6. The intersection of food insecurity with public health, including nutritional outcomes,
   chronic disease prevalence in food-insecure populations, and evidence-based interventions.

7. Technology platforms and data systems used in modern food banking operations, including
   Salesforce integrations, Link2Feed, Pantry Soft, and custom ERP solutions.

8. A detailed financial analysis of food bank operations including revenue sources, operating costs,
   food sourcing economics, volunteer labor valuation, and cost-per-meal metrics.

9. International comparisons of food banking models including the Global FoodBanking Network,
   European Federation of Food Banks, and differences in approach across developed nations.

10. Future trends and innovations in food security including vertical farming partnerships,
    blockchain-based food tracking, drone delivery pilots, and AI-powered nutritional planning.

Write the COMPLETE report now. Do not skip any section. Each section must be substantive."""


def call_model(model: str, max_tokens: int = 8192) -> dict:
    """Make a single chat completion call via Lava."""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_PROMPT},
        ],
        "max_tokens": max_tokens,
    }
    resp = httpx.post(
        f"{LAVA_BASE}/v1/chat/completions",
        headers=HEADERS,
        json=payload,
        timeout=120.0,
    )
    resp.raise_for_status()
    return resp.json()


def estimate_cost(model: str, response: dict) -> float:
    """Estimate cost from token usage. Includes thinking tokens if present."""
    usage = response.get("usage", {})
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)

    # Check for thinking/reasoning tokens (Gemini 2.5 Flash is a thinking model)
    # These may be reported separately in various formats
    thinking_tokens = (
        usage.get("completion_tokens_details", {}).get("reasoning_tokens", 0)
        or usage.get("thinking_tokens", 0)
        or usage.get("reasoning_tokens", 0)
        or 0
    )

    # Pricing per 1M tokens (Lava pass-through pricing)
    # Gemini 2.5 Flash: $0.15 input, $0.60 output, $3.50 thinking (if applicable)
    # GPT-4.1-mini: $0.40 input, $1.60 output
    pricing = {
        "gemini-2.5-flash": {"input": 0.15, "output": 0.60, "thinking": 3.50},
        "gpt-4.1-mini": {"input": 0.40, "output": 1.60, "thinking": 0},
    }

    rates = pricing.get(model, {"input": 0.50, "output": 1.50, "thinking": 0})

    # Non-thinking completion tokens
    regular_output = max(0, completion_tokens - thinking_tokens)

    cost = (
        prompt_tokens * rates["input"]
        + regular_output * rates["output"]
        + thinking_tokens * rates["thinking"]
    ) / 1_000_000

    return cost


def run_model_spend(model: str, target: float):
    """Call a model repeatedly until estimated spend reaches target."""
    print(f"\n{'='*60}")
    print(f"Model: {model} | Target: ${target:.2f}")
    print(f"{'='*60}")

    estimated_total = 0.0
    call_count = 0

    while estimated_total < target:
        call_count += 1
        print(f"  Call #{call_count}...", end=" ", flush=True)

        try:
            resp = call_model(model)
            usage = resp.get("usage", {})
            prompt_tok = usage.get("prompt_tokens", 0)
            completion_tok = usage.get("completion_tokens", 0)

            # On first call, dump full usage for debugging
            if call_count == 1:
                print(f"\n    [DEBUG] Full usage: {json.dumps(usage, indent=2)}")
                # Also check the response structure
                choice = resp.get("choices", [{}])[0]
                msg = choice.get("message", {})
                content_len = len(msg.get("content", ""))
                finish = choice.get("finish_reason", "?")
                print(f"    [DEBUG] Content length: {content_len} chars, finish_reason: {finish}")

            cost_est = estimate_cost(model, resp)
            estimated_total += cost_est

            print(
                f"OK | in={prompt_tok} out={completion_tok} | "
                f"est=${cost_est:.5f} | running=${estimated_total:.5f}"
            )
        except httpx.HTTPStatusError as e:
            print(f"HTTP {e.response.status_code}: {e.response.text[:300]}")
            if e.response.status_code == 429:
                print("  Rate limited, waiting 10s...")
                time.sleep(10)
            else:
                print("  Retrying in 3s...")
                time.sleep(3)
        except Exception as e:
            print(f"Error: {e}")
            print("  Retrying in 3s...")
            time.sleep(3)

        # Small delay between calls
        time.sleep(0.3)

    print(f"\n  Done! {call_count} calls, estimated total: ${estimated_total:.5f}")
    return call_count, estimated_total


def main():
    print("=" * 60)
    print("CrisisGrid — Generate Model Spend via Lava Gateway")
    print(f"Time: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    # Run both models in parallel via threads
    results = {}
    lock = threading.Lock()

    def run_and_store(model, target):
        calls, total = run_model_spend(model, target)
        with lock:
            results[model] = {"calls": calls, "estimated_spend": total}

    threads = []
    for model, target in TARGETS.items():
        t = threading.Thread(target=run_and_store, args=(model, target))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    for model, data in results.items():
        print(f"  {model}: {data['calls']} calls, est ${data['estimated_spend']:.4f}")
    print(f"\nTotal estimated spend: ${sum(d['estimated_spend'] for d in results.values()):.4f}")

    # Verify actual spend via spend_keys endpoint (requires secret key)
    if LAVA_SECRET_KEY:
        print(f"\n{'='*60}")
        print("LAVA VERIFICATION (spend key stats)")
        print(f"{'='*60}")
        try:
            resp = httpx.get(
                f"{LAVA_BASE}/v1/spend_keys",
                headers={"Authorization": f"Bearer {LAVA_SECRET_KEY}"},
                timeout=10.0,
            )
            for k in resp.json().get("data", []):
                print(f"  Spend key: {k['key_preview']}")
                print(f"  Total spend: ${float(k['total_spend']):.6f}")
                print(f"  Total requests: {k['total_requests']}")
                print(f"  Last used: {k['last_used_at']}")

            wr = httpx.get(
                f"{LAVA_BASE}/v1/wallet",
                headers={"Authorization": f"Bearer {LAVA_SECRET_KEY}"},
                timeout=10.0,
            )
            balance = float(wr.json()["balance"])
            print(f"\n  Wallet balance: ${balance:.6f}")
        except Exception as e:
            print(f"  Verification failed: {e}")


if __name__ == "__main__":
    main()
