Navigate the functional specifications in `specs/`. Use this command to read specs efficiently — only load what you need rather than reading all spec files into context.

**Request:** $ARGUMENTS

---

## Available domains

`properties` · `tenants` · `leases` · `rents` · `documents` · `inventories` · `dashboard` · `settings` · `data-transfer`

For a full index with entity relationships, read `specs/_index.md`.

---

## Instructions

Parse the request above and execute the matching action:

### `list` (or no arguments)

Run `find specs -name "*.md" | sort` to list all spec files.  
Then for each domain file (not `_index.md`), read the **Overview** section only (first ~10 lines after `## Overview`) and return a one-line summary per domain.

### `show <domain>`

Read `specs/<domain>.md` in full and display its complete content.  
If the domain is not found, list the available domains.

### `search <query>`

Run: `grep -rni "<query>" specs/`  
Group results by file. Show each match with: file path, line number, matching line.  
Add 1 line of context before and after each match for readability.  
If no matches found, suggest alternative search terms.

### `stories <domain>`

Read `specs/<domain>.md`.  
Extract and list all lines matching `### Story:` with their line number.  
Format as a numbered list so the user can reference a specific story quickly.

### `scenarios <domain>`

Read `specs/<domain>.md`.  
Extract all `#### Scenario:` headings, grouped under their parent `### Story:`.  
Show the story heading, then indented scenario names with line numbers.

### `scenario <domain> <story-keyword>`

Read `specs/<domain>.md`.  
Find the Story section matching `<story-keyword>` (case-insensitive partial match).  
Return that story's full content including all its scenarios with Given/When/Then steps.

---

## Usage examples

```
/specs list
/specs show leases
/specs search "loyer auto"
/specs search "candidate"
/specs stories tenants
/specs scenarios rents
/specs scenario leases "terminate"
```
