self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.title && data.body) {
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/static/icon.png"
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});