/* ==========================================================================
   Oak & Tide Landscaping — vanilla JS
   Mobile nav toggle, before/after comparison slider (mouse/touch/keyboard),
   process timeline accordion, quote form validation.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- Mobile nav toggle ---------------- */
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("primary-nav");
    if (!toggle || !nav) return;

    function closeNav() {
      toggle.setAttribute("aria-expanded", "false");
      nav.classList.remove("is-open");
      document.body.style.overflow = "";
    }

    function openNav() {
      toggle.setAttribute("aria-expanded", "true");
      nav.classList.add("is-open");
      document.body.style.overflow = "hidden";
    }

    toggle.addEventListener("click", function () {
      var expanded = toggle.getAttribute("aria-expanded") === "true";
      if (expanded) {
        closeNav();
      } else {
        openNav();
      }
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });

    var mql = window.matchMedia("(min-width: 1024px)");
    mql.addEventListener("change", function (e) {
      if (e.matches) closeNav();
    });
  }

  /* ---------------- Before / after slider ---------------- */
  function initCompareSlider() {
    var slider = document.querySelector(".ba-slider");
    if (!slider) return;

    var afterWrap = slider.querySelector(".ba-after-wrap");
    var handle = slider.querySelector(".ba-handle");
    var divider = slider.querySelector(".ba-divider");
    var pos = 50; // percent
    var dragging = false;

    function setPos(percent) {
      pos = Math.min(100, Math.max(0, percent));
      var val = pos + "%";
      slider.style.setProperty("--ba-pos", val);
      handle.setAttribute("aria-valuenow", Math.round(pos));
    }

    function percentFromClientX(clientX) {
      var rect = slider.getBoundingClientRect();
      var x = clientX - rect.left;
      return (x / rect.width) * 100;
    }

    function pointerMove(clientX) {
      setPos(percentFromClientX(clientX));
    }

    // Mouse
    handle.addEventListener("mousedown", function (e) {
      dragging = true;
      e.preventDefault();
    });
    slider.addEventListener("mousedown", function (e) {
      dragging = true;
      pointerMove(e.clientX);
    });
    window.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      pointerMove(e.clientX);
    });
    window.addEventListener("mouseup", function () {
      dragging = false;
    });

    // Touch
    slider.addEventListener(
      "touchstart",
      function (e) {
        dragging = true;
        pointerMove(e.touches[0].clientX);
      },
      { passive: true }
    );
    slider.addEventListener(
      "touchmove",
      function (e) {
        if (!dragging) return;
        pointerMove(e.touches[0].clientX);
      },
      { passive: true }
    );
    slider.addEventListener("touchend", function () {
      dragging = false;
    });

    // Keyboard (on the handle, which is a focusable slider control)
    handle.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 15 : 5;
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowDown":
          e.preventDefault();
          setPos(pos - step);
          break;
        case "ArrowRight":
        case "ArrowUp":
          e.preventDefault();
          setPos(pos + step);
          break;
        case "Home":
          e.preventDefault();
          setPos(0);
          break;
        case "End":
          e.preventDefault();
          setPos(100);
          break;
        default:
          break;
      }
    });

    // Click anywhere on the track to jump
    slider.addEventListener("click", function (e) {
      if (e.target === handle) return;
      pointerMove(e.clientX);
    });

    setPos(50);
  }

  /* ---------------- Process timeline accordion ---------------- */
  function initTimeline() {
    var triggers = document.querySelectorAll(".timeline-trigger");
    if (!triggers.length) return;

    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        var expanded = trigger.getAttribute("aria-expanded") === "true";
        var panelId = trigger.getAttribute("aria-controls");
        var panel = document.getElementById(panelId);

        trigger.setAttribute("aria-expanded", String(!expanded));
        if (panel) panel.setAttribute("data-open", String(!expanded));
      });
    });
  }

  /* ---------------- Quote form validation ---------------- */
  function initForm() {
    var form = document.getElementById("quote-form");
    if (!form) return;

    var status = document.getElementById("form-status");

    var validators = {
      name: function (v) {
        return v.trim().length >= 2 ? "" : "Please enter your full name.";
      },
      email: function (v) {
        var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(v.trim()) ? "" : "Enter a valid email address, e.g. name@example.com.";
      },
      phone: function (v) {
        var re = /^[0-9()+\s-]{8,16}$/;
        return re.test(v.trim()) ? "" : "Enter a valid phone number, e.g. (07) 5500 0106.";
      },
      message: function (v) {
        return v.trim().length >= 10 ? "" : "Tell us a little about your project (10+ characters).";
      }
    };

    function fieldWrap(input) {
      return input.closest(".field");
    }

    function showError(input, msg) {
      var wrap = fieldWrap(input);
      var errEl = document.getElementById(input.id + "-error");
      if (!wrap || !errEl) return;
      if (msg) {
        wrap.classList.add("has-error");
        errEl.textContent = msg;
        input.setAttribute("aria-invalid", "true");
      } else {
        wrap.classList.remove("has-error");
        errEl.textContent = "";
        input.removeAttribute("aria-invalid");
      }
    }

    function validateField(input) {
      var validator = validators[input.name];
      if (!validator) return true;
      var msg = validator(input.value);
      showError(input, msg);
      return !msg;
    }

    ["name", "email", "phone", "message"].forEach(function (name) {
      var input = form.elements[name];
      if (!input) return;
      input.addEventListener("blur", function () {
        validateField(input);
      });
      input.addEventListener("input", function () {
        if (fieldWrap(input).classList.contains("has-error")) {
          validateField(input);
        }
      });
    });

    function setStatus(kind, message) {
      status.className = "form-status is-visible " + kind;
      status.textContent = message;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var fieldsToCheck = ["name", "email", "phone", "message"];
      var firstInvalid = null;
      var allValid = true;

      fieldsToCheck.forEach(function (name) {
        var input = form.elements[name];
        if (!input) return;
        var ok = validateField(input);
        if (!ok) {
          allValid = false;
          if (!firstInvalid) firstInvalid = input;
        }
      });

      if (!allValid) {
        setStatus(
          "error",
          "Please fix the highlighted fields below before sending your enquiry."
        );
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // Demo only — no backend, no network call.
      setStatus(
        "success",
        "Thanks — your enquiry has been received. This is a demo site, so nothing was actually sent; a real Oak & Tide would reply within two business days."
      );
      form.reset();
      document
        .querySelectorAll(".field.has-error")
        .forEach(function (el) {
          el.classList.remove("has-error");
        });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initCompareSlider();
    initTimeline();
    initForm();
  });
})();

/* Graceful fallback for hotlinked photos that fail to load (network issues, dead links) */
(function () {
  var PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 400 300%27%3E%3Crect width=%27400%27 height=%27300%27 fill=%27%23d8d2c5%27/%3E%3Cpath d=%27M120 190l50-60 40 45 30-35 60 70H120z%27 fill=%27%23b3ab9a%27/%3E%3Ccircle cx=%27150%27 cy=%27110%27 r=%2720%27 fill=%27%23b3ab9a%27/%3E%3C/svg%3E";
  function applyFallback(img) {
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "true";
    img.src = PLACEHOLDER;
    img.style.objectFit = "cover";
  }
  document.querySelectorAll("img").forEach(function (img) {
    // Image already finished loading (successfully or not) by the time this runs
    if (img.complete) {
      if (img.naturalWidth === 0) applyFallback(img);
      return;
    }
    img.addEventListener("error", function () { applyFallback(img); }, { once: true });
  });
})();
