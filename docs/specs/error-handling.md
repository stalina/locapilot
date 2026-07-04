# Error Handling Specifications

## Overview

The **error handling** module is a cross-cutting concern that guarantees the application degrades gracefully when something goes wrong. Because Locapilot is an offline-first PWA with no backend, errors cannot be shipped to a remote service: instead they are captured globally, logged in a structured format (kept in an in-memory buffer for diagnostics), and surfaced to the user through a consistent notification. Component-tree render errors are isolated by an **error boundary** so a single broken view never blanks the whole application.

## Architecture

Three complementary capture layers feed a single structured logger and the user-facing notification system:

| Layer             | Captures                                                               | Implementation                                         |
| ----------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| Vue error handler | Errors thrown in component render, lifecycle hooks, watchers, handlers | `app.config.errorHandler` (`src/core/errorHandler.ts`) |
| Window listeners  | Uncaught synchronous errors and unhandled promise rejections           | `window` `error` / `unhandledrejection` listeners      |
| Error boundary    | Render errors within a wrapped component subtree                       | `ErrorBoundary.vue` (`onErrorCaptured`)                |

All layers log via the structured logger (`src/shared/utils/logger.ts`).

## Data Model

### Log Entry (in-memory, not persisted to IndexedDB)

| Field       | Type                                     | Description                                 |
| ----------- | ---------------------------------------- | ------------------------------------------- |
| `timestamp` | string (ISO 8601)                        | When the entry was recorded                 |
| `level`     | `'debug' \| 'info' \| 'warn' \| 'error'` | Severity                                    |
| `message`   | string                                   | Human-readable description                  |
| `context`   | object (optional)                        | Structured metadata (e.g. `source`, `info`) |
| `error`     | `{ name, message, stack? }` (optional)   | Serialized error                            |

## Domain Rules

- The in-memory log buffer keeps at most **200 entries**; the oldest are dropped (ring buffer).
- In **production**, only `warn` and `error` entries are emitted to the console; in **development**, all levels are emitted.
- An uncaught error is shown to the user via a single **error notification** with a generic, reassuring message: _"Une erreur inattendue est survenue. Vos données sont sauvegardées localement."_ — internal/technical details are never shown to the user in production.
- An error caught by an `ErrorBoundary` is **not** re-propagated to the global handler (no duplicate notification); the boundary returns `false` from `onErrorCaptured`.
- The error boundary fallback offers a **"Réessayer"** action that resets its state and re-renders the wrapped subtree.
- Navigating to another route resets the route-level error boundary (it is keyed on the route path).
- Raw error details are shown in the boundary fallback only in **development** (`showDetails` defaults to `import.meta.env.DEV`).

---

## User Stories

### Story: Recover from a view rendering error

**As a** landlord
**I want to** see a clear recovery screen when a section fails to load
**So that** the whole application does not become unusable and I can retry

#### Scenario: A view throws during rendering

```gherkin
Given I am navigating the application
When the current view throws an error while rendering
Then the broken view is replaced by an error fallback titled "Une erreur est survenue"
And a "Réessayer" button is offered
And the sidebar and navigation remain usable
And the error is recorded in the structured log with source "error-boundary"
```

#### Scenario: Retry after a transient error is resolved

```gherkin
Given a view is showing the error fallback after a transient failure
When I click "Réessayer"
And the underlying condition is resolved
Then the view re-renders normally
And the error fallback disappears
```

#### Scenario: Navigating away clears the error state

```gherkin
Given a view is showing the error fallback
When I navigate to a different route from the sidebar
Then the new route renders normally without showing the previous error
```

### Story: Be notified of unexpected errors

**As a** landlord
**I want to** be informed with a clear message when an unexpected error occurs
**So that** I am reassured my data is safe and I know something went wrong

#### Scenario: An uncaught error triggers a user notification

```gherkin
Given the application is running
When an uncaught JavaScript error occurs
Then an error notification appears with the message "Une erreur inattendue est survenue. Vos données sont sauvegardées localement."
And the error is recorded in the structured log with source "window.onerror"
```

#### Scenario: An unhandled promise rejection triggers a user notification

```gherkin
Given the application is running
When a promise is rejected with no handler
Then an error notification appears with the generic error message
And the error is recorded in the structured log with source "unhandledrejection"
```

#### Scenario: A Vue component error is captured globally

```gherkin
Given the application is running
When a Vue lifecycle hook or event handler throws an error
Then the error is recorded in the structured log with source "vue"
And an error notification appears with the generic error message
```

### Story: Inspect recent errors for diagnostics

**As a** developer supporting a landlord
**I want to** keep a bounded history of recent log entries in memory
**So that** I can diagnose issues without a backend

#### Scenario: The log buffer is bounded

```gherkin
Given more than 200 log entries have been recorded
When I read the in-memory log buffer
Then it contains exactly the 200 most recent entries
And the oldest entries have been dropped
```
