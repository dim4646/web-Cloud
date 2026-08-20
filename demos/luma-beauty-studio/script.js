/* ==========================================================================
   Luma Beauty Studio — vanilla JS
   Mobile nav toggle, scroll-reveal, treatment card interactions,
   FAQ accordion, form validation with accessible success/error state.
   No build step, no dependencies, no network calls.
   ========================================================================== */
(function () {
  "use strict";

  /* -----------------------------------------------------------------------
     Mobile navigation toggle
     ----------------------------------------------------------------------- */
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var menu = document.getElementById("primary-nav-menu");
    if (!toggle || !menu) return;

    toggle.addEventListener("click", function () {
      var isOpen = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.matchMedia("(max-width: 899px)").matches) {
          menu.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && menu.classList.contains("is-open")) {
        menu.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* -----------------------------------------------------------------------
     Soft scroll-reveal for elements marked .reveal
     ----------------------------------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );

    items.forEach(function (el) { observer.observe(el); });
  }

  /* -----------------------------------------------------------------------
     Treatment card "read more" interaction
     ----------------------------------------------------------------------- */
  function initTreatmentCards() {
    var toggles = document.querySelectorAll(".treatment-toggle");
    toggles.forEach(function (btn) {
      var card = btn.closest(".treatment-card");
      var details = card ? card.querySelector(".treatment-details") : null;
      if (!card || !details) return;

      btn.addEventListener("click", function () {
        var expanded = card.classList.toggle("is-expanded");
        btn.setAttribute("aria-expanded", String(expanded));
        btn.textContent = expanded ? "Show less" : "What's included";
        if (expanded) {
          details.removeAttribute("hidden");
        } else {
          window.setTimeout(function () {
            if (!card.classList.contains("is-expanded")) {
              details.setAttribute("hidden", "");
            }
          }, 500);
        }
      });
    });
  }

  /* -----------------------------------------------------------------------
     FAQ accordion
     ----------------------------------------------------------------------- */
  function initFaq() {
    var items = document.querySelectorAll(".faq-item");
    items.forEach(function (item) {
      var question = item.querySelector(".faq-question");
      var answer = item.querySelector(".faq-answer");
      if (!question || !answer) return;

      question.addEventListener("click", function () {
        var isOpen = item.classList.contains("is-open");

        items.forEach(function (other) {
          if (other !== item) {
            other.classList.remove("is-open");
            var otherQ = other.querySelector(".faq-question");
            if (otherQ) otherQ.setAttribute("aria-expanded", "false");
          }
        });

        item.classList.toggle("is-open", !isOpen);
        question.setAttribute("aria-expanded", String(!isOpen));
      });
    });
  }

  /* -----------------------------------------------------------------------
     Form validation helpers
     ----------------------------------------------------------------------- */
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setFieldError(field, message) {
    var wrapper = field.closest(".form-field");
    if (!wrapper) return;
    var errorEl = wrapper.querySelector(".field-error");
    if (message) {
      wrapper.classList.add("has-error");
      field.setAttribute("aria-invalid", "true");
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = false;
      }
    } else {
      wrapper.classList.remove("has-error");
      field.removeAttribute("aria-invalid");
      if (errorEl) {
        errorEl.textContent = "";
        errorEl.hidden = true;
      }
    }
  }

  function validateField(field) {
    var value = (field.value || "").trim();
    var isRequired = field.hasAttribute("required");

    if (isRequired && !value) {
      setFieldError(field, field.dataset.errorRequired || "This field is required.");
      return false;
    }

    if (field.type === "email" && value && !EMAIL_PATTERN.test(value)) {
      setFieldError(field, "Please enter a valid email address.");
      return false;
    }

    if (field.type === "tel" && value && value.replace(/[^0-9]/g, "").length < 8) {
      setFieldError(field, "Please enter a valid phone number.");
      return false;
    }

    if (field.tagName === "SELECT" && isRequired && !value) {
      setFieldError(field, "Please choose an option.");
      return false;
    }

    setFieldError(field, "");
    return true;
  }

  function initForm(formId, statusId, successMessage) {
    var form = document.getElementById(formId);
    var status = document.getElementById(statusId);
    if (!form || !status) return;

    var fields = form.querySelectorAll("input, select, textarea");

    fields.forEach(function (field) {
      field.addEventListener("blur", function () { validateField(field); });
      field.addEventListener("input", function () {
        if (field.closest(".form-field").classList.contains("has-error")) {
          validateField(field);
        }
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var isValid = true;
      fields.forEach(function (field) {
        if (!validateField(field)) isValid = false;
      });

      status.classList.remove("is-success", "is-error");

      if (!isValid) {
        status.textContent = "Please fix the highlighted fields and try again.";
        status.classList.add("is-error");
        var firstError = form.querySelector(".has-error input, .has-error select, .has-error textarea");
        if (firstError) firstError.focus();
        return;
      }

      /* No backend exists for this demo — simulate a successful submission. */
      status.textContent = successMessage;
      status.classList.add("is-success");
      form.reset();
      fields.forEach(function (field) { setFieldError(field, ""); });
    });
  }

  /* -----------------------------------------------------------------------
     Footer year
     ----------------------------------------------------------------------- */
  function initYear() {
    var el = document.getElementById("current-year");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initReveal();
    initTreatmentCards();
    initFaq();
    initForm("booking-form", "booking-form-status", "Thank you — your booking request has been received. Our studio team will confirm your appointment by phone or email within one business day.");
    initForm("contact-form", "contact-form-status", "Thank you for reaching out. We will reply within one business day.");
    initYear();
  });
})();
