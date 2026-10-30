# Engineering review and validation plan

Reviewed: October 2026

## Scope of this patch

The following changes address concrete reliability and reproducibility gaps observed during source review:

1. **Dependency impact analysis:** `GraphAnalysis.bfs_impact_analysis` and `health_status_analysis` traverse the dependency graph backward, starting at the failed component. The previous implementation ran a separate shortest-path search for each component. The revised approach uses one reverse-graph traversal and preserves the intent of dependency propagation.
2. **Missing timestamp import:** `graph_analysis.py` referenced `datetime.utcnow()` but did not import `datetime`, which could trigger a runtime error during graph analysis.
3. **Missing Flask module:** `app/__init__.py` imported `app.utils.error_handlers` even though no `app/utils` directory existed. This patch adds minimal error handlers returning JSON without exposing exception internals.
4. **Missing frontend entry point:** The React application included `src/index.tsx` but no `frontend/public/index.html`. The entry point now exists.
5. **Health check and tests:** Adds `/api/health`, graph regression tests, Flask smoke tests, and a portable replacement for the hard-coded `/home/ubuntu/...` test runner.

These changes have **not** been validated against a fully installed local backend, frontend, Kafka broker, or database in this review environment. Successful GitHub commits do not establish a passing integration test suite.

## Critical gaps before production

### 1. Replace fixtures with persisted, scoped data
- Current analysis service returns hard-coded infrastructure objects rather than reading a datastore.
- Current alert list and alert updates include mock data. A POST returning a generated ID does not prove that the alert persists.
- Decide on a canonical storage schema, migration strategy, and retention policy before exposing the service to real operational data.
- Integration verification: create -> read -> update -> list -> delete should preserve state across independent requests and service restarts.

### 2. Separate ML demonstration from calibrated deployment risk
- The deployment predictor trains on synthetic samples when no saved model exists.
- Historical context values are populated with mock defaults; do not present the output as an operationally calibrated risk score.
- Collect authorized historical deployments, define label windows, and split train/test data chronologically to prevent temporal leakage.
- Report precision-recall by risk band, calibration, Brier score, false-positive rate, and performance by deployment type. Compare with a simple non-ML baseline.
- Include dataset provenance, experiment seeds, feature dictionary, model card, and model version in the API response.

### 3. Establish end-to-end streaming guarantees
- Verify an actual Kafka -> consumer -> server -> browser path. Code referring to Kafka is not evidence that the WebSocket/UI path works under load.
- Specify event IDs, schema validation, deduplication, retry strategy, dead-letter handling, and acceptable delivery latency.
- Benchmark using a committed load generator and publish the exact environment, message volume, percentile latencies, and test logs.

### 4. Security and configuration
- Restrict CORS origins instead of broad development defaults.
- Require authentication and role-based authorization for write and prediction endpoints; JWT initialization by itself is not endpoint authorization.
- Replace development secret defaults in deployable environments; prevent secrets from reaching the repo or logs.
- Test input validation, permission boundaries, rate limiting, and failure recovery before any internet-facing deployment.

### 5. Verification and claims
- Historical performance metrics in `docs/validation_report.md` should be treated as unverified reported figures until source test scripts, measured logs, and test configurations are committed.
- This patch adds regression tests for **logical correctness**, not performance benchmarks.
- Run `bash tests/run_tests.sh` after installing dependencies and record the output. Then run `npm install`, `npm run build`, and frontend tests separately.
- Add CI only after dependencies and runtime versions are reconciled and the commands pass consistently.

## Suggested prioritized milestone sequence

1. **Reliability:** run new tests and resolve dependency install issues; confirm the app factory and client boot locally.
2. **Data correctness:** replace mock alerts with a durable store and document an explicit event schema and data lineage.
3. **ML validity:** replace fabricated historical inputs with evaluated data and record reproducible metrics.
4. **Streaming:** implement/verify the complete Kafka to browser pipeline with integration tests and resilience.
5. **Deployment:** security review, image builds, staged rollout, logging/metrics and rollback procedure.

## Portfolio description (safe for applications)

"Built a full-stack infrastructure alert intelligence prototype with Flask APIs, React/TypeScript and D3.js visualization, dependency graph impact analysis, and experimental deployment-risk scoring. Added graph regression tests and documented limitations of synthetic model training and unverified performance claims."

Avoid claiming production customer deployments, measured MTTR reduction, or independently validated latency numbers without supporting artifacts.
