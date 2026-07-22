/**
 * TyreMind — Model Payload & Cycle Time Hauler
 *
 * File ini punya DUA bagian yang sengaja digabung karena sumber datanya
 * sama (payloadCycles) dan dipakai berdampingan di halaman Road
 * Intelligence & Payload Hauler:
 *
 *   BAGIAN 1 — PAYLOAD MANAGEMENT
 *   Menjawab tantangan bisnis "Optimalisasi Payload Hauler HD785":
 *   underload menurunkan efisiensi (perlu lebih banyak ritase untuk
 *   tonase yang sama), overload menaikkan risiko kerusakan unit & ban
 *   serta risiko keselamatan kerja.
 *
 *   BAGIAN 2 — CYCLE TIME MANAGEMENT
 *   Menjawab tantangan bisnis "Management Cycle Time Hauler": memecah
 *   waktu edar 1 ritase jadi 6 tahapan (queue, spotting, loading,
 *   hauling loaded, dumping, return empty) dan mengidentifikasi tahap
 *   mana yang paling sering jadi bottleneck.
 *
 * Model ini MURNI kalkulasi dari data ritase (payloadCycles) vs rated
 * payload pabrikan unit (ratedPayloadTon) & target waktu per tahap —
 * tidak ada nilai yang di-hardcode terpisah dari data tersebut.
 *
 * ⚠️ CATATAN METODOLOGI (baca sebelum dipakai untuk keputusan operasional):
 * - PAYLOAD_TOLERANCE_BAND_PCT (±10%) adalah ASUMSI ILUSTRATIF berbasis
 *   praktik umum industri tambang (target payload factor ~90-110% dari
 *   rated payload), BUKAN SOP resmi KPP. Sesuaikan begitu SOP toleransi
 *   payload situs tersedia.
 * - Estimasi "ritase tambahan akibat underload" adalah proyeksi linear
 *   sederhana (tonase yang hilang / rated payload), bukan simulasi
 *   cycle time penuh — belum memperhitungkan antrian loading, jarak
 *   tempuh aktual per ritase, atau variasi material.
 * - TARGET_STAGE_MINUTES (queue/spotting/loading/dumping/return) adalah
 *   ASUMSI ILUSTRATIF berbasis rentang wajar operasi excavator-HD785 di
 *   industri tambang, BUKAN SOP/standard time resmi KPP. haulingLoaded
 *   diturunkan dari rute ~12 km & speedProfile yang sama dengan
 *   driverBehavior di tyreData.js, jadi konsisten dengan modul Operator.
 * - Belum ada estimasi biaya dalam Rupiah (BBM, maintenance, dsb) karena
 *   data unit-cost belum diintegrasikan — angka yang ditampilkan sebatas
 *   ton, menit & persentase, bukan proyeksi finansial.
 */

// ─────────────────────────────────────────────
// BAGIAN 1 — PAYLOAD MANAGEMENT
// ─────────────────────────────────────────────

export const PAYLOAD_TOLERANCE_BAND_PCT = 10; // ± dari rated payload, lihat catatan di atas

/**
 * Mengklasifikasikan satu ritase terhadap rated payload + tolerance band.
 */
export function classifyPayload(loadedTon, ratedTon, tolerancePct = PAYLOAD_TOLERANCE_BAND_PCT) {
  const utilizationPct = (loadedTon / ratedTon) * 100;
  const lowerBoundPct = 100 - tolerancePct;
  const upperBoundPct = 100 + tolerancePct;

  let payloadClass;
  if (utilizationPct < lowerBoundPct) payloadClass = "UNDERLOAD";
  else if (utilizationPct > upperBoundPct) payloadClass = "OVERLOAD";
  else payloadClass = "OPTIMAL";

  return {
    utilizationPct: Math.round(utilizationPct * 10) / 10,
    deviationTon: Math.round((loadedTon - ratedTon) * 10) / 10,
    payloadClass,
  };
}

/**
 * Menganalisis seluruh daftar ritase (payloadCycles) menjadi:
 * - detail per-ritase (klasifikasi + utilisasi)
 * - agregat (rata-rata utilisasi, frekuensi underload/overload, skor kepatuhan)
 * - estimasi dampak produktivitas (ton yang "hilang" akibat underload) dan
 *   paparan risiko (ton kelebihan beban akibat overload)
 */
export function analyzePayloadCycles(cycles, ratedTon, tolerancePct = PAYLOAD_TOLERANCE_BAND_PCT) {
  const details = cycles.map((cycle) => ({
    ...cycle,
    ...classifyPayload(cycle.loadedTon, ratedTon, tolerancePct),
  }));

  const total = details.length || 1;
  const underloadCycles = details.filter((d) => d.payloadClass === "UNDERLOAD");
  const overloadCycles = details.filter((d) => d.payloadClass === "OVERLOAD");
  const optimalCycles = details.filter((d) => d.payloadClass === "OPTIMAL");

  const totalTonHauled = details.reduce((sum, d) => sum + d.loadedTon, 0);
  const avgUtilizationPct =
    details.reduce((sum, d) => sum + d.utilizationPct, 0) / total;

  // Ton yang "hilang" dari kapasitas unit karena ritase underload —
  // basis estimasi ritase tambahan yang dibutuhkan untuk tonase sama.
  const lostCapacityTon = underloadCycles.reduce(
    (sum, d) => sum + Math.max(0, ratedTon - d.loadedTon),
    0
  );
  // Estimasi ritase tambahan (proyeksi linear, lihat catatan metodologi di atas)
  const estimatedExtraTripsFromUnderload = lostCapacityTon / ratedTon;

  // Ton kelebihan beban di atas rated payload — bukan produktivitas,
  // murni indikator paparan risiko mekanis/keselamatan.
  const overloadExcessTon = overloadCycles.reduce(
    (sum, d) => sum + Math.max(0, d.loadedTon - ratedTon),
    0
  );

  const complianceScorePct = Math.round((optimalCycles.length / total) * 100);

  return {
    details,
    ratedTon,
    tolerancePct,
    totalCycles: details.length,
    totalTonHauled: Math.round(totalTonHauled * 10) / 10,
    avgUtilizationPct: Math.round(avgUtilizationPct * 10) / 10,
    underloadCount: underloadCycles.length,
    overloadCount: overloadCycles.length,
    optimalCount: optimalCycles.length,
    underloadFreqPct: Math.round((underloadCycles.length / total) * 100),
    overloadFreqPct: Math.round((overloadCycles.length / total) * 100),
    complianceScorePct,
    lostCapacityTon: Math.round(lostCapacityTon * 10) / 10,
    estimatedExtraTripsFromUnderload: Math.round(estimatedExtraTripsFromUnderload * 10) / 10,
    overloadExcessTon: Math.round(overloadExcessTon * 10) / 10,
  };
}

// ─────────────────────────────────────────────
// BAGIAN 2 — CYCLE TIME MANAGEMENT
//
// Waktu edar (round trip) 1 ritase HD785 terdiri dari 6 tahapan:
//   1. Queue Time            — antre di front loading (KM 33)
//   2. Spotting Time         — manuver posisi di bawah excavator
//   3. Loading Time          — pengisian muatan oleh excavator
//   4. Hauling Time (Loaded) — tempuh bermuatan KM 33 → Port
//   5. Dumping Time          — manuver & bongkar muatan di Port
//   6. Return Time (Empty)   — tempuh kosong Port → KM 33
// ─────────────────────────────────────────────

export const CYCLE_STAGES = [
  { key: "queueMinutes", label: "Queue Time", shortLabel: "Queue" },
  { key: "spottingMinutes", label: "Spotting Time", shortLabel: "Spotting" },
  { key: "loadingMinutes", label: "Loading Time", shortLabel: "Loading" },
  { key: "haulingLoadedMinutes", label: "Hauling Time (Loaded)", shortLabel: "Hauling (Loaded)" },
  { key: "dumpingMinutes", label: "Dumping Time", shortLabel: "Dumping" },
  { key: "returnEmptyMinutes", label: "Return Time (Empty)", shortLabel: "Return (Empty)" },
];

// Target waktu per tahap — ASUMSI ILUSTRATIF (lihat catatan metodologi di
// atas), dipakai sebagai garis pembanding untuk deteksi bottleneck, bukan
// SOP resmi. haulingLoadedMinutes diselaraskan dengan rute ~12 km &
// speedProfile di driverBehavior (tyreData.js).
export const TARGET_STAGE_MINUTES = {
  queueMinutes: 3.0,
  spottingMinutes: 1.2,
  loadingMinutes: 3.5,
  haulingLoadedMinutes: 25.0,
  dumpingMinutes: 1.3,
  returnEmptyMinutes: 17.5,
};

export const TARGET_CYCLE_TIME_MINUTES = Object.values(TARGET_STAGE_MINUTES).reduce((a, b) => a + b, 0);

function totalCycleTime(breakdown) {
  return CYCLE_STAGES.reduce((sum, stage) => sum + (breakdown[stage.key] || 0), 0);
}

/**
 * Menganalisis satu ritase: total waktu edar, deviasi tiap tahap vs
 * target, dan tahap mana yang paling besar kontribusinya terhadap
 * keterlambatan (bottleneck ritase ini).
 */
