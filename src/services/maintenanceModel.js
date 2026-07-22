/**
 * TyreMind — Model Rekomendasi Perawatan & Analisis Biaya/ROI
 *
 * File integrasi lintas-modul: menarik data dari tyreData.js (ban,
 * spesifikasi unit, segmen jalan) dan payloadModel.js (analisis payload
 * & cycle time) untuk menghasilkan:
 *
 *   BAGIAN 1 — PREDICTIVE TYRE MAINTENANCE
 *   TKPH (Ton-Kilometer per Hour) per ban, rekomendasi rotasi berbasis
 *   keausan + TKPH (BUKAN jam kerja unit), dan tindakan korektif kalau
 *   sensor mendeteksi suhu/tekanan abnormal di rute KM 33.
 *
 *   BAGIAN 2 — KALIBRASI & PERAWATAN UNIT HD785
 *   Rekomendasi kalibrasi Payload Meter (PLM) & suspensi, serta inspeksi
 *   vessel/frame akibat potensi dampak muatan tidak seimbang.
 *
 *   BAGIAN 3 — ANALISIS BIAYA & PENGHEMATAN (Cost Impact & ROI)
 *   Estimasi penghematan biaya ban, efisiensi BBM, dan payback period
 *   CapEx vs OpEx.
 *
 * ⚠️ CATATAN METODOLOGI — PENTING dibaca sebelum dipakai untuk pitch/keputusan:
 * - Semua angka Rupiah & liter BBM di BAGIAN 3 adalah ESTIMASI ILUSTRATIF
 *   untuk business case, BUKAN harga kontrak/biaya aktual situs KPP.
 *   Sumber acuan tiap konstanta dicatat di sebelah nilainya — ganti dengan
 *   angka kontrak/vendor aktual begitu tersedia.
 * - TYRE_TKPH_RATING (380) adalah asumsi ilustratif berbasis rentang umum
 *   ban OTR E4 ukuran 27.00R49, BUKAN datasheet resmi merek ban terpasang.
 * - Penurunan downtime/biaya kerusakan TIDAK dihitung dalam Rupiah (lihat
 *   DOWNTIME_RISK_NOTE) karena belum ada data biaya perbaikan historis
 *   situs sebagai dasar — hanya disampaikan sebagai narasi kualitatif.
 */

// ─────────────────────────────────────────────
// KONSTANTA ASUMSI — setiap nilai diberi sumber/catatan
// ─────────────────────────────────────────────

export const HAUL_ONE_WAY_KM = 12; // selaras dengan driverBehavior.speedProfile & payloadModel

// ASUMSI ilustratif — rating TKPH umum ban OTR E4 27.00R49 (rentang duty
// standard-heavy ~300-450). Ganti dengan datasheet resmi ban terpasang.
export const TYRE_TKPH_RATING = 380;

// Ambang suhu/tekanan — DISELARASKAN dengan kategori TyreStatus yang sudah
// dipakai di tyreData.js (Normal/Warning/Critical), bukan angka baru.
export const TEMP_WARNING_C = 65;
export const TEMP_CRITICAL_C = 75;
export const PRESSURE_WARNING_PSI = 100;
export const PRESSURE_CRITICAL_PSI = 90;

export const COST_ASSUMPTIONS = {
  // Referensi listing ban OTR 27.00R49 di marketplace alat berat Indonesia
  // (MINEQ Indonesia, 2026) — harga kontrak/nego bisa berbeda signifikan.
  tyreUnitPriceIDR: 170_000_000,
  // Referensi harga BBM industri non-subsidi (HSFO/solar industri) awal
  // 2026 — SANGAT fluktuatif mengikuti harga minyak mentah & kurs, ganti
  // dengan harga kontrak BBM aktual situs.
  fuelPriceIDRPerLiter: 13_000,
  // Titik tengah rentang "medium duty" pada Komatsu Owning & Operating
  // Cost Guide untuk HD785-7 (65.5–83.6 liter/jam kondisi mining).
  fuelConsumptionHaulingLph: 74,
  // ASUMSI konsumsi BBM saat idle/antre (belum ada data aktual site).
  fuelConsumptionIdleLph: 12,
  workingDaysPerYear: 330, // ASUMSI kalender operasi, sesuaikan situs
};

