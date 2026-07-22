/**
 * TyreMind MVP — AI Insight
 * Chemical Aware AI Tyre Intelligence System
 *
 * Menampilkan AI Predictive Insight untuk ban paling kritis pada unit DT001:
 * - Skor risiko blowout (health score + kimia/termal + overload muatan +
 *   kondisi jalan — lihat computeBlowoutRisk())
 * - Prediksi jendela waktu kegagalan (dari remainingUsefulLifeKm / averageDailyDistanceKm)
 * - Breakdown 4 faktor kontribusi, seluruhnya dari data real:
 *   degradasi kimia, suhu/tekanan, overload muatan, kondisi jalan tambang
 * - Rekomendasi tindakan spesifik dari AI
 *
 * Ditambah 2 bagian yang MENGHUBUNGKAN data dari seluruh segmen lain
 * (tyres, roadSegments, payloadCycles) lewat services/maintenanceModel.js:
 * - Rekomendasi Strategi Perawatan: rotasi ban berbasis keausan + TKPH
 *   (bukan jam kerja), tindakan korektif suhu/tekanan abnormal, kalibrasi
 *   PLM/suspensi, dan inspeksi vessel/frame akibat muatan tidak seimbang.
 * - Analisis Biaya & ROI: estimasi penghematan biaya ban & BBM, serta
 *   payback period CapEx vs OpEx — SEMUA angka Rupiah adalah estimasi
 *   ilustratif untuk business case, lihat catatan metodologi di
 *   services/maintenanceModel.js.
 *
 * Catatan: analisis Perilaku Operator sengaja TIDAK diikutkan sebagai
 * faktor skor — SOP penilaian perilaku operator yang valid belum ada,
 * jadi datanya dilepas total supaya tidak memengaruhi Skor Risiko Blowout
 * atau rekomendasi apapun di halaman ini.
 *
 * Lokasi file: src/features/ai-insight/AiInsight.jsx
 */

import { useState } from "react";
import { fleet, TyreStatus, roadSegments, payloadCycles, estimateTyreRulDays } from "../../services/tyreData";
import { analyzePayloadCycles, analyzeCycleTimeForCycles } from "../../services/payloadModel";
import {
  computeTKPH,
  tkphUtilizationStatus,
  recommendTyreRotation,
  recommendCorrectiveActions,
  recommendPLMCalibration,
  recommendFrameVesselInspection,
  estimateTyreCostSaving,
  estimateFuelSaving,
  estimateROISummary,
  DOWNTIME_RISK_NOTE,
} from "../../services/maintenanceModel";

// ─────────────────────────────────────────────
// STATUS THEME — selaras dengan komponen lain
// ─────────────────────────────────────────────

const STATUS_META = {
  [TyreStatus.NORMAL]: { label: "Good", solid: "#1A7A4A", soft: "#E8F5EE", text: "#1A7A4A" },
  [TyreStatus.WARNING]: { label: "Warning", solid: "#E0A526", soft: "#FDF3E0", text: "#B8790E" },
  [TyreStatus.CRITICAL]: { label: "Critical", solid: "#C84B31", soft: "#FBEAE6", text: "#C84B31" },
};

const RISK_META = {
  HIGH: { label: "High Risk", solid: "#C84B31", soft: "#FBEAE6", text: "#C84B31" },
  MEDIUM: { label: "Medium Risk", solid: "#E0A526", soft: "#FDF3E0", text: "#B8790E" },
  LOW: { label: "Low Risk", solid: "#1A7A4A", soft: "#E8F5EE", text: "#1A7A4A" },
};

