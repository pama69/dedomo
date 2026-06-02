import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/login", { replace: true });
      return;
    }
    const session_id = decodeURIComponent(match[1]);

    api
      .post("/auth/session", { session_id })
      .then((res) => {
        setUser(res.data);
        // Clear hash and go to dashboard
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { replace: true, state: { user: res.data } });
      })
      .catch((e) => {
        const detail = e.response?.data?.detail || "";
        const isDisabled = e.response?.status === 403 && detail.toUpperCase().includes("DISABILITATO");
        navigate(
          isDisabled ? "/login?error=disabled" : "/login",
          { replace: true },
        );
      });
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05050A]">
      <p className="text-zinc-500 text-xs tracking-[0.3em] uppercase">Autenticazione in corso...</p>
    </div>
  );
}
