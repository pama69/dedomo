import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Landing — public marketing page served from /public/landing.html.
 * Logged-in users skip this and go straight to /dashboard.
 * Anonymous users get redirected to the static HTML file (faster, no JS overhead).
 */
export default function Landing() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      // Replace (not assign) so the back button doesn't loop to /
      window.location.replace("/landing.html");
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05050A] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  // Anonymous: while window.location.replace() kicks in, render nothing
  return (
    <div className="min-h-screen bg-[#05050A] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin" />
    </div>
  );
}
