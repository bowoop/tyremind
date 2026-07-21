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
 * Catatan: analisis Perilaku Operator sengaja TIDAK diikutkan sebagai
 * faktor skor — SOP penilaian perilaku operator yang valid belum ada,
 * jadi datanya dilepas total supaya tidak memengaruhi Skor Risiko Blowout
 * atau rekomendasi apapun di halaman ini.
 *
 * Lokasi file: src/features/ai-insight/AiInsight.jsx
 */

import { useState } from "react";
import { fleet, TyreStatus, roadSegments, estimateTyreRulDays } from "../../services/tyreData";

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
    </div>
  );
}