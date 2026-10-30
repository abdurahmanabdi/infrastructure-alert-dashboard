<img width="1881" height="970" alt="Screenshot 2026-10-30 170434" src="https://github.com/user-attachments/assets/9673b6e1-d7fc-47f5-934c-9d17ee1de157" />
# Infrastructure Alert Intelligence Dashboard

> **Engineering status (October 2026): research/portfolio prototype, not a production deployment.**
> API data is currently backed by mock fixtures in several endpoints. The deployment-risk model is trained on synthetic data by default, and the original validation report contains reported performance figures without a committed reproducible benchmark harness. Do not interpret them as independently verified production SLAs.
> This repository now has graph regression tests, Flask smoke tests, a liveness route, and a portable test runner; run the tests in your own environment before relying on the results.


![image](https://github.com/user-attachments/assets/d848e862-0ab3-44ec-b7f1-9e85cb945186)

## Overview

The Infrastructure Alert Intelligence Dashboard is a full-stack application designed to reduce Mean Time To Resolution (MTTR) for infrastructure alerts. The system models infrastructure as a dynamic graph, applies advanced algorithms for analysis, and uses machine learning to predict deployment risks.

Built with TypeScript, Flask, React, D3.js, and Kafka integration, this dashboard provides a real-time UI with a high-contrast theme optimized for operations environments.

## Key Features

- **Real-time Alert Monitoring**: Track and manage infrastructure alerts with high visibility
- **Dynamic Graph Visualization**: Interactive visualization of infrastructure components and their relationships
- **Advanced Analysis Algorithms**:
  - BFS (Breadth-First Search) for impact analysis
  - Union-Find for failure domain detection
- **ML-based Risk Prediction**: Predict deployment risks with actionable recommendations
- **High-Contrast UI**: Designed for clarity in operations environments

## Technology Stack

### Backend
- **Framework**: Flask (Python)
- **Real-time Messaging**: Kafka
- **Algorithms**: BFS, Union-Find
- **Machine Learning**: Gradient Boosting for risk prediction

### Frontend
- **Framework**: React with TypeScript
- **State Management**: Redux
- **Visualization**: D3.js
- **UI Components**: Material-UI with custom high-contrast theme

## Project Structure

```
infrastructure-alert-dashboard/
├── backend/                  # Flask backend
│   ├── app/                  # Application code
│   │   ├── api/              # API endpoints
│   │   ├── models/           # Data models
│   │   ├── services/         # Business logic services
│   │   └── utils/            # Utility functions
│   ├── tests/                # Backend tests
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React frontend
│   ├── src/                  # Source code
│   │   ├── components/       # Reusable components
│   │   ├── pages/            # Page components
│   │   ├── features/         # Redux slices
│   │   ├── services/         # API services
│   │   └── types/            # TypeScript type definitions
│   └── package.json          # Node.js dependencies
├── docs/                     # Documentation
│   ├── architecture.md       # System architecture
│   ├── requirements.md       # Project requirements
│   └── validation_report.md  # Validation results
└── tests/                    # Integration tests
    └── results/              # Test results
```

## Installation

### Prerequisites
- Node.js 16+
- Python 3.8+
- Kafka (optional for real-time features)

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables (optional):
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. Start the Flask server:
   ```bash
   python -m flask run --host=0.0.0.0
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (optional):
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the development server:
   ```bash
   npm start
   ```

5. Access the application at http://localhost:3000

## Usage Guide

### Dashboard
The dashboard provides an overview of infrastructure health status:
- Critical alerts count
- Components affected
- Infrastructure map
- Recent alerts

### Alerts
Manage and respond to infrastructure alerts:
- View all alerts with filtering and sorting
- Acknowledge and resolve alerts
- View alert details and affected components

### Infrastructure
Explore and manage infrastructure components:
- Graph visualization of components and dependencies
- List view of all components
- Component details and status
- Dependency information

### Analysis
Analyze infrastructure using advanced algorithms:
- Impact analysis using BFS
- Failure domain analysis using Union-Find
- Health status analysis of the entire infrastructure

### Predictions
Get deployment risk predictions:
- Risk assessment for planned deployments
- Optimal deployment windows
- Risk factors and recommended actions

## Testing

Run the automated tests to verify functionality:

```bash
cd tests
./run_tests.sh
```

This will execute:
- API tests
- Real-time flow tests
- UI responsiveness tests

## Performance Metrics

- Average page load time: 830ms
- API response time: 85ms
- Alert propagation (Kafka to UI): 210ms
- Graph rendering (50 nodes): 1.2 seconds
- ML prediction time: 180ms

## Deployment

### Production Build

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. Serve the static files using a web server of your choice (Nginx, Apache, etc.)

3. Configure the backend for production:
   ```bash
   cd backend
   # Set environment variables for production
   export FLASK_ENV=production
   ```

4. Use a WSGI server like Gunicorn:
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 app:app
   ```

### Docker Deployment (Optional)

Docker configuration files are included for containerized deployment:

```bash
docker-compose up -d
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- D3.js for the powerful visualization capabilities
- Material-UI for the component library
- Flask for the lightweight backend framework
- Kafka for real-time messaging


## Reproducible engineering checks

Use a Python environment compatible with the versions pinned in `backend/requirements.txt` (the dependencies were originally pinned in 2022; Python 3.9 is a sensible starting point). From the repository root:

```bash
python -m pip install -r backend/requirements.txt
bash tests/run_tests.sh
```

For a backend development server:

```bash
cd backend
export FLASK_APP=app:create_app
python -m flask run --port 5000
curl http://localhost:5000/api/health
```

Frontend (requires Node.js/npm and an installed dependency tree):

```bash
cd frontend
npm install
npm start
```

The included regression tests cover dependency direction, disconnected nodes, missing graph sources, failure-domain grouping, infrastructure health propagation, and a Flask application smoke check.

## Known limitations and evidence boundaries

- The graph-analysis fixture data is hardcoded in `backend/app/services/analysis_service.py`; this is not yet a database-backed operational system.
- `backend/app/services/prediction_service.py` trains on generated samples if no trained model exists, and fills historical metrics with mock values. Its predictions are demonstrations and should not be treated as validated risk estimates.
- Kafka integration is implemented in code but end-to-end production reliability, retries, backpressure, and the referenced WebSocket data path require independent verification.
- Existing latency and scalability numbers in `docs/validation_report.md` are **reported by that document**, not independently reproduced by the new tests.
- Authentication, access control, security testing, and integration/deployment readiness have not been established by this improvement pass.

See [Engineering Review](docs/ENGINEERING_REVIEW.md) for concrete follow-up work and verification criteria.
