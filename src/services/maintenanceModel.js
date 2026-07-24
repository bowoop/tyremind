/**
 * TyreMind — Model Rekomendasi Perawatan & Analisis Biaya/ROI
 *
 * File integrasi lintas-modul: menarik data dari tyreData.js (ban,
 * spesifikasi unit, segmen jalan), payloadModel.js (analisis payload
 * & cycle time), dan tyreSpecModel.js (data resmi Michelin: TKPH,
 * tabel tekanan/beban, koefisien K1/K2) untuk menghasilkan:
 *
 *   BAGIAN 1 — PREDICTIVE TYRE MAINTENANCE
 *   Real Site TKPH (Ton-Kilometer per Hour) per axle (formula resmi
 *   Michelin: Qm x Vm x K1 x K2), rekomendasi rotasi berbasis keausan +
 *   TKPH (BUKAN jam kerja unit), dan tindakan korektif berbasis tekanan
 *   minimum resmi (tabel Pressure/Load Michelin) kalau sensor mendeteksi
 *   tekanan di bawah kebutuhan beban aktual di rute KM 33.
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
 * - TKPH & tekanan minimum SUDAH pakai data resmi "Michelin Tire Database
 *   — HD785" yang diberikan pengguna (lihat services/tyreSpecModel.js).
 *   Nilai default INSTALLED_TYRE_COMPOUND = "B4" (TKPH 528) — GANTI ke
 *   "A" (TKPH 432) di tyreSpecModel.js bila compound aktual di site beda.
 * - Ambang SUHU (TEMP_WARNING_C/TEMP_CRITICAL_C) SUDAH diupdate ke nilai
 *   tervalidasi yang diberikan pengguna langsung (<80°C Good, 80-93°C
 *   Warning, >93°C Critical) — sheet "Temperature_Zones" yang disebut di
 *   README file Excel tidak ada secara fisik di file yang diunggah,
 *   jadi angka ini bersumber dari instruksi eksplisit pengguna, bukan
 *   dibaca langsung dari sheet Excel.
 * - Suhu ambient untuk koreksi K2 pakai DEFAULT_AMBIENT_TEMP_C (asumsi
 *   32°C, tropis) di tyreSpecModel.js — belum ada integrasi data cuaca
 *   live per site.
 * - Semua angka Rupiah & liter BBM di BAGIAN 3 adalah ESTIMASI ILUSTRATIF
 *   untuk business case, BUKAN harga kontrak/biaya aktual situs KPP.
 *   Sumber acuan tiap konstanta dicatat di sebelah nilainya — ganti dengan
 *   angka kontrak/vendor aktual begitu tersedia.
 * - Penurunan downtime/biaya kerusakan TIDAK dihitung dalam Rupiah (lihat
 *   DOWNTIME_RISK_NOTE) karena belum ada data biaya perbaikan historis
 *   situs sebagai dasar — hanya disampaikan sebagai narasi kualitatif.
 */

import {
  computeRealSiteTKPH,
  getMinRequiredPressurePsi,
} from "./tyreSpecModel";

// ─────────────────────────────────────────────
// KONSTANTA ASUMSI — setiap nilai diberi sumber/catatan
// ─────────────────────────────────────────────

export const HAUL_ONE_WAY_KM = 12; // selaras dengan driverBehavior.speedProfile & payloadModel

