Review an implemented Locapilot PR via the `locapilot-review` agent (checkout, code
review vs specs/Expected fix, browser verification, review posted on the PR), with at
most ONE automatic fix cycle by `locapilot-dev`, then hand back to the user.

**PR (number, URL or branch name):** $ARGUMENTS

---

## Instructions

### 1. Validate the input

If `$ARGUMENTS` does not contain a PR number, a `github.com/stalina/locapilot/pull/<n>`
URL, or a branch name, ask the user for one and stop.

### 2. First review

Launch the **locapilot-review** agent (Agent tool, `subagent_type: "locapilot-review"`,
`isolation: "worktree"`) with this prompt:

> Review the Locapilot PR <number/URL>. Follow your standard process: check out the
> branch, review the code against the specs and the Expected fix, verify the behaviour
> in the browser, and post your review on the PR with an explicit verdict.

Its final message ends with a `VERDICT / PR_URL / REVIEW_URL / CHANGES_REQUESTED`
block. Relay the verdict and review link to the user.

### 3. If the FIRST review requests changes → one automatic fix cycle

Launch the **locapilot-dev** agent (`subagent_type: "locapilot-dev"`,
`isolation: "worktree"`) in fix-review mode:

> Address the review feedback on Locapilot PR <PR_URL> (branch <branch>). This is a
> fix-review cycle: your contract is the requested changes below, not the Expected fix.
> Fix each point, re-verify in the browser, keep tests green, push, and reply on the PR
> summarising how each change was addressed. Requested changes: <CHANGES_REQUESTED>

Then launch **locapilot-review** again (same prompt as step 2, mentioning it is a
second-pass review after a fix cycle).

### 4. Hand back to the user — ALWAYS after at most one fix cycle

- **First review approved** → report the verdict and review link; the user merges.
- **Second review approved** → same: report and let the user merge.
- **Second review requests changes again** → do NOT launch another fix cycle. Report
  the remaining findings and hand back to the user, who will either fix manually or
  decide what to do with the PR.

Never run more than one automatic fix cycle per invocation.