export const CAPEX_ASSUMPTIONS = {
  // ASUMSI: paket sensor kimia EIS + TPMS + node LoRa per unit (4 titik ban)
  sensorKitPerUnitIDR: 45_000_000,
  // ASUMSI: setup dashboard, gateway LoRa, integrasi PLM/FMS (biaya sekali)
  platformSetupOneTimeIDR: 150_000_000,
  // ASUMSI: lisensi software & maintenance sistem per unit per tahun
  annualPlatformFeePerUnitIDR: 8_000_000,
};

function round1(n) {
  return Math.round(n * 10) / 10;
}

// ─────────────────────────────────────────────
// BAGIAN 1 — TKPH & PREDICTIVE TYRE MAINTENANCE
// ─────────────────────────────────────────────

/**
 * Menghitung TKPH (Ton-Kilometer per Hour) per ban dari GVW (empty + rata-rata
 * payload) dan kecepatan rata-rata loaded/empty (dari cycle time). TKPH
 * dihitung time-weighted antara fase loaded & empty dalam 1 ritase.
 */
export function computeTKPH(unit, avgPayloadTon, haulingLoadedMinutes, returnEmptyMinutes, oneWayKm = HAUL_ONE_WAY_KM) {
  const tyreCount = unit.physicalTyreCount ?? unit.tyres.length;
  const loadedGrossTon = unit.emptyWeightTon + avgPayloadTon;
  const emptyGrossTon = unit.emptyWeightTon;

  const avgSpeedLoadedKmh = haulingLoadedMinutes > 0 ? oneWayKm / (haulingLoadedMinutes / 60) : 0;
  const avgSpeedEmptyKmh = returnEmptyMinutes > 0 ? oneWayKm / (returnEmptyMinutes / 60) : 0;

  const tkphLoaded = (loadedGrossTon / tyreCount) * avgSpeedLoadedKmh;
  const tkphEmpty = (emptyGrossTon / tyreCount) * avgSpeedEmptyKmh;

  const totalMinutes = haulingLoadedMinutes + returnEmptyMinutes;
  const tkphWeighted =
    totalMinutes > 0 ? (tkphLoaded * haulingLoadedMinutes + tkphEmpty * returnEmptyMinutes) / totalMinutes : 0;

  return {
    avgSpeedLoadedKmh: round1(avgSpeedLoadedKmh),
    avgSpeedEmptyKmh: round1(avgSpeedEmptyKmh),
    tkphLoaded: round1(tkphLoaded),
    tkphEmpty: round1(tkphEmpty),
    tkphWeighted: round1(tkphWeighted),
  };
}

export function tkphUtilizationStatus(tkphWeighted, rating = TYRE_TKPH_RATING) {
  const utilizationPct = round1((tkphWeighted / rating) * 100);
  let status = "NORMAL";
  if (utilizationPct >= 100) status = "CRITICAL";
  else if (utilizationPct >= 85) status = "WARNING";
  return { utilizationPct, status, rating };
}

/**
 * Rekomendasi rotasi/penggantian ban — berbasis KEAUSAN (healthScore /
 * materialDegradationPct) DAN TKPH unit, bukan sekadar jam kerja unit.
 */
