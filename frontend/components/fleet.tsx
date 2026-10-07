"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { api, dateLabel, Fleet, percent, Prediction, Risk, riskLabel } from "@/lib/api";
import { Empty, ErrorNotice, MetricCard, PageHeader, RiskBadge } from "./ui";
import { PredictionResult, sensorFields } from "./prediction";

const riskColors: Record<Risk, string> = { healthy: "#2d8d73", warning: "#d6ad58", high_risk: "#cb8052", critical: "#be5b52" };

function useFleet() {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const refresh = () => api<Fleet>("/fleet").then(data => { if (live) { setFleet(data); setError(""); } }).catch(error => { if (live) setError(error.message); });
    refresh(); const timer = setInterval(refresh, 15000);
    return () => { live = false; clearInterval(timer); };
  }, []);
  return { fleet, error };
}

export function MachineTable({ rows }: { rows: Prediction[] }) {
  return <div className="table-scroll"><table><thead><tr><th>Machine</th><th>Condition</th><th>Failure risk</th><th>Source</th><th>Last reading</th><th /></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><Link className="machine-name" href={`/machines/${encodeURIComponent(row.machine_id || "")}`}>{row.machine_id}</Link><div className="muted">Type {row.inputs?.machine_type}</div></td><td><RiskBadge risk={row.risk_level} /></td><td className="tabular">{percent(row.failure_probability)}<div className="progress" style={{ width: 70, marginTop: 7, height: 3 }}><div style={{ width: percent(row.failure_probability), background: riskColors[row.risk_level] }} /></div></td><td><span className="chip">{row.source === "simulated" ? "Simulated telemetry" : row.source}</span></td><td className="muted">{dateLabel(row.timestamp)}</td><td><Link aria-label={`View ${row.machine_id}`} className="text-link" href={`/machines/${encodeURIComponent(row.machine_id || "")}`}>↗</Link></td></tr>)}</tbody></table></div>;
}

