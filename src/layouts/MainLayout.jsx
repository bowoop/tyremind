import { useState } from "react";
import DashboardOverview from "../features/dashboard/DashboardOverview"
import TyreMonitoring from "../features/tyre-monitoring/TyreMonitoring";
import AiInsight from "../features/ai-insight/AiInsight";
import RoadIntelligence from "../features/road/RoadIntelligence";
import Operator from "../features/operator/Operator";
import PayloadManagement from "../features/payload/PayloadManagement";
import Reports from "../features/reports/Reports";
import logoTyreMind from "../assets/logo_tyremind.png";

// ─────────────────────────────────────────────
// ICON COMPONENTS (inline SVG, zero dependency)
// ─────────────────────────────────────────────

const IconDashboard = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
    <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
    <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
    <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
  </svg>
);

const IconTyre = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="10" cy="10" r="3.2" stroke="currentColor" strokeWidth="1.5" />
    <line x1="10" y1="2.5" x2="10" y2="6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="10" y1="13.5" x2="10" y2="17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="2.5" y1="10" x2="6.5" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="13.5" y1="10" x2="17.5" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconAI = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5L10 2Z"
      stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const IconRoad = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 17L7 3M17 17L13 3M7 3H13M7.5 9H12.5M8 14H12" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconOperator = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3.5 17.5C3.5 14.186 6.41 11.5 10 11.5C13.59 11.5 16.5 14.186 16.5 17.5"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const IconPayload = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2.5V6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M4 6.5H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M4 6.5L2 11.5C2 13 3.5 13.5 5 13.5C6.5 13.5 8 13 8 11.5L6 6.5"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M16 6.5L14 11.5C14 13 15.5 13.5 17 13.5C18.5 13.5 20 13 20 11.5L18 6.5"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" transform="translate(-2 0)" />
    <rect x="6" y="15" width="8" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const IconAlerts = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2L2.5 15.5H17.5L10 2Z" stroke="currentColor" strokeWidth="1.7"
      strokeLinejoin="round" />
    <line x1="10" y1="8.5" x2="10" y2="12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="10" cy="14" r="0.8" fill="currentColor" />
  </svg>
);

const IconMaintenance = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.5 4.5L13 7L11 5L13.5 2.5C12.5 2.2 10.8 2.5 9.5 3.8C8.2 5.1 7.9 7 8.8 8.5L3.5 13.8C3 14.3 3 15.1 3.5 15.6L4.4 16.5C4.9 17 5.7 17 6.2 16.5L11.5 11.2C13 12.1 14.9 11.8 16.2 10.5C17.5 9.2 17.8 7.5 17.5 6.5L15.5 4.5Z"
      stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const IconReports = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3.5" y="2" width="13" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    <line x1="6.5" y1="7" x2="13.5" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="6.5" y1="10.5" x2="13.5" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="6.5" y1="14" x2="10.5" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconChevron = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 8L10 11L13 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: IconDashboard, badge: null },
  { id: "tyre-monitoring", label: "Tyre Monitoring", icon: IconTyre, badge: null },
  { id: "road", label: "Road Intelligence", icon: IconRoad, badge: null },
  { id: "operator", label: "Operator", icon: IconOperator, badge: null },
  { id: "payload", label: "Payload Management", icon: IconPayload, badge: null },
  { id: "ai-insight", label: "AI Insight", icon: IconAI, badge: null },
  { id: "reports", label: "Reports", icon: IconReports, badge: null },
];

// ─────────────────────────────────────────────
// SIDEBAR NAV ITEM
// ─────────────────────────────────────────────