export function recommendTyreRotation(tyres, tkphStatus) {
  // Catatan TKPH bersifat UNIT-LEVEL (sama untuk semua ban), jadi ditaruh
  // sebagai tambahan singkat pada baris yang relevan — bukan diulang jadi
  // alasan utama "Tinggi" di semua ban, supaya prioritas tetap dibedakan
  // berdasarkan keausan tiap ban.
  const tkphNote =
    tkphStatus.status === "CRITICAL"
      ? ` TKPH duty cycle unit saat ini (${tkphStatus.utilizationPct}% dari rating ${tkphStatus.rating}) melebihi batas aman ban — percepat jadwal ini, atau pertimbangkan ban rating TKPH lebih tinggi / turunkan kecepatan loaded di rute ini.`
      : tkphStatus.status === "WARNING"
      ? ` TKPH duty cycle unit (${tkphStatus.utilizationPct}% dari rating ${tkphStatus.rating}) mendekati batas — pertimbangkan percepat jadwal ini.`
      : "";

  return [...tyres]
    .sort((a, b) => a.healthScore - b.healthScore)
    .map((tyre) => {
      let priority = "Rendah";
      let action = `Ban ${tyre.id} dalam kondisi wajar (keausan ${tyre.materialDegradationPct}%) — monitor rutin, belum perlu tindakan.`;

      if (tyre.status === "Critical") {
        priority = "Tinggi";
        action = `Ban ${tyre.id} kondisi kritis (keausan ${tyre.materialDegradationPct}%) — jadwalkan penggantian, JANGAN dirotasi ke posisi lain.${tkphNote}`;
      } else if (tyre.status === "Warning") {
        priority = tkphStatus.status === "CRITICAL" ? "Tinggi" : "Sedang";
        action = `Jadwalkan rotasi ban ${tyre.id} dalam waktu dekat — keausan ${tyre.materialDegradationPct}%.${tkphNote}`;
      } else if (tkphStatus.status === "CRITICAL") {
        priority = "Sedang";
        action = `Ban ${tyre.id} keausan masih wajar (${tyre.materialDegradationPct}%), namun${tkphNote} Percepat rotasi ban ini juga sebagai antisipasi.`;
      }

      return { tyreId: tyre.id, position: tyre.position, healthScore: tyre.healthScore, priority, action };
    });
}

/**
 * Tindakan korektif kalau sensor mendeteksi suhu/tekanan abnormal —
 * dikaitkan dengan segmen rute (mis. KM 33) yang sedang dilalui.
 */
export function recommendCorrectiveActions(tyres, mostDangerousSegment) {
  const actions = [];
  tyres.forEach((tyre) => {
    const tempAbnormal = tyre.temperatureCelcius >= TEMP_WARNING_C;
    const pressureAbnormal = tyre.pressurePsi <= PRESSURE_WARNING_PSI;
    if (!tempAbnormal && !pressureAbnormal) return;

    const severity =
      tyre.temperatureCelcius >= TEMP_CRITICAL_C || tyre.pressurePsi <= PRESSURE_CRITICAL_PSI ? "Tinggi" : "Sedang";

    const parts = [];
    if (tempAbnormal) parts.push(`suhu ${tyre.temperatureCelcius}°C di atas ambang aman`);
    if (pressureAbnormal) parts.push(`tekanan ${tyre.pressurePsi} PSI di bawah rentang normal`);

    actions.push({
      tyreId: tyre.id,
      position: tyre.position,
      severity,
      message:
        `Ban ${tyre.id} (${tyre.position}): ${parts.join(", ")}. Terdeteksi pada rute ${mostDangerousSegment.name} ` +
        `(${mostDangerousSegment.tyreImpactNote}) — lakukan pemeriksaan fisik & tekanan ulang sebelum ritase ` +
        `berikutnya${severity === "Tinggi" ? ", pertimbangkan turunkan unit dari operasi sementara" : ""}.`,
    });
  });
  return actions;
}

// ─────────────────────────────────────────────
// BAGIAN 2 — KALIBRASI & PERAWATAN UNIT HD785
// ─────────────────────────────────────────────

/**
 * Rekomendasi kalibrasi PLM (Payload Meter) & suspensi. Drift PLM sulit
 * dideteksi langsung tanpa sensor pembanding — sebagai proxy, frekuensi
 * ritase di luar pita toleransi payload yang TINGGI dijadikan sinyal
 * kemungkinan drift, bukan semata pola loading operator.
 */
