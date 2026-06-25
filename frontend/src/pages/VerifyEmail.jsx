import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token mancante. Usa il link ricevuto via email.");
      return;
    }
    api
      .get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setMessage(res.data.detail || "Email verificata.");
        setStatus("success");
      })
      .catch((err) => {
        setMessage(err.response?.data?.detail || "Link non valido o scaduto.");
        setStatus("error");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md surface-card p-8 flex flex-col items-center gap-6 text-center">
        {status === "loading" && (
          <>
            <div
              className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "hsl(var(--accent))", borderTopColor: "transparent" }}
            />
            <p className="typo-body" style={{ color: "hsl(var(--muted-foreground))" }}>
              Verifica in corso...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <span style={{ fontSize: 48 }}>✅</span>
            <h2 className="typo-heading text-primary-content">Email verificata!</h2>
            <p className="typo-body" style={{ color: "hsl(var(--muted-foreground))" }}>{message}</p>
            <Link to="/login" className="btn-primary px-8 py-3">Accedi ora</Link>
          </>
        )}

        {status === "error" && (
          <>
            <span style={{ fontSize: 48 }}>❌</span>
            <h2 className="typo-heading text-primary-content">Verifica non riuscita</h2>
            <p className="typo-body" style={{ color: "hsl(var(--muted-foreground))" }}>{message}</p>
            <Link to="/register" className="btn-primary px-8 py-3">Registrati di nuovo</Link>
          </>
        )}
      </div>
    </div>
  );
}
