(function () {
  const nav = document.querySelector(".hero-nav");
  const toggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  const form = document.getElementById("caseForm");
  const successCard = document.getElementById("caseSuccess");
  const statusNode = document.getElementById("formStatus");
  const submitButton = document.getElementById("caseSubmitButton");
  const submitLabel = submitButton?.querySelector(".button-label");
  const cfg = window.APP_CONFIG;

  if (nav && toggle && navLinks) {
    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("menu-open");
      navLinks.classList.toggle("open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("menu-open");
        navLinks.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  if (!form || !cfg) return;

  const endpoint = `${cfg.supabaseUrl}/functions/v1/submit-case`;

  function setStatus(message, isError) {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.style.color = isError ? "rgb(239, 68, 68)" : "rgb(160, 160, 160)";
  }

  function setSubmitting(isSubmitting) {
    if (!submitButton) return;
    submitButton.disabled = isSubmitting;
    submitButton.dataset.loading = String(isSubmitting);
    submitButton.setAttribute("aria-busy", String(isSubmitting));
    if (submitLabel) {
      submitLabel.textContent = isSubmitting ? "Submitting..." : "Submit Case for Free Review";
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus("Submitting your case...", false);

    const body = {
      firstName: form.firstName.value.trim(),
      lastName: form.lastName.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      age: form.age.value.trim(),
      city: form.city.value.trim(),
      country: form.country.value.trim(),
      caseDescription: form.description.value.trim(),
      lossRange: form.lossRange.value,
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: cfg.supabaseAnonKey,
          Authorization: `Bearer ${cfg.supabaseAnonKey}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to submit case");

      form.reset();
      setStatus("", false);
      if (successCard) successCard.classList.remove("hidden");
      form.classList.add("hidden");
    } catch (error) {
      setStatus(error.message || "Submission failed. Please try again.", true);
    } finally {
      setSubmitting(false);
    }
  });
})();
