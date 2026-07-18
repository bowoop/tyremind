/**
 * TyreMind MVP — Reports
 * Chemical Aware AI Tyre Intelligence System
 *
 * Tiga bagian:
 *   1. Export Laporan — simulasi ekspor Laporan Harian, Mingguan, dan
 *      Prediksi AI ke format PDF / Excel.
 *   2. Pengaturan Konektivitas IoT LoRa — konfigurasi gateway sederhana
 *      (lokal, belum tersambung backend).
 *   3. Status Baterai Sensor — level baterai sensor tiap ban unit DT001.
 *
 * Catatan implementasi:
 * - Tombol export ini SIMULASI: tidak ada file PDF/Excel biner yang
 *   benar-benar dibuat. Untuk implementasi nyata nanti, sambungkan
 *   handleExport() ke library seperti jsPDF (PDF) atau SheetJS (Excel).
 * - Data baterai sensor belum ada di tyreData.js, jadi dibangkitkan
 *   secara deterministik dari id ban (bukan angka acak tiap render),
 *   ditandai jelas sebagai placeholder menunggu integrasi IoT nyata.
 *
 * Lokasi file: src/features/reports/Reports.jsx
 */

import { useState } from "react";
import { fleet } from "../../services/tyreData";

// ─────────────────────────────────────────────
// KONFIGURASI JENIS LAPORAN
// ─────────────────────────────────────────────

const REPORT_TYPES = [
  {
    id: "daily",
    label: "Laporan Harian",
    description: "Ringkasan kondisi ban & unit dalam 24 jam terakhir.",
  },
  {
    id: "weekly",
    label: "Laporan Mingguan",
    description: "Tren health score, alert, dan aktivitas maintenance 7 hari terakhir.",
  },
  {
    id: "ai-prediction",
    label: "Prediksi AI",
    description: "Skor risiko blowout dan rekomendasi tindakan dari AI Insight.",
  },
];

// ─────────────────────────────────────────────
// BATERAI SENSOR — placeholder deterministik menunggu integrasi IoT nyata
// ─────────────────────────────────────────────

function mockBatteryPct(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 97;
  return 15 + (hash % 80); // rentang 15–94%
}

const SYNC_LABELS = ["2 menit lalu", "5 menit lalu", "9 menit lalu", "14 menit lalu"];

function batteryMeta(pct) {
  if (pct < 20) return { label: "Perlu Diganti", solid: "#C84B31", soft: "#FBEAE6", text: "#C84B31" };
  if (pct < 50) return { label: "Warning", solid: "#E0A526", soft: "#FDF3E0", text: "#B8790E" };
  return { label: "Good", solid: "#1A7A4A", soft: "#E8F5EE", text: "#1A7A4A" };
}

// ─────────────────────────────────────────────
// UI PRIMITIVES
// ─────────────────────────────────────────────

