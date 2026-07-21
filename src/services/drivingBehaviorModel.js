/**
 * TyreMind — Model Analisis Perilaku Mengemudi
 *
 * Menganalisis speedProfile mentah (kecepatan vs jarak tempuh) untuk
 * mendeteksi 3 pola perilaku yang mempercepat keausan ban:
 *   - Overspeed        : kecepatan melebihi speedLimitKmh
 *   - Harsh Braking     : penurunan kecepatan tajam antar titik berurutan
 *   - Harsh Acceleration: kenaikan kecepatan tajam antar titik berurutan
 *
 * ⚠️ CATATAN METODOLOGI (baca sebelum dipakai untuk keputusan operasional):
 * speedProfile di tyreData.js adalah data SINTETIS berbasis jarak (bukan
 * waktu), jadi "harsh" di sini didekati dari besar perubahan kecepatan
 * antar sampel jarak (delta km/h per titik), BUKAN dari akselerasi
 * sebenarnya (m/s²) yang butuh data waktu. Ini adalah proxy yang wajar
 * untuk MVP, tapi kalibrasi ambang batas (HARSH_DELTA_THRESHOLD_KMH) dan
 * bobot skor di bawah adalah ASUMSI ILUSTRATIF, bukan hasil studi SOP
 * keselamatan tambang. Sesuaikan dengan SOP resmi begitu tersedia.
 */

export const HARSH_DELTA_THRESHOLD_KMH = 15; // perubahan kecepatan per titik yang dianggap "harsh"

// Penalti skor per kejadian (poin, dari basis 100). Ilustratif — lihat catatan di atas.
const OVERSPEED_PENALTY = 12;
const HARSH_EVENT_PENALTY = 10;

/**
 * Menganalisis speedProfile menjadi daftar kejadian + skor per kategori.
 * Semua angka (jumlah kejadian, skor) diturunkan langsung dari data —
 * tidak ada nilai yang di-hardcode terpisah dari speedProfile itu sendiri.
 */
export function analyzeDrivingBehavior(speedProfile, speedLimitKmh) {
  const overspeedSegments = [];
  const harshBrakingEvents = [];
  const harshAccelerationEvents = [];

  let currentSegment = null;

  for (let i = 0; i < speedProfile.length; i++) {
    const point = speedProfile[i];

    // ── Deteksi overspeed: kelompokkan titik-titik berurutan yang melebihi limit ──
    if (point.speedKmh > speedLimitKmh) {
      if (!currentSegment) {
        currentSegment = { startKm: point.distanceKm, endKm: point.distanceKm, maxSpeedKmh: point.speedKmh };
      } else {
        currentSegment.endKm = point.distanceKm;
        currentSegment.maxSpeedKmh = Math.max(currentSegment.maxSpeedKmh, point.speedKmh);
      }
    } else if (currentSegment) {
      overspeedSegments.push(currentSegment);
      currentSegment = null;
    }

    // ── Deteksi harsh braking/acceleration: delta antar titik berurutan ──
    if (i > 0) {
      const prev = speedProfile[i - 1];
      const delta = point.speedKmh - prev.speedKmh;

      if (delta <= -HARSH_DELTA_THRESHOLD_KMH) {
        harshBrakingEvents.push({
          distanceKm: point.distanceKm,
          fromSpeedKmh: prev.speedKmh,
          toSpeedKmh: point.speedKmh,
          deltaKmh: delta,
        });
      } else if (delta >= HARSH_DELTA_THRESHOLD_KMH) {
        harshAccelerationEvents.push({
          distanceKm: point.distanceKm,
          fromSpeedKmh: prev.speedKmh,
          toSpeedKmh: point.speedKmh,
          deltaKmh: delta,
        });
      }
    }
  }
  if (currentSegment) overspeedSegments.push(currentSegment);

  const overspeedScore = Math.max(0, Math.min(100, 100 - overspeedSegments.length * OVERSPEED_PENALTY));
  const harshBrakingScore = Math.max(0, Math.min(100, 100 - harshBrakingEvents.length * HARSH_EVENT_PENALTY));
  const harshAccelerationScore = Math.max(
    0,
    Math.min(100, 100 - harshAccelerationEvents.length * HARSH_EVENT_PENALTY)
  );

  const overallScore = Math.round((overspeedScore + harshBrakingScore + harshAccelerationScore) / 3);

  return {
    overspeedSegments,
    harshBrakingEvents,
    harshAccelerationEvents,
    scores: {
      overspeed: overspeedScore,
      harshBraking: harshBrakingScore,
      harshAcceleration: harshAccelerationScore,
    },
    overallScore,
  };
}
