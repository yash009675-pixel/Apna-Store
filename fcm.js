import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyDI4HUTnnyxBqiBYNRiS9zadEG15yqTZQU",
  authDomain: "apna-store-949a7.firebaseapp.com",
  projectId: "apna-store-949a7",
  storageBucket: "apna-store-949a7.firebasestorage.app",
  messagingSenderId: "923907531359",
  appId: "1:923907531359:web:e8a415af52536b9c10f1ea",
  measurementId: "G-T4B7WBJF7Y"
};

const VAPID_KEY = "BNXo2nraa5DqbFw20p6JlZ_VBwEV-GpMcm0e8HwnAeWD5EfJWfTbCh6kXGIC87qnIfxPa-Yf_UNnt74r0oMb0UU";

let messagingPromise;
const getMessagingInstance = async () => {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        throw new Error("Push notifications are not supported here.");
      }
      if (!(await isSupported())) {
        throw new Error("This browser does not support Firebase web push.");
      }
      const app = initializeApp(firebaseConfig);
      return getMessaging(app);
    })();
  }
  return messagingPromise;
};

window.apnaEnableFcm = async () => {
  const { data: sessionData } = await window.apnaSupabase.auth.getSession();
  if (!sessionData?.session) throw new Error("Please sign in before enabling notifications.");

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js", {
    scope: "./firebase-cloud-messaging-push-scope/"
  });

  const messaging = await getMessagingInstance();
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration
  });

  if (!token) throw new Error("Firebase did not return a push token.");

  const { error } = await window.apnaSupabase.functions.invoke("apna-register-push", {
    body: {
      token,
      browser: navigator.userAgentData?.brands?.map(x => x.brand).join(", ") || navigator.userAgent.slice(0, 80),
      userAgent: navigator.userAgent
    }
  });

  if (error) throw error;

  localStorage.setItem("apna-fcm-enabled", "1");
  window.dispatchEvent(new CustomEvent("apna:fcm-enabled"));
  return token;
};

(async () => {
  try {
    const messaging = await getMessagingInstance();
    onMessage(messaging, payload => {
      const title = payload.notification?.title || payload.data?.title || "Apna Store";
      const body = payload.notification?.body || payload.data?.body || "You have a new update.";
      if (Notification.permission === "granted") {
        try {
          new Notification(title, {
            body,
            icon: "./pwa-icon-192.svg",
            data: { url: payload.data?.url || "./notifications.html" }
          });
        } catch {}
      }
      window.dispatchEvent(new CustomEvent("apna:fcm-message", { detail: payload }));
    });
  } catch (error) {
    console.debug("Apna Store FCM is not available:", error);
  }
})();