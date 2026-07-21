export const TyreStatus = Object.freeze({
  NORMAL: "Normal",
  WARNING: "Warning",
  CRITICAL: "Critical"
})

export const TyrePosition = Object.freeze({
  FRONT_LEFT: "Front Left",
  FRONT_RIGHT: "Front Right",
  REAR_LEFT: "Rear Left",
  REAR_RIGHT: "Rear Right"
})

// Catatan field eisSensor: data sensor EIS (Electrochemical Impedance
// Spectroscopy) MENTAH per ban — R_ct (Ohm) dan nilai_n (koefisien CPE).
// Nilai ini sintetis, diturunkan dari materialDegradationPct memakai
// rumus/konstanta referensi yang sama dengan services/degradationModel.js
// (dan tyremind_ml_degradasi.py), supaya konsisten dan bisa dipakai
// mendemonstrasikan pipeline "sensor mentah -> DI_EIS -> estimasi AI"
// di popup validitas data pada Tyre Monitoring. Ganti dengan pembacaan
// sensor EIS nyata begitu tersedia dari hardware.
const tyreFrontLeft = {
  id: "FL-01",
  position: TyrePosition.FRONT_LEFT,
  pressurePsi: 100,
  temperatureCelcius: 60,
  materialDegradationPct: 15,
  status: TyreStatus.NORMAL,
  healthScore: 90,
  remainingUsefulLifeKm: 4800,
  eisSensor: { rCtOhm: 501.2, nilaiN: 0.90 }
}

const tyreFrontRight = {
  id: "FR-02",
  position: TyrePosition.FRONT_RIGHT,
  pressurePsi: 98,
  temperatureCelcius: 62,
  materialDegradationPct: 18,
  status: TyreStatus.NORMAL,
  healthScore: 88,
  remainingUsefulLifeKm: 4600,
  eisSensor: { rCtOhm: 436.5, nilaiN: 0.89 }
}

const tyreRearLeft = {
  id: "RL-03",
  position: TyrePosition.REAR_LEFT,
  pressurePsi: 90,
  temperatureCelcius: 75,
  materialDegradationPct: 35,
  status: TyreStatus.WARNING,
  healthScore: 65,
  remainingUsefulLifeKm: 3100,
  eisSensor: { rCtOhm: 199.5, nilaiN: 0.83 }
}

const tyreRearRight = {
  id: "RR-04",
  position: TyrePosition.REAR_RIGHT,
  pressurePsi: 85,
  temperatureCelcius: 80,
  materialDegradationPct: 45,
  status: TyreStatus.CRITICAL,
  healthScore: 35,
  remainingUsefulLifeKm: 1900,
  eisSensor: { rCtOhm: 125.9, nilaiN: 0.79 }
}

export const unitDT001 = {
  unitId: "DT001",
  name: "Dump Truck",
  type: "OTR Mining Truck",
  site: "Main Haul Road",
  segment: "A",
  operator: "Satrio Adhiyatma",
  operatorId: "OP-2024-001",
  healthScore: 70,
  overallStatus: TyreStatus.WARNING,
  operationalMetrics: {
    averagePayloadTon: 45,
    overloadFrequencyPct: 12,
    // ── SUMBER DATA JARAK TEMPUH (untuk RUL dalam km) ──
    // Tidak butuh sensor tambahan — truk sudah punya ABS wheel speed
    // sensor per roda (untuk sistem pengereman) yang datanya juga ada
    // di CAN bus (J1939, PGN 65248 Vehicle Distance). Data ditarik via
    // edge gateway yang sama dengan payload, dikirim lewat LoRa.
    averageDailyDistanceKm: 65,
    distanceDataSource: "ABS Wheel Speed Sensor (per-roda, via ECU)",
    distanceIntegrationPath: "CAN Bus (J1939 PGN 65248) → Edge Gateway → LoRa → TyreMind",
    distanceSensorId: "ABS-DT001",
    wheelLevelDistanceAvailable: true,
    lastDistanceSyncLabel: "2 menit lalu",
    // ── SUMBER DATA PAYLOAD ──
    // Payload TIDAK diukur oleh sensor ban TyreMind. Sensor ban (rim)
    // hanya mengukur tekanan, suhu, dan degradasi material — bukan berat.
    // Data payload berasal dari sistem On-Board Weighing (OBW) / Payload
    // Meter (PLM) bawaan unit, yang membaca beban dari sensor tekanan
    // strut suspensi hidro-pneumatik truk. Data ini ditarik dari CAN bus
    // (J1939) truk melalui edge gateway, lalu dikirim ke TyreMind lewat
    // jaringan LoRa yang sama dengan sensor ban.
    payloadDataSource: "OEM Payload Meter (Strut Pressure Sensor)",
    payloadIntegrationPath: "CAN Bus (J1939) → Edge Gateway → LoRa → TyreMind",
    payloadSensorId: "PLM-DT001",
    payloadGatewayId: "GW-TYREMIND-01",
    lastPayloadSyncLabel: "4 menit lalu",
    // ── SUMBER DATA GPS / POSISI UNIT ──
    // Berbeda dari payload & distance: GPS TIDAK lewat LoRa. Klien KPP
    // (skala tambang besar) kemungkinan besar sudah punya GPS OEM bawaan
    // yang datanya terkunci di server FMS internal milik KPP (bukan
    // expose ke CAN bus kendaraan). Jalurnya: GPS OEM per unit → Server
    // FMS KPP → API read-only (izin akses dari KPP sebagai pemilik data,
    // BUKAN kontrak ke pabrikan alat berat) → Backend TyreMind.
    // Nama sistem FMS spesifik & detail endpoint API masih perlu
    // dikonfirmasi ke tim IT/OT KPP saat onboarding — field di bawah ini
    // masih placeholder sampai konfirmasi tersebut didapat.
    gpsDataSource: "Server FMS milik KPP (nama sistem menunggu konfirmasi tim IT/OT KPP)",
    gpsIntegrationMethod: "API read-only (REST/MQTT — protokol pasti menunggu konfirmasi KPP), BUKAN via LoRa",
    gpsIntegrationScope: "Izin akses data dari KPP sebagai pemilik data, bukan kontrak ke pabrikan unit",
    gpsPositionUpdateIntervalSec: 20,
    gpsIntegrationStatus: "Menunggu konfirmasi endpoint API dari tim IT/OT KPP",
    lastGpsSyncLabel: "Belum tersambung — integrasi tahap perencanaan"
  },
  tyres: [tyreFrontLeft, tyreFrontRight, tyreRearLeft, tyreRearRight]
}

