import { NavLink } from "react-router-dom";

const items = [
  { to: "/dashboard", label: "Check-in", testid: "nav-checkin-tab" },
  { to: "/calendar", label: "Calendario", testid: "nav-calendar-tab" },
  { to: "/archive", label: "Archivio", testid: "nav-archive-tab" },
  { to: "/settings", label: "Impostazioni", testid: "nav-settings-tab" },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full h-16 bg-[#05050A]/95 backdrop-blur-xl border-t border-[#1E1E28] flex justify-around items-center z-50">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          data-testid={it.testid}
          className={({ isActive }) =>
            `text-xs tracking-[0.25em] uppercase transition-colors px-4 py-2 ${
              isActive
                ? "text-zinc-100 font-bold"
                : "text-zinc-500 hover:text-zinc-300"
            }`
          }
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