// Ambang suhu — nilai TERVALIDASI dari pengguna (bukan asumsi lagi):
// <80°C Good/Normal, 80-93°C Warning, >93°C Critical. Sheet
// "Temperature_Zones" yang disebut di README Excel tidak ada secara
// fisik di file yang diunggah, jadi angka ini diberikan langsung oleh
// pengguna, bukan dibaca dari sel Excel — dicatat di sini agar sumbernya
// jelas kalau perlu dikonfirmasi ulang ke datasheet resmi nanti.
export const TEMP_WARNING_C = 80;
export const TEMP_CRITICAL_C = 93;

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
  // ASUMSI: paket sensor kimia EIS + TPMS + node LoRa per unit, mencakup
  // 6 titik ban fisik (2 depan + 4 belakang dual) — naik dari estimasi
  // sebelumnya yang keliru menghitung 4 titik. ~11.25 juta/titik ban.
  sensorKitPerUnitIDR: 67_500_000,
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
 * Menghitung Real Site TKPH resmi Michelin (Qm x Vm x K1 x K2), TERPISAH
 * untuk axle depan & belakang — lihat services/tyreSpecModel.js untuk
 * detail formula & tabel referensinya.
 *
 * Fase "loaded" (membawa GVW penuh) = loading + hauling loaded + dumping.
 * Fase "empty" (unladen) = queue + spotting + return empty. Loading
 * sendiri sebetulnya transisi (berat bertambah bertahap) — disederhanakan
 * masuk fase loaded (konservatif, karena di akhir loading beban sudah
 * penuh).
 */
export function computeTKPHFromCycles(unit, payloadAnalysis, cycleTimeAnalysis, ambientTempC) {
  const avgPayloadTon = payloadAnalysis.totalTonHauled / payloadAnalysis.totalCycles;
  const stage = (key) => cycleTimeAnalysis.avgStageMinutes.find((s) => s.key === key)?.avgActualMinutes || 0;

  const loadedPhaseMinutes = stage("loadingMinutes") + stage("haulingLoadedMinutes") + stage("dumpingMinutes");
  const emptyPhaseMinutes = stage("queueMinutes") + stage("spottingMinutes") + stage("returnEmptyMinutes");
  const totalCycleMinutes = cycleTimeAnalysis.avgTotalMinutes;
  const cycleLengthKm = HAUL_ONE_WAY_KM * 2; // round trip penuh (loaded + empty)

  return computeRealSiteTKPH({
    unit,
    payloadTon: avgPayloadTon,
    loadedPhaseMinutes,
    emptyPhaseMinutes,
    totalCycleMinutes,
    cycleLengthKm,
    ...(ambientTempC !== undefined ? { ambientTempC } : {}),
  });
}

/**
 * Rekomendasi rotasi/penggantian ban — berbasis KEAUSAN (healthScore /
 * materialDegradationPct) DAN Real Site TKPH axle-nya masing-masing
 * (bukan sekadar jam kerja unit).
 */
export function recommendTyreRotation(tyres, tkphResult) {
  return [...tyres]
    .sort((a, b) => a.healthScore - b.healthScore)
    .map((tyre) => {
      const axleTkph = tyre.axle === "FRONT" ? tkphResult.front : tkphResult.rear;
      // Catatan TKPH bersifat per-AXLE (sama untuk semua ban di axle yang
      // sama), jadi ditaruh sebagai tambahan singkat — bukan diulang jadi
      // alasan utama "Tinggi" di semua ban, supaya prioritas tetap
      // dibedakan berdasarkan keausan tiap ban.
      const tkphNote =
        axleTkph.status === "CRITICAL"
          ? ` Real Site TKPH axle ${tyre.axle.toLowerCase()} saat ini ${axleTkph.realSiteTKPH} (${axleTkph.utilizationPct}% dari rating ${axleTkph.tkphRating}) — melebihi batas aman ban, percepat jadwal ini atau pertimbangkan ban rating TKPH lebih tinggi / turunkan kecepatan loaded di rute ini.`
          : axleTkph.status === "WARNING"
          ? ` Real Site TKPH axle ${tyre.axle.toLowerCase()} (${axleTkph.utilizationPct}% dari rating ${axleTkph.tkphRating}) mendekati batas — pertimbangkan percepat jadwal ini.`
          : "";

      let priority = "Rendah";
      let action = `Ban ${tyre.id} dalam kondisi wajar (keausan ${tyre.materialDegradationPct}%) — monitor rutin, belum perlu tindakan.`;

      if (tyre.status === "Critical") {
        priority = "Tinggi";
        action = `Ban ${tyre.id} kondisi kritis (keausan ${tyre.materialDegradationPct}%) — jadwalkan penggantian, JANGAN dirotasi ke posisi lain.${tkphNote}`;
      } else if (tyre.status === "Warning") {
        priority = axleTkph.status === "CRITICAL" ? "Tinggi" : "Sedang";
        action = `Jadwalkan rotasi ban ${tyre.id} dalam waktu dekat — keausan ${tyre.materialDegradationPct}%.${tkphNote}`;
      } else if (axleTkph.status === "CRITICAL") {
        priority = "Sedang";
        action = `Ban ${tyre.id} keausan masih wajar (${tyre.materialDegradationPct}%), namun${tkphNote} Percepat rotasi ban ini juga sebagai antisipasi.`;
      }

      return { tyreId: tyre.id, position: tyre.position, axle: tyre.axle, healthScore: tyre.healthScore, priority, action };
    });
}

