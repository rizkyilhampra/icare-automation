document.addEventListener("DOMContentLoaded", () => {
  const pendingCountEl = document.getElementById("pending-count");
  const successCountEl = document.getElementById("success-count");
  const failedCountEl = document.getElementById("failed-count");

  if (!pendingCountEl || !successCountEl || !failedCountEl) {
    console.error("Count elements not found");
    return;
  }

  const eventSource = new EventSource("/events");

  eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);
    pendingCountEl.textContent = data.pending || 0;
    successCountEl.textContent = data.done || 0;
    failedCountEl.textContent = data.failed || 0;
  };

  eventSource.onerror = function (err) {
    console.error("EventSource failed:", err);
    eventSource.close();
  };
});
