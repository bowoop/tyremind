/**
 * TyreMind — Spesifikasi & Tabel Referensi Ban (Michelin Earthmover Databook)
 *
 * SELURUH angka di file ini bersumber dari data yang diberikan pengguna:
 * "Michelin Tire Database — HD785" (disusun dari Michelin Technical Data
 * 2025 Edition + manual resmi Komatsu CEN00136-09 HD785-7). File ini
 * MENGGANTIKAN asumsi ilustratif sebelumnya (rating TKPH 380, ambang
 * tekanan tetap 90/100 PSI) dengan data tervalidasi.
 *
 * ⚠️ GAP DATA YANG PERLU DIKONFIRMASI:
 * - Sheet "Temperature_Zones" & "Unit_Conversion" DISEBUT di README file
 *   Excel yang diberikan, TAPI TIDAK ADA secara fisik di file (hanya 7
 *   sheet: README, Tire_Master, Pressure_Load_Table, K1_Cycle_Length,
 *   K2_Ambient_Temp, Vehicle_HD785, Tire_Life_Thresholds). Ambang suhu di
 *   maintenanceModel.js (TEMP_WARNING_C/TEMP_CRITICAL_C) BELUM diupdate
 *   dari sumber resmi karena data zona suhu itu belum ada — masih pakai
 *   angka lama sampai sheet tsb tersedia. Satu-satunya angka suhu yang
 *   disebutkan (di catatan README) adalah referensi umum industri OTR
 *   ~120°C untuk batas kegagalan casing/tapak — bukan tabel zona lengkap.
 * - Ban terpasang di site punya 2 varian compound untuk ukuran 27.00R49:
 *   B4 (TKPH 528) dan A (TKPH 432). Default di bawah pakai B4 (lebih umum
 *   untuk haul road tambang) — GANTI INSTALLED_TYRE_COMPOUND bila compound
 *   aktual di site adalah "A".
 *
 * Sumber tiap tabel dicatat per-bagian di bawah.
 */

// ─────────────────────────────────────────────
// TIRE MASTER — ukuran 27.00R49 (dipakai HD785-7)
// Sumber: Michelin Technical Data 2025 Edition (Tire_Master)
// ─────────────────────────────────────────────

export const TIRE_MASTER_27_00R49 = {
  B4: { tireId: "T3", compound: "B4", tkph: 528, tmph: 361.68 },
  A: { tireId: "T4", compound: "A", tkph: 432, tmph: 295.92 },
};

// GANTI ke "A" bila compound ban aktual di site adalah A, bukan B4.
export const INSTALLED_TYRE_COMPOUND = "B4";

export function getInstalledTyreTkphRating(compound = INSTALLED_TYRE_COMPOUND) {
  return TIRE_MASTER_27_00R49[compound]?.tkph ?? TIRE_MASTER_27_00R49.B4.tkph;
}

// ─────────────────────────────────────────────
// PRESSURE vs LOAD CAPACITY — ukuran 27.00R49, compound A & B4 (identik)
// Sumber: Michelin Technical Data 2025 Edition (Pressure_Load_Table)
// ─────────────────────────────────────────────

export const PRESSURE_LOAD_TABLE_27_00R49 = [
    { bar: 3.5, psi: 51, loadMaxKg: 15850, category: "<=27.25T" },
  { bar: 4, psi: 58, loadMaxKg: 18550, category: "<=27.25T" },
  { bar: 4.5, psi: 65, loadMaxKg: 20300, category: "<=27.25T" },
  { bar: 5, psi: 73, loadMaxKg: 22050, category: "<=27.25T" },
  { bar: 5.5, psi: 80, loadMaxKg: 24000, category: "<=27.25T" },
  { bar: 6, psi: 87, loadMaxKg: 25500, category: "<=27.25T" },
  { bar: 6.5, psi: 94, loadMaxKg: 27250, category: "<=27.25T" },
  { bar: 7, psi: 102, loadMaxKg: 29000, category: ">27.25T" },
  { bar: 7.5, psi: 109, loadMaxKg: 30000, category: ">27.25T" },
  { bar: 8, psi: 116, loadMaxKg: 32100, category: ">27.25T" }
];

