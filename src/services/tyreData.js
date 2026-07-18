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

const tyreFrontLeft = {
  id: "FL-01",
  position: TyrePosition.FRONT_LEFT,
  pressurePsi: 100,
  temperatureCelcius: 60,
  materialDegradationPct: 15,
  status: TyreStatus.NORMAL,
  healthScore: 90,
  remainingUsefulLifeHours: 600
}

const tyreFrontRight = {
  id: "FR-02",
  position: TyrePosition.FRONT_RIGHT,
  pressurePsi: 98,
  temperatureCelcius: 62,
  materialDegradationPct: 18,
  status: TyreStatus.NORMAL,
  healthScore: 88,
  remainingUsefulLifeHours: 580
}

const tyreRearLeft = {
  id: "RL-03",
  position: TyrePosition.REAR_LEFT,
  pressurePsi: 90,
  temperatureCelcius: 75,
  materialDegradationPct: 35,
  status: TyreStatus.WARNING,
  healthScore: 65,
  remainingUsefulLifeHours: 480
}

const tyreRearRight = {
  id: "RR-04",
  position: TyrePosition.REAR_RIGHT,
  pressurePsi: 85,
  temperatureCelcius: 80,
  materialDegradationPct: 45,
  status: TyreStatus.CRITICAL,
  healthScore: 35,
  remainingUsefulLifeHours: 400
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
  remainingUsefulLifeHours: 400,
  overallStatus: TyreStatus.WARNING,
  operationalMetrics: {
    averagePayloadTon: 45,
    overloadFrequencyPct: 12
  },
  tyres: [tyreFrontLeft, tyreFrontRight, tyreRearLeft, tyreRearRight]
}

export const fleet = [unitDT001]

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
    tyreImpactNote: "Permukaan tidak rata meningkatkan beban kejut pada ban belakang."
  },
  {
    id: "SEG-A2",
    name: "Segmen A2",
    surfaceCondition: "Tanjakan curam, berdebu",
    riskScore: 68,
    riskLevel: RoadSegmentRisk.MEDIUM,
    incidentCount30d: 2,
    tyreImpactNote: "Tanjakan menambah beban torsi dan suhu ban saat unit bermuatan penuh."
  },
  {
    id: "SEG-A3",
    name: "Segmen A3",
    surfaceCondition: "Rata, terpelihara baik",
    riskScore: 24,
    riskLevel: RoadSegmentRisk.LOW,
    incidentCount30d: 0,
    tyreImpactNote: "Kondisi jalan stabil, dampak minimal terhadap keausan ban."
  }
]

// ─────────────────────────────────────────────
// OPERATOR — mock data perilaku pengemudi (7 hari terakhir)
// ─────────────────────────────────────────────

export const driverBehavior = {
  operatorId: "OP-2024-001",
  operatorName: "Satrio Adhiyatma",
  periodLabel: "7 Hari Terakhir",
  behaviorScores: {
    overspeed: 65,
    hardBraking: 70,
    harshAcceleration: 78,
    overloadDetection: 68
  }
}