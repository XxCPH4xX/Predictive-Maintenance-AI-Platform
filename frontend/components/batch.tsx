"use client";
import { useState } from "react";
import { api, Prediction } from "@/lib/api";
import { ErrorNotice, MetricCard, PageHeader } from "./ui";
import { MachineTable } from "./fleet";

type BatchResult = {
  total_rows: number;
  valid_rows: number;
  high_risk_rows: number;
  invalid_rows: { row: number; errors: string[] }[];
  predictions: (Prediction & { row: number })[];
};

export default function BatchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Choose a CSV smaller than 2 MiB");
      setResult(
        await api<BatchResult>("/predict/batch", {
          method: "POST",
          headers: { "Content-Type": "text/csv" },
          body: file,
        }),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!result) return;
    const rows: (string | number)[][] = [
      [
        "row",
        "machine_id",
        "failure_probability",
        "prediction",
        "risk_level",
        "model_version",
        "errors",
      ],
      ...result.predictions.map((item) => [
        item.row,
        item.machine_id || "",
        item.failure_probability,
        item.prediction,
        item.risk_level,
        item.model_version,
        "",
      ]),
      ...result.invalid_rows.map((item) => [
        item.row,
        "",
        "",
        "",
        "",
        "",
        item.errors.join("; "),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value);
            return `"${(/^[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "batch_predictions.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeader
        eyebrow="ANALYSIS / BATCH"
        title="Analyze a batch of readings"
        description="Upload sensor snapshots, review invalid records, and download every row’s outcome."
        action={
          <a className="button" href="/api/batch/template">
            ↓ Input template
          </a>
        }
      />
      {error && <ErrorNotice message={error} />}
      <div className="two-columns">
        <section className="panel">
          <div className="panel-body">
            <div className="upload-zone">
              <div className="empty-icon">↑</div>
              <h3>Choose your machine readings</h3>
              <p className="muted">
                UTF-8 CSV · up to 500 rows · maximum 2 MiB
              </p>
              <input
                type="file"
                aria-label="CSV file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setResult(null);
                }}
              />
              <div>
                <button
                  className="button primary"
                  disabled={!file || busy}
                  onClick={upload}
                >
                  {busy ? "Validating and predicting…" : "Analyze CSV →"}
                </button>
              </div>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>A clear input contract</h2>
          </div>
          <div className="panel-body">
            <p className="muted">
              Use the template’s six sensor fields and optional machine
              identifier. Exclude target labels and identifiers from the raw
              training CSV.
            </p>
            <ul className="check-list">
              <li>Every invalid row receives an explicit error.</li>
              <li>Only valid rows are predicted and saved.</li>
              <li>Predictions use the complete saved model pipeline.</li>
              <li>The download includes rejected rows and their errors.</li>
            </ul>
          </div>
        </section>
      </div>
      {result && (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Rows uploaded"
              value={result.total_rows}
              detail="All data records"
            />
            <MetricCard
              label="Valid predictions"
              value={result.valid_rows}
              detail="Saved to prediction history"
              tone="green"
            />
            <MetricCard
              label="Invalid records"
              value={result.invalid_rows.length}
              detail="Excluded with explicit errors"
            />
            <MetricCard
              label="High or critical risk"
              value={result.high_risk_rows}
              detail="Among valid predictions"
              tone="red"
            />
          </div>
          <section className="panel">
            <div className="panel-header">
              <h2>Batch results</h2>
              <button className="button small" onClick={download}>
                ↓ Download results
              </button>
            </div>
            <MachineTable
              rows={[...result.predictions].sort(
                (a, b) => b.failure_probability - a.failure_probability,
              )}
            />
          </section>
          {!!result.invalid_rows.length && (
            <section className="panel" style={{ marginTop: 22 }}>
              <div className="panel-header">
                <h2>Records requiring correction</h2>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>CSV line</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.invalid_rows.map((row) => (
                      <tr key={row.row}>
                        <td>{row.row}</td>
                        <td style={{ whiteSpace: "normal" }}>
                          {row.errors.join("; ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
