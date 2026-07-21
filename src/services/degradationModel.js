/**
 * TyreMind — Model Estimasi Degradasi Ban dari Parameter EIS
 * Port JavaScript dari tyremind_ml_degradasi.py
 *
 * ⚠️ CATATAN PENTING (dibawa langsung dari skrip Python asal, jangan dihapus):
 * Konstanta referensi (R_ct baru=1000 Ω, R_ct EOL=10 Ω, nilai_n 0.95→0.60)
 * adalah ASUMSI ILUSTRATIF untuk mendemonstrasikan pipeline/metodologi,
 * BUKAN hasil riset atau kalibrasi laboratorium nyata. MAE & R² di bawah
 * dihitung dari data SINTETIS di mana DI_EIS diturunkan dari rumus yang
 * sama dengan target latihnya — jadi akurasi tinggi itu bukan bukti
 * akurasi di dunia nyata. Sebelum dipakai untuk keputusan operasional,
 * pipeline ini wajib dikalibrasi ulang dengan data sensor EIS + ground
 * truth fisik ban sungguhan.
 *
 * CATATAN PORTING:
 * Random Forest asli (scikit-learn) tidak bisa dijalankan langsung di
 * browser tanpa mengekspor model (ONNX / pohon keputusan / backend API).
 * Fungsi `estimasiDegradasi` di bawah BUKAN Random Forest yang sama —
 * ini reproduksi ringan & transparan dari logika pipeline (DI_EIS sebagai
 * basis, dikoreksi sedikit oleh nilai_n) supaya UI bisa menampilkan
 * proses/validitas datanya. Untuk akurasi RF asli, sambungkan ke backend
 * yang menjalankan model .pkl yang sudah dilatih.
 */

// ── Konstanta referensi (sama dengan tyremind_ml_degradasi.py) ──
export const RCT_BAN_BARU = 1000.0; // Ohm, referensi degradasi 0%
export const RCT_BATAS_AKHIR = 10.0; // Ohm, referensi degradasi 100% (EOL)
export const N_AWAL = 0.95; // nilai n (CPE) saat degradasi 0%
export const N_AKHIR = 0.6; // nilai n (CPE) saat degradasi 100%

// Metrik evaluasi ASLI dari run tyremind_ml_degradasi.py (data uji sintetis, seed=42, n=500)
export const MODEL_META = {
  algoritma: "Random Forest Regressor (200 trees)",
  dataLatih: "Sintetis, n=500 (bukan data lab/lapangan nyata)",
  maePoinPersen: 1.26,
  r2: 0.997,
  catatanValiditas:
    "R² tinggi ini dihasilkan karena DI_EIS diturunkan dari rumus yang sama dengan target latihnya (korelasi bawaan/circular), bukan karena model sudah tervalidasi di dunia nyata. Diperlukan kalibrasi dengan data EIS + ground truth fisik ban sungguhan sebelum dipakai untuk keputusan operasional.",
};

/**
 * Menghitung Degradation Index (DI_EIS) dari R_ct terukur — identik
 * dengan hitung_DI_EIS() pada skrip Python asal.
 */
export function hitungDIEIS(rCtTerukur, rCtReferensi = RCT_BAN_BARU, rCtEol = RCT_BATAS_AKHIR) {
  const r = Math.max(rCtTerukur, 1e-6);
  const pembilang = Math.log10(rCtReferensi) - Math.log10(r);
  const penyebut = Math.log10(rCtReferensi) - Math.log10(rCtEol);
  const nilai = (pembilang / penyebut) * 100;
  return Math.max(0, Math.min(100, nilai));
}

/**
 * Reproduksi ringan dari perilaku model: basisnya DI_EIS, dikoreksi
 * sedikit oleh deviasi nilai_n aktual terhadap nilai_n yang "diharapkan"
 * pada level DI_EIS tersebut (mendekati bagaimana fitur kedua menambah
 * informasi pada Random Forest asli). Lihat catatan porting di atas.
 */
export function estimasiDegradasi(rCtTerukur, nilaiNTerukur) {
  const diEis = hitungDIEIS(rCtTerukur);

  const fraksiDI = diEis / 100;
  const nilaiNHarapan = N_AWAL + fraksiDI * (N_AKHIR - N_AWAL);
  const deviasiN = nilaiNTerukur - nilaiNHarapan;

  // Skala koreksi empiris, dibatasi ±15 poin persen supaya tidak dominan
  // dibanding DI_EIS (konsisten dengan catatan bahwa DI_EIS adalah sinyal utama).
  const koreksi = Math.max(-15, Math.min(15, -deviasiN * 40));
  const prediksi = Math.max(0, Math.min(100, diEis + koreksi));

  return {
    diEis: Math.round(diEis * 100) / 100,
    nilaiNHarapan: Math.round(nilaiNHarapan * 100) / 100,
    deviasiN: Math.round(deviasiN * 1000) / 1000,
    prediksiDegradasiPct: Math.round(prediksi * 100) / 100,
  };
}
