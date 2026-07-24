/**
 * TyreMind MVP — Operator
 * Chemical Aware AI Tyre Intelligence System
 *
 * Driver Behavior Score dari data mentah speedProfile (kecepatan vs
 * jarak tempuh), dianalisis oleh services/drivingBehaviorModel.js:
 * - Overspeed Detection (zona di atas batas kecepatan)
 * - Harsh Braking (penurunan kecepatan tajam)
 * - Harsh Acceleration (kenaikan kecepatan tajam)
 *
 * Tiap kategori bisa diklik untuk menyorot lokasi kejadiannya langsung
 * di grafik + daftar detail di bawahnya.
 *
 * Catatan: halaman ini murni untuk observasi perilaku mengemudi.
 * TIDAK memengaruhi Skor Risiko Blowout di AI Insight — SOP penilaian
 * perilaku operator yang valid belum ada, jadi datanya dilepas dari
 * perhitungan risiko ban (lihat catatan di AiInsight.jsx).
 *
 * Lokasi file: src/features/operator/Operator.jsx
 */

import { useState } from "react";
import { driverBehavior } from "../../services/tyreData";
import { analyzeDrivingBehavior, HARSH_DELTA_THRESHOLD_KMH } from "../../services/drivingBehaviorModel";

// ─────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────

function behaviorStatusMeta(score) {
  if (score >= 70) return { label: "Good", solid: "#1A7A4A", soft: "#E8F5EE", text: "#1A7A4A" };
  if (score >= 45) return { label: "Warning", solid: "#E0A526", soft: "#FDF3E0", text: "#B8790E" };
  return { label: "Critical", solid: "#C84B31", soft: "#FBEAE6", text: "#C84B31" };
}

