import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState("default");
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      !!window.navigator.standalone;
    setIsIOS(ios);
    setIsStandalone(standalone);

    const supported = "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);

    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }

    if (supported) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) return { ok: false, error: "Push non supportato" };
    setLoading(true);
    try {
      const { data } = await api.get("/push/vapid-public-key");
      const vapidPublicKey = data.public_key;
      if (!vapidPublicKey) throw new Error("VAPID key non configurata sul server");

      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return { ok: false, error: "Permesso negato dal browser" };

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      await api.post("/push/subscribe", sub.toJSON());
      setIsSubscribed(true);
      return { ok: true };
    } catch (e) {
      console.error("[Push] Errore subscribe:", e);
      return { ok: false, error: e.message || String(e) };
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await api.delete("/push/subscribe");
      setIsSubscribed(false);
    } catch (e) {
      console.error("[Push] Errore unsubscribe:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    isSupported,
    isSubscribed,
    permission,
    isIOS,
    isStandalone,
    loading,
    subscribe,
    unsubscribe,
  };
}