export function recommendPLMCalibration(payloadAnalysis) {
  const abnormalFreqPct = payloadAnalysis.underloadFreqPct + payloadAnalysis.overloadFreqPct;
  let status = "Normal";
  let note = "Distribusi payload masih dalam pola wajar operator — kalibrasi PLM & suspensi sesuai jadwal rutin standar.";

  if (abnormalFreqPct >= 60) {
    status = "Segera Diperiksa";
    note = `${abnormalFreqPct}% ritase hari ini berada di luar pita toleransi payload — indikasi kemungkinan drift pada Payload Meter (PLM) atau sensor suspensi, bukan semata perilaku loading. Jadwalkan kalibrasi PLM & suspensi segera, di luar siklus rutin.`;
  } else if (abnormalFreqPct >= 40) {
    status = "Pantau";
    note = `${abnormalFreqPct}% ritase di luar pita toleransi — masih dalam batas wajar variasi operator, tapi pantau tren beberapa shift ke depan; percepat jadwal kalibrasi PLM bila berlanjut.`;
  }

  return { abnormalFreqPct, status, note };
}

/**
 * Rekomendasi inspeksi vessel/frame — dipicu akumulasi kelebihan beban
 * (overload) yang berpotensi menyebabkan stres struktural tidak merata.
 */
export function recommendFrameVesselInspection(payloadAnalysis) {
  const { overloadExcessTon, overloadCount } = payloadAnalysis;
  let status = "Normal";
  let note = "Belum ada indikasi beban tidak seimbang signifikan pada vessel/frame hari ini.";

  if (overloadCount >= 3 || overloadExcessTon >= 30) {
    status = "Perlu Inspeksi";
    note = `Akumulasi ${overloadExcessTon} ton kelebihan beban dari ${overloadCount} ritase overload hari ini — periksa area vessel (dudukan/pengelasan) & frame untuk indikasi keretakan atau deformasi dini akibat beban tidak seimbang berulang.`;
  } else if (overloadCount >= 1) {
    status = "Pantau";
    note = `Ada ${overloadCount} ritase overload hari ini (+${overloadExcessTon} ton) — belum kritis, masukkan ke checklist inspeksi visual rutin berikutnya.`;
  }

  return { status, note, overloadExcessTon, overloadCount };
}

// ─────────────────────────────────────────────
// BAGIAN 3 — ANALISIS BIAYA & PENGHEMATAN (Cost Impact & ROI)
// ─────────────────────────────────────────────

/**
 * Estimasi penghematan biaya ban dari perpanjangan umur pakai (RUL) X%.
 * Siklus penggantian "sebelum" dihitung dari RUL rata-rata & jarak tempuh
 * harian unit yang SUDAH ADA di tyreData.js — bukan asumsi baru. Proyeksi
 * "sesudah" adalah pendekatan linear sederhana (lihat catatan metodologi).
 */
export function estimateTyreCostSaving(rulExtensionPct, unit, assumptions = COST_ASSUMPTIONS) {
  const avgRulKm = unit.tyres.reduce((s, t) => s + t.remainingUsefulLifeKm, 0) / unit.tyres.length;
  const dailyKm = unit.operationalMetrics.averageDailyDistanceKm;
  const tyreLifeDaysBefore = avgRulKm / dailyKm;
  const tyreCount = unit.physicalTyreCount ?? unit.tyres.length;

  const replacementsPerYearBefore = (365 / tyreLifeDaysBefore) * tyreCount;
  const annualTyreCostBefore = replacementsPerYearBefore * assumptions.tyreUnitPriceIDR;

  const tyreLifeDaysAfter = tyreLifeDaysBefore * (1 + rulExtensionPct / 100);
  const replacementsPerYearAfter = (365 / tyreLifeDaysAfter) * tyreCount;
  const annualTyreCostAfter = replacementsPerYearAfter * assumptions.tyreUnitPriceIDR;

  return {
    rulExtensionPct,
    tyreLifeDaysBefore: round1(tyreLifeDaysBefore),
    tyreLifeDaysAfter: round1(tyreLifeDaysAfter),
    replacementsPerYearBefore: round1(replacementsPerYearBefore),
    replacementsPerYearAfter: round1(replacementsPerYearAfter),
    annualTyreCostBefore: Math.round(annualTyreCostBefore),
    annualTyreCostAfter: Math.round(annualTyreCostAfter),
    annualSavingIDR: Math.round(annualTyreCostBefore - annualTyreCostAfter),
  };
}

