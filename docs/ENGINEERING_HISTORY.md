# PipelineGuard UI — Engineering History

> Living record. Update this document whenever a meaningful UI, bridge, testing, or packaging change lands. Record unsuccessful approaches as well as successful fixes. Last verified checkpoint: 2026-10-09, UI commit `54bcd72f9c4a0275f6a13e68ad5253ebf4f2767c`, GitHub Actions run [37929975956](https://github.com/ibrahim1101/pipelineguard-ui/actions/runs/37929975956) **successful**. New heartbeat changes await CI.

## Scope and repository boundaries

- UI and FastAPI bridge: private repository `ibrahim1101/pipelineguard-ui`, branch `main`.
- Separate engine: `ibrahim1101/PipelineGuard`, development branch `feat/v2-engine-integration`.
- The bridge imports the engine checkout using `PIPELINEGUARD_ENGINE_PATH`. Do not assume the engine checkout is pip-installable.
- The UI repository is not evidence that the final standalone Windows installer, desktop process lifecycle, or physical desktop UX is production-ready.

## Current implementation

- React frontend with Dashboard, Scan Project, Findings, Dependencies, OSV Intelligence, Reports, History, and Settings workspaces.
- FastAPI bridge for engine scan execution, progress state, settings, profiles, reports, history, masked secret evidence, and optional OSV lookups.
- Local scan management and storage; bridge and engine smoke/integration checks run in GitHub Actions on Windows and Ubuntu.
- Frontend lifecycle tests cover initialization, offline recovery, stale initialization, unmount safety, polling cleanup, user selection preservation, and out-of-order refresh protection.
- Recent UI hardening preserves manually edited scan selection across reconnects, discards stale refresh results, restores the connected indicator after successful polling, and guards delayed scan-start/history responses against unmounted components.
- Scan completion/failure notification is independent of report-refresh success; report refresh errors are separately surfaced, and missing OSV insight fields are guarded.

## Chronological development and CI troubleshooting

| Checkpoint | Change / observation | Outcome |
| --- | --- | --- |
| `af4fe32`, `4fe4eed`, `d953982`, `77960d0` | Bridge heartbeat/recovery and React lifecycle guards developed | Follow-up tests added |
| `b573b5b`, `5de12bf`, `41df399` | React lifecycle tests and CI wiring | Initial CI failed; investigated job logs |
| Run [37922969181](https://github.com/ibrahim1101/pipelineguard-ui/actions/runs/37922969181) | Python jobs tried `pip install -e ./engine`, but engine checkout had no packaging metadata; Jest could not resolve `@/lib/api` | All three jobs failed |
| `857c5fe` | Removed invalid editable engine installation; bridge imports engine from source checkout | Python checks subsequently passed |
| `cf63f6e` | Replaced Jest test's aliased API import with relative import | Still failed: component itself used alias |
| `0fe65b8` | Replaced component API import with relative path | Tests executed; 4 passed, 1 failed |
| Run [37923880429](https://github.com/ibrahim1101/pipelineguard-ui/actions/runs/37923880429) | Polling test expected zero global timers, but React/jsdom owned timers too | Corrected assertion to test no further API polling |
| `02496d9` | Asserted scan-state API is not called after unmount | Run [37924278586](https://github.com/ibrahim1101/pipelineguard-ui/actions/runs/37924278586) **passed** |
| `c800757` | Five UI lifecycle improvements: selection, refresh ordering, polling connectivity, scan-start, historical scan loading | Run [37925107245](https://github.com/ibrahim1101/pipelineguard-ui/actions/runs/37925107245) **passed** |
| `ba2223b` | Added selection-preservation and stale-refresh regression tests | Run [37925491092](https://github.com/ibrahim1101/pipelineguard-ui/actions/runs/37925491092) **passed** |
| `879cf22` | Decoupled scan completion from report refresh; guarded OSV insight fields | Run [37925949330](https://github.com/ibrahim1101/pipelineguard-ui/actions/runs/37925949330) **passed** |

### Lessons learned

1. Check actual failing GitHub Actions job logs before patching; a green engine job does not mean the React job is green.
2. CRACO webpack aliases are not necessarily resolved by Jest. Prefer consistent test-compatible imports or configure Jest mapping explicitly.
3. Test observable application behavior, not all timers in the React/jsdom environment.
4. Treat asynchronous responses as stale after unmount, reconnect generation changes, or superseding refresh requests.
5. A completed engine scan and successful report loading are separate events; failure in one should not misreport the other.
6. Green CI validates covered tests/builds only; it does not certify a standalone installer, pixel-perfect UI, or complete security review.

### 2026-10-09 — Scan completion regression coverage (pending CI)\n- **Goal:** Ensure scan completion/failure remains authoritative if latest report, history, or activity refresh fails.\n- **Files / behavior changed:** Added `frontend/src/context/AppContext.scanCompletion.test.jsx` with parameterized completion tests for all three refresh endpoints and a failed-scan regression. No production UI or engine code changed.\n- **Failed approaches / errors:** None observed at commit time; CI validation pending.\n- **Fix and rationale:** Assert independent scan status, connection state, completion/failure toast, and refresh warning.\n- **Commit:** `c5c7d92befa00fdf17c842710582bb1bc514b5a4`.\n- **CI run and result:** Not yet verified.\n- **Manual verification outstanding:** Bridge interruption and actual desktop scan scenarios.\n- **Next action:** Inspect CI and address any test issues before polling improvements.\n\n### 2026-10-09 — Bridge interruption regression (CI unverified)\n- **Goal:** Check scan-state polling recovers from a transient bridge exception and reports completion exactly once.\n- **Files / behavior changed:** Extended `frontend/src/context/AppContext.scanCompletion.test.jsx` with offline/retry/completion assertion.\n- **Commit:** `1e04efa896538420eeae79d9b0cd7bf87c2245b7`.\n- **CI:** Not verified; GitHub connector's commit-workflow lookup covers PR-triggered runs only and returned no matching runs for the earlier push.\n- **Next action:** Inspect main-branch Actions run, resolve any failures, then harden overlapping scan polling.\n\n### 2026-10-09 — CI #28 parse failure and correction
- **Observed:** Actions run `37926993456` failed in React lifecycle regression tests; both Windows and Ubuntu Python bridge smoke checks passed.
- **Root cause:** The bridge retry test introduced literal `\\n` escape text inside JSX, causing Babel/Jest `Expecting Unicode escape sequence` at line 71. The test helper also initially mocked an idle scan at the time of `startScan`, preventing realistic completion polling.
- **Fix:** Commit `e2b49e9c534bd87fefed64691af6f47e165d7636` converts escaped text to actual newlines and sets the scan-state mock to `running` before `startScan`.
- **Verification:** New push CI not yet inspected; do not mark green without checking the run.

### 2026-10-09 — Serialize UI scan polling (pending CI)
- **Problem:** Repeated retries could enter `poll()` while a prior scan-state request was unresolved, allowing overlapping network calls and inconsistent completion transitions.
- **Fix:** `pollInFlightRef` guards `poll()` reentry and is reset in `finally`; retry initialization remains independent. No engine code modified.
- **Tests:** Added regression for retry during a pending scan-state poll; follow-up corrected mock to keep scan running during retry.
- **Commits:** `74f7bf4`, `ebc2dc9`, `4f66ec4`.
- **Validation:** GitHub Actions pending; inspect run before declaring success.
- **Previous failure:** Run `37926993456` malformed JSX escapes; corrected in `e2b49e9`; runs `37928154757` and `37928177818` passed.

### 2026-10-09 — Initialization report outage isolation (pending CI)
- **Problem:** `init()` included report refresh in the same exception handler as bridge connectivity, so a healthy bridge was marked offline if latest scan, history, or activity retrieval failed.
- **Fix:** Handle report loading errors separately after successful bridge initialization, preserving connected state and showing an actionable warning.
- **Tests:** Parameterized initialization regression for `latestScan`, `history`, and `activity` failures.
- **Commits:** `f878df8`, `6b33268`.
- **Verification:** Pending new GitHub Actions result; engine unchanged.

### 2026-10-09 — Report recovery UI (pending CI)
- **Problem:** Initial report refresh errors were shown as toasts but had no persistent recovery action.
- **Fix:** Track report loading/error state separately from bridge health; show an inline retry action in History while preserving prior results. Retry calls `refreshData()` without restarting the bridge.
- **Tests:** Verify initial failure then successful report retry, restored data, and no additional bridge health request.
- **Commits:** `b602b1f`, `a35555e`, `127fb64`.
- **CI:** Pending; latest prior green run `37929596200`.
- **Engine:** Unchanged.

### 2026-10-09 — Heartbeat concurrency and stale response protection (pending CI)
- **Problem:** A delayed failed health request could mark the bridge offline after manual recovery; repeated interval ticks could overlap health checks.
- **Fix:** Serialize heartbeat checks per mounted provider; invalidate older health results when `init()` starts and on unmount. Only apply heartbeat failure when its request generation remains current.
- **Tests:** Stale heartbeat failure after manual reconnect; no overlapping heartbeat requests during a prolonged pending health call.
- **Commits:** `32829a4`, `1118bbb`.
- **CI:** Pending. Prior history recovery run `37929975956` verified green.
- **Engine:** No changes.

## Next engineering tasks

- [ ] Regression test scan completion when history/latest/activity refresh fails.
- [ ] Regression test failed scans, bridge outages during scans, and recovery without duplicate polling.
- [ ] Review scan-state polling concurrency and retry/backoff.
- [ ] Add backend authentication, filesystem and report-endpoint security tests.
- [ ] Validate real Windows desktop startup/shutdown and installer behavior.
- [ ] Compare the implemented visual interface against the agreed design using actual screenshots and user feedback.
- [ ] Keep README and this history updated with each verified batch.

## Update template

### YYYY-MM-DD — Brief feature or fix name
- **Goal:**
- **Files / behavior changed:**
- **Failed approaches / errors:**
- **Fix and rationale:**
- **Commit:**
- **CI run and result:**
- **Manual verification outstanding:**
- **Next action:**

## Development policy

Prefer small commits and inspect CI after each batch. Preserve the engine repository boundary and the private UI repository. Never mark an untested visual or packaging feature as verified. Document regressions, failed attempts, fixes, and outstanding limitations rather than silently overwriting history.
