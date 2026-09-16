import { getTodaySnapshotFromDatabase } from "@/lib/data/supabase-repository";
import { formatMoney } from "@/lib/domain/money";

export default async function TodayPage() {
  const snapshot = await getTodaySnapshotFromDatabase();
  return <main><header><p className="eyebrow">Cashflow</p><h1>Today</h1><p className="muted">A deterministic preview from the Checkpoint 0 dataset.</p></header>
    <section className="hero"><span>Safe to spend</span><strong>—</strong><small>{snapshot.reason ?? "Bank balances and reserves have not been loaded."}</small></section>
    {snapshot.state === "UNAVAILABLE" ? null : <section className="grid">
      <article><span>Next paycheck</span><strong>{snapshot.nextPaycheck ? `${formatMoney(snapshot.nextPaycheck.amountCents)} · ${snapshot.nextPaycheck.date}` : "Not loaded"}</strong></article>
    </section>}
    <section><h2>Upcoming obligations</h2>{snapshot.upcoming.length ? <ul>{snapshot.upcoming.map((item) => <li key={item.id}><span>{item.name}<small>Due {item.dueDate}</small></span><strong>{formatMoney(item.amountCents)}</strong></li>)}</ul> : <p className="muted">Import a workbook to populate this view.</p>}</section>
    <p><a href="/plan">View plan →</a></p>
  </main>;
}