const METRIC_META = {
  overspeed: { label: "Overspeed Detection", color: "#E0A526" },
  harshBraking: { label: "Harsh Braking", color: "#C84B31" },
  harshAcceleration: { label: "Harsh Acceleration", color: "#3B82C4" },
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

function ScoreBar({ value, colorSolid }) {
  return (
    <div className="w-full h-2 bg-[#EDF3EF] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(4, Math.min(100, value))}%`, backgroundColor: colorSolid }}
      />
    </div>
  );
}

function CircularScoreGauge({ score, size = 64, strokeWidth = 7 }) {
  const meta = behaviorStatusMeta(score);
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
        <span className="text-[#0B3B2D] text-lg font-bold leading-none">{score}</span>
        <span className="text-[#8FA89A] text-[8.5px] font-medium leading-none mt-0.5">/100</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// GRAFIK KECEPATAN vs JARAK TEMPUH
// ─────────────────────────────────────────────

function SpeedDistanceChart({ speedProfile, speedLimitKmh, analysis, selectedMetric }) {
  const width = 640;
  const height = 200;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxKm = Math.max(...speedProfile.map((p) => p.distanceKm));
  const maxSpeed = Math.max(speedLimitKmh, ...speedProfile.map((p) => p.speedKmh)) + 8;

  const xAt = (km) => padL + (km / maxKm) * plotW;
  const yAt = (kmh) => padT + plotH - (kmh / maxSpeed) * plotH;

  const linePoints = speedProfile.map((p) => `${xAt(p.distanceKm).toFixed(1)},${yAt(p.speedKmh).toFixed(1)}`).join(" L");

  const dim = (metricKey) => (selectedMetric && selectedMetric !== metricKey ? 0.22 : 1);
  const emphasized = (metricKey) => selectedMetric === metricKey;

  return (
    <div className="rounded-xl bg-[#F4F7F5] p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
        {/* Sumbu Y — garis bantu tiap 10 km/h */}
        {Array.from({ length: Math.ceil(maxSpeed / 10) + 1 }, (_, i) => i * 10).map((tick) => (
          <g key={tick}>
            <line x1={padL} y1={yAt(tick)} x2={width - padR} y2={yAt(tick)} stroke="#E8EDE9" strokeWidth="1" />
            <text x={padL - 6} y={yAt(tick) + 3} textAnchor="end" fontSize="9" fill="#8FA89A">
              {tick}
            </text>
          </g>
        ))}

        {/* Garis batas kecepatan (speed limit) */}
        <line
          x1={padL}
          y1={yAt(speedLimitKmh)}
          x2={width - padR}
          y2={yAt(speedLimitKmh)}
          stroke="#E0A526"
          strokeWidth="1.3"
          strokeDasharray="4 3"
          opacity={dim("overspeed")}
        />
        <text x={width - padR} y={yAt(speedLimitKmh) - 4} textAnchor="end" fontSize="9" fill="#B8790E" opacity={dim("overspeed")}>
          Batas {speedLimitKmh} km/h
        </text>

        {/* Underline — zona overspeed */}
        {analysis.overspeedSegments.map((seg, idx) => (
          <line
            key={idx}
            x1={xAt(seg.startKm)}
            y1={height - padB + 10}
            x2={xAt(seg.endKm)}
            y2={height - padB + 10}
            stroke={METRIC_META.overspeed.color}
            strokeWidth={emphasized("overspeed") ? 5 : 3.5}
            strokeLinecap="round"
            opacity={dim("overspeed")}
          />
        ))}

        {/* Garis kecepatan */}
        <path d={`M${linePoints}`} fill="none" stroke="#0B3B2D" strokeWidth="1.6" strokeLinejoin="round" opacity={0.85} />

        {/* Titik harsh braking */}
        {analysis.harshBrakingEvents.map((ev, idx) => (
          <circle
            key={idx}
            cx={xAt(ev.distanceKm)}
            cy={yAt(ev.toSpeedKmh)}
            r={emphasized("harshBraking") ? 6.5 : 4.5}
            fill={METRIC_META.harshBraking.color}
            stroke="white"
            strokeWidth="1.3"
            opacity={dim("harshBraking")}
          />
        ))}

        {/* Titik harsh acceleration */}
        {analysis.harshAccelerationEvents.map((ev, idx) => (
          <circle
            key={idx}
            cx={xAt(ev.distanceKm)}
            cy={yAt(ev.toSpeedKmh)}
            r={emphasized("harshAcceleration") ? 6.5 : 4.5}
            fill={METRIC_META.harshAcceleration.color}
            stroke="white"
            strokeWidth="1.3"
            opacity={dim("harshAcceleration")}
          />
        ))}

        {/* Sumbu X — label jarak */}
        {Array.from({ length: Math.floor(maxKm / 2) + 1 }, (_, i) => i * 2).map((tick) => (
          <text key={tick} x={xAt(tick)} y={height - 6} textAnchor="middle" fontSize="9" fill="#8FA89A">
            {tick} km
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-2 px-1">
        <span className="flex items-center gap-1.5 text-[10px] text-[#6B8F7A] font-medium">
          <span className="w-3 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: METRIC_META.overspeed.color }} />
          Overspeed (underline)
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-[#6B8F7A] font-medium">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: METRIC_META.harshBraking.color }} />
          Harsh Braking
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-[#6B8F7A] font-medium">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: METRIC_META.harshAcceleration.color }} />
          Harsh Acceleration
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DETAIL KEJADIAN — daftar kejadian untuk kategori yang dipilih
// ─────────────────────────────────────────────

function EventDetailPanel({ metricKey, analysis, onClose }) {
  const meta = METRIC_META[metricKey];

  let rows = [];
  if (metricKey === "overspeed") {
    rows = analysis.overspeedSegments.map((seg, idx) => ({
      key: idx,
      title: `Km ${seg.startKm.toFixed(1)} – ${seg.endKm.toFixed(1)}`,
      detail: `Kecepatan maksimum ${seg.maxSpeedKmh} km/h di zona ini.`,
    }));
  } else if (metricKey === "harshBraking") {
    rows = analysis.harshBrakingEvents.map((ev, idx) => ({
      key: idx,
      title: `Km ${ev.distanceKm.toFixed(1)}`,
      detail: `${ev.fromSpeedKmh} → ${ev.toSpeedKmh} km/h (Δ${ev.deltaKmh} km/h dalam 1 titik sampel).`,
    }));
  } else if (metricKey === "harshAcceleration") {
    rows = analysis.harshAccelerationEvents.map((ev, idx) => ({
      key: idx,
      title: `Km ${ev.distanceKm.toFixed(1)}`,
      detail: `${ev.fromSpeedKmh} → ${ev.toSpeedKmh} km/h (Δ+${ev.deltaKmh} km/h dalam 1 titik sampel).`,
    }));
  }

  return (
    <div className="rounded-xl border border-[#EEF3F0] p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12.5px] font-bold" style={{ color: meta.color }}>
          Detail Kejadian — {meta.label} ({rows.length}×)
        </p>
        <button
          onClick={onClose}
          aria-label="Tutup detail"
          className="w-6 h-6 rounded-full flex items-center justify-center text-[#8FA89A] hover:bg-[#F4F7F5] hover:text-[#0B3B2D] flex-shrink-0"
        >
          ✕
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-[#6B8F7A] text-[12px]">Tidak ada kejadian terdeteksi untuk kategori ini.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.key} className="flex items-start gap-2.5 rounded-lg bg-[#F4F7F5] px-3 py-2.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: meta.color }} />
              <div className="min-w-0">
                <p className="text-[#0B3B2D] text-[12px] font-bold leading-tight">{row.title}</p>
                <p className="text-[#6B8F7A] text-[11px] leading-snug mt-0.5">{row.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// BARIS METRIK — clickable, menyorot kategori di grafik + buka detail
// ─────────────────────────────────────────────

function BehaviorMetricRow({ metricKey, score, count, isSelected, onToggle }) {
  const meta = METRIC_META[metricKey];
  const statusMeta = behaviorStatusMeta(score);

  return (
    <button
      type="button"
      onClick={() => onToggle(metricKey)}
      aria-pressed={isSelected}
      className={[
        "w-full text-left rounded-xl py-2.5 px-3 transition-colors duration-150",
        isSelected ? "bg-[#F4F7F5]" : "hover:bg-[#F4F7F5]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-2 text-[#0B3B2D] text-[12.5px] font-semibold">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
          {meta.label}
          <span className="text-[#8FA89A] text-[10.5px] font-medium">({count}×)</span>
        </span>
        <span className="text-[#0B3B2D] text-[12.5px] font-bold">{score}/100</span>
      </div>
      <ScoreBar value={score} colorSolid={statusMeta.solid} />
    </button>
  );
}

// ─────────────────────────────────────────────
// OPERATOR — root component
// ─────────────────────────────────────────────

export default function Operator() {
  const [selectedMetric, setSelectedMetric] = useState(null);

  if (!driverBehavior) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-8 text-center">
        <p className="text-[#6B8F7A] text-sm">Belum ada data operator untuk ditampilkan.</p>
      </div>
    );
  }

  const analysis = analyzeDrivingBehavior(driverBehavior.speedProfile, driverBehavior.speedLimitKmh);
  const overallMeta = behaviorStatusMeta(analysis.overallScore);

  const initials = driverBehavior.operatorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function handleToggle(metricKey) {
    setSelectedMetric((prev) => (prev === metricKey ? null : metricKey));
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-1">Operator</p>
        <h2 className="text-[#0B3B2D] text-lg font-bold tracking-tight">Driver Behavior Score</h2>
        <p className="text-[#6B8F7A] text-[12px] mt-1">
          Perilaku mengemudi — faktor eksternal yang mempercepat keausan ban. Tidak memengaruhi Skor Risiko
          Blowout di AI Insight.
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
          <CircularScoreGauge score={analysis.overallScore} />
        </div>

        <div className="flex items-center justify-between mb-3">
          <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em]">
            Behaviour Breakdown
          </p>
          <Pill meta={overallMeta} />
        </div>

        <div className="flex flex-col gap-1 mb-5">
          <BehaviorMetricRow
            metricKey="overspeed"
            score={analysis.scores.overspeed}
            count={analysis.overspeedSegments.length}
            isSelected={selectedMetric === "overspeed"}
            onToggle={handleToggle}
          />
          <BehaviorMetricRow
            metricKey="harshBraking"
            score={analysis.scores.harshBraking}
            count={analysis.harshBrakingEvents.length}
            isSelected={selectedMetric === "harshBraking"}
            onToggle={handleToggle}
          />
          <BehaviorMetricRow
            metricKey="harshAcceleration"
            score={analysis.scores.harshAcceleration}
            count={analysis.harshAccelerationEvents.length}
            isSelected={selectedMetric === "harshAcceleration"}
            onToggle={handleToggle}
          />
        </div>

        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em] mb-2">
          Kecepatan vs Jarak Tempuh
        </p>
        <SpeedDistanceChart
          speedProfile={driverBehavior.speedProfile}
          speedLimitKmh={driverBehavior.speedLimitKmh}
          analysis={analysis}
          selectedMetric={selectedMetric}
        />
        <p className="text-[#8FA89A] text-[10px] mt-2">
          Klik salah satu kategori di atas untuk menyorot lokasinya di grafik. "Harsh" didekati dari perubahan
          kecepatan ≥{HARSH_DELTA_THRESHOLD_KMH} km/h antar titik sampel jarak — bukan akselerasi sebenarnya
          (perlu data waktu), lihat catatan di drivingBehaviorModel.js.
        </p>

        {selectedMetric && (
          <EventDetailPanel metricKey={selectedMetric} analysis={analysis} onClose={() => setSelectedMetric(null)} />
        )}

        {analysis.overallScore < 70 && (
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