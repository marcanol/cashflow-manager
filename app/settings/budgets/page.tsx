import { getTodaySnapshotFromDatabase } from "@/lib/data/supabase-repository";
import { saveBudget } from "./actions";

export const dynamic = "force-dynamic";
const dollars = (cents: number | null) => cents === null ? "" : (cents / 100).toFixed(2);

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const params = await searchParams; const snapshot = await getTodaySnapshotFromDatabase();
  return <main><nav><a href="/">Today</a><a href="/plan">Plan</a><a href="/settings/budgets">Budgets</a></nav>
    <header><p className="eyebrow">Settings</p><h1>Budgets</h1><p className="muted">Only active budgets can receive reviewed transaction allocations.</p></header>
    {params.error && <p className="notice error">{params.error}</p>}{params.saved && <p className="notice">Budget saved.</p>}
    {snapshot.state === "UNAVAILABLE" ? <p><a href="/login">Sign in →</a></p> : <>
      <section><h2>Current budgets</h2>{snapshot.budgets.map((budget) => <form className="budget-form" action={saveBudget} key={budget.id}>
        <input type="hidden" name="budgetId" value={budget.id}/><label>Name<input name="name" defaultValue={budget.name} required maxLength={80}/></label>
        <label>Cadence<select name="cadence" defaultValue={budget.cadence}><option value="MONTHLY">Monthly</option><option value="PAY_PERIOD">Pay period</option><option value="WEEKLY">Weekly</option></select></label>
        <label>Allocation ($)<input name="allocation" inputMode="decimal" defaultValue={dollars(budget.allocationAmountCents)} placeholder="Not configured"/></label>
        <button name="active" value="true" type="submit">Save</button>{budget.active && <button className="secondary" name="active" value="false" type="submit">Deactivate</button>}
      </form>)}</section>
      <section><h2>Create budget</h2><form className="budget-form" action={saveBudget}><label>Name<input name="name" required maxLength={80}/></label><label>Cadence<select name="cadence" defaultValue="MONTHLY"><option value="MONTHLY">Monthly</option><option value="PAY_PERIOD">Pay period</option><option value="WEEKLY">Weekly</option></select></label><label>Allocation ($)<input name="allocation" inputMode="decimal" placeholder="Optional"/></label><button name="active" value="true" type="submit">Create budget</button></form></section>
    </>}
  </main>;
}
