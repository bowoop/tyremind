/**
 * TyreMind MVP — Dashboard Overview
 * Chemical Aware AI Tyre Intelligence System
 *
 * Menampilkan ringkasan metrik utama armada:
 * - Rata-rata Tyre Health Score
 * - Remaining Useful Life (RUL) — dari ban paling kritis
 * - Fleet Availability
 * - Status detail Unit DT001
 *
 * Seluruh angka dihitung langsung (derived) dari services/tyreData.js,
 * tidak ada nilai statis/hardcoded di komponen ini.
 *
 * Lokasi file: src/features/dashboard/DashboardOverview.jsx
 */

import { fleet, TyreStatus, TyrePosition } from "../../services/tyreData";

// ─────────────────────────────────────────────
// STATUS THEME — selaras dengan palet warna MainLayout.jsx
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

function scoreToStatus(score) {
  if (score < 40) return TyreStatus.CRITICAL;
  if (score < 70) return TyreStatus.WARNING;
  return TyreStatus.NORMAL;
}

// ─────────────────────────────────────────────
// AGGREGATION — dihitung dari fleet (tyreData.js)
// ─────────────────────────────────────────────

function computeFleetMetrics(fleetData) {
  const allTyres = fleetData.flatMap((unit) =>
    unit.tyres.map((tyre) => ({ ...tyre, unitId: unit.unitId }))
  );

  const totalTyres = allTyres.length;
  const activeVehicles = fleetData.length;

  const avgHealthScore = totalTyres
    ? Math.round(
        allTyres.reduce((sum, t) => sum + t.healthScore, 0) / totalTyres
      )
    : 0;

  const minRULTyre = totalTyres
    ? allTyres.reduce((min, t) =>
        !min || t.remainingUsefulLifeKm < min.remainingUsefulLifeKm ? t : min,
        null
      )
    : null;
  const minRULKm = minRULTyre?.remainingUsefulLifeKm ?? 0;

  const alertCounts = allTyres.reduce(
    (acc, t) => {
      if (t.status === TyreStatus.CRITICAL) acc.critical += 1;
      else if (t.status === TyreStatus.WARNING) acc.warning += 1;
      else acc.info += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 }
  );

  // Catatan: field "availability" belum ada di data model unit saat ini.
  // Sementara dihitung dari overallStatus tiap unit — unit dengan status
  // CRITICAL dianggap belum sepenuhnya siap operasi. Ganti dengan field
  // operasional (mis. unit.isOperational) begitu tersedia dari backend.
  const availableUnits = fleetData.filter(
    (u) => u.overallStatus !== TyreStatus.CRITICAL
  ).length;
  const fleetAvailabilityPct = activeVehicles
    ? Math.round((availableUnits / activeVehicles) * 100)
    : 0;

  const topRiskTyres = [...allTyres]
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 4);

  return {
    totalTyres,
    activeVehicles,
    avgHealthScore,
    minRULKm,
    minRULTyre,
    alertCounts,
    fleetAvailabilityPct,
    availableUnits,
    topRiskTyres,
  };
}

// ─────────────────────────────────────────────
// UI PRIMITIVES
// ─────────────────────────────────────────────

function MetricCard({ label, children, className = "" }) {
  return (
    <div
      className={[
        "bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm",
        className,
      ].join(" ")}
    >
      <p className="text-[#6B8F7A] text-[11px] font-semibold tracking-[0.08em] uppercase mb-3">
        {label}
      </p>
      {children}
    </div>
  );
}

function StatusPill({ status, className = "" }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={["text-[11px] font-bold px-2.5 py-1 rounded-full", className].join(" ")}
      style={{ backgroundColor: meta.soft, color: meta.text }}
    >
      {meta.label}
    </span>
  );
}

