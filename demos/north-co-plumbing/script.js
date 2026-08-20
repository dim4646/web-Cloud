/* ==========================================================================
   North & Co Plumbing — demo website scripts
   Vanilla JS. No dependencies, no network calls.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- Mobile nav toggle ---------------- */
  var navToggle = document.querySelector("[data-nav-toggle]");
  var navClose = document.querySelector("[data-nav-close]");
  var nav = document.getElementById("primary-nav");
  var scrim = document.querySelector("[data-nav-scrim]");
  var navLinks = document.querySelectorAll("[data-nav-link]");

  function openNav() {
    if (!nav) return;
    nav.classList.add("is-open");
    if (scrim) scrim.classList.add("is-visible");
    if (navToggle) navToggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function closeNav() {
    if (!nav) return;
    nav.classList.remove("is-open");
    if (scrim) scrim.classList.remove("is-visible");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  if (navToggle) navToggle.addEventListener("click", openNav);
  if (navClose) navClose.addEventListener("click", closeNav);
  if (scrim) scrim.addEventListener("click", closeNav);
  navLinks.forEach(function (link) {
    link.addEventListener("click", closeNav);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
  });

  /* ---------------- Before / after gallery sliders ---------------- */
  var sliders = document.querySelectorAll("[data-ba-slider]");
  sliders.forEach(function (slider) {
    var range = slider.querySelector(".ba-range");
    var beforeWrap = slider.querySelector("[data-ba-before-wrap]");
    var handle = slider.querySelector("[data-ba-handle]");
    var thumb = slider.querySelector(".ba-thumb");
    if (!range || !beforeWrap) return;

    function update(value) {
      var pct = Math.min(100, Math.max(0, Number(value)));
      beforeWrap.style.width = pct + "%";
      var img = beforeWrap.querySelector("img");
      if (img) {
        var containerWidth = slider.getBoundingClientRect().width || 1;
        img.style.width = (containerWidth) + "px";
      }
      if (handle) handle.style.left = pct + "%";
      if (thumb) thumb.style.left = pct + "%";
    }

    range.addEventListener("input", function () {
      update(range.value);
    });
    window.addEventListener("resize", function () {
      update(range.value);
    });
    update(range.value);
  });

  /* ---------------- FAQ accordion ---------------- */
  var faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach(function (item) {
    var button = item.querySelector(".faq-question");
    var answer = item.querySelector(".faq-answer");
    if (!button || !answer) return;

    button.addEventListener("click", function () {
      var isOpen = item.classList.contains("is-open");

      faqItems.forEach(function (other) {
        other.classList.remove("is-open");
        var otherBtn = other.querySelector(".faq-question");
        if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
      });

      if (!isOpen) {
        item.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
      }
    });
  });

  /* ---------------- Footer year ---------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------------- Quote form validation ---------------- */
  var form = document.getElementById("quote-form");
  if (form) {
    var status = document.getElementById("form-status");

    var validators = {
      name: function (value) {
        return value.trim().length >= 2;
      },
      phone: function (value) {
        var cleaned = value.trim().replace(/[\s()-]/g, "");
        return /^(\+?61|0)[2-9]\d{8}$/.test(cleaned);
      },
      email: function (value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
      },
      service: function (value) {
        return value.trim().length > 0;
      },
      message: function (value) {
        return value.trim().length >= 10;
      },
      consent: function (value, el) {
        return el.checked === true;
      }
    };

    function setFieldError(fieldId, hasError) {
      var wrap = document.getElementById("field-" + fieldId);
      if (wrap) {
        wrap.classList.toggle("has-error", hasError);
      } else {
        var errorEl = document.getElementById(fieldId + "-error");
        if (errorEl) errorEl.style.display = hasError ? "block" : "none";
      }
    }

    function showStatus(message, type) {
      if (!status) return;
      status.textContent = message;
      status.classList.remove("is-success", "is-error");
      status.classList.add(type === "success" ? "is-success" : "is-error");
    }

    function clearStatus() {
      if (!status) return;
      status.textContent = "";
      status.classList.remove("is-success", "is-error");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearStatus();

      var fields = ["name", "phone", "email", "service", "message", "consent"];
      var firstInvalid = null;
      var allValid = true;

      fields.forEach(function (fieldName) {
        var el = form.elements[fieldName];
        if (!el) return;
        var value = el.type === "checkbox" ? el.checked : el.value;
        var isValid = validators[fieldName] ? validators[fieldName](value, el) : true;

        setFieldError(fieldName, !isValid);

        if (!isValid) {
          allValid = false;
          if (!firstInvalid) firstInvalid = el;
        }
      });

      if (!allValid) {
        showStatus("Please fix the highlighted fields and try again.", "error");
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // Demo only — no backend, no network request is made.
      showStatus("Thanks! Your quote request has been received. We'll be in touch shortly. (Demo form — no data was sent.)", "success");
      form.reset();
      fields.forEach(function (fieldName) {
        setFieldError(fieldName, false);
      });
    });

    // Clear individual field errors as the user corrects them.
    ["name", "phone", "email", "service", "message"].forEach(function (fieldName) {
      var el = form.elements[fieldName];
      if (!el) return;
      el.addEventListener("input", function () {
        if (validators[fieldName](el.value, el)) {
          setFieldError(fieldName, false);
        }
      });
    });
    var consentEl = form.elements["consent"];
    if (consentEl) {
      consentEl.addEventListener("change", function () {
        if (consentEl.checked) setFieldError("consent", false);
      });
    }
  }
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
