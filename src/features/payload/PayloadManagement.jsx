/**
 * TyreMind MVP — Payload Hauler
 * Chemical Aware AI Tyre Intelligence System
 *
 * Menjawab tantangan bisnis "Optimalisasi Payload Hauler HD785":
 * - Payload Utilization tiap ritase vs rated payload HD785-7 (91 ton)
 * - Klasifikasi Underload / Optimal / Overload per ritase
 * - Dampak: underload → estimasi ritase tambahan (produktivitas turun),
 *   overload → paparan risiko (kerusakan unit, ban, keselamatan kerja)
 *
 * Seluruh angka dihitung dari services/tyreData.js (payloadCycles) oleh
 * services/payloadModel.js — tidak ada nilai statis di komponen ini.
 *
 * Lokasi file: src/features/payload/PayloadManagement.jsx
 */

import { useState } from "react";
import { fleet, payloadCycles } from "../../services/tyreData";
import { analyzePayloadCycles } from "../../services/payloadModel";

// ─────────────────────────────────────────────
// THEME — selaras dengan Operator.jsx / komponen lain
// ─────────────────────────────────────────────

const CLASS_META = {
  UNDERLOAD: { label: "Underload", solid: "#3B82C4", soft: "#E9F1FA", text: "#2E6699" },
  OPTIMAL: { label: "Optimal", solid: "#1A7A4A", soft: "#E8F5EE", text: "#1A7A4A" },
  OVERLOAD: { label: "Overload", solid: "#C84B31", soft: "#FBEAE6", text: "#C84B31" },
};

function complianceStatusMeta(score) {
  if (score >= 70) return { label: "Good", solid: "#1A7A4A", soft: "#E8F5EE", text: "#1A7A4A" };
  if (score >= 45) return { label: "Warning", solid: "#E0A526", soft: "#FDF3E0", text: "#B8790E" };
  return { label: "Critical", solid: "#C84B31", soft: "#FBEAE6", text: "#C84B31" };
}

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

function KpiCard({ label, value, unit, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
      <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em] mb-2">{label}</p>
      <p className="text-[#0B3B2D] text-2xl font-bold tracking-tight leading-none">
        {value}
        {unit && <span className="text-[13px] font-semibold text-[#8FA89A] ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-[#6B8F7A] text-[10.5px] mt-1.5">{sub}</p>}
    </div>
  );
}

