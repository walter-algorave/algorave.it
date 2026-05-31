#!/usr/bin/env bash
#
# Creates (or checks out) the dedicated portfolio-video branch and pushes it to
# origin, so it can be selected as the GitHub Pages source from the repo Settings.
#
# Usage:
#   ./scripts/create-portfolio-branch.sh [branch-name]
#
# Defaults to "portfolio-video". A new branch is based on the latest origin/main.

set -euo pipefail

BRANCH="${1:-portfolio-video}"
BASE="main"

# Must be inside a git work tree.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "error: not inside a git repository" >&2
  exit 1
fi

# Refresh remote refs so a new branch is based on the latest main.
git fetch origin --quiet

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "branch '${BRANCH}' exists locally - checking it out"
  git checkout "${BRANCH}"
elif git ls-remote --exit-code --heads origin "${BRANCH}" >/dev/null 2>&1; then
  echo "branch '${BRANCH}' exists on origin - checking out a tracking copy"
  git checkout -b "${BRANCH}" "origin/${BRANCH}"
else
  echo "creating '${BRANCH}' from origin/${BASE}"
  git checkout -b "${BRANCH}" "origin/${BASE}"
fi

# Push and set upstream tracking.
git push -u origin "${BRANCH}"

cat <<EOF

Done. Branch '${BRANCH}' is on origin.

To publish it as the live site (for the video QR code):
  GitHub -> repo Settings -> Pages -> Build and deployment
    Source: Deploy from a branch
    Branch: ${BRANCH}  /  (root)
  Save, wait for the build, then the site serves this branch.

Switch Pages back to 'main' when you are done recording.
EOF
