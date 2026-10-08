"use client";
import { useEffect, useState } from "react";
import { percent, post, Prediction } from "@/lib/api";
import { ErrorNotice, MetricCard, PageHeader, RiskBadge } from "./ui";
import { initialReading, PredictionResult, SensorFields } from "./prediction";

const ranges = [
  {
    key: "air_temperature",
    label: "Air temperature",
    unit: "K",
    min: 295,
    max: 305,
    step: 0.1,
  },
  {
    key: "process_temperature",
    label: "Process temperature",
    unit: "K",
    min: 305,
    max: 314,
    step: 0.1,
  },
  {
    key: "rotational_speed",
    label: "Rotational speed",
    unit: "RPM",
    min: 1100,
    max: 3000,
    step: 1,
  },
  { key: "torque", label: "Torque", unit: "Nm", min: 3, max: 80, step: 0.1 },
  {
    key: "tool_wear",
    label: "Tool wear",
    unit: "min",
    min: 0,
    max: 260,
    step: 1,
  },
] as const;

export default function ScenarioPage() {
  const [baselineReading, setBaselineReading] = useState(initialReading);
  const [scenario, setScenario] = useState(initialReading);
  const [baseline, setBaseline] = useState<Prediction | null>(null);
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!baseline) return;
    let active = true;
    const timer = setTimeout(() => {
      setBusy(true);
      post<Prediction>("/predict", { ...scenario, source: "scenario" })
        .then((value) => {
          if (active) {
            setResult(value);
            setError("");
          }
        })
        .catch((error) => {
          if (active) setError(error.message);
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [scenario, baseline]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const prediction = await post<Prediction>("/predict", {
        ...baselineReading,
        source: "scenario",
      });
      setBaseline(prediction);
      setResult(prediction);
      setScenario(baselineReading);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="ANALYSIS / WHAT-IF"
        title="Explore a model scenario"
        description="Compare a sensor snapshot with adjusted readings and see how the model’s estimate changes."
      />
      <div className="note" style={{ marginBottom: 24 }}>
        Model scenario analysis: changing an input does not prove that a
        maintenance intervention would cause the predicted change. Scenarios are
        not saved to fleet history.
      </div>
      {error && <ErrorNotice message={error} />}
      {!baseline ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Define a baseline snapshot</h2>
          </div>
          <form
            className="panel-body"
            onSubmit={(event) => {
              event.preventDefault();
              start();
            }}
          >
            <div className="form-grid">
              <SensorFields
                value={baselineReading}
                onChange={setBaselineReading}
              />
            </div>
            <div className="form-actions">
              <button className="button primary" disabled={busy}>
                {busy ? "Calculating baseline…" : "Start scenario analysis →"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Baseline probability"
              value={percent(baseline.failure_probability)}
              detail="Original sensor snapshot"
            />
            <MetricCard
              label="Scenario probability"
              value={result ? percent(result.failure_probability) : "—"}
              detail={
                busy ? "Recalculating…" : "Calculated by the saved pipeline"
              }
            />
            <MetricCard
              label="Change"
              value={
                result
                  ? `${((result.failure_probability - baseline.failure_probability) * 100).toFixed(1)} pp`
                  : "—"
              }
              detail="Percentage points, not causal effect"
            />
            <div className="metric-card">
              <span>Scenario condition</span>
              <div style={{ margin: "20px 0" }}>
                {result && <RiskBadge risk={result.risk_level} />}
              </div>
              <small>
                {busy ? "Updating estimate" : "Application risk band"}
              </small>
            </div>
          </div>
          <div className="two-columns">
            <section className="panel">
              <div className="panel-header">
                <h2>Adjust scenario readings</h2>
                <button
                  className="button small"
                  onClick={() => {
                    setBaseline(null);
                    setResult(null);
                  }}
                >
                  New baseline
                </button>
              </div>
              <div className="panel-body">
                {ranges.map((field) => (
                  <div
                    className="field"
                    key={field.key}
                    style={{ marginBottom: 24 }}
                  >
                    <label
                      htmlFor={`scenario-${field.key}`}
                      className="split-heading"
                    >
                      <span>{field.label}</span>
                      <strong>
                        {scenario[field.key]} {field.unit}
                      </strong>
                    </label>
                    <input
                      id={`scenario-${field.key}`}
                      type="range"
                      min={Math.min(field.min, baselineReading[field.key])}
                      max={Math.max(field.max, baselineReading[field.key])}
                      step={field.step}
                      value={scenario[field.key]}
                      onChange={(event) =>
                        setScenario({
                          ...scenario,
                          [field.key]: Number(event.target.value),
                        })
                      }
                    />
                    <small>
                      Baseline: {baselineReading[field.key]} {field.unit}
                    </small>
                  </div>
                ))}
                <button
                  className="button"
                  onClick={() => setScenario({ ...baselineReading })}
                >
                  Reset to baseline
                </button>
              </div>
            </section>
            {result && <PredictionResult result={result} />}
          </div>
        </>
      )}
    </>
  );
}
