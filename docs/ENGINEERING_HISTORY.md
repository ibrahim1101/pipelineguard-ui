# PipelineGuard UI — Engineering History

> Living record. Update this document whenever a meaningful UI, bridge, testing, or packaging change lands. Record unsuccessful approaches as well as successful fixes. Last verified checkpoint: 2026-10-09, UI commit `cbed81200b6d045d89188ca0618388f0f6a49504`, GitHub Actions run [37935723443](https://github.com/ibrahim1101/pipelineguard-ui/actions/runs/37935723443) **successful** (existing UI/Python checks only). Dedicated Rust validation pending.

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

### 2026-10-09 — Backend security review and snapshot regression tests (pending CI)
- **Scope:** Reviewed `backend/server.py`, `backend/bridge/routes.py`, and `backend/bridge/storage.py`; engine repository untouched.
- **Existing controls:** Desktop token authentication when `PIPELINEGUARD_TOKEN` is set; desktop mode requires a token; wildcard CORS rejected; report previews require recorded report paths and limit preview size; snapshot lookup rejects non-alphanumeric/non-hyphen identifiers.
- **New tests:** Reject snapshot traversal and invalid identifiers; reject malformed snapshot report data. Commit `7e5df38`.
- **Outstanding risks to evaluate:** When token is absent, non-desktop API mode has no authentication; confirm loopback-only binding. Filesystem browsing, configuration writing, report exports and scan paths accept broad absolute local paths by design; evaluate permissions and explicit trust boundaries. Add route-level authorization tests and report-preview symlink/allowlist tests.
- **CI:** Pending; do not mark security review complete or production-ready.

### 2026-10-09 — Bridge route-level security regression suite (pending CI)
- **Added:** `backend/tests/security_bridge.py` checks missing/invalid tokens on read and mutating endpoints, authenticated reads, report preview denial for unregistered files and symlinks, valid registered preview, oversized report denial and invalid scan identifier paths.
- **CI:** Runs security script in both Ubuntu and Windows bridge jobs. Commits `97b84dc`, `629daa3`.
- **Constraints:** Tests use isolated temporary data directory. Windows symlink case is skipped if OS denies symlink creation; other cases remain mandatory. Does not establish network binding safety or full filesystem authorization.
- **Verification:** Pending GitHub Actions result. Separate engine unchanged.

### 2026-10-09 — Loopback-only bridge launcher (pending CI)
- **Security:** Added `backend/launch_local.py`, a launcher with fixed `127.0.0.1` host and generated per-launch token; no host override and no token printed.
- **Tests:** Added `backend/tests/test_local_launcher.py` checking fresh token rotation and static loopback binding. Runs via existing cross-platform `unittest discover` CI step.
- **Limitation:** Token is not yet handed to the React frontend; requires future trusted desktop shell integration. Existing development launch path unchanged.
- **Commits:** `0c2b5e4`, `849e374`, `14548fd`.
- **CI:** Pending; engine unchanged.

### 2026-10-09 — Desktop token fail-closed behavior (pending CI)
- **Review:** Frontend currently reads an in-memory `window.__PIPELINEGUARD_TOKEN__` value; there is no verified Tauri shell provisioning that value or managing the Python process.
- **Fix:** When Tauri is present and the token is missing, API adapter now rejects requests before network I/O. Browser development mode remains backward compatible.
- **Tests:** Missing desktop token must block fetch; provisioned token only in request header, not URL; token-free browser development still works.
- **Commits:** `b309602`, `d60b202`.
- **Security caveat:** A global JS variable is not a hardened secret boundary against untrusted renderer scripts. Future shell should use a restricted IPC bridge and minimize renderer exposure. Full desktop startup/shutdown and token provisioning remain unimplemented.
- **CI:** Pending. Engine unchanged.

### 2026-10-09 — Isolated Tauri 2 desktop scaffold (pending CI)
- **Created:** `desktop/src-tauri/` with Cargo manifest, build script, Tauri configuration and minimal Rust entry point; `desktop/README.md` documents the security plan.
- **Isolation:** No modifications to existing React app, Python bridge, engine or CI workflow. Desktop bundling disabled. Scaffold not yet compiled or packaged; no secure IPC or managed sidecar.
- **Security design:** Native-only per-launch token, loopback bridge process ownership, restricted IPC and reliable child shutdown required before shipping.
- **Commits:** `50e6f39`, `3da2c2c`, `d81d54a`, `db9cd01`, `7972609`.
- **CI:** Pending. Existing workflow does not compile Rust/Tauri.

### 2026-10-09 — Dedicated Tauri Windows build validation (pending CI)
- **Added:** `.github/workflows/desktop-check.yml` to run manifest/config checks and `cargo check` on Windows for desktop-scoped changes.
- **Correction:** First workflow revision used `cargo check --locked` without a committed `Cargo.lock`; removed `--locked` during scaffold bootstrap. Lockfile reproducibility remains future work.
- **Coverage boundary:** This is Rust compile validation only, not Tauri app packaging, runtime startup or Windows installer verification.
- **Commits:** `293e11e`, `c8cc409`. Dedicated workflow result pending.

### 2026-10-09 — Desktop CI failure: missing Windows ICO (fix pending validation)
- **Failure observed:** Dedicated Tauri Windows job `37940083553` failed at `cargo check`: `desktop/src-tauri/icons/icon.ico` missing in `tauri-build` Windows resource generation. The earlier `--locked` failure was separately corrected; regular UI CI is green at run `37940103771`.
- **Fix attempted:** `desktop/src-tauri/build.rs` generates a minimal grayscale Windows ICO if no branded icon exists, before invoking `tauri_build::build()`. This avoids committing binary icon through the text-only GitHub file interface and permits later replacement by branded assets. Commit `5c2236b`.
- **Verification:** Pending dedicated desktop CI. If Rust or Tauri rejects placeholder ICO, inspect new logs and correct. No installer or sidecar integration claimed.

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

### 2026-10-09 — Product rebrand: Cerberus (UI-facing, CI pending)
- **Decision:** Cerberus is the new product/display name replacing PipelineGuard in the new React UI and desktop window title.
- **Changes:** Header typographic C mark and CERBERUS wordmark; dashboard, status and settings labels; HTML page title and description; Tauri `productName` and window title.
- **Privacy cleanup:** Removed leftover Emergent injected script and PostHog telemetry loader from `frontend/public/index.html` to match local-first/no-telemetry claims. Other dependencies and runtime telemetry behavior still require audit.
- **Compatibility:** Kept GitHub repositories, Python package/module names, API routes, storage locations and Tauri application identifier unchanged to avoid breaking v2 integrations. Existing logo asset remains in repository but is no longer used by header. Final Cerberus logo/icon and full technical migration remain future tasks.
- **Verification:** New UI and desktop workflows pending; not claiming packaged desktop app readiness.

### 2026-10-09 — Approved Cerberus emblem and metallic UI title
- **Approved artwork:** User-selected text-free olive/black three-headed Cerberus shield.
- **UI implementation:** Added compact 72px reproduction as `frontend/public/cerberus-mark.svg` (embedded JPEG), replaced temporary C in Header with shield; added `.cerberus-wordmark` styling in `frontend/src/index.css` for an angular metallic/olive title using offline system fonts.
- **Limitations:** The 72px embedded reproduction is a small UI icon, not the full-resolution source or a vector redraw. The exact custom typeface from the rendered mockup is not available as a font, so CSS approximates its look. Desktop icon/installer asset not replaced. Existing engine and API identifiers remain unchanged.
- **Verification:** React CI pending after branding commits. Preserve original full-resolution design for future icon and splash packaging.

### 2026-10-09 — Renderer API migration to native IPC (pending CI)
- **CI checkpoint:** All Cerberus branding React workflows green, including run `37942337934`; prior Tauri Windows compilation run `37941230527` green.
- **Change:** In Tauri context, frontend API now calls native `bridge_request` IPC with method/path/body and never directly fetches or accesses a renderer token. Browser development retains HTTP fetch behavior.
- **Tests:** Replaced obsolete token-global tests with IPC routing, fail-closed, HTTP error and browser compatibility tests.
- **Security and runtime boundary:** This is frontend preparation only. Native Rust `bridge_request` handler, process management and token storage **do not yet exist**. Tauri desktop API requests will fail until native handler is implemented; do not ship as complete desktop integration.
- **Commits:** `479444b9`, `8d771068`.

### 2026-10-09 — React IPC migration failure resolved
- **Failed historical workflow:** `37942638037` (commit `479444b9`): React lifecycle test job failed because `src/lib/api.test.js` still asserted old renderer token behavior after frontend switched to native IPC. Python smoke jobs on Ubuntu and Windows passed.
- **Correction:** Updated `frontend/src/lib/api.test.js` for native `bridge_request` IPC, fail-closed behavior and browser compatibility in commit `8d771068`.
- **Verified:** Updated test run `37942658222` **successful**; latest documentation commit `9a3751e9` run `37942674389` **successful**. Original historical run remains failed; newer green runs supersede it.
- **Next:** Implement Rust `bridge_request` and managed Python bridge lifecycle. The frontend IPC adapter alone does not make the desktop runtime operational.

### 2026-10-09 — Native Tauri IPC handler (pending Windows CI)
- **Implementation:** Added Rust `bridge_request` command using native reqwest client to proxy method/path/JSON body to loopback Python bridge, returning HTTP status and JSON response to React. The token stays native-side; no renderer global or browser fetch in Tauri mode.
- **Guards:** Fail closed without configured token, reject unsafe paths/methods, disable redirects, request timeout, loopback-only target; unit tests cover accepted/rejected request shapes.
- **Development configuration only:** `CERBERUS_DEV_BRIDGE_TOKEN` and optional `CERBERUS_DEV_BRIDGE_PORT` supply the token/port to the Rust process. Production must instead generate token in native code and own Python child lifecycle. No automatic engine startup, dynamic port reservation or installer yet.
- **Commits:** `c8ee58b`, `c2ffba7`, `a01d33e`. Windows Tauri and React CI in progress; runtime behavior not yet validated.

### 2026-10-09 — Native-owned token handoff groundwork
- **Prior validation:** Native Rust IPC compilation passed in desktop run `37944499669`; latest React/Python UI run `37944548355` passed.
- **Bridge change:** `backend/launch_local.py` supports `CERBERUS_MANAGED_CHILD=1`: requires `PIPELINEGUARD_TOKEN` supplied by a trusted native parent and sets desktop auth mode, rather than generating a token the parent cannot know. Existing standalone development behavior remains unchanged.
- **Test:** Added a contract test ensuring the managed-child token requirement remains present.
- **Next blocker:** Rust does not yet generate token, launch/reap child or wait for readiness. Do not claim automatic startup works. Verify CI for this incremental bridge contract before proceeding.

### 2026-10-09 — Experimental Rust-owned Python bridge lifecycle (CI pending)
- Added optional `CERBERUS_MANAGED_DEV=1` mode in Tauri Rust: generates a 256-bit native token, obtains an ephemeral loopback port, spawns Python uvicorn with desktop auth and engine path, retains child in native state, and kills/reaps it on state drop.
- Requires `CERBERUS_BACKEND_DIR`, `PIPELINEGUARD_ENGINE_PATH` and installed Python dependencies; not a packaged desktop binary.
- **Known incomplete areas:** No authenticated readiness wait; port reservation race; no child crash recovery; managed launch errors silently fall back to manual mode; process-tree cleanup not established. Not production ready. Native CI pending for commit `dadf125`.

### 2026-10-09 — Cerberus browser branding audit
- Found `frontend/public/index.html` still displayed Emergent's default page title and description, despite the Cerberus header branding. Replaced with Cerberus product title, security-scanner description, theme color, and existing shield SVG favicon. Removed external Google Fonts requests for offline desktop consistency.
- Applied dedicated, subtle olive-metal icon treatment in the app header without changing the approved shield shape; preserved the existing Cerberus wordmark CSS.
- **Remaining:** The checked-in shield SVG embeds a small 72×72 JPEG reproduction, not the original high-resolution artwork; Windows native icon remains a placeholder. Final full-resolution asset integration, branded ICO, font matching and visual QA remain open.
- **Commits:** `d1899a4`, `41e8d16`, `dd71f38`. CI pending.

### 2026-10-09 — High-resolution Cerberus artwork delivery and integration path
- Recovered the original approved 1254×1254 PNG locally and generated a ZIP of original, scaled PNGs and multi-size Windows ICO. This ZIP is delivered as a conversation download, **not yet committed to GitHub**.
- Added `scripts/install-cerberus-brand-assets.ps1` to unpack the ZIP into the correct frontend and Tauri icon paths on a Windows checkout. Script does not auto-commit/push and preserves exact original artwork.
- Header now prefers `/cerberus-logo-original.png` and falls back to the existing checked-in `/cerberus-mark.svg` until the binary asset is uploaded. Tauri build script already uses `icons/icon.ico` when present.
- **Remaining:** Run the installer script on a local checkout and push the binary files, then verify browser and native icon rendering. Until that happens, repository still uses low-resolution logo and placeholder ICO. Commits `7067596`, `c7b5a3f`.

### 2026-10-09 — Cerberus branded icon enforcement
- Confirmed original high-resolution logo, scaled PNGs and branded Windows ICO were committed to main; desktop run `37948376427` and UI run `37948376401` both succeeded.
- Removed the legacy 1×1 grayscale placeholder generation in `desktop/src-tauri/build.rs`. The desktop build now fails if the Cerberus ICO is absent or clearly invalid.
- Added Windows CI asset checks for the approved native ICO and original PNG so branding cannot silently regress.
- **Next:** Verify these checks in new CI, then run a real Windows desktop visual review. Commits `71d95f1`, `3005268`.

### 2026-10-09 — Cerberus shell layout refinement
- Confirmed branded icon enforcement passed Windows desktop CI `37949992723` and UI CI `37949992773`.
- Updated AppShell workspace to constrain horizontal overflow and adapt page padding to narrower windows.
- Sidebar navigation now scrolls independently of its fixed privacy footer, preventing overlap in shorter desktop windows; sidebar width adapts at XL breakpoint.
- Header brand and profile selector widths adapt to match sidebar sizing. No page-level visual QA performed yet; these are source-level layout corrections only.
- Commits `8b95c68`, `167f16b`, `79f22af`. Await new CI results.

### 2026-10-09 — Scan action deduplication and Findings viewport refinement
- Previous Cerberus shell UI runs `37954926083`, `37954915128`, `37954903886`, `37954892292` passed.
- Inspected Dashboard, Scan Project, Findings and shell sources. Confirmed two simultaneous Start Scan actions on the Scan Project route (header and primary page action). Header now omits its scan button on `/scan`, preserving the dedicated page action and header action elsewhere.
- Findings page now has a minimum usable height, adjusted viewport sizing, and responsive search width. This is a source-level layout improvement, not a completed visual QA pass.
- Commits `1fffa01`, `b1100ea`. CI pending.

### 2026-10-09 — Dependencies, Reports, History, Settings UI audit
- Confirmed prior Scan Project and Findings UI CI runs `37956142230`, `37956153047`, `37956165479` all passed.
- Dependencies: improved short-window table sizing, responsive metrics grid, full-width mobile search, and flex overflow containment.
- History: responsive search and minimum table width inside existing horizontal scroll region.
- Settings: scrollable tab strip for six tabs on narrow windows and responsive select width.
- Reports: changed remaining visible PipelineGuard references to Cerberus and improved format-picker grid at narrow widths.
- Source-level changes only; rendered desktop inspection remains outstanding. CI for these commits pending.

### 2026-10-09 — Scan entry guard and managed bridge diagnostics
- Previous four-page UI refinement CI runs `37956599782`, `37956604068`, `37956612592`, `37956618490`, `37956634655` passed.
- Header Start Scan is disabled when no project folder is selected, matching the Scan Project page's guard.
- Desktop managed development bridge now emits an explicit startup diagnostic when `CERBERUS_MANAGED_DEV=1` and spawning fails, rather than silently swallowing the error. Production packaging, authenticated readiness and runtime visual QA remain pending.

### 2026-10-09 — Authenticated managed bridge readiness
- Prior desktop validation `37957135170` and UI validations `37957135346`, `37957149364` passed.
- Rust Tauri managed-development bridge now probes the protected `GET /api/status` endpoint with its randomly generated per-launch `X-PipelineGuard-Token` before accepting the child as ready. The public health endpoint is deliberately not used.
- Polls for up to 12 seconds, checks early child exit, and kills/reaps a child that fails readiness. The renderer never receives the token.
- This remains opt-in `CERBERUS_MANAGED_DEV=1`; no installer or production sidecar is claimed. Startup may still need runtime Windows verification. Commit `33a3c90`.

### 2026-10-09 — Managed bridge fail-closed hardening
- Authenticated bridge readiness changes passed desktop CI `37957562032` and UI CI `37957562054`, `37957580320`.
- Added `CERBERUS_MANAGED_CHILD=1` to spawned Python environment, recorded early child exit status and explicitly handled process inspection failures.
- Fixed managed startup fallback: if `CERBERUS_MANAGED_DEV=1` and the child fails to start or authenticate, the shell must not fall back to `CERBERUS_DEV_BRIDGE_TOKEN` (fail closed).
- Commits `a11e44f`, `c7a386e`. Pending CI and Windows runtime smoke test. Installer bundling remains disabled.

### 2026-10-09 — Windows desktop unit-test gate
- Previous managed bridge hardening passed desktop runs `37958467262`, `37958481326` and UI runs `37958467467`, `37958481384`, `37958498883`.
- Desktop Windows workflow now executes `cargo test` after `cargo check`, so Rust unit tests become a CI gate. The workflow previously compiled without running tests.
- Commits `67c8f40`, `a891b6e`. Runtime Windows smoke testing and installer bundling are still pending.

### 2026-10-09 — Encoded bridge path regression hardening
- Windows Rust test-gate CI `37959048624` and `37959055101` passed, along with corresponding UI CI.
- Added `unsafe_encoded_path` guard to reject encoded dot, slash, backslash and percent escapes in the API pathname while allowing legitimate percent-encoded filesystem paths in query parameters.
- Added regression assertions for `%2e`, `%2f`, `%5c`, nested `%25` and mixed-case encodings. Commit `5c91a1f`; CI and Windows runtime smoke test pending.

### 2026-10-09 — Windows managed Python runtime smoke test
- Encoded native bridge path regression passed Windows CI `37961410130` and UI CI `37961410124`, `37961438891`.
- Added `backend/tests/test_managed_runtime.py`, which starts the real Uvicorn bridge on an ephemeral Windows loopback port, waits for authenticated `/api/status`, rejects missing and incorrect tokens, verifies valid-token access, and terminates/reaps the process.
- Added `.github/workflows/managed-bridge-smoke.yml` with Windows Python 3.11 setup, engine/backend dependencies and the subprocess smoke test. Commits `5197106`, `e77045b`.
- This covers the Python subprocess independently, not yet the full Tauri UI or installer lifecycle. New workflow results pending.

### 2026-10-09 — Windows runtime smoke dependency fix
- Initial managed Python smoke workflow `37963103410` failed during dependency installation, before executing tests: `emergentintegrations==0.2.2` was unavailable on the public package index.
- Narrowed smoke workflow dependencies to the actual bridge runtime (`fastapi`, `uvicorn`, `python-dotenv`, `httpx`) plus engine requirements, instead of installing unrelated full backend requirements. Commit `8e489be`.
- This does not alter the application's full backend dependency manifest; packaging dependency audit remains pending.