/**
 * Estimasi efisiensi BBM dari (a) berkurangnya ritase mubazir akibat
 * underload dan (b) berkurangnya queue time berlebih (idle burn).
 */
export function estimateFuelSaving(payloadAnalysis, cycleTimeAnalysis, assumptions = COST_ASSUMPTIONS) {
  const tripFuelLiter = (cycleTimeAnalysis.targetTotalMinutes / 60) * assumptions.fuelConsumptionHaulingLph;
  const dailyWastedTripsFuelLiter = payloadAnalysis.estimatedExtraTripsFromUnderload * tripFuelLiter;
  const annualWastedTripsFuelLiter = dailyWastedTripsFuelLiter * assumptions.workingDaysPerYear;

  const queueStage = cycleTimeAnalysis.avgStageMinutes.find((s) => s.key === "queueMinutes");
  const dailyQueueOverMinutes = Math.max(0, (queueStage?.deviationMinutes || 0) * cycleTimeAnalysis.totalCycles);
  const annualQueueOverFuelLiter =
    (dailyQueueOverMinutes / 60) * assumptions.fuelConsumptionIdleLph * assumptions.workingDaysPerYear;

  const totalAnnualFuelSavedLiter = annualWastedTripsFuelLiter + annualQueueOverFuelLiter;

  return {
    annualWastedTripsFuelLiter: Math.round(annualWastedTripsFuelLiter),
    annualQueueOverFuelLiter: Math.round(annualQueueOverFuelLiter),
    totalAnnualFuelSavedLiter: Math.round(totalAnnualFuelSavedLiter),
    annualSavingIDR: Math.round(totalAnnualFuelSavedLiter * assumptions.fuelPriceIDRPerLiter),
  };
}

export const DOWNTIME_RISK_NOTE =
  "Penurunan downtime/biaya kerusakan (sasis, transmisi, blown tyre) belum dihitung dalam Rupiah karena belum " +
  "ada data biaya perbaikan & downtime historis situs KPP sebagai dasar. Secara kualitatif, menurunkan frekuensi " +
  "overload serta suhu/tekanan abnormal (lihat Rekomendasi Perawatan) mengurangi paparan risiko blown tyre dan " +
  "keretakan frame/vessel — estimasi kuantitatif dapat ditambahkan begitu data downtime/repair cost historis tersedia.";

/**
 * Ringkasan CapEx vs OpEx & payback period. unitCount default 1 (fleet
 * MVP saat ini hanya 1 unit DT001) — kalikan sesuai jumlah unit HD785
 * aktual di fleet untuk proyeksi skala penuh.
 */
export function estimateROISummary(tyreSaving, fuelSaving, unitCount = 1, assumptions = CAPEX_ASSUMPTIONS) {
  const totalAnnualSavingIDR = (tyreSaving.annualSavingIDR + fuelSaving.annualSavingIDR) * unitCount;

  const capExIDR = assumptions.sensorKitPerUnitIDR * unitCount + assumptions.platformSetupOneTimeIDR;
  const annualOpExIDR = assumptions.annualPlatformFeePerUnitIDR * unitCount;
  const netAnnualSavingIDR = totalAnnualSavingIDR - annualOpExIDR;
  const paybackMonths = netAnnualSavingIDR > 0 ? round1((capExIDR / netAnnualSavingIDR) * 12) : null;

  return {
    unitCount,
    totalAnnualSavingIDR: Math.round(totalAnnualSavingIDR),
    capExIDR: Math.round(capExIDR),
    annualOpExIDR: Math.round(annualOpExIDR),
    netAnnualSavingIDR: Math.round(netAnnualSavingIDR),
    paybackMonths,
  };
}