export function Overview() {
  const { fleet, error } = useFleet();
  const distribution = fleet ? Object.entries(fleet.risk_distribution).map(([key, value]) => ({ name: riskLabel(key as Risk), value, color: riskColors[key as Risk] })) : [];
  return <><PageHeader eyebrow="OPERATIONS / OVERVIEW" title="Equipment overview" description="A clear view of your machines, their condition, and what needs attention." action={<Link href="/prediction" className="button primary">+ &nbsp; Analyze a machine</Link>} />
    {error && <ErrorNotice message={error} />}{!fleet && !error && <p className="muted">Loading equipment…</p>}
    {fleet && <><div className="metrics-grid"><MetricCard label="Machines in workspace" value={fleet.total_machines} detail="Latest reading per machine" /><MetricCard label="Healthy machines" value={fleet.risk_distribution.healthy} detail="Below the warning threshold" tone="green" /><MetricCard label="Critical machines" value={fleet.risk_distribution.critical} detail="Review these readings first" tone="red" /><MetricCard label="Average failure risk" value={fleet.average_failure_probability === null ? "—" : percent(fleet.average_failure_probability)} detail="Across current machine readings" /></div>
      <div className="two-columns"><section className="panel"><div className="panel-header"><h2>Fleet condition</h2><small>Latest observations</small></div>{fleet.total_machines ? <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center" }}><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" innerRadius={65} outerRadius={90} paddingAngle={3} stroke="none">{distribution.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div>{distribution.map(item => <div className="legend-row" key={item.name}><span><i className="legend-dot" style={{ background: item.color }} />{item.name}</span><strong>{item.value}</strong></div>)}<div className="divider" /><p className="muted">Risk bands use documented application thresholds.</p></div></div> : <Empty title="No readings yet">Analyze a machine or start explicitly labeled simulated telemetry.</Empty>}</section><section className="panel"><div className="panel-header"><h2>Recent risk alerts</h2><span className="chip">Transitions only</span></div><div className="panel-body">{fleet.alerts.length ? fleet.alerts.slice(0, 4).map(alert => <div className="alert-row" key={alert.id}><span className={`alert-icon ${alert.risk_level}`}>!</span><div className="alert-copy"><strong>{alert.machine_id}</strong> entered {riskLabel(alert.risk_level).toLowerCase()}<small>{dateLabel(alert.timestamp)} · {alert.source === "simulated" ? "Simulated telemetry" : alert.source}</small></div><span className="tabular">{percent(alert.failure_probability)}</span></div>) : <p className="muted">No upward risk transitions recorded. Repeated readings in the same band do not create new alerts.</p>}<p className="muted" style={{ marginTop: 20 }}>Alerts flag changes in model estimates. They are not verified equipment incidents.</p></div></section></div>
      <section className="panel"><div className="panel-header"><h2>Machine health</h2><Link href="/machines" className="text-link">View all machines →</Link></div>{fleet.machines.length ? <MachineTable rows={[...fleet.machines].sort((a, b) => b.failure_probability - a.failure_probability).slice(0, 8)} /> : <Empty title="Your workspace is ready">Predictions will appear here after you submit actual sensor inputs or run the simulator.</Empty>}<div className="table-foot"><span>{fleet.total_machines} machines · sorted by estimated risk</span><span>Refreshes every 15 seconds</span></div></section></>}
  </>;
}

export function Machines() {
  const { fleet, error } = useFleet();
  const [search, setSearch] = useState(""); const [risk, setRisk] = useState("all");
  const rows = (fleet?.machines || []).filter(row => (row.machine_id || "").toLowerCase().includes(search.toLowerCase()) && (risk === "all" || row.risk_level === risk));
  return <><PageHeader eyebrow="WORKSPACE / MACHINES" title="Your machine fleet" description="Review the latest recorded readings and drill into each machine’s history." action={<Link href="/simulation" className="button">Simulate telemetry ↗</Link>} />{error && <ErrorNotice message={error} />}<div className="toolbar"><input aria-label="Search machines" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search machine identifier" /><select aria-label="Filter risk" value={risk} onChange={e => setRisk(e.target.value)}><option value="all">All risk levels</option>{Object.keys(riskColors).map(value => <option key={value} value={value}>{riskLabel(value as Risk)}</option>)}</select><span className="muted">{rows.length} machines</span></div><section className="panel">{rows.length ? <MachineTable rows={rows} /> : <Empty title={fleet ? "No machines match" : "Loading machines"}>Submit a prediction to add a machine, or adjust the filters.</Empty>}</section></>;
}

export function History() {
  const [data, setData] = useState<{ total: number; items: Prediction[] } | null>(null);
  const [offset, setOffset] = useState(0); const [error, setError] = useState("");
  useEffect(() => { api<{ total: number; items: Prediction[] }>(`/predictions?limit=20&offset=${offset}`).then(setData).catch(error => setError(error.message)); }, [offset]);
  return <><PageHeader eyebrow="WORKSPACE / HISTORY" title="Prediction history" description="Stored inputs and predictions, with their source, timestamp, and model version." />{error && <ErrorNotice message={error} />}<section className="panel">{data?.items.length ? <MachineTable rows={data.items} /> : <Empty title={data ? "No predictions recorded" : "Loading history"}>Scenario analysis does not add records to history.</Empty>}<div className="table-foot"><span>{data?.total || 0} predictions · page {offset / 20 + 1}</span><div style={{ display: "flex", gap: 8 }}><button className="button small" disabled={!offset} onClick={() => setOffset(offset - 20)}>Previous</button><button className="button small" disabled={!data || offset + 20 >= data.total} onClick={() => setOffset(offset + 20)}>Next</button></div></div></section></>;
}

export function MachineDetail({ machineId }: { machineId: string }) {
  const [prediction, setPrediction] = useState<Prediction | null>(null); const [history, setHistory] = useState<Prediction[]>([]); const [error, setError] = useState("");
  useEffect(() => { api<{ items: Prediction[] }>(`/predictions?machine_id=${encodeURIComponent(machineId)}&limit=10`).then(async data => { setHistory(data.items); if (!data.items.length) throw new Error("No readings found for this machine"); setPrediction(await api<Prediction>(`/predictions/${data.items[0].id}`)); }).catch(error => setError(error.message)); }, [machineId]);
  return <><PageHeader eyebrow="MACHINES / DETAIL" title={machineId} description="The latest stored sensor snapshot, model explanation, and recent observations." action={<Link href="/machines" className="button">← All machines</Link>} />{error && <ErrorNotice message={error} />}{prediction?.inputs && <div className="two-columns"><div className="section-stack"><section className="panel"><div className="panel-header"><h2>Sensor snapshot</h2><span className="chip">{prediction.source === "simulated" ? "Simulated telemetry" : prediction.source}</span></div><div className="panel-body"><div className="form-grid">{sensorFields.map(field => <div className="sensor-card" key={field.key}><span>{field.label}</span><strong>{prediction.inputs![field.key]} <small className="muted">{field.unit}</small></strong></div>)}<div className="sensor-card"><span>Machine type</span><strong>{prediction.inputs.machine_type}</strong></div></div><p className="muted">Recorded {dateLabel(prediction.timestamp)}</p></div></section><section className="panel"><div className="panel-header"><h2>Recent observations</h2></div><div className="table-scroll"><table><thead><tr><th>Recorded</th><th>Risk</th><th>Probability</th></tr></thead><tbody>{history.map(item => <tr key={item.id}><td>{dateLabel(item.timestamp)}</td><td><RiskBadge risk={item.risk_level} /></td><td>{percent(item.failure_probability)}</td></tr>)}</tbody></table></div></section></div><PredictionResult result={prediction} /></div>}{!prediction && !error && <p className="muted">Loading machine details…</p>}</>;
}
