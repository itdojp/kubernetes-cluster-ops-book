# Issue #16 capture evidence chain

`sanitized-artifact/` contains the 14 terminal transcripts and environment
metadata downloaded from the successful GitHub Actions capture artifact before
that artifact was deleted. These are sanitized capture outputs, not raw runner
logs. They intentionally retain disposable fixture names so that the reviewed,
deterministic publication transform can be audited.

The evidence chain is:

1. immutable capture run and source commit;
2. `actions/upload-artifact` digest recorded by the run;
3. fixed SHA-256 over the downloaded sanitized file set;
4. deterministic replacement of disposable fixture names;
5. checked published transcript set;
6. deterministic PNG rendering.

The file-set hash algorithm processes regular files in bytewise filename order
as `filename`, NUL, file bytes, NUL. The fixed expected value and the per-entry
source mapping are enforced by `scripts/check-visual-evidence.js`.

Do not edit these files in place. A legitimate refresh requires a new isolated
capture run and the complete review procedure documented in `SCREENSHOTS.md`.
