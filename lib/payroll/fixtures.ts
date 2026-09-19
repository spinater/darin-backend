/**
 * Shared fixtures for the `lib/payroll/*.test.ts` suites, split out of `lib/payroll.test.ts` at
 * task 037 (the file had reached 469/500 against the §4 ceiling). Nothing here is a test: this is
 * the one `computePayslip` input builder every suite calls, so a fixture that drifts drifts once.
 *
 * 🔴 **Test support only — never import this from `lib/**` or `app/**`.** `config` here is
 * `CONFIG_DEFAULTS` flattened, and §2 rule 3 confines those values to **seed time**: a runtime
 * caller reading them would run payroll off the defaults instead of the `PayrollConfig` table,
 * silently and with every gate green. While this lived inside a `.test.ts` the import was
 * unthinkable; in an ordinary module it is one autocomplete away, and no gate here watches
 * import direction.
 */
import { buildTeachRates, computePayslip, type SaleInput, type StaffInput } from "../payroll";
import { CONFIG_DEFAULTS } from "../config-keys";

export const config = Object.fromEntries(
  Object.entries(CONFIG_DEFAULTS).map(([k, v]) => [k, v.value]),
);

/**
 * Built through the **real** builder rather than hand-rolled, so the fixture cannot drift from the
 * shape `runPayroll` actually passes (task 034 turned this from an object literal into a `Map`).
 * The rows are written as a readable table and flattened, which is also what the DB hands over.
 */
export const ratesTable: Record<string, Record<string, number>> = {
  pt: { PT: 200, CT: 300, ST: 400 },
  pilates: { PT: 300, CT: 400, ST: 500 },
  swim: { PT: 250, CT: 250, ST: 250 },
};
export const rows = (table: Record<string, Record<string, number>>) =>
  Object.entries(table).flatMap(([activity, byRank]) =>
    Object.entries(byRank).map(([rank, rate]) => ({ activity, rank, rate })),
  );
export const teachRates = buildTeachRates(rows(ratesTable));

export const trainer = (over: Partial<StaffInput> = {}): StaffInput => ({
  id: "t1",
  name: "เทรนเนอร์",
  role: "trainer",
  rank: "ST",
  baseSalary: 10000,
  classCredit: 5000,
  active: true,
  ...over,
});

export const run = (over: Partial<Parameters<typeof computePayslip>[0]> = {}) =>
  computePayslip({
    staff: trainer(),
    sessions: [],
    classSessions: [],
    sales: [],
    otEntries: [],
    config,
    teachRates,
    ...over,
  });

export const ptSale = (over: Partial<SaleInput> = {}): SaleInput => ({
  id: "s1",
  kind: "pt",
  tier: null,
  productName: "PT 30 ครั้ง",
  listPrice: null,
  netPrice: 20000,
  attributions: [{ staffId: "t1", role: "closer" }],
  ...over,
});
