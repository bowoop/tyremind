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
import { hitungDIEIS, estimasiDegradasi, MODEL_META } from "../../services/degradationModel";

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
  if (celsius > 93) return TyreStatus.CRITICAL;
  if (celsius >= 80) return TyreStatus.WARNING;
  return TyreStatus.NORMAL;
}
function degradationStatus(pct) {
  if (pct >= 40) return TyreStatus.CRITICAL;
  if (pct >= 25) return TyreStatus.WARNING;
  return TyreStatus.NORMAL;
}

// ─────────────────────────────────────────────
// SMART ALERTS — kontekstual per-ban (dipindah dari Alerts.jsx,
// sebelumnya menampilkan seluruh ban unit; sekarang hanya alert
// untuk ban yang sedang dipilih di Tyre Monitoring).
// ─────────────────────────────────────────────

function generateTyreAlerts(tyre) {
  const alerts = [];

  const pStatus = pressureStatus(tyre.pressurePsi);
  if (pStatus !== TyreStatus.NORMAL) {
    alerts.push({
      id: `${tyre.id}-pressure`,
      type: "Abnormal Pressure",
      severity: pStatus,
      message: `Tekanan ban tercatat ${tyre.pressurePsi} PSI — di bawah rentang normal 95–105 PSI.`,
    });
  }

  const dStatus = degradationStatus(tyre.materialDegradationPct);
  if (dStatus !== TyreStatus.NORMAL) {
    alerts.push({
      id: `${tyre.id}-degradation`,
      type: "Rapid Material Degradation",
      severity: dStatus,
      message: `Degradasi material kimia mencapai ${tyre.materialDegradationPct}% — melewati ambang batas aman.`,
    });
  }

  const severityRank = { [TyreStatus.CRITICAL]: 0, [TyreStatus.WARNING]: 1, [TyreStatus.NORMAL]: 2 };
  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
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
          <StatusPill status={alert.severity} />
        </div>
        <p className="text-[#6B8F7A] text-[12px] leading-snug">{alert.message}</p>
      </div>
    </div>
  );
}

