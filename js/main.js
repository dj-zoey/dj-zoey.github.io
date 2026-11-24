/* ===== CONFIG — change here ===== */
const CONFIG = {
  // Booking requests go to this address (assembled in JS to reduce spam bots).
  // Booking email, stored encoded so simple spam bots can't read it from the source.
  emailEnc: "bW9jLmxpYW1nQHp6dW9oenliYWI=",
  // Optional: a form service endpoint (e.g. Formspree / Web3Forms). Leave empty to use the email app.
  formEndpoint: "",
  // Optional: Zoey's WeChat ID, shown after a request so people can add her. Leave empty to hide.
  wechatId: "zoeyisgirl"
};

(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------- Language ---------- */
  let lang = "en";
  const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;
  function applyLang(l) {
    lang = I18N[l] ? l : "en";
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $$(".lang__btn").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    document.title = lang === "zh" ? "DJ ZOEY — House · Deep · Groove | 深圳" : "DJ ZOEY — House · Deep · Groove | Shenzhen";
    store.set("lang", lang);
    if (window.__applyPlayerLang) window.__applyPlayerLang();
  }
  const urlLang = new URLSearchParams(location.search).get("lang");
  const saved = store.get("lang");
  const browserZh = (navigator.language || "").toLowerCase().startsWith("zh");
  applyLang(urlLang || saved || (browserZh ? "zh" : "en"));
  $$(".lang__btn").forEach((b) => b.addEventListener("click", () => applyLang(b.dataset.lang)));

  /* ---------- Nav ---------- */
  const nav = $(".nav");
  const onScroll = () => nav.classList.toggle("is-solid", window.scrollY > 40);
  onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
  const burger = $(".nav__burger");
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  });
  $$(".nav__links a").forEach((a) => a.addEventListener("click", () => { nav.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); }));

  /* ---------- Email links ---------- */
  // Email is decoded only when a visitor taps it (bots reading the page don't see it).
  const getEmail = () => { try { return atob(CONFIG.emailEnc).split("").reverse().join(""); } catch (e) { return ""; } };
  $$(".js-mail").forEach((a) => {
    a.addEventListener("click", () => {
      const em = getEmail();
      a.href = "mailto:" + em;
      const label = a.classList.contains("mail-link-card") ? $(".mail-text", a) : a;
      label.removeAttribute("data-i18n");
      label.textContent = em;
    });
  });
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Background music playlist ---------- */
  const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const cards = $$(".track");
  const list = cards.map((c) => ({ src: c.dataset.src, title: $("h3", c).textContent, cover: ($(".track__cover", c) || {}).src || "" }));
  const player = new Audio();
  player.preload = "auto";
  player.volume = 0.8;
  const mini = $("#mini");
  const videos = $$("video[controls]");
  let idx = 0, waitingForGesture = false, resumeAfterVideo = false;

  function load(i) {
    idx = (i + list.length) % list.length;
    player.src = list[idx].src;
    $(".mini__title", mini).textContent = list[idx].title;
    $(".mini__cover", mini).src = list[idx].cover;
    $(".mini__bar span", mini).style.width = "0%";
    cards.forEach((c, k) => {
      c.classList.toggle("is-current", k === idx);
      if (k !== idx) { $(".track__bar span", c).style.width = "0%"; $(".track__time", c).textContent = "1:30"; }
    });
    if ("mediaSession" in navigator && window.MediaMetadata) {
      try { navigator.mediaSession.metadata = new MediaMetadata({ title: list[idx].title, artist: "DJ ZOEY", artwork: list[idx].cover ? [{ src: list[idx].cover, sizes: "720x405", type: "image/jpeg" }] : [] }); } catch (e) {}
    }
  }
  function play() {
    const p = player.play();
    if (p && p.catch) p.catch(() => { armGesture(); });
  }
  function userPlay() { store.set("music", "on"); disarmGesture(); videos.forEach((v) => { if (!v.paused) v.pause(); }); resumeAfterVideo = false; play(); }
  function userPause() { store.set("music", "off"); disarmGesture(); resumeAfterVideo = false; player.pause(); }
  function next() { load(idx + 1); play(); }
  function prev() { if (player.currentTime > 4) { player.currentTime = 0; return; } load(idx - 1); play(); }

  function syncUI() {
    const on = !player.paused;
    mini.classList.toggle("is-playing", on);
    mini.classList.toggle("is-waiting", waitingForGesture && !on);
    $(".mini__state", mini).textContent = on ? t("player.now") : (waitingForGesture ? t("player.tap") : t("player.paused"));
    $(".mini__toggle", mini).setAttribute("aria-label", on ? "Pause" : "Play");
    cards.forEach((c, k) => {
      const isOn = on && k === idx;
      c.classList.toggle("is-playing", isOn);
      $(".track__play", c).setAttribute("aria-label", isOn ? "Pause" : "Play");
    });
  }
  player.addEventListener("play", () => { waitingForGesture = false; syncUI(); });
  player.addEventListener("playing", syncUI);
  player.addEventListener("pause", syncUI);
  player.addEventListener("ended", next);
  player.addEventListener("timeupdate", () => {
    const c = cards[idx]; if (!c) return;
    const pct = player.duration ? (player.currentTime / player.duration) * 100 : 0;
    $(".track__bar span", c).style.width = pct + "%";
    $(".track__bar", c).setAttribute("aria-valuenow", Math.round(pct));
    $(".track__time", c).textContent = fmt(player.duration ? player.duration - player.currentTime : 90);
    $(".mini__bar span", mini).style.width = pct + "%";
  });

  // Track cards: click = play that track (or pause if it is the one playing)
  cards.forEach((c, k) => {
    $(".track__play", c).addEventListener("click", () => {
      if (k === idx && !player.paused) { userPause(); return; }
      if (k !== idx) load(k);
      userPlay();
    });
    const bar = $(".track__bar", c);
    bar.addEventListener("click", (e) => {
      const r = bar.getBoundingClientRect(); const pct = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const same = k === idx;
      if (!same) load(k);
      const go = () => { player.currentTime = pct * player.duration; };
      if (same && player.duration) go(); else player.addEventListener("loadedmetadata", go, { once: true });
      userPlay();
    });
    bar.addEventListener("keydown", (e) => {
      if (k !== idx || !player.duration) return;
      if (e.key === "ArrowRight") player.currentTime = Math.min(player.duration, player.currentTime + 5);
      if (e.key === "ArrowLeft") player.currentTime = Math.max(0, player.currentTime - 5);
    });
  });

  // Mini player
  $(".mini__toggle", mini).addEventListener("click", () => { if (player.paused) userPlay(); else userPause(); });
  $(".mini__next", mini).addEventListener("click", () => { store.set("music", "on"); disarmGesture(); next(); });
  $(".mini__prev", mini).addEventListener("click", () => { store.set("music", "on"); disarmGesture(); prev(); });
  $(".mini__info", mini).addEventListener("click", () => { $("#music").scrollIntoView({ behavior: "smooth" }); });
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", userPlay);
      navigator.mediaSession.setActionHandler("pause", userPause);
      navigator.mediaSession.setActionHandler("nexttrack", next);
      navigator.mediaSession.setActionHandler("previoustrack", prev);
    } catch (e) {}
  }

  // Browsers only allow sound after the visitor's first tap/click/key → start then.
  const SKIP = "video, .track, .mini, input, select, textarea, label, .lang";
  function onGesture(e) {
    if (e.target && e.target.closest && e.target.closest(SKIP)) return;
    disarmGesture(); play();
  }
  function armGesture() {
    if (waitingForGesture) return;
    waitingForGesture = true; syncUI();
    ["pointerdown", "keydown", "touchend"].forEach((ev) => document.addEventListener(ev, onGesture, true));
  }
  function disarmGesture() {
    waitingForGesture = false;
    ["pointerdown", "keydown", "touchend"].forEach((ev) => document.removeEventListener(ev, onGesture, true));
    syncUI();
  }

  // Videos: pause the music while a video plays, resume afterwards
  videos.forEach((v) => {
    v.addEventListener("play", () => {
      videos.forEach((o) => { if (o !== v && !o.paused) o.pause(); });
      if (!player.paused) { resumeAfterVideo = true; player.pause(); }
      disarmGesture();
    });
    const back = () => { if (resumeAfterVideo && videos.every((o) => o.paused)) { resumeAfterVideo = false; play(); } };
    v.addEventListener("pause", back);
    v.addEventListener("ended", back);
  });

  load(0);
  window.__applyPlayerLang = syncUI;
  if (store.get("music") === "off") { syncUI(); }
  else {
    play();
    // WeChat's in-app browser allows sound once its bridge is ready
    document.addEventListener("WeixinJSBridgeReady", () => { if (player.paused && store.get("music") !== "off") play(); }, false);
  }

  /* ---------- Hero video: respect reduced motion / data saver ---------- */
  const hv = $(".hero__video");
  const saveData = navigator.connection && navigator.connection.saveData;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || saveData) { hv.removeAttribute("autoplay"); hv.pause(); }
  else { const p = hv.play(); if (p && p.catch) p.catch(() => {}); }

  /* ---------- Lightbox ---------- */
  const items = $$(".gallery a");
  const lb = $("#lightbox"), lbImg = $("img", lb);
  let lbIdx = 0;
  const show = (i) => { lbIdx = (i + items.length) % items.length; lbImg.src = items[lbIdx].href; lbImg.alt = $("img", items[lbIdx]).alt; };
  items.forEach((a, i) => a.addEventListener("click", (e) => { e.preventDefault(); show(i); lb.hidden = false; document.body.style.overflow = "hidden"; $(".lightbox__close").focus(); }));
  const close = () => { lb.hidden = true; document.body.style.overflow = ""; items[lbIdx].focus(); };
  $(".lightbox__close").addEventListener("click", close);
  $(".lightbox__prev").addEventListener("click", () => show(lbIdx - 1));
  $(".lightbox__next").addEventListener("click", () => show(lbIdx + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close(); if (e.key === "ArrowRight") show(lbIdx + 1); if (e.key === "ArrowLeft") show(lbIdx - 1);
  });
  let tx = 0;
  lb.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => { const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 50) show(lbIdx + (d < 0 ? 1 : -1)); });

  /* ---------- Reveal on scroll ---------- */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } }), { threshold: 0.12 });
    $$(".section__head, .track, .video, .g, .about__img, .about__text, fieldset, .social__grid a").forEach((el) => { el.classList.add("reveal"); io.observe(el); });
  }

  /* ---------- Booking form ---------- */
  const form = $("#bookingForm"), err = $("#formError"), sent = $("#sent");
  const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  $("#f-date").min = today.toISOString().slice(0, 10);

  function syncDateMode() {
    const mode = form.dateMode.value;
    $$("[data-show]", form).forEach((el) => { el.hidden = el.dataset.show !== mode; });
  }
  $$("input[name=dateMode]", form).forEach((r) => r.addEventListener("change", syncDateMode));
  syncDateMode();

  const optText = (sel) => (sel.value ? sel.options[sel.selectedIndex].textContent.trim() : "");

  function buildMessage() {
    const f = form, L = [];
    const add = (k, v) => { if (v) L.push(t(k) + ": " + v); };
    add("m.type", optText(f.type));
    if (f.dateMode.value === "date") { add("m.date", f.date.value); add("m.time", f.time.value); }
    else { L.push(t("m.flex")); add("m.period", f.period.value.trim()); }
    add("m.length", optText(f.length));
    add("m.guests", optText(f.guests));
    add("m.city", f.city.value.trim());
    add("m.venue", f.venue.value.trim());
    const styles = $$("input[name=style]:checked", f).map((c) => c.nextElementSibling.textContent);
    if (f.styleOther.value.trim()) styles.push(f.styleOther.value.trim());
    add("m.style", styles.join(", "));
    add("m.gear", optText(f.gear));
    if (f.budget.value.trim()) add("m.budget", f.currency.value + " " + f.budget.value.trim());
    if (f.rates.checked) L.push(t("m.rates"));
    add("m.travel", optText(f.travel));
    L.push("");
    add("m.name", f.name.value.trim());
    add("m.org", f.org.value.trim());
    add("m.email", f.email.value.trim());
    add("m.wechat", f.wechat.value.trim());
    if (f.message.value.trim()) { L.push(""); L.push(t("m.msg") + ":"); L.push(f.message.value.trim()); }
    return t("mail.hello") + "\n\n" + L.join("\n") + "\n\n" + t("mail.bye") + "\n" + (f.name.value.trim() || "");
  }

  function subject() {
    const f = form;
    const when = f.dateMode.value === "date" && f.date.value ? f.date.value : (lang === "zh" ? "日期待定" : "date TBD");
    return t("mail.subject") + " · " + [optText(f.type), f.city.value.trim(), when].filter(Boolean).join(" · ");
  }

  function validate() {
    const f = form, missing = [];
    $$(".is-invalid", f).forEach((el) => el.classList.remove("is-invalid"));
    const need = [[f.type, "book.type"], [f.city, "book.city"], [f.name, "book.name"]];
    if (f.dateMode.value === "date") need.splice(1, 0, [f.date, "book.date"]);
    need.forEach(([el, k]) => { if (!el.value.trim()) { el.classList.add("is-invalid"); missing.push(t(k)); } });
    if (missing.length) return { msg: t("err.required") + missing.join(", "), el: $(".is-invalid", f) };
    if (!f.email.value.trim() && !f.wechat.value.trim()) { f.email.classList.add("is-invalid"); f.wechat.classList.add("is-invalid"); return { msg: t("err.contact"), el: f.email }; }
    if (f.email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) { f.email.classList.add("is-invalid"); return { msg: t("err.email"), el: f.email }; }
    return null;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) { err.textContent = v.msg; err.hidden = false; v.el && v.el.focus(); return; }
    err.hidden = true;
    const body = buildMessage(), subj = subject();
    const mailto = "mailto:" + getEmail() + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);

    if (CONFIG.formEndpoint) {
      try {
        const r = await fetch(CONFIG.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ subject: subj, message: body, email: form.email.value.trim(), name: form.name.value.trim() }) });
        if (r.ok) { showSent(body, mailto, true); return; }
      } catch (x) { /* fall back to email app */ }
    }
    showSent(body, mailto, false);
    window.location.href = mailto;
  });

  function showSent(body, mailto, viaService) {
    $("#sentText").textContent = t("mail.subject") + "\n\n" + body;
    $("#mailAgain").href = mailto;
    if (viaService) { $("#sent h3").textContent = lang === "zh" ? "已发送，谢谢！" : "Sent — thank you!"; }
    form.hidden = true; sent.hidden = false;
    sent.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("#editBtn").addEventListener("click", () => { $("#sentToast").hidden = true; sent.hidden = true; form.hidden = false; form.scrollIntoView({ behavior: "smooth" }); });
  // Copy helpers: synchronous copy keeps the tap "trusted", so the app link can open right after.
  function copySync(txt) {
    let ok = false;
    const ta = document.createElement("textarea");
    ta.value = txt; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
    document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, txt.length);
    try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove();
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).catch(() => {}); ok = true; }
    return ok;
  }
  const toast = $("#sentToast");
  function showToast(key) { toast.textContent = t(key); toast.hidden = false; }
  const inWeChat = /MicroMessenger/i.test(navigator.userAgent);
  if (CONFIG.wechatId) { $("#wechatId").textContent = CONFIG.wechatId; $("#wechatIdLine").hidden = false; }

  // WeChat card in the "Follow" section: tap copies the ID
  $$(".js-wechat-id").forEach((el) => { el.textContent = CONFIG.wechatId; });
  const wcCard = $("#wechatCard");
  if (wcCard) {
    if (!CONFIG.wechatId) wcCard.hidden = true;
    wcCard.addEventListener("click", () => {
      const hint = $(".wechat-hint", wcCard);
      hint.textContent = copySync(CONFIG.wechatId) ? t("social.wechatCopied") : t("social.wechatHint");
      setTimeout(() => { hint.textContent = t("social.wechatHint"); }, 2500);
    });
  }

  $("#copyBtn").addEventListener("click", () => {
    const b = $("#copyBtn");
    if (copySync($("#sentText").textContent)) { b.textContent = t("sent.copied"); showToast("toast.copy"); setTimeout(() => { b.textContent = t("sent.copy"); }, 2200); }
    else showToast("toast.fail");
  });
  $("#wechatBtn").addEventListener("click", (e) => {
    const ok = copySync($("#sentText").textContent);
    if (!ok) { e.preventDefault(); showToast("toast.fail"); return; }
    if (inWeChat) { e.preventDefault(); showToast("toast.wechatIn"); return; } // weixin:// is blocked inside WeChat itself
    showToast("toast.wechat");
  });
  $("#igBtn").addEventListener("click", (e) => {
    const ok = copySync($("#sentText").textContent);
    showToast(ok ? "toast.ig" : "toast.fail");
    if (!ok) e.preventDefault();
  });
})();
