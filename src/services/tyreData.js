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
  type: "Komatsu HD785-7",
  // Rated payload PABRIKAN (bukan asumsi) — 91.7 ton metrik, dibulatkan ke
  // 91 ton untuk kalkulasi. Sumber: spesifikasi resmi Komatsu HD785-7
  // (rigid dump truck, rated payload 91.7 t / dump body 40 yd³ struck).
  // Dipakai sebagai basis Payload Utilization di services/payloadModel.js.
  ratedPayloadTon: 91,
  // Berat kosong unit (unloaded) — spesifikasi resmi Komatsu HD785-7: 72.6 ton.
  // Dipakai bersama ratedPayloadTon untuk menghitung Gross Vehicle Weight
  // (GVW) per kondisi loaded/empty di TKPH — lihat services/maintenanceModel.js.
  emptyWeightTon: 72.6,
  // HD785-7 punya 6 posisi ban fisik (2 depan + 4 belakang dual), TAPI
  // tyreData.js MVP ini hanya memodelkan 4 TITIK monitoring (tyres di
  // bawah) — sisi belakang kiri/kanan mewakili sepasang dual masing-masing.
  // physicalTyreCount dipisah dari tyres.length supaya kalkulasi TKPH/beban
  // per ban (di maintenanceModel.js) memakai jumlah ban FISIK yang benar,
  // bukan jumlah titik monitoring.
  physicalTyreCount: 6,
  tyreSize: "27.00R49", // ukuran ban standar pabrikan HD785-7
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
// PAYLOAD HAULER — data ritase (loading cycle) unit DT001 (HD785-7)
// pada rute Hauling KM 33 → Port.
//
// Setiap objek = 1 kali ritase (1 siklus muat-angkut-bongkar), dicatat
// dari Payload Meter (PLM) + timestamp event dispatch/FMS bawaan unit —
// sama sumbernya dengan operationalMetrics.payloadDataSource di atas,
// BUKAN sensor tambahan.
//
// cycleTimeBreakdown memecah waktu edar (round trip) 1 ritase HD785
// menjadi 6 tahapan standar operasi hauling:
//   1. queueMinutes            — antre di area front loading (KM 33)
//   2. spottingMinutes         — manuver ambil posisi di bawah excavator
//   3. loadingMinutes          — proses pengisian muatan oleh excavator
//   4. haulingLoadedMinutes    — tempuh bermuatan KM 33 → Port
//   5. dumpingMinutes          — manuver & bongkar muatan di Port
//   6. returnEmptyMinutes      — tempuh kosong Port → KM 33
// Jumlah ke-6nya = total waktu edar 1 ritase.
//
// haulingLoadedMinutes diturunkan dari rute ~12 km & profil kecepatan
// yang SAMA dengan driverBehavior.speedProfile di bawah (rata-rata
// ±27 km/h) — supaya konsisten dengan modul Operator. returnEmptyMinutes
// diasumsikan ~35% lebih cepat dari haulingLoaded (unit tanpa beban),
// dan durasi queue/spotting/loading/dumping mengikuti rentang wajar
// operasi excavator-HD785, BUKAN dari sistem timestamp sungguhan situs
// KPP — lihat catatan asumsi lengkap di services/payloadModel.js.
//
// Data 12 ritase (~1 shift) di bawah ini SINTETIS namun didesain untuk
// merepresentasikan pola nyata di lapangan: sebagian underload (loading
// operator terlalu hati-hati / bucket count kurang pas), sebagian pas
// target, sebagian overload (bucket count berlebih). Rated payload
// HD785-7 = 91 ton (lihat unitDT001.ratedPayloadTon).
// ─────────────────────────────────────────────

export const PayloadClass = Object.freeze({
  UNDERLOAD: "Underload",
  OPTIMAL: "Optimal",
  OVERLOAD: "Overload",
})

