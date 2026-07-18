/**
 * TyreMind MVP — Haul Road Map
 * Chemical Aware AI Tyre Intelligence System
 *
 * Peta jalur haul road bergaya "mode menyetir" (mirip Google Maps):
 * - Jalur yang benar-benar dilewati unit DT001 (Segmen A1 → A2 → A3)
 *   digambar tebal & diwarnai sesuai riskLevel tiap segmen (dari
 *   services/tyreData.js — roadSegments).
 * - Jalur/cabang lain yang TIDAK dilewati digambar abu-abu, lebih tipis,
 *   sekadar konteks jaringan jalan tambang di sekitarnya.
 * - Bentuk jalan sengaja dibuat organik (bezier tidak simetris/berpola),
 *   bukan zigzag berulang, supaya terasa seperti haul road sungguhan.
 *
 * Koordinat path di bawah ini murni SVG — gampang digeser kalau mau
 * disesuaikan bentuknya, tidak ada logika tersembunyi di baliknya.
 *
 * Lokasi file: src/features/road/HaulRoadMap.jsx
 */

import { roadSegments, RoadSegmentRisk } from "../../services/tyreData";

const ROAD_RISK_COLOR = {
  [RoadSegmentRisk.HIGH]: "#C84B31",
  [RoadSegmentRisk.MEDIUM]: "#E0A526",
  [RoadSegmentRisk.LOW]: "#1A7A4A",
};

const UNTRAVELED_COLOR = "#C7D2CB";

// ─────────────────────────────────────────────
// UI PRIMITIVES
// ─────────────────────────────────────────────

function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function SegmentBadge({ x, y, seg }) {
  const color = ROAD_RISK_COLOR[seg.riskLevel];
  const shortName = seg.name.replace("Segmen ", "");
  return (
    <g transform={`translate(${x - 34}, ${y - 13})`}>
      <rect width="68" height="26" rx="13" fill="#0B3B2D" />
      <circle cx="16" cy="13" r="4" fill={color} />
      <text x="38" y="17" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff">
        {shortName} · {seg.riskScore}
      </text>
    </g>
  );
}

// ─────────────────────────────────────────────
// HAUL ROAD MAP — root component
// ─────────────────────────────────────────────

export default function HaulRoadMap({ segments = roadSegments }) {
  // Asumsi: urutan array `segments` mengikuti urutan fisik jalur (A1 → A2 → A3).
  const [seg1, seg2, seg3] = segments;
  if (!seg1 || !seg2 || !seg3) return null;

  // Jalur utama (dilewati DT001), dipecah per segmen supaya tiap
  // bagian bisa diwarnai sesuai riskLevel-nya masing-masing.
  const pathA1 = "M110,500 C170,470 150,410 230,398 C260,393 275,388 300,380";
  const pathA2 = "M300,380 C360,362 330,290 385,262 C420,244 450,238 480,230";
  const pathA3 = "M480,230 C540,212 560,160 610,120 C645,93 665,80 690,60";

  // Garis tengah putus-putus menyambung ketiga segmen (tanpa "M" ganda)
  const centerLine =
    "M110,500 C170,470 150,410 230,398 C260,393 275,388 300,380 " +
    "C360,362 330,290 385,262 C420,244 450,238 480,230 " +
    "C540,212 560,160 610,120 C645,93 665,80 690,60";

  return (
    <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em]">
          Peta Jalur Haul Road — Unit DT001
        </p>
        <div className="flex items-center gap-3 text-[10px] font-medium text-[#6B8F7A]">
          <LegendDot color={ROAD_RISK_COLOR[RoadSegmentRisk.LOW]} label="Low" />
          <LegendDot color={ROAD_RISK_COLOR[RoadSegmentRisk.MEDIUM]} label="Medium" />
          <LegendDot color={ROAD_RISK_COLOR[RoadSegmentRisk.HIGH]} label="High" />
          <LegendDot color={UNTRAVELED_COLOR} label="Jalur lain" />
        </div>
      </div>

      <svg
        viewBox="0 0 800 540"
        className="w-full h-auto"
        role="img"
        aria-label="Peta jalur haul road yang dilewati unit DT001, lengkap dengan cabang jalan lain di sekitarnya"
      >
        {/* ── JALUR LAIN — tidak dilewati DT001, abu-abu ── */}
        <path
          d="M230,398 C190,420 140,415 95,370"
          fill="none"
          stroke={UNTRAVELED_COLOR}
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M385,262 C430,290 470,320 470,380 C470,420 450,455 410,472"
          fill="none"
          stroke={UNTRAVELED_COLOR}
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M610,120 C580,95 548,72 558,32"
          fill="none"
          stroke={UNTRAVELED_COLOR}
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* titik ujung cabang (dead-end) */}
        <circle cx="95" cy="370" r="4.5" fill={UNTRAVELED_COLOR} />
        <circle cx="410" cy="472" r="4.5" fill={UNTRAVELED_COLOR} />
        <circle cx="558" cy="32" r="4.5" fill={UNTRAVELED_COLOR} />

        {/* ── JALUR UTAMA — dilewati DT001, diwarnai per risiko segmen ── */}
        <path d={pathA1} fill="none" stroke={ROAD_RISK_COLOR[seg1.riskLevel]} strokeWidth="15" strokeLinecap="round" />
        <path d={pathA2} fill="none" stroke={ROAD_RISK_COLOR[seg2.riskLevel]} strokeWidth="15" strokeLinecap="round" />
        <path d={pathA3} fill="none" stroke={ROAD_RISK_COLOR[seg3.riskLevel]} strokeWidth="15" strokeLinecap="round" />

        {/* Garis tengah putih putus-putus, gaya navigasi peta */}
        <path d={centerLine} fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="9 11" strokeLinecap="round" opacity="0.55" />

        {/* Titik awal (loading point) & akhir (dumping point) */}
        <g>
          <circle cx="110" cy="500" r="8" fill="#0B3B2D" />
          <circle cx="110" cy="500" r="8" fill="none" stroke="#fff" strokeWidth="2" />
          <text x="110" y="524" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0B3B2D">
            Loading Point
          </text>
        </g>
        <g>
          <circle cx="690" cy="60" r="8" fill="#0B3B2D" />
          <circle cx="690" cy="60" r="8" fill="none" stroke="#fff" strokeWidth="2" />
          <text x="690" y="42" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0B3B2D">
            Dumping Point
          </text>
        </g>

        {/* Label tiap segmen */}
        <SegmentBadge x={175} y={462} seg={seg1} />
        <SegmentBadge x={355} y={330} seg={seg2} />
        <SegmentBadge x={610} y={175} seg={seg3} />

        {/* Marker posisi unit DT001 (di segmen paling berisiko) */}
        <g transform="translate(215,406)">
          <circle r="12" fill="none" stroke={ROAD_RISK_COLOR[seg1.riskLevel]} strokeWidth="2" opacity="0.4" />
          <circle r="7" fill="#0B3B2D" />
          <circle r="7" fill="none" stroke="#4ADE80" strokeWidth="2" />
        </g>
        <text x="215" y="392" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0B3B2D">
          DT001
        </text>
      </svg>

      <p className="text-[#8FA89A] text-[10.5px] mt-3">
        Jalur berwarna menunjukkan rute aktual yang dilewati unit DT001 (Segmen A1 → A2 → A3), diwarnai
        sesuai Road Risk Score tiap segmen. Jalur abu-abu adalah cabang jaringan haul road lain yang tidak
        dilewati unit ini.
      </p>
    </div>
  );
}