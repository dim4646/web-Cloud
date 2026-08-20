/*!
 * Forge Fitness — demo site behaviour
 * Vanilla JS. No dependencies, no build step, no network calls.
 */
(function () {
  "use strict";

  var reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  function prefersReducedMotion() {
    return reduceMotionQuery.matches;
  }

  /* ---------------------------------------------------------------------
   * Mobile navigation toggle
   * ------------------------------------------------------------------- */
  function initNavToggle() {
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

    // Close the mobile menu whenever a nav link is activated.
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.matchMedia("(max-width: 899px)").matches) {
          closeNav();
        }
      });
    });

    // Escape closes the menu and returns focus to the toggle.
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        closeNav();
        toggle.focus();
      }
    });

    // Collapse mobile-only menu state if the viewport grows past the breakpoint.
    window.addEventListener("resize", function () {
      if (window.matchMedia("(min-width: 900px)").matches) {
        closeNav();
      }
    });
  }

  /* ---------------------------------------------------------------------
   * Scroll-spy: highlight the current section in the nav
   * ------------------------------------------------------------------- */
  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".nav-list a[href^='#']"));
    if (!links.length || !("IntersectionObserver" in window)) return;

    var map = {};
    links.forEach(function (link) {
      var id = link.getAttribute("href").slice(1);
      var section = document.getElementById(id);
      if (section) map[id] = link;
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var link = map[entry.target.id];
          if (!link) return;
          if (entry.isIntersecting) {
            links.forEach(function (l) { l.classList.remove("is-active"); });
            link.classList.add("is-active");
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );

    Object.keys(map).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  /* ---------------------------------------------------------------------
   * Sticky "Join" button — visible once the hero has scrolled out of view
   * ------------------------------------------------------------------- */
  function initStickyJoin() {
    var sticky = document.querySelector(".sticky-join");
    var hero = document.getElementById("home");
    if (!sticky || !hero) return;

    if (!("IntersectionObserver" in window)) {
      sticky.classList.add("is-visible");
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          sticky.classList.toggle("is-visible", !entry.isIntersecting);
        });
      },
      { threshold: 0, rootMargin: "-70% 0px 0px 0px" }
    );
    observer.observe(hero);
  }

  /* ---------------------------------------------------------------------
   * Scroll-triggered entrance motion
   * ------------------------------------------------------------------- */
  function initRevealMotion() {
    var targets = document.querySelectorAll(".reveal, .reveal-stagger");
    if (!targets.length) return;

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("in-view"); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* ---------------------------------------------------------------------
   * Weekly timetable — accessible day tabs
   * ------------------------------------------------------------------- */
  function initTimetable() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".day-tab"));
    if (!tabs.length) return;

    var panels = {};
    tabs.forEach(function (tab) {
      var day = tab.getAttribute("data-day");
      var panel = document.getElementById("panel-" + day);
      if (panel) panels[day] = panel;
    });

    function activate(day, moveFocus) {
      tabs.forEach(function (tab) {
        var isMatch = tab.getAttribute("data-day") === day;
        tab.setAttribute("aria-selected", isMatch ? "true" : "false");
        tab.tabIndex = isMatch ? 0 : -1;
        if (isMatch && moveFocus) tab.focus();
      });
      Object.keys(panels).forEach(function (key) {
        panels[key].classList.toggle("is-active", key === day);
        panels[key].toggleAttribute("hidden", key !== day);
      });
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () {
        activate(tab.getAttribute("data-day"), false);
      });
      tab.addEventListener("keydown", function (event) {
        var newIndex = null;
        if (event.key === "ArrowRight") newIndex = (index + 1) % tabs.length;
        if (event.key === "ArrowLeft") newIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "Home") newIndex = 0;
        if (event.key === "End") newIndex = tabs.length - 1;
        if (newIndex !== null) {
          event.preventDefault();
          activate(tabs[newIndex].getAttribute("data-day"), true);
        }
      });
    });

    // Default to today's weekday if it exists among the tabs, else the first tab.
    var todayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
    var initial = panels[todayKey] ? todayKey : tabs[0].getAttribute("data-day");
    activate(initial, false);
  }

  /* ---------------------------------------------------------------------
   * Enquiry form — client-side validation, no network call
   * ------------------------------------------------------------------- */
  function initEnquiryForm() {
    var form = document.getElementById("enquiry-form");
    if (!form) return;

    var status = document.getElementById("form-status");

    var validators = {
      name: function (v) { return v.trim().length > 1; },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); },
      phone: function (v) { return v.trim() === "" || /^[+0-9()\-.\s]{7,}$/.test(v.trim()); },
      program: function (v) { return v.trim() !== ""; },
      message: function (v) { return v.trim().length > 4; },
      consent: function (v, el) { return el.checked; }
    };

    var messages = {
      name: "Enter your full name.",
      email: "Enter a valid email address.",
      phone: "Enter a valid phone number, or leave this blank.",
      program: "Choose a program you're interested in.",
      message: "Tell us a little about your goals.",
      consent: "Please confirm you're happy to be contacted."
    };

    function fieldWrap(el) {
      return el.closest(".field");
    }

    function showError(el) {
      var wrap = fieldWrap(el);
      if (!wrap) return;
      wrap.classList.add("has-error");
      var errorEl = wrap.querySelector(".field-error");
      if (errorEl) errorEl.textContent = messages[el.name] || "This field needs attention.";
      el.setAttribute("aria-invalid", "true");
    }

    function clearError(el) {
      var wrap = fieldWrap(el);
      if (!wrap) return;
      wrap.classList.remove("has-error");
      el.removeAttribute("aria-invalid");
    }

    function validateField(el) {
      var name = el.name;
      var validator = validators[name];
      if (!validator) return true;
      var value = el.type === "checkbox" ? el.checked : el.value;
      var valid = el.type === "checkbox" ? validator(value, el) : validator(value);
      if (valid) {
        clearError(el);
      } else {
        showError(el);
      }
      return valid;
    }

    // Live-validate as the user leaves a field.
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!validators[el.name]) return;
      el.addEventListener("blur", function () { validateField(el); });
      el.addEventListener("input", function () {
        if (fieldWrap(el) && fieldWrap(el).classList.contains("has-error")) {
          validateField(el);
        }
      });
    });

    function setStatus(kind, text) {
      status.className = "form-status is-visible " + kind;
      status.textContent = text;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var allValid = true;
      var firstInvalid = null;
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!validators[el.name]) return;
        var ok = validateField(el);
        if (!ok && !firstInvalid) firstInvalid = el;
        if (!ok) allValid = false;
      });

      if (!allValid) {
        setStatus("error", "Please fix the highlighted fields before sending your enquiry.");
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // Demo only — never a real network request. Simulate a brief send state.
      var submitBtn = form.querySelector("button[type='submit']");
      var originalLabel = submitBtn ? submitBtn.textContent : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }

      window.setTimeout(function () {
        form.reset();
        Array.prototype.forEach.call(form.elements, function (el) {
          if (validators[el.name]) clearError(el);
        });
        setStatus("success", "Thanks — your enquiry has been received. A coach will be in touch within one business day. (This is a demo form: no data was sent or stored.)");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        }
      }, prefersReducedMotion() ? 0 : 450);
    });
  }

  /* ---------------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    initNavToggle();
    initScrollSpy();
    initStickyJoin();
    initRevealMotion();
    initTimetable();
    initEnquiryForm();

    // Footer year stamp, if present.
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  });
})();
