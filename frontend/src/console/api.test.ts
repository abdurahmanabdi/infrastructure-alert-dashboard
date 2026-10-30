import { loadApiSnapshot } from './api';

type FakeResponse = { ok: boolean; status: number; json: () => Promise<unknown> };

function response(data: unknown): FakeResponse {
  return { ok: true, status: 200, json: async () => data };
}

describe('Flask API normalization', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('converts Flask-shaped fixture records to the UI domain model', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response([
        { alert_id: 'alert-12', alert_type: 'cpu_high', severity: 'critical', status: 'new',
          source_component: 'server-001', timestamp: '2026-10-30T12:00:00Z', description: 'CPU high' },
      ]))
      .mockResolvedValueOnce(response([
        { component_id: 'server-001', name: 'Web Server', component_type: 'server', status: 'warning',
          dependencies: [], location: 'us-east-1', owner: 'platform' },
      ]))
      .mockResolvedValueOnce(response([
        { deployment_id: 'deploy-1', components: ['server-001'], risk_score: 0.76,
          risk_factors: ['recent alerts'], recommended_actions: ['review rollback'],
          timestamp: '2026-10-30T13:00:00Z' },
      ]));
    global.fetch = fetchMock as typeof fetch;

    const data = await loadApiSnapshot(new AbortController().signal);
    expect(data.source).toBe('api');
    expect(data.incidents[0]).toMatchObject({
      id: 'alert-12', title: 'Cpu High', severity: 'critical',
      status: 'open', serviceId: 'server-001',
    });
    expect(data.services[0]).toMatchObject({ id: 'server-001', name: 'Web Server', status: 'warning' });
    expect(data.deployments[0].risk).toBe(0.76);
    expect(data.trend).toHaveLength(12);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('does not silently switch to simulated data when the API fails', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('Network unavailable'));
    global.fetch = fetchMock as typeof fetch;

    await expect(loadApiSnapshot(new AbortController().signal))
      .rejects.toThrow('Network unavailable');
  });

  test('rejects malformed record sets rather than displaying invented incidents', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(response({ broken: 'not a list' }))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([])) as typeof fetch;

    await expect(loadApiSnapshot(new AbortController().signal))
      .rejects.toThrow(/Invalid alerts response/);
  });
});
