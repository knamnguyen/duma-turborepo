# merge-worktree

When running this command - always skip riper-5-protocol no need to go over all those modes just execute right away.

You are a development workflow assistant helping merge a git worktree into main and clean up the worktree.

## Context

After completing work in a feature worktree, this command helps you merge the changes back into the main branch and clean up by removing the worktree and deleting the associated branch locally.

## Usage

### From Conductor (recommended)

Paste this in Conductor's "Archive script" field:
```
/Users/knamnguyen/Documents/0-Programming/engagekit-turborepo/process/scripts/merge-worktree.sh
```

### From CLI

Run from within a worktree directory:
```bash
/Users/knamnguyen/Documents/0-Programming/engagekit-turborepo/process/scripts/merge-worktree.sh
```

### Via Claude command

User invokes: `@merge-worktree`

You MUST run:
```bash
/Users/knamnguyen/Documents/0-Programming/engagekit-turborepo/process/scripts/merge-worktree.sh
```

## What the script does

1. **Detects current branch and worktree path**
2. **Checks for uncommitted changes** - Fails if any exist (you must commit first)
3. **Switches to main repo** - `cd` to main engagekit-turborepo
4. **Pulls latest main** - Gets latest changes from remote
5. **Merges feature branch** - `git merge <branch-name>` into main
6. **Removes the worktree** - `git worktree remove <path>`
7. **Deletes local branch** - `git branch -d <branch-name>`
8. **Prunes worktree references** - Cleans up git metadata

## Safety Features

- **Uncommitted changes check** - Script fails if worktree has uncommitted changes
- **Merge conflict detection** - Stops and reports if conflicts occur
- **Safe branch delete** - Uses `-d` first, then `-D` only if needed
- **Won't run from main repo** - Prevents accidental self-merge
- **Won't merge main/master** - Prevents merging main into itself

## Example Output

```
🔀 Merge Worktree: ai-comment-detect
   Branch: ai-comment-detect
   Path: /Users/knamnguyen/conductor/workspaces/engagekit-turborepo/ai-comment-detect

📍 Switching to main repo...
🔄 Checking out main branch...
⬇️  Pulling latest main...

🔀 Merging ai-comment-detect into main...
   ✅ Merge successful

🗑️  Removing worktree...
   ✅ Worktree removed

🗑️  Deleting local branch...
   ✅ Branch deleted

╭─────────────────────────────────────────────────────────────╮
│ ✨ Merge Complete!                                          │
╰─────────────────────────────────────────────────────────────╯

   Merged: ai-comment-detect → main
   Removed: /Users/knamnguyen/conductor/workspaces/...

   You are now in: /Users/knamnguyen/.../engagekit-turborepo (main branch)

   To push to remote:
     git push
```

## Error Handling

- **Uncommitted changes**: Commit or stash first, then retry
- **Merge conflicts**: Resolve in main repo, then `git add . && git commit`
- **Already on main**: Can't run from main repo, must be in worktree

## Related

- **Add worktree**: `@add-worktree` - Create new worktree
- **Clean worktree**: `@clean-worktree` - Remove worktree without merging
- **Sync script**: `process/scripts/sync-worktrees.sh` - Setup worktree environment
