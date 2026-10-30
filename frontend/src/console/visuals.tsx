import {
  AccountTreeOutlined, CheckCircleOutlineRounded, ErrorOutlineRounded,
  HubOutlined, LayersOutlined, RocketLaunchOutlined,
} from '@mui/icons-material';
import {
  GraphPosition, Service, Severity, TrendPoint, graphPositions,
} from './model';

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={'badge severity-' + severity}><span className="badge-dot" />{severity}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={'badge status-' + status.replace(/[^a-z_-]/g, '')}>{status.replace(/_/g, ' ')}</span>;
}

export function MetricCard({
  label, value, detail, tone, icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: 'mint' | 'red' | 'amber' | 'violet';
  icon: 'alert' | 'shield' | 'layers' | 'deploy';
}) {
  const icons = {
    alert: <ErrorOutlineRounded fontSize="small" />,
    shield: <CheckCircleOutlineRounded fontSize="small" />,
    layers: <LayersOutlined fontSize="small" />,
    deploy: <RocketLaunchOutlined fontSize="small" />,
  };
  return (
    <article className={'metric-card metric-' + tone}>
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        <span className="metric-icon" aria-hidden="true">{icons[icon]}</span>
      </div>
      <div className="metric-number">{value}</div>
      <div className="metric-detail">{detail}</div>
    </article>
  );
}

