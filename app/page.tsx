import { getTodaySnapshotFromDatabase } from "@/lib/data/supabase-repository";
import { formatMoney } from "@/lib/domain/money";

export default async function TodayPage() {
  const snapshot = await getTodaySnapshotFromDatabase();
  return <main><header><p className="eyebrow">Cashflow</p><h1>Today</h1><p className="muted">A deterministic preview from the Checkpoint 0 dataset.</p></header>
    {snapshot.state === "UNAVAILABLE" ? <section className="hero"><span>Data connection needed</span><strong>—</strong><small>{snapshot.reason}</small></section> : <><section className="hero"><span>Safe to spend</span><strong>{formatMoney(snapshot.safeToSpendCents!)}</strong><small>Bank balances are not modeled yet, so this remains $0 until Checkpoint 1.</small></section><section className="grid">
      <article><span>Available cash</span><strong>{formatMoney(snapshot.availableCashCents!)}</strong></article>
      <article><span>Reserved</span><strong>{formatMoney(snapshot.reservedCents!)}</strong></article>
      <article><span>Next paycheck</span><strong>{snapshot.nextPaycheck ? `${formatMoney(snapshot.nextPaycheck.amountCents)} · ${snapshot.nextPaycheck.date}` : "Not loaded"}</strong></article>
    </section></>}
    <section><h2>Upcoming obligations</h2>{snapshot.upcoming.length ? <ul>{snapshot.upcoming.map((item) => <li key={item.id}><span>{item.name}<small>Due {item.dueDate}</small></span><strong>{formatMoney(item.amountCents)}</strong></li>)}</ul> : <p className="muted">Import a workbook to populate this view.</p>}</section>
    <p><a href="/plan">View plan →</a></p>
  </main>;
}