export const payloadCycles = [
  { cycleId: "RIT-01", timeLabel: "06:10", material: "Batubara ROM", loadedTon: 76,
    cycleTimeBreakdown: { queueMinutes: 3.0, spottingMinutes: 1.5, loadingMinutes: 3.2, haulingLoadedMinutes: 25.0, dumpingMinutes: 1.3, returnEmptyMinutes: 18.0 } },
  { cycleId: "RIT-02", timeLabel: "06:55", material: "Batubara ROM", loadedTon: 88,
    cycleTimeBreakdown: { queueMinutes: 4.0, spottingMinutes: 1.4, loadingMinutes: 3.6, haulingLoadedMinutes: 26.0, dumpingMinutes: 1.4, returnEmptyMinutes: 18.5 } },
  { cycleId: "RIT-03", timeLabel: "07:38", material: "Batubara ROM", loadedTon: 95,
    cycleTimeBreakdown: { queueMinutes: 5.0, spottingMinutes: 1.6, loadingMinutes: 3.9, haulingLoadedMinutes: 27.0, dumpingMinutes: 1.5, returnEmptyMinutes: 19.0 } },
  { cycleId: "RIT-04", timeLabel: "08:20", material: "Batubara ROM", loadedTon: 104,
    cycleTimeBreakdown: { queueMinutes: 6.0, spottingMinutes: 2.0, loadingMinutes: 4.3, haulingLoadedMinutes: 28.5, dumpingMinutes: 1.8, returnEmptyMinutes: 19.5 } },
  { cycleId: "RIT-05", timeLabel: "09:05", material: "Batubara ROM", loadedTon: 90,
    cycleTimeBreakdown: { queueMinutes: 3.5, spottingMinutes: 1.5, loadingMinutes: 3.7, haulingLoadedMinutes: 26.0, dumpingMinutes: 1.4, returnEmptyMinutes: 18.5 } },
  { cycleId: "RIT-06", timeLabel: "09:48", material: "Batubara ROM", loadedTon: 79,
    cycleTimeBreakdown: { queueMinutes: 2.5, spottingMinutes: 1.3, loadingMinutes: 3.3, haulingLoadedMinutes: 25.0, dumpingMinutes: 1.3, returnEmptyMinutes: 18.0 } },
  { cycleId: "RIT-07", timeLabel: "10:30", material: "Batubara ROM", loadedTon: 92,
    cycleTimeBreakdown: { queueMinutes: 4.5, spottingMinutes: 1.5, loadingMinutes: 3.8, haulingLoadedMinutes: 26.5, dumpingMinutes: 1.5, returnEmptyMinutes: 18.8 } },
  { cycleId: "RIT-08", timeLabel: "11:15", material: "Batubara ROM", loadedTon: 110,
    cycleTimeBreakdown: { queueMinutes: 7.0, spottingMinutes: 2.2, loadingMinutes: 4.6, haulingLoadedMinutes: 29.0, dumpingMinutes: 2.0, returnEmptyMinutes: 20.0 } },
  { cycleId: "RIT-09", timeLabel: "12:40", material: "Batubara ROM", loadedTon: 85,
    cycleTimeBreakdown: { queueMinutes: 3.0, spottingMinutes: 1.4, loadingMinutes: 3.5, haulingLoadedMinutes: 25.5, dumpingMinutes: 1.4, returnEmptyMinutes: 18.2 } },
  { cycleId: "RIT-10", timeLabel: "13:25", material: "Batubara ROM", loadedTon: 70,
    cycleTimeBreakdown: { queueMinutes: 2.0, spottingMinutes: 1.2, loadingMinutes: 3.0, haulingLoadedMinutes: 24.5, dumpingMinutes: 1.2, returnEmptyMinutes: 17.5 } },
  { cycleId: "RIT-11", timeLabel: "14:08", material: "Batubara ROM", loadedTon: 98,
    cycleTimeBreakdown: { queueMinutes: 5.5, spottingMinutes: 1.7, loadingMinutes: 4.0, haulingLoadedMinutes: 27.2, dumpingMinutes: 1.6, returnEmptyMinutes: 19.2 } },
  { cycleId: "RIT-12", timeLabel: "14:50", material: "Batubara ROM", loadedTon: 93,
    cycleTimeBreakdown: { queueMinutes: 4.0, spottingMinutes: 1.5, loadingMinutes: 3.8, haulingLoadedMinutes: 26.5, dumpingMinutes: 1.5, returnEmptyMinutes: 18.8 } },
]

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