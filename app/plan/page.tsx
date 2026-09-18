import { getPlanSnapshotFromDatabase } from "@/lib/data/supabase-repository";
import { formatMoney } from "@/lib/domain/money";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const plan = await getPlanSnapshotFromDatabase();
  return <main><nav><a href="/">Today</a><a href="/plan">Plan</a><a href="/settings/budgets">Budgets</a></nav>
    <header><p className="eyebrow">Cashflow</p><h1>Plan</h1><p className="muted">Chronological paycheck, obligation, reserve, and budget events. Recommendations are deterministic.</p></header>
    {plan.state === "UNAVAILABLE" ? <p><a href="/login">Sign in →</a></p> : <section><h2>Planning timeline</h2><ul>{plan.events.map((event) => <li key={`${event.kind}:${event.id}`}><span>{event.date}<small>{event.label}{event.accountName ? ` · ${event.accountName}` : ""}{event.action ? ` · ${event.action}` : ""}{!event.affectsCash ? " · protected allocation" : ""}</small></span><strong className={event.amountCents !== null && event.amountCents < 0 ? "outflow" : "inflow"}>{event.amountCents === null ? "Amount unknown" : <>{event.amountCents < 0 ? "−" : "+"}{formatMoney(Math.abs(event.amountCents))}</>}</strong></li>)}</ul></section>}
  </main>;
}
