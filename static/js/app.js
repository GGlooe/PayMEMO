let swReady = null;
let lastTrigger = null;

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
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.error("SW registration failed:", e);
    return null;
  }
}

function showNotificationNow(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ title, body });
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

  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || "";

  fetch("/notifications/test", { 
    method: "POST",
    headers: { "X-CSRF-Token": csrf }
  })
    .then(r => r.json())
    .then(data => {
      const item = data.items && data.items[0];
      if (item) showNotificationNow("Payment Reminder", item.text);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
  const csrfMeta = document.querySelector('meta[name="csrf-token"]');
  const csrfToken = csrfMeta ? csrfMeta.content : "";
  
  // Добавляем CSRF-токен во ВСЕ формы с method="post"
  document.querySelectorAll("form").forEach((form) => {
    if (form.method.toLowerCase() === "post") {
      // Не добавляем дубль, если уже есть
      if (!form.querySelector('input[name="csrf_token"]') && csrfToken) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "csrf_token";
        input.value = csrfToken;
        form.appendChild(input);
      }
    }
  });

  // Подтверждения действий
  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const message = form.getAttribute("data-confirm") || "Подтвердить действие?";
      if (!window.confirm(message)) event.preventDefault();
    });
  });

  swReady = await registerSW();

  // Polling уведомлений каждые 30 секунд
  setInterval(() => {
    if (document.hidden) return;
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content || "";
    fetch("/api/notifications/poll", {
      headers: { "X-CSRF-Token": csrf }
    })
      .then(r => r.json())
      .then(data => {
        if (!data.items || data.items.length === 0) return;
        if (!data.trigger) return;
        if (lastTrigger === data.trigger) return;
        lastTrigger = data.trigger;
        data.items.forEach(item => {
          const key = "notified_" + item.payment_id + "_" + new Date().toDateString();
          if (localStorage.getItem(key)) return;
          localStorage.setItem(key, "1");
          showNotificationNow("Payment Reminder", item.text);
        });
      })
      .catch(() => {});
  }, 30000);
});