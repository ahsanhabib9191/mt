# Workflow Git Diff Fix

## Problem

GitHub Copilot's dynamic workflows were failing with the following error:

```
Error: Command failed with exit code 128: git diff REDACTED REDACTED
fatal: ambiguous argument 'refs/heads/main': unknown revision or path not in the working tree.
```

This occurred because the workflow's checkout actions only fetched the current branch (shallow clone with depth 1), which meant the `main` branch was not available for git diff operations.

## Solution

Updated all `actions/checkout` actions in the workflow files to use `fetch-depth: 0`, which fetches the complete git history for all branches.

### Changed Files

1. `.github/workflows/copilot-setup-steps.yml` - Added `fetch-depth: 0` to 1 checkout action
2. `.github/workflows/ci.yml` - Added `fetch-depth: 0` to 5 checkout actions

### Example Change

```yaml
# Before
- uses: actions/checkout@v4

# After
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # Fetch all history for all branches
```

## Why This Works

The `fetch-depth: 0` parameter tells GitHub Actions to:
1. Fetch the complete git history (not just the latest commit)
2. Make all branches available in the workspace
3. Enable git diff operations against any branch, including `main`

This is essential for:
- GitHub Copilot's dynamic workflows that perform code comparisons
- Code review tools that need to compare changes against the base branch
- Any workflow that needs to reference multiple branches

## Performance Considerations

While `fetch-depth: 0` fetches more data than a shallow clone, the impact is minimal for this repository because:
- The repository has a small history (3 commits as of this fix)
- GitHub's git servers are optimized for full clones
- The benefit of having complete history outweighs the small performance cost

For larger repositories, you could alternatively use:
```yaml
- name: Fetch main branch
  run: git fetch origin main:main
```

However, `fetch-depth: 0` is simpler and more robust.

## Testing

Run the test script to verify git diff operations work:

```bash
bash scripts/test-git-diff.sh
```

This validates that:
- The main branch is accessible via `origin/main` or `refs/remotes/origin/main`
- Git diff operations against main work correctly
- All branches are available for comparison

## References

- [GitHub Actions Checkout Documentation](https://github.com/actions/checkout#fetch-all-history-for-all-tags-and-branches)
- [Git Fetch Depth Configuration](https://git-scm.com/docs/git-clone#Documentation/git-clone.txt---depthltdepthgt)
