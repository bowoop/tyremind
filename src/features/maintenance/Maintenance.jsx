/**
 * TyreMind MVP — Maintenance
 * Chemical Aware AI Tyre Intelligence System
 *
 * Modul Perbaikan — rekomendasi rotasi/penggantian ban, perkiraan
 * tanggal perawatan, tingkat prioritas, dan tombol pembuatan
 * Work Order digital untuk tim mekanik tambang.
 *
 * Target perbaikan otomatis diambil dari ban dengan healthScore
 * terendah pada unit DT001 (services/tyreData.js).
 *
 * Lokasi file: src/features/maintenance/Maintenance.jsx
 */

import { useState } from "react";
import { fleet } from "../../services/tyreData";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function formatDateID(date) {
  return date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ─────────────────────────────────────────────
// MODUL PERBAIKAN — rekomendasi + work order digital
// ─────────────────────────────────────────────

function RepairModule({ unit, targetTyre, healthiestTyre }) {
  const [workOrder, setWorkOrder] = useState(null);

  const rulDays = Math.round(targetTyre.remainingUsefulLifeHours / 24);
  const bufferDays = Math.max(1, Math.min(3, rulDays - 1));
  const recommendedDate = new Date();
  recommendedDate.setDate(recommendedDate.getDate() + Math.max(1, rulDays - bufferDays));

  function handleCreateWorkOrder() {
    setWorkOrder({
      number: `WO-${unit.unitId}-${Date.now().toString().slice(-6)}`,
      createdAt: new Date(),
      tyre: targetTyre.id,
      priority: "Tinggi",
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em]">
          Modul Perbaikan
        </p>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#FBEAE6] text-[#C84B31]">
          High Priority
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="rounded-xl bg-[#F4F7F5] p-4">
          <p className="text-[#6B8F7A] text-[10.5px] font-semibold uppercase tracking-[0.06em] mb-1.5">
            Rekomendasi Tindakan
          </p>
          <p className="text-[#0B3B2D] text-[12.5px] leading-relaxed">
            Ganti ban <strong>{targetTyre.id}</strong> ({targetTyre.position}) — kondisi kritis, tidak
            disarankan untuk dirotasi. Setelah ban baru terpasang, lakukan rotasi{" "}
            <strong>{healthiestTyre.id}</strong> ke posisi {targetTyre.position} lama untuk menyeimbangkan
            pola keausan seluruh unit.
          </p>
        </div>

        <div className="rounded-xl bg-[#F4F7F5] p-4">
          <p className="text-[#6B8F7A] text-[10.5px] font-semibold uppercase tracking-[0.06em] mb-1.5">
            Perkiraan Tanggal Perawatan
          </p>
          <p className="text-[#0B3B2D] text-[13px] font-bold leading-snug">{formatDateID(recommendedDate)}</p>
          <p className="text-[#8FA89A] text-[10.5px] mt-1">
            Dijadwalkan {bufferDays} hari sebelum RUL habis ({rulDays} hari lagi) sebagai margin aman.
          </p>
        </div>
      </div>

      {!workOrder ? (
        <button
          onClick={handleCreateWorkOrder}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0B3B2D] text-white text-[13px] font-semibold hover:bg-[#14543A] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4ADE80] focus-visible:ring-offset-2"
        >
          Buat Work Order Digital
        </button>
      ) : (
        <div className="rounded-xl bg-[#E8F5EE] border border-[#1A7A4A]/20 p-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <p className="text-[#1A7A4A] text-[13px] font-bold">{workOrder.number}</p>
            <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-white text-[#1A7A4A]">
              Menunggu Penugasan Mekanik
            </span>
          </div>
          <p className="text-[#0B3B2D] text-[12px]">
            Ban {workOrder.tyre} · Prioritas {workOrder.priority} · Dibuat {formatDateID(workOrder.createdAt)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAINTENANCE — root component
// ─────────────────────────────────────────────

export default function Maintenance() {
  const unit = fleet.find((u) => u.unitId === "DT001") ?? fleet[0];

  if (!unit || unit.tyres.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-8 text-center">
        <p className="text-[#6B8F7A] text-sm">Belum ada data ban untuk dianalisis.</p>
      </div>
    );
  }

  const targetTyre = unit.tyres.reduce(
    (worst, t) => (!worst || t.healthScore < worst.healthScore ? t : worst),
    null
  );
  const healthiestTyre = unit.tyres.reduce(
    (best, t) => (!best || t.healthScore > best.healthScore ? t : best),
    null
  );

  return (
    <div className="flex flex-col gap-5">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-1">
          Maintenance
        </p>
        <h2 className="text-[#0B3B2D] text-lg font-bold tracking-tight">
          {unit.name} <span className="text-[#6B8F7A] font-medium text-sm">({unit.unitId})</span>
        </h2>
        <p className="text-[#6B8F7A] text-[12px] mt-1">
          {unit.site} · Segmen {unit.segment}
        </p>
      </div>

      {/* ── MODUL PERBAIKAN ── */}
      <RepairModule unit={unit} targetTyre={targetTyre} healthiestTyre={healthiestTyre} />
    </div>
  );
}
