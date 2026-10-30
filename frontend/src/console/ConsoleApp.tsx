import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowForwardRounded, ArrowOutwardRounded, AutoGraphRounded,
  CheckCircleOutlineRounded, CloseRounded, DashboardRounded,
  ErrorOutlineRounded, HubOutlined, InfoOutlined, MenuRounded,
  NotificationsNoneRounded, RefreshRounded, RocketLaunchOutlined,
  SearchRounded, ShieldOutlined,
} from '@mui/icons-material';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { loadApiSnapshot, configuredApiBase } from './api';
import { createDemoSnapshot } from './demo';
import {
  DataSource, Deployment, Incident, Service, Snapshot,
  activeIncident, blastRadius, filterIncidents, formatRisk,
  relativeTime, riskLevel, summarize,
} from './model';
import {
  ActivityChart, HealthBreakdown, MetricCard, SeverityBadge,
  StatusBadge, TopologyCanvas,
} from './visuals';
import './console.css';

type View = 'overview' | 'incidents' | 'topology' | 'deployments';

const navigation: { path: string; label: string; view: View; icon: React.ReactElement }[] = [
  { path: '/', label: 'Overview', view: 'overview', icon: <DashboardRounded /> },
  { path: '/incidents', label: 'Incidents', view: 'incidents', icon: <NotificationsNoneRounded /> },
  { path: '/topology', label: 'Service topology', view: 'topology', icon: <HubOutlined /> },
  { path: '/deployments', label: 'Deployments', view: 'deployments', icon: <RocketLaunchOutlined /> },
];

const headings: Record<View, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: 'SYSTEM WORKSPACE / 01', title: 'Operations overview', description: 'A clear picture of incidents, service health and deployment readiness.' },
  incidents: { eyebrow: 'INCIDENT MANAGEMENT / 02', title: 'Incident intelligence', description: 'Prioritize incoming signals and investigate affected services.' },
  topology: { eyebrow: 'DEPENDENCY ANALYSIS / 03', title: 'Service topology', description: 'Understand upstream dependencies and the potential downstream blast radius.' },
  deployments: { eyebrow: 'CHANGE INTELLIGENCE / 04', title: 'Deployment readiness', description: 'Review risk signals and mitigation guidance before a release.' },
};

function viewFromPath(pathname: string): View {
  const candidate = navigation.find(item => item.path === pathname);
  return candidate ? candidate.view : 'overview';
}