export function ActivityChart({ points, simulated }: { points: TrendPoint[]; simulated: boolean }) {
  const width = 650;
  const height = 212;
  const top = 12;
  const bottom = 178;
  const left = 8;
  const right = 642;
  const counts = points.map(item => item.count);
  const max = Math.max(1, ...counts);
  const coords = points.map((point, i) => ({
    x: left + (i / Math.max(1, points.length - 1)) * (right - left),
    y: bottom - (point.count / max) * (bottom - top),
  }));
  const strokePath = coords.map((point, index) =>
    (index === 0 ? 'M' : 'L') + point.x.toFixed(1) + ',' + point.y.toFixed(1)).join(' ');
  const fillPath = coords.length
    ? strokePath + ' L ' + coords[coords.length - 1].x + ',' + bottom
      + ' L ' + coords[0].x + ',' + bottom + ' Z'
    : '';
  const chartLabel = simulated
    ? 'Illustrative alert event volume over twelve hours'
    : 'Events returned by the configured API, grouped by hour';
  return (
    <div className="chart-container">
      <svg viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label={chartLabel} preserveAspectRatio="none">
        <defs>
          <linearGradient id="activity-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#55d7be" stopOpacity=".32" />
            <stop offset="100%" stopColor="#55d7be" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map(index => {
          const y = top + ((bottom - top) / 3) * index;
          return <line key={index} x1="0" y1={y} x2={width} y2={y} stroke="#2a3c4d" strokeDasharray="3 8" />;
        })}
        {fillPath && <path d={fillPath} fill="url(#activity-fill)" />}
        {strokePath && <path d={strokePath} fill="none" stroke="#55d7be" strokeWidth="3.25" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        {coords.map((point, i) => (
          <circle key={i} cx={point.x} cy={point.y} r={i === coords.length - 1 ? 6 : 3} fill="#55d7be" stroke="#101c2a" strokeWidth="2">
            <title>{points[i].label + ': ' + points[i].count + ' events'}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-labels" aria-hidden="true">
        {points.filter((_, i) => i === 0 || i === Math.floor(points.length / 3) || i === Math.floor(points.length * 2 / 3) || i === points.length - 1)
          .map((point, i) => <span key={i}>{point.label}</span>)}
      </div>
    </div>
  );
}

export function HealthBreakdown({ services }: { services: Service[] }) {
  const total = services.length;
  const healthy = services.filter(item => item.status === 'healthy').length;
  const attention = services.filter(item => item.status === 'warning' || item.status === 'degraded').length;
  const critical = services.filter(item => item.status === 'critical').length;
  const unknown = Math.max(0, total - healthy - attention - critical);
  const segments = [
    { key: 'healthy', value: healthy, className: 'health-healthy' },
    { key: 'attention', value: attention, className: 'health-attention' },
    { key: 'critical', value: critical, className: 'health-critical' },
    { key: 'unknown', value: unknown, className: 'health-unknown' },
  ];
  return (
    <>
      <div className="health-headline">
        <strong>{total ? Math.round((healthy / total) * 100) + '%' : '—'}</strong>
        <span>Services healthy</span>
      </div>
      <div className="health-track" role="img" aria-label={healthy + ' healthy, ' + attention + ' needing attention, ' + critical + ' critical, ' + unknown + ' other services'}>
        {segments.filter(item => item.value > 0).map(item =>
          <span key={item.key} className={item.className} style={{ width: (item.value / total) * 100 + '%' }} />)}
      </div>
      <div className="health-legend">
        <div><i className="legend-dot health-healthy" /><span>Healthy</span><b>{healthy}</b></div>
        <div><i className="legend-dot health-attention" /><span>Attention</span><b>{attention}</b></div>
        <div><i className="legend-dot health-critical" /><span>Critical</span><b>{critical}</b></div>
        <div><i className="legend-dot health-unknown" /><span>Other</span><b>{unknown}</b></div>
      </div>
    </>
  );
}

export function TopologyCanvas({
  services, selectedId, onSelect,
}: {
  services: Service[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const positions = graphPositions(services);
  const positionMap = new Map<string, GraphPosition>(positions.map(point => [point.id, point]));
  const connections = services.flatMap(service =>
    service.dependencies.map(dependency => ({ source: service.id, target: dependency }))
      .filter(connection => positionMap.has(connection.target)));
  if (!services.length) {
    return <div className="empty-state"><HubOutlined /><strong>No topology data</strong><span>No infrastructure components were returned.</span></div>;
  }
  return (
    <div className="topology-scroll" aria-label="Infrastructure service map">
      <div className="topology-canvas" role="group" aria-label="Select a component to inspect its dependencies and impact">
        <div className="topology-grid" aria-hidden="true" />
        <svg className="topology-lines" viewBox="0 0 900 370" aria-hidden="true">
          <defs>
            <marker id="topology-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 Z" fill="#40566d" />
            </marker>
          </defs>
          {connections.map(connection => {
            const from = positionMap.get(connection.source)!;
            const to = positionMap.get(connection.target)!;
            const highlighted = selectedId === connection.source || selectedId === connection.target;
            return <line key={connection.source + ':' + connection.target} x1={from.x - 45} y1={from.y} x2={to.x + 45} y2={to.y}
              stroke={highlighted ? '#55d7be' : '#35485b'} strokeWidth={highlighted ? 2.5 : 1.5} opacity={highlighted ? 1 : .65} markerEnd="url(#topology-arrow)" />;
          })}
        </svg>
        {services.map(service => {
          const point = positionMap.get(service.id)!;
          return (
            <button key={service.id} type="button"
              className={'topology-node node-' + service.status + (selectedId === service.id ? ' is-selected' : '')}
              style={{ left: (point.x / 900) * 100 + '%', top: (point.y / 370) * 100 + '%' }}
              onClick={() => onSelect(service.id)} aria-pressed={selectedId === service.id}
              aria-label={service.name + ', ' + service.status + ', inspect component'}>
              <span className="node-symbol" aria-hidden="true">
                {service.kind === 'database' ? <LayersOutlined fontSize="small" /> : service.kind === 'network' ? <HubOutlined fontSize="small" /> : <AccountTreeOutlined fontSize="small" />}
              </span>
              <span className="node-copy"><b>{service.name}</b><small>{service.kind.replace(/_/g, ' ')}</small></span>
              <i className={'node-indicator indicator-' + service.status} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