function riskLevelFromScore(score) {
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

function riskStatusFromValue(value, criticalAt, warningAt) {
  if (value >= criticalAt) return TyreStatus.CRITICAL;
  if (value >= warningAt) return TyreStatus.WARNING;
  return TyreStatus.NORMAL;
}

// ─────────────────────────────────────────────
// AGREGASI DATA JALAN — dipakai bareng di skor & breakdown
// ─────────────────────────────────────────────

function aggregateRoadRisk(segments) {
  const overallRiskScore = Math.round(segments.reduce((sum, s) => sum + s.riskScore, 0) / segments.length);
  const mostDangerous = [...segments].sort((a, b) => b.riskScore - a.riskScore)[0];
  return { overallRiskScore, mostDangerous };
}

// ─────────────────────────────────────────────
// AI SCORING — formula terdokumentasi, dari data real tyreData.js
// ─────────────────────────────────────────────

function computeBlowoutRisk(tyre, unit, roadRiskScore) {
  // Basis risiko: makin rendah health score, makin tinggi risiko blowout.
  const baseRisk = 100 - tyre.healthScore;

  // Setiap 10% overload frequency menambah risiko ~3 poin.
  const overloadAdjustment = Math.round((unit.operationalMetrics.overloadFrequencyPct ?? 0) * 0.3);

  // Kondisi jalan menyumbang porsi lebih kecil, karena merupakan faktor
  // eksternal (bukan kondisi fisik ban itu sendiri).
  const roadAdjustment = Math.round(roadRiskScore * 0.12);

  const score = Math.min(99, Math.max(1, baseRisk + overloadAdjustment + roadAdjustment));
  return score;
}

// ─────────────────────────────────────────────
// UI PRIMITIVES
// ─────────────────────────────────────────────

function StatusPill({ meta, className = "" }) {
  return (
    <span
      className={["text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0", className].join(" ")}
      style={{ backgroundColor: meta.soft, color: meta.text }}
    >
      {meta.label}
    </span>
  );
}

function FactorBar({ label, value, valueLabel, colorStatus, sourceNote }) {
  const meta = STATUS_META[colorStatus];
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[#0B3B2D] text-[12.5px] font-semibold">{label}</span>
        <span className="text-[#0B3B2D] text-[12.5px] font-bold">{valueLabel}</span>
      </div>
      <div className="h-2 w-full bg-[#EDF3EF] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(4, Math.min(100, value))}%`, backgroundColor: meta.solid }}
        />
      </div>
      {sourceNote && <p className="text-[#8FA89A] text-[10px] mt-1">{sourceNote}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// MODUL PERBAIKAN — dipindah dari Maintenance.jsx, sekarang jadi
// bagian dari AI Insight karena berpusat di ban paling kritis yang sama.
// ─────────────────────────────────────────────

function formatDateID(date) {
  return date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function RepairModule({ unit, targetTyre, healthiestTyre }) {
  const [workOrder, setWorkOrder] = useState(null);

  const rulDays = estimateTyreRulDays(targetTyre, unit);
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
            Dijadwalkan {bufferDays} hari sebelum estimasi RUL habis (sisa {targetTyre.remainingUsefulLifeKm.toLocaleString("id-ID")} km saat ini) sebagai margin aman.
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

function formatIDR(value) {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(2)} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`;
  return `Rp ${value.toLocaleString("id-ID")}`;
}

const PRIORITY_META = {
  Tinggi: { solid: "#C84B31", soft: "#FBEAE6", text: "#C84B31" },
  Sedang: { solid: "#E0A526", soft: "#FDF3E0", text: "#B8790E" },
  Rendah: { solid: "#1A7A4A", soft: "#E8F5EE", text: "#1A7A4A" },
  Normal: { solid: "#1A7A4A", soft: "#E8F5EE", text: "#1A7A4A" },
  Pantau: { solid: "#E0A526", soft: "#FDF3E0", text: "#B8790E" },
  "Segera Diperiksa": { solid: "#C84B31", soft: "#FBEAE6", text: "#C84B31" },
  "Perlu Inspeksi": { solid: "#C84B31", soft: "#FBEAE6", text: "#C84B31" },
};

function PriorityPill({ label }) {
  const meta = PRIORITY_META[label] || PRIORITY_META.Rendah;
  return (
    <span
      className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
      style={{ backgroundColor: meta.soft, color: meta.text }}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────
// REKOMENDASI STRATEGI PERAWATAN — menghubungkan tyres, roadSegments &
// payloadCycles lewat services/maintenanceModel.js
// ─────────────────────────────────────────────

function MaintenanceRecommendationsSection({ unit, mostDangerousSegment, payloadAnalysis, cycleTimeAnalysis }) {
  const avgPayloadTon = payloadAnalysis.totalTonHauled / payloadAnalysis.totalCycles;
  const haulStage = cycleTimeAnalysis.avgStageMinutes.find((s) => s.key === "haulingLoadedMinutes");
  const returnStage = cycleTimeAnalysis.avgStageMinutes.find((s) => s.key === "returnEmptyMinutes");

  const tkph = computeTKPH(unit, avgPayloadTon, haulStage.avgActualMinutes, returnStage.avgActualMinutes);
  const tkphStatus = tkphUtilizationStatus(tkph.tkphWeighted);
  const rotationRecs = recommendTyreRotation(unit.tyres, tkphStatus);
  const correctiveActions = recommendCorrectiveActions(unit.tyres, mostDangerousSegment);
  const plm = recommendPLMCalibration(payloadAnalysis);
  const frame = recommendFrameVesselInspection(payloadAnalysis);

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-1">
          Rekomendasi Strategi Perawatan
        </p>
        <h2 className="text-[#0B3B2D] text-lg font-bold tracking-tight">Predictive Tyre Maintenance</h2>
        <p className="text-[#6B8F7A] text-[12px] mt-1">
          Rotasi ban berbasis keausan & TKPH (Ton-Kilometer per Hour) — bukan sekadar jam kerja unit.
        </p>
      </div>

      {/* TKPH */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em]">
            TKPH (Ton-Kilometer per Hour)
          </p>
          <PriorityPill label={tkphStatus.status === "CRITICAL" ? "Tinggi" : tkphStatus.status === "WARNING" ? "Sedang" : "Rendah"} />
        </div>
        <div className="flex items-end gap-3 mb-2">
          <span className="text-[#0B3B2D] text-3xl font-bold tracking-tight leading-none">{tkph.tkphWeighted}</span>
          <span className="text-[#8FA89A] text-[12px] font-medium mb-1">
            TKPH · {tkphStatus.utilizationPct}% dari rating {tkphStatus.rating}
          </span>
        </div>
        <div className="h-2 w-full bg-[#EDF3EF] rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, tkphStatus.utilizationPct)}%`,
              backgroundColor: tkphStatus.status === "CRITICAL" ? "#C84B31" : tkphStatus.status === "WARNING" ? "#E0A526" : "#1A7A4A",
            }}
          />
        </div>
        <p className="text-[#6B8F7A] text-[11px]">
          Dihitung dari GVW ({unit.emptyWeightTon} ton kosong + {Math.round(avgPayloadTon)} ton rata-rata payload) ÷{" "}
          {unit.physicalTyreCount} ban, dikombinasikan dengan kecepatan rata-rata loaded ({tkph.avgSpeedLoadedKmh}{" "}
          km/h) & empty ({tkph.avgSpeedEmptyKmh} km/h). Rating {tkphStatus.rating} TKPH adalah asumsi ilustratif —
          ganti dengan datasheet resmi ban terpasang.
        </p>
      </div>

      {/* Rotasi ban */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em] mb-3">
          Rekomendasi Rotasi Ban (berbasis keausan + TKPH)
        </p>
        <div className="flex flex-col gap-1">
          {rotationRecs.map((rec) => (
            <div key={rec.tyreId} className="rounded-xl py-2.5 px-3 hover:bg-[#F4F7F5] transition-colors duration-150">
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-[#0B3B2D] text-[12.5px] font-semibold">
                  {rec.tyreId} <span className="text-[#8FA89A] font-medium">· {rec.position}</span>
                </p>
                <PriorityPill label={rec.priority} />
              </div>
              <p className="text-[#6B8F7A] text-[11.5px] leading-snug">{rec.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tindakan korektif */}
      {correctiveActions.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
          <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em] mb-3">
            Tindakan Korektif — Suhu/Tekanan Abnormal di Rute {mostDangerousSegment.name}
          </p>
          <div className="flex flex-col gap-1">
            {correctiveActions.map((a) => (
              <div key={a.tyreId} className="rounded-xl py-2.5 px-3 hover:bg-[#F4F7F5] transition-colors duration-150">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-[#0B3B2D] text-[12.5px] font-semibold">
                    {a.tyreId} <span className="text-[#8FA89A] font-medium">· {a.position}</span>
                  </p>
                  <PriorityPill label={a.severity} />
                </div>
                <p className="text-[#6B8F7A] text-[11.5px] leading-snug">{a.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kalibrasi & perawatan unit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em]">
              Kalibrasi PLM & Suspensi
            </p>
            <PriorityPill label={plm.status} />
          </div>
          <p className="text-[#0B3B2D] text-[12.5px] leading-relaxed">{plm.note}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.06em]">
              Inspeksi Vessel & Frame
            </p>
            <PriorityPill label={frame.status} />
          </div>
          <p className="text-[#0B3B2D] text-[12.5px] leading-relaxed">{frame.note}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ANALISIS BIAYA & ROI — estimasi ilustratif, lihat catatan metodologi
// di services/maintenanceModel.js
// ─────────────────────────────────────────────

function CostRoiSection({ unit, payloadAnalysis, cycleTimeAnalysis }) {
  const RUL_EXTENSION_PCT = 18; // titik tengah rentang "15–20%" di brief tantangan
  const tyreSaving = estimateTyreCostSaving(RUL_EXTENSION_PCT, unit);
  const fuelSaving = estimateFuelSaving(payloadAnalysis, cycleTimeAnalysis);
  const roi = estimateROISummary(tyreSaving, fuelSaving, fleet.length);

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-1">
          Analisis Biaya & Penghematan
        </p>
        <h2 className="text-[#0B3B2D] text-lg font-bold tracking-tight">Cost Impact & ROI (per unit HD785)</h2>
        <p className="text-[#6B8F7A] text-[12px] mt-1">
          Estimasi ilustratif untuk business case — kalikan sesuai jumlah unit HD785 di fleet Anda untuk proyeksi
          skala penuh.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#E8F5EE] p-5">
          <p className="text-[#1A7A4A] text-[11px] font-bold uppercase tracking-[0.04em] mb-2">
            Penghematan Biaya Ban
          </p>
          <p className="text-[#0B3B2D] text-2xl font-bold tracking-tight leading-none mb-1">
            {formatIDR(tyreSaving.annualSavingIDR)}
            <span className="text-[13px] font-semibold text-[#6B8F7A]">/tahun</span>
          </p>
          <p className="text-[#1A7A4A]/90 text-[12px] leading-snug">
            Perpanjangan umur ban {RUL_EXTENSION_PCT}% ({tyreSaving.tyreLifeDaysBefore} → {tyreSaving.tyreLifeDaysAfter} hari)
            menurunkan kebutuhan penggantian dari {tyreSaving.replacementsPerYearBefore} menjadi{" "}
            {tyreSaving.replacementsPerYearAfter} ban/tahun (asumsi harga ban {formatIDR(170_000_000)}/unit).
          </p>
        </div>

        <div className="rounded-xl bg-[#E9F1FA] p-5">
          <p className="text-[#2E6699] text-[11px] font-bold uppercase tracking-[0.04em] mb-2">
            Efisiensi BBM (OpEx)
          </p>
          <p className="text-[#0B3B2D] text-2xl font-bold tracking-tight leading-none mb-1">
            {formatIDR(fuelSaving.annualSavingIDR)}
            <span className="text-[13px] font-semibold text-[#6B8F7A]">/tahun</span>
          </p>
          <p className="text-[#2E6699]/90 text-[12px] leading-snug">
            Dari berkurangnya ritase mubazir akibat underload ({fuelSaving.annualWastedTripsFuelLiter.toLocaleString("id-ID")} L)
            & queue time berlebih ({fuelSaving.annualQueueOverFuelLiter.toLocaleString("id-ID")} L) —{" "}
            {fuelSaving.totalAnnualFuelSavedLiter.toLocaleString("id-ID")} liter solar/tahun.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-[#FDF3E0] px-4 py-3">
        <p className="text-[#B8790E] text-[11px] font-bold">Downtime / Biaya Kerusakan</p>
        <p className="text-[#B8790E]/90 text-[10.5px] mt-1 leading-snug">{DOWNTIME_RISK_NOTE}</p>
      </div>

      {/* CapEx vs OpEx & ROI */}
      <div className="bg-[#0B3B2D] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-[#4ADE80] flex-shrink-0" />
          <p className="text-[#4ADE80] text-[11px] font-semibold uppercase tracking-[0.08em]">
            Estimasi Investasi Solusi — CapEx vs OpEx
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-white/60 text-[10.5px] font-semibold uppercase tracking-[0.05em] mb-1">CapEx Awal</p>
            <p className="text-white text-lg font-bold">{formatIDR(roi.capExIDR)}</p>
          </div>
          <div>
            <p className="text-white/60 text-[10.5px] font-semibold uppercase tracking-[0.05em] mb-1">OpEx/Tahun</p>
            <p className="text-white text-lg font-bold">{formatIDR(roi.annualOpExIDR)}</p>
          </div>
          <div>
            <p className="text-white/60 text-[10.5px] font-semibold uppercase tracking-[0.05em] mb-1">
              Total Saving/Tahun
            </p>
            <p className="text-white text-lg font-bold">{formatIDR(roi.totalAnnualSavingIDR)}</p>
          </div>
          <div>
            <p className="text-white/60 text-[10.5px] font-semibold uppercase tracking-[0.05em] mb-1">
              Payback Period
            </p>
            <p className="text-[#4ADE80] text-lg font-bold">
              {roi.paybackMonths !== null ? `${roi.paybackMonths} bulan` : "-"}
            </p>
          </div>
        </div>
        <p className="text-white/70 text-[11.5px] leading-relaxed">
          CapEx (sensor kimia EIS + TPMS + node LoRa per unit + setup platform) sepadan dengan penghematan yang
          dihasilkan — payback period{" "}
          <strong className="text-white">
            {roi.paybackMonths !== null && roi.paybackMonths < 12 ? "di bawah 1 tahun" : `~${roi.paybackMonths} bulan`}
          </strong>{" "}
          untuk {roi.unitCount} unit di fleet saat ini. Seluruh angka CapEx/OpEx adalah estimasi ilustratif — lihat
          services/maintenanceModel.js untuk rincian asumsi per komponen.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// AI INSIGHT — root component
// ─────────────────────────────────────────────

export default function AiInsight() {
  const unit = fleet.find((u) => u.unitId === "DT001") ?? fleet[0];

  const criticalTyre = unit?.tyres.reduce(
    (worst, t) => (!worst || t.healthScore < worst.healthScore ? t : worst),
    null
  );
  const healthiestTyre = unit?.tyres.reduce(
    (best, t) => (!best || t.healthScore > best.healthScore ? t : best),
    null
  );

  if (!unit || !criticalTyre) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-8 text-center">
        <p className="text-[#6B8F7A] text-sm">Belum ada data ban untuk dianalisis AI.</p>
      </div>
    );
  }

  const { overallRiskScore: roadRiskScore, mostDangerous: mostDangerousSegment } = aggregateRoadRisk(roadSegments);

  const riskScore = computeBlowoutRisk(criticalTyre, unit, roadRiskScore);
  const riskLevel = RISK_META[riskLevelFromScore(riskScore)];
  const remainingKm = criticalTyre.remainingUsefulLifeKm;
  const isUrgent = riskScore >= 60;

  const payloadAnalysis = analyzePayloadCycles(payloadCycles, unit.ratedPayloadTon);
  const cycleTimeAnalysis = analyzeCycleTimeForCycles(payloadCycles);

  return (
    <div className="flex flex-col gap-5">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-5 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-1">
            AI Predictive Insight
          </p>
          <h2 className="text-[#0B3B2D] text-lg font-bold tracking-tight">
            {unit.name} <span className="text-[#6B8F7A] font-medium text-sm">({unit.unitId})</span> — Ban{" "}
            {criticalTyre.id}
          </h2>
          <p className="text-[#6B8F7A] text-[12px] mt-1">
            {criticalTyre.position} · {unit.site}
          </p>
        </div>
        <StatusPill meta={STATUS_META[criticalTyre.status]} />
      </div>

      {/* ── RISK SCORE & PREDIKSI WAKTU ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
          <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-4">
            Skor Risiko Blowout
          </p>
          <div className="flex items-end gap-3 mb-3">
            <span className="text-[#0B3B2D] text-4xl font-bold tracking-tight leading-none">{riskScore}%</span>
            <StatusPill meta={riskLevel} className="mb-1" />
          </div>
          <div className="h-2 w-full bg-[#EDF3EF] rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full"
              style={{ width: `${riskScore}%`, backgroundColor: riskLevel.solid }}
            />
          </div>
          <p className="text-[#6B8F7A] text-[11px]">
            Probabilitas kegagalan ban dalam sisa {remainingKm.toLocaleString("id-ID")} km pemakaian ke depan
            jika kondisi saat ini berlanjut tanpa intervensi.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
          <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-4">
            Prediksi Waktu Kegagalan
          </p>
          <div className="flex items-end gap-1.5 mb-3">
            <span className="text-[#0B3B2D] text-4xl font-bold tracking-tight leading-none">
              {remainingKm.toLocaleString("id-ID")}
            </span>
            <span className="text-[#6B8F7A] text-sm font-medium mb-1">km lagi</span>
          </div>
          <div className="h-2 w-full bg-[#EDF3EF] rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full bg-[#C84B31]"
              style={{ width: `${Math.min(100, (remainingKm / 5000) * 100)}%` }}
            />
          </div>
          <p className="text-[#6B8F7A] text-[11px]">
            Estimasi dari Remaining Useful Life ban {criticalTyre.id} — {remainingKm.toLocaleString("id-ID")} km
            jarak tempuh tersisa (setara ~{estimateTyreRulDays(criticalTyre, unit)} hari pada rata-rata{" "}
            {unit.operationalMetrics.averageDailyDistanceKm} km/hari, hanya sebagai gambaran waktu).
          </p>
        </div>
      </div>

      {/* ── FAKTOR KONTRIBUSI ── */}
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
        <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-4">
          Faktor Kontribusi Risiko
        </p>

        <div className="flex flex-col gap-4">
          <FactorBar
            label="Degradasi Material Kimia"
            value={criticalTyre.materialDegradationPct}
            valueLabel={`${criticalTyre.materialDegradationPct}%`}
            colorStatus={riskStatusFromValue(criticalTyre.materialDegradationPct, 40, 25)}
            sourceNote="Dari sensor kimia ban — compound sudah mengalami penurunan struktur signifikan."
          />
          <FactorBar
            label="Suhu & Tekanan Operasional"
            value={(criticalTyre.temperatureCelcius / 100) * 100}
            valueLabel={`${criticalTyre.temperatureCelcius}°C · ${criticalTyre.pressurePsi} PSI`}
            colorStatus={
              criticalTyre.temperatureCelcius > 75 || criticalTyre.pressurePsi < 90
                ? TyreStatus.CRITICAL
                : criticalTyre.temperatureCelcius > 65 || criticalTyre.pressurePsi < 100
                ? TyreStatus.WARNING
                : TyreStatus.NORMAL
            }
            sourceNote="Suhu di atas ambang aman & tekanan di bawah rentang normal (95–105 PSI) mempercepat kegagalan struktural."
          />
          <FactorBar
            label="Frekuensi Overload Muatan (Unit)"
            value={unit.operationalMetrics.overloadFrequencyPct}
            valueLabel={`${unit.operationalMetrics.overloadFrequencyPct}%`}
            colorStatus={riskStatusFromValue(unit.operationalMetrics.overloadFrequencyPct, 25, 10)}
            sourceNote={`Rata-rata payload ${unit.operationalMetrics.averagePayloadTon} ton — beban berlebih menambah tekanan mekanis pada ban.`}
          />
          <FactorBar
            label="Kondisi Jalan Tambang"
            value={roadRiskScore}
            valueLabel={`${roadRiskScore}/100 road risk score`}
            colorStatus={riskStatusFromValue(roadRiskScore, 60, 35)}
            sourceNote={`Segmen paling berisiko: ${mostDangerousSegment.name} (skor ${mostDangerousSegment.riskScore}) — ${mostDangerousSegment.tyreImpactNote}`}
          />
        </div>
      </div>

      {/* ── REKOMENDASI AI ── */}
      <div className="bg-[#0B3B2D] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-[#4ADE80] flex-shrink-0" />
          <p className="text-[#4ADE80] text-[11px] font-semibold uppercase tracking-[0.08em]">
            Rekomendasi AI {isUrgent ? "— Prioritas Tinggi" : ""}
          </p>
        </div>

        <p className="text-white text-[14px] leading-relaxed mb-4">
          Ban <strong>{criticalTyre.id}</strong> ({criticalTyre.position}) pada unit {unit.unitId} menunjukkan
          degradasi material kimia sebesar <strong>{criticalTyre.materialDegradationPct}%</strong>, suhu
          operasional <strong>{criticalTyre.temperatureCelcius}°C</strong>, dan tekanan{" "}
          <strong>{criticalTyre.pressurePsi} PSI</strong> — berada jauh di bawah rentang aman. Ditambah dengan
          frekuensi overload muatan unit <strong>{unit.operationalMetrics.overloadFrequencyPct}%</strong>,
          serta kondisi segmen <strong>{mostDangerousSegment.name}</strong> yang cukup berisiko (skor{" "}
          <strong>{mostDangerousSegment.riskScore}</strong>), AI memperkirakan risiko blowout sebesar{" "}
          <strong>{riskScore}%</strong> dalam sisa <strong>{remainingKm.toLocaleString("id-ID")} km</strong>{" "}
          pemakaian ke depan.{" "}
          <strong>
            Lakukan pengecekan fisik segera dan jadwalkan penggantian ban sebelum unit kembali beroperasi
          </strong>{" "}
          — jangan menunggu hingga RUL habis, karena kombinasi suhu tinggi dan tekanan rendah pada tingkat
          degradasi ini meningkatkan risiko blowout mendadak saat unit membawa muatan penuh di jalur menanjak.
          Sambil itu, kurangi sementara beban muatan pada unit ini sampai ban diganti, dan waspadai kondisi
          jalur di {mostDangerousSegment.name}.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-[#C84B31] text-white">
            Ganti ban sebelum {remainingKm.toLocaleString("id-ID")} km
          </span>
          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white/10 text-white">
            Kurangi beban muatan sementara
          </span>
          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white/10 text-white">
            Waspadai {mostDangerousSegment.name}
          </span>
        </div>
      </div>

      {/* ── MODUL PERBAIKAN — digabung dari Maintenance, berpusat di ban kritis yang sama ── */}
      {healthiestTyre && (
        <RepairModule unit={unit} targetTyre={criticalTyre} healthiestTyre={healthiestTyre} />
      )}

      {/* ── REKOMENDASI STRATEGI PERAWATAN — lintas modul (tyres + road + payload + cycle time) ── */}
      <MaintenanceRecommendationsSection
        unit={unit}
        mostDangerousSegment={mostDangerousSegment}
        payloadAnalysis={payloadAnalysis}
        cycleTimeAnalysis={cycleTimeAnalysis}
      />

      {/* ── ANALISIS BIAYA & ROI ── */}
      <CostRoiSection unit={unit} payloadAnalysis={payloadAnalysis} cycleTimeAnalysis={cycleTimeAnalysis} />
    </div>
  );
}