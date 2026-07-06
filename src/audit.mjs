import { auditUnlockables } from "./audit-lib.mjs";
import { loadUnlockables } from "./load.mjs";

const rows = await loadUnlockables();
const audit = auditUnlockables(rows);

console.log(JSON.stringify(audit.summary, null, 2));
for (const issue of audit.issues) {
  console.log(`- [${issue.severity}] ${issue.area}: ${issue.title} (${issue.count})`);
  for (const item of issue.items.slice(0, 8)) {
    console.log(`  - ${item.id} ${item.filePath ? `(${item.filePath})` : ""}`);
  }
  if (issue.items.length > 8) console.log(`  ... ${issue.items.length - 8} more`);
}

if (audit.summary.issues > 0) process.exitCode = 1;

