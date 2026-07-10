# Lumina Enhancement Backlog

This backlog groups the next improvements for Lumina by priority and keeps each item tied to a concrete outcome.

## P1

### 1. Break up `src/App.jsx`
- Status: In progress
- Goal: Reduce the size and risk of `src/App.jsx` by extracting page-level and shell-level UI into focused components.
- Planned slices:
  - Extract app header and hero
  - Extract scan landing section
  - Extract account page shell
  - Extract discover/vibe page shells
  - Extract saved/stash page shell
- Success criteria:
  - `src/App.jsx` becomes meaningfully smaller
  - Extracted components are prop-driven and testable
  - No behavior changes in navigation or scan flows

### 2. Add browser coverage for tester-reported failures
- Status: Planned
- Goal: Add end-to-end coverage for flows that have already failed in testing.
- Target flows:
  - Barcode scanner opens
  - Voice filter does not crash
  - Compare books opens the comparison UI
  - Upload photo supports front-cover workflows
  - Chat opens and responds

### 3. Replace blocking `alert()` UX
- Status: Planned
- Goal: Replace blocking browser alerts with toasts or banners for a smoother mobile experience.
- Target surfaces:
  - Voice search failures
  - Manual add validation
  - Scan limits
  - Purchase outcomes

## P2

### 4. Improve AI scan quality pipeline
- Goal: Increase multi-book recognition quality and reduce incorrect title matches.
- Planned work:
  - Normalize extracted title/author guesses
  - Verify candidates against Google Books
  - Return confidence per identified book
  - Distinguish spine-only and full-cover scans

### 5. Add AI routing observability
- Goal: Measure model cost and quality tradeoffs in production.
- Planned metrics:
  - Model tier selected
  - Fallback frequency
  - Token counts
  - Latency
  - Error rate by feature

### 6. Improve offline and degraded mode UX
- Goal: Make failure states more understandable and less abrupt.
- Planned work:
  - Offline banner
  - Graceful disabled states for scan/chat
  - Better retry messaging
  - Cached last-known library state

## P3

### 7. Expand library organization tools
- Ideas:
  - Reading status
  - Tags
  - Notes
  - Better sorting and duplicate detection

### 8. Improve compare-books experience
- Ideas:
  - Clear selected-book state
  - Side-by-side comparison view
  - Why-these-books-match explanation

### 9. Strengthen docs and contributor setup
- Ideas:
  - Environment variable reference
  - Firebase deployment steps
  - Model-routing notes
  - Test command reference

## Current slice

Start with P1.1 by extracting the app header and hero UI out of `src/App.jsx`.
