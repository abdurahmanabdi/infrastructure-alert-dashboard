/**
 * UI-facing domain model. Keep backend transport objects at the API boundary.
 * These types are intentionally independent of the legacy Redux store.
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IncidentStatus = 'open' | 'acknowledged' | 'investigating' | 'resolved';
export type ServiceStatus = 'healthy' | 'degraded' | 'warning' | 'critical' | 'unknown' | 'maintenance';
export type DataSource = 'demo' | 'api';

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  serviceId: string;
  occurredAt: string;
  category: string;
  owner: string;
}

export interface Service {
  id: string;
  name: string;
  kind: string;
  status: ServiceStatus;
  dependencies: string[];
  region: string;
  team: string;
}

export interface Deployment {
  id: string;
  title: string;
  serviceId: string;
  plannedAt: string;
  risk: number;
  environment: string;
  factors: string[];
  recommendations: string[];
}

export interface TrendPoint {
  label: string;
  count: number;
}

export interface Snapshot {
  incidents: Incident[];
  services: Service[];
  deployments: Deployment[];
  trend: TrendPoint[];
  retrievedAt: string;
  source: DataSource;
}

export const severityRank: Record<Severity, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

export function activeIncident(incident: Incident): boolean {
  return incident.status !== 'resolved';
}

export function summarize(snapshot: Snapshot) {
  const open = snapshot.incidents.filter(activeIncident);
  return {
    open: open.length,
    critical: open.filter(item => item.severity === 'critical').length,
    affected: new Set(open.map(item => item.serviceId)).size,
    healthy: snapshot.services.filter(item => item.status === 'healthy').length,
    totalServices: snapshot.services.length,
    highRiskDeployments: snapshot.deployments.filter(item => item.risk >= 0.7).length,
  };
}

/**
 * Dependencies are directed: component -> what it requires.
 * When a dependency fails we traverse its dependents, not its dependencies.
 */
export function blastRadius(services: Service[], sourceId: string): Service[] {
  const dependents = new Map<string, string[]>();
  services.forEach(service => {
    service.dependencies.forEach(dependency => {
      if (!dependents.has(dependency)) dependents.set(dependency, []);
      dependents.get(dependency)!.push(service.id);
    });
  });
  const visited = new Set<string>([sourceId]);
  const queue = [sourceId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const downstream of dependents.get(current) || []) {
      if (!visited.has(downstream)) {
        visited.add(downstream);
        queue.push(downstream);
      }
    }
  }
  return services.filter(service => visited.has(service.id) && service.id !== sourceId);
}

export function filterIncidents(incidents: Incident[], query: string, severity: string): Incident[] {
  const search = query.trim().toLowerCase();
  return incidents
    .filter(item => severity === 'all' || item.severity === severity)
    .filter(item => !search || [item.title, item.description, item.id, item.serviceId, item.owner]
      .some(value => value.toLowerCase().includes(search)))
    .sort((a, b) => {
      if (activeIncident(a) !== activeIncident(b)) return activeIncident(a) ? -1 : 1;
      return severityRank[a.severity] - severityRank[b.severity]
        || Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
    });
}

export function hourlyTrend(incidents: Incident[], now: number = Date.now()): TrendPoint[] {
  const hour = 60 * 60 * 1000;
  const current = Math.floor(now / hour) * hour;
  return Array.from({ length: 12 }, (_, index) => {
    const start = current - (11 - index) * hour;
    return {
      label: new Date(start).toLocaleTimeString([], { hour: '2-digit', hour12: false }),
      count: incidents.filter(item => {
        const time = Date.parse(item.occurredAt);
        return time >= start && time < start + hour;
      }).length,
    };
  });
}

export function relativeTime(value: string, now: number = Date.now()): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 'Unknown time';
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  return Math.floor(hours / 24) + 'd ago';
}

export function formatRisk(risk: number): string {
  return Math.round(Math.max(0, Math.min(1, risk)) * 100) + '%';
}

export function riskLevel(score: number): 'high' | 'moderate' | 'low' {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'moderate';
  return 'low';
}

export interface GraphPosition { id: string; x: number; y: number; }

/** Deterministic layered layout; works without a canvas, zoom or layout worker. */
export function graphPositions(services: Service[]): GraphPosition[] {
  const byId = new Map(services.map(service => [service.id, service]));
  const depthCache = new Map<string, number>();
  function depth(id: string, visiting = new Set<string>()): number {
    if (depthCache.has(id)) return depthCache.get(id)!;
    if (visiting.has(id)) return 0; // Ignore cycles rather than recurse forever.
    const service = byId.get(id);
    if (!service) return 0;
    const next = new Set(visiting);
    next.add(id);
    const score = service.dependencies.length
      ? Math.max(...service.dependencies.map(dep => depth(dep, next))) + 1
      : 0;
    const normalized = Math.min(score, 4);
    depthCache.set(id, normalized);
    return normalized;
  }
  const columns = new Map<number, Service[]>();
  services.forEach(service => {
    const col = depth(service.id);
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(service);
  });
  const maxColumn = Math.max(1, ...Array.from(columns.keys()));
  return services.map(service => {
    const col = depth(service.id);
    const group = columns.get(col)!;
    const row = group.findIndex(item => item.id === service.id);
    return {
      id: service.id,
      x: 105 + (col / maxColumn) * 690,
      y: 52 + ((row + 1) / (group.length + 1)) * 260,
    };
  });
}