function ScoreBar({ value, colorSolid }) {
  return (
    <div className="h-1.5 w-full bg-[#EDF3EF] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(4, Math.min(100, value))}%`, backgroundColor: colorSolid }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// EXPORT LAPORAN
// ─────────────────────────────────────────────

function ExportButton({ format, status, onClick }) {
  const isGenerating = status === "generating";
  const isReady = status === "ready";

  return (
    <button
      onClick={onClick}
      disabled={isGenerating}
      className={[
        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-colors duration-150",
        isReady
          ? "bg-[#E8F5EE] text-[#1A7A4A]"
          : "bg-[#F4F7F5] text-[#0B3B2D] hover:bg-[#E8EDE9]",
        isGenerating ? "opacity-60 cursor-wait" : "",
      ].join(" ")}
    >
      {isGenerating ? "Membuat..." : isReady ? `${format} Siap Diunduh` : `Export ${format}`}
    </button>
  );
}

function ReportExportCard({ reportType, exportStatus, onExport }) {
  return (
    <div className="rounded-xl border border-[#EEF3F0] p-4">
      <p className="text-[#0B3B2D] text-[13.5px] font-bold leading-tight mb-1">{reportType.label}</p>
      <p className="text-[#6B8F7A] text-[11.5px] leading-snug mb-3">{reportType.description}</p>
      <div className="flex gap-2">
        <ExportButton
          format="PDF"
          status={exportStatus[`${reportType.id}-pdf`] ?? "idle"}
          onClick={() => onExport(reportType.id, "pdf")}
        />
        <ExportButton
          format="Excel"
          status={exportStatus[`${reportType.id}-excel`] ?? "idle"}
          onClick={() => onExport(reportType.id, "excel")}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PENGATURAN KONEKTIVITAS IOT LoRa
// ─────────────────────────────────────────────

function LoraSettingsCard() {
  const [connected, setConnected] = useState(true);
  const [gatewayId, setGatewayId] = useState("GW-TYREMIND-01");
  const [frequency, setFrequency] = useState("923 MHz (AS923)");
  const [saved, setSaved] = useState(false);

  function handleSave(e) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em]">
          Konektivitas IoT LoRa
        </p>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{
            backgroundColor: connected ? "#E8F5EE" : "#FBEAE6",
            color: connected ? "#1A7A4A" : "#C84B31",
          }}
        >
          {connected ? "Gateway Terhubung" : "Gateway Terputus"}
        </span>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[#6B8F7A] text-[11px] font-semibold">Gateway ID</span>
          <input
            type="text"
            value={gatewayId}
            onChange={(e) => setGatewayId(e.target.value)}
            className="rounded-xl border border-[#E8EDE9] px-3 py-2 text-[13px] text-[#0B3B2D] focus:outline-none focus:ring-2 focus:ring-[#1A7A4A]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[#6B8F7A] text-[11px] font-semibold">Frekuensi Jaringan</span>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="rounded-xl border border-[#E8EDE9] px-3 py-2 text-[13px] text-[#0B3B2D] focus:outline-none focus:ring-2 focus:ring-[#1A7A4A] bg-white"
          >
            <option>923 MHz (AS923)</option>
            <option>868 MHz (EU868)</option>
            <option>915 MHz (US915)</option>
          </select>
        </label>

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={connected}
            onChange={(e) => setConnected(e.target.checked)}
            className="w-4 h-4 rounded accent-[#1A7A4A]"
          />
          <span className="text-[#0B3B2D] text-[12.5px] font-medium">Aktifkan koneksi gateway</span>
        </label>

        <button
          type="submit"
          className="self-start px-5 py-2.5 rounded-xl bg-[#0B3B2D] text-white text-[13px] font-semibold hover:bg-[#14543A] transition-colors duration-150"
        >
          {saved ? "Tersimpan ✓" : "Simpan Pengaturan"}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────
// STATUS BATERAI SENSOR
// ─────────────────────────────────────────────

function BatteryRow({ tyre, index }) {
  const pct = mockBatteryPct(tyre.id);
  const meta = batteryMeta(pct);
  const syncLabel = SYNC_LABELS[index % SYNC_LABELS.length];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_180px_96px] items-center gap-3 py-3 border-b border-[#EEF3F0] last:border-b-0">
      <div className="min-w-0">
        <p className="text-[#0B3B2D] text-[13px] font-semibold leading-tight">
          {tyre.id} · {tyre.position}
        </p>
        <p className="text-[#8FA89A] text-[10.5px] mt-0.5">Sinkron terakhir {syncLabel}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <ScoreBar value={pct} colorSolid={meta.solid} />
        </div>
        <span className="text-[#0B3B2D] text-[12px] font-bold w-9 text-right">{pct}%</span>
      </div>

      <span
        className="text-[10px] font-bold px-2 py-1 rounded-full justify-self-end"
        style={{ backgroundColor: meta.soft, color: meta.text }}
      >
        {meta.label}
      </span>
    </div>
  );
}

function SensorBatteryCard({ tyres }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
      <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-1">
        Status Baterai Sensor Ban
      </p>
      <p className="text-[#8FA89A] text-[10.5px] mb-3">
        Placeholder — akan diganti data IoT LoRa real-time begitu gateway terhubung.
      </p>
      <div className="flex flex-col">
        {tyres.map((tyre, index) => (
          <BatteryRow key={tyre.id} tyre={tyre} index={index} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// REPORTS — root component
// ─────────────────────────────────────────────

export default function Reports() {
  const unit = fleet.find((u) => u.unitId === "DT001") ?? fleet[0];
  const [exportStatus, setExportStatus] = useState({});

  function handleExport(reportId, format) {
    const key = `${reportId}-${format}`;
    setExportStatus((prev) => ({ ...prev, [key]: "generating" }));
    setTimeout(() => {
      setExportStatus((prev) => ({ ...prev, [key]: "ready" }));
    }, 1200);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-1">
          Reports
        </p>
        <h2 className="text-[#0B3B2D] text-lg font-bold tracking-tight">
          {unit?.name} <span className="text-[#6B8F7A] font-medium text-sm">({unit?.unitId})</span>
        </h2>
        <p className="text-[#6B8F7A] text-[12px] mt-1">
          Ekspor laporan dan pantau konektivitas sensor IoT ban.
        </p>
      </div>

      {/* ── EXPORT LAPORAN ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-4">
          Export Laporan
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {REPORT_TYPES.map((reportType) => (
            <ReportExportCard
              key={reportType.id}
              reportType={reportType}
              exportStatus={exportStatus}
              onExport={handleExport}
            />
          ))}
        </div>
      </div>

      {/* ── IOT LoRa + BATERAI SENSOR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <LoraSettingsCard />
        {unit && <SensorBatteryCard tyres={unit.tyres} />}
      </div>
    </div>
  );
}