export const fleet = [unitDT001]

// ─────────────────────────────────────────────
// HELPER — estimasi RUL dalam hari, dari remainingUsefulLifeKm (per-ban)
// dan averageDailyDistanceKm (per-unit). Dipusatkan di sini supaya semua
// halaman (Dashboard, Tyre Monitoring, AI Insight) pakai formula yang
// sama persis — hindari duplikasi & drift angka antar halaman.
// ─────────────────────────────────────────────

export function estimateTyreRulDays(tyre, unit) {
  const dailyKm = unit?.operationalMetrics?.averageDailyDistanceKm || 1;
  return Math.round(tyre.remainingUsefulLifeKm / dailyKm);
}

// ─────────────────────────────────────────────
// ROAD INTELLIGENCE — mock data segmen jalur haul road
// Tambahkan di bagian bawah tyreData.js
// ─────────────────────────────────────────────

export const RoadSegmentRisk = Object.freeze({
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
})

// Segmen jalur yang dilalui unit DT001 (site: "Main Haul Road", segment: "A")
export const roadSegments = [
  {
    id: "SEG-A1",
    name: "Segmen A1",
    surfaceCondition: "Berbatu, bergelombang",
    riskScore: 82,
    riskLevel: RoadSegmentRisk.HIGH,
    incidentCount30d: 5,
    tyreImpactNote: "Permukaan tidak rata meningkatkan beban kejut pada ban belakang.",
    incidents: [
      { date: "2026-07-18", description: "Guncangan keras terdeteksi di titik KM 3.2, ban RR-04 mengalami lonjakan tekanan sesaat." },
      { date: "2026-07-14", description: "Operator melaporkan getaran berlebih pada roda belakang saat melintas dengan muatan penuh." },
      { date: "2026-07-09", description: "Keausan tidak merata terdeteksi pada ban RL-03 akibat permukaan bergelombang." },
      { date: "2026-07-03", description: "Sensor mendeteksi lonjakan suhu ban RR-04 setelah melewati titik berbatu." },
      { date: "2026-06-25", description: "Retak permukaan jalan dilaporkan tim inspeksi, berpotensi memperparah beban kejut ban." }
    ]
  },
  {
    id: "SEG-A2",
    name: "Segmen A2",
    surfaceCondition: "Tanjakan curam, berdebu",
    riskScore: 68,
    riskLevel: RoadSegmentRisk.MEDIUM,
    incidentCount30d: 2,
    tyreImpactNote: "Tanjakan menambah beban torsi dan suhu ban saat unit bermuatan penuh.",
    incidents: [
      { date: "2026-07-16", description: "Suhu ban RR-04 sempat mencapai 82°C saat menanjak dengan muatan penuh." },
      { date: "2026-07-05", description: "Operator melaporkan traksi berkurang akibat debu tebal di area tanjakan." }
    ]
  },
  {
    id: "SEG-A3",
    name: "Segmen A3",
    surfaceCondition: "Rata, terpelihara baik",
    riskScore: 24,
    riskLevel: RoadSegmentRisk.LOW,
    incidentCount30d: 0,
    tyreImpactNote: "Kondisi jalan stabil, dampak minimal terhadap keausan ban.",
    incidents: []
  }
]

