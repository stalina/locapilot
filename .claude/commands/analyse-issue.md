Analyse a Locapilot GitHub issue end-to-end: triage it, prepare the spec + draft PR via the
`locapilot-analyser` agent, then hand off to the `locapilot-dev` agent for implementation.

**Issue (number or URL):** $ARGUMENTS

---

## Instructions

### 1. Validate the input

If `$ARGUMENTS` does not contain an issue number or a `github.com/stalina/locapilot/issues/<n>`
URL, ask the user for one and stop.

### 2. Run the analyser

Launch the **locapilot-analyser** agent (Agent tool, `subagent_type: "locapilot-analyser"`,
`isolation: "worktree"` so the user's working tree is untouched) with this prompt:

> Analyse GitHub issue <number/URL> of stalina/locapilot. Follow your standard process:
> fetch the issue, analyse it against docs/specs/ and the code, and either report
> nothing-to-do or update the specs, push a branch, open a draft PR and comment on the issue.

### 3. Parse the handoff payload

The agent's final message ends with a structured block:

```
DECISION: nothing-to-do | dev-needed
ISSUE: ...
BRANCH: ...
PR_URL: ...
EXPECTED_FIX: ...
```

Relay this result to the user (decision, PR link, expected fix summary).

### 4. Hand off to locapilot-dev

- If `DECISION: nothing-to-do` → stop here.
- If `DECISION: dev-needed`:
  - If `.claude/agents/locapilot-dev.md` exists, launch the **locapilot-dev** agent
    (`isolation: "worktree"`) with the branch name, PR URL and the `EXPECTED_FIX` content,
    instructing it to check out the branch, implement the fix with tests, push, and mark
    the PR ready for review.
  - If it does not exist yet, tell the user the draft PR is ready and that the
    `locapilot-dev` agent is not set up yet — implementation must be started manually.
