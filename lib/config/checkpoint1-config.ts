export type Checkpoint1Config = {
  accounts: Array<Record<string, unknown>>;
  incomeSources: Array<Record<string, unknown>>;
  settings?: Record<string, unknown>;
  obligations: Array<Record<string, unknown>>;
  budgets: Array<Record<string, unknown>>;
};

export function assertCheckpoint1Config(value: unknown): asserts value is Checkpoint1Config {
  if (!value || typeof value !== "object") throw new Error("Checkpoint 1 config must be a JSON object.");
  const config = value as Partial<Checkpoint1Config>;
  for (const key of ["accounts", "incomeSources", "obligations", "budgets"] as const) {
    if (!Array.isArray(config[key])) throw new Error(`Checkpoint 1 config requires an ${key} array.`);
  }
  const checked = config as Checkpoint1Config;
  const requireKeys = (items: Array<Record<string, unknown>>, keys: string[], label: string) => items.forEach((item, index) => {
    for (const key of keys) if (typeof item[key] !== "string" || !item[key]) throw new Error(`${label}[${index}] requires ${key}.`);
  });
  requireKeys(checked.accounts, ["key", "institution", "name", "accountType"], "accounts");
  requireKeys(checked.incomeSources, ["personLabel", "legacyCadence", "recurrenceType", "destinationAccountKey"], "incomeSources");
  requireKeys(checked.obligations, ["key", "name"], "obligations");
  requireKeys(checked.budgets, ["key", "name", "cadence"], "budgets");
}
