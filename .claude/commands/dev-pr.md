Implement a prepared Locapilot draft PR via the `locapilot-dev` agent (checkout branch,
implement the Expected fix, verify in browser, unit + E2E tests, mark ready for review),
then hand off to the `locapilot-review` agent.

**PR (number, URL or branch name):** $ARGUMENTS

---

## Instructions

### 1. Validate the input

If `$ARGUMENTS` does not contain a PR number, a `github.com/stalina/locapilot/pull/<n>`
URL, or a branch name, ask the user for one and stop.

### 2. Run the dev agent

Launch the **locapilot-dev** agent (Agent tool, `subagent_type: "locapilot-dev"`,
`isolation: "worktree"` so the user's working tree is untouched) with this prompt:

> Implement the prepared Locapilot draft PR <number/URL/branch>. Follow your standard
> process: check out the branch, read the Expected fix section and the spec changes,
> implement, verify in the browser, add unit and E2E tests, push, and mark the PR
> ready for review.

### 3. Parse the handoff payload

The agent's final message ends with a structured block:

```
STATUS: implemented | blocked
BRANCH: ...
PR_URL: ...
TESTS: ...
NOTES: ...
```

Relay this result to the user (status, PR link, test summary, notes).

### 4. Hand off to locapilot-review

- If `STATUS: blocked` → report the blocker and stop.
- If `STATUS: implemented` → run the review loop exactly as specified in
  `.claude/commands/review-pr.md` (steps 2–4): first review, at most ONE automatic
  fix cycle by locapilot-dev if changes are requested, second review, then hand back
  to the user in every case (merge or manual fix is their decision).
