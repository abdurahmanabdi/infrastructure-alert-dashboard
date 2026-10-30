"""Minimal application smoke tests; no Kafka broker or database required."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app


def test_app_factory_creates_flask_application():
    app = create_app("testing")
    assert app.config["TESTING"] is True


def test_health_endpoint_returns_json():
    app = create_app("testing")
    response = app.test_client().get("/api/health")
    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"
