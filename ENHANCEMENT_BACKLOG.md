# Lumina Enhancement Backlog

This backlog groups the next improvements for Lumina by priority and keeps each item tied to a concrete outcome.

## P1

### 1. Break up `src/App.jsx`
- Status: Completed (App Header, Account, Stash, and Vibe Pages extracted; Discover Tab completely removed and cleaned up)
- Goal: Reduce the size and risk of `src/App.jsx` by extracting page-level and shell-level UI into focused components.
- Planned slices:
  - [x] Extract app header and hero
  - [x] Extract account page shell (AccountPage.jsx)
  - [x] Extract saved/stash page shell (SavedBooksPage.jsx)
  - [x] Extract discover/vibe page shells (VibePage.jsx; Discover Page obsolete and removed)
  - [x] Extract scan landing section
- Success criteria:
  - `src/App.jsx` becomes meaningfully smaller (decreased by ~1,200 lines)
  - Extracted components are prop-driven and testable
  - No behavior changes in navigation or scan flows

### 2. Add browser coverage for tester-reported failures
- Status: Completed
- Goal: Add end-to-end coverage for flows that have already failed in testing.
- Target flows:
  - Barcode scanner opens
  - Voice filter does not crash
  - Compare books opens the comparison UI
  - Upload photo supports front-cover workflows
  - Chat opens and responds

### 3. Replace blocking `alert()` UX
- Status: Completed
- Goal: Replace blocking browser alerts with toasts or banners for a smoother mobile experience.
- Target surfaces:
  - [x] Voice search failures
  - [x] Manual add validation
  - [x] Scan limits
  - [x] Purchase outcomes

## P2

### 4. Improve AI scan quality pipeline
- Status: Completed
- Goal: Increase multi-book recognition quality and reduce incorrect title matches.
- Planned work:
  - [x] Normalize extracted title/author guesses
  - [x] Verify candidates against Google Books
  - [x] Return confidence per identified book
  - [x] Distinguish spine-only and full-cover scans

### 5. Add AI routing observability
- Status: Completed
- Goal: Measure model cost and quality tradeoffs in production.
- Planned metrics:
  - [x] Model tier selected
  - [x] Fallback frequency
  - [x] Token counts
  - [x] Latency
  - [x] Error rate by feature

### 6. Improve offline and degraded mode UX
- Status: Completed
- Goal: Make failure states more understandable and less abrupt.
- Planned work:
  - [x] Offline banner
  - [x] Graceful disabled states for scan/chat
  - [x] Better retry messaging
  - [x] Cached last-known library state

## P3

### 7. Expand library organization tools
- Status: Completed
- Ideas:
  - [x] Reading status
  - [x] Tags
  - [x] Notes
  - [x] Better sorting and duplicate detection

### 8. Improve compare-books experience (P3.8)
- Status: Completed
- Goal: Build side-by-side comparison modal with alternating visual grids, and integrated AI-generated book relation explanations.

### 9. Strengthen docs and contributor setup
- Status: Completed
- Ideas:
  - [x] Environment variable reference
  - [x] Firebase deployment steps
  - [x] Model-routing notes
  - [x] Test command reference

## Current Status

All enhancements across P1, P2, and P3 have been fully implemented, verified with tests (63 unit tests, 15 E2E tests), and integrated into the project.
