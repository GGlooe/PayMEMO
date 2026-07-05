let swReady = null;

async function ensurePermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/static/sw.js");
  } catch (e) {
    return null;
  }
}

function showNotificationNow(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (swReady && swReady.active) {
    swReady.active.postMessage({ title, body });
    return;
  }
  new Notification(title, { body });
}

async function testNotifications() {
  const ok = await ensurePermission();
  if (!ok) {
    alert("Разреши уведомления в браузере.");
    return;
  }

  swReady = await registerSW();

  fetch("/notifications/test", { method: "POST" })
    .then(r => r.json())
    .then(data => {
      const item = data.items && data.items[0];
      if (item) showNotificationNow("Payment Reminder", item.text);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const message = form.getAttribute("data-confirm") || "Подтвердить действие?";
      if (!window.confirm(message)) event.preventDefault();
    });
  });

  swReady = await registerSW();
});