/**
 * TyreMind MVP — Operator
 * Chemical Aware AI Tyre Intelligence System
 *
 * Menampilkan Driver Behavior Score operator unit DT001: deteksi
 * overload, overspeed, harsh braking, dan harsh acceleration.
 *
 * Data dibaca dari services/tyreData.js (driverBehavior).
 *
 * Lokasi file: src/features/operator/Operator.jsx
 */

import { driverBehavior } from "../../services/tyreData";

// ─────────────────────────────────────────────
// THEME — skor TINGGI = BAIK (hijau), konvensi sama dengan healthScore
// ─────────────────────────────────────────────

function behaviorStatusMeta(score) {
  if (score >= 70) return { label: "Good", solid: "#1A7A4A", soft: "#E8F5EE", text: "#1A7A4A" };
  if (score >= 45) return { label: "Perlu Perhatian", solid: "#E0A526", soft: "#FDF3E0", text: "#B8790E" };
  return { label: "Critical", solid: "#C84B31", soft: "#FBEAE6", text: "#C84B31" };
}

const BEHAVIOR_LABELS = {
  overspeed: "Overspeed Detection",
  hardBraking: "Harsh Braking",
  harshAcceleration: "Harsh Acceleration",
  overloadDetection: "Overload Detection",
};

// ─────────────────────────────────────────────
// UI PRIMITIVES
// ─────────────────────────────────────────────

function Pill({ meta, className = "" }) {
  return (
    <span
      className={["text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0", className].join(" ")}
      style={{ backgroundColor: meta.soft, color: meta.text }}
    >
      {meta.label}
    </span>
  );
}

function ScoreBar({ value, colorSolid, trackClassName = "h-2" }) {
  return (
    <div className={["w-full bg-[#EDF3EF] rounded-full overflow-hidden", trackClassName].join(" ")}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(4, Math.min(100, value))}%`, backgroundColor: colorSolid }}
      />
    </div>
  );
}

function CircularScoreGauge({ score, size = 92, strokeWidth = 10, meta }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EDF3EF" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={meta.solid}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[#0B3B2D] text-xl font-bold leading-none">{score}</span>
        <span className="text-[#8FA89A] text-[9px] font-medium leading-none mt-0.5">/100</span>
      </div>
    </div>
  );
}

function BehaviorMetricRow({ metricKey, score }) {
  const meta = behaviorStatusMeta(score);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[#0B3B2D] text-[12.5px] font-semibold">{BEHAVIOR_LABELS[metricKey]}</span>
        <span className="text-[#0B3B2D] text-[12.5px] font-bold">{score}/100</span>
      </div>
      <ScoreBar value={score} colorSolid={meta.solid} />
    </div>
  );
}

// ─────────────────────────────────────────────
// OPERATOR — root component
// ─────────────────────────────────────────────

export default function Operator() {
  if (!driverBehavior) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-8 text-center">
        <p className="text-[#6B8F7A] text-sm">Belum ada data operator untuk ditampilkan.</p>
      </div>
    );
  }

  const scores = Object.values(driverBehavior.behaviorScores);
  const overallScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  const overallMeta = behaviorStatusMeta(overallScore);

  const initials = driverBehavior.operatorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col gap-5">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-1">
          Operator
        </p>
        <h2 className="text-[#0B3B2D] text-lg font-bold tracking-tight">Driver Behavior Score</h2>
        <p className="text-[#6B8F7A] text-[12px] mt-1">
          Perilaku mengemudi — faktor eksternal yang mempercepat keausan ban.
        </p>
      </div>

      {/* ── DRIVER BEHAVIOR SCORE ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-4">
          {driverBehavior.periodLabel}
        </p>

        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-[#EEF3F0]">
          <div className="w-10 h-10 rounded-full bg-[#E8F5EE] flex items-center justify-center flex-shrink-0">
            <span className="text-[#1A7A4A] text-[12px] font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#0B3B2D] text-[13px] font-semibold leading-tight truncate">
              {driverBehavior.operatorName}
            </p>
            <p className="text-[#6B8F7A] text-[11px] leading-tight truncate">
              Operator · {driverBehavior.operatorId}
            </p>
          </div>
          <CircularScoreGauge score={overallScore} size={64} strokeWidth={7} meta={overallMeta} />
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em]">
            Behaviour Breakdown
          </p>
          <Pill meta={overallMeta} />
        </div>

        <div className="flex flex-col gap-4">
          {Object.entries(driverBehavior.behaviorScores).map(([key, score]) => (
            <BehaviorMetricRow key={key} metricKey={key} score={score} />
          ))}
        </div>

        {overallScore < 70 && (
          <div className="rounded-xl bg-[#FDF3E0] px-3.5 py-3 mt-5">
            <p className="text-[#B8790E] text-[11.5px] font-bold">Coaching disarankan</p>
            <p className="text-[#B8790E]/90 text-[10.5px] mt-0.5">
              Kurangi overspeed dan harsh braking di segmen berisiko tinggi untuk memperpanjang umur ban.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