/**
 * Mencari tekanan minimum (PSI) yang dibutuhkan agar kapasitas beban ban
 * >= beban aktual per ban (interpolasi linear antar baris tabel resmi).
 */
/**
 * Mencari tekanan minimum (PSI) yang dibutuhkan agar kapasitas beban ban
 * >= beban aktual per ban. Mengikuti konvensi resmi Michelin/Komatsu:
 * dibulatkan NAIK ke baris tekanan tertabulasi berikutnya yang kapasitas
 * bebannya sudah mencukupi (BUKAN interpolasi linear — tekanan ban tidak
 * bisa "di antara" 2 spesifikasi resmi untuk keperluan safety margin).
 * Tervalidasi cocok dengan kalkulator resmi di sheet Vehicle_HD785 milik
 * pengguna (mis. beban 28.177 kg → 102 PSI, beban 25.795 kg → 94 PSI).
 */
export function getMinRequiredPressurePsi(loadKg, table = PRESSURE_LOAD_TABLE_27_00R49) {
  const sorted = [...table].sort((a, b) => a.loadMaxKg - b.loadMaxKg);
  const match = sorted.find((row) => row.loadMaxKg >= loadKg);
  return match ? match.psi : sorted[sorted.length - 1].psi;
}

// ─────────────────────────────────────────────
// K1 — koreksi panjang siklus (cycle length), untuk Real Site TKPH
// Real Site TKPH = Basic Site TKPH x K1 x K2
// Sumber: Michelin Technical Data 2025 Edition, hal. 271 (K1_Cycle_Length)
// Berlaku untuk panjang siklus > 5 km. Untuk L <= 5 km, K1 = 1.00.
// ─────────────────────────────────────────────

export const K1_CYCLE_LENGTH_TABLE = [
    { lKm: 5, k1: 1 },
  { lKm: 6, k1: 1.04 },
  { lKm: 7, k1: 1.06 },
  { lKm: 8, k1: 1.09 },
  { lKm: 9, k1: 1.1 },
  { lKm: 10, k1: 1.12 },
  { lKm: 11, k1: 1.13 },
  { lKm: 12, k1: 1.14 },
  { lKm: 13, k1: 1.15 },
  { lKm: 14, k1: 1.16 },
  { lKm: 15, k1: 1.16 },
  { lKm: 16, k1: 1.17 },
  { lKm: 17, k1: 1.17 },
  { lKm: 18, k1: 1.18 },
  { lKm: 19, k1: 1.18 },
  { lKm: 20, k1: 1.19 },
  { lKm: 21, k1: 1.19 },
  { lKm: 22, k1: 1.19 },
  { lKm: 23, k1: 1.2 },
  { lKm: 24, k1: 1.2 },
  { lKm: 25, k1: 1.2 },
  { lKm: 26, k1: 1.2 },
  { lKm: 27, k1: 1.21 },
  { lKm: 28, k1: 1.21 },
  { lKm: 29, k1: 1.21 },
  { lKm: 30, k1: 1.21 },
  { lKm: 31, k1: 1.21 },
  { lKm: 32, k1: 1.21 },
  { lKm: 33, k1: 1.22 },
  { lKm: 34, k1: 1.22 },
  { lKm: 35, k1: 1.22 },
  { lKm: 36, k1: 1.22 },
  { lKm: 37, k1: 1.22 },
  { lKm: 38, k1: 1.22 },
  { lKm: 39, k1: 1.22 },
  { lKm: 40, k1: 1.22 },
  { lKm: 41, k1: 1.23 },
  { lKm: 42, k1: 1.23 },
  { lKm: 43, k1: 1.23 },
  { lKm: 44, k1: 1.23 },
  { lKm: 45, k1: 1.23 },
  { lKm: 46, k1: 1.23 },
  { lKm: 47, k1: 1.23 },
  { lKm: 48, k1: 1.23 },
  { lKm: 49, k1: 1.23 },
  { lKm: 50, k1: 1.23 }
];

