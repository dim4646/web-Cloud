/* ==========================================================================
   Coastal Café — site scripts
   Vanilla JS. No dependencies, no build step.
   ========================================================================== */
(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     Sticky header shadow
     ------------------------------------------------------------------ */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ------------------------------------------------------------------
     Mobile nav toggle
     ------------------------------------------------------------------ */
  var navToggle = document.querySelector(".nav-toggle");
  var siteNav = document.getElementById("site-nav");
  var navScrim = document.querySelector(".nav-scrim");

  function closeNav() {
    if (!navToggle || !siteNav) return;
    navToggle.setAttribute("aria-expanded", "false");
    siteNav.classList.remove("is-open");
    if (navScrim) navScrim.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
  }

  function openNav() {
    if (!navToggle || !siteNav) return;
    navToggle.setAttribute("aria-expanded", "true");
    siteNav.classList.add("is-open");
    if (navScrim) navScrim.classList.add("is-open");
    document.body.classList.add("no-scroll");
  }

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var isOpen = navToggle.getAttribute("aria-expanded") === "true";
      if (isOpen) {
        closeNav();
      } else {
        openNav();
      }
    });

    siteNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });

    if (navScrim) navScrim.addEventListener("click", closeNav);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeNav();
    });

    var navMediaQuery = window.matchMedia("(min-width: 68rem)");
    var handleNavBreakpoint = function () {
      if (navMediaQuery.matches) closeNav();
    };
    if (navMediaQuery.addEventListener) {
      navMediaQuery.addEventListener("change", handleNavBreakpoint);
    }
  }

  /* ------------------------------------------------------------------
     Scroll-reveal animations
     ------------------------------------------------------------------ */
  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) {
        el.classList.add("is-visible");
      });
    } else {
      var revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
      );
      revealEls.forEach(function (el) {
        revealObserver.observe(el);
      });
    }
  }

  /* ------------------------------------------------------------------
     Gallery lightbox
     ------------------------------------------------------------------ */
  var galleryButtons = document.querySelectorAll(".gallery-item");
  var lightbox = document.getElementById("lightbox");

  if (galleryButtons.length && lightbox) {
    var lightboxImg = lightbox.querySelector("img");
    var lightboxCap = lightbox.querySelector(".lightbox-cap");
    var lightboxClose = lightbox.querySelector(".lightbox-close");
    var lastFocused = null;

    function openLightbox(button) {
      var img = button.querySelector("img");
      if (!img || !lightboxImg) return;
      lastFocused = button;
      lightboxImg.src = img.currentSrc || img.src;
      lightboxImg.alt = img.alt || "";
      if (lightboxCap) {
        lightboxCap.textContent = button.getAttribute("data-caption") || "";
      }
      lightbox.classList.add("is-open");
      document.body.classList.add("no-scroll");
      if (lightboxClose) lightboxClose.focus();
    }

    function closeLightbox() {
      lightbox.classList.remove("is-open");
      document.body.classList.remove("no-scroll");
      if (lightboxImg) lightboxImg.src = "";
      if (lastFocused) lastFocused.focus();
    }

    galleryButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        openLightbox(button);
      });
    });

    if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);

    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) closeLightbox();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && lightbox.classList.contains("is-open")) {
        closeLightbox();
      }
    });
  }

  /* ------------------------------------------------------------------
     Contact form validation
     ------------------------------------------------------------------ */
  var form = document.getElementById("enquiry-form");
  if (form) {
    var status = document.getElementById("form-status");
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    var fields = {
      name: {
        el: document.getElementById("cf-name"),
        error: document.getElementById("cf-name-error"),
        validate: function (value) {
          return value.trim().length > 1 ? "" : "Please enter your full name.";
        }
      },
      email: {
        el: document.getElementById("cf-email"),
        error: document.getElementById("cf-email-error"),
        validate: function (value) {
          if (!value.trim()) return "Please enter your email address.";
          return emailPattern.test(value.trim()) ? "" : "Please enter a valid email address.";
        }
      },
      phone: {
        el: document.getElementById("cf-phone"),
        error: document.getElementById("cf-phone-error"),
        validate: function (value) {
          if (!value.trim()) return "";
          return /^[0-9+()\s-]{6,20}$/.test(value.trim()) ? "" : "Please enter a valid phone number.";
        }
      },
      message: {
        el: document.getElementById("cf-message"),
        error: document.getElementById("cf-message-error"),
        validate: function (value) {
          return value.trim().length > 9 ? "" : "Tell us a little more (at least 10 characters).";
        }
      }
    };

    function showFieldError(field, message) {
      if (!field.el || !field.error) return;
      field.error.textContent = message;
      if (message) {
        field.el.setAttribute("aria-invalid", "true");
      } else {
        field.el.removeAttribute("aria-invalid");
      }
    }

    function validateField(key) {
      var field = fields[key];
      if (!field.el) return true;
      var message = field.validate(field.el.value);
      showFieldError(field, message);
      return message === "";
    }

    Object.keys(fields).forEach(function (key) {
      var field = fields[key];
      if (!field.el) return;
      field.el.addEventListener("blur", function () {
        validateField(key);
      });
      field.el.addEventListener("input", function () {
        if (field.el.getAttribute("aria-invalid") === "true") {
          validateField(key);
        }
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var isValid = true;
      Object.keys(fields).forEach(function (key) {
        var fieldValid = validateField(key);
        if (!fieldValid) isValid = false;
      });

      if (!status) return;

      if (!isValid) {
        status.textContent = "Please fix the highlighted fields and try again.";
        status.className = "form-status is-error";
        var firstInvalid = form.querySelector('[aria-invalid="true"]');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // Demo site only — no backend. Simulate a successful enquiry.
      status.textContent = "Thanks! Your enquiry has been received — we'll reply within one business day.";
      status.className = "form-status is-success";
      form.reset();
      Object.keys(fields).forEach(function (key) {
        showFieldError(fields[key], "");
      });
    });
  }

  /* ------------------------------------------------------------------
     Broken-image safety net (defensive — keeps layout tidy if a
     hotlinked photo ever fails to load)
     ------------------------------------------------------------------ */
  var fallbackSrc =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">' +
      '<rect width="800" height="600" fill="#EFE1CB"/>' +
      '<circle cx="400" cy="260" r="70" fill="none" stroke="#C1592F" stroke-width="10"/>' +
      '<path d="M470 240h40a30 30 0 0 1 0 60h-40" fill="none" stroke="#C1592F" stroke-width="10"/>' +
      '<path d="M340 190c0-20 20-20 20-40M400 190c0-20 20-20 20-40M460 190c0-20 20-20 20-40" fill="none" stroke="#C1592F" stroke-width="8" stroke-linecap="round"/>' +
      '<text x="400" y="400" font-family="Georgia, serif" font-size="22" fill="#5B4F41" text-anchor="middle">Coastal Café</text>' +
      "</svg>"
    );

  document.querySelectorAll("img").forEach(function (img) {
    img.addEventListener(
      "error",
      function () {
        if (img.src !== fallbackSrc) {
          img.src = fallbackSrc;
          img.classList.add("img-fallback");
        }
      },
      { once: true }
    );
  });

  /* ------------------------------------------------------------------
     Footer year
     ------------------------------------------------------------------ */
  var yearEl = document.getElementById("current-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();

/* Graceful fallback for hotlinked photos that fail to load (network issues, dead links) */
(function () {
  var PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 400 300%27%3E%3Crect width=%27400%27 height=%27300%27 fill=%27%23d8d2c5%27/%3E%3Cpath d=%27M120 190l50-60 40 45 30-35 60 70H120z%27 fill=%27%23b3ab9a%27/%3E%3Ccircle cx=%27150%27 cy=%27110%27 r=%2720%27 fill=%27%23b3ab9a%27/%3E%3C/svg%3E";
  document.querySelectorAll("img").forEach(function (img) {
    img.addEventListener("error", function () {
      if (img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = "true";
      img.src = PLACEHOLDER;
      img.style.objectFit = "cover";
    }, { once: true });
  });
})();
