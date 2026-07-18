/**
 * TyreMind MVP — AI Insight
 * Chemical Aware AI Tyre Intelligence System
 *
 * Menampilkan AI Predictive Insight untuk ban paling kritis pada unit DT001:
 * - Skor risiko blowout (health score + kimia/termal + overload muatan +
 *   perilaku operator + kondisi jalan — lihat computeBlowoutRisk())
 * - Prediksi jendela waktu kegagalan (dari remainingUsefulLifeHours)
 * - Breakdown 5 faktor kontribusi, seluruhnya dari data real:
 *   degradasi kimia, suhu/tekanan, overload muatan, perilaku operator,
 *   kondisi jalan tambang
 * - Rekomendasi tindakan spesifik dari AI
 *
 * Lokasi file: src/features/ai-insight/AiInsight.jsx
 */

import { fleet, TyreStatus, roadSegments, driverBehavior } from "../../services/tyreData";

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
// AGREGASI DATA OPERATOR & JALAN — dipakai bareng di skor & breakdown
// ─────────────────────────────────────────────

function aggregateOperatorRisk(behavior) {
  const scores = Object.values(behavior.behaviorScores);
  const overallBehaviorScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  // behaviorScore: makin tinggi makin BAIK -> dibalik jadi kontribusi risiko (makin tinggi makin BURUK)
  const riskContribution = 100 - overallBehaviorScore;
  return { overallBehaviorScore, riskContribution };
}

function aggregateRoadRisk(segments) {
  const overallRiskScore = Math.round(segments.reduce((sum, s) => sum + s.riskScore, 0) / segments.length);
  const mostDangerous = [...segments].sort((a, b) => b.riskScore - a.riskScore)[0];
  return { overallRiskScore, mostDangerous };
}

// ─────────────────────────────────────────────
// AI SCORING — formula terdokumentasi, dari data real tyreData.js
// ─────────────────────────────────────────────

function computeBlowoutRisk(tyre, unit, operatorRiskContribution, roadRiskScore) {
  // Basis risiko: makin rendah health score, makin tinggi risiko blowout.
  const baseRisk = 100 - tyre.healthScore;

  // Setiap 10% overload frequency menambah risiko ~3 poin.
  const overloadAdjustment = Math.round((unit.operationalMetrics.overloadFrequencyPct ?? 0) * 0.3);

  // Perilaku operator & kondisi jalan menyumbang porsi lebih kecil,
  // karena keduanya faktor eksternal (bukan kondisi fisik ban itu sendiri).
  const operatorAdjustment = Math.round(operatorRiskContribution * 0.15);
  const roadAdjustment = Math.round(roadRiskScore * 0.12);

  const score = Math.min(99, Math.max(1, baseRisk + overloadAdjustment + operatorAdjustment + roadAdjustment));
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
// AI INSIGHT — root component
// ─────────────────────────────────────────────

export default function AiInsight() {
  const unit = fleet.find((u) => u.unitId === "DT001") ?? fleet[0];

  const criticalTyre = unit?.tyres.reduce(
    (worst, t) => (!worst || t.healthScore < worst.healthScore ? t : worst),
    null
  );

  if (!unit || !criticalTyre) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8EDE9] p-8 text-center">
        <p className="text-[#6B8F7A] text-sm">Belum ada data ban untuk dianalisis AI.</p>
      </div>
    );
  }

  const { overallBehaviorScore, riskContribution: operatorRiskContribution } = aggregateOperatorRisk(driverBehavior);
  const { overallRiskScore: roadRiskScore, mostDangerous: mostDangerousSegment } = aggregateRoadRisk(roadSegments);

  const riskScore = computeBlowoutRisk(criticalTyre, unit, operatorRiskContribution, roadRiskScore);
  const riskLevel = RISK_META[riskLevelFromScore(riskScore)];
  const rulDays = Math.round(criticalTyre.remainingUsefulLifeHours / 24);
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
            Probabilitas kegagalan ban dalam {rulDays} hari ke depan jika kondisi saat ini berlanjut tanpa
            intervensi.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E8EDE9] p-6 shadow-sm">
          <p className="text-[#6B8F7A] text-[11px] font-semibold uppercase tracking-[0.08em] mb-4">
            Prediksi Waktu Kegagalan
          </p>
          <div className="flex items-end gap-1.5 mb-3">
            <span className="text-[#0B3B2D] text-4xl font-bold tracking-tight leading-none">{rulDays}</span>
            <span className="text-[#6B8F7A] text-sm font-medium mb-1">hari lagi</span>
          </div>
          <div className="h-2 w-full bg-[#EDF3EF] rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full bg-[#C84B31]"
              style={{ width: `${Math.min(100, (rulDays / 60) * 100)}%` }}
            />
          </div>
          <p className="text-[#6B8F7A] text-[11px]">
            Estimasi dari Remaining Useful Life ban {criticalTyre.id} ({criticalTyre.remainingUsefulLifeHours}{" "}
            jam operasi tersisa).
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
            label="Perilaku Operator"
            value={operatorRiskContribution}
            valueLabel={`${overallBehaviorScore}/100 skor perilaku`}
            colorStatus={riskStatusFromValue(operatorRiskContribution, 40, 25)}
            sourceNote={`${driverBehavior.operatorName} — overspeed, harsh braking & harsh acceleration turut menambah tekanan mekanis pada ban.`}
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
          skor perilaku operator <strong>{driverBehavior.operatorName}</strong> yang masih perlu perbaikan (
          <strong>{overallBehaviorScore}/100</strong>), serta kondisi segmen{" "}
          <strong>{mostDangerousSegment.name}</strong> yang cukup berisiko (skor{" "}
          <strong>{mostDangerousSegment.riskScore}</strong>), AI memperkirakan risiko blowout sebesar{" "}
          <strong>{riskScore}%</strong> dalam <strong>{rulDays} hari</strong> ke depan.{" "}
          <strong>
            Lakukan pengecekan fisik segera dan jadwalkan penggantian ban sebelum unit kembali beroperasi
          </strong>{" "}
          — jangan menunggu hingga RUL habis, karena kombinasi suhu tinggi dan tekanan rendah pada tingkat
          degradasi ini meningkatkan risiko blowout mendadak saat unit membawa muatan penuh di jalur menanjak.
          Sambil itu, ingatkan operator untuk mengurangi overspeed dan harsh braking terutama saat melewati{" "}
          {mostDangerousSegment.name}, serta kurangi sementara beban muatan pada unit ini sampai ban diganti.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-[#C84B31] text-white">
            Ganti ban sebelum {rulDays} hari
          </span>
          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white/10 text-white">
            Kurangi beban muatan sementara
          </span>
          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white/10 text-white">
            Coaching operator: overspeed & harsh braking
          </span>
          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white/10 text-white">
            Waspadai {mostDangerousSegment.name}
          </span>
        </div>
      </div>
    </div>
  );
}