/**
 * Formulario de contacto: validación de cliente, marca de tiempo
 * anti-bot y envío vía fetch a /api/contact (Cloudflare Pages Function).
 * El <form> lleva action/method nativos, así que sin JS sigue
 * funcionando como un POST normal con recarga de página.
 */
import { validateContactFields } from "./lib/contact-form-validate.js";

function setFieldErrors(form, fields) {
  form.querySelectorAll("[data-error-for]").forEach((el) => {
    const isActive = fields.indexOf(el.getAttribute("data-error-for")) !== -1;
    el.textContent = isActive ? el.getAttribute("data-message") || "" : "";
  });
}

function setStatus(statusEl, key) {
  statusEl.textContent = statusEl.getAttribute("data-" + key + "-message") || "";
  statusEl.classList.remove("contact-form__status--success", "contact-form__status--error");
  if (key === "success") statusEl.classList.add("contact-form__status--success");
  if (key !== "success" && key !== "idle") statusEl.classList.add("contact-form__status--error");
}

function initContactForm(form) {
  const statusEl = form.querySelector("[data-contact-status]");
  const submitBtn = form.querySelector("button[type=submit]");
  const tsField = form.querySelector("input[name=ts]");

  if (tsField) tsField.value = String(Date.now());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFieldErrors(form, []);

    const fields = {
      name: form.elements.name.value,
      email: form.elements.email.value,
      reason: form.elements.reason.value,
      message: form.elements.message.value,
      consent: form.elements.consent.checked,
    };

    const clientErrors = validateContactFields(fields);
    if (clientErrors.length > 0) {
      setFieldErrors(form, clientErrors);
      setStatus(statusEl, "validation");
      return;
    }

    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = submitBtn.getAttribute("data-sending-label") || originalLabel;

    try {
      const response = await fetch(form.getAttribute("action"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.name,
          email: fields.email,
          reason: fields.reason,
          message: fields.message,
          consent: fields.consent,
          company: form.elements.company.value,
          ts: Number(tsField ? tsField.value : Date.now()),
        }),
      });

      const result = await response.json().catch(() => ({ ok: false }));

      if (result.ok) {
        form.reset();
        if (tsField) tsField.value = String(Date.now());
        setStatus(statusEl, "success");
      } else if (result.error === "rate_limited") {
        setStatus(statusEl, "rate-limited");
      } else if (result.error === "validation" && Array.isArray(result.fields)) {
        setFieldErrors(form, result.fields);
        setStatus(statusEl, "validation");
      } else {
        setStatus(statusEl, "error");
      }
    } catch {
      setStatus(statusEl, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

document.querySelectorAll("[data-contact-form]").forEach(initContactForm);
