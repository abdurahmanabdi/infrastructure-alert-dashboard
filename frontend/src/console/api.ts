/**
 * Read-only API adapter for the existing Flask /api routes.
 *
 * The backend currently returns fixtures and synthetic deployment predictions.
 * Do NOT silently mix these responses with our local demo dataset.
 */
import {
  Deployment, Incident, IncidentStatus, Service, ServiceStatus, Severity, Snapshot, hourlyTrend,
} from './model';

type JsonRecord = Record<string, unknown>;
const API_BASE = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord : {};
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeSeverity(value: unknown): Severity {
  return ['critical', 'high', 'medium', 'low', 'info'].includes(String(value))
    ? value as Severity : 'info';
}

function normalizeStatus(value: unknown): IncidentStatus {
  if (value === 'acknowledged') return 'acknowledged';
  if (value === 'in_progress') return 'investigating';
  if (value === 'resolved' || value === 'closed') return 'resolved';
  return 'open';
}

function normalizeHealth(value: unknown): ServiceStatus {
  return ['healthy', 'degraded', 'warning', 'critical', 'unknown', 'maintenance'].includes(String(value))
    ? value as ServiceStatus : 'unknown';
}

function normalizeTitle(value: unknown): string {
  return stringValue(value, 'Untitled alert').replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

function listPayload(value: unknown, name: string): JsonRecord[] {
  // Older API iterations may return either a list or a keyed record.
  if (Array.isArray(value)) return value.map(record);
  const data = record(value);
  if (Array.isArray(data.items)) return data.items.map(record);
  const values = Object.values(data);
  if (values.length && values.every(item => typeof item === 'object' && item !== null && !Array.isArray(item))) {
    return values.map(record);
  }
  if (!values.length) return [];
  throw new Error('Invalid ' + name + ' response: expected an array of records.');
}

function normalizeIncident(value: JsonRecord): Incident {
  const metadata = record(value.metadata);
  return {
    id: stringValue(value.alert_id, 'unknown-alert'),
    title: normalizeTitle(value.alert_type),
    description: stringValue(value.description, 'No description supplied.'),
    severity: normalizeSeverity(value.severity),
    status: normalizeStatus(value.status),
    serviceId: stringValue(value.source_component, 'unknown-service'),
    occurredAt: stringValue(value.timestamp, new Date(0).toISOString()),
    category: normalizeTitle(value.alert_type),
    owner: stringValue(value.assigned_to, stringValue(metadata.owner, 'Unassigned')),
  };
}

function normalizeService(value: JsonRecord): Service {
  return {
    id: stringValue(value.component_id, 'unknown-component'),
    name: stringValue(value.name, 'Unnamed component'),
    kind: stringValue(value.component_type, 'service'),
    status: normalizeHealth(value.status),
    dependencies: stringList(value.dependencies),
    region: stringValue(value.location, 'Not specified'),
    team: stringValue(value.owner, 'Unassigned'),
  };
}

function normalizeDeployment(value: JsonRecord): Deployment {
  const risk = typeof value.risk_score === 'number' && Number.isFinite(value.risk_score)
    ? Math.max(0, Math.min(1, value.risk_score)) : 0;
  return {
    id: stringValue(value.deployment_id, 'unknown-deployment'),
    title: stringValue(value.deployment_id, 'Deployment assessment'),
    serviceId: stringList(value.components).join(', ') || 'Not specified',
    plannedAt: stringValue(value.timestamp, new Date(0).toISOString()),
    risk,
    environment: 'Model output',
    factors: stringList(value.risk_factors),
    recommendations: stringList(value.recommended_actions),
  };
}

async function getJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(API_BASE + path, {
    signal,
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Request to ' + path + ' failed (HTTP ' + response.status + ').');
  }
  return response.json();
}

export async function loadApiSnapshot(signal: AbortSignal): Promise<Snapshot> {
  const [alerts, components, predictions] = await Promise.all([
    getJson('/alerts/', signal),
    getJson('/infrastructure/', signal),
    getJson('/predictions/', signal),
  ]);
  const incidents = listPayload(alerts, 'alerts').map(normalizeIncident);
  const services = listPayload(components, 'infrastructure').map(normalizeService);
  const deployments = listPayload(predictions, 'predictions').map(normalizeDeployment);
  return {
    incidents, services, deployments,
    trend: hourlyTrend(incidents),
    retrievedAt: new Date().toISOString(),
    source: 'api',
  };
}

export const configuredApiBase = API_BASE;