function TyreSmartAlerts({ tyre }) {
  const alerts = generateTyreAlerts(tyre);

  return (
    <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em]">
          Smart Alerts — {tyre.id}
        </p>
        {alerts.some((a) => a.severity === TyreStatus.CRITICAL) && (
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#FBEAE6] text-[#C84B31]">
            {alerts.filter((a) => a.severity === TyreStatus.CRITICAL).length} Critical
          </span>
        )}
      </div>
      {alerts.length === 0 ? (
        <p className="text-[#6B8F7A] text-[12.5px] py-1">
          Tidak ada anomali tekanan atau degradasi terdeteksi pada ban ini.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <SmartAlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
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
// TRUCK LAYOUT DIAGRAM — tampak atas, 6 posisi ban fisik
// (2 depan + 4 belakang dual/paralel per sisi)
// ─────────────────────────────────────────────

function TruckLayoutDiagram({ tyres, selectedId, onSelect }) {
  const layout = [
    { pos: TyrePosition.FRONT_LEFT, top: "13%", left: "16%" },
    { pos: TyrePosition.FRONT_RIGHT, top: "13%", left: "84%" },
    { pos: TyrePosition.REAR_LEFT_OUTER, top: "83%", left: "8%" },
    { pos: TyrePosition.REAR_LEFT_INNER, top: "83%", left: "30%" },
    { pos: TyrePosition.REAR_RIGHT_INNER, top: "83%", left: "70%" },
    { pos: TyrePosition.REAR_RIGHT_OUTER, top: "83%", left: "92%" },
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

function IconInfo({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.4" />
      <line x1="8" y1="7.2" x2="8" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.9" fill="currentColor" />
    </svg>
  );
}

function SensorRow({ label, value, pct, status, onClick }) {
  const meta = STATUS_META[status];
  const isClickable = typeof onClick === "function";

  const content = (
    <>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-[#6B8F7A] text-[11.5px] font-medium">
          {label}
          {isClickable && <IconInfo className="w-3 h-3 text-[#8FA89A]" />}
        </span>
        <span className="text-[#0B3B2D] text-[13px] font-bold">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-[#EDF3EF] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(4, Math.min(100, pct))}%`, backgroundColor: meta.solid }}
        />
      </div>
    </>
  );

  if (!isClickable) {
    return <div>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg py-1 hover:bg-[#F4F7F5] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A7A4A]"
      aria-haspopup="dialog"
    >
      {content}
    </button>
  );
}

// ─────────────────────────────────────────────
// POPUP VALIDITAS DATA — Degradasi Material
// Menampilkan pipeline: sensor EIS mentah -> DI_EIS -> estimasi AI,
// supaya angka materialDegradationPct bisa ditelusuri validitasnya.
// ─────────────────────────────────────────────

// Posisi marker pada skala log R_ct (0% = Baru/1000Ω, 100% = EOL/10Ω)
function RctScale({ rCtOhm }) {
  const pct = hitungDIEIS(rCtOhm); // 0-100, dipakai murni sebagai posisi visual
  return (
    <div>
      <div className="relative h-2.5 w-full rounded-full overflow-hidden bg-gradient-to-r from-[#1A7A4A] via-[#E0A526] to-[#C84B31]">
        <div
          className="absolute top-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#0B3B2D] shadow"
          style={{ left: `${Math.max(1.5, Math.min(98.5, pct))}%`, transform: "translate(-50%, -50%)" }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[#8FA89A] text-[10px] font-medium">Baru · 1000 Ω</span>
        <span className="text-[#8FA89A] text-[10px] font-medium">End of Life · 10 Ω</span>
      </div>
    </div>
  );
}

function DegradationValidityModal({ tyre, onClose }) {
  const sensor = tyre.eisSensor;

  if (!sensor) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
          <p className="text-[#0B3B2D] text-sm">Data sensor EIS mentah belum tersedia untuk ban ini.</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 rounded-xl bg-[#0B3B2D] text-white text-[13px] font-semibold"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  const { prediksiDegradasiPct } = estimasiDegradasi(sensor.rCtOhm, sensor.nilaiN);
  const selisih = Math.round((prediksiDegradasiPct - tyre.materialDegradationPct) * 100) / 100;
  const konsisten = Math.abs(selisih) <= 2;
  const dStatus = degradationStatus(tyre.materialDegradationPct);
  const meta = STATUS_META[dStatus];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="degradation-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[#EEF3F0]">
          <div>
            <p className="text-[#6B8F7A] text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-1">
              Validitas Data — Degradasi Material
            </p>
            <h3 id="degradation-modal-title" className="text-[#0B3B2D] text-base font-bold tracking-tight">
              Ban {tyre.id} · {tyre.position}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#8FA89A] hover:bg-[#F4F7F5] hover:text-[#0B3B2D] flex-shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Angka utama + cross-check AI dalam satu blok */}
          <div className="rounded-xl p-4" style={{ backgroundColor: meta.soft }}>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: meta.text }}>
                  Nilai di Dashboard
                </p>
                <p className="text-3xl font-bold leading-none" style={{ color: meta.text }}>
                  {tyre.materialDegradationPct}%
                </p>
              </div>
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 flex-shrink-0"
                title="Dihitung dari estimasi model AI berbasis sensor EIS"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: konsisten ? "#1A7A4A" : "#B8790E" }}
                />
                <span className="text-[10.5px] font-bold" style={{ color: konsisten ? "#1A7A4A" : "#B8790E" }}>
                  AI: {prediksiDegradasiPct}% ({selisih > 0 ? "+" : ""}
                  {selisih})
                </span>
              </div>
            </div>
            <p className="text-[11px]" style={{ color: meta.text }}>
              {konsisten
                ? "Konsisten — nilai dashboard cocok dengan estimasi model dari sensor mentah."
                : "Ada selisih dengan estimasi model, perlu ditinjau."}
            </p>
          </div>

          {/* Posisi pada skala sensor */}
          <div>
            <p className="text-[#6B8F7A] text-[10.5px] font-semibold uppercase tracking-[0.06em] mb-2">
              Posisi Sensor (R_ct)
            </p>
            <RctScale rCtOhm={sensor.rCtOhm} />
          </div>

          {/* Sensor mentah — chip compact */}
          <div className="flex gap-2.5">
            <div className="flex-1 rounded-xl bg-[#F4F7F5] px-3.5 py-2.5">
              <p className="text-[#0B3B2D] text-sm font-bold leading-none">{sensor.rCtOhm} Ω</p>
              <p className="text-[#8FA89A] text-[10px] mt-1">R_ct terukur</p>
            </div>
            <div className="flex-1 rounded-xl bg-[#F4F7F5] px-3.5 py-2.5">
              <p className="text-[#0B3B2D] text-sm font-bold leading-none">{sensor.nilaiN}</p>
              <p className="text-[#8FA89A] text-[10px] mt-1">nilai_n (CPE)</p>
            </div>
          </div>

          {/* Metodologi — collapsible, default tertutup */}
          <details className="group rounded-xl border border-[#EEF3F0] open:bg-[#FDF3E0]/40">
            <summary className="list-none flex items-center justify-between px-3.5 py-2.5 cursor-pointer select-none">
              <span className="text-[#6B8F7A] text-[11px] font-semibold">Tentang metodologi & akurasi model</span>
              <span className="text-[#8FA89A] text-[11px] group-open:rotate-180 transition-transform duration-150">
                ▾
              </span>
            </summary>
            <div className="px-3.5 pb-3.5 pt-1">
              <div className="flex gap-4 mb-2">
                <p className="text-[#0B3B2D] text-[11.5px]">
                  MAE <strong>{MODEL_META.maePoinPersen}</strong> poin
                </p>
                <p className="text-[#0B3B2D] text-[11.5px]">
                  R² <strong>{MODEL_META.r2}</strong>
                </p>
              </div>
              <p className="text-[#8FA89A] text-[10.5px] leading-relaxed">{MODEL_META.catatanValiditas}</p>
              <p className="text-[#8FA89A] text-[10.5px] leading-relaxed mt-1.5">
                Data pelatihan: {MODEL_META.dataLatih}.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DETAIL PANEL — ban yang sedang dipilih
// ─────────────────────────────────────────────

function TyreDetailPanel({ tyre, onOpenDegradationValidity }) {
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
            {tyre.remainingUsefulLifeHours.toLocaleString("id-ID")}{" "}
            <span className="text-sm font-medium text-[#6B8F7A]">jam</span>
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
          onClick={() => onOpenDegradationValidity(tyre)}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LIST BAN — semua ban dalam bentuk baris klikable
// ─────────────────────────────────────────────

function TyreListRow({ tyre, isSelected, onSelect }) {
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
            RUL {tyre.remainingUsefulLifeHours.toLocaleString("id-ID")} jam · {tyre.pressurePsi} PSI ·{" "}
            {tyre.temperatureCelcius}°C
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
  const [validityTyre, setValidityTyre] = useState(null);

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

        <TyreDetailPanel
          tyre={selectedTyre}
          onOpenDegradationValidity={setValidityTyre}
        />
      </div>

      {/* ── SMART ALERTS — kontekstual sesuai ban terpilih ── */}
      <TyreSmartAlerts tyre={selectedTyre} />

      {validityTyre && (
        <DegradationValidityModal tyre={validityTyre} onClose={() => setValidityTyre(null)} />
      )}
    </div>
  );
}