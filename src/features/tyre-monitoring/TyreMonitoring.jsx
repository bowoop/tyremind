/**
 * TyreMind MVP — Tyre Monitoring
 * Chemical Aware AI Tyre Intelligence System
 *
 * Menampilkan tata letak posisi ban (tampak atas) untuk unit DT001,
 * lengkap dengan detail sensor real-time per ban: tekanan, suhu,
 * degradasi material, health score, dan remaining useful life.
 *
 * Indikator warna:
 *   Hijau  → Normal / Good
 *   Kuning → Warning
 *   Merah  → Critical
 *
 * Seluruh data dibaca langsung dari services/tyreData.js.
 *
 * Lokasi file: src/features/tyre-monitoring/TyreMonitoring.jsx
 */

import { useState } from "react";
import { fleet, TyreStatus, TyrePosition } from "../../services/tyreData";

// ─────────────────────────────────────────────
// STATUS THEME — selaras dengan DashboardOverview.jsx / MainLayout.jsx
// ─────────────────────────────────────────────

const STATUS_META = {
  [TyreStatus.NORMAL]: {
    label: "Good",
    solid: "#1A7A4A",
    soft: "#E8F5EE",
    text: "#1A7A4A",
  },
  [TyreStatus.WARNING]: {
    label: "Warning",
    solid: "#E0A526",
    soft: "#FDF3E0",
    text: "#B8790E",
  },
  [TyreStatus.CRITICAL]: {
    label: "Critical",
    solid: "#C84B31",
    soft: "#FBEAE6",
    text: "#C84B31",
  },
};

// Ambang batas sensor — dipakai untuk mewarnai tiap baris sensor
// individual (bisa berbeda dari status keseluruhan ban).
function pressureStatus(psi) {
  if (psi < 90) return TyreStatus.CRITICAL;
  if (psi < 100) return TyreStatus.WARNING;
  return TyreStatus.NORMAL;
}
function temperatureStatus(celsius) {
  if (celsius > 75) return TyreStatus.CRITICAL;
  if (celsius > 65) return TyreStatus.WARNING;
  return TyreStatus.NORMAL;
}
function degradationStatus(pct) {
  if (pct >= 40) return TyreStatus.CRITICAL;
  if (pct >= 25) return TyreStatus.WARNING;
  return TyreStatus.NORMAL;
}

// ─────────────────────────────────────────────
// UI PRIMITIVES
// ─────────────────────────────────────────────

function StatusPill({ status, className = "" }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={["text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0", className].join(" ")}
      style={{ backgroundColor: meta.soft, color: meta.text }}
    >
      {meta.label}
    </span>
  );
}