export function analyzeCycleTime(breakdown, targetStageMinutes = TARGET_STAGE_MINUTES) {
  const totalMinutes = totalCycleTime(breakdown);
  const targetTotalMinutes = Object.values(targetStageMinutes).reduce((a, b) => a + b, 0);

  const stages = CYCLE_STAGES.map((stage) => {
    const actual = breakdown[stage.key] || 0;
    const target = targetStageMinutes[stage.key] || 0;
    return {
      key: stage.key,
      label: stage.label,
      shortLabel: stage.shortLabel,
      actualMinutes: Math.round(actual * 10) / 10,
      targetMinutes: Math.round(target * 10) / 10,
      deviationMinutes: Math.round((actual - target) * 10) / 10,
      sharePct: totalMinutes > 0 ? Math.round((actual / totalMinutes) * 1000) / 10 : 0,
    };
  });

  const bottleneckStage = [...stages].sort((a, b) => b.deviationMinutes - a.deviationMinutes)[0];

  return {
    totalMinutes: Math.round(totalMinutes * 10) / 10,
    targetTotalMinutes: Math.round(targetTotalMinutes * 10) / 10,
    deviationMinutes: Math.round((totalMinutes - targetTotalMinutes) * 10) / 10,
    stages,
    bottleneckStage,
  };
}

/**
 * Menganalisis seluruh daftar ritase menjadi agregat cycle time:
 * rata-rata total & per tahap, tahap yang PALING SERING jadi bottleneck
 * lintas ritase, dan estimasi potensi ritase tambahan per shift kalau
 * cycle time ditekan ke target.
 *
 * shiftMinutes = durasi 1 shift kerja, default 600 menit (10 jam) —
 * ASUMSI, sesuaikan dengan jam kerja shift aktual situs.
 */
export function analyzeCycleTimeForCycles(cycles, targetStageMinutes = TARGET_STAGE_MINUTES, shiftMinutes = 600) {
  const perCycle = cycles.map((cycle) => ({
    cycleId: cycle.cycleId,
    timeLabel: cycle.timeLabel,
    ...analyzeCycleTime(cycle.cycleTimeBreakdown, targetStageMinutes),
  }));

  const total = perCycle.length || 1;
  const avgTotalMinutes = perCycle.reduce((sum, c) => sum + c.totalMinutes, 0) / total;
  const targetTotalMinutes = Object.values(targetStageMinutes).reduce((a, b) => a + b, 0);

  const avgStageMinutes = CYCLE_STAGES.map((stage) => {
    const avgActual = perCycle.reduce((sum, c) => {
      const found = c.stages.find((s) => s.key === stage.key);
      return sum + (found ? found.actualMinutes : 0);
    }, 0) / total;
    return {
      key: stage.key,
      label: stage.label,
      shortLabel: stage.shortLabel,
      avgActualMinutes: Math.round(avgActual * 10) / 10,
      targetMinutes: Math.round((targetStageMinutes[stage.key] || 0) * 10) / 10,
      deviationMinutes: Math.round((avgActual - (targetStageMinutes[stage.key] || 0)) * 10) / 10,
    };
  });

  // Tahap yang paling sering jadi bottleneck (deviasi terbesar) di antara ritase
  const bottleneckTally = {};
  perCycle.forEach((c) => {
    const key = c.bottleneckStage?.key;
    if (key) bottleneckTally[key] = (bottleneckTally[key] || 0) + 1;
  });
  const mostFrequentBottleneckKey = Object.entries(bottleneckTally).sort((a, b) => b[1] - a[1])[0]?.[0];
  const mostFrequentBottleneck =
    avgStageMinutes.find((s) => s.key === mostFrequentBottleneckKey) || null;

  // Potensi ritase tambahan per shift kalau avg cycle time ditekan ke target
  const currentTripsPerShift = shiftMinutes / avgTotalMinutes;
  const targetTripsPerShift = shiftMinutes / targetTotalMinutes;
  const potentialExtraTripsPerShift = targetTripsPerShift - currentTripsPerShift;

  return {
    totalCycles: perCycle.length,
    perCycle,
    avgTotalMinutes: Math.round(avgTotalMinutes * 10) / 10,
    targetTotalMinutes: Math.round(targetTotalMinutes * 10) / 10,
    avgDeviationMinutes: Math.round((avgTotalMinutes - targetTotalMinutes) * 10) / 10,
    avgStageMinutes,
    mostFrequentBottleneck,
    shiftMinutes,
    currentTripsPerShift: Math.round(currentTripsPerShift * 10) / 10,
    targetTripsPerShift: Math.round(targetTripsPerShift * 10) / 10,
    potentialExtraTripsPerShift: Math.round(potentialExtraTripsPerShift * 10) / 10,
  };
}