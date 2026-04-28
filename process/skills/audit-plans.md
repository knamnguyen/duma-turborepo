# Audit Plans

Periodic maintenance skill — reviews all plans in `process/plans/` for staleness, completion, and obsolescence. Run this when the plans folder feels cluttered or after major architectural changes.

---

## Process

### Step 1 — Inventory

List all plans in `process/plans/` (excluding `completed/`). For each plan, note:

- Filename and date
- Status markers (look for the status strip at the top)
- Feature/system it covers

### Step 2 — Cross-Reference Codebase

For each plan, verify against the actual codebase:

1. **Are the files mentioned in the plan present?** — Glob for them.
2. **Are the features implemented?** — Grep for key identifiers (function names, route paths, component names).
3. **Has the architecture changed since the plan was written?** — Check if the approach described still matches current patterns.

Classify each plan:

| Classification | Criteria | Action |
|---|---|---|
| **Completed** | All phases verified in code, feature is live | Move to `completed/` |
| **Partially Done** | Some phases implemented, others pending | Update status markers, keep in `plans/` |
| **Obsolete** | Superseded by architectural change or pivot | Move to `completed/` with `[OBSOLETE]` prefix in filename |
| **Stale** | >30 days old, no matching code changes | Flag for user decision (keep/archive/delete) |
| **Active** | Currently being worked on | Keep as-is |
| **Reference** | Not a feature plan — documents patterns/learnings | Keep as-is (these don't get archived) |

### Step 3 — Execute Actions

For each plan:

- **Completed/Obsolete**: `mv process/plans/{name}.md process/plans/completed/{name}.md`
  - For obsolete plans, rename with prefix: `completed_obsolete_{name}.md`
- **Partially Done**: Update the status strip markers to reflect current state
- **Stale**: Present to user with recommendation (archive vs keep vs delete)

### Step 4 — Report

Present a summary table:

```
| Plan | Date | Classification | Action Taken |
|------|------|----------------|--------------|
| ...  | ...  | ...            | ...          |
```

Include:
- Total plans reviewed
- Plans archived (completed + obsolete)
- Plans flagged for user decision
- Any patterns noticed (e.g., "3 plans superseded by the same pivot")

---

## When to Run

- After completing a major feature (clean up related plans)
- After an architectural pivot (identify obsoleted plans)
- Monthly maintenance
- When `process/plans/` has >10 active files
