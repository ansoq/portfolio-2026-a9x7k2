/* ============================================================
   ABDURRAHMAN YUSUF — PORTFOLIO MOTION ENGINE v2.0
   Single master rAF loop · IntersectionObserver reveals ·
   transform/opacity-only animation · lazy everything.
   ============================================================ */
(function () {
  "use strict";

  var doc = document, docEl = document.documentElement, body = document.body;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;
  var wideScreen = window.matchMedia("(min-width: 901px)").matches;
  var FX = finePointer && wideScreen && !reduced;   // heavy effects gate

  /* ---------- master rAF loop ---------- */
  var tasks = new Set();
  var rafId = null, lastT = 0;
  function loop(now) {
    var dt = Math.min(50, now - lastT); lastT = now;
    tasks.forEach(function (f) { f(now, dt); });
    rafId = tasks.size ? requestAnimationFrame(loop) : null;
  }
  function addTask(f) {
    tasks.add(f);
    if (rafId === null && !doc.hidden) { lastT = performance.now(); rafId = requestAnimationFrame(loop); }
  }
  function removeTask(f) { tasks.delete(f); }
  doc.addEventListener("visibilitychange", function () {
    if (doc.hidden) { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }
    else if (tasks.size && rafId === null) { lastT = performance.now(); rafId = requestAnimationFrame(loop); }
  });

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  /* ============================================================
     SCRAMBLE / DECODE TEXT
     ============================================================ */
  var SCRAM = "!<>-_\\/[]{}=+*^?#";
  function scramble(el, opts) {
    opts = opts || {};
    var finalText = opts.text || el.dataset.text || el.textContent;
    el.dataset.text = finalText;
    if (reduced) { el.textContent = finalText; return; }
    var charset = opts.charset || SCRAM;
    var dur = opts.dur || 700;
    var start = null;
    if (el._scramTask) removeTask(el._scramTask);
    var task = function (now) {
      if (start === null) start = now;
      var p = clamp((now - start) / dur, 0, 1);
      var locked = Math.floor(p * finalText.length);
      var out = "";
      for (var i = 0; i < finalText.length; i++) {
        var ch = finalText[i];
        if (i < locked || ch === " " || ch === "·") { out += ch; }
        else { out += charset[(Math.random() * charset.length) | 0]; }
      }
      el.textContent = out;
      if (p >= 1) { el.textContent = finalText; removeTask(task); el._scramTask = null; }
    };
    el._scramTask = task;
    addTask(task);
  }

  /* ============================================================
     CIRCUIT-BOARD CANVAS  (PCB traces + travelling pulses)
     ============================================================ */
  (function circuit() {
    var cv = doc.getElementById("circuit");
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    var W = 0, H = 0, staticCv = null, traces = [], pulses = [];
    var GRID = 26;
    var AMBER = [232, 160, 32], CYAN = [78, 201, 255];

    function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }

    function makeSprite(c) {
      var s = doc.createElement("canvas"); s.width = s.height = 32;
      var g = s.getContext("2d");
      var grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, rgba(c, 0.9));
      grad.addColorStop(0.25, rgba(c, 0.45));
      grad.addColorStop(1, rgba(c, 0));
      g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
      return s;
    }
    var spriteAmber = makeSprite(AMBER), spriteCyan = makeSprite(CYAN);

    var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    function buildTraces() {
      traces = [];
      var cols = Math.ceil(W / GRID), rows = Math.ceil(H / GRID);
      var used = {};
      var count = clamp(Math.floor((W * H) / 52000), 18, 46);
      for (var t = 0; t < count; t++) {
        var cx, cy;
        if (Math.random() < 0.55) { // start from an edge
          if (Math.random() < 0.5) { cx = Math.random() < 0.5 ? 0 : cols - 1; cy = (Math.random() * rows) | 0; }
          else { cy = Math.random() < 0.5 ? 0 : rows - 1; cx = (Math.random() * cols) | 0; }
        } else { cx = (Math.random() * cols) | 0; cy = (Math.random() * rows) | 0; }
        var dir = DIRS[(Math.random() * 8) | 0];
        var pts = [[cx, cy]];
        used[cx + "," + cy] = 1;
        var steps = 8 + ((Math.random() * 16) | 0);
        for (var s = 0; s < steps; s++) {
          if (Math.random() > 0.72) { // 45-degree PCB turn
            var idx = DIRS.indexOf(dir);
            var turn = Math.random() < 0.5 ? 1 : -1;
            // map cardinal/diagonal ring order for 45deg turns
            var RING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
            var ri = -1;
            for (var r = 0; r < 8; r++) { if (RING[r][0] === dir[0] && RING[r][1] === dir[1]) { ri = r; break; } }
            dir = RING[(ri + turn + 8) % 8];
          }
          var nx = pts[pts.length - 1][0] + dir[0], ny = pts[pts.length - 1][1] + dir[1];
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || used[nx + "," + ny]) break;
          used[nx + "," + ny] = 1;
          pts.push([nx, ny]);
        }
        if (pts.length < 4) continue;
        // to pixel coords + cumulative lengths
        var px = pts.map(function (p) { return [p[0] * GRID + GRID / 2, p[1] * GRID + GRID / 2]; });
        var lens = [0], total = 0;
        for (var i = 1; i < px.length; i++) {
          total += Math.hypot(px[i][0] - px[i - 1][0], px[i][1] - px[i - 1][1]);
          lens.push(total);
        }
        traces.push({ p: px, lens: lens, total: total, cyan: Math.random() < 0.3 });
      }
    }

    function drawStatic() {
      staticCv = doc.createElement("canvas");
      staticCv.width = W * dpr; staticCv.height = H * dpr;
      var g = staticCv.getContext("2d");
      g.scale(dpr, dpr);
      g.lineWidth = 1;
      traces.forEach(function (tr) {
        g.strokeStyle = tr.cyan ? rgba(CYAN, 0.05) : rgba(AMBER, 0.055);
        g.beginPath();
        g.moveTo(tr.p[0][0], tr.p[0][1]);
        for (var i = 1; i < tr.p.length; i++) g.lineTo(tr.p[i][0], tr.p[i][1]);
        g.stroke();
        // pads at both ends + a via midway
        var c = tr.cyan ? CYAN : AMBER;
        [tr.p[0], tr.p[tr.p.length - 1]].forEach(function (pt) {
          g.beginPath(); g.arc(pt[0], pt[1], 2.6, 0, 6.2832);
          g.strokeStyle = rgba(c, 0.14); g.stroke();
        });
        var mid = tr.p[(tr.p.length / 2) | 0];
        g.beginPath(); g.arc(mid[0], mid[1], 1.3, 0, 6.2832);
        g.fillStyle = rgba(c, 0.12); g.fill();
      });
    }

    function pointAt(tr, d) {
      d = clamp(d, 0, tr.total);
      var lo = 0;
      while (lo < tr.lens.length - 1 && tr.lens[lo + 1] < d) lo++;
      var segLen = tr.lens[lo + 1] - tr.lens[lo] || 1;
      var f = (d - tr.lens[lo]) / segLen;
      var a = tr.p[lo], b = tr.p[lo + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }

    function spawnPulses() {
      pulses = [];
      if (reduced || !traces.length) return;
      var n = window.innerWidth < 760 ? 6 : 14;
      for (var i = 0; i < n; i++) {
        pulses.push({
          tr: (Math.random() * traces.length) | 0,
          d: Math.random() * 400,
          v: 55 + Math.random() * 90
        });
      }
    }

    function frame(now, dt) {
      ctx.clearRect(0, 0, W, H);
      if (staticCv) ctx.drawImage(staticCv, 0, 0, W, H);
      for (var i = 0; i < pulses.length; i++) {
        var pl = pulses[i], tr = traces[pl.tr];
        pl.d += pl.v * dt / 1000;
        if (pl.d > tr.total + 120) {
          pl.tr = (Math.random() * traces.length) | 0;
          pl.d = 0; pl.v = 55 + Math.random() * 90;
          continue;
        }
        var sprite = tr.cyan ? spriteCyan : spriteAmber;
        // trail
        for (var k = 6; k >= 1; k--) {
          var td = pl.d - k * 11;
          if (td < 0) continue;
          var tp = pointAt(tr, td);
          var sz = 10 - k;
          ctx.globalAlpha = 0.08 * (7 - k) / 7;
          ctx.drawImage(sprite, tp[0] - sz / 2, tp[1] - sz / 2, sz, sz);
        }
        var hp = pointAt(tr, pl.d);
        ctx.globalAlpha = 0.85;
        ctx.drawImage(sprite, hp[0] - 9, hp[1] - 9, 18, 18);
      }
      ctx.globalAlpha = 1;
    }

    var lastW = 0, lastH = 0;
    function resize(force) {
      var w = window.innerWidth, h = window.innerHeight;
      if (!force && w === lastW && Math.abs(h - lastH) < 170) return; // ignore mobile URL-bar jitter
      lastW = w; lastH = h;
      W = w; H = h;
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.width = W + "px"; cv.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildTraces(); drawStatic(); spawnPulses();
      if (reduced) frame(0, 0); // static render only
    }
    resize(true);
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { resize(false); }, 300); });
    if (!reduced) addTask(frame);
  })();

  /* ============================================================
     BOOT SEQUENCE + HERO INTRO
     ============================================================ */
  (function boot() {
    // split hero name into chars
    doc.querySelectorAll(".hn-line").forEach(function (line) {
      var txt = line.textContent;
      line.textContent = "";
      var base = parseInt(line.dataset.charBase || "0", 10);
      for (var i = 0; i < txt.length; i++) {
        var sp = doc.createElement("span");
        sp.className = "hn-char";
        sp.style.setProperty("--i", base + i);
        sp.textContent = txt[i] === " " ? " " : txt[i];
        line.appendChild(sp);
      }
    });

    function setBooted() {
      if (body.classList.contains("booted")) return;
      body.classList.add("booted");
      var badge = doc.querySelector(".badge");
      if (badge) setTimeout(function () { scramble(badge, { dur: 900 }); }, 250);
      setTimeout(startWave, reduced ? 0 : 600);
      setTimeout(function () { body.classList.add("hero-done"); }, reduced ? 0 : 3200);
    }
    if (reduced) { setBooted(); }
    else { setTimeout(setBooted, 1050); }
    window.addEventListener("load", function () { setTimeout(setBooted, 200); }); // failsafe

    /* oscilloscope waveform */
    function startWave() {
      var wrap = doc.querySelector(".wave-wrap");
      var path = doc.getElementById("wave-path");
      var glow = doc.getElementById("wave-glow");
      if (!wrap || !path) return;
      // build a scope-style waveform: flats, sine burst, ECG spike, square pulse
      var d = "M 0 37";
      function line(x, y) { d += " L " + x.toFixed(1) + " " + y.toFixed(1); }
      var x;
      line(58, 37);
      for (x = 58; x <= 250; x += 3) { line(x, 37 - Math.sin((x - 58) / 192 * Math.PI * 6) * 21); }
      line(250, 37); line(320, 37);
      // ECG-style spike
      line(330, 41); line(338, 8); line(346, 58); line(354, 33); line(360, 37);
      line(438, 37);
      // square pulse
      line(438, 19); line(505, 19); line(505, 55); line(566, 55); line(566, 37);
      line(620, 37);
      for (x = 620; x <= 764; x += 3) { line(x, 37 - Math.sin((x - 620) / 144 * Math.PI * 4) * 10); }
      line(764, 37); line(820, 37);
      path.setAttribute("d", d);
      if (glow) glow.setAttribute("d", d);

      var len = path.getTotalLength();
      if (reduced) { wrap.classList.add("wave-done"); return; }
      path.style.strokeDasharray = len + " " + len;
      path.style.strokeDashoffset = len;
      path.getBoundingClientRect(); // reflow
      path.style.transition = "stroke-dashoffset 1.9s cubic-bezier(.65,0,.35,1)";
      path.style.strokeDashoffset = "0";
      setTimeout(function () {
        wrap.classList.add("wave-done");
        // beam dot rides the waveform forever
        var dot = wrap.querySelector(".wave-dot");
        if (!dot) return;
        var t0 = performance.now();
        addTask(function (now) {
          var lp = ((now - t0) / 4600) % 1;
          var pt = path.getPointAtLength(lp * len);
          var r = wrap.getBoundingClientRect();
          dot.style.transform = "translate(" + (pt.x / 820 * r.width) + "px," + (pt.y / 74 * r.height) + "px)";
        });
      }, 2000);
    }
  })();

  /* ============================================================
     REVEAL SYSTEM  (IO + stagger + split titles + scramble)
     ============================================================ */
  (function reveals() {
    // index children for stagger
    doc.querySelectorAll("[data-reveal-children]").forEach(function (par) {
      Array.prototype.forEach.call(par.children, function (c, i) {
        c.style.setProperty("--i", i);
      });
    });
    // split section titles
    doc.querySelectorAll("[data-split]").forEach(function (el) {
      var txt = el.textContent;
      el.textContent = "";
      for (var i = 0; i < txt.length; i++) {
        var sp = doc.createElement("span");
        sp.className = "st-char";
        sp.style.setProperty("--i", i);
        sp.textContent = txt[i] === " " ? " " : txt[i];
        el.appendChild(sp);
      }
    });

    var targets = doc.querySelectorAll("[data-reveal],[data-reveal-children],[data-split],[data-scramble],[data-glitch]");
    if (reduced || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.classList.add("in");
        if (el.hasAttribute("data-scramble")) scramble(el, { dur: 800 });
        if (el.hasAttribute("data-glitch")) scramble(el, { dur: 900, charset: "0123456789" });
        io.unobserve(el);
        // once the entrance transition settles, drop the reveal hooks so
        // hover/parallax transforms are no longer routed through them
        if (el.hasAttribute("data-reveal") || el.hasAttribute("data-reveal-children")) {
          setTimeout(function () {
            el.removeAttribute("data-reveal");
            el.removeAttribute("data-reveal-children");
          }, 1900);
        }
      });
    }, { rootMargin: "0px 0px -70px 0px", threshold: 0.05 });
    targets.forEach(function (el) { io.observe(el); });
  })();

  /* ============================================================
     COUNTERS
     ============================================================ */
  (function counters() {
    var nums = doc.querySelectorAll("[data-count]");
    if (!nums.length) return;
    function animate(el) {
      var end = parseFloat(el.dataset.count);
      var dec = parseInt(el.dataset.dec || "0", 10);
      var pad = parseInt(el.dataset.pad || "0", 10);
      var suffix = el.dataset.suffix || "";
      if (reduced) return; // HTML already contains final value
      var start = null, dur = 1900;
      var task = function (now) {
        if (start === null) start = now;
        var p = clamp((now - start) / dur, 0, 1);
        var e = 1 - Math.pow(2, -10 * p); // easeOutExpo
        if (p >= 1) e = 1;
        var v = (end * e).toFixed(dec);
        if (pad) { var parts = v.split("."); parts[0] = parts[0].padStart(pad, "0"); v = parts.join("."); }
        el.textContent = v + suffix;
        if (p >= 1) removeTask(task);
      };
      addTask(task);
    }
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        io.unobserve(el);
        // hold until the hero intro has played
        var delay = body.classList.contains("hero-done") ? 0 : 1500;
        setTimeout(function () { animate(el); }, delay);
      });
    }, { threshold: 0.4 });
    nums.forEach(function (el) { io.observe(el); });
  })();

  /* ============================================================
     3D TILT + GLARE  (gallery frames + stat cards)
     ============================================================ */
  (function tilt() {
    if (!FX) return;
    var els = doc.querySelectorAll(".slide-frame,.stat");
    els.forEach(function (el) {
      var glare = doc.createElement("i");
      glare.className = "glare";
      el.appendChild(glare);
      var rect = null;
      var isStat = el.classList.contains("stat");
      var max = isStat ? 3 : 6;
      var host = isStat ? el : el.parentElement;
      host.addEventListener("pointerenter", function () {
        rect = el.getBoundingClientRect();
        el.style.transition = "transform .12s ease-out";
      });
      host.addEventListener("pointermove", function (e) {
        if (!rect) rect = el.getBoundingClientRect();
        var px = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        var py = clamp((e.clientY - rect.top) / rect.height, 0, 1);
        el.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
        el.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
        if (isStat) return; // stats: glare only, no tilt (grid seams)
        var ry = (px - 0.5) * max * 2, rx = (0.5 - py) * max * 2;
        el.style.transform = "perspective(700px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) scale(1.012)";
      });
      host.addEventListener("pointerleave", function () {
        rect = null;
        el.style.transition = "";
        el.style.transform = "";
      });
    });
  })();

  /* ============================================================
     MAGNETIC ELEMENTS
     ============================================================ */
  (function magnetic() {
    if (!FX) return;
    doc.querySelectorAll(".contact-btn,.nav-links a,.copy-chip").forEach(function (el) {
      var rect = null;
      var strength = el.classList.contains("contact-btn") ? 10 : 6;
      el.addEventListener("pointerenter", function () { rect = el.getBoundingClientRect(); });
      el.addEventListener("pointermove", function (e) {
        if (!rect) rect = el.getBoundingClientRect();
        var dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        var dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        el.style.transform = "translate(" + (clamp(dx, -1, 1) * strength).toFixed(1) + "px," + (clamp(dy, -1, 1) * strength * 0.7).toFixed(1) + "px)";
      });
      el.addEventListener("pointerleave", function () { rect = null; el.style.transform = ""; });
    });
  })();

  /* ============================================================
     CUSTOM CURSOR
     ============================================================ */
  (function cursor() {
    if (!FX) return;
    var dot = doc.getElementById("cursor-dot"), ring = doc.getElementById("cursor-ring");
    if (!dot || !ring) return;
    docEl.classList.add("fx-cursor");
    var mx = innerWidth / 2, my = innerHeight / 2;
    var dx = mx, dy = my, rx = mx, ry = my;
    doc.addEventListener("mousemove", function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
    addTask(function () {
      dx += (mx - dx) * 0.6; dy += (my - dy) * 0.6;
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      dot.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)";
      ring.style.transform = "translate(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px)";
    });
    doc.addEventListener("pointerover", function (e) {
      var hot = e.target.closest && e.target.closest("a,button,.slide,[data-cursor-hot]");
      docEl.classList.toggle("cursor-hot", !!hot);
    }, { passive: true });
    doc.addEventListener("pointerdown", function () { docEl.classList.add("cursor-down"); }, { passive: true });
    doc.addEventListener("pointerup", function () { docEl.classList.remove("cursor-down"); }, { passive: true });
    doc.addEventListener("mouseleave", function () { docEl.classList.add("cursor-out"); });
    doc.addEventListener("mouseenter", function () { docEl.classList.remove("cursor-out"); });
  })();

  /* ============================================================
     SCROLL SYSTEMS — progress bar, voltage HUD, nav hide,
     hero parallax, scrollspy rail
     ============================================================ */
  (function scrollFX() {
    var progress = doc.querySelector("#progress span");
    var volt = doc.getElementById("hud-volt");
    var bars = doc.querySelectorAll(".hud-bars i");
    var nav = doc.getElementById("navbar");
    var heroInner = doc.querySelector(".hero-inner");
    var plxEls = FX ? Array.prototype.slice.call(doc.querySelectorAll("[data-plx]")) : [];
    plxEls.forEach(function (el) { el._plx = parseFloat(el.dataset.plx) || 0; });

    var lastY = -1, lastNavY = 0, vh = innerHeight;
    window.addEventListener("resize", function () { vh = innerHeight; }, { passive: true });

    addTask(function () {
      var y = window.scrollY || docEl.scrollTop;
      if (y === lastY) return;
      var goingDown = y > lastNavY;
      var max = (docEl.scrollHeight - vh) || 1;
      var p = clamp(y / max, 0, 1);

      if (progress) progress.style.transform = "scaleX(" + p.toFixed(4) + ")";
      if (volt) volt.textContent = (p * 5).toFixed(2) + "V";
      var onBars = Math.ceil(p * 5);
      for (var i = 0; i < bars.length; i++) bars[i].classList.toggle("on", i < onBars);

      if (nav) {
        nav.classList.toggle("scrolled", y > 30);
        if (Math.abs(y - lastNavY) > 8) {
          nav.classList.toggle("nav-hidden", goingDown && y > 200 && !body.classList.contains("lb-open"));
          lastNavY = y;
        }
      }
      if (heroInner && y < vh * 1.2) {
        heroInner.style.opacity = (1 - clamp(y / (vh * 0.9), 0, 1) * 0.85).toFixed(3);
        for (var j = 0; j < plxEls.length; j++) {
          var el = plxEls[j];
          el.style.transform = "translate3d(0," + (y * el._plx).toFixed(1) + "px,0)";
        }
      }
      lastY = y;
    });

    /* scrollspy → rail dots + HUD section readout */
    var secEls = doc.querySelectorAll("[data-sec]");
    var hudSec = doc.getElementById("hud-sec");
    var dots = doc.querySelectorAll(".rail-dot");
    if (secEls.length && "IntersectionObserver" in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var name = en.target.dataset.sec;
          var id = en.target.id;
          if (hudSec && hudSec.dataset.cur !== name) {
            hudSec.dataset.cur = name;
            scramble(hudSec, { text: name, dur: 420 });
          }
          dots.forEach(function (d) { d.classList.toggle("active", d.dataset.target === id); });
        });
      }, { rootMargin: "-42% 0px -52% 0px", threshold: 0 });
      secEls.forEach(function (el) { spy.observe(el); });
    }
    dots.forEach(function (d) {
      d.addEventListener("click", function () {
        var t = doc.getElementById(d.dataset.target);
        if (t) t.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      });
    });
  })();

  /* ============================================================
     CAROUSELS — native scroll + snap + drag + progress + masks
     ============================================================ */
  var galleryOf = {}; // carousel id -> [{full, cap, alt}]
  (function carousels() {
    doc.querySelectorAll(".carousel").forEach(function (car) {
      var id = car.dataset.carousel;
      var track = car.querySelector(".carousel-track");
      var prev = car.querySelector(".carousel-nav.prev");
      var next = car.querySelector(".carousel-nav.next");
      var prog = car.querySelector(".carousel-progress span");
      if (!track) return;

      var slides = Array.prototype.slice.call(track.querySelectorAll(".slide"));
      galleryOf[id] = slides.map(function (s) {
        var img = s.querySelector("img");
        return { full: s.dataset.full, cap: s.dataset.cap || "", alt: img ? img.alt : "" };
      });

      /* image fade-in when loaded */
      slides.forEach(function (s) {
        var img = s.querySelector("img"), frame = s.querySelector(".slide-frame");
        if (!img || !frame) return;
        if (img.complete && img.naturalWidth) frame.classList.add("img-loaded");
        else img.addEventListener("load", function () { frame.classList.add("img-loaded"); }, { once: true });
        img.addEventListener("error", function () { frame.classList.add("img-loaded"); }, { once: true });
      });

      var ticking = false;
      function update() {
        ticking = false;
        var maxSL = track.scrollWidth - track.clientWidth;
        var has = maxSL > 6;
        car.classList.toggle("has-overflow", has);
        if (!has) return;
        var sl = track.scrollLeft;
        car.style.setProperty("--mL", sl > 10 ? "52px" : "0px");
        car.style.setProperty("--mR", maxSL - sl > 10 ? "52px" : "0px");
        if (prog) prog.style.transform = "scaleX(" + clamp(sl / maxSL, 0, 1).toFixed(4) + ")";
        if (prev) prev.classList.toggle("disabled", sl <= 4);
        if (next) next.classList.toggle("disabled", sl >= maxSL - 4);
      }
      function requestUpdate() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
      track.addEventListener("scroll", requestUpdate, { passive: true });
      window.addEventListener("resize", requestUpdate, { passive: true });
      setTimeout(update, 60);
      window.addEventListener("load", update);

      function step() {
        var s = track.querySelector(".slide");
        return s ? s.offsetWidth + 18 : 300;
      }
      if (prev) prev.addEventListener("click", function () { track.scrollBy({ left: -step(), behavior: "smooth" }); });
      if (next) next.addEventListener("click", function () { track.scrollBy({ left: step(), behavior: "smooth" }); });

      /* desktop drag-to-scroll with momentum */
      if (FX) {
        var down = false, moved = false, startX = 0, startSL = 0, velo = 0, lastX = 0, lastMoveT = 0;
        track.addEventListener("pointerdown", function (e) {
          if (e.pointerType !== "mouse" || e.button !== 0) return;
          down = true; moved = false;
          startX = lastX = e.clientX; startSL = track.scrollLeft;
          velo = 0; lastMoveT = performance.now();
          track.classList.add("dragging");
        });
        track.addEventListener("pointermove", function (e) {
          if (!down) return;
          var dx = e.clientX - startX;
          if (Math.abs(dx) > 8 && !moved) { moved = true; track.setPointerCapture(e.pointerId); }
          if (!moved) return;
          track.scrollLeft = startSL - dx;
          var now = performance.now();
          var dt = now - lastMoveT || 16;
          velo = (e.clientX - lastX) / dt * 16;
          lastX = e.clientX; lastMoveT = now;
        });
        function endDrag() {
          if (!down) return;
          down = false;
          if (!moved) { track.classList.remove("dragging"); return; }
          var v = -velo;
          var momentum = function () {
            v *= 0.92;
            track.scrollLeft += v;
            if (Math.abs(v) > 0.5) { requestAnimationFrame(momentum); }
            else {
              // settle onto nearest slide, then restore snap
              var st = step();
              var target = Math.round(track.scrollLeft / st) * st;
              track.scrollTo({ left: target, behavior: "smooth" });
              setTimeout(function () { track.classList.remove("dragging"); }, 420);
            }
          };
          requestAnimationFrame(momentum);
        }
        track.addEventListener("pointerup", endDrag);
        track.addEventListener("pointercancel", endDrag);
        track.addEventListener("click", function (e) {
          if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
        }, true);
      }

      /* open lightbox on slide click / keyboard */
      slides.forEach(function (s, i) {
        s.setAttribute("role", "button");
        s.setAttribute("tabindex", "0");
        s.setAttribute("aria-label", "Open image: " + (s.dataset.cap || "picture " + (i + 1)));
        s.addEventListener("click", function () { openLightbox(id, i, s); });
        s.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLightbox(id, i, s); }
        });
      });
    });
  })();

  /* ============================================================
     LIGHTBOX  (loads full-res WebP on demand)
     ============================================================ */
  var openLightbox;
  (function lightbox() {
    var lb = doc.getElementById("lightbox");
    if (!lb) { openLightbox = function () {}; return; }
    var img = doc.getElementById("lb-img");
    var cap = doc.getElementById("lb-cap");
    var counter = doc.getElementById("lb-counter");
    var btnClose = doc.getElementById("lb-close");
    var btnPrev = doc.getElementById("lb-prev");
    var btnNext = doc.getElementById("lb-next");
    var curList = null, curIdx = 0, returnFocus = null;

    function preload(i) {
      if (!curList) return;
      var n = curList[(i + curList.length) % curList.length];
      if (n) { var im = new Image(); im.src = n.full; }
    }
    function show(i, instant) {
      curIdx = (i + curList.length) % curList.length;
      var item = curList[curIdx];
      lb.classList.add("loading");
      function swap() {
        img.src = item.full;
        img.alt = item.alt || "";
        if (img.complete && img.naturalWidth) done();
        else img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      }
      function done() {
        lb.classList.remove("loading");
        img.classList.remove("switching");
      }
      if (instant) swap();
      else { img.classList.add("switching"); setTimeout(swap, 140); }
      cap.textContent = item.cap;
      counter.textContent = String(curIdx + 1).padStart(2, "0") + " / " + String(curList.length).padStart(2, "0");
      preload(curIdx + 1); preload(curIdx - 1);
    }
    openLightbox = function (id, i, origin) {
      curList = galleryOf[id];
      if (!curList || !curList.length) return;
      returnFocus = origin || null;
      lb.hidden = false;
      body.classList.add("lb-open");
      body.style.overflow = "hidden";
      img.src = "";
      show(i, true);
      requestAnimationFrame(function () { requestAnimationFrame(function () { lb.classList.add("open"); }); });
      if (btnClose) btnClose.focus({ preventScroll: true });
    };
    function close() {
      lb.classList.remove("open");
      body.classList.remove("lb-open");
      body.style.overflow = "";
      setTimeout(function () { lb.hidden = true; img.src = ""; }, reduced ? 0 : 380);
      if (returnFocus) returnFocus.focus({ preventScroll: true });
    }
    function nav(dir) { if (curList) show(curIdx + dir, false); }

    btnClose.addEventListener("click", close);
    btnPrev.addEventListener("click", function () { nav(-1); });
    btnNext.addEventListener("click", function () { nav(1); });
    lb.addEventListener("click", function (e) {
      if (e.target === lb || e.target.classList.contains("lb-backdrop")) close();
    });
    doc.addEventListener("keydown", function (e) {
      if (lb.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") nav(1);
      else if (e.key === "ArrowLeft") nav(-1);
    });
    /* touch swipe */
    var tx = null;
    lb.addEventListener("touchstart", function (e) { tx = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (tx === null) return;
      var d = e.changedTouches[0].clientX - tx;
      if (Math.abs(d) > 44) nav(d < 0 ? 1 : -1);
      tx = null;
    }, { passive: true });
  })();

  /* ============================================================
     SMALL DELIGHTS — ticker, tag scramble, copy email,
     footer terminal, console badge
     ============================================================ */
  (function ticker() {
    var track = doc.getElementById("ticker-track");
    if (!track || reduced) return;
    track.innerHTML += track.innerHTML; // duplicate for seamless loop
  })();

  (function tagScramble() {
    if (!FX) return;
    doc.querySelectorAll(".tag").forEach(function (tag) {
      var cool = 0;
      tag.addEventListener("pointerenter", function () {
        var now = Date.now();
        if (now - cool < 900) return;
        cool = now;
        scramble(tag, { dur: 450 });
      });
    });
  })();

  (function copyEmail() {
    doc.querySelectorAll(".copy-chip").forEach(function (chip) {
      var label = chip.textContent;
      chip.addEventListener("click", function () {
        var v = chip.dataset.copy || "";
        function okFx() {
          chip.classList.add("copied");
          chip.textContent = "[ COPIED ✓ ]";
          setTimeout(function () { chip.classList.remove("copied"); chip.textContent = label; }, 1700);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(v).then(okFx, okFx);
        } else { okFx(); }
      });
    });
  })();

  (function footTerm() {
    var el = doc.getElementById("foot-type");
    if (!el) return;
    var txt = el.dataset.text || "";
    el.textContent = "";
    if (reduced || !("IntersectionObserver" in window)) { el.textContent = txt; return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(el);
        var i = 0;
        (function type() {
          el.textContent = txt.slice(0, ++i);
          if (i < txt.length) setTimeout(type, 34 + Math.random() * 40);
        })();
      });
    }, { threshold: 0.4 });
    io.observe(el);
  })();

  try {
    console.log(
      "%c AY. %c ENGINEERING PORTFOLIO v2.0 — hand-built motion system. No frameworks. ",
      "background:#e8a020;color:#0a0a0f;font-weight:bold;padding:4px 8px;border-radius:3px 0 0 3px;font-family:monospace",
      "background:#13131c;color:#8a8a92;padding:4px 8px;border-radius:0 3px 3px 0;font-family:monospace"
    );
  } catch (e) {}

})();
