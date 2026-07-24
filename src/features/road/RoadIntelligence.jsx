/**
 * TyreMind MVP — Road Intelligence
 * Chemical Aware AI Tyre Intelligence System
 *
 * Satu file, tiga bagian:
 *   1. Road Risk Score — ringkasan skor rata-rata + segmen paling berbahaya.
 *   2. Peta Jalur Haul Road — peta bergaya "mode menyetir", jalur yang
 *      dilewati DT001 diwarnai per risiko segmen, jalur lain abu-abu.
 *      Ukuran dibuat landscape & ringkas supaya muat 1 layar tanpa scroll.
 *   3. Detail Segmen — TIDAK selalu tampil. Muncul sebagai panel di
 *      samping peta HANYA saat sebuah segmen diklik (di peta atau di
 *      chip cepat di bawah peta). Klik lagi / tombol tutup untuk
 *      menyembunyikan lagi.
 *
 * Data dari services/tyreData.js (roadSegments).
 *
 * Lokasi file: src/features/road/RoadIntelligence.jsx
 */

import { useState } from "react";
import { fleet, roadSegments, payloadCycles, RoadSegmentRisk } from "../../services/tyreData";
import { analyzeCycleTimeForCycles, CYCLE_STAGES } from "../../services/payloadModel";

// ─────────────────────────────────────────────
// THEME — skor TINGGI = BERBAHAYA (merah)
// ─────────────────────────────────────────────

const ROAD_RISK_META = {
  [RoadSegmentRisk.HIGH]: { label: "High Risk", solid: "#C84B31", soft: "#FBEAE6", text: "#C84B31" },
  [RoadSegmentRisk.MEDIUM]: { label: "Medium Risk", solid: "#E0A526", soft: "#FDF3E0", text: "#B8790E" },
  [RoadSegmentRisk.LOW]: { label: "Low Risk", solid: "#1A7A4A", soft: "#E8F5EE", text: "#1A7A4A" },
};

const UNTRAVELED_COLOR = "#C7D2CB";

// Palet warna per tahap cycle time — urut sesuai CYCLE_STAGES di payloadModel.js
const STAGE_COLORS = {
  queueMinutes: "#C84B31",
  spottingMinutes: "#E0A526",
  loadingMinutes: "#3B82C4",
  haulingLoadedMinutes: "#0B3B2D",
  dumpingMinutes: "#8B5CF6",
  returnEmptyMinutes: "#1A7A4A",
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

function CircularScoreGauge({ score, size = 76, strokeWidth = 8, meta }) {
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
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[#0B3B2D] text-base font-bold leading-none">{score}</span>
        <span className="text-[#8FA89A] text-[8px] font-medium leading-none mt-0.5">/100</span>
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────
// GRAFIK GETARAN — sintetis, diturunkan dari riskScore segmen.
// Bukan data sensor akselerometer sungguhan (belum ada di tyreData.js);
// amplitudo & frekuensi gelombang dibuat deterministik dari riskScore +
// id segmen (bukan acak tiap render) supaya konsisten dan mudah diganti
// dengan data getaran nyata nanti. Warna mengikuti warna risiko segmen
// yang sudah ada (merah = risiko/getaran tinggi, hijau = rendah).
// ─────────────────────────────────────────────

function seededRandom(seedStr) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) hash = (hash * 31 + seedStr.charCodeAt(i)) % 2147483647;
  return () => {
    hash = (hash * 16807) % 2147483647;
    return (hash - 1) / 2147483646;
  };
}

function buildVibrationPath(riskScore, seedStr, width = 260, height = 56) {
  const rand = seededRandom(seedStr);
  const baseline = height / 2;
  const amplitude = 3 + (riskScore / 100) * (baseline - 6); // makin tinggi risiko, makin liar
  const freq = 0.25 + (riskScore / 100) * 0.55; // makin tinggi risiko, makin rapat osilasinya
  const points = [];
  const steps = 70;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const t = i / steps;
    const noise = (rand() - 0.5) * amplitude * 0.6;
    const y =
      baseline +
      Math.sin(t * Math.PI * 2 * freq * 6) * amplitude * 0.7 +
      Math.sin(t * Math.PI * 2 * freq * 13 + 1.3) * amplitude * 0.3 +
      noise;
    points.push(`${x.toFixed(1)},${Math.max(2, Math.min(height - 2, y)).toFixed(1)}`);
  }
  return `M${points.join(" L")}`;
}

