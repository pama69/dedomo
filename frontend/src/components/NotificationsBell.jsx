import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";

export default function NotificationsBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const r = await api.get("/notifications");
      setItems(r.data?.items || []);
      setUnread(r.data?.unread_count || 0);
    } catch {/* silent */}
  };

  useEffect(() => {
    fetchNotifications();
    const t = setInterval(fetchNotifications, 60000); // poll every 60s
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`);
    setItems((prev) => prev.map((x) => x.notification_id === id ? { ...x, read: true } : x));
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAll = async () => {
    await api.post("/notifications/read-all");
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
  };

  const levelColor = (lvl) => ({
    success: "border-emerald-500/50 text-emerald-400",
    warning: "border-amber-500/50 text-amber-400",
    error: "border-red-500/50 text-red-400",
    info: "border-zinc-500/50 text-zinc-300",
  }[lvl] || "border-zinc-500/50 text-zinc-300");

  const levelIcon = (lvl) => ({
    success: "✓",
    warning: "!",
    error: "✕",
    info: "i",
  }[lvl] || "·");

  const formatTime = (iso) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMin = Math.floor((now - d) / 60000);
      if (diffMin < 1) return "ora";
      if (diffMin < 60) return `${diffMin}m fa`;
      if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h fa`;
      return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
    } catch { return ""; }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="notifications-bell"
        className="relative p-2 text-zinc-400 hover:text-zinc-100 cursor-pointer transition-colors"
        aria-label="Notifiche"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span
            data-testid="notifications-badge"
            className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-mono font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notifications-dropdown"
          className="
            fixed left-2 right-2 top-16 z-50
            sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80
            bg-zinc-900 border border-zinc-700 shadow-2xl
            max-h-[70vh] sm:max-h-[520px] overflow-hidden flex flex-col
          "
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
            <span className="text-xs font-bold tracking-widest uppercase text-zinc-300">Notifiche</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                data-testid="notifications-mark-all"
                className="text-xs text-zinc-400 hover:text-zinc-100 cursor-pointer underline underline-offset-2"
              >
                Segna tutte lette
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-zinc-500 text-sm font-mono">
                Nessuna notifica
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.notification_id}
                  type="button"
                  onClick={() => !n.read && markRead(n.notification_id)}
                  data-testid={`notification-${n.notification_id}`}
                  className={`relative w-full text-left px-4 py-4 border-b border-zinc-800 hover:bg-zinc-800 flex gap-3 cursor-pointer transition-colors ${
                    !n.read ? "bg-zinc-800/60" : "bg-transparent"
                  }`}
                >
                  {/* Level icon */}
                  <div className={`w-7 h-7 flex-shrink-0 border flex items-center justify-center font-mono font-bold text-sm ${levelColor(n.level)}`}>
                    {levelIcon(n.level)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-sm font-bold leading-snug ${!n.read ? "text-zinc-50" : "text-zinc-400"}`}>
                        {n.title}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500 flex-shrink-0 mt-0.5">
                        {formatTime(n.created_at)}
                      </span>
                    </div>
                    <p className={`text-xs font-mono leading-relaxed ${!n.read ? "text-zinc-300" : "text-zinc-500"}`}>
                      {n.body}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <span className="absolute right-3 top-4 w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