/**
 * Tindakan korektif kalau sensor mendeteksi suhu abnormal ATAU tekanan
 * di bawah kebutuhan MINIMUM resmi (tabel Pressure/Load Michelin) untuk
 * beban aktual axle ban tsb — dikaitkan dengan segmen rute (mis. KM 33)
 * yang sedang dilalui.
 */
export function recommendCorrectiveActions(tyres, mostDangerousSegment, tkphResult) {
  const actions = [];
  tyres.forEach((tyre) => {
    const loadedKg = tyre.axle === "FRONT" ? tkphResult.axleLoads.frontLoadedKg : tkphResult.axleLoads.rearLoadedKg;
    const minRequiredPsi = getMinRequiredPressurePsi(loadedKg);

    const tempAbnormal = tyre.temperatureCelcius >= TEMP_WARNING_C;
    const pressureAbnormal = tyre.pressurePsi < minRequiredPsi;
    if (!tempAbnormal && !pressureAbnormal) return;

    const pressureDeficitPsi = round1(minRequiredPsi - tyre.pressurePsi);
    const severity = tyre.temperatureCelcius >= TEMP_CRITICAL_C || pressureDeficitPsi >= 10 ? "Tinggi" : "Sedang";

    const parts = [];
    if (tempAbnormal) parts.push(`suhu ${tyre.temperatureCelcius}°C di atas ambang aman`);
    if (pressureAbnormal) {
      parts.push(
        `tekanan ${tyre.pressurePsi} PSI di bawah minimum resmi ${minRequiredPsi} PSI untuk beban aktual ${Math.round(
          loadedKg
        ).toLocaleString("id-ID")} kg (kurang ${pressureDeficitPsi} PSI, tabel Pressure/Load Michelin 27.00R49)`
      );
    }

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
 * Siklus penggantian "sebelum" dihitung dari RUL rata-rata (jam
 * operasional) & rata-rata jam operasional harian unit yang SUDAH ADA di
 * tyreData.js — bukan asumsi baru. Proyeksi "sesudah" adalah pendekatan
 * linear sederhana (lihat catatan metodologi).
 */
export function estimateTyreCostSaving(rulExtensionPct, unit, assumptions = COST_ASSUMPTIONS) {
  const avgRulHours = unit.tyres.reduce((s, t) => s + t.remainingUsefulLifeHours, 0) / unit.tyres.length;
  const dailyOperatingHours = unit.operationalMetrics.averageDailyOperatingHours;
  const tyreLifeDaysBefore = avgRulHours / dailyOperatingHours;
  const tyreCount = unit.tyres.length;

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

// Rentang persentase penurunan downtime — BUKAN dihitung dari data operasional situs KPP
// (masih belum ada data biaya perbaikan/downtime historis, lihat DOWNTIME_RISK_NOTE),
// melainkan dikutip dari materi presentasi internal "Dampak terhadap Produktivitas, Biaya
// Operasional, dan Keselamatan" (estimasi skala 100 unit Komatsu HD785). Ditampilkan sebagai
// referensi kualitatif pendukung, bukan proyeksi Rupiah per unit.
export const DOWNTIME_REDUCTION_RANGE_PCT = { minPct: 15, maxPct: 30 };

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