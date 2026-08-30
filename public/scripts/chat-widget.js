/**
 * Chatbot flotante de /inicio. Envía la pregunta a /api/chat (Cloudflare
 * Pages Function), que hace RAG contra Cloudflare AI Search acotado al
 * perfil de Víctor Cazorla. hCaptcha (invisible) solo se resuelve la
 * primera vez: si el servidor responde 401 `captcha_required`, se ejecuta
 * el reto y se reintenta con el token.
 *
 * Sin JS el widget simplemente no aparece (el <button> nace oculto y solo
 * este script lo muestra), así que no degrada la página.
 */
import { renderAnswer, escapeHtml } from "./lib/chat-render.js";

const HCAPTCHA_API = "https://js.hcaptcha.com/1/api.js?render=explicit";
const STORAGE_KEY = "vcf-chat-transcript";
const MAX_LEN = 500;

function readTranscript() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTranscript(entries) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-40)));
  } catch {
    /* modo privado o cuota llena: la conversación simplemente no persiste */
  }
}

function initChatWidget(root) {
  const toggle = root.querySelector("[data-chat-toggle]");
  const panel = root.querySelector("[data-chat-panel]");
  const closeBtn = root.querySelector("[data-chat-close]");
  const log = root.querySelector("[data-chat-log]");
  const form = root.querySelector("[data-chat-form]");
  const input = root.querySelector("[data-chat-input]");
  const sendBtn = root.querySelector("[data-chat-send]");
  const captchaMount = root.querySelector("[data-chat-hcaptcha]");
  if (!toggle || !panel || !form || !input || !log || !captchaMount) return;

  const endpoint = root.dataset.endpoint || "/api/chat";
  const sitekey = root.dataset.sitekey || "";
  const copy = {
    thinking: root.dataset.msgThinking || "…",
    generic: root.dataset.msgGeneric || "Algo ha fallado. Inténtalo de nuevo en un momento.",
    rate: root.dataset.msgRate || "Has enviado muchas preguntas seguidas. Prueba de nuevo más tarde.",
    tooLong: root.dataset.msgTooLong || "La pregunta es demasiado larga.",
    captcha: root.dataset.msgCaptcha || "No se ha podido verificar que no eres un bot. Recarga la página.",
    empty: root.dataset.msgEmpty || "Escribe una pregunta.",
  };

  let hcaptchaWidgetId = null;
  let hcaptchaApiPromise = null;
  let pendingCaptcha = null;
  let busy = false;

  const transcript = readTranscript();

  /* ---------- pintado ---------- */

  function bubble(role, htmlContent, sources) {
    const el = document.createElement("div");
    el.className = `chat-msg chat-msg--${role}`;
    el.innerHTML = htmlContent;
    if (Array.isArray(sources) && sources.length) {
      const ul = document.createElement("ul");
      ul.className = "chat-msg__sources";
      for (const s of sources) {
        const li = document.createElement("li");
        if (s && s.url) {
          li.innerHTML = `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
            s.title || s.url
          )}</a>`;
        } else if (s && s.title) {
          li.textContent = s.title;
        }
        if (li.textContent || li.innerHTML) ul.appendChild(li);
      }
      if (ul.children.length) el.appendChild(ul);
    }
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function renderEntry(entry) {
    if (entry.role === "user") return bubble("user", `<p>${escapeHtml(entry.text)}</p>`);
    if (entry.role === "assistant") return bubble("assistant", renderAnswer(entry.text), entry.sources);
    return bubble("error", `<p>${escapeHtml(entry.text)}</p>`);
  }

  function pushEntry(entry) {
    transcript.push(entry);
    writeTranscript(transcript);
    renderEntry(entry);
  }

  /* ---------- hCaptcha (invisible, perezoso) ---------- */

  function loadHcaptchaApi() {
    if (window.hcaptcha) return Promise.resolve();
    if (hcaptchaApiPromise) return hcaptchaApiPromise;
    hcaptchaApiPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = HCAPTCHA_API;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error("hcaptcha_load_failed"));
      const started = Date.now();
      const check = () => {
        if (window.hcaptcha && typeof window.hcaptcha.render === "function") resolve();
        else if (Date.now() - started > 10000) reject(new Error("hcaptcha_timeout"));
        else setTimeout(check, 100);
      };
      script.onload = check;
      document.head.appendChild(script);
    });
    return hcaptchaApiPromise;
  }

  async function solveCaptcha() {
    if (!sitekey) throw new Error("no_sitekey");
    await loadHcaptchaApi();
    if (hcaptchaWidgetId === null) {
      hcaptchaWidgetId = window.hcaptcha.render(captchaMount, {
        sitekey,
        size: "invisible",
        callback: (token) => pendingCaptcha && pendingCaptcha.resolve(token),
        "error-callback": () => pendingCaptcha && pendingCaptcha.reject(new Error("hcaptcha_error")),
        "expired-callback": () => pendingCaptcha && pendingCaptcha.reject(new Error("hcaptcha_expired")),
      });
    }
    return new Promise((resolve, reject) => {
      pendingCaptcha = { resolve, reject };
      try {
        window.hcaptcha.execute(hcaptchaWidgetId);
      } catch (err) {
        reject(err);
      }
    }).finally(() => {
      pendingCaptcha = null;
      try {
        window.hcaptcha.reset(hcaptchaWidgetId);
      } catch {
        /* nada */
      }
    });
  }

  /* ---------- envío ---------- */

  async function ask(message, token) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(token ? { message, token } : { message }),
    });
    const data = await res.json().catch(() => ({ ok: false }));
    if (res.status === 401 && data && data.error === "captcha_required") {
      const err = new Error("captcha_required");
      err.code = "captcha_required";
      throw err;
    }
    return { status: res.status, data: data || { ok: false } };
  }

  function messageForError(error) {
    if (error === "rate_limited") return copy.rate;
    if (error === "too_long") return copy.tooLong;
    if (error === "empty") return copy.empty;
    if (error === "captcha") return copy.captcha;
    return copy.generic;
  }

  function setBusy(next) {
    busy = next;
    input.disabled = next;
    sendBtn.disabled = next;
    root.classList.toggle("chat--busy", next);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const message = input.value.trim().replace(/\s+/g, " ");
    if (message.length < 2) {
      input.focus();
      return;
    }
    if (message.length > MAX_LEN) {
      pushEntry({ role: "error", text: copy.tooLong });
      return;
    }

    pushEntry({ role: "user", text: message });
    input.value = "";
    autosize();
    setBusy(true);
    const thinking = bubble("assistant", `<p class="chat-msg__thinking">${escapeHtml(copy.thinking)}</p>`);

    try {
      let outcome;
      try {
        outcome = await ask(message, null);
      } catch (err) {
        if (err && err.code === "captcha_required") {
          const token = await solveCaptcha();
          outcome = await ask(message, token);
        } else {
          throw err;
        }
      }

      thinking.remove();
      const { data } = outcome;
      if (data && data.ok && data.answer) {
        pushEntry({ role: "assistant", text: data.answer, sources: data.sources || [] });
      } else {
        pushEntry({ role: "error", text: messageForError(data && data.error) });
      }
    } catch {
      thinking.remove();
      pushEntry({ role: "error", text: copy.generic });
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  /* ---------- apertura / cierre ---------- */

  let greeted = transcript.length > 0;

  function openPanel() {
    panel.hidden = false;
    root.classList.add("chat--open");
    toggle.setAttribute("aria-expanded", "true");
    if (!greeted) {
      bubble("assistant", `<p>${escapeHtml(root.dataset.greeting || "Hola, ¿en qué puedo ayudarte?")}</p>`);
      greeted = true;
    }
    input.focus();
  }

  function closePanel() {
    panel.hidden = true;
    root.classList.remove("chat--open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }

  /* ---------- init ---------- */

  transcript.forEach(renderEntry);

  toggle.hidden = false;
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => (panel.hidden ? openPanel() : closePanel()));
  if (closeBtn) closeBtn.addEventListener("click", closePanel);
  form.addEventListener("submit", handleSubmit);
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) closePanel();
  });
}

document.querySelectorAll("[data-chat-widget]").forEach(initChatWidget);
