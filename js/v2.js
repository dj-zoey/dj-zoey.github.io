/* DJ ZOEY — V2 effects: music-reactive page, waveforms, cat, intro, vinyl cursor, kinetic headings.
   No external libraries (works offline / in mainland China). */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(pointer: fine)").matches;
  const BPM = 122, BEAT = 60 / BPM;              // one beat ≈ 0.49 s
  root.style.setProperty("--beat", BEAT + "s");
  const zh = () => root.lang === "zh-CN";
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const player = window.__zoeyPlayer;
  if (!player) return;

  /* ================= 1. AUDIO ANALYSIS ================= */
  let actx = null, analyser = null, freq = null, wave = null, connected = false;
  function connectAudio() {
    if (connected) { if (actx && actx.state === "suspended") actx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      const src = actx.createMediaElementSource(player);
      analyser = actx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.55;
      src.connect(analyser);
      analyser.connect(actx.destination);
      freq = new Uint8Array(analyser.frequencyBinCount);
      wave = new Uint8Array(analyser.fftSize);
      connected = true;
      actx.resume();
    } catch (e) { connected = false; }
  }
  // Audio graphs may only start inside a real tap/click/key (browser rule).
  ["pointerdown", "keydown", "touchend"].forEach((ev) =>
    document.addEventListener(ev, connectAudio, { capture: true, passive: true }));

  /* ================= 2. REACTIVE TARGETS ================= */
  const hero = $(".hero");
  const pulseEls = [hero, $(".nav__logo"), $(".hero__title"), $("#mini")].filter(Boolean);
  const lasers = $(".lasers");
  const laserEls = lasers ? $$(".laser", lasers) : [];
  function fireLaser(strength) {
    if (reduce || !laserEls.length) return;
    const n = strength > 0.85 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const el = laserEls[(Math.random() * laserEls.length) | 0];
      const side = el.dataset.side === "r" ? -1 : 1;
      el.style.setProperty("--a", (side * (12 + Math.random() * 38)).toFixed(1) + "deg");
      el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
    }
  }

  /* ================= 3. WAVEFORMS ================= */
  let peaks = {};
  const cards = $$(".track");
  const canvases = [];
  cards.forEach((card) => {
    const bar = $(".track__bar", card);
    const cv = document.createElement("canvas");
    cv.className = "wave";
    bar.appendChild(cv);
    canvases.push({ card, cv, key: card.dataset.src.split("/").pop().replace(".mp3", ""), last: -1 });
  });
  const cssVar = (n) => getComputedStyle(root).getPropertyValue(n).trim();
  function drawWave(item, progress, hover) {
    const { cv } = item, data = peaks[item.key];
    if (!data) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const gap = 2, bw = Math.max(1.5, (w - gap * (data.length - 1)) / data.length);
    const step = bw + gap, mid = h / 2;
    const accent = cssVar("--accent") || "#ff4136";
    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      if (x > w) break;
      const amp = Math.max(2, data[i] * (h - 4));
      const played = x / w < progress;
      g.fillStyle = played ? accent : (hover != null && x / w < hover ? "#8a8590" : "#4a4a52");
      g.fillRect(x, mid - amp / 2, bw, amp);
    }
  }
  function redrawAll() { canvases.forEach((it) => { it.last = -1; drawWave(it, 0); }); }
  fetch("assets/audio/peaks.json").then((r) => r.json()).then((p) => { peaks = p; redrawAll(); }).catch(() => {});
  window.addEventListener("resize", redrawAll);
  canvases.forEach((it) => {
    it.cv.addEventListener("mousemove", (e) => {
      const r = it.cv.getBoundingClientRect();
      const cur = it.card.classList.contains("is-current") && player.duration ? player.currentTime / player.duration : 0;
      drawWave(it, cur, (e.clientX - r.left) / r.width);
    });
    it.cv.addEventListener("mouseleave", () => { it.last = -1; });
  });

  // Mini player: live waveform
  const mini = $("#mini");
  const miniCv = document.createElement("canvas");
  miniCv.className = "mini__wave";
  const eq = $(".mini__eq", mini);
  if (eq) eq.replaceWith(miniCv); else $(".mini__info", mini).appendChild(miniCv);
  function drawMini(level, t) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = miniCv.clientWidth, h = miniCv.clientHeight;
    if (!w) return;
    if (miniCv.width !== Math.round(w * dpr)) { miniCv.width = Math.round(w * dpr); miniCv.height = Math.round(h * dpr); }
    const g = miniCv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.strokeStyle = cssVar("--accent") || "#ff4136";
    g.lineWidth = 2;
    g.beginPath();
    const playing = !player.paused;
    for (let x = 0; x <= w; x += 2) {
      let y;
      if (connected && playing && wave) {
        const i = Math.floor((x / w) * (wave.length - 1));
        y = h / 2 + ((wave[i] - 128) / 128) * (h / 2 - 1) * 1.4;
      } else if (playing) {
        y = h / 2 + Math.sin(x / 4 + t / 120) * (2 + level * (h / 2 - 3));
      } else {
        y = h / 2;
      }
      y = Math.max(1, Math.min(h - 1, y));
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }

  /* ================= 4. MAIN LOOP ================= */
  let level = 0, avg = 0.2, kick = 0, lastKick = 0, lastBeatIdx = -1, lastT = 0;
  function frame(t) {
    const dt = Math.min(250, lastT ? t - lastT : 16.7) / 16.7; // frames at 60 fps
    lastT = t;
    let bass = 0;
    const playing = !player.paused && !player.ended;
    if (playing && connected && analyser) {
      analyser.getByteFrequencyData(freq);
      analyser.getByteTimeDomainData(wave);
      let s = 0; for (let i = 1; i <= 5; i++) s += freq[i];
      bass = s / (5 * 255);
      const k = 1 - Math.pow(0.96, dt); avg += (bass - avg) * k;
      if (bass > 0.42 && bass > avg * 1.1 && t - lastKick > BEAT * 1000 * 0.6) { lastKick = t; kick = 1; fireLaser(bass); }
    } else if (playing) {
      // fallback before the first tap: follow the 122 BPM grid of the track time
      const pos = player.currentTime / BEAT, bi = Math.floor(pos);
      bass = 0.35 + 0.45 * Math.exp(-(pos - bi) * 5);
      if (bi !== lastBeatIdx) { lastBeatIdx = bi; kick = 0.8; fireLaser(0.6); }
    }
    level += (bass - level) * (1 - Math.pow(0.7, dt));
    kick *= Math.pow(0.86, dt);
    const L = playing ? level : level * 0.9;
    pulseEls.forEach((el) => { el.style.setProperty("--level", L.toFixed(3)); el.style.setProperty("--kick", kick.toFixed(3)); });
    root.classList.toggle("is-live", playing);
    // waveform of the current track
    canvases.forEach((it) => {
      if (!it.card.classList.contains("is-current")) { if (it.last !== 0) { it.last = 0; drawWave(it, 0); } return; }
      const p = player.duration ? player.currentTime / player.duration : 0;
      if (Math.abs(p - it.last) > 0.002) { it.last = p; drawWave(it, p); }
    });
    drawMini(level, t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ================= 5. CAT ================= */
  // 5a. eyes in both logos — blink on tap
  function addEye(host) {
    if (!host) return null;
    const eye = document.createElement("span");
    eye.className = "cat-eye";
    eye.setAttribute("aria-hidden", "true");
    host.appendChild(eye);
    return eye;
  }
  const eyes = [addEye($(".nav__logo")), addEye($(".hero__title"))].filter(Boolean);
  function blink() { eyes.forEach((e) => { e.classList.remove("blink"); void e.offsetWidth; e.classList.add("blink"); }); }
  // a lazy blink every now and then
  if (!reduce) setInterval(() => { if (!document.hidden && Math.random() < 0.5) blink(); }, 9000);

  // 5b. cat that sneaks along the right edge while scrolling
  const scat = $(".scat");
  let lastY = window.scrollY, walkT = 0;
  function placeCat() {
    if (!scat) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    const travel = innerHeight - scat.offsetHeight - 140;
    scat.style.setProperty("--y", (70 + p * travel).toFixed(1) + "px");
    const dir = window.scrollY >= lastY ? 1 : -1;
    scat.classList.toggle("up", dir < 0);
    lastY = window.scrollY;
    scat.classList.add("walking");
    clearTimeout(walkT);
    walkT = setTimeout(() => scat.classList.remove("walking"), 260);
  }
  window.addEventListener("scroll", placeCat, { passive: true });
  window.addEventListener("resize", placeCat);
  placeCat();

  // 5c. Easter egg: tap the cat 5× → secret track
  let taps = 0, tapTimer = 0;
  const toast = $(".v2-toast");
  function showToast(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.remove("show"); void toast.offsetWidth; toast.classList.add("show");
  }
  function catRain() {
    if (reduce) return;
    for (let i = 0; i < 14; i++) {
      const c = document.createElement("img");
      c.src = "assets/img/cat-white.png"; c.alt = ""; c.className = "cat-drop";
      c.style.left = Math.random() * 96 + "vw";
      c.style.setProperty("--d", (Math.random() * 1.2).toFixed(2) + "s");
      c.style.setProperty("--s", (0.5 + Math.random() * 0.9).toFixed(2));
      c.style.setProperty("--r", ((Math.random() - 0.5) * 80).toFixed(0) + "deg");
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4200);
    }
  }
  function catTap(e) {
    blink();
    taps++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { taps = 0; }, 2500);
    if (taps === 3) showToast(zh() ? "喵？再点两下……" : "Meow? Two more…");
    if (taps >= 5) {
      taps = 0;
      if (e) e.preventDefault();
      connectAudio();
      window.__zoeyPlaySpecial && window.__zoeyPlaySpecial("assets/audio/secret.mp3", zh() ? "🐈‍⬛ 隐藏曲目" : "🐈‍⬛ Secret Track", "assets/img/club-bw-2-sm.jpg");
      showToast(zh() ? "你发现了隐藏曲目 🐈‍⬛" : "You found the secret track 🐈‍⬛");
      catRain();
    }
  }
  $$(".nav__logo, .hero__title, .scat").forEach((el) => el.addEventListener("click", (e) => {
    if (el.classList.contains("nav__logo") && taps < 4) { /* keep normal “back to top” */ }
    catTap(e);
  }));

  /* ================= 6. KINETIC HEADINGS ================= */
  function splitHeading(h) {
    const text = h.textContent;
    h.setAttribute("aria-label", text);
    h.innerHTML = "";
    [...text].forEach((ch, i) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.setAttribute("aria-hidden", "true");
      s.style.setProperty("--i", i);
      s.textContent = ch === " " ? " " : ch;
      h.appendChild(s);
    });
  }
  const heads = $$(".section h2, .about h2");
  heads.forEach(splitHeading);
  (window.__afterLang = window.__afterLang || []).push(() => heads.forEach(splitHeading));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("ink"); io.unobserve(en.target); }
    }), { threshold: 0.4 });
    heads.forEach((h) => io.observe(h));
  } else heads.forEach((h) => h.classList.add("ink"));

  /* ================= 7. BEAT-SYNCED REVEALS ================= */
  // stagger groups on the half-beat grid — only for the first fade-in.
  // Afterwards the delay is removed so hover effects react instantly.
  [".tracks .track", ".videos .video", ".social__grid > *"].forEach((sel) => {
    $$(sel).forEach((el, i) => {
      const d = (i % 6) * BEAT / 2;
      if (!d || !el.classList.contains("reveal") || el.classList.contains("is-in")) return;
      el.style.transitionDelay = d.toFixed(3) + "s";
      const mo = new MutationObserver(() => {
        if (!el.classList.contains("is-in")) return;
        mo.disconnect();
        setTimeout(() => { el.style.transitionDelay = ""; }, (d + BEAT * 2) * 1000 + 60);
      });
      mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    });
  });

  /* ================= 8. VINYL CURSOR (desktop) ================= */
  if (fine && !reduce) {
    const v = document.createElement("div");
    v.className = "vinyl";
    v.setAttribute("aria-hidden", "true");
    document.body.appendChild(v);
    root.classList.add("has-vinyl");
    let mx = -100, my = -100, x = -100, y = -100;
    window.addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; v.classList.add("on"); }, { passive: true });
    document.addEventListener("mouseleave", () => v.classList.remove("on"));
    const HOT = "a, button, [role=slider], label, .wave, summary, select";
    document.addEventListener("mouseover", (e) => v.classList.toggle("hot", !!(e.target.closest && e.target.closest(HOT))));
    document.addEventListener("mousedown", () => v.classList.add("press"));
    document.addEventListener("mouseup", () => v.classList.remove("press"));
    (function follow() {
      x += (mx - x) * 0.28; y += (my - y) * 0.28;
      v.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      requestAnimationFrame(follow);
    })();
  }

  /* ================= 9. INTRO (every visit; skipped with “reduce motion”, click skips) ================= */
  const intro = $("#intro");
  if (intro) {
    if (reduce) intro.remove();
    else {
      root.classList.add("intro-on");
      const bars = $(".intro__wave", intro);
      for (let i = 0; i < 48; i++) {
        const b = document.createElement("i");
        b.style.setProperty("--h", (20 + Math.abs(Math.sin(i * 0.7) * 60 + Math.sin(i * 2.3) * 20)).toFixed(0) + "%");
        b.style.setProperty("--i", i);
        bars.appendChild(b);
      }
      let closed = false;
      const done = () => {
        if (closed) return; closed = true;
        root.classList.remove("intro-on"); intro.classList.add("out"); setTimeout(() => intro.remove(), 350);
      };
      // Always opens the page by itself after 1.15 s (a click skips it). Music behaves as usual:
      // it starts if the browser allows it, otherwise on the first tap or via the play button.
      const tm = setTimeout(done, 1150);
      intro.addEventListener("click", () => { clearTimeout(tm); done(); });
    }
  }
})();
