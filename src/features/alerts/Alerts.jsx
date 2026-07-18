/**
 * TyreMind MVP — Alerts
 * Chemical Aware AI Tyre Intelligence System
 *
 * Smart Alerts — notifikasi otomatis untuk abnormal pressure dan
 * rapid material degradation, dipindai dari seluruh ban unit DT001.
 *
 * Data dibaca dari services/tyreData.js.
 *
 * Lokasi file: src/features/alerts/Alerts.jsx
 */

import { fleet, TyreStatus } from "../../services/tyreData";

// ─────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────

const STATUS_META = {
  [TyreStatus.NORMAL]: { label: "Normal", solid: "#1A7A4A", soft: "#E8F5EE", text: "#1A7A4A" },
  [TyreStatus.WARNING]: { label: "Warning", solid: "#E0A526", soft: "#FDF3E0", text: "#B8790E" },
  [TyreStatus.CRITICAL]: { label: "Critical", solid: "#C84B31", soft: "#FBEAE6", text: "#C84B31" },
};

function pressureStatus(psi) {
  if (psi < 90) return TyreStatus.CRITICAL;
  if (psi < 100) return TyreStatus.WARNING;
  return TyreStatus.NORMAL;
}
function degradationStatus(pct) {
  if (pct >= 40) return TyreStatus.CRITICAL;
  if (pct >= 25) return TyreStatus.WARNING;
  return TyreStatus.NORMAL;
}

// ─────────────────────────────────────────────
// SMART ALERT GENERATOR — dipindai dari seluruh ban unit
// ─────────────────────────────────────────────

function generateSmartAlerts(unit) {
  const alerts = [];

  unit.tyres.forEach((tyre) => {
    const pStatus = pressureStatus(tyre.pressurePsi);
    if (pStatus !== TyreStatus.NORMAL) {
      alerts.push({
        id: `${tyre.id}-pressure`,
        type: "Abnormal Pressure",
        tyre,
        severity: pStatus,
        message: `Tekanan ban ${tyre.id} (${tyre.position}) tercatat ${tyre.pressurePsi} PSI — di bawah rentang normal 95–105 PSI.`,
      });
    }

    const dStatus = degradationStatus(tyre.materialDegradationPct);
    if (dStatus !== TyreStatus.NORMAL) {
      alerts.push({
        id: `${tyre.id}-degradation`,
        type: "Rapid Material Degradation",
        tyre,
        severity: dStatus,
        message: `Degradasi material kimia ban ${tyre.id} (${tyre.position}) mencapai ${tyre.materialDegradationPct}% — melewati ambang batas aman.`,
      });
    }
  });

  const severityRank = { [TyreStatus.CRITICAL]: 0, [TyreStatus.WARNING]: 1, [TyreStatus.NORMAL]: 2 };
  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

// ─────────────────────────────────────────────
// UI PRIMITIVES
// ─────────────────────────────────────────────

function Pill({ status, className = "" }) {
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

function IconAlertTriangle({ className, color }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L2.5 15.5H17.5L10 2Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <line x1="10" y1="8.5" x2="10" y2="12" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.8" fill={color} />
    </svg>
  );
}

function SmartAlertCard({ alert }) {
  const meta = STATUS_META[alert.severity];
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#EEF3F0] p-4">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: meta.soft }}
      >
        <IconAlertTriangle className="w-4 h-4" color={meta.text} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-[#0B3B2D] text-[13px] font-bold leading-tight">{alert.type}</p>
          <Pill status={alert.severity} />
        </div>
        <p className="text-[#6B8F7A] text-[12px] leading-snug">{alert.message}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ALERTS — root component
// ─────────────────────────────────────────────

export default function Alerts() {
  const unit = fleet.find((u) => u.unitId === "DT001") ?? fleet[0];

  if (!unit || unit.tyres.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-8 text-center">
        <p className="text-[#6B8F7A] text-sm">Belum ada data ban untuk dipindai.</p>
      </div>
    );
  }

  const alerts = generateSmartAlerts(unit);
  const criticalCount = alerts.filter((a) => a.severity === TyreStatus.CRITICAL).length;

  return (
    <div className="flex flex-col gap-5">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-1">
            Alerts
          </p>
          <h2 className="text-[#0B3B2D] text-lg font-bold tracking-tight">
            {unit.name} <span className="text-[#6B8F7A] font-medium text-sm">({unit.unitId})</span>
          </h2>
          <p className="text-[#6B8F7A] text-[12px] mt-1">
            {unit.site} · Segmen {unit.segment}
          </p>
        </div>
        {criticalCount > 0 && (
          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-[#FBEAE6] text-[#C84B31]">
            {criticalCount} Critical Alerts Active
          </span>
        )}
      </div>

      {/* ── SMART ALERTS ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-4">
          Smart Alerts
        </p>
        {alerts.length === 0 ? (
          <p className="text-[#6B8F7A] text-[12.5px] py-2">
            Tidak ada anomali tekanan atau degradasi terdeteksi saat ini.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {alerts.map((alert) => (
              <SmartAlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