function Panel({
  title, subtitle, children, action, className = '',
}: {
  title: string; subtitle?: string; children: React.ReactNode;
  action?: React.ReactNode; className?: string;
}) {
  return (
    <section className={'panel ' + className}>
      <div className="panel-heading">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {action && <div className="panel-action">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><CheckCircleOutlineRounded /><strong>{title}</strong><span>{description}</span></div>;
}

function IncidentTable({
  incidents, services, compact, onInspect,
}: {
  incidents: Incident[]; services: Service[]; compact?: boolean;
  onInspect: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('all');
  const filtered = useMemo(
    () => filterIncidents(incidents, compact ? '' : query, compact ? 'all' : severity),
    [incidents, compact, query, severity],
  );
  const visible = compact ? filtered.slice(0, 5) : filtered;
  const byId = new Map(services.map(service => [service.id, service.name]));
  return (
    <>
      {!compact && (
        <div className="table-controls">
          <label className="search-field">
            <SearchRounded aria-hidden="true" fontSize="small" />
            <span className="sr-only">Search incidents</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search incidents, services, IDs..." />
          </label>
          <label className="filter-field">
            <span className="sr-only">Filter severity</span>
            <select value={severity} onChange={event => setSeverity(event.target.value)}>
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Informational</option>
            </select>
          </label>
          <span className="table-result-count">{filtered.length} results</span>
        </div>
      )}
      {!visible.length ? (
        <EmptyState title="No matching incidents" description="Change your filters or refresh the data source." />
      ) : (
        <div className="table-scroll">
          <table className="incident-table">
            <thead><tr><th>Incident</th><th>Service</th><th>Severity</th><th>Status</th><th>Detected</th><th><span className="sr-only">Inspect</span></th></tr></thead>
            <tbody>
              {visible.map(incident => (
                <tr key={incident.id}>
                  <td><div className="incident-cell"><b>{incident.title}</b><small>{incident.id} · {incident.category}</small></div></td>
                  <td><span className="service-cell">{byId.get(incident.serviceId) || incident.serviceId}</span></td>
                  <td><SeverityBadge severity={incident.severity} /></td>
                  <td><StatusBadge status={incident.status} /></td>
                  <td><span className="relative-time">{relativeTime(incident.occurredAt)}</span></td>
                  <td><button className="row-action" type="button" onClick={() => onInspect(incident.id)} aria-label={'Inspect ' + incident.id}><ArrowOutwardRounded fontSize="small" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {compact && (
        <button type="button" className="panel-footer-link" onClick={() => navigate('/incidents')}>
          View all incidents <ArrowForwardRounded fontSize="small" />
        </button>
      )}
    </>
  );
}

function DeploymentCard({ item, serviceName }: { item: Deployment; serviceName: string }) {
  const level = riskLevel(item.risk);
  return (
    <article className="deployment-card">
      <div className="deployment-head">
        <div className="deployment-mark"><RocketLaunchOutlined fontSize="small" /></div>
        <div className="deployment-identity"><strong>{item.title}</strong><span>{serviceName} · {item.id}</span></div>
        <span className={'risk-tag risk-' + level}>{level} risk</span>
      </div>
      <div className="risk-track" role="img" aria-label={formatRisk(item.risk) + ' experimental deployment risk score'}>
        <span className={'risk-fill risk-' + level} style={{ width: formatRisk(item.risk) }} />
      </div>
      <div className="deployment-bottom"><span>Experimental model score</span><strong>{formatRisk(item.risk)}</strong></div>
      <details className="deployment-details">
        <summary>Assessment context</summary>
        <div className="deployment-context">
          <strong>Risk factors</strong>
          {item.factors.length ? <ul>{item.factors.map((factor, i) => <li key={i}>{factor}</li>)}</ul> : <p>None provided by the source.</p>}
          <strong>Suggested checks</strong>
          {item.recommendations.length ? <ul>{item.recommendations.map((check, i) => <li key={i}>{check}</li>)}</ul> : <p>No recommendations provided.</p>}
        </div>
      </details>
    </article>
  );
}

function DeploymentList({ deployments, services, compact = false }: { deployments: Deployment[]; services: Service[]; compact?: boolean }) {
  const byId = new Map(services.map(service => [service.id, service.name]));
  const items = compact ? deployments.slice(0, 2) : deployments;
  if (!items.length) return <EmptyState title="No assessments available" description="The selected source returned no deployment assessments." />;
  return (
    <div className="deployment-list">
      {items.map(item => <DeploymentCard key={item.id} item={item} serviceName={byId.get(item.serviceId) || item.serviceId} />)}
    </div>
  );
}

function IncidentDetails({
  incident, service, source, onClose, onAcknowledge,
}: {
  incident: Incident | null; service?: Service; source: DataSource;
  onClose: () => void; onAcknowledge: (id: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (incident && !dialog.open) dialog.showModal();
    if (!incident && dialog.open) dialog.close();
  }, [incident]);
  return (
    <dialog ref={dialogRef} className="incident-dialog" onClose={onClose}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      aria-labelledby="incident-dialog-title">
      {incident && (
        <>
          <div className="dialog-header">
            <span className="eyebrow">INCIDENT DETAILS · {incident.id}</span>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close incident details"><CloseRounded /></button>
          </div>
          <h2 id="incident-dialog-title">{incident.title}</h2>
          <div className="dialog-badges"><SeverityBadge severity={incident.severity} /><StatusBadge status={incident.status} /></div>
          <p className="dialog-description">{incident.description}</p>
          <dl className="dialog-metadata">
            <div><dt>Source service</dt><dd>{service?.name || incident.serviceId}</dd></div>
            <div><dt>Owner</dt><dd>{incident.owner}</dd></div>
            <div><dt>Category</dt><dd>{incident.category}</dd></div>
            <div><dt>Detected</dt><dd>{new Date(incident.occurredAt).toLocaleString()}</dd></div>
          </dl>
          <div className="dialog-note"><InfoOutlined fontSize="small" />{source === 'demo'
            ? 'This is a simulated incident. Acknowledgement changes this browser session only.'
            : 'API mode is read-only because the backend does not yet persist incident updates.'}</div>
          <div className="dialog-actions">
            <button className="btn btn-outline" type="button" onClick={onClose}>Close</button>
            {source === 'demo' && activeIncident(incident) && incident.status !== 'acknowledged' &&
              <button className="btn btn-primary" type="button" onClick={() => onAcknowledge(incident.id)}>
                <CheckCircleOutlineRounded fontSize="small" /> Acknowledge in demo
              </button>}
          </div>
        </>
      )}
    </dialog>
  );
}

function TopologySection({
  services, selectedId, onSelect,
}: {
  services: Service[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = services.find(service => service.id === selectedId) || services[0];
  const impacted = selected ? blastRadius(services, selected.id) : [];
  const upstream = selected?.dependencies.map(id => services.find(item => item.id === id)?.name || id) || [];
  return (
    <div className="topology-layout">
      <Panel title="Dependency map" subtitle="Arrows point toward required dependencies. Select a node to inspect its context."
        className="topology-main" action={<span className="tiny-counter">{services.length} components</span>}>
        <TopologyCanvas services={services} selectedId={selected?.id || null} onSelect={onSelect} />
        <div className="topology-key"><span><i className="legend-dot health-healthy" />Healthy</span><span><i className="legend-dot health-attention" />Needs attention</span><span><i className="legend-dot health-critical" />Critical</span></div>
      </Panel>
      <Panel title="Component inspector" subtitle="Dependency-aware impact preview" className="topology-inspector">
        {selected ? (
          <>
            <div className="inspector-title"><div className="inspector-icon"><HubOutlined /></div><div><strong>{selected.name}</strong><span>{selected.id}</span></div></div>
            <StatusBadge status={selected.status} />
            <div className="inspector-meta">
              <div><span>Owning team</span><b>{selected.team}</b></div>
              <div><span>Region</span><b>{selected.region}</b></div>
              <div><span>Component type</span><b>{selected.kind}</b></div>
            </div>
            <div className="inspector-section">
              <h3>Upstream dependencies <span>{upstream.length}</span></h3>
              {upstream.length ? <ul>{upstream.map(name => <li key={name}>{name}</li>)}</ul> : <p>No registered upstream dependencies.</p>}
            </div>
            <div className="inspector-section">
              <h3>Potential blast radius <span>{impacted.length}</span></h3>
              {impacted.length ? <ul>{impacted.map(item => <li key={item.id}>{item.name}</li>)}</ul> : <p>No downstream components in this dataset.</p>}
            </div>
            <div className="inspector-disclaimer">Impact is derived from the available dependency graph, not observed outage propagation.</div>
          </>
        ) : <EmptyState title="Select a component" description="No component is available to inspect." />}
      </Panel>
    </div>
  );
}

export default function ConsoleApp() {
  const location = useLocation();
  const currentView = viewFromPath(location.pathname);
  const currentHeading = headings[currentView];
  const navigate = useNavigate();
  const [source, setSource] = useState<DataSource>('demo');
  const [snapshot, setSnapshot] = useState<Snapshot>(() => createDemoSnapshot());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>('payments');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (source === 'demo') {
      setSnapshot(createDemoSnapshot());
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    setError(null);
    loadApiSnapshot(controller.signal)
      .then(result => { if (active) setSnapshot(result); })
      .catch(cause => {
        if (active) setError(controller.signal.aborted
          ? 'The API request timed out after 12 seconds.'
          : cause instanceof Error ? cause.message : 'Unable to load the API snapshot.');
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [source, refreshKey]);

  const chooseSource = (next: DataSource) => {
    setSource(next);
    setAcknowledged(new Set());
    setSelectedIncidentId(null);
    if (next === source) setRefreshKey(value => value + 1);
  };
  const activeSnapshot: Snapshot = useMemo(() => ({
    ...snapshot,
    incidents: snapshot.incidents.map(incident =>
      source === 'demo' && acknowledged.has(incident.id) ? { ...incident, status: 'acknowledged' as const } : incident),
  }), [snapshot, source, acknowledged]);
  const stats = summarize(activeSnapshot);
  const selectedIncident = activeSnapshot.incidents.find(item => item.id === selectedIncidentId) || null;
  const selectedIncidentService = activeSnapshot.services.find(item => item.id === selectedIncident?.serviceId);
  const showApp = !loading && !error && activeSnapshot.source === source;
  const apiLabel = source === 'demo' ? 'Demo data' : 'API · fixture-backed';

  return (
    <div className={'app-shell' + (sidebarOpen ? ' nav-open' : '')}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="nav-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-emblem"><AutoGraphRounded /></div>
          <div><div className="brand-name">InfraLens<span>.</span></div><div className="brand-caption">OPERATIONS INTELLIGENCE</div></div>
        </div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-navigation">
          {navigation.map(item => (
            <NavLink key={item.path} end={item.path === '/'} to={item.path} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <span className="nav-item-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.view === 'incidents' && showApp && stats.open > 0 && <span className="nav-count">{stats.open}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <div className="sidebar-note-icon"><ShieldOutlined fontSize="small" /></div>
          <strong>Built for clarity.</strong>
          <p>Explore system relationships without confusing demo signals for production facts.</p>
          <span>PORTFOLIO PREVIEW · V1</span>
        </div>
        <div className="sidebar-footer"><span className="sidebar-footer-dot" />SYSTEM CONSOLE <span>v1.0</span></div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(value => !value)} aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={sidebarOpen}><MenuRounded /></button>
            <span className="breadcrumb-muted">Workspace</span><span className="breadcrumb-separator">/</span><strong>{navigation.find(item => item.view === currentView)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className={'source-pill source-' + source}><span className="source-light" />{apiLabel}</span>
            {showApp && <span className="topbar-time">Updated {relativeTime(activeSnapshot.retrievedAt)}</span>}
            <button className="icon-button refresh-button" type="button"
              aria-label={source === 'demo' ? 'Reset demo data' : 'Refresh API data'}
              title={source === 'demo' ? 'Reset demo data' : 'Refresh API data'}
              onClick={() => { setAcknowledged(new Set()); setRefreshKey(value => value + 1); }}>
              <RefreshRounded />
            </button>
            <div className="profile-avatar" title="Portfolio preview">AO</div>
          </div>
        </header>
        <main id="main-content" className="main-content">
          <div className="page-intro">
            <div className="page-intro-copy">
              <div className="eyebrow">{currentHeading.eyebrow}</div>
              <h1>{currentHeading.title}</h1>
              <p>{currentHeading.description}</p>
            </div>
            <div className="source-switcher" role="group" aria-label="Data source">
              <button type="button" onClick={() => chooseSource('demo')} aria-pressed={source === 'demo'} className={source === 'demo' ? 'selected' : ''}>Demo</button>
              <button type="button" onClick={() => chooseSource('api')} aria-pressed={source === 'api'} className={source === 'api' ? 'selected' : ''}>Connect API</button>
            </div>
          </div>
          <div className="data-notice" role="note">
            <InfoOutlined fontSize="small" />
            <span>{source === 'demo'
              ? 'Demo environment — simulated incidents, services and risk scores. No live infrastructure is connected.'
              : 'API environment — the current Flask backend serves fixture records and synthetic risk assessments; not verified production telemetry.'}</span>
          </div>
          {loading && <div className="content-state" role="status"><span className="loader" /><strong>Connecting to API…</strong><p>Requesting incidents, infrastructure and deployment assessments from {configuredApiBase}.</p></div>}
          {error && (
            <div className="content-state error-state" role="alert">
              <ErrorOutlineRounded /><strong>Could not load the API</strong><p>{error}</p>
              <code>{configuredApiBase}</code>
              <div className="content-state-actions">
                <button className="btn btn-primary" type="button" onClick={() => setRefreshKey(value => value + 1)}>Try again</button>
                <button className="btn btn-outline" type="button" onClick={() => chooseSource('demo')}>Return to demo</button>
              </div>
            </div>
          )}
          {showApp && (
            <Routes>
              <Route path="/" element={
                <>
                  <div className="metric-grid">
                    <MetricCard label="Open incidents" value={stats.open} detail="Unresolved signals" tone="violet" icon="layers" />
                    <MetricCard label="Critical priority" value={stats.critical} detail="Require attention" tone="red" icon="alert" />
                    <MetricCard label="Healthy services" value={stats.healthy + ' / ' + stats.totalServices} detail="Current reported health" tone="mint" icon="shield" />
                    <MetricCard label="High-risk releases" value={stats.highRiskDeployments} detail="Experimental risk ≥ 70%" tone="amber" icon="deploy" />
                  </div>
                  <div className="overview-grid">
                    <Panel title="Alert activity" subtitle={source === 'demo' ? 'Illustrative event volume · Last 12 hours' : 'Events in returned records · Last 12 hours'}
                      className="activity-panel" action={<span className="panel-tag"><span className="panel-tag-dot" />{source === 'demo' ? 'SIMULATED' : 'API RECORDS'}</span>}>
                      <ActivityChart points={activeSnapshot.trend} simulated={source === 'demo'} />
                    </Panel>
                    <Panel title="Service health" subtitle="Distribution across registered components" className="health-panel">
                      <HealthBreakdown services={activeSnapshot.services} />
                    </Panel>
                  </div>
                  <div className="overview-grid overview-lower">
                    <Panel title="Priority incident queue" subtitle="Ordered by resolution status and severity" className="incident-panel"
                      action={<span className="tiny-counter">{stats.open} open</span>}>
                      <IncidentTable compact incidents={activeSnapshot.incidents} services={activeSnapshot.services} onInspect={setSelectedIncidentId} />
                    </Panel>
                    <Panel title="Deployment watchlist" subtitle="Experimental scoring · Not calibrated" className="deployments-panel"
                      action={<button className="text-action" type="button" onClick={() => navigate('/deployments')}>View all <ArrowForwardRounded fontSize="small" /></button>}>
                      <DeploymentList compact deployments={activeSnapshot.deployments} services={activeSnapshot.services} />
                    </Panel>
                  </div>
                </>
              } />
              <Route path="/incidents" element={
                <div className="view-stack">
                  <div className="view-summary"><span><ErrorOutlineRounded /> {stats.open} unresolved incidents</span><span><ShieldOutlined /> Read-only API integration</span></div>
                  <Panel title="All incidents" subtitle="Search and filter the current source. Select a row for context.">
                    <IncidentTable incidents={activeSnapshot.incidents} services={activeSnapshot.services} onInspect={setSelectedIncidentId} />
                  </Panel>
                </div>
              } />
              <Route path="/topology" element={<TopologySection services={activeSnapshot.services} selectedId={selectedServiceId} onSelect={setSelectedServiceId} />} />
              <Route path="/deployments" element={
                <div className="view-stack">
                  <div className="view-summary"><span><RocketLaunchOutlined /> {activeSnapshot.deployments.length} assessments</span><span><InfoOutlined /> Results are illustrative or synthetic, not production-validated.</span></div>
                  <Panel title="Release risk assessments" subtitle="Review risk factors and recommended checks from the current dataset.">
                    <DeploymentList deployments={activeSnapshot.deployments} services={activeSnapshot.services} />
                  </Panel>
                </div>
              } />
              <Route path="/alerts" element={<Navigate to="/incidents" replace />} />
              <Route path="/infrastructure" element={<Navigate to="/topology" replace />} />
              <Route path="/analysis" element={<Navigate to="/topology" replace />} />
              <Route path="/predictions" element={<Navigate to="/deployments" replace />} />
              <Route path="*" element={<div className="content-state"><strong>Page not found</strong><p>Choose a workspace section from the navigation.</p><button className="btn btn-primary" onClick={() => navigate('/')}>Back to overview</button></div>} />
            </Routes>
          )}
          <div className="workspace-footer"><span>InfraLens · Infrastructure Alert Intelligence Dashboard</span><span>Prototype interface · Not a live monitoring service</span></div>
        </main>
      </div>
      <IncidentDetails incident={selectedIncident} service={selectedIncidentService} source={source} onClose={() => setSelectedIncidentId(null)}
        onAcknowledge={id => setAcknowledged(previous => new Set(previous).add(id))} />
    </div>
  );
}
