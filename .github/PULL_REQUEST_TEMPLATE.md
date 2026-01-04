## Summary

Add E2E regression tests (Playwright) and openspec user-guide for regression scenarios.

## What I changed
- Added multiple e2e tests under `e2e/` covering leases, rents, documents, inventories, settings
- Added openspec proposal and user-guide under `openspec/changes/add-e2e-regression-tests`
- Added `e2e` npm script

## How to test
1. Run `npm install` (if needed)
2. Run `npm run e2e`

## Notes
- Tests are written to be tolerant if features are not present (they are skipped)
- Some tests depend on dev server content and seeded data
