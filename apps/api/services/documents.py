"""Template-based order sheet generation for accepted crisis response plans.

Generates purchase orders (per supplier), transfer requests (per transfer),
and a crisis response summary. All output is markdown -- no LLM or PDF needed.
"""

from datetime import datetime, timezone
from pydantic import BaseModel


class GeneratedDocument(BaseModel):
    """A generated order document."""
    type: str  # "purchase_order" | "transfer_request" | "crisis_summary"
    title: str
    supplier_name: str | None = None  # Only for purchase_orders
    content_markdown: str


def generate_documents(
    crisis_event_id: str,
    plan: dict,
    crisis_profile: dict | None = None,
) -> list[GeneratedDocument]:
    """Generate order documents from an accepted plan.

    Args:
        crisis_event_id: The crisis event ID for reference.
        plan: ResponsePlan serialized as dict.
        crisis_profile: Optional crisis profile for summary context.

    Returns:
        List of GeneratedDocument (purchase orders + transfer requests + summary).
    """
    docs: list[GeneratedDocument] = []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    plan_name = plan.get("name", "unknown")
    line_items = plan.get("line_items", [])
    transfers = plan.get("transfers", [])

    # Group line items by supplier
    by_supplier: dict[str, list[dict]] = {}
    for li in line_items:
        supplier = li.get("supplier_name", "Unknown")
        by_supplier.setdefault(supplier, []).append(li)

    # Generate purchase order per supplier
    for supplier, items in by_supplier.items():
        total_lbs = sum(i.get("quantity_lbs", 0) for i in items)
        total_cost = sum(i.get("cost", 0) for i in items)
        total_delivery = sum(i.get("delivery_cost", 0) for i in items)

        lines = []
        for i, item in enumerate(items, 1):
            lines.append(
                f"| {i} | {item.get('food_category', '')} | {item.get('item_name', '')} "
                f"| {item.get('quantity_lbs', 0):,.0f} | ${item.get('cost', 0):,.2f} "
                f"| ${item.get('delivery_cost', 0):,.2f} | {item.get('lead_time_days', 0)}d |"
            )

        content = f"""# Purchase Order

**To:** {supplier}
**From:** CrisisGrid Emergency Procurement
**Date:** {now}
**Reference:** {crisis_event_id[:8]}
**Plan:** {plan_name}

## Order Items

| # | Category | Item | Qty (lbs) | Cost | Delivery | Lead Time |
|---|----------|------|-----------|------|----------|-----------|
{chr(10).join(lines)}

## Totals

- **Total Weight:** {total_lbs:,.0f} lbs
- **Procurement Cost:** ${total_cost:,.2f}
- **Delivery Cost:** ${total_delivery:,.2f}
- **Grand Total:** ${total_cost + total_delivery:,.2f}

## Delivery Instructions

Please deliver to the designated CrisisGrid distribution site.
Contact operations for specific delivery window scheduling.
"""
        docs.append(GeneratedDocument(
            type="purchase_order",
            title=f"PO - {supplier}",
            supplier_name=supplier,
            content_markdown=content,
        ))

    # Generate transfer request per transfer
    for i, transfer in enumerate(transfers, 1):
        content = f"""# Inter-Site Transfer Request

**Date:** {now}
**Reference:** {crisis_event_id[:8]}-T{i:02d}
**Plan:** {plan_name}

## Transfer Details

- **From:** {transfer.get('from_site_name', 'Unknown')} ({transfer.get('from_site_id', '')[:8]})
- **To:** {transfer.get('to_site_name', 'Unknown')} ({transfer.get('to_site_id', '')[:8]})
- **Category:** {transfer.get('food_category', '')}
- **Quantity:** {transfer.get('quantity_lbs', 0):,.0f} lbs
- **Distance:** {transfer.get('distance_miles', 0):.1f} miles
- **Estimated Delivery Cost:** ${transfer.get('delivery_cost', 0):,.2f}

## Notes

This is an inter-site food bank transfer. No procurement cost -- delivery cost only.
Coordinate pickup and delivery windows between sites.
"""
        docs.append(GeneratedDocument(
            type="transfer_request",
            title=f"Transfer - {transfer.get('food_category', '')} to {transfer.get('to_site_name', 'Unknown')}",
            content_markdown=content,
        ))

    # Generate crisis response summary
    total_cost = plan.get("total_cost", 0)
    coverage_pct = plan.get("coverage_pct", 0)
    max_lead = plan.get("max_lead_time_days", 0)
    served = plan.get("estimated_people_served", 0)
    n_suppliers = len(by_supplier)
    n_transfers = len(transfers)

    crisis_type = ""
    geography = ""
    if crisis_profile:
        crisis_type = crisis_profile.get("crisis_type", "")
        geography = crisis_profile.get("geography", "")

    summary_content = f"""# Crisis Response Summary

**Date:** {now}
**Event ID:** {crisis_event_id[:8]}
**Plan Selected:** {plan_name}
**Strategy:** {plan.get('strategy', '')}

## Crisis Context

- **Type:** {crisis_type}
- **Region:** {geography}

## Plan Overview

| Metric | Value |
|--------|-------|
| Total Cost | ${total_cost:,.2f} |
| Coverage | {coverage_pct:.1f}% |
| Max Lead Time | {max_lead}d |
| People Served | {served:,} |
| Suppliers | {n_suppliers} |
| Inter-site Transfers | {n_transfers} |
| Purchase Orders | {n_suppliers} |

## Line Items Summary

{len(line_items)} procurement actions across {n_suppliers} suppliers.

## Next Steps

1. Distribute purchase orders to suppliers
2. Coordinate inter-site transfers
3. Monitor delivery status
4. Update inventory on receipt
"""
    docs.append(GeneratedDocument(
        type="crisis_summary",
        title="Crisis Response Summary",
        content_markdown=summary_content,
    ))

    return docs
