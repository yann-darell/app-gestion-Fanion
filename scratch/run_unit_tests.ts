import { runFinanceAllocationUnitTests } from "../packages/shared/api/__tests__/financeAllocation.test";

const results = runFinanceAllocationUnitTests();
console.log(JSON.stringify(results, null, 2));
process.exit(0);
