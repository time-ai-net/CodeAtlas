# Branch Protection Settings (Reference - Apply via GitHub Web UI)
# https://github.com/time-ai-net/CodeAtlas/settings/branches

## Required Settings for Main Branch:

### Branch name pattern: main

### Protect matching branches:
- [x] Require a pull request before merging
  - [x] Require approvals: 1
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require review from Code Owners

- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Required status checks:
    - build (18.x)
    - build (20.x)

- [x] Require conversation resolution before merging

- [ ] Require signed commits (optional)

- [x] Require linear history

- [ ] Do not allow bypassing the above settings

- [ ] Allow force pushes (UNCHECKED)
- [ ] Allow deletions (UNCHECKED)

---

## Repository Settings

### General Settings (https://github.com/time-ai-net/CodeAtlas/settings)

**Features:**
- [x] Issues
- [x] Projects
- [x] Preserve this repository (optional)
- [x] Discussions (optional)

**Pull Requests:**
- [x] Allow merge commits
- [x] Allow squash merging
- [x] Allow rebase merging
- [x] Always suggest updating pull request branches
- [x] Automatically delete head branches

**Merge button:**
- Default to: Squash and merge

---

## Quick Setup Commands

These settings MUST be applied via GitHub Web UI:
1. Go to: https://github.com/time-ai-net/CodeAtlas/settings/branches
2. Click "Add branch protection rule"
3. Apply settings above

## Alternative: Use GitHub CLI

```bash
# Install GitHub CLI if not installed: winget install GitHub.cli

# Protect main branch
gh api repos/time-ai-net/CodeAtlas/branches/main/protection -X PUT --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["build (18.x)", "build (20.x)"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismissal_restrictions": {},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF

# Enable issues
gh api repos/time-ai-net/CodeAtlas -X PATCH -f has_issues=true

# Enable discussions
gh api repos/time-ai-net/CodeAtlas -X PATCH -f has_discussions=true
```
