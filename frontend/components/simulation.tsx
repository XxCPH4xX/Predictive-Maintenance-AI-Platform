"use client";
import { useEffect, useRef, useState } from "react";
import { post, Prediction, Reading } from "@/lib/api";
import { Empty, ErrorNotice, PageHeader } from "./ui";
import { MachineTable } from "./fleet";

export default function SimulationPage() {
  const [running, setRunning] = useState(false); const [count, setCount] = useState(5); const [results, setResults] = useState<Prediction[]>([]);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const inFlight = useRef(false);
  async function tick() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try { const generated = await post<{ readings: (Reading & { machine_id: string; source: string })[] }>("/simulation/readings", { machines: count }); const predictions = await Promise.all(generated.readings.map(reading => post<Prediction>("/predict", reading))); setResults(predictions); setError(""); }
    catch (error) { setError((error as Error).message); setRunning(false); }
    finally { inFlight.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!running) return;
    tick(); const timer = setInterval(tick, 5000); return () => clearInterval(timer);
    // Each run retains its selected machine count until stopped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, count]);
  return <><PageHeader eyebrow="WORKSPACE / SIMULATOR" title="Simulated machine telemetry" description="Generate changing sensor readings and send them through the real prediction endpoint." /><div className="note warning-note" style={{ marginBottom: 24 }}>These readings are simulated, not real IoT measurements. Every result is produced by the saved model and stored with its simulated source. Simulation stops when you leave this page.</div>{error && <ErrorNotice message={error} />}<section className="panel"><div className="panel-header"><h2>Telemetry controls</h2><span className="chip">{running ? "Running · every 5 seconds" : "Stopped"}</span></div><div className="panel-body"><div className="toolbar"><label htmlFor="simulation-count" className="muted">Machines</label><select id="simulation-count" disabled={running || busy} value={count} onChange={e => setCount(Number(e.target.value))}>{[3, 5, 10, 20].map(value => <option key={value}>{value}</option>)}</select><button className="button primary" onClick={() => setRunning(!running)}>{running ? "Stop simulation" : "Start simulation"}</button><button className="button" disabled={busy || running} onClick={tick}>{busy ? "Submitting readings…" : "Run one interval"}</button></div><p className="muted">Temperature, torque, speed, and wear change together. Risk alerts are created only when a machine enters a higher risk band.</p></div></section><section className="panel" style={{ marginTop: 24 }}><div className="panel-header"><h2>Latest simulated predictions</h2><small>SIM identifiers distinguish simulated machines</small></div>{results.length ? <MachineTable rows={results} /> : <Empty title="Simulation is ready">Start a run or submit one interval. No readings are generated automatically.</Empty>}</section></>;
}
