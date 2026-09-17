import { getTodaySnapshotFromDatabase } from "@/lib/data/supabase-repository";
import { formatMoney } from "@/lib/domain/money";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const snapshot = await getTodaySnapshotFromDatabase();
  return <main><header><p className="eyebrow">Cashflow</p><h1>Today</h1><p className="muted">A deterministic preview from the Checkpoint 0 dataset.</p></header>
    <section className="hero"><span>Safe to spend</span><strong>—</strong><small>{snapshot.reason ?? "Bank balances and reserves have not been loaded."}</small></section>
    {snapshot.state === "UNAVAILABLE" ? <p><a href="/login">Sign in →</a></p> : <section className="grid">
      <article><span>Next paycheck</span><strong>{snapshot.nextPaycheck ? `${formatMoney(snapshot.nextPaycheck.amountCents)} · ${snapshot.nextPaycheck.date}` : "Not loaded"}</strong></article>
      <article><span>September known amounts</span><strong>{formatMoney(snapshot.knownAmountTotalCents)}</strong><small>{snapshot.unknownAmountCount} amounts unknown · {snapshot.reviewRequiredCount} need review</small></article>
    </section>}
    <section><h2>Upcoming obligations</h2>{snapshot.upcoming.length ? <ul>{snapshot.upcoming.map((item) => <li key={`${item.source}:${item.id}`}><span>{item.name}<small>Due {item.dueDate ?? "unknown"}{item.source === "REVIEW_REQUIRED_PROPOSAL" ? " · Review required" : ""}</small></span><strong>{item.amountCents === null ? "Unknown" : formatMoney(item.amountCents)}</strong></li>)}</ul> : <p className="muted">Import a workbook to populate this view.</p>}</section>
    <p><a href="/plan">View plan →</a></p>{snapshot.state === "PARTIAL" && <form action="/auth/logout" method="post"><button type="submit">Sign out</button></form>}
  </main>;
}
