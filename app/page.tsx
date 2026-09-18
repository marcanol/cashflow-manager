import { getTodaySnapshotFromDatabase } from "@/lib/data/supabase-repository";
import { formatMoney } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
const money = (value: number | null) => value === null ? "Not configured" : formatMoney(value);

export default async function TodayPage() {
  const snapshot = await getTodaySnapshotFromDatabase();
  return <main><nav><a href="/">Today</a><a href="/plan">Plan</a><a href="/settings/budgets">Budgets</a></nav>
    <header><p className="eyebrow">Cashflow</p><h1>Today</h1><p className="muted">Account-aware planning as of {snapshot.asOf}.</p></header>
    <section className="hero"><span>Safe to spend</span><strong>{money(snapshot.safeToSpendCents)}</strong><small>{snapshot.reason}</small></section>
    {snapshot.state === "UNAVAILABLE" ? <p><a href="/login">Sign in →</a></p> : <>
      <section><h2>Next paychecks</h2><div className="grid">{snapshot.nextPaychecks.map((paycheck) => <article key={paycheck.id}><span>{paycheck.person} · {paycheck.accountName}</span><strong>{money(paycheck.expectedAmountCents)}</strong><small>{paycheck.expectedDate}</small></article>)}</div></section>
      <section><h2>Protected money</h2><div className="grid"><article><span>Obligation reserves</span><strong>{formatMoney(snapshot.reservedObligationCents)}</strong></article><article><span>Budget remaining</span><strong>{formatMoney(snapshot.protectedBudgetRemainingCents)}</strong></article></div></section>
      <section><h2>Budgets</h2><ul>{snapshot.budgets.filter((budget) => budget.active).map((budget) => <li key={budget.id}><span>{budget.name}<small>{budget.needsConfiguration ? "Needs allocation" : `${formatMoney(budget.consumedAmountCents)} used`}</small></span><strong>{money(budget.remainingAmountCents)}</strong></li>)}</ul></section>
      <section><h2>Upcoming protected obligations</h2><ul>{snapshot.upcoming.map((item) => <li key={item.id}><span>{item.name}<small>{item.accountName ?? "Account not set"} · Due {item.dueDate ?? "unknown"} · {item.paymentMode === "AUTOPAY" ? "Autopay" : item.recommendation?.action ?? "Needs inputs"}</small></span><strong>{money(item.amountCents)}</strong></li>)}</ul></section>
      <section><h2>Things that need you</h2>{snapshot.attention.length ? <ul>{snapshot.attention.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="muted">Nothing needs attention.</p>}</section>
      <form action="/auth/logout" method="post"><button type="submit">Sign out</button></form>
    </>}
  </main>;
}