function CircularScoreGauge({ score, size = 84, strokeWidth = 9 }) {
  const meta = STATUS_META[scoreToStatus(score)];
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#EDF3EF"
          strokeWidth={strokeWidth}
        />
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
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[#0B3B2D] text-xl font-bold leading-none">{score}</span>
        <span className="text-[#8FA89A] text-[9px] font-medium leading-none mt-0.5">/100</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TYRE HEALTH MAP — posisi ban unit terpilih
// ─────────────────────────────────────────────

function TyreHealthMap({ unit }) {
  const order = [
    TyrePosition.FRONT_LEFT,
    TyrePosition.FRONT_RIGHT,
    TyrePosition.REAR_LEFT,
    TyrePosition.REAR_RIGHT,
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {order.map((pos) => {
        const tyre = unit.tyres.find((t) => t.position === pos);

        if (!tyre) {
          return (
            <div
              key={pos}
              className="rounded-xl border border-dashed border-[#E0EAE3] flex flex-col items-center justify-center py-5 text-[#B7C7BD]"
            >
              <span className="text-[9.5px] font-semibold uppercase tracking-wide text-center px-1">
                {pos}
              </span>
              <span className="text-[11px] mt-1">No data</span>
            </div>
          );
        }

        const meta = STATUS_META[tyre.status];
        return (
          <div
            key={pos}
            className="rounded-xl flex flex-col items-center justify-center py-5"
            style={{ backgroundColor: meta.soft }}
          >
            <span className="text-2xl font-bold leading-none" style={{ color: meta.text }}>
              {tyre.healthScore}
            </span>
            <span
              className="text-[9.5px] font-semibold uppercase tracking-wide mt-1.5 text-center px-1"
              style={{ color: meta.text }}
            >
              {pos}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// TOP RISK TYRES — diurutkan dari health score terendah
// ─────────────────────────────────────────────

function TopRiskTyres({ tyres }) {
  if (tyres.length === 0) {
    return <p className="text-[#6B8F7A] text-[12.5px] py-4">Belum ada data ban.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-[#EEF3F0]">
      {tyres.map((tyre) => (
        <div key={tyre.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-[#0B3B2D] text-[12.5px] font-semibold leading-tight truncate">
              {tyre.id}
            </p>
            <p className="text-[#6B8F7A] text-[11px] mt-0.5">
              RUL {tyre.remainingUsefulLifeKm.toLocaleString("id-ID")} km · {tyre.unitId} · {tyre.position}
            </p>
          </div>
          <StatusPill status={tyre.status} className="flex-shrink-0 ml-3" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// UNIT STATUS CARD — detail status unit (DT001)
// ─────────────────────────────────────────────

function UnitStatusCard({ unit }) {
  const rulKm = Math.min(...unit.tyres.map((t) => t.remainingUsefulLifeKm));
  const initials = unit.operator
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
        <div>
          <p className="text-[#6B8F7A] text-[11px] font-semibold tracking-[0.08em] uppercase mb-1">
            Unit Status
          </p>
          <h3 className="text-[#0B3B2D] text-lg font-bold tracking-tight">
            {unit.name}{" "}
            <span className="text-[#6B8F7A] font-medium text-sm">({unit.unitId})</span>
          </h3>
          <p className="text-[#6B8F7A] text-[12px] mt-1">
            {unit.site} · Segmen {unit.segment}
          </p>
        </div>
        <StatusPill status={unit.overallStatus} className="flex-shrink-0" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div>
          <p className="text-[#0B3B2D] text-2xl font-bold leading-none">{unit.healthScore}</p>
          <p className="text-[#6B8F7A] text-[10.5px] mt-1.5">Health Score</p>
        </div>
        <div>
          <p className="text-[#0B3B2D] text-2xl font-bold leading-none">
            {rulKm.toLocaleString("id-ID")}
            <span className="text-sm font-medium text-[#6B8F7A]"> km</span>
          </p>
          <p className="text-[#6B8F7A] text-[10.5px] mt-1.5">Remaining Useful Life</p>
        </div>
        <div>
          <p className="text-[#0B3B2D] text-2xl font-bold leading-none">
            {unit.operationalMetrics.averagePayloadTon}
            <span className="text-sm font-medium text-[#6B8F7A]"> Ton</span>
          </p>
          <p className="text-[#6B8F7A] text-[10.5px] mt-1.5">Avg. Payload</p>
        </div>
        <div>
          <p className="text-[#0B3B2D] text-2xl font-bold leading-none">
            {unit.operationalMetrics.overloadFrequencyPct}%
          </p>
          <p className="text-[#6B8F7A] text-[10.5px] mt-1.5">Overload Frequency</p>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-[#EEF3F0]">
        <div className="w-9 h-9 rounded-full bg-[#E8F5EE] flex items-center justify-center flex-shrink-0">
          <span className="text-[#1A7A4A] text-[11px] font-bold">{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[#0B3B2D] text-[12.5px] font-semibold leading-tight truncate">
            {unit.operator}
          </p>
          <p className="text-[#6B8F7A] text-[11px] leading-tight truncate">
            Operator · {unit.operatorId}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DASHBOARD OVERVIEW — root component
// ─────────────────────────────────────────────

export default function DashboardOverview() {
  const {
    totalTyres,
    activeVehicles,
    avgHealthScore,
    minRULKm,
    minRULTyre,
    alertCounts,
    fleetAvailabilityPct,
    availableUnits,
    topRiskTyres,
  } = computeFleetMetrics(fleet);

  const primaryUnit = fleet.find((u) => u.unitId === "DT001") ?? fleet[0];
  const avgScoreStatus = scoreToStatus(avgHealthScore);

  if (!primaryUnit) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-8 text-center">
        <p className="text-[#6B8F7A] text-sm">Belum ada data unit pada armada.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── ROW 1 — RINGKASAN METRIK UTAMA ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        <MetricCard label="Total Tyres">
          <div className="flex items-end justify-between">
            <span className="text-[#0B3B2D] text-3xl font-bold tracking-tight">
              {totalTyres}
            </span>
          </div>
        </MetricCard>

        <MetricCard label="Active Vehicles">
          <div className="flex items-end justify-between">
            <span className="text-[#0B3B2D] text-3xl font-bold tracking-tight">
              {activeVehicles}
            </span>
            <span className="text-[#1A7A4A] text-[11px] font-semibold bg-[#E8F5EE] px-2 py-1 rounded-full">
              Online
            </span>
          </div>
        </MetricCard>

        <MetricCard label="Avg. Tyre Health Score">
          <div className="flex items-center gap-4">
            <CircularScoreGauge score={avgHealthScore} />
            <div>
              <StatusPill status={avgScoreStatus} />
              <p className="text-[#6B8F7A] text-[11px] mt-2 leading-snug">
                Rata-rata seluruh ban armada
              </p>
            </div>
          </div>
        </MetricCard>

        <MetricCard label="Remaining Useful Life">
          <div className="flex items-end gap-1.5 mb-3">
            <span className="text-[#0B3B2D] text-3xl font-bold tracking-tight">
              {minRULKm.toLocaleString("id-ID")}
            </span>
            <span className="text-[#6B8F7A] text-xs font-medium mb-1">KM</span>
          </div>
          <div className="h-1.5 w-full bg-[#EDF3EF] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (minRULKm / 5000) * 100)}%`,
                backgroundColor: STATUS_META[minRULTyre?.status ?? TyreStatus.NORMAL].solid,
              }}
            />
          </div>
          <p className="text-[#6B8F7A] text-[10.5px] mt-2">Ban dengan sisa umur terendah</p>
        </MetricCard>

        <MetricCard label="Alerts">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#C84B31] text-xl font-bold leading-none">
                {alertCounts.critical}
              </p>
              <p className="text-[#6B8F7A] text-[10px] mt-1">Critical</p>
            </div>
            <div>
              <p className="text-[#E0A526] text-xl font-bold leading-none">
                {alertCounts.warning}
              </p>
              <p className="text-[#6B8F7A] text-[10px] mt-1">Warning</p>
            </div>
            <div>
              <p className="text-[#3B82C4] text-xl font-bold leading-none">
                {alertCounts.info}
              </p>
              <p className="text-[#6B8F7A] text-[10px] mt-1">Info</p>
            </div>
          </div>
        </MetricCard>
      </div>

      {/* ── ROW 2 — FLEET AVAILABILITY ── */}
      <MetricCard label="Fleet Availability">
        <div className="flex items-center gap-4">
          <span className="text-[#0B3B2D] text-3xl font-bold tracking-tight flex-shrink-0">
            {fleetAvailabilityPct}%
          </span>
          <div className="flex-1 h-2 bg-[#EDF3EF] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1A7A4A] rounded-full"
              style={{ width: `${fleetAvailabilityPct}%` }}
            />
          </div>
        </div>
        <p className="text-[#6B8F7A] text-[10.5px] mt-2">
          {availableUnits} dari {activeVehicles} unit dalam status siap operasi
        </p>
      </MetricCard>

      {/* ── ROW 3 — TYRE HEALTH MAP & TOP RISK TYRES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
          <p className="text-[#6B8F7A] text-[11px] font-semibold tracking-[0.08em] uppercase mb-4">
            Tyre Health Map — {primaryUnit.unitId}
          </p>
          <TyreHealthMap unit={primaryUnit} />
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
          <p className="text-[#6B8F7A] text-[11px] font-semibold tracking-[0.08em] uppercase mb-2">
            Top Risk Tyres
          </p>
          <TopRiskTyres tyres={topRiskTyres} />
        </div>
      </div>

      {/* ── ROW 4 — STATUS UNIT DT001 ── */}
      <UnitStatusCard unit={primaryUnit} />
    </div>
  );
}