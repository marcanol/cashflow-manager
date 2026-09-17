import { getPlanSnapshotFromDatabase } from "@/lib/data/supabase-repository";
import { formatMoney } from "@/lib/domain/money";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const plan = await getPlanSnapshotFromDatabase();
  return <main><header><p className="eyebrow">Cashflow</p><h1>Plan</h1><p className="muted">Chronological planning events. Amounts are deterministic cent values.</p></header>
    <section><h2>{plan.period}</h2><p className="muted">{plan.reason}</p>{plan.state === "UNAVAILABLE" ? <p><a href="/login">Sign in →</a></p> : <><p><strong>{formatMoney(plan.knownAmountTotalCents)}</strong> in known source amounts · {plan.unknownAmountCount} unknown · {plan.reviewRequiredCount} review required</p><ul>{plan.events.map((event) => <li key={`${event.source}:${event.id}`}><span>{event.date ?? "Due date unknown"}<small>{event.kind}{event.source === "REVIEW_REQUIRED_PROPOSAL" ? " · Review required" : ""}</small></span><strong className={event.amountCents !== null && event.amountCents < 0 ? "outflow" : "inflow"}>{event.amountCents === null ? "Unknown" : <>{event.amountCents < 0 ? "−" : "+"}{formatMoney(Math.abs(event.amountCents))}</>}</strong></li>)}</ul></>}</section>
    <p><a href="/">← Today</a></p>
  </main>;
}