function CircularScoreGauge({ score, size = 64, strokeWidth = 7 }) {
  const meta = complianceStatusMeta(score);
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
// GRAFIK — payload tiap ritase vs rated payload & tolerance band
// ─────────────────────────────────────────────

function PayloadCycleChart({ details, ratedTon, toleranceMinTon, toleranceMaxTon, selectedCycleId, onSelectCycle }) {
  const width = 640;
  const height = 220;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxTon = Math.max(toleranceMaxTon, ...details.map((d) => d.loadedTon)) + 8;
  const barGap = 8;
  const barW = (plotW - barGap * (details.length - 1)) / details.length;

  const yAt = (ton) => padT + plotH - (ton / maxTon) * plotH;
  const upperBoundTon = toleranceMaxTon;
  const lowerBoundTon = toleranceMinTon;

  return (
    <div className="rounded-xl bg-[#F4F7F5] p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
        {/* Sumbu Y — garis bantu tiap 20 ton */}
        {Array.from({ length: Math.ceil(maxTon / 20) + 1 }, (_, i) => i * 20).map((tick) => (
          <g key={tick}>
            <line x1={padL} y1={yAt(tick)} x2={width - padR} y2={yAt(tick)} stroke="#E8EDE9" strokeWidth="1" />
            <text x={padL - 6} y={yAt(tick) + 3} textAnchor="end" fontSize="9" fill="#8FA89A">
              {tick}
            </text>
          </g>
        ))}

        {/* Pita toleransi (optimal band) */}
        <rect
          x={padL}
          y={yAt(upperBoundTon)}
          width={plotW}
          height={yAt(lowerBoundTon) - yAt(upperBoundTon)}
          fill="#1A7A4A"
          opacity={0.08}
        />

        {/* Garis rated payload */}
        <line x1={padL} y1={yAt(ratedTon)} x2={width - padR} y2={yAt(ratedTon)} stroke="#0B3B2D" strokeWidth="1.3" strokeDasharray="4 3" />
        <text x={width - padR} y={yAt(ratedTon) - 4} textAnchor="end" fontSize="9" fill="#0B3B2D">
          Rated {ratedTon} ton
        </text>

        {/* Bar per ritase */}
        {details.map((d, idx) => {
          const meta = CLASS_META[d.payloadClass];
          const x = padL + idx * (barW + barGap);
          const y = yAt(d.loadedTon);
          const barH = padT + plotH - y;
          const isSelected = selectedCycleId === d.cycleId;
          return (
            <g key={d.cycleId} onClick={() => onSelectCycle(d.cycleId)} className="cursor-pointer">
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, barH)}
                rx={3}
                fill={meta.solid}
                opacity={isSelected ? 1 : 0.85}
                stroke={isSelected ? "#0B3B2D" : "none"}
                strokeWidth={isSelected ? 1.5 : 0}
              />
              <text x={x + barW / 2} y={height - 10} textAnchor="middle" fontSize="8.5" fill="#8FA89A">
                {d.timeLabel}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-2 px-1">
        {Object.entries(CLASS_META).map(([key, meta]) => (
          <span key={key} className="flex items-center gap-1.5 text-[10px] text-[#6B8F7A] font-medium">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.solid }} />
            {meta.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[10px] text-[#6B8F7A] font-medium">
          <span className="w-3 h-1 rounded-full flex-shrink-0 bg-[#0B3B2D]" style={{ opacity: 0.6 }} />
          Rated payload
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DAFTAR RITASE
// ─────────────────────────────────────────────

function CycleRow({ detail, isSelected, onSelect }) {
  const meta = CLASS_META[detail.payloadClass];
  return (
    <button
      type="button"
      onClick={() => onSelect(detail.cycleId)}
      className={[
        "w-full text-left rounded-xl py-2.5 px-3 transition-colors duration-150 flex items-center justify-between gap-3",
        isSelected ? "bg-[#F4F7F5]" : "hover:bg-[#F4F7F5]",
      ].join(" ")}
    >
      <div className="min-w-0">
        <p className="text-[#0B3B2D] text-[12.5px] font-semibold leading-tight">
          {detail.cycleId} <span className="text-[#8FA89A] font-medium">· {detail.timeLabel}</span>
        </p>
        <p className="text-[#6B8F7A] text-[11px] leading-tight mt-0.5 truncate">{detail.material}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-[#0B3B2D] text-[12.5px] font-bold leading-tight">{detail.loadedTon} ton</p>
          <p className="text-[#8FA89A] text-[10.5px] leading-tight">{detail.utilizationPct}%</p>
        </div>
        <Pill meta={meta} />
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// PAYLOAD MANAGEMENT — root component
// ─────────────────────────────────────────────

export default function PayloadManagement() {
  const [selectedCycleId, setSelectedCycleId] = useState(null);
  const unit = fleet[0];

  if (!unit || !payloadCycles?.length) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-8 text-center">
        <p className="text-[#6B8F7A] text-sm">Belum ada data ritase untuk ditampilkan.</p>
      </div>
    );
  }

  const analysis = analyzePayloadCycles(payloadCycles, unit.ratedPayloadTon, unit.payloadToleranceMinTon, unit.payloadToleranceMaxTon);
  const complianceMeta = complianceStatusMeta(analysis.complianceScorePct);

  function handleSelect(cycleId) {
    setSelectedCycleId((prev) => (prev === cycleId ? null : cycleId));
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-1">Payload Hauler</p>
        <h2 className="text-[#0B3B2D] text-lg font-bold tracking-tight">
          Optimalisasi Payload — {unit.type}
        </h2>
        <p className="text-[#6B8F7A] text-[12px] mt-1">
          Rated payload pabrikan {unit.ratedPayloadTon} ton. Underload menambah jumlah ritase untuk tonase yang
          sama; overload menambah risiko kerusakan unit, ban, dan keselamatan kerja.
        </p>
      </div>

      {/* ── KPI ROW ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Avg. Utilization"
          value={analysis.avgUtilizationPct}
          unit="%"
          sub={`dari rated ${analysis.ratedTon} ton`}
        />
        <KpiCard
          label="Underload"
          value={analysis.underloadFreqPct}
          unit="%"
          sub={`${analysis.underloadCount} dari ${analysis.totalCycles} ritase`}
        />
        <KpiCard
          label="Overload"
          value={analysis.overloadFreqPct}
          unit="%"
          sub={`${analysis.overloadCount} dari ${analysis.totalCycles} ritase`}
        />
        <KpiCard
          label="Total Tonase Hari Ini"
          value={analysis.totalTonHauled}
          unit="ton"
          sub={`${analysis.totalCycles} ritase tercatat`}
        />
      </div>

      {/* ── PAYLOAD COMPLIANCE + CHART (kiri) & DETAIL RITASE (kanan) ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* KIRI — Compliance score, chart, keterangan chart */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em]">
                Payload Compliance Score
              </p>
              <Pill meta={complianceMeta} />
            </div>

            <div className="flex items-center gap-4 mb-5 pb-5 border-b border-[#EEF3F0]">
              <CircularScoreGauge score={analysis.complianceScorePct} />
              <div className="min-w-0">
                <p className="text-[#0B3B2D] text-[12.5px] font-semibold leading-tight">
                  {analysis.optimalCount} dari {analysis.totalCycles} ritase berada dalam pita toleransi ±
                  {analysis.toleranceMinTon}–{analysis.toleranceMaxTon} ton (toleransi operasional situs).
                </p>
                <p className="text-[#8FA89A] text-[11px] leading-tight mt-1">
                  Pita toleransi adalah asumsi ilustratif praktik umum industri — sesuaikan dengan SOP payload situs.
                </p>
              </div>
            </div>

            <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em] mb-2">
              Payload per Ritase — Hari Ini
            </p>
            <PayloadCycleChart
              details={analysis.details}
              ratedTon={analysis.ratedTon}
              toleranceMinTon={analysis.toleranceMinTon}
              toleranceMaxTon={analysis.toleranceMaxTon}
              selectedCycleId={selectedCycleId}
              onSelectCycle={handleSelect}
            />
            <p className="text-[#8FA89A] text-[10px] mt-2">
              Klik salah satu batang untuk menyorot ritase yang sama di daftar detail di samping.
            </p>
          </div>

          {/* KANAN — Detail ritase */}
          <div>
            <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em] mb-3">
              Detail Ritase ({analysis.totalCycles})
            </p>
            <div className="flex flex-col gap-1">
              {analysis.details.map((detail) => (
                <CycleRow
                  key={detail.cycleId}
                  detail={detail}
                  isSelected={selectedCycleId === detail.cycleId}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── DAMPAK PRODUKTIVITAS & RISIKO ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#E9F1FA] p-4">
          <p className="text-[#2E6699] text-[11.5px] font-bold uppercase tracking-[0.04em] mb-1">
            Dampak Underload
          </p>
          <p className="text-[#2E6699] text-[12.5px] leading-snug">
            {analysis.lostCapacityTon} ton kapasitas hilang dari {analysis.underloadCount} ritase underload — setara
            estimasi <strong>+{analysis.estimatedExtraTripsFromUnderload}</strong> ritase tambahan untuk mengangkut
            tonase yang sama.
          </p>
        </div>
        <div className="rounded-xl bg-[#FBEAE6] p-4">
          <p className="text-[#C84B31] text-[11.5px] font-bold uppercase tracking-[0.04em] mb-1">
            Paparan Risiko Overload
          </p>
          <p className="text-[#C84B31] text-[12.5px] leading-snug">
            Total <strong>{analysis.overloadExcessTon} ton</strong> kelebihan beban dari {analysis.overloadCount}{" "}
            ritase overload — menambah tekanan mekanis pada ban & struktur unit, serta risiko keselamatan kerja.
          </p>
        </div>
      </div>

      {/* ── CATATAN METODOLOGI ── */}
      <div className="rounded-xl bg-[#FDF3E0] px-4 py-3">
        <p className="text-[#B8790E] text-[11px] font-bold">Catatan metodologi</p>
        <p className="text-[#B8790E]/90 text-[10.5px] mt-1 leading-snug">
          Estimasi ritase tambahan adalah proyeksi linear sederhana (ton hilang ÷ rated payload), belum
          memperhitungkan cycle time/jarak aktual per ritase. Belum ada estimasi biaya (BBM, maintenance) karena
          data unit-cost belum terintegrasi. Lihat services/payloadModel.js untuk detail asumsi.
        </p>
      </div>
    </div>
  );
}