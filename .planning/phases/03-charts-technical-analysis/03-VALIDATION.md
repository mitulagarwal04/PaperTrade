---
phase: 3
slug: charts-technical-analysis
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Backend)** | pytest 7.x |
| **Framework (Frontend)** | vitest |
| **Backend config** | `backend/tests/conftest.py` |
| **Quick run command** | `cd backend && pytest tests/ -x -q` |
| **Frontend run command** | `cd frontend && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run relevant test file
- **After every plan wave:** Run `pytest -x -q` for backend, `vitest run` for frontend
- **Before /gsd-verify-work:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

(TBD after planning — populated during /gsd-execute-phase)

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. New test files will be created per task:
- `backend/tests/test_charts.py` — Chart endpoint
- `frontend/src/**/*.test.ts` — Component/hook tests alongside source

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drawing tool interactions | TA-03 | Canvas-based drawing requires visual inspection | Open chart, draw trendline, verify it renders and persists during session |
| Real-time candle updates | TA-01 | Requires live WS connection | Open chart, wait for price update, verify candle updates visually |
| Chart rendering | TA-01 | TradingView LW renders on canvas/WebGL | Open chart for multiple symbols, verify candles and line render correctly |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
