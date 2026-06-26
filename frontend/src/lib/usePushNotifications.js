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

  const subscribe = useCallback(async (onStep) => {
    const step = (msg) => { console.log("[Push]", msg); onStep && onStep(msg); };
    if (!isSupported) return { ok: false, error: "Push non supportato dal browser" };
    setLoading(true);
    try {
      step("1/5 Recupero chiave VAPID...");
      const { data } = await api.get("/push/vapid-public-key");
      const vapidPublicKey = data.public_key;
      if (!vapidPublicKey) throw new Error("VAPID_PUBLIC_KEY non configurata su Railway");

      step("2/5 Service Worker pronto...");
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error("SW timeout (10s)")), 10000)),
      ]);

      step("3/5 Richiesta permesso notifiche...");
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return { ok: false, error: `Permesso ${perm} — abilita le notifiche nelle impostazioni del browser` };

      step("4/5 Creazione subscription browser...");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      step("5/5 Salvataggio nel database...");
      const saveRes = await api.post("/push/subscribe", JSON.parse(JSON.stringify(sub)));
      if (!saveRes.data.saved) {
        throw new Error(`Salvataggio fallito (uid=${saveRes.data.uid})`);
      }
      setIsSubscribed(true);
      return { ok: true };
    } catch (e) {
      console.error("[Push] Errore:", e);
      return { ok: false, error: e.message || String(e) };
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const testLocal = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("Dedomo — Test locale", {
        body: "Se vedi questa notifica, il sistema funziona.",
        vibrate: [100, 50, 100],
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }, []);

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
    testLocal,
  };
}