// ─────────────────────────────────────────────
// OPERATOR — telemetri kecepatan vs jarak tempuh (7 hari terakhir,
// direpresentasikan sebagai 1 rute haul road ~12 km untuk MVP).
// Sintetis & deterministik (bukan acak tiap render). Skor perilaku
// TIDAK disimpan statis di sini — dihitung dinamis dari speedProfile
// oleh services/drivingBehaviorModel.js, supaya angka yang tercetak
// selalu konsisten dengan apa yang divisualisasikan di grafik.
// ─────────────────────────────────────────────

export const driverBehavior = {
  operatorId: "OP-2024-001",
  operatorName: "Satrio Adhiyatma",
  periodLabel: "7 Hari Terakhir",
  speedLimitKmh: 40, // batas kecepatan jalur haul road bermuatan
  speedProfile: [
    { distanceKm: 0.0, speedKmh: 0 },
    { distanceKm: 0.3, speedKmh: 14 },
    { distanceKm: 0.6, speedKmh: 24 },
    { distanceKm: 0.9, speedKmh: 30 },
    { distanceKm: 1.2, speedKmh: 33 },
    { distanceKm: 1.5, speedKmh: 35 },
    { distanceKm: 1.8, speedKmh: 36 },
    { distanceKm: 2.1, speedKmh: 38 },
    { distanceKm: 2.4, speedKmh: 42 },
    { distanceKm: 2.7, speedKmh: 45 },
    { distanceKm: 3.0, speedKmh: 46 },
    { distanceKm: 3.3, speedKmh: 20 },
    { distanceKm: 3.6, speedKmh: 24 },
    { distanceKm: 3.9, speedKmh: 29 },
    { distanceKm: 4.2, speedKmh: 33 },
    { distanceKm: 4.5, speedKmh: 50 },
    { distanceKm: 4.8, speedKmh: 42 },
    { distanceKm: 5.1, speedKmh: 38 },
    { distanceKm: 5.4, speedKmh: 37 },
    { distanceKm: 5.7, speedKmh: 36 },
    { distanceKm: 6.0, speedKmh: 39 },
    { distanceKm: 6.3, speedKmh: 17 },
    { distanceKm: 6.6, speedKmh: 22 },
    { distanceKm: 6.9, speedKmh: 28 },
    { distanceKm: 7.2, speedKmh: 32 },
    { distanceKm: 7.5, speedKmh: 52 },
    { distanceKm: 7.8, speedKmh: 44 },
    { distanceKm: 8.1, speedKmh: 41 },
    { distanceKm: 8.4, speedKmh: 44 },
    { distanceKm: 8.7, speedKmh: 43 },
    { distanceKm: 9.0, speedKmh: 41 },
    { distanceKm: 9.3, speedKmh: 19 },
    { distanceKm: 9.6, speedKmh: 25 },
    { distanceKm: 9.9, speedKmh: 31 },
    { distanceKm: 10.2, speedKmh: 34 },
    { distanceKm: 10.5, speedKmh: 34 },
    { distanceKm: 10.8, speedKmh: 51 },
    { distanceKm: 11.1, speedKmh: 39 },
    { distanceKm: 11.4, speedKmh: 28 },
    { distanceKm: 11.7, speedKmh: 14 },
    { distanceKm: 12.0, speedKmh: 0 }
  ]
}

// ─────────────────────────────────────────────
// JARINGAN LoRa — infrastruktur radio milik SITE tambang, bukan per unit.
// Bisa lebih dari 1 gateway (redundansi jangkauan). Frekuensi mengikuti
// regulasi regional (Indonesia: 923 MHz / AS923), bukan sesuatu yang
// dipilih bebas per pengguna aplikasi — sifatnya status read-only.
// ─────────────────────────────────────────────

export const GatewayStatus = Object.freeze({
  ONLINE: "Online",
  OFFLINE: "Offline",
})

export const loraNetwork = {
  frequencyBand: "923 MHz (AS923)",
  siteName: "Main Haul Road",
  gateways: [
    {
      id: "GW-TYREMIND-01",
      location: "Menara Pos 1 — dekat Segmen A1",
      status: GatewayStatus.ONLINE,
      devicesInRange: 14,
      lastSyncLabel: "2 menit lalu",
    },
    {
      id: "GW-TYREMIND-02",
      location: "Menara Pos 2 — dekat Segmen A3",
      status: GatewayStatus.ONLINE,
      devicesInRange: 9,
      lastSyncLabel: "4 menit lalu",
    },
  ],
}