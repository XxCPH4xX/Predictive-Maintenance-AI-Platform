export type Risk = "healthy" | "warning" | "high_risk" | "critical";
export type Reading = {
  machine_type: "L" | "M" | "H"; air_temperature: number; process_temperature: number;
  rotational_speed: number; torque: number; tool_wear: number;
};
export type Explanation = {
  base_value: number; units: string; interpretation: string;
  contributions: { feature: string; value: number }[];
};
export type Prediction = {
  id?: number; machine_id?: string; timestamp?: string; source?: string; inputs?: Reading;
  failure_probability: number; prediction: number; risk_level: Risk; model_version: string;
  warnings: string[]; failure_types: { label: string; probability: number }[];
  failure_type_note: string; explanation?: Explanation;
};
export type Alert = { id: number; machine_id: string; timestamp: string; risk_level: Risk; failure_probability: number; source: string };
export type Fleet = { total_machines: number; average_failure_probability: number | null; risk_distribution: Record<Risk, number>; machines: Prediction[]; alerts: Alert[] };
export type MetricSet = { precision: number; recall: number; f1: number; roc_auc: number; pr_auc: number; brier_score: number; confusion_matrix: number[][]; false_negatives: number; positive_support: number; support: number };
export type ModelInfo = { model_version: string; selected_model: string; decision_threshold: number; risk_thresholds: Record<string, number>; risk_policy: string; limitations: string[]; calibration: string; validation_metrics: MetricSet };

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.detail;
    const message = Array.isArray(detail) ? detail.map((error: { loc: string[]; msg: string }) => `${error.loc.slice(1).join(".")}: ${error.msg}`).join("; ") : detail;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return body as T;
}
export function post<T>(path: string, body: unknown) {
  return api<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
export const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
export const riskLabel = (value: Risk) => ({ healthy: "Healthy", warning: "Warning", high_risk: "High risk", critical: "Critical" })[value];
export const dateLabel = (value?: string) => value ? new Date(value).toLocaleString() : "—";
