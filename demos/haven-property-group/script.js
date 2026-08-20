/*!
 * Haven Property Group — site scripts (vanilla JS, no dependencies)
 * - Mobile navigation toggle
 * - Scroll-aware active nav link
 * - Reveal-on-scroll for property/suburb cards
 * - Client-side property filtering (suburb + price band) with aria-live count
 * - Enquiry / appraisal form validation + fake submit handling
 */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------------
   * Mobile nav toggle
   * ------------------------------------------------------------------- */
  var navToggle = document.querySelector(".nav-toggle");
  var primaryNav = document.getElementById("primary-nav");

  if (navToggle && primaryNav) {
    navToggle.addEventListener("click", function () {
      var isOpen = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!isOpen));
      primaryNav.classList.toggle("is-open", !isOpen);
      document.body.style.overflow = !isOpen ? "hidden" : "";
    });

    // Close menu when a nav link is followed (mobile)
    primaryNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.innerWidth < 900) {
          navToggle.setAttribute("aria-expanded", "false");
          primaryNav.classList.remove("is-open");
          document.body.style.overflow = "";
        }
      });
    });

    // Close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
        navToggle.setAttribute("aria-expanded", "false");
        primaryNav.classList.remove("is-open");
        document.body.style.overflow = "";
        navToggle.focus();
      }
    });
  }

  /* ---------------------------------------------------------------------
   * Scroll-spy: highlight the current section in the nav
   * ------------------------------------------------------------------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".primary-nav a[href^='#']"));
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute("href").slice(1);
      return document.getElementById(id);
    })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var link = navLinks.find(function (l) {
            return l.getAttribute("href") === "#" + entry.target.id;
          });
          if (!link) return;
          if (entry.isIntersecting) {
            navLinks.forEach(function (l) {
              l.removeAttribute("aria-current");
            });
            link.setAttribute("aria-current", "true");
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach(function (s) {
      spy.observe(s);
    });
  }

  /* ---------------------------------------------------------------------
   * Reveal-on-scroll for cards
   * ------------------------------------------------------------------- */
  var revealTargets = document.querySelectorAll(".property-card, .suburb-card, .agent-card");
  if (revealTargets.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealTargets.forEach(function (el) {
        el.classList.add("is-visible");
      });
    } else {
      var revealer = new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );
      revealTargets.forEach(function (el, i) {
        el.style.transitionDelay = Math.min(i % 6, 5) * 60 + "ms";
        revealer.observe(el);
      });
    }
  }

  /* ---------------------------------------------------------------------
   * Property filter (suburb + price band)
   * ------------------------------------------------------------------- */
  var grid = document.getElementById("property-grid");
  var suburbFilter = document.getElementById("filter-suburb");
  var priceFilter = document.getElementById("filter-price");
  var resetBtn = document.getElementById("filter-reset");
  var statusEl = document.getElementById("filter-status");
  var noResults = document.getElementById("no-results");

  function priceBand(price) {
    if (price < 1000000) return "under-1m";
    if (price < 1750000) return "1m-1-75m";
    if (price < 2500000) return "1-75m-2-5m";
    return "over-2-5m";
  }

  function applyFilters() {
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".property-card"));
    var suburb = suburbFilter ? suburbFilter.value : "all";
    var band = priceFilter ? priceFilter.value : "all";
    var visibleCount = 0;

    cards.forEach(function (card) {
      var matchesSuburb = suburb === "all" || card.dataset.suburb === suburb;
      var price = Number(card.dataset.price || 0);
      var matchesPrice = band === "all" || priceBand(price) === band;
      var show = matchesSuburb && matchesPrice;
      card.hidden = !show;
      if (show) visibleCount++;
    });

    if (noResults) {
      noResults.classList.toggle("is-visible", visibleCount === 0);
    }

    if (statusEl) {
      var msg =
        visibleCount === 0
          ? "No properties match your filters."
          : visibleCount === 1
          ? "Showing 1 property."
          : "Showing " + visibleCount + " properties.";
      statusEl.textContent = msg;
    }
  }

  if (grid) {
    if (suburbFilter) suburbFilter.addEventListener("change", applyFilters);
    if (priceFilter) priceFilter.addEventListener("change", applyFilters);
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (suburbFilter) suburbFilter.value = "all";
        if (priceFilter) priceFilter.value = "all";
        applyFilters();
      });
    }
    applyFilters();
  }

  /* ---------------------------------------------------------------------
   * Form validation (enquiry / appraisal request)
   * ------------------------------------------------------------------- */
  var form = document.getElementById("enquiry-form");

  if (form) {
    var successBox = document.getElementById("form-success");
    var failBox = document.getElementById("form-fail");

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var PHONE_RE = /^(\+?61|0)[2-478][\s-]?\d{4}[\s-]?\d{4}$/;

    var validators = {
      name: function (v) {
        return v.trim().length >= 2 ? "" : "Please enter your full name.";
      },
      email: function (v) {
        if (!v.trim()) return "Please enter your email address.";
        return EMAIL_RE.test(v.trim()) ? "" : "Enter a valid email address, e.g. name@example.com.";
      },
      phone: function (v) {
        if (!v.trim()) return "Please enter a phone number.";
        return PHONE_RE.test(v.trim().replace(/\s+/g, " ")) ? "" : "Enter a valid Australian phone number, e.g. 0412 345 678.";
      },
      reason: function (v) {
        return v ? "" : "Please choose a reason for your enquiry.";
      },
      message: function (v) {
        return v.trim().length >= 10 ? "" : "Tell us a little more (at least 10 characters).";
      }
    };

    function fieldGroup(input) {
      return input.closest(".form-group");
    }

    function showError(input, msg) {
      var group = fieldGroup(input);
      if (!group) return;
      var errorEl = group.querySelector(".form-error");
      group.classList.toggle("has-error", !!msg);
      if (errorEl) errorEl.textContent = msg;
      input.setAttribute("aria-invalid", msg ? "true" : "false");
    }

    function validateField(input) {
      var validator = validators[input.name];
      if (!validator) return true;
      var msg = validator(input.value);
      showError(input, msg);
      return !msg;
    }

    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || !validators[el.name]) return;
      el.addEventListener("blur", function () {
        el.dataset.touched = "true";
        validateField(el);
      });
      el.addEventListener("input", function () {
        if (el.dataset.touched === "true") validateField(el);
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (successBox) successBox.classList.remove("is-visible");
      if (failBox) failBox.classList.remove("is-visible");

      var fields = Array.prototype.filter.call(form.elements, function (el) {
        return el.name && validators[el.name];
      });

      var firstInvalid = null;
      var allValid = true;

      fields.forEach(function (el) {
        el.dataset.touched = "true";
        var ok = validateField(el);
        if (!ok) {
          allValid = false;
          if (!firstInvalid) firstInvalid = el;
        }
      });

      if (!allValid) {
        if (failBox) {
          failBox.textContent = "Please fix the highlighted fields and try again.";
          failBox.classList.add("is-visible");
        }
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // Demo only: no backend / network call. Simulate a brief send delay.
      var submitBtn = form.querySelector("button[type='submit']");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }

      window.setTimeout(function () {
        form.reset();
        fields.forEach(function (el) {
          el.dataset.touched = "false";
          showError(el, "");
        });
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send enquiry";
        }
        if (successBox) {
          successBox.textContent =
            "Thanks — your enquiry has been received. This is a demo site, so no message was actually sent; a real Haven Property Group agent would be in touch within one business day.";
          successBox.classList.add("is-visible");
          successBox.focus();
        }
      }, 550);
    });
  }

  /* ---------------------------------------------------------------------
   * Footer year
   * ------------------------------------------------------------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
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
