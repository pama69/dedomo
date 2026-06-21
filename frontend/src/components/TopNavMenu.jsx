import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/dashboard", label: "Check-in", testid: "nav-checkin-tab" },
  { to: "/calendar", label: "Calendario", testid: "nav-calendar-tab" },
  { to: "/archive", label: "Archivio", testid: "nav-archive-tab" },
  { to: "/settings", label: "Impostazioni", testid: "nav-settings-tab" },
  { to: "/billing/pricing", label: "Abbonamento", testid: "nav-billing-tab" },
];

export default function TopNavMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="nav-hamburger"
        aria-label="Menu"
        aria-expanded={open}
        className="flex flex-col justify-center items-center gap-1.5 w-9 h-9 border border-border hover:border-zinc-400 transition-colors cursor-pointer group"
      >
        <span
          className={`block h-[1.5px] w-4 bg-zinc-300 transition-transform ${
            open ? "translate-y-[6px] rotate-45" : ""
          }`}
        />
        <span
          className={`block h-[1.5px] w-4 bg-zinc-300 transition-opacity ${
            open ? "opacity-0" : ""
          }`}
        />
        <span
          className={`block h-[1.5px] w-4 bg-zinc-300 transition-transform ${
            open ? "-translate-y-[6px] -rotate-45" : ""
          }`}
        />
      </button>

      {open && (
        <nav
          data-testid="nav-menu-panel"
          className="absolute right-0 top-full mt-2 min-w-[200px] bg-background border border-border shadow-2xl flex flex-col z-50"
        >
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              onClick={() => setOpen(false)}
              data-testid={it.testid}
              className={({ isActive }) =>
                `text-[10px] tracking-[0.25em] uppercase px-4 py-3 border-b border-border last:border-b-0 transition-colors ${
                  isActive
                    ? "text-zinc-100 bg-surface-1 font-bold"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-surface-1"
                }`
              }
            >
              {it.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
