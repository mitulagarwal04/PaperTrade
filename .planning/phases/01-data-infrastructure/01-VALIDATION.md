---
phase: 1
slug: data-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio |
| **Config file** | pyproject.toml (Wave 0 install) |
| **Quick run command** | `pytest tests/unit/ -x -q` |
| **Full suite command** | `pytest tests/ -v --cov=app --cov-report=term-missing` |
| **Estimated runtime** | ~10 seconds (unit), ~30 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/unit/ -x -q`
- **After every plan wave:** Run `pytest tests/ -v --cov=app`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | INFRA-02 | — | N/A | setup | `pytest tests/unit/test_config.py -x` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | INFRA-03 | — | N/A | setup | `pytest tests/unit/test_models.py -x` | ❌ W0 | ⬜ pending |
| 01-02-01 | 01 | 2 | INFRA-02 | T-01-02 | Pydantic validates symbol format | unit | `pytest tests/unit/test_schemas.py -x` | ❌ W0 | ⬜ pending |
| 01-02-02 | 01 | 2 | INFRA-03 | — | SQL injection protection via ORM | unit | `pytest tests/unit/test_cache.py -x` | ❌ W0 | ⬜ pending |
| 01-03-01 | 01 | 3 | INFRA-01 | — | Provider fetch isolation | integration | `pytest tests/integration/test_providers.py -x` | ❌ W0 | ⬜ pending |
| 01-03-02 | 01 | 3 | INFRA-04 | T-01-03 | Exception details logged server-side | integration | `pytest tests/integration/test_fallback.py -x` | ❌ W0 | ⬜ pending |
| 01-04-01 | 01 | 4 | INFRA-01/04 | T-01-04 | WebSocket rate limiting | integration | `pytest tests/integration/test_websocket.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/conftest.py` — shared fixtures for async DB sessions, test client
- [ ] `tests/factories.py` — model factories for test data
- [ ] `tests/unit/test_config.py` — config loading tests
- [ ] `tests/unit/test_models.py` — ORM model tests
- [ ] `pyproject.toml` — pytest config with asyncio_mode=auto

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WebSocket real-time push latency | INFRA-01 | Timing dependent | Open browser dev tools, verify price updates every 5 seconds |
| Stale indicator display | INFRA-04 | UI state | Disconnect internet, verify "stale" badge appears on prices |
| INR conversion accuracy | INFRA-02 | Live API data | Compare displayed price with XE.com for same asset |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
