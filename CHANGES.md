# Changes in this version

Adds the three features described in the research paper — **admin dashboard**, **AI-assisted summarisation**, **hash-chained audit log** — to the existing app.

## New files
| Path | Purpose |
|---|---|
| `backend/models/AuditBlock.js` | One block of a plot's hash chain (append-only; update/delete refused by the model) |
| `backend/services/auditChain.js` | Canonical serialisation, SHA-256 hashing, `appendBlock` (paper Algorithm 2), `verifyLand` (VerifyChain), backfill, per-plot write lock |
| `backend/services/summariser.js` | The only file that talks to Claude (provider can be swapped without touching routes) |
| `backend/middleware/rateLimit.js` | Per-user limit on AI summaries (cost protection) |
| `backend/routes/admin.js` | Admin-only API: stats, land list, create users, link plots, reset password, verify-all |
| `backend/scripts/backfillAudit.js` | `npm run audit:backfill` — start chains for plots created before this version |
| `backend/tests/` | `npm test` — regression suite + new-feature suite (160 checks) |
| `backend/.env.example` | Documents all environment variables |
| `admin/` | React web dashboard (Vite). `npm run dev` / `npm test` / `npm run build` |
| `frontend/eLedger/components/RecordTools.jsx` | "Record verified" badge + "Summarise this record" button |

## Modified files
| Path | Change |
|---|---|
| `backend/routes/land.js` | Writes now also append audit blocks · **update validators switched on** · **officials limited to assigned villages for writes** · new `GET /land/:id/integrity`, `POST /land/:id/summarise` |
| `backend/routes/auth.js` | + `POST /auth/change-password`; login response also carries `mustChangePassword` |
| `backend/models/User.js` | + `mustChangePassword` (default `false`) |
| `backend/server.js` | mounts `/admin` |
| `backend/seed.js` | wipes + rebuilds audit chains for seeded plots |
| `backend/package.json` | scripts: `start`, `seed`, `test`, `audit:backfill` (README already told you to run `npm start`, which did not exist) |
| `frontend/eLedger/lib/api.jsx` | + `getIntegrity`, `summariseLand` (appended) |
| `frontend/eLedger/app/land/[id].jsx` | +6 lines: renders `<RecordTools />` |
| `README.md` | setup, tests, audit-chain explanation, known limit |

## Behaviour changes to EXISTING endpoints (all deliberate)
1. **Enum validation now enforced on transfer / comment / status writes.** Before, `POST /land/:id/comment {tag:"nonsense"}` returned 200 and set the plot's status to `"nonsense"`; an invalid `transferType` was stored permanently in the append-only history. Now → 400. The app only sends valid values, so nothing legitimate is affected.
2. **Officials can only write to plots in their `assignedVillages`** (comment, transfer, status). Previously only the flagged *list* was filtered. An official with no villages assigned can no longer write anywhere. Seeded data is unaffected (both villages are assigned).
3. Everything else — routes, request bodies, response shapes — is unchanged. `tests/regression.js` checks 39 of these behaviours and passes on both the old and new code (apart from the two bugs in point 1, which fail on the old code).

## Things you should know
* **Plots changed outside the API are reported, on purpose.** `backend/test_comments.js` (and anything else that writes with `land.save()` or edits MongoDB directly) adds entries with no audit block, so `GET /land/:id/integrity` reports them as *"exists in the record but was never written to the audit log"*. That is the feature working.
* **The audit log is tamper-*evident*, not tamper-*proof*.** Rewriting the data *and* the entire log and recomputing every hash is not detected (test (j) demonstrates this on purpose). Closing it needs the head hash stored outside this database.
* **Concurrency:** writes to one plot are serialised inside a single Node process. Running several API instances needs a shared lock (the unique `{land, seq}` index still prevents a corrupted chain; a loser would just retry/fail).
* If an audit block cannot be written after the record itself was saved, the request still succeeds, the problem is logged, and the response carries `auditWarning: true`; the next verification shows that entry as not anchored.
* Not changed, but worth fixing: `server.js` prints `MONGO_URI` (including any password) to the console on start; `/land/search` builds a regex from user input without escaping it.