function CircularScoreGauge({ score, size = 88, strokeWidth = 9 }) {
  const status = score < 40 ? TyreStatus.CRITICAL : score < 70 ? TyreStatus.WARNING : TyreStatus.NORMAL;
  const meta = STATUS_META[status];
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

function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-1.5 text-[#6B8F7A] text-[10.5px] font-medium">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────
// TRUCK LAYOUT DIAGRAM — tampak atas, 4 posisi ban
// ─────────────────────────────────────────────

function TruckLayoutDiagram({ tyres, selectedId, onSelect }) {
  const layout = [
    { pos: TyrePosition.FRONT_LEFT, top: "13%", left: "16%" },
    { pos: TyrePosition.FRONT_RIGHT, top: "13%", left: "84%" },
    { pos: TyrePosition.REAR_LEFT, top: "83%", left: "16%" },
    { pos: TyrePosition.REAR_RIGHT, top: "83%", left: "84%" },
  ];

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: 300, aspectRatio: "3 / 4" }}>
      {/* Sasis truk — dekorasi visual, bukan data */}
      <svg viewBox="0 0 200 260" className="absolute inset-0 w-full h-full" fill="none" aria-hidden="true">
        <rect x="52" y="18" width="96" height="224" rx="20" stroke="#D7E3DA" strokeWidth="3" />
        <rect x="68" y="34" width="64" height="46" rx="8" stroke="#D7E3DA" strokeWidth="2.5" />
        <line x1="52" y1="150" x2="148" y2="150" stroke="#D7E3DA" strokeWidth="2.5" />
        <line x1="100" y1="82" x2="100" y2="242" stroke="#E8EDE9" strokeWidth="1.5" strokeDasharray="4 5" />
      </svg>

      {layout.map(({ pos, top, left }) => {
        const tyre = tyres.find((t) => t.position === pos);
        if (!tyre) {
          return (
            <div
              key={pos}
              style={{ top, left, transform: "translate(-50%, -50%)" }}
              className="absolute w-[64px] h-[64px] rounded-2xl border border-dashed border-[#E0EAE3] flex items-center justify-center"
            >
              <span className="text-[9px] text-[#B7C7BD] text-center px-1">No data</span>
            </div>
          );
        }

        const meta = STATUS_META[tyre.status];
        const isSelected = tyre.id === selectedId;

        return (
          <button
            key={pos}
            onClick={() => onSelect(tyre.id)}
            aria-pressed={isSelected}
            style={{
              top,
              left,
              transform: "translate(-50%, -50%)",
              backgroundColor: meta.soft,
              borderColor: isSelected ? meta.solid : "transparent",
            }}
            className="absolute w-[64px] h-[64px] rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1A7A4A]"
          >
            <span className="text-lg font-bold leading-none" style={{ color: meta.text }}>
              {tyre.healthScore}
            </span>
            <span className="text-[8.5px] font-bold uppercase tracking-wide" style={{ color: meta.text }}>
              {tyre.id}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// SENSOR ROW — satu baris pembacaan sensor dengan bar
// ─────────────────────────────────────────────

function SensorRow({ label, value, pct, status }) {
  const meta = STATUS_META[status];
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[#6B8F7A] text-[11.5px] font-medium">{label}</span>
        <span className="text-[#0B3B2D] text-[13px] font-bold">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-[#EDF3EF] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(4, Math.min(100, pct))}%`, backgroundColor: meta.solid }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DETAIL PANEL — ban yang sedang dipilih
// ─────────────────────────────────────────────

function TyreDetailPanel({ tyre }) {
  const rulDays = Math.round(tyre.remainingUsefulLifeHours / 24);

  return (
    <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-1">
            {tyre.position}
          </p>
          <h3 className="text-[#0B3B2D] text-xl font-bold tracking-tight">{tyre.id}</h3>
        </div>
        <StatusPill status={tyre.status} />
      </div>

      <div className="flex items-center gap-5 mb-6 pb-6 border-b border-[#EEF3F0]">
        <CircularScoreGauge score={tyre.healthScore} size={92} strokeWidth={10} />
        <div>
          <p className="text-[#0B3B2D] text-2xl font-bold leading-none">
            {rulDays} <span className="text-sm font-medium text-[#6B8F7A]">hari</span>
          </p>
          <p className="text-[#6B8F7A] text-[11px] mt-1.5">Remaining Useful Life</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SensorRow
          label="Tekanan Ban"
          value={`${tyre.pressurePsi} PSI`}
          pct={(tyre.pressurePsi / 120) * 100}
          status={pressureStatus(tyre.pressurePsi)}
        />
        <SensorRow
          label="Suhu Permukaan"
          value={`${tyre.temperatureCelcius}°C`}
          pct={(tyre.temperatureCelcius / 100) * 100}
          status={temperatureStatus(tyre.temperatureCelcius)}
        />
        <SensorRow
          label="Degradasi Material"
          value={`${tyre.materialDegradationPct}%`}
          pct={tyre.materialDegradationPct}
          status={degradationStatus(tyre.materialDegradationPct)}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LIST BAN — semua ban dalam bentuk baris klikable
// ─────────────────────────────────────────────

function TyreListRow({ tyre, isSelected, onSelect }) {
  const rulDays = Math.round(tyre.remainingUsefulLifeHours / 24);

  return (
    <button
      onClick={() => onSelect(tyre.id)}
      aria-pressed={isSelected}
      className={[
        "w-full flex items-center justify-between gap-3 py-3 px-3 rounded-xl text-left transition-colors duration-150",
        isSelected ? "bg-[#E8F5EE]" : "hover:bg-[#F4F7F5]",
      ].join(" ")}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: STATUS_META[tyre.status].solid }}
        />
        <div className="min-w-0">
          <p className="text-[#0B3B2D] text-[13px] font-semibold leading-tight truncate">
            {tyre.id} · {tyre.position}
          </p>
          <p className="text-[#6B8F7A] text-[11px] mt-0.5 truncate">
            RUL {rulDays} hari · {tyre.pressurePsi} PSI · {tyre.temperatureCelcius}°C
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-[#0B3B2D] text-sm font-bold">{tyre.healthScore}</span>
        <StatusPill status={tyre.status} />
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// TYRE MONITORING — root component
// ─────────────────────────────────────────────

export default function TyreMonitoring() {
  const unit = fleet.find((u) => u.unitId === "DT001") ?? fleet[0];

  const mostCriticalTyre = unit?.tyres.reduce(
    (worst, t) => (!worst || t.healthScore < worst.healthScore ? t : worst),
    null
  );

  const [selectedId, setSelectedId] = useState(mostCriticalTyre?.id ?? null);

  if (!unit || unit.tyres.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-8 text-center">
        <p className="text-[#6B8F7A] text-sm">Belum ada data ban untuk ditampilkan.</p>
      </div>
    );
  }

  const selectedTyre = unit.tyres.find((t) => t.id === selectedId) ?? unit.tyres[0];

  return (
    <div className="flex flex-col gap-5">
      {/* ── HEADER UNIT ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-1">
            Unit Termonitor
          </p>
          <h2 className="text-[#0B3B2D] text-lg font-bold tracking-tight">
            {unit.name}{" "}
            <span className="text-[#6B8F7A] font-medium text-sm">({unit.unitId})</span>
          </h2>
          <p className="text-[#6B8F7A] text-[12px] mt-1">
            {unit.site} · Segmen {unit.segment}
          </p>
        </div>
        <StatusPill status={unit.overallStatus} />
      </div>

      {/* ── DIAGRAM + DETAIL ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-5">
        <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
          <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-4">
            Tata Letak Ban — Tampak Atas
          </p>
          <TruckLayoutDiagram tyres={unit.tyres} selectedId={selectedTyre.id} onSelect={setSelectedId} />
          <div className="flex items-center justify-center gap-4 mt-5">
            <LegendDot color={STATUS_META[TyreStatus.NORMAL].solid} label="Good" />
            <LegendDot color={STATUS_META[TyreStatus.WARNING].solid} label="Warning" />
            <LegendDot color={STATUS_META[TyreStatus.CRITICAL].solid} label="Critical" />
          </div>
        </div>

        <TyreDetailPanel tyre={selectedTyre} />
      </div>

      {/* ── DAFTAR SEMUA BAN ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-2 px-1">
          Semua Ban — {unit.unitId}
        </p>
        <div className="flex flex-col divide-y divide-[#EEF3F0]">
          {unit.tyres.map((tyre) => (
            <TyreListRow
              key={tyre.id}
              tyre={tyre}
              isSelected={tyre.id === selectedTyre.id}
              onSelect={setSelectedId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
