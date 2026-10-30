import { Deployment, Incident, Service, Snapshot, TrendPoint } from './model';

const hoursAgo = (hours: number, now: number): string =>
  new Date(now - hours * 60 * 60 * 1000).toISOString();

export function createDemoSnapshot(now: number = Date.now()): Snapshot {
  const services: Service[] = [
    { id: 'db-core', name: 'Primary Database', kind: 'database', status: 'healthy', dependencies: [], region: 'us-east-1', team: 'Data Platform' },
    { id: 'redis', name: 'Redis Cache', kind: 'cache', status: 'healthy', dependencies: [], region: 'us-east-1', team: 'Platform' },
    { id: 'kafka', name: 'Event Stream', kind: 'queue', status: 'warning', dependencies: [], region: 'us-east-1', team: 'Messaging' },
    { id: 'ledger', name: 'Ledger Store', kind: 'database', status: 'healthy', dependencies: [], region: 'us-east-1', team: 'Core Banking' },
    { id: 'auth', name: 'Auth Service', kind: 'service', status: 'healthy', dependencies: ['redis', 'db-core'], region: 'us-east-1', team: 'Identity' },
    { id: 'payments', name: 'Payments API', kind: 'application', status: 'degraded', dependencies: ['ledger', 'kafka', 'auth'], region: 'us-east-1', team: 'Payments' },
    { id: 'accounts', name: 'Accounts API', kind: 'application', status: 'healthy', dependencies: ['db-core', 'auth'], region: 'us-east-1', team: 'Accounts' },
    { id: 'notifications', name: 'Notification Worker', kind: 'service', status: 'warning', dependencies: ['kafka'], region: 'us-east-1', team: 'Messaging' },
    { id: 'gateway', name: 'API Gateway', kind: 'network', status: 'healthy', dependencies: ['payments', 'accounts', 'auth'], region: 'us-east-1', team: 'Platform' },
    { id: 'web', name: 'Client Portal', kind: 'application', status: 'healthy', dependencies: ['gateway'], region: 'global-edge', team: 'Experience' },
  ];

  const incidents: Incident[] = [
    { id: 'INC-2048', title: 'Payment requests timing out', description: 'Elevated upstream request latency on the payment processing path. Retries are approaching the configured threshold.', severity: 'critical', status: 'investigating', serviceId: 'payments', occurredAt: hoursAgo(0.25, now), category: 'Latency', owner: 'Payments SRE' },
    { id: 'INC-2047', title: 'Consumer lag above threshold', description: 'Event processing has fallen behind the incoming message volume on the primary consumer group.', severity: 'high', status: 'open', serviceId: 'kafka', occurredAt: hoursAgo(0.8, now), category: 'Streaming', owner: 'Messaging' },
    { id: 'INC-2046', title: 'Notification delivery delayed', description: 'A subset of asynchronous notifications is queued longer than the target processing window.', severity: 'medium', status: 'acknowledged', serviceId: 'notifications', occurredAt: hoursAgo(1.5, now), category: 'Queue', owner: 'Messaging' },
    { id: 'INC-2045', title: 'Elevated payment error rate', description: 'Intermittent 5xx responses reported from the payments endpoint in one deployment pool.', severity: 'high', status: 'investigating', serviceId: 'payments', occurredAt: hoursAgo(2.2, now), category: 'Availability', owner: 'Payments SRE' },
    { id: 'INC-2044', title: 'TLS renewal window approaching', description: 'A certificate renewal is scheduled for the next maintenance window.', severity: 'low', status: 'open', serviceId: 'gateway', occurredAt: hoursAgo(4.4, now), category: 'Maintenance', owner: 'Platform' },
    { id: 'INC-2043', title: 'Cache latency intermittently high', description: 'Cache hit latency exceeded an internal threshold during a brief burst.', severity: 'medium', status: 'resolved', serviceId: 'redis', occurredAt: hoursAgo(5.4, now), category: 'Performance', owner: 'Platform' },
    { id: 'INC-2042', title: 'Database replica briefly lagging', description: 'A read replica experienced replication delay before returning to normal.', severity: 'medium', status: 'resolved', serviceId: 'db-core', occurredAt: hoursAgo(7.1, now), category: 'Database', owner: 'Data Platform' },
    { id: 'INC-2041', title: 'Auth token refresh retries', description: 'An increase in retry attempts was observed after a configuration deployment.', severity: 'low', status: 'resolved', serviceId: 'auth', occurredAt: hoursAgo(9.5, now), category: 'Authentication', owner: 'Identity' },
  ];

  const deployments: Deployment[] = [
    { id: 'DEP-402', title: 'Payments v2.8.1', serviceId: 'payments', plannedAt: hoursAgo(-2, now), risk: 0.82, environment: 'Staging candidate', factors: ['Recent payment service incidents', 'Streaming dependency under warning'], recommendations: ['Verify rollback plan', 'Recheck after active incidents resolve'] },
    { id: 'DEP-401', title: 'Gateway routing update', serviceId: 'gateway', plannedAt: hoursAgo(-5, now), risk: 0.47, environment: 'Planned', factors: ['Several downstream dependencies'], recommendations: ['Run integration tests against the payment path'] },
    { id: 'DEP-400', title: 'Accounts cache refresh', serviceId: 'accounts', plannedAt: hoursAgo(-8, now), risk: 0.23, environment: 'Planned', factors: ['Limited direct dependency changes'], recommendations: ['Monitor cache hit ratio during rollout'] },
  ];

  // This volume series is *illustrative*, not measured from the incidents above.
  const samples = [6, 10, 8, 15, 12, 17, 13, 20, 16, 11, 15, 9];
  const trend: TrendPoint[] = samples.map((count, i) => ({
    label: new Date(now - (11 - i) * 3600000).toLocaleTimeString([], { hour: '2-digit', hour12: false }),
    count,
  }));
  return {
    incidents, services, deployments, trend,
    source: 'demo',
    retrievedAt: new Date(now).toISOString(),
  };
}