export function getK1(cycleLengthKm) {
  if (cycleLengthKm <= 5) return 1;
  const sorted = K1_CYCLE_LENGTH_TABLE;
  if (cycleLengthKm >= sorted[sorted.length - 1].lKm) return sorted[sorted.length - 1].k1;

  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (cycleLengthKm >= lo.lKm && cycleLengthKm <= hi.lKm) {
      const ratio = (cycleLengthKm - lo.lKm) / (hi.lKm - lo.lKm);
      return Math.round((lo.k1 + ratio * (hi.k1 - lo.k1)) * 1000) / 1000;
    }
  }
  return sorted[0].k1;
}

// ─────────────────────────────────────────────
// K2 — koreksi suhu ambient (baris = kecepatan rata-rata siklus Vm km/h,
// kolom = suhu ambient site °C). Interpolasi bilinear (Vm & suhu).
// Sumber: Michelin Technical Data 2025 Edition, hal. 271 (K2_Ambient_Temp)
// ─────────────────────────────────────────────

export const K2_TEMPS_C = [15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50];

export const K2_AMBIENT_TEMP_TABLE = [
  { vmKmh: 10, k2ByTemp: [0.635, 0.661, 0.69, 0.721, 0.755, 0.792, 0.833, 0.879, 0.93, 0.988, 1.087, 1.22, 1.389, 1.613, 1.923] },
  { vmKmh: 12, k2ByTemp: [0.676, 0.701, 0.727, 0.756, 0.787, 0.821, 0.857, 0.897, 0.941, 0.99, 1.071, 1.176, 1.304, 1.463, 1.667] },
  { vmKmh: 14, k2ByTemp: [0.709, 0.732, 0.757, 0.783, 0.812, 0.842, 0.875, 0.911, 0.949, 0.991, 1.061, 1.148, 1.25, 1.373, 1.522] },
  { vmKmh: 16, k2ByTemp: [0.736, 0.757, 0.78, 0.805, 0.831, 0.859, 0.889, 0.921, 0.955, 0.992, 1.053, 1.127, 1.212, 1.311, 1.429] },
  { vmKmh: 18, k2ByTemp: [0.758, 0.778, 0.8, 0.823, 0.847, 0.873, 0.9, 0.929, 0.96, 0.993, 1.047, 1.111, 1.184, 1.268, 1.364] },
  { vmKmh: 20, k2ByTemp: [0.777, 0.796, 0.816, 0.838, 0.86, 0.884, 0.909, 0.936, 0.964, 0.994, 1.042, 1.099, 1.163, 1.235, 1.316] },
  { vmKmh: 21, k2ByTemp: [0.785, 0.804, 0.824, 0.844, 0.866, 0.889, 0.913, 0.939, 0.966, 0.994, 1.04, 1.094, 1.154, 1.221, 1.296] },
  { vmKmh: 22, k2ByTemp: [0.793, 0.811, 0.83, 0.85, 0.871, 0.893, 0.917, 0.941, 0.967, 0.994, 1.038, 1.089, 1.146, 1.209, 1.279] },
  { vmKmh: 24, k2ByTemp: [0.807, 0.824, 0.842, 0.861, 0.881, 0.901, 0.923, 0.946, 0.97, 0.995, 1.034, 1.081, 1.132, 1.188, 1.25] },
  { vmKmh: 26, k2ByTemp: [0.819, 0.835, 0.852, 0.87, 0.889, 0.908, 0.929, 0.95, 0.972, 0.995, 1.032, 1.074, 1.121, 1.171, 1.226] },
  { vmKmh: 28, k2ByTemp: [0.83, 0.845, 0.862, 0.878, 0.896, 0.914, 0.933, 0.953, 0.974, 0.996, 1.029, 1.069, 1.111, 1.157, 1.207] },
  { vmKmh: 30, k2ByTemp: [0.839, 0.854, 0.87, 0.886, 0.902, 0.92, 0.938, 0.956, 0.976, 0.996, 1.027, 1.064, 1.103, 1.145, 1.19] },
  { vmKmh: 32, k2ByTemp: [0.848, 0.862, 0.877, 0.892, 0.908, 0.924, 0.941, 0.959, 0.977, 0.996, 1.026, 1.06, 1.096, 1.135, 1.176] },
  { vmKmh: 34, k2ByTemp: [0.855, 0.869, 0.883, 0.898, 0.913, 0.928, 0.944, 0.961, 0.978, 0.996, 1.024, 1.056, 1.09, 1.126, 1.164] },
  { vmKmh: 36, k2ByTemp: [0.862, 0.875, 0.889, 0.903, 0.917, 0.932, 0.947, 0.963, 0.98, 0.997, 1.023, 1.053, 1.084, 1.118, 1.154] },
  { vmKmh: 38, k2ByTemp: [0.869, 0.881, 0.894, 0.907, 0.921, 0.935, 0.95, 0.965, 0.981, 0.997, 1.022, 1.05, 1.08, 1.111, 1.145] },
  { vmKmh: 40, k2ByTemp: [0.874, 0.886, 0.899, 0.912, 0.925, 0.938, 0.952, 0.967, 0.982, 0.997, 1.02, 1.047, 1.075, 1.105, 1.136] },
  { vmKmh: 42, k2ByTemp: [0.88, 0.891, 0.903, 0.916, 0.928, 0.941, 0.955, 0.968, 0.982, 0.997, 1.019, 1.045, 1.071, 1.099, 1.129] },
  { vmKmh: 44, k2ByTemp: [0.884, 0.896, 0.907, 0.919, 0.931, 0.944, 0.957, 0.97, 0.983, 0.997, 1.019, 1.043, 1.068, 1.095, 1.122] },
  { vmKmh: 46, k2ByTemp: [0.889, 0.9, 0.911, 0.922, 0.934, 0.946, 0.958, 0.971, 0.984, 0.997, 1.018, 1.041, 1.065, 1.09, 1.117] },
  { vmKmh: 48, k2ByTemp: [0.893, 0.904, 0.914, 0.925, 0.937, 0.948, 0.96, 0.972, 0.985, 0.997, 1.017, 1.039, 1.062, 1.086, 1.111] },
  { vmKmh: 50, k2ByTemp: [0.897, 0.907, 0.917, 0.928, 0.939, 0.95, 0.962, 0.973, 0.985, 0.998, 1.016, 1.037, 1.059, 1.082, 1.106] }
];

