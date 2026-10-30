import { createDemoSnapshot } from './demo';
import { blastRadius, filterIncidents, graphPositions, hourlyTrend, riskLevel, summarize } from './model';

describe('operations domain', () => {
  const demo = createDemoSnapshot(Date.parse('2026-10-30T12:00:00Z'));

  test('calculates statistics from unresolved records rather than hard-coded UI numbers', () => {
    const stats = summarize(demo);
    expect(stats.open).toBe(5);
    expect(stats.critical).toBe(1);
    expect(stats.totalServices).toBe(10);
    expect(stats.healthy).toBe(7);
    expect(stats.highRiskDeployments).toBe(1);
  });

  test('blast radius follows dependents and never reports unrelated upstream services', () => {
    const affected = blastRadius(demo.services, 'kafka').map(service => service.id);
    expect(affected).toContain('payments');
    expect(affected).toContain('gateway');
    expect(affected).toContain('web');
    expect(affected).toContain('notifications');
    expect(affected).not.toContain('ledger');
  });

  test('dependency graph positions are finite even if a cycle is introduced', () => {
    const cyclic = [
      { ...demo.services[0], dependencies: ['redis'] },
      { ...demo.services[1], dependencies: ['db-core'] },
    ];
    const points = graphPositions(cyclic);
    expect(points).toHaveLength(2);
    expect(points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });

  test('filters by severity and searches incident context', () => {
    const match = filterIncidents(demo.incidents, 'Payment', 'critical');
    expect(match).toHaveLength(1);
    expect(match[0].id).toBe('INC-2048');
  });

  test('groups API events into hourly buckets and handles missing history', () => {
    const points = hourlyTrend([], Date.parse('2026-10-30T12:00:00Z'));
    expect(points).toHaveLength(12);
    expect(points.every(point => point.count === 0)).toBe(true);
  });

  test('bounds risk categories', () => {
    expect(riskLevel(0.8)).toBe('high');
    expect(riskLevel(0.45)).toBe('moderate');
    expect(riskLevel(0.2)).toBe('low');
  });
});
