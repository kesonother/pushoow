const SDK = `/* Pushoow embed SDK — no framework required */
(function (root) {
  var current = document.currentScript;
  var base = (current && current.getAttribute("data-base")) || (current && current.src ? current.src.replace(/\\/embed\\/pushoow\\.js.*$/, "") : "");
  function node(target) {
    return typeof target === "string" ? document.querySelector(target) : target;
  }
  function frame(src, minHeight) {
    var iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = "Pushoow";
    iframe.loading = "lazy";
    iframe.style.cssText = "width:100%;border:0;min-height:" + (minHeight || "360px") + ";background:transparent;";
    return iframe;
  }
  function mount(target, src, height) {
    var el = node(target);
    if (!el) return null;
    el.innerHTML = "";
    var iframe = frame(src, height);
    el.appendChild(iframe);
    return iframe;
  }
  var api = {
    calendar: function (target, opts) {
      opts = opts || {};
      return mount(target, (opts.baseUrl || base) + "/embed/calendar/" + encodeURIComponent(opts.calendarId), opts.height || "420px");
    },
    rsvp: function (target, opts) {
      opts = opts || {};
      return mount(target, (opts.baseUrl || base) + "/embed/rsvp/" + encodeURIComponent(opts.eventId), opts.height || "180px");
    },
    ticket: function (target, opts) {
      opts = opts || {};
      return mount(target, (opts.baseUrl || base) + "/embed/ticket/" + encodeURIComponent(opts.eventId), opts.height || "280px");
    },
    auto: function () {
      document.querySelectorAll("[data-pushoow]").forEach(function (el) {
        var kind = el.getAttribute("data-pushoow");
        if (kind === "calendar" && el.getAttribute("data-calendar-id")) {
          api.calendar(el, { calendarId: el.getAttribute("data-calendar-id") });
        }
        if (kind === "rsvp" && el.getAttribute("data-event-id")) {
          api.rsvp(el, { eventId: el.getAttribute("data-event-id") });
        }
        if (kind === "ticket" && el.getAttribute("data-event-id")) {
          api.ticket(el, { eventId: el.getAttribute("data-event-id") });
        }
      });
    }
  };
  root.Pushoow = api;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", api.auto);
  } else {
    api.auto();
  }
})(typeof window !== "undefined" ? window : this);
`;

export function GET() {
  return new Response(SDK, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });
}
