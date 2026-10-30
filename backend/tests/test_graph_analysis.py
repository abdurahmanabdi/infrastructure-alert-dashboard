"""Regression tests for infrastructure graph impact and failure domains.

Run from the repository root after installing backend requirements:
    PYTHONPATH=backend python -m pytest backend/tests -q
"""
from pathlib import Path
import sys

# Allow importing the Flask app package from the repository root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.infrastructure import InfrastructureComponent, ComponentStatus
from app.services.graph_analysis import GraphAnalysis


def component(identifier, dependencies=(), status=ComponentStatus.HEALTHY):
    return InfrastructureComponent(
        component_id=identifier,
        name=identifier,
        component_type="service",
        status=status,
        dependencies=list(dependencies),
    )


def sample_graph():
    # checkout -> api -> database. A database failure propagates to both.
    return {
        "database": component("database", status=ComponentStatus.CRITICAL),
        "api": component("api", ["database"]),
        "checkout": component("checkout", ["api"]),
        "unrelated": component("unrelated"),
    }


def test_dependency_impact_traverses_in_reverse_direction():
    result = GraphAnalysis.bfs_impact_analysis(sample_graph(), "database")
    assert result["affected_components"] == ["api", "checkout", "database"]
    assert result["source_component"] == "database"
    assert result["impact_score"] > 0
    assert result["timestamp"]


def test_leaf_failure_does_not_affect_its_dependencies():
    result = GraphAnalysis.bfs_impact_analysis(sample_graph(), "checkout")
    assert result["affected_components"] == ["checkout"]


def test_missing_source_returns_empty_impact():
    result = GraphAnalysis.bfs_impact_analysis(sample_graph(), "missing")
    assert result["affected_components"] == []
    assert result["impact_score"] == 0.0


def test_union_find_groups_connected_nodes():
    result = GraphAnalysis.union_find_analysis(
        sample_graph(), ["database", "api", "checkout", "unrelated"]
    )
    domains = {frozenset(domain) for domain in result["failure_domains"]}
    assert domains == {
        frozenset({"database", "api", "checkout"}),
        frozenset({"unrelated"}),
    }


def test_health_status_propagates_from_critical_dependency():
    result = GraphAnalysis.health_status_analysis(sample_graph())
    assert result["affected_components"] == ["api", "checkout", "database"]


def test_all_healthy_graph_has_no_affected_services():
    graph = {
        "database": component("database"),
        "api": component("api", ["database"]),
    }
    result = GraphAnalysis.health_status_analysis(graph)
    assert result["affected_components"] == []
    assert result["impact_score"] == 0.0
