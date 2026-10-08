"use client";
import { FormEvent, useState } from "react";
import { post, Prediction, Reading, percent } from "@/lib/api";
import { Empty, ErrorNotice, PageHeader, RiskBadge } from "./ui";

export const initialReading: Reading = {
  machine_type: "M",
  air_temperature: 298.1,
  process_temperature: 308.6,
  rotational_speed: 1551,
  torque: 42.8,
  tool_wear: 0,
};
export const sensorFields = [
  {
    key: "air_temperature",
    label: "Air temperature",
    unit: "K",
    min: 200,
    max: 450,
    step: 0.1,
  },
  {
    key: "process_temperature",
    label: "Process temperature",
    unit: "K",
    min: 200,
    max: 550,
    step: 0.1,
  },
  {
    key: "rotational_speed",
    label: "Rotational speed",
    unit: "RPM",
    min: 100,
    max: 10000,
    step: 1,
  },
  { key: "torque", label: "Torque", unit: "Nm", min: 0.1, max: 500, step: 0.1 },
  {
    key: "tool_wear",
    label: "Tool wear",
    unit: "min",
    min: 0,
    max: 10000,
    step: 1,
  },
] as const;

export function SensorFields({
  value,
  onChange,
}: {
  value: Reading;
  onChange: (reading: Reading) => void;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor="machine_type">Machine type</label>
        <select
          id="machine_type"
          value={value.machine_type}
          onChange={(e) =>
            onChange({
              ...value,
              machine_type: e.target.value as Reading["machine_type"],
            })
          }
        >
          <option value="L">L · Low quality variant</option>
          <option value="M">M · Medium quality variant</option>
          <option value="H">H · High quality variant</option>
        </select>
      </div>
      {sensorFields.map((field) => (
        <div className="field" key={field.key}>
          <label htmlFor={field.key}>
            {field.label} <span className="muted">({field.unit})</span>
          </label>
          <input
            id={field.key}
            type="number"
            required
            min={field.min}
            max={field.max}
            step={field.step}
            value={Number.isNaN(value[field.key]) ? "" : value[field.key]}
            onChange={(e) =>
              onChange({ ...value, [field.key]: e.target.valueAsNumber })
            }
          />
        </div>
      ))}
    </>
  );
}

export function PredictionResult({ result }: { result: Prediction }) {
  const contributions = result.explanation?.contributions || [];
  const maximum = Math.max(
    ...contributions.map((item) => Math.abs(item.value)),
    0.001,
  );
  return (
    <div className="section-stack">
      <section className="panel">
        <div className="panel-header">
          <h2>Prediction result</h2>
          <RiskBadge risk={result.risk_level} />
        </div>
        <div className="panel-body">
          <span className="score-label">ESTIMATED FAILURE PROBABILITY</span>
          <div className="result-score">
            {percent(result.failure_probability)}
          </div>
          <div className="progress">
            <div
              style={{
                width: percent(result.failure_probability),
                background: result.prediction ? "#c77658" : undefined,
              }}
            />
          </div>
          <p className="muted">
            {result.prediction
              ? "Above the model’s failure decision threshold."
              : "Below the model’s failure decision threshold."}
          </p>
          {result.warnings.map((warning) => (
            <p className="note warning-note" key={warning}>
              {warning}
            </p>
          ))}
          <div className="result-meta">
            Model {result.model_version}
            <br />
            {result.machine_id
              ? `Machine ${result.machine_id}`
              : "Model scenario — not saved to history"}
          </div>
        </div>
      </section>
      {result.explanation && (
        <section className="panel">
          <div className="panel-header">
            <h2>What influenced this prediction?</h2>
            <small>SHAP · log-odds</small>
          </div>
          <div className="panel-body">
            {contributions.map((item) => (
              <div className="explanation-row" key={item.feature}>
                <span>{item.feature}</span>
                <div className="bar-track">
                  <div
                    className={`bar-fill ${item.value > 0 ? "positive" : ""}`}
                    style={{
                      width: `${(Math.abs(item.value) / maximum) * 100}%`,
                    }}
                  />
                </div>
                <span className="tabular">
                  {item.value > 0 ? "+" : ""}
                  {item.value.toFixed(2)}
                </span>
              </div>
            ))}
            <p className="muted" style={{ marginTop: 20 }}>
              Orange contributions raise the model score; green contributions
              lower it. These are associations, not causes or probability
              percentage points.
            </p>
          </div>
        </section>
      )}
      {!!result.failure_types.length && (
        <section className="panel">
          <div className="panel-header">
            <h2>Failure-type signals</h2>
            <span className="chip">Experimental</span>
          </div>
          <div className="panel-body">
            {result.failure_types.map((item) => (
              <div className="legend-row" key={item.label}>
                <span>{item.label}</span>
                <span>{percent(item.probability)}</span>
              </div>
            ))}
            <p className="muted">
              {result.failure_type_note}. Multiple flags can overlap; these
              estimates do not identify a verified cause.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

export default function PredictionPage() {
  const [reading, setReading] = useState(initialReading);
  const [machineId, setMachineId] = useState("");
  const [result, setResult] = useState<Prediction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setResult(
        await post<Prediction>("/predict", {
          ...reading,
          machine_id: machineId || null,
        }),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="ANALYSIS / SINGLE MACHINE"
        title="Check a machine’s condition"
        description="Enter a sensor snapshot to estimate failure risk and understand the model’s prediction."
      />
      {error && <ErrorNotice message={error} />}
      <div className="two-columns">
        <section className="panel">
          <div className="panel-header">
            <h2>Machine readings</h2>
            <span className="chip">Sensor snapshot</span>
          </div>
          <form className="panel-body" onSubmit={submit}>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="machine_id">
                  Machine identifier <span className="muted">(optional)</span>
                </label>
                <input
                  id="machine_id"
                  value={machineId}
                  maxLength={64}
                  pattern="[A-Za-z0-9][A-Za-z0-9_.:\-]*"
                  onChange={(e) => setMachineId(e.target.value)}
                />
                <small>
                  Reuse an identifier to track its condition over time.
                </small>
              </div>
              <SensorFields value={reading} onChange={setReading} />
            </div>
            <div className="form-actions">
              <button className="button primary" disabled={busy}>
                {busy ? "Analyzing readings…" : "Run prediction →"}
              </button>
              <button
                className="button"
                type="button"
                onClick={() => setReading(initialReading)}
              >
                Reset readings
              </button>
            </div>
            <p className="muted">
              Initial values are an example sensor snapshot from the supplied
              dataset. Predictions are calculated when you submit.
            </p>
            <div className="note">
              Results are estimates from a synthetic dataset. Risk bands are
              application thresholds, not industrial operating standards.
            </div>
          </form>
        </section>
        {result ? (
          <PredictionResult result={result} />
        ) : (
          <Empty title="Your analysis will appear here">
            Submit the readings to see a measured prediction, risk status, and
            feature contributions.
          </Empty>
        )}
      </div>
    </>
  );
}