function NavItem({ item, isActive, onClick }) {
  const Icon = item.icon;

  return (
    <button
      onClick={() => onClick(item.id)}
      aria-current={isActive ? "page" : undefined}
      className={[
        "group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left",
        "transition-all duration-150 ease-out focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-[#4ADE80] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B3B2D]",
        isActive
          ? "bg-[#1A7A4A] text-white shadow-md shadow-black/20"
          : "text-[#A8CCBA] hover:bg-[#14543A] hover:text-white",
      ].join(" ")}
    >
      {/* Active left-edge indicator */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#4ADE80] rounded-full" />
      )}

      <Icon
        className={[
          "w-[18px] h-[18px] flex-shrink-0 transition-transform duration-150",
          "group-hover:scale-110",
          isActive ? "text-white" : "text-[#6BAF88]",
        ].join(" ")}
      />

      <span className="flex-1 text-[13.5px] font-medium leading-none tracking-[0.01em]">
        {item.label}
      </span>

      {/* Badge */}
      {item.badge !== null && (
        <span
          className={[
            "flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center",
            "text-[10.5px] font-bold leading-none tabular-nums",
            isActive
              ? "bg-[#4ADE80] text-[#0B3B2D]"
              : "bg-[#C84B31] text-white",
          ].join(" ")}
        >
          {item.badge}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────

function Sidebar({ activeMenu, onNavChange }) {
  return (
    <aside
      className="flex flex-col w-[220px] min-h-screen bg-[#0B3B2D] flex-shrink-0"
      aria-label="Navigasi utama"
    >
      {/* ── LOGO ── */}
      <div className="flex items-center justify-center px-4 pt-5 pb-4">
        {/*
         * Logo resmi TyreMind.
         * Ganti src dengan path asset yang sesuai dengan setup bundler:
         *   - Vite  : import logoSrc from "@/assets/logo_tyremind.png"
         *   - CRA   : import logoSrc from "./assets/logo_tyremind.png"
         *   - Next  : letakkan di /public lalu src="/logo_tyremind.png"
         * Saat ini menggunakan path relatif sebagai placeholder.
         */}
        <img
          src={logoTyreMind}
          alt="TyreMind"
          className="h-9 w-auto object-contain"
        />
      </div>

      {/* ── DIVIDER ── */}
      <div className="mx-4 mb-4 h-px bg-[#14543A]" />

      {/* ── NAV SECTION LABEL ── */}
      <p className="px-4 mb-2 text-[10px] font-semibold tracking-[0.14em] uppercase text-[#4A7A60]">
        Menu
      </p>

      {/* ── NAV ITEMS ── */}
      <nav className="flex-1 px-2 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activeMenu === item.id}
            onClick={onNavChange}
          />
        ))}
      </nav>

      {/* ── DIVIDER ── */}
      <div className="mx-4 mt-4 h-px bg-[#14543A]" />

      {/* ── USER PROFILE ── */}
      <div className="px-3 py-4">
        <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-[#14543A] transition-colors duration-150 group">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-[#1A7A4A] flex items-center justify-center flex-shrink-0 ring-2 ring-[#4ADE80]/30">
            <span className="text-white text-[11px] font-bold leading-none">DS</span>
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-white text-[12px] font-semibold leading-tight truncate">
              Dispatcher
            </p>
            <p className="text-[#6BAF88] text-[10.5px] leading-tight truncate">
              Main Haul Road
            </p>
          </div>
          <IconChevron className="w-4 h-4 text-[#4A7A60] group-hover:text-[#A8CCBA] flex-shrink-0 rotate-[-90deg]" />
        </button>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────
// TOP BAR
// ─────────────────────────────────────────────

function TopBar({ activeMenu }) {
  const item = NAV_ITEMS.find((n) => n.id === activeMenu);

  // Format tanggal — lokal ID
  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <header className="flex items-center justify-between px-7 py-4 border-b border-[#E8EDE9] bg-white flex-shrink-0">
      {/* Page title */}
      <div>
        <h1 className="text-[#0B3B2D] text-lg font-bold tracking-tight leading-tight">
          {item?.label}
        </h1>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-4">
        {/* Datetime */}
        <div className="text-right hidden sm:block">
          <p className="text-[#0B3B2D] text-[12px] font-semibold leading-tight">
            {timeStr}
          </p>
          <p className="text-[#6B8F7A] text-[11px] leading-tight capitalize">
            {dateStr}
          </p>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-[#E0EAE3]" />
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────
// MAIN LAYOUT — root component
// ─────────────────────────────────────────────

export default function MainLayout() {
  const [activeMenu, setActiveMenu] = useState("dashboard");

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7F5] font-sans antialiased">
      {/* ── SIDEBAR ── */}
      <Sidebar activeMenu={activeMenu} onNavChange={setActiveMenu} />

      {/* ── CONTENT AREA ── */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <TopBar activeMenu={activeMenu} />

        <main className="flex-1 overflow-y-auto p-7" id="main-content">
          {activeMenu === "dashboard" && <DashboardOverview />}
          {activeMenu === "tyre-monitoring" && <TyreMonitoring />}
          {activeMenu === "ai-insight" && <AiInsight />}
          {activeMenu === "road" && <RoadIntelligence />}
          {activeMenu === "operator" && <Operator />}
          {activeMenu === "payload" && <PayloadManagement />}
          {activeMenu === "reports" && <Reports />}
        </main>
      </div>
    </div>
  );
}