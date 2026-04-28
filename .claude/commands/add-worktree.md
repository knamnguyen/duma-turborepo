# add-worktree

When running this command - always skip riper-5-protocol no need to go over all those modes just execute right away.

You are a development workflow assistant helping create a new git worktree for feature development.

## Context

Git worktrees allow you to have multiple working directories for a single repository, making it easy to work on multiple branches simultaneously. This command creates a worktree and runs the sync script to configure it.

## Port Management Strategy

This monorepo uses **automatic port range assignment** for worktrees:

- **Main repo**: PORT=3000 (Next.js), 3001 (Ghost Blog), 3002 (WXT Extension), 8000 (API)
- **Worktree 1**: PORT=3010, 3011, 3012, 8010
- **Worktree 2**: PORT=3020, 3021, 3022, 8020
- **Worktree 3**: PORT=3030, 3031, 3032, 8030
- **Pattern**: Each worktree uses base port + 10 × worktree_number (applies to both 3xxx and 8xxx ranges)

## How to use this command

User will invoke: `@add-worktree`

You MUST execute these steps in order:

### 1. Detect Current Project Location

```bash
PROJECT_ROOT="$(pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"
PARENT_DIR="$(dirname "$PROJECT_ROOT")"
WORKTREES_DIR="$PARENT_DIR/worktrees-$PROJECT_NAME"

echo "Project: $PROJECT_NAME"
echo "Project Root: $PROJECT_ROOT"
echo "Worktrees Directory: $WORKTREES_DIR"
```

### 2. Create Worktrees Directory (If Needed)

```bash
if [ ! -d "$WORKTREES_DIR" ]; then
  mkdir -p "$WORKTREES_DIR"
  echo "✅ Created worktrees directory: $WORKTREES_DIR"
else
  echo "✅ Worktrees directory exists: $WORKTREES_DIR"
fi
```

### 3. List Existing Worktrees

```bash
echo ""
echo "📂 Existing worktrees:"
git worktree list
echo ""
```

### 4. Prompt for Branch Name

Ask the user:

> **Which branch would you like to link this worktree to?** (enter branch name)
>
> The worktree will be created at: `$WORKTREES_DIR/[branch-name]`

Wait for user input and validate:
- No spaces
- Only alphanumeric, hyphens, underscores, slashes
- Not empty

Store the input as `BRANCH_NAME`.

### 5. Create Git Worktree

```bash
WORKTREE_PATH="$WORKTREES_DIR/$BRANCH_NAME"

# Check if branch exists
if git show-ref --verify --quiet refs/heads/"$BRANCH_NAME"; then
  echo "🌿 Branch '$BRANCH_NAME' exists, linking worktree..."
  git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
else
  echo "🌿 Branch '$BRANCH_NAME' doesn't exist, creating from main..."
  git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" main
fi

if [ $? -ne 0 ]; then
  echo "❌ Failed to create worktree. Aborting."
  exit 1
fi

echo "✅ Worktree created at: $WORKTREE_PATH"
```

### 6. Run Sync Script

```bash
cd "$WORKTREE_PATH" && "$PROJECT_ROOT/process/scripts/sync-worktrees.sh"
```

The sync script handles:
- Copying `.env` from main repo
- Updating port values directly in `.env` (PORT, VITE_APP_URL, etc.)
- Running `pnpm install`

### 7. Report Completion

The sync script will output the completion summary with assigned ports.

## Example Usage

```
$ @add-worktree

Project: engagekit-turborepo
Worktrees Directory: ../worktrees-engagekit-turborepo

📂 Existing worktrees:
/path/to/main  abc123 [main]
/path/to/worktrees/feature-a  def456 [feature-a]

Which branch would you like to link this worktree to?
> feature-payments

🌿 Branch 'feature-payments' doesn't exist, creating from main...
✅ Worktree created at: ../worktrees-engagekit-turborepo/feature-payments

🔧 Setting up worktree: feature-payments
   ✅ .env copied
   ✅ Ports updated (PORT=3020, API=8020)
   ✅ Dependencies installed

╭─────────────────────────────────────────────────────────╮
│ ✨ Worktree Ready!                                      │
╰─────────────────────────────────────────────────────────╯

   Worktree: feature-payments
   Next.js:  http://localhost:3020
   API:      http://localhost:8020

   Run: pnpm dev
```

## Safety Notes

- Each worktree gets a **unique port range** automatically
- `.env` is **copied and modified** - ports are updated directly
- Worktree names **match branch names** exactly

## Related

- **Sync script**: `process/scripts/sync-worktrees.sh` - can be run standalone to re-sync any worktree
- **Clean worktree**: `@clean-worktree` - removes a worktree and optionally its branch