function interpolate1D(x, points) {
  // points: array of [x, y] pairs, sorted ascending by x
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) {
      const ratio = (x - x0) / (x1 - x0);
      return y0 + ratio * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

/**
 * K2 dicari lewat interpolasi bilinear: dulu per-baris (Vm) dapat kurva
 * suhu->K2, baru diinterpolasi ulang antar 2 baris Vm terdekat.
 */
export function getK2(vmKmh, ambientTempC, table = K2_AMBIENT_TEMP_TABLE, temps = K2_TEMPS_C) {
  const sorted = table;
  const rowK2ForTemp = (row) => interpolate1D(ambientTempC, temps.map((t, i) => [t, row.k2ByTemp[i]]));

  if (vmKmh <= sorted[0].vmKmh) return Math.round(rowK2ForTemp(sorted[0]) * 1000) / 1000;
  if (vmKmh >= sorted[sorted.length - 1].vmKmh) {
    return Math.round(rowK2ForTemp(sorted[sorted.length - 1]) * 1000) / 1000;
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (vmKmh >= lo.vmKmh && vmKmh <= hi.vmKmh) {
      const k2Lo = rowK2ForTemp(lo);
      const k2Hi = rowK2ForTemp(hi);
      const ratio = (vmKmh - lo.vmKmh) / (hi.vmKmh - lo.vmKmh);
      return Math.round((k2Lo + ratio * (k2Hi - k2Lo)) * 1000) / 1000;
    }
  }
  return Math.round(rowK2ForTemp(sorted[0]) * 1000) / 1000;
}

// Suhu ambient default site — ASUMSI (tropis Indonesia, siang hari tambang
// terbuka), BELUM ada integrasi data cuaca live. Ganti dengan suhu ambient
// aktual/rata-rata site bila tersedia.
export const DEFAULT_AMBIENT_TEMP_C = 32;

// ─────────────────────────────────────────────
// AXLE LOAD DISTRIBUTION & Real Site TKPH per axle (front/rear)
// Sumber: manual Komatsu CEN00136-09 (distribusi axle) + Michelin (Qm x Vm x K1 x K2)
// ─────────────────────────────────────────────

/**
 * Menghitung beban per ban (kg) untuk axle depan & belakang, kondisi
 * loaded (GVW = unladen + payload) dan empty (unladen saja) — pakai
 * distribusi axle % resmi dari unit (lihat tyreData.js unitDT001).
 */
export function computeAxleLoadPerTyreKg(unit, payloadTon) {
  const gvwTon = unit.emptyWeightTon + payloadTon;

  const frontLoadedKg = ((gvwTon * unit.frontAxlePercentLoaded) / unit.tyreQtyFront) * 1000;
  const rearLoadedKg = ((gvwTon * unit.rearAxlePercentLoaded) / unit.tyreQtyRear) * 1000;
  const frontEmptyKg = ((unit.emptyWeightTon * unit.frontAxlePercentUnladen) / unit.tyreQtyFront) * 1000;
  const rearEmptyKg = ((unit.emptyWeightTon * unit.rearAxlePercentUnladen) / unit.tyreQtyRear) * 1000;

  return {
    frontLoadedKg: Math.round(frontLoadedKg),
    rearLoadedKg: Math.round(rearLoadedKg),
    frontEmptyKg: Math.round(frontEmptyKg),
    rearEmptyKg: Math.round(rearEmptyKg),
  };
}

/**
 * Real Site TKPH resmi Michelin, dihitung TERPISAH untuk axle depan &
 * belakang (beban per ban & jumlah ban berbeda antar axle):
 *
 *   Qm = rata-rata beban per ban (ton), diberi bobot waktu loaded vs
 *        empty dalam 1 siklus penuh (queue+spotting+return = fase empty;
 *        loading+hauling loaded+dumping = fase loaded — lihat catatan di
 *        maintenanceModel.js untuk pembagian fase ini)
 *   Vm = kecepatan rata-rata SELURUH siklus (jarak total siklus / durasi
 *        total siklus TERMASUK antre/loading/dumping, sesuai definisi
 *        Michelin "km ditempuh per jam")
 *   Basic Site TKPH = Qm x Vm
 *   Real Site TKPH  = Basic Site TKPH x K1(panjang siklus) x K2(Vm, suhu ambient)
 */
export function computeRealSiteTKPH({
  unit,
  payloadTon,
  loadedPhaseMinutes,
  emptyPhaseMinutes,
  totalCycleMinutes,
  cycleLengthKm,
  ambientTempC = DEFAULT_AMBIENT_TEMP_C,
}) {
  const axleLoads = computeAxleLoadPerTyreKg(unit, payloadTon);
  const vmKmh = totalCycleMinutes > 0 ? cycleLengthKm / (totalCycleMinutes / 60) : 0;
  const k1 = getK1(cycleLengthKm);
  const k2 = getK2(vmKmh, ambientTempC);

  function axleResult(loadedKg, emptyKg, tkphRating) {
    const qmLoadedTon = loadedKg / 1000;
    const qmEmptyTon = emptyKg / 1000;
    const qmTon =
      totalCycleMinutes > 0
        ? (qmLoadedTon * loadedPhaseMinutes + qmEmptyTon * emptyPhaseMinutes) / totalCycleMinutes
        : 0;
    const basicSiteTKPH = qmTon * vmKmh;
    const realSiteTKPH = basicSiteTKPH * k1 * k2;
    const utilizationPct = Math.round((realSiteTKPH / tkphRating) * 1000) / 10;
    let status = "NORMAL";
    if (utilizationPct >= 100) status = "CRITICAL";
    else if (utilizationPct >= 85) status = "WARNING";

    return {
      qmTon: Math.round(qmTon * 100) / 100,
      basicSiteTKPH: Math.round(basicSiteTKPH * 10) / 10,
      realSiteTKPH: Math.round(realSiteTKPH * 10) / 10,
      tkphRating,
      utilizationPct,
      status,
    };
  }

  const tkphRating = getInstalledTyreTkphRating();

  return {
    vmKmh: Math.round(vmKmh * 10) / 10,
    k1,
    k2,
    ambientTempC,
    front: axleResult(axleLoads.frontLoadedKg, axleLoads.frontEmptyKg, tkphRating),
    rear: axleResult(axleLoads.rearLoadedKg, axleLoads.rearEmptyKg, tkphRating),
    axleLoads,
  };
}