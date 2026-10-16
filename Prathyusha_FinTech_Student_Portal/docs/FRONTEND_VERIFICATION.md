# Frontend and full-stack verification

**Production build passed (TypeScript + Vite). Six frontend/integration tests passed, in addition to the 16 backend integration tests.**

## Actual full-stack UI journey

React DOM (jsdom) → real HTTP → Express API → compiled Spring Security service → PostgreSQL WASM (PGlite):

1. Sign in with an approved student account.
2. Load the dashboard from the database.
3. Edit and save the profile; read the saved value back through the API.
4. Create a project through the frontend form.
5. Record a contribution with evidence URL and submit it for review.
6. Read back its SUBMITTED state through the backend API.
7. Load activity summary, then sign out and confirm the session is rejected.

Five further UI tests check accessible labels/required fields, zero and nonzero counters, retry interaction, readable verification status and rejected login feedback.

The disposable test fixture starts Spring from `runtime/fintech-auth-1.0.0.jar`; it does not simulate API responses or use production student data. PGlite has a single transaction context, so this DOM fixture serializes HTTP requests. Production frontend requests run normally in parallel against native PostgreSQL. Native PostgreSQL concurrency/load behavior remains unverified here. jsdom AbortSignals are adapted to Node native fetch in the test only.

## Visual and asset checks

- Implemented from the actual Figma design contexts and screenshots for the assigned screens, with the original maroon/cream/gold tokens.
- Exact source college logo recovered from its Figma image hash: 768 × 131 PNG, 15,028 bytes. Header slot is 340 × 58, object-fit contain; login slot preserves the original aspect ratio. The mobile slot scales proportionately. No temporary Figma URL remains in source or build.
- Manrope fonts are bundled locally; no external font service is required at runtime.
- CSS includes desktop/tablet/mobile breakpoints, reduced-motion support, visible keyboard focus, labelled forms and overflow-safe tables.
- A browser-control skill was unavailable in this managed environment. No preview server or browser was started; rendered browser screenshots and pixel-level fidelity were therefore **not verified**. DOM interaction tests do not replace browser visual QA.
- Docker/Nginx deployment is supplied but was not executed here; Docker Desktop should be used for the final local deployment check.

## Test output

```text
 RUN  v3.2.7 /workspace/scratch/549bb66657f9/fintech-student-backend/frontend

 ✓ src/fullstack.test.tsx (1 test) 7076ms
   ✓ completes login → dashboard → profile save → project → contribution → summary → logout against real services  2091ms
 ✓ src/components/UI.test.tsx (5 tests) 144ms

 Test Files  2 passed (2)
      Tests  6 passed (6)
   Start at  15:43:08
   Duration  8.92s (transform 266ms, setup 182ms, collect 556ms, tests 7.22s, environment 598ms, prepare 114ms)

```