function VibrationChart({ segment }) {
  const meta = ROAD_RISK_META[segment.riskLevel];
  const width = 260;
  const height = 56;
  const path = buildVibrationPath(segment.riskScore, segment.id, width, height);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[#6B8F7A] text-[10.5px] font-semibold uppercase tracking-[0.06em]">
          Estimasi Getaran Jalur
        </span>
        <span className="text-[10px] font-medium" style={{ color: meta.text }}>
          {segment.riskLevel === RoadSegmentRisk.HIGH
            ? "Tinggi"
            : segment.riskLevel === RoadSegmentRisk.MEDIUM
            ? "Sedang"
            : "Rendah"}
        </span>
      </div>
      <div className="rounded-xl bg-[#F4F7F5] p-2.5">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#E0EAE3" strokeWidth="1" />
          <path d={path} fill="none" stroke={meta.solid} strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-[#8FA89A] text-[9.5px] mt-1">
        Estimasi kualitatif dari skor risiko segmen, belum diambil dari sensor akselerometer sungguhan.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// POPUP DAFTAR INSIDEN — detail kejadian per segmen
// ─────────────────────────────────────────────

function formatTanggalID(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

const INCIDENT_WINDOW_DAYS = 7;
const INCIDENT_WINDOW_END_DATE = new Date("2026-07-27T00:00:00");

// Filter insiden ke jendela waktu 7 hari terakhir yang berakhir pada
// tanggal referensi tetap 27 Juli 2026, supaya count di kartu segmen &
// daftar di modal selalu konsisten dengan dataset yang sudah diset.
function getRecentIncidents(incidents, windowDays = INCIDENT_WINDOW_DAYS) {
  const end = new Date(INCIDENT_WINDOW_END_DATE);
  const cutoff = new Date(end);
  cutoff.setDate(end.getDate() - windowDays);

  return (incidents ?? []).filter((i) => {
    const incidentDate = new Date(i.date + "T00:00:00");
    return incidentDate >= cutoff && incidentDate <= end;
  });
}

function IncidentListModal({ segment, onClose }) {
  const incidents = getRecentIncidents(segment.incidents);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[#EEF3F0]">
          <div>
            <p className="text-[#6B8F7A] text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-1">
              Insiden Terkait Ban
            </p>
            <h3 className="text-[#0B3B2D] text-base font-bold tracking-tight">
              {segment.name} · 7 Hari Terakhir
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

        <div className="p-5 flex flex-col gap-3">
          {incidents.length === 0 ? (
            <p className="text-[#6B8F7A] text-[12.5px]">Tidak ada insiden tercatat di segmen ini.</p>
          ) : (
            incidents.map((incident, idx) => (
              <div key={idx} className="flex gap-3 rounded-xl border border-[#EEF3F0] p-3.5">
                <div className="w-1.5 rounded-full bg-[#C84B31] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[#0B3B2D] text-[11.5px] font-bold mb-1">{formatTanggalID(incident.date)}</p>
                  <p className="text-[#6B8F7A] text-[12px] leading-snug">{incident.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Badge nama segmen yang ditempel di atas jalurnya di peta
function SegmentBadge({ x, y, seg, isSelected, onClick }) {
  const meta = ROAD_RISK_META[seg.riskLevel];
  const shortName = seg.name.replace("Segmen ", "");
  return (
    <g
      transform={`translate(${x - 34}, ${y - 13})`}
      onClick={() => onClick(seg.id)}
      style={{ cursor: "pointer" }}
    >
      <rect
        width="68"
        height="26"
        rx="13"
        fill={isSelected ? meta.solid : "#0B3B2D"}
        stroke={isSelected ? "#ffffff" : "none"}
        strokeWidth={isSelected ? 2 : 0}
      />
      <circle cx="16" cy="13" r="4" fill={isSelected ? "#ffffff" : meta.solid} />
      <text x="38" y="17" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff">
        {shortName} · {seg.riskScore}
      </text>
    </g>
  );
}

// ─────────────────────────────────────────────
// DETAIL PANEL — cuma tampil kalau ada segmen terpilih
// ─────────────────────────────────────────────

function SegmentDetailPanel({ segment, onClose, onOpenIncidents }) {
  const meta = ROAD_RISK_META[segment.riskLevel];
  const recentIncidents = getRecentIncidents(segment.incidents);
  const hasIncidents = recentIncidents.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm h-fit">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-[#6B8F7A] text-[10.5px] font-semibold uppercase tracking-[0.06em] mb-1">
            Detail Segmen
          </p>
          <h3 className="text-[#0B3B2D] text-base font-bold tracking-tight">{segment.name}</h3>
          <p className="text-[#6B8F7A] text-[11.5px] mt-0.5">{segment.surfaceCondition}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Tutup detail segmen"
          className="w-6 h-6 rounded-full flex items-center justify-center text-[#8FA89A] hover:bg-[#F4F7F5] hover:text-[#0B3B2D] flex-shrink-0"
        >
          ✕
        </button>
      </div>

      <Pill meta={meta} className="mb-6" />

      <div className="mt-1">
        <ScoreBar value={segment.riskScore} colorSolid={meta.solid} trackClassName="h-1.5" />
      </div>
      <div className="flex items-center justify-between mt-1.5 mb-4">
        <span className="text-[#8FA89A] text-[10.5px]">Road Risk Score</span>
        <span className="text-[#0B3B2D] text-[12px] font-bold">{segment.riskScore}/100</span>
      </div>

      <p className="text-[#0B3B2D] text-[12.5px] leading-relaxed mb-4">{segment.tyreImpactNote}</p>

      <div className="mb-4">
        <VibrationChart segment={segment} />
      </div>

      {hasIncidents ? (
        <button
          type="button"
          onClick={() => onOpenIncidents(segment)}
          className="text-[#C84B31] text-[11px] font-semibold underline decoration-dotted underline-offset-2 hover:text-[#A83B24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C84B31] rounded"
        >
          {recentIncidents.length} insiden terkait ban dalam 7 hari terakhir
        </button>
      ) : (
        <p className="text-[#1A7A4A] text-[11px] font-semibold">Tidak ada insiden dalam 7 hari terakhir</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PETA JALUR HAUL ROAD — landscape, ringkas, klikable
// ─────────────────────────────────────────────

function HaulRoadMap({ segments, selectedId, onSelect }) {
  const [seg1, seg2, seg3] = segments;
  if (!seg1 || !seg2 || !seg3) return null;

  // Jalur utama (dilewati DT001) — landscape, viewBox pendek biar ringkas.
  const pathA1 = "M50,250 C120,265 145,195 230,210";
  const pathA2 = "M230,210 C300,228 335,155 460,130";
  const pathA3 = "M460,130 C560,110 615,72 760,50";

  const centerLine =
    "M50,250 C120,265 145,195 230,210 C300,228 335,155 460,130 C560,110 615,72 760,50";

  const segByPath = [
    { seg: seg1, d: pathA1 },
    { seg: seg2, d: pathA2 },
    { seg: seg3, d: pathA3 },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em]">
          Peta Jalur Haul Road — Unit DT001
        </p>
        <div className="flex items-center gap-3 text-[10px] font-medium text-[#6B8F7A]">
          <LegendDot color={ROAD_RISK_META[RoadSegmentRisk.LOW].solid} label="Low" />
          <LegendDot color={ROAD_RISK_META[RoadSegmentRisk.MEDIUM].solid} label="Medium" />
          <LegendDot color={ROAD_RISK_META[RoadSegmentRisk.HIGH].solid} label="High" />
          <LegendDot color={UNTRAVELED_COLOR} label="Jalur lain" />
        </div>
      </div>

      <svg
        viewBox="0 0 820 290"
        className="w-full h-auto max-h-[320px]"
        role="img"
        aria-label="Peta jalur haul road yang dilewati unit DT001, klik segmen untuk detail"
      >
        {/* ── JALUR LAIN — tidak dilewati DT001, abu-abu ── */}
        <path d="M170,205 C150,170 100,158 60,120" fill="none" stroke={UNTRAVELED_COLOR} strokeWidth="7" strokeLinecap="round" />
        <path d="M345,158 C380,190 420,220 400,258" fill="none" stroke={UNTRAVELED_COLOR} strokeWidth="7" strokeLinecap="round" />
        <path d="M600,78 C578,50 548,30 566,6" fill="none" stroke={UNTRAVELED_COLOR} strokeWidth="6" strokeLinecap="round" />
        <circle cx="60" cy="120" r="3.5" fill={UNTRAVELED_COLOR} />
        <circle cx="400" cy="258" r="3.5" fill={UNTRAVELED_COLOR} />
        <circle cx="566" cy="6" r="3.5" fill={UNTRAVELED_COLOR} />

        {/* ── JALUR UTAMA — dilewati DT001, klikable, diwarnai per risiko ── */}
        {segByPath.map(({ seg, d }) => {
          const meta = ROAD_RISK_META[seg.riskLevel];
          const isSelected = seg.id === selectedId;
          return (
            <path
              key={seg.id}
              d={d}
              fill="none"
              stroke={meta.solid}
              strokeWidth={isSelected ? 18 : 13}
              strokeLinecap="round"
              onClick={() => onSelect(seg.id)}
              style={{ cursor: "pointer", transition: "stroke-width 0.15s ease" }}
              opacity={selectedId && !isSelected ? 0.55 : 1}
            />
          );
        })}

        {/* Garis tengah putih putus-putus, gaya navigasi peta */}
        <path
          d={centerLine}
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.6"
          strokeDasharray="8 9"
          strokeLinecap="round"
          opacity="0.55"
          style={{ pointerEvents: "none" }}
        />

        {/* Titik awal (loading point) & akhir (dumping point) */}
        <circle cx="50" cy="250" r="6.5" fill="#0B3B2D" stroke="#fff" strokeWidth="2" />
        <text x="50" y="272" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0B3B2D">
          Loading Point
        </text>
        <circle cx="760" cy="50" r="6.5" fill="#0B3B2D" stroke="#fff" strokeWidth="2" />
        <text x="760" y="32" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0B3B2D">
          Dumping Point
        </text>

        {/* Label tiap segmen — klikable juga */}
        <SegmentBadge x={135} y={238} seg={seg1} isSelected={seg1.id === selectedId} onClick={onSelect} />
        <SegmentBadge x={330} y={172} seg={seg2} isSelected={seg2.id === selectedId} onClick={onSelect} />
        <SegmentBadge x={585} y={80} seg={seg3} isSelected={seg3.id === selectedId} onClick={onSelect} />

        {/* Marker posisi unit DT001 */}
        <g transform="translate(170,207)" style={{ pointerEvents: "none" }}>
          <circle r="10" fill="none" stroke={ROAD_RISK_META[seg1.riskLevel].solid} strokeWidth="2" opacity="0.35" />
          <circle r="6" fill="#0B3B2D" />
          <circle r="6" fill="none" stroke="#4ADE80" strokeWidth="2" />
        </g>
        <text x="170" y="196" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0B3B2D" style={{ pointerEvents: "none" }}>
          DT001
        </text>
      </svg>

      <p className="text-[#8FA89A] text-[10.5px] mt-2">
        Klik jalur berwarna atau label segmen untuk melihat detail. Jalur abu-abu adalah cabang haul road
        lain yang tidak dilewati unit ini.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// CYCLE TIME HAULER — waktu edar 1 ritase, 6 tahapan
// ─────────────────────────────────────────────

function CycleTimeKpi({ label, value, unit, sub, tone = "default" }) {
  const toneColor = tone === "bad" ? "#C84B31" : tone === "good" ? "#1A7A4A" : "#0B3B2D";
  return (
    <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
      <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em] mb-2">{label}</p>
      <p className="text-2xl font-bold tracking-tight leading-none" style={{ color: toneColor }}>
        {value}
        {unit && <span className="text-[13px] font-semibold text-[#8FA89A] ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-[#6B8F7A] text-[10.5px] mt-1.5">{sub}</p>}
    </div>
  );
}

function StageStackedBar({ avgStageMinutes, totalMinutes, height = 34 }) {
  return (
    <div>
      <div className="w-full flex rounded-lg overflow-hidden" style={{ height }}>
        {avgStageMinutes.map((stage) => {
          const widthPct = totalMinutes > 0 ? (stage.avgActualMinutes / totalMinutes) * 100 : 0;
          return (
            <div
              key={stage.key}
              style={{ width: `${widthPct}%`, backgroundColor: STAGE_COLORS[stage.key] }}
              className="h-full flex items-center justify-center transition-all duration-200"
              title={`${stage.label}: ${stage.avgActualMinutes} min`}
            >
              {widthPct > 9 && (
                <span className="text-white text-[9.5px] font-bold leading-none px-0.5 truncate">
                  {stage.avgActualMinutes}m
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {avgStageMinutes.map((stage) => (
          <span key={stage.key} className="flex items-center gap-1.5 text-[10.5px] text-[#6B8F7A] font-medium">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STAGE_COLORS[stage.key] }} />
            {stage.shortLabel}
            <span
              className="font-semibold"
              style={{ color: stage.deviationMinutes > 0.4 ? "#C84B31" : "#8FA89A" }}
            >
              {stage.avgActualMinutes}m
              {stage.deviationMinutes > 0.4 ? ` (+${stage.deviationMinutes})` : ""}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function CycleTimeRow({ cycle }) {
  const meta = { solid: STAGE_COLORS[cycle.bottleneckStage.key] };
  const isOverTarget = cycle.deviationMinutes > 0;
  return (
    <div className="w-full rounded-xl py-2.5 px-3 flex items-center justify-between gap-3 hover:bg-[#F4F7F5] transition-colors duration-150">
      <div className="min-w-0">
        <p className="text-[#0B3B2D] text-[12.5px] font-semibold leading-tight">
          {cycle.cycleId} <span className="text-[#8FA89A] font-medium">· {cycle.timeLabel}</span>
        </p>
        <p className="text-[11px] leading-tight mt-0.5" style={{ color: meta.solid }}>
          Bottleneck: {cycle.bottleneckStage.shortLabel}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[#0B3B2D] text-[12.5px] font-bold leading-tight">{cycle.totalMinutes} min</p>
        <p className="text-[10.5px] leading-tight" style={{ color: isOverTarget ? "#C84B31" : "#1A7A4A" }}>
          {isOverTarget ? "+" : ""}
          {cycle.deviationMinutes} min vs target
        </p>
      </div>
    </div>
  );
}

function CycleTimeSection({ cycles }) {
  if (!cycles?.length) return null;
  const analysis = analyzeCycleTimeForCycles(cycles);

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-1">
          Management Cycle Time Hauler
        </p>
        <h2 className="text-[#0B3B2D] text-lg font-bold tracking-tight">Round Trip 1 Ritase</h2>
        <p className="text-[#6B8F7A] text-[12px] mt-1">
          Queue → Spotting → Loading → Hauling (Loaded) → Dumping → Return (Empty). Dibandingkan dengan target
          waktu per tahap untuk mengidentifikasi bottleneck.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CycleTimeKpi
          label="Avg. Cycle Time"
          value={analysis.avgTotalMinutes}
          unit="min"
          sub={`target ${analysis.targetTotalMinutes} min`}
          tone={analysis.avgDeviationMinutes > 0 ? "bad" : "good"}
        />
        <CycleTimeKpi
          label="Deviasi vs Target"
          value={`${analysis.avgDeviationMinutes > 0 ? "+" : ""}${analysis.avgDeviationMinutes}`}
          unit="min"
          sub="rata-rata per ritase"
          tone={analysis.avgDeviationMinutes > 0 ? "bad" : "good"}
        />
        <CycleTimeKpi
          label="Bottleneck Tersering"
          value={analysis.mostFrequentBottleneck?.shortLabel ?? "-"}
          sub={
            analysis.mostFrequentBottleneck
              ? `+${analysis.mostFrequentBottleneck.deviationMinutes} min vs target`
              : ""
          }
          tone="bad"
        />
        <CycleTimeKpi
          label="Potensi Ritase/Shift"
          value={`+${Math.max(0, analysis.potentialExtraTripsPerShift)}`}
          unit="trip"
          sub={`bila cycle time ditekan ke target`}
          tone="good"
        />
      </div>

      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em] mb-3">
          Rata-rata Waktu per Tahap — Hari Ini
        </p>
        <StageStackedBar avgStageMinutes={analysis.avgStageMinutes} totalMinutes={analysis.avgTotalMinutes} />
        <p className="text-[#8FA89A] text-[10px] mt-3">
          Angka merah = tahap ini melebihi target rata-rata &gt;0.4 menit. Hauling (Loaded) diturunkan dari rute
          ~12 km & profil kecepatan yang sama dengan modul Operator.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em] mb-3">
          Detail Round Trip per Ritase ({analysis.totalCycles})
        </p>
        <div className="flex flex-col gap-1">
          {analysis.perCycle.map((cycle) => (
            <CycleTimeRow key={cycle.cycleId} cycle={cycle} />
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-[#FDF3E0] px-4 py-3">
        <p className="text-[#B8790E] text-[11px] font-bold">Catatan metodologi</p>
        <p className="text-[#B8790E]/90 text-[10.5px] mt-1 leading-snug">
          Target waktu per tahap adalah asumsi ilustratif berbasis rentang wajar operasi excavator-HD785, bukan
          SOP/standard time resmi KPP. Potensi ritase tambahan per shift adalah proyeksi linear (asumsi shift{" "}
          {analysis.shiftMinutes / 60} jam), belum memperhitungkan variasi antrian riil.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ROAD INTELLIGENCE — root component
// ─────────────────────────────────────────────

export default function RoadIntelligence() {
  const unit = fleet.find((u) => u.unitId === "DT001") ?? fleet[0];
  const [selectedId, setSelectedId] = useState(null);
  const [incidentSegment, setIncidentSegment] = useState(null);

  if (!unit || roadSegments.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-8 text-center">
        <p className="text-[#6B8F7A] text-sm">Belum ada data jalur untuk ditampilkan.</p>
      </div>
    );
  }

  const overallRiskScore = Math.round(
    roadSegments.reduce((sum, s) => sum + s.riskScore, 0) / roadSegments.length
  );
  const overallMeta =
    overallRiskScore >= 60
      ? ROAD_RISK_META[RoadSegmentRisk.HIGH]
      : overallRiskScore >= 35
      ? ROAD_RISK_META[RoadSegmentRisk.MEDIUM]
      : ROAD_RISK_META[RoadSegmentRisk.LOW];

  const mostDangerous = [...roadSegments].sort((a, b) => b.riskScore - a.riskScore)[0];

  const selectedSegment = roadSegments.find((s) => s.id === selectedId) ?? null;

  function handleSelect(id) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-1">
          Road Intelligence
        </p>
        <h2 className="text-[#0B3B2D] text-lg font-bold tracking-tight">
          {unit.name} <span className="text-[#6B8F7A] font-medium text-sm">({unit.unitId})</span>
        </h2>
        <p className="text-[#6B8F7A] text-[12px] mt-1">
          Kondisi jalur {unit.site} Segmen {unit.segment} dan dampaknya terhadap ban.
        </p>
      </div>

      {/* ── RINGKASAN ROAD RISK SCORE ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm flex items-center gap-5 flex-wrap">
        <CircularScoreGauge score={overallRiskScore} meta={overallMeta} />
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[#0B3B2D] text-[13px] font-bold">Road Risk Score</p>
            <Pill meta={overallMeta} />
          </div>
          <p className="text-[#6B8F7A] text-[11.5px] leading-snug">
            Rata-rata risiko dari {roadSegments.length} sub-segmen yang dilalui unit {unit.unitId}. Segmen
            paling berbahaya: <strong className="text-[#C84B31]">{mostDangerous.name}</strong> (skor{" "}
            {mostDangerous.riskScore}).
          </p>
        </div>
      </div>

      {/* ── PETA + DETAIL PANEL (kondisional) ── */}
      <div
        className={[
          "grid gap-5 items-start",
          selectedSegment ? "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]" : "grid-cols-1",
        ].join(" ")}
      >
        <HaulRoadMap segments={roadSegments} selectedId={selectedId} onSelect={handleSelect} />
        {selectedSegment && (
          <SegmentDetailPanel
            segment={selectedSegment}
            onClose={() => setSelectedId(null)}
            onOpenIncidents={setIncidentSegment}
          />
        )}
      </div>

      {incidentSegment && (
        <IncidentListModal segment={incidentSegment} onClose={() => setIncidentSegment(null)} />
      )}

      {/* ── MANAGEMENT CYCLE TIME HAULER ── */}
      <CycleTimeSection cycles={payloadCycles} />
    </div>
  );
}