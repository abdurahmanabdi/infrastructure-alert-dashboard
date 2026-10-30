# InfraLens — Operations Console

A responsive React + TypeScript user interface for the Infrastructure Alert Intelligence Dashboard.

## Start locally

```bash
cd frontend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

### Data source modes

**Demo (default):** A fixed, simulated operations scenario generated in `src/console/demo.ts`. Includes illustrative hourly activity counts and deployment risk scores. Interactions such as incident acknowledgement update browser memory only; a page reload resets the scenario. This mode works with **no backend** and is always labeled.

**Connect API:** Read-only requests to the Flask service:

- `GET /api/alerts/`
- `GET /api/infrastructure/`
- `GET /api/predictions/`

Use `REACT_APP_API_BASE_URL=http://localhost:5000/api` in `frontend/.env.local` to point to a running backend. The sample value is shown in `.env.example`.

The backend currently uses mock records, and the model can train on synthetic data. **API mode is not production telemetry** and is labeled accordingly. There is no silent fallback to demo mode if a request fails: errors display a clear retry action. Requests are cancellable and time out after 12 seconds.

### Views

- **Overview:** Derived incident statistics, illustrative or API-derived event volume, service health, priority queue, deployment watchlist.
- **Incidents:** Search and severity filtering, accessible incident detail drawer; demo-only acknowledgement.
- **Service topology:** Deterministic dependency graph and keyboard-accessible selectable nodes; downstream blast-radius inspection.
- **Deployments:** Experimental model scores with expandable risk factors and suggested verification steps. Risk scores are neither calibrated nor production validated.

Legacy paths (`/alerts`, `/infrastructure`, `/analysis`, `/predictions`) redirect to their new counterparts.

## Quality checks

```bash
cd frontend
npm run test:ci -- --runInBand
npm run build
```

The repository contains a pull-request workflow in `.github/workflows/frontend-quality.yml` to run tests and a production build. Dependency installation is not yet locked; generating and committing a `package-lock.json` after a clean install is a recommended next step.

## Architectural notes

- `src/console/model.ts` — stable UI types, domain selectors, incident filtering, graph traversal and layout
- `src/console/demo.ts` — explicitly simulated scenario
- `src/console/api.ts` — read-only Flask API normalization and validation
- `src/console/visuals.tsx` — reusable, accessible charts, status visuals, topology
- `src/console/ConsoleApp.tsx` — application composition and feature views
- `src/console/console.css` — design tokens and responsive styles
- `src/console/*.test.*` — domain and UI regression tests

No new visualization or state-management dependency was introduced. The original prototype files remain in `src/pages`, `src/features`, `src/components` and adjacent directories for migration reference; `tsconfig.json` excludes these legacy modules from the new app build. A follow-up cleanup can remove those files once the new console is accepted.

## Next backend milestones

1. Persist alert events and component relationships in a real datastore. Distinguish real status updates from mock responses.
2. Define a versioned events schema and streaming subscription; use a server-driven timestamp, rather than inferring recency from the browser clock.
3. Integrate authenticated API reads and authorization before enabling live incident acknowledgement.
4. Train and calibrate deployment predictions on traceable real-world data, with documented baselines and evaluation.
5. Add contract tests against the Flask service, browser E2E checks, structured logs and performance budgets.

**Important:** This is an operations-interface prototype, not a claim of a live production-monitoring deployment or measured MTTR improvement.
