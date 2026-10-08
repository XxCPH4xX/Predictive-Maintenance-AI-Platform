"use client";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, MetricSet, ModelInfo, percent } from "@/lib/api";
import { ErrorNotice, MetricCard, PageHeader } from "./ui";

type Performance = {
  comparison: (MetricSet & { model: string })[];
  final: {
    model_version: string;
    metrics: MetricSet;
    curves: {
      precision: number[];
      recall: number[];
      fpr: number[];
      tpr: number[];
    };
  };
  importance: {
    units: string;
    feature_importance: { feature: string; mean_absolute_shap: number }[];
  };
  cross_validation: (MetricSet & { protocol: string; fold: number })[];
  failure_types: {
    results: (MetricSet & { partition: string; label: string })[];
  };
  calibration: {
    selected: string;
    uncalibrated: MetricSet;
    sigmoid: MetricSet;
  };
};

export default function PerformancePage() {
  const [data, setData] = useState<Performance | null>(null);
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      api<Performance>("/model/performance"),
      api<ModelInfo>("/model/info"),
    ])
      .then(([metrics, model]) => {
        setData(metrics);
        setInfo(model);
      })
      .catch((error) => setError(error.message));
  }, []);
  const curves = data?.final.curves;
  const precisionRecall =
    curves?.recall
      .map((recall, index) => ({ x: recall, y: curves.precision[index] }))
      .sort((a, b) => a.x - b.x) || [];
  const roc =
    curves?.fpr.map((fpr, index) => ({ x: fpr, y: curves.tpr[index] })) || [];
  return (
    <>
      <PageHeader
        eyebrow="MODEL / PERFORMANCE"
        title="Evidence behind the predictions"
        description="Measured evaluation from the training notebooks, served directly from saved reports."
        action={info && <span className="chip">{info.model_version}</span>}
      />
      {error && <ErrorNotice message={error} />}
      {!data && !error && <p className="muted">Loading evaluation…</p>}
      {data && info && (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Test recall"
              value={percent(data.final.metrics.recall)}
              detail={`${data.final.metrics.false_negatives} missed failures out of ${data.final.metrics.positive_support}`}
            />
            <MetricCard
              label="Test precision"
              value={percent(data.final.metrics.precision)}
              detail="True failures among positive predictions"
            />
            <MetricCard
              label="Test PR-AUC"
              value={data.final.metrics.pr_auc.toFixed(3)}
              detail="Average precision on the held-out test set"
            />
            <MetricCard
              label="Test ROC-AUC"
              value={data.final.metrics.roc_auc.toFixed(3)}
              detail={`${data.final.metrics.support.toLocaleString()} test observations`}
            />
          </div>
          <div className="note" style={{ marginBottom: 24 }}>
            Selected model: {info.selected_model.replaceAll("_", " ")} ·
            decision threshold {percent(info.decision_threshold)} · test F1{" "}
            {data.final.metrics.f1.toFixed(3)}. The 90% validation recall
            objective is not guaranteed on unseen observations. Full-dataset EDA
            preceded splitting.
          </div>
          <div className="two-columns">
            {[
              {
                title: "Precision–recall curve",
                values: precisionRecall,
                x: "Recall",
                y: "Precision",
              },
              {
                title: "ROC curve",
                values: roc,
                x: "False-positive rate",
                y: "True-positive rate",
              },
            ].map((chart) => (
              <section className="panel" key={chart.title}>
                <div className="panel-header">
                  <h2>{chart.title}</h2>
                  <small>Final test set</small>
                </div>
                <div className="panel-body">
                  <div className="chart-area">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chart.values}
                        margin={{ top: 10, right: 15, bottom: 15, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e9eef0" />
                        <XAxis
                          type="number"
                          dataKey="x"
                          domain={[0, 1]}
                          tick={{ fontSize: 10 }}
                          label={{
                            value: chart.x,
                            position: "insideBottom",
                            offset: -10,
                            fontSize: 10,
                          }}
                        />
                        <YAxis
                          domain={[0, 1]}
                          tick={{ fontSize: 10 }}
                          width={32}
                        />
                        <Tooltip />
                        <Line
                          isAnimationActive={false}
                          type="stepAfter"
                          dataKey="y"
                          name={chart.y}
                          stroke="#228273"
                          dot={false}
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>
            ))}
          </div>
          <div className="two-columns">
            <section className="panel">
              <div className="panel-header">
                <h2>Confusion matrix</h2>
                <small>Actual rows · predicted columns</small>
              </div>
              <div className="panel-body">
                <table>
                  <thead>
                    <tr>
                      <th />
                      <th>Predicted normal</th>
                      <th>Predicted failure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.final.metrics.confusion_matrix.map((row, index) => (
                      <tr key={index}>
                        <td>{index ? "Actual failure" : "Actual normal"}</td>
                        {row.map((value, column) => (
                          <td
                            key={column}
                            style={{
                              background:
                                index === column ? "#eaf5ef" : "#fff3e9",
                              fontSize: 24,
                            }}
                          >
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="muted">
                  Threshold selected on validation to prioritize recall. Review
                  false positives as well as missed failures.
                </p>
              </div>
            </section>
            <section className="panel">
              <div className="panel-header">
                <h2>Global feature contributions</h2>
                <small>SHAP · log-odds</small>
              </div>
              <div className="panel-body">
                {data.importance.feature_importance.map((item) => (
                  <div key={item.feature} style={{ marginBottom: 16 }}>
                    <div className="split-heading muted">
                      <span>{item.feature}</span>
                      <span>{item.mean_absolute_shap.toFixed(3)}</span>
                    </div>
                    <div className="progress" style={{ marginTop: 6 }}>
                      <div
                        style={{
                          width: `${(item.mean_absolute_shap / data.importance.feature_importance[0].mean_absolute_shap) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
                <p className="muted">
                  Mean absolute contributions across 400 validation
                  observations. These are model associations, not causal
                  importance.
                </p>
              </div>
            </section>
          </div>
          <section className="panel">
            <div className="panel-header">
              <h2>Model comparison</h2>
              <small>Validation set · common threshold 0.5</small>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>F1</th>
                    <th>ROC-AUC</th>
                    <th>PR-AUC</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.comparison]
                    .sort((a, b) => b.pr_auc - a.pr_auc)
                    .map((row) => (
                      <tr key={row.model}>
                        <td className="machine-name">
                          {row.model.replaceAll("_", " ")}
                          {row.model === info.selected_model && (
                            <span className="chip" style={{ marginLeft: 8 }}>
                              Selected
                            </span>
                          )}
                        </td>
                        <td>{percent(row.precision)}</td>
                        <td>{percent(row.recall)}</td>
                        <td>{row.f1.toFixed(3)}</td>
                        <td>{row.roc_auc.toFixed(3)}</td>
                        <td>{row.pr_auc.toFixed(3)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="table-foot">
              Model selection used validation average precision. The final
              operating threshold was selected separately.
            </div>
          </section>
          <div className="two-columns" style={{ marginTop: 24 }}>
            <section className="panel">
              <div className="panel-header">
                <h2>Generalization checks</h2>
                <small>Training rows only</small>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Protocol</th>
                      <th>Fold</th>
                      <th>PR-AUC</th>
                      <th>Failures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cross_validation.map((row) => (
                      <tr key={`${row.protocol}-${row.fold}`}>
                        <td>
                          {row.protocol === "csv_blocks"
                            ? "CSV block holdout"
                            : "Stratified"}
                        </td>
                        <td>{row.fold}</td>
                        <td>{row.pr_auc.toFixed(3)}</td>
                        <td>{row.positive_support}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="panel">
              <div className="panel-header">
                <h2>Probability calibration</h2>
              </div>
              <div className="panel-body">
                <p className="muted">
                  Selected: <strong>{data.calibration.selected}</strong>
                </p>
                <div className="legend-row">
                  <span>Uncalibrated validation Brier</span>
                  <strong>
                    {data.calibration.uncalibrated.brier_score.toFixed(4)}
                  </strong>
                </div>
                <div className="legend-row">
                  <span>Sigmoid validation Brier</span>
                  <strong>
                    {data.calibration.sigmoid.brier_score.toFixed(4)}
                  </strong>
                </div>
                <p className="muted">
                  Lower Brier is better. Calibration was accepted only if Brier
                  improved by at least 5% with no more than 0.01
                  average-precision loss.
                </p>
                <div className="divider" />
                <p className="muted">
                  {info.risk_policy}. Risk thresholds:{" "}
                  {Object.entries(info.risk_thresholds)
                    .map(
                      ([key, value]) =>
                        `${key.replaceAll("_", " ")} ${percent(value)}`,
                    )
                    .join(" · ")}
                  .
                </p>
              </div>
            </section>
          </div>
          <section className="panel">
            <div className="panel-header">
              <h2>Experimental failure-type evaluation</h2>
              <small>
                Separate multilabel model · test set · threshold 0.5
              </small>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Flag</th>
                    <th>Positive support</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>PR-AUC</th>
                  </tr>
                </thead>
                <tbody>
                  {data.failure_types.results
                    .filter((row) => row.partition === "test")
                    .map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td>{row.positive_support}</td>
                        <td>{percent(row.precision)}</td>
                        <td>{percent(row.recall)}</td>
                        <td>{row.pr_auc.toFixed(3)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="muted" style={{ marginTop: 22 }}>
            Limitations: {info.limitations.join("; ")}. Dataset performance does
            not establish effectiveness on real machines.
          </p>
        </>
      )}
    </>
  );
}
