import { getPlanSnapshotFromDatabase } from "@/lib/data/supabase-repository";
import { formatMoney } from "@/lib/domain/money";

export default async function PlanPage() {
  const plan = await getPlanSnapshotFromDatabase();
  return <main><header><p className="eyebrow">Cashflow</p><h1>Plan</h1><p className="muted">Chronological planning events. Amounts are deterministic cent values.</p></header>
    <section><h2>{plan.period}</h2><p className="muted">{plan.reason}</p>{plan.state === "UNAVAILABLE" ? null : <ul>{plan.events.map((event) => <li key={event.id}><span>{event.date}<small>{event.kind}</small></span><strong className={event.amountCents < 0 ? "outflow" : "inflow"}>{event.amountCents < 0 ? "−" : "+"}{formatMoney(Math.abs(event.amountCents))}</strong></li>)}</ul>}</section>
    <p><a href="/">← Today</a></p>
  </main>;
}
