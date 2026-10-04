/* engine/sim-v1.0.0.js
   CHANGELOG
   v1.0.0 (2026-10-04) first version

   DL.sims (define, load, mount, ids) and DL.simTest (run), per the engine
   contract v1.0.0 section 5 and the episode schema v1.0.0 section 4.

   Behaviour this file adds on top of the contract (documented here so module
   authors and the test runner can rely on it):
   - A dot that reaches the end of its path is removed, unless its onArrive
     parked it or gave it a new path. dot.park() with no arguments parks it in
     place. A dot dropped by the 150-dot cap is an inert object with
     dropped: true, so callers never crash and can apply its effect at once.
   - def.startClock and def.speed are fallbacks under opts.startClock and the
     default speed of 1.
   - api.reducedMotion is true when the viewer prefers reduced motion (always
     false under DL.simTest, so self-tests are repeatable).
   - api.after and api.every return { cancel() }.
   - range(..., onChange, opts) takes an optional 8th argument
     { format(value) } for the value shown next to the label.
   - button(..., opts) takes { tone: "danger" | "ghost" | "primary",
     wide: true, disabled: true }. Every control sits in its own .sim-ctl
     wrapper with a data-kind attribute; a wide button's wrapper spans the row.
   - When api.onNodeClick is registered, the diagram svg's role changes from
     "img" to "group" so the focusable node buttons are exposed to assistive
     technology.
   - DL.sims.ids() lists the defined module ids. The self-test harness also
     exposes t.api (the live api object) for advanced checks.
*/
(function (root) {
  "use strict";
  var DL = root.DL || (root.DL = {});

  var MAX_DOTS = 150;
  var MAX_DT = 0.05;
  var LOG_LINES = 14;
  var HISTORY_LINES = 2000;
  var DOT_SPEED = 240;            // viewBox units per real second
  var DOT_R = 3.6;
  var TEST_STEP = 1 / 60;
  var TEST_RUN_CAP = 600;         // real seconds per t.run call
  var TEST_TOTAL_CAP = 3600;      // real seconds across one selfTest
  var TEST_TIMEOUT_MS = 30000;    // wall-clock limit for one selfTest
  var TEST_ERROR_CAP = 50;
  var ID_RE = /^[A-Za-z0-9_-]+$/;
  var TIMES = String.fromCharCode(0xD7);   // multiplication sign; keeps the source plain ASCII

  var registry = {};
  var pending = {};

  /* ---------- small helpers ---------- */

  function util() {
    if (!DL.util || typeof DL.util.el !== "function" || typeof DL.util.svg !== "function") {
      throw new Error("engine/core.js (DL.util) must load before engine/sim.js is used.");
    }
    return DL.util;
  }
  function el(tag, attrs, children) { return util().el(tag, attrs || {}, children); }
  function svgEl(tag, attrs) { return util().svg(tag, attrs || {}); }
  function empty(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function num(v, fallback) {
    if (v === null || v === undefined || v === "") return fallback;
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }
  function errMsg(e) { return e && e.message ? String(e.message) : String(e); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmtClock(sec) {
    var s = Math.floor(num(sec, 0)) % 86400;
    if (s < 0) s += 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }
  function nowMs() {
    return root.performance && typeof root.performance.now === "function" ? root.performance.now() : Date.now();
  }
  // mulberry32: small, fast, seeded PRNG so self-tests are repeatable.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fire(target, type) {
    var d = target.ownerDocument;
    var ev;
    if (d && typeof d.createEvent === "function") {
      ev = d.createEvent("Event");
      ev.initEvent(type, true, true);
    } else {
      ev = new root.Event(type, { bubbles: true, cancelable: true });
    }
    target.dispatchEvent(ev);
  }

  /* ---------- one mounted sim ---------- */

  function createInstance(simId, def, container, opts) {
    opts = opts || {};
    var doc = container.ownerDocument || root.document;
    var testMode = !!opts._test;
    var startClock = num(opts.startClock, num(def.startClock, 0));
    var seed = num(opts.seed, 7);
    var reducedMotion = false;
    if (!testMode) {
      try {
        reducedMotion = !!(typeof root.matchMedia === "function" &&
          root.matchMedia("(prefers-reduced-motion: reduce)").matches);
      } catch (e) { reducedMotion = false; }
    }

    var S = {
      epoch: 0, real: 0, seq: 0, timers: [], dots: [],
      controls: {}, stats: {}, history: [], handle: null,
      nodeStates: {}, nodeTexts: {}, edgeStates: {}, nodeApis: {}, edgeApis: {},
      clickFn: null, errors: [], errorSeen: {}, reported: 0, warned: {},
      destroyed: false, inFrame: false, raf: null, caf: null, io: null,
      rng: mulberry32(seed), clockText: null, speedText: null
    };

    /* layout: .sim > .sim-stage (top, canvas, stats, info) + .sim-controls (controls, log) */
    empty(container);
    if (container.classList) container.classList.add("sim");
    var clockEl = el("span", { "class": "sim-clock" });
    var speedEl = el("span", {});
    var topEl = el("div", { "class": "sim-top" }, [clockEl, speedEl]);
    if (opts.showClock === false) topEl.hidden = true;
    var canvas = el("div", { "class": "sim-canvas" });
    var statsEl = el("div", { "class": "sim-stats", role: "group", "aria-label": "Live numbers" });
    var infoEl = el("div", { "class": "sim-info", "aria-live": "polite" });
    var stage = el("div", { "class": "sim-stage" }, [topEl, canvas, statsEl, infoEl]);
    var logEl = el("ol", { "class": "sim-log", "aria-live": "polite", "aria-label": "Log" });
    var controlsEl = el("aside", { "class": "sim-controls", "aria-label": "Controls" }, [logEl]);
    container.appendChild(stage);
    container.appendChild(controlsEl);

    /* errors: collected for the self-test, sent to the console when live */
    function report(e, where) {
      var msg = (where ? where + ": " : "") + errMsg(e);
      if (testMode) {
        if (S.errorSeen[msg] || S.errors.length >= TEST_ERROR_CAP) return;
        S.errorSeen[msg] = true;
        S.errors.push(msg);
        return;
      }
      if (S.reported < 10 && root.console && typeof root.console.error === "function") {
        S.reported++;
        root.console.error("[sim " + simId + "] " + msg, e);
      }
    }
    function warnOnce(key, msg) {
      if (S.warned[key]) return;
      S.warned[key] = true;
      report(new Error(msg), "api");
    }
    function call(fn, where) {
      try { return fn(); } catch (e) { report(e, where); }
      return undefined;
    }

    /* ---------- diagram ---------- */

    function hasNode(id) {
      var h = S.handle;
      return !!(h && h.nodes && h.nodes[id]);
    }

    function renderDiagram() {
      empty(canvas);
      S.handle = null;
      if (!def.diagram) return;
      if (!DL.diagram || typeof DL.diagram.render !== "function") {
        throw new Error("engine/diagram.js must load before a sim with a diagram is mounted.");
      }
      var h = DL.diagram.render(def.diagram, canvas);
      S.handle = h || null;
      var specNodes = Array.isArray(def.diagram.nodes) ? def.diagram.nodes : [];
      specNodes.forEach(function (n) {
        if (!n || n.id === undefined || n.id === null) return;
        var id = String(n.id);
        S.nodeStates[id] = n.tone ? String(n.tone) : "";
        var m = {};
        ["label", "sub", "meta"].forEach(function (k) {
          if (n[k] !== undefined && n[k] !== null) m[k] = String(n[k]);
        });
        S.nodeTexts[id] = m;
      });
      if (h && h.nodes) {
        Object.keys(h.nodes).forEach(function (id) {
          var g = h.nodes[id] && h.nodes[id].g;
          if (g && typeof g.setAttribute === "function") g.setAttribute("data-node-id", id);
        });
      }
    }

    function nodeApi(id) {
      id = String(id);
      if (S.nodeApis[id]) return S.nodeApis[id];
      if (S.handle && !hasNode(id)) warnOnce("node:" + id, "unknown node '" + id + "'");
      var o = {
        set: function (state) {
          var st = state ? String(state) : "";
          if ((S.nodeStates[id] || "") === st) return;
          S.nodeStates[id] = st;
          if (hasNode(id) && typeof S.handle.setNodeState === "function") S.handle.setNodeState(id, st);
        },
        text: function (line, value) {
          var k = String(line);
          var v = value === null || value === undefined ? "" : String(value);
          var m = S.nodeTexts[id] || (S.nodeTexts[id] = {});
          if (m[k] === v) return;
          m[k] = v;
          if (hasNode(id) && typeof S.handle.setNodeText === "function") S.handle.setNodeText(id, k, v);
        }
      };
      Object.defineProperty(o, "state", { enumerable: true, get: function () { return S.nodeStates[id] || ""; } });
      S.nodeApis[id] = o;
      return o;
    }

    function edgeApi(from, to) {
      var key = String(from) + ">" + String(to);
      if (S.edgeApis[key]) return S.edgeApis[key];
      var h = S.handle;
      if (h && h.edges && !h.edges[key] && !h.edges[String(to) + ">" + String(from)]) {
        warnOnce("edge:" + key, "unknown edge '" + key + "'");
      }
      var o = {
        set: function (state) {
          var st = state ? String(state) : "";
          if ((S.edgeStates[key] || "") === st) return;
          S.edgeStates[key] = st;
          var hh = S.handle;
          if (hh && typeof hh.setEdgeState === "function") hh.setEdgeState(key, st);
        }
      };
      Object.defineProperty(o, "state", { enumerable: true, get: function () { return S.edgeStates[key] || ""; } });
      S.edgeApis[key] = o;
      return o;
    }

    /* ---------- dots ---------- */

    function dotsLayer() {
      var h = S.handle;
      if (!h) return null;
      if (h.dotsLayer) return h.dotsLayer;
      if (h.svg) {
        h.dotsLayer = svgEl("g", {});
        h.svg.insertBefore(h.dotsLayer, h.svg.firstChild);
        return h.dotsLayer;
      }
      return null;
    }

    function resolvePoint(w) {
      if (Array.isArray(w)) return { x: num(w[0], 0), y: num(w[1], 0) };
      if (w && typeof w === "object") return { x: num(w.x, 0), y: num(w.y, 0) };
      var id = String(w);
      var h = S.handle;
      var p = null;
      if (h && typeof h.point === "function") {
        try { p = h.point(id); } catch (e) { p = null; }
      }
      if (p && isFinite(p.x) && isFinite(p.y)) return { x: Number(p.x), y: Number(p.y) };
      if (h && h.nodes && h.nodes[id]) return { x: num(h.nodes[id].cx, 0), y: num(h.nodes[id].cy, 0) };
      warnOnce("wp:" + id, "unknown waypoint '" + id + "'");
      return { x: 0, y: 0 };
    }

    function place(rec, x, y) {
      var d = rec.dot;
      d.x = x;
      d.y = y;
      if (d.el) {
        d.el.setAttribute("cx", x.toFixed(1));
        d.el.setAttribute("cy", y.toFixed(1));
      }
    }

    function removeRec(rec) {
      var d = rec.dot;
      if (d.removed) return;
      d.removed = true;
      if (d.el && d.el.parentNode) d.el.parentNode.removeChild(d.el);
      var i = S.dots.indexOf(rec);
      if (i >= 0) S.dots.splice(i, 1);
    }

    function inertDot() {
      var d = { x: 0, y: 0, el: null, parked: false, removed: true, dropped: true };
      var self = function () { return d; };
      d.park = self; d.resume = self; d.remove = self; d.cls = self; d.setPath = self;
      return d;
    }

    function makeDot(o) {
      o = o || {};
      var path = Array.isArray(o.path) ? o.path.slice() : [];
      if (!path.length || S.dots.length >= MAX_DOTS) return inertDot();
      var d = { x: 0, y: 0, el: null, parked: false, removed: false, dropped: false };
      var rec = {
        dot: d, wps: path, pts: path.map(resolvePoint), next: 1, ver: 0,
        speed: Math.max(0, num(o.speed, DOT_SPEED)),
        onArrive: typeof o.onArrive === "function" ? o.onArrive : null
      };
      var layer = dotsLayer();
      if (layer) {
        d.el = svgEl("circle", { "class": o.cls ? "dot " + o.cls : "dot", r: num(o.r, DOT_R) });
        layer.appendChild(d.el);
      }
      place(rec, rec.pts[0].x, rec.pts[0].y);
      d.park = function (x, y) {
        if (d.removed) return d;
        d.parked = true;
        if (x !== undefined && y !== undefined) place(rec, num(x, d.x), num(y, d.y));
        return d;
      };
      d.resume = function () { d.parked = false; return d; };
      d.remove = function () { removeRec(rec); return d; };
      d.cls = function (name) {
        if (d.el) d.el.setAttribute("class", name ? "dot " + name : "dot");
        return d;
      };
      d.setPath = function (p) {
        if (d.removed) return d;
        var list = Array.isArray(p) ? p.slice() : [];
        if (!list.length) return d;
        rec.wps = list;
        rec.pts = list.map(resolvePoint);
        rec.next = 1;
        rec.ver++;
        place(rec, rec.pts[0].x, rec.pts[0].y);
        return d;
      };
      S.dots.push(rec);
      return d;
    }

    function arrive(rec, wp) {
      if (!rec.onArrive) return;
      try { rec.onArrive(rec.dot, wp); } catch (e) { report(e, "onArrive"); }
    }

    function moveDots(dt, epoch) {
      var list = S.dots.slice();
      for (var i = 0; i < list.length; i++) {
        var rec = list[i], d = rec.dot;
        if (d.removed || d.parked) continue;
        var budget = rec.speed * dt;
        var guard = 0;
        while (budget > 0 && !d.removed && !d.parked && guard++ < 64) {
          if (rec.next >= rec.pts.length) { removeRec(rec); break; }
          var p = rec.pts[rec.next];
          var dx = p.x - d.x, dy = p.y - d.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > budget) {
            place(rec, d.x + dx / dist * budget, d.y + dy / dist * budget);
            break;
          }
          budget -= dist;
          place(rec, p.x, p.y);
          var wp = rec.wps[rec.next];
          var ver = rec.ver;
          rec.next++;
          arrive(rec, wp);
          if (S.epoch !== epoch || S.destroyed) return;
          if (rec.ver !== ver) break;          // new path: carry on next frame
          if (!d.removed && !d.parked && rec.next >= rec.pts.length) { removeRec(rec); break; }
        }
      }
    }

    /* ---------- timers (real seconds, advanced only by tick) ---------- */

    function addTimer(sec, fn, repeat) {
      var s = Math.max(0, num(sec, 0));
      if (repeat) s = Math.max(s, 0.001);
      var tm = { at: S.real + s, every: repeat ? s : 0, fn: fn, seq: ++S.seq };
      S.timers.push(tm);
      return {
        cancel: function () {
          var i = S.timers.indexOf(tm);
          if (i >= 0) S.timers.splice(i, 1);
        }
      };
    }

    function runTimers(epoch) {
      for (var n = 0; n < 10000; n++) {
        var best = -1;
        for (var i = 0; i < S.timers.length; i++) {
          var tm = S.timers[i];
          if (tm.at > S.real + 1e-9) continue;
          if (best < 0 || tm.at < S.timers[best].at || (tm.at === S.timers[best].at && tm.seq < S.timers[best].seq)) best = i;
        }
        if (best < 0) return;
        var due = S.timers[best];
        if (due.every) due.at += due.every;
        else S.timers.splice(best, 1);
        if (typeof due.fn === "function") call(due.fn, "timer");
        if (S.epoch !== epoch || S.destroyed) return;
      }
    }

    /* ---------- controls ---------- */

    function domId(id) { return "sim-" + simId + "-" + id; }

    function addControl(id, kind, wrap, rec) {
      if (S.controls[id]) warnOnce("ctl:" + id, "duplicate control id '" + id + "'");
      rec.kind = kind;
      S.controls[id] = rec;
      controlsEl.insertBefore(wrap, logEl);
    }

    function wrapper(kind) { return el("div", { "class": "sim-ctl", "data-kind": kind }); }

    function disabler(input) {
      return function (on) {
        var v = !!on;
        if (input.disabled !== v) input.disabled = v;
      };
    }

    function button(id, label, onClick, bopts) {
      id = String(id);
      bopts = bopts || {};
      var cls = "btn" + (bopts.tone ? " btn-" + bopts.tone : "");
      var b = el("button", { type: "button", id: domId(id), "class": cls, text: String(label) });
      var ctl = {
        el: b, value: String(label),
        set: function (v) { ctl.value = v; b.textContent = String(v); },
        disable: disabler(b)
      };
      b.addEventListener("click", function () {
        if (b.disabled || typeof onClick !== "function") return;
        call(function () { onClick(ctl); }, "control " + id);
      });
      var wrap = wrapper("button");
      if (bopts.wide && wrap.style) wrap.style.flexBasis = "100%";
      wrap.appendChild(b);
      addControl(id, "button", wrap, { el: b, ctl: ctl });
      if (bopts.disabled) ctl.disable(true);
      return ctl;
    }

    function toggle(id, label, initial, onChange) {
      id = String(id);
      // Same shape as range: a label row (name, current value), then the input.
      var input = el("input", { type: "checkbox", role: "switch", id: domId(id), autocomplete: "off" });
      var stateEl = el("span", { "aria-hidden": "true" });
      var lab = el("label", { "for": domId(id) }, [el("span", { text: String(label) }), stateEl]);
      var wrap = wrapper("toggle");
      wrap.appendChild(lab);
      wrap.appendChild(input);
      var ctl = {
        el: input, value: false,
        set: function (v) {
          ctl.value = !!v;
          input.checked = ctl.value;
          stateEl.textContent = ctl.value ? "on" : "off";
        },
        disable: disabler(input)
      };
      ctl.set(initial);
      input.addEventListener("change", function () {
        ctl.value = !!input.checked;
        stateEl.textContent = ctl.value ? "on" : "off";
        if (typeof onChange === "function") call(function () { onChange(ctl.value); }, "control " + id);
      });
      addControl(id, "toggle", wrap, { el: input, ctl: ctl });
      return ctl;
    }

    function select(id, label, options, initial, onChange) {
      id = String(id);
      var list = Array.isArray(options) ? options.filter(function (o) { return o && o.value !== undefined; }) : [];
      var sel = el("select", { id: domId(id), autocomplete: "off" });
      list.forEach(function (o) {
        var opt = el("option", { text: String(o.label === undefined ? o.value : o.label) });
        opt.value = String(o.value);
        sel.appendChild(opt);
      });
      var lab = el("label", { "for": domId(id), text: String(label) });
      var wrap = wrapper("select");
      wrap.appendChild(lab);
      wrap.appendChild(sel);
      function match(v) {
        for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
        return null;
      }
      var ctl = {
        el: sel, value: undefined,
        set: function (v) {
          var m = match(v);
          if (!m) return;
          ctl.value = m.value;
          sel.value = String(m.value);
        },
        disable: disabler(sel)
      };
      ctl.set(initial !== undefined && match(initial) ? initial : (list.length ? list[0].value : undefined));
      sel.addEventListener("change", function () {
        var m = match(sel.value);
        if (!m) return;
        ctl.value = m.value;
        if (typeof onChange === "function") call(function () { onChange(m.value); }, "control " + id);
      });
      addControl(id, "select", wrap, { el: sel, ctl: ctl, match: match });
      return ctl;
    }

    function range(id, label, min, max, step, initial, onChange, ropts) {
      id = String(id);
      ropts = ropts || {};
      var input = el("input", {
        type: "range", id: domId(id), min: String(min), max: String(max), step: String(step), autocomplete: "off"
      });
      var out = el("output", { "for": domId(id) });
      var lab = el("label", { "for": domId(id) }, [el("span", { text: String(label) }), out]);
      var wrap = wrapper("range");
      wrap.appendChild(lab);
      wrap.appendChild(input);
      function show(v) {
        var s = String(v);
        if (typeof ropts.format === "function") {
          try { s = String(ropts.format(v)); } catch (e) { report(e, "control " + id + " format"); }
        }
        out.textContent = s;
      }
      var ctl = {
        el: input, value: num(initial, num(min, 0)),
        set: function (v) {
          input.value = String(v);
          ctl.value = num(input.value, num(v, ctl.value));
          show(ctl.value);
        },
        disable: disabler(input)
      };
      ctl.set(ctl.value);
      function changed() {
        var v = num(input.value, ctl.value);
        show(v);
        if (v === ctl.value) return;
        ctl.value = v;
        if (typeof onChange === "function") call(function () { onChange(v); }, "control " + id);
      }
      input.addEventListener("input", changed);
      input.addEventListener("change", changed);
      addControl(id, "range", wrap, { el: input, ctl: ctl });
      return ctl;
    }

    /* ---------- stats, log, info, node clicks ---------- */

    function stat(id, label, tone) {
      id = String(id);
      var v = el("span", { "class": "sim-stat-v", text: "0" });
      var k = el("span", { "class": "sim-stat-k", text: String(label) });
      var box = el("div", { "class": "sim-stat" + (tone ? " " + tone : ""), "data-stat": id }, [v, k]);
      statsEl.appendChild(box);
      var rec = { el: box, valueEl: v, text: "0" };
      S.stats[id] = rec;
      return function (value) {
        var s = value === null || value === undefined ? "" : String(value);
        if (rec.text === s) return;
        rec.text = s;
        v.textContent = s;
      };
    }

    function log(msg, tone) {
      var time = fmtClock(api.clock);
      var text = msg === null || msg === undefined ? "" : String(msg);
      var li = tone ? el("li", { "class": "t-" + tone }) : el("li", {});
      li.appendChild(el("time", { text: time }));
      li.appendChild(doc.createTextNode(text));
      logEl.insertBefore(li, logEl.firstChild);
      while (logEl.children.length > LOG_LINES) logEl.removeChild(logEl.lastElementChild || logEl.lastChild);
      S.history.push(time + " " + text);
      if (S.history.length > HISTORY_LINES) S.history.shift();
    }

    function info(html) {
      infoEl.innerHTML = html === null || html === undefined ? "" : String(html);
    }

    function nodeName(id) {
      var n = S.handle && S.handle.nodes ? S.handle.nodes[id] : null;
      var t = S.nodeTexts[id] && S.nodeTexts[id].label;
      if (!t && n && n.label) t = n.label.textContent;
      return t || id;
    }

    function onNodeClick(fn) {
      S.clickFn = typeof fn === "function" ? fn : null;
      var h = S.handle;
      if (!S.clickFn || !h || !h.nodes) return;
      if (h.svg && typeof h.svg.setAttribute === "function") h.svg.setAttribute("role", "group");
      Object.keys(h.nodes).forEach(function (id) {
        var g = h.nodes[id] && h.nodes[id].g;
        if (!g || typeof g.setAttribute !== "function") return;
        g.setAttribute("tabindex", "0");
        g.setAttribute("role", "button");
        g.setAttribute("aria-label", nodeName(id) + ": what is this?");
      });
    }

    function nodeIdFrom(target) {
      var n = target;
      while (n && n !== canvas) {
        if (n.getAttribute && n.getAttribute("data-node-id")) return n.getAttribute("data-node-id");
        n = n.parentNode;
      }
      return null;
    }

    canvas.addEventListener("click", function (e) {
      if (!S.clickFn) return;
      var id = nodeIdFrom(e.target);
      if (!id) return;
      var fn = S.clickFn;
      call(function () { fn(id); }, "onNodeClick");
    });
    canvas.addEventListener("keydown", function (e) {
      if (!S.clickFn) return;
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      var id = nodeIdFrom(e.target);
      if (!id) return;
      if (typeof e.preventDefault === "function") e.preventDefault();
      var fn = S.clickFn;
      call(function () { fn(id); }, "onNodeClick");
    });

    /* ---------- clock, tick, reset, loop ---------- */

    function renderClock() {
      var txt = fmtClock(api.clock);
      if (txt !== S.clockText) { S.clockText = txt; clockEl.textContent = txt; }
      var sp = num(api.speed, 0);
      var st = "";
      if (sp > 1) st = "Clock runs " + sp + TIMES + " faster than real time";
      else if (sp > 0 && sp < 1) st = "Clock runs at " + sp + TIMES + " real time";
      if (st !== S.speedText) { S.speedText = st; speedEl.textContent = st; }
    }

    function tick(dt) {
      if (S.destroyed) return;
      dt = num(dt, 0);
      if (!(dt > 0)) dt = 0;
      if (dt > MAX_DT) dt = MAX_DT;
      var epoch = S.epoch;
      S.real += dt;
      api.clock = num(api.clock, 0) + dt * num(api.speed, 0);
      runTimers(epoch);
      if (S.epoch !== epoch || S.destroyed) return;
      if (typeof def.step === "function") {
        call(function () { def.step(api, dt); }, "step");
        if (S.epoch !== epoch || S.destroyed) return;
      }
      moveDots(dt, epoch);
      if (S.epoch !== epoch || S.destroyed) return;
      renderClock();
    }

    // strict: let diagram and setup errors throw (first mount). Otherwise report them.
    function rebuild(strict) {
      if (S.destroyed) return;
      var focusId = null;
      try {
        var a = doc.activeElement;
        if (a && a.id && container.contains(a)) focusId = a.id;
      } catch (e) { focusId = null; }

      S.epoch++;
      S.timers = [];
      S.dots.slice().forEach(removeRec);
      S.dots = [];
      Array.prototype.slice.call(controlsEl.childNodes).forEach(function (c) {
        if (c !== logEl) controlsEl.removeChild(c);
      });
      S.controls = {};
      empty(statsEl);
      S.stats = {};
      empty(logEl);
      S.history = [];
      infoEl.innerHTML = "";
      S.clickFn = null;
      S.nodeStates = {}; S.nodeTexts = {}; S.edgeStates = {}; S.nodeApis = {}; S.edgeApis = {};
      api.state = {};
      api.clock = startClock;
      api.speed = num(def.speed, 1);
      S.real = 0;
      S.rng = mulberry32(seed);

      if (strict) {
        renderDiagram();
        def.setup(api);
      } else {
        try { renderDiagram(); } catch (e) { report(e, "diagram"); }
        call(function () { def.setup(api); }, "setup");
      }
      renderClock();

      if (focusId) {
        Object.keys(S.controls).some(function (k) {
          var c = S.controls[k];
          if (c.el && c.el.id === focusId && typeof c.el.focus === "function") {
            try { c.el.focus(); } catch (e) { /* focus is a nicety */ }
            return true;
          }
          return false;
        });
      }
    }

    function destroy() {
      if (S.destroyed) return;
      S.destroyed = true;
      if (S.raf !== null && S.caf) { try { S.caf(S.raf); } catch (e) { /* already gone */ } }
      if (S.io) { try { S.io.disconnect(); } catch (e) { /* already gone */ } }
      S.timers = [];
      S.dots.slice().forEach(removeRec);
      S.dots = [];
      empty(container);
      if (container.classList) container.classList.remove("sim");
    }

    function startLoop() {
      var raf, caf;
      if (typeof root.requestAnimationFrame === "function") {
        raf = function (cb) { return root.requestAnimationFrame(cb); };
        caf = function (h) { if (typeof root.cancelAnimationFrame === "function") root.cancelAnimationFrame(h); };
      } else if (typeof root.setTimeout === "function") {
        raf = function (cb) { return root.setTimeout(function () { cb(nowMs()); }, 16); };
        caf = function (h) { root.clearTimeout(h); };
      } else {
        return;
      }
      S.caf = caf;
      if (typeof root.IntersectionObserver === "function") {
        try {
          S.io = new root.IntersectionObserver(function (entries) {
            var e = entries && entries[entries.length - 1];
            if (e) inst.visible = !!e.isIntersecting;
          }, { threshold: 0.05 });
          S.io.observe(container);
        } catch (e) {
          S.io = null;
          inst.visible = true;
        }
      }
      var last = null;
      function frame(ts) {
        // The next frame is requested while inFrame is set, so a stubbed
        // requestAnimationFrame that calls back at once cannot recurse.
        if (S.destroyed || S.inFrame) return;
        S.inFrame = true;
        try {
          S.raf = raf(frame);
          var now = typeof ts === "number" ? ts : nowMs();
          if (last === null) last = now;
          var dt = (now - last) / 1000;
          last = now;
          if (inst.visible && !(doc && doc.hidden)) tick(dt);
        } catch (e) {
          report(e, "frame");
        } finally {
          S.inFrame = false;
        }
      }
      S.raf = raf(frame);
    }

    /* ---------- the api and the instance ---------- */

    var api = {
      root: canvas,
      clock: startClock,
      speed: num(def.speed, 1),
      state: {},
      reducedMotion: reducedMotion,
      node: nodeApi,
      edge: edgeApi,
      dot: makeDot,
      control: { button: button, toggle: toggle, select: select, range: range },
      stat: stat,
      log: log,
      after: function (sec, fn) { return addTimer(sec, fn, false); },
      every: function (sec, fn) { return addTimer(sec, fn, true); },
      rand: function () { return S.rng(); },
      reset: function () { rebuild(false); },
      info: info,
      onNodeClick: onNodeClick
    };

    var inst = {
      api: api,
      tick: tick,
      reset: function () { rebuild(false); },
      destroy: destroy,
      visible: true
    };
    Object.defineProperty(inst, "_s", { value: S });

    try {
      rebuild(true);
    } catch (e) {
      destroy();
      throw e;
    }
    if (opts._loop !== false) startLoop();
    return inst;
  }

  /* ---------- registry ---------- */

  function define(id, def) {
    id = String(id);
    if (!ID_RE.test(id)) throw new Error("DL.sims.define: bad sim id '" + id + "'.");
    if (!def || typeof def.setup !== "function") throw new Error("DL.sims.define: sim '" + id + "' needs a setup(api) function.");
    registry[id] = def;
    return def;
  }

  function load(id) {
    id = String(id);
    if (registry[id]) return Promise.resolve(registry[id]);
    if (!ID_RE.test(id)) return Promise.reject(new Error("DL.sims.load: bad sim id '" + id + "'."));
    if (!pending[id]) {
      var p;
      try { p = Promise.resolve(util().loadScript("sims/" + id + ".js")); } catch (e) { p = Promise.reject(e); }
      pending[id] = p.then(function () {
        delete pending[id];
        if (!registry[id]) throw new Error("sims/" + id + ".js loaded but did not call DL.sims.define(\"" + id + "\", ...).");
        return registry[id];
      }, function (e) {
        delete pending[id];
        throw new Error("Could not load sims/" + id + ".js" + (e && e.message ? ": " + e.message : "."));
      });
    }
    return pending[id];
  }

  function mount(id, container, opts) {
    if (!container || typeof container.appendChild !== "function") {
      return Promise.reject(new Error("DL.sims.mount needs a container element."));
    }
    opts = opts || {};
    var clean = { startClock: opts.startClock, showClock: opts.showClock, seed: opts.seed };
    return load(id).then(function (def) { return createInstance(String(id), def, container, clean); });
  }

  DL.sims = {
    define: define,
    load: load,
    mount: mount,
    ids: function () { return Object.keys(registry); }
  };

  /* ---------- self-test runner ---------- */

  function harness(inst, rec) {
    var S = inst._s;
    var totalRun = 0;

    function drain() {
      while (S.errors.length) rec(false, "error in sim: " + S.errors.shift());
    }
    function control(id, op) {
      var c = S.controls[String(id)];
      if (!c) rec(false, "t." + op + ": no control '" + id + "'");
      return c || null;
    }

    return {
      api: inst.api,
      click: function (id) {
        var c = control(id, "click");
        if (!c || S.destroyed) return;
        if (c.el.disabled) return;          // like a person clicking a greyed-out control
        if (c.kind === "toggle") {
          c.el.checked = !c.el.checked;
          fire(c.el, "change");
        } else {
          fire(c.el, "click");
        }
        drain();
      },
      set: function (id, v) {
        var c = control(id, "set");
        if (!c || S.destroyed) return;
        if (c.el.disabled) return;
        if (c.kind === "toggle") {
          c.el.checked = !!v;
          fire(c.el, "change");
        } else if (c.kind === "select") {
          if (!c.match(v)) { rec(false, "t.set: control '" + id + "' has no option " + v); return; }
          c.el.value = String(v);
          fire(c.el, "change");
        } else if (c.kind === "range") {
          c.el.value = String(v);
          fire(c.el, "input");
        } else {
          rec(false, "t.set: control '" + id + "' is a button; use t.click");
          return;
        }
        drain();
      },
      run: function (sec) {
        var s = Math.max(0, num(sec, 0));
        if (s > TEST_RUN_CAP) {
          rec(false, "t.run(" + sec + ") capped at " + TEST_RUN_CAP + "s");
          s = TEST_RUN_CAP;
        }
        totalRun += s;
        if (totalRun > TEST_TOTAL_CAP) {
          throw new Error("t.run: more than " + TEST_TOTAL_CAP + " simulated real seconds in one selfTest");
        }
        var n = Math.round(s / TEST_STEP);
        for (var i = 0; i < n && !S.destroyed; i++) inst.tick(TEST_STEP);
        drain();
        return Promise.resolve();
      },
      node: function (id) {
        id = String(id);
        var h = S.handle;
        var n = h && h.nodes ? h.nodes[id] : null;
        if (!n && !S.nodeTexts[id]) rec(false, "t.node: no node '" + id + "'");
        function line(k) {
          var m = S.nodeTexts[id];
          if (m && m[k] !== undefined) return m[k];
          var e = n && n[k];
          return e && typeof e.textContent === "string" ? e.textContent : "";
        }
        return { state: S.nodeStates[id] || "", text: { label: line("label"), sub: line("sub"), meta: line("meta") } };
      },
      stat: function (id) {
        var s = S.stats[String(id)];
        if (!s) { rec(false, "t.stat: no stat '" + id + "'"); return undefined; }
        var txt = s.valueEl.textContent;
        var trimmed = txt.trim();
        return trimmed !== "" && isFinite(Number(trimmed)) ? Number(trimmed) : txt;
      },
      logText: function () { return S.history.join("\n"); },
      expect: function (cond, msg) { rec(!!cond, msg === undefined ? "(no message)" : msg); },
      _drain: drain
    };
  }

  function run(id, opts) {
    opts = opts || {};
    var out = { id: String(id), passed: 0, failed: 0, results: [] };
    var finished = false;
    var inst = null;
    var timer = null;
    var limitMs = Math.max(1000, num(opts.timeoutMs, TEST_TIMEOUT_MS));

    function rec(ok, msg) {
      if (finished) return;
      out.results.push({ ok: !!ok, msg: String(msg) });
      if (ok) out.passed++; else out.failed++;
    }

    var main = load(id).then(function (def) {
      var doc = root.document;
      if (!doc || typeof doc.createElement !== "function") throw new Error("no document to mount the sim into");
      var box = doc.createElement("div");      // detached: never added to the page
      try {
        inst = createInstance(String(id), def, box, {
          startClock: opts.startClock, showClock: opts.showClock, seed: opts.seed, _loop: false, _test: true
        });
      } catch (e) {
        rec(false, "mount failed: " + errMsg(e));
        return undefined;
      }
      var t = harness(inst, rec);
      t._drain();
      if (typeof def.selfTest !== "function") {
        return t.run(1).then(function () {
          t._drain();
          rec(true, "no selfTest defined; mounted and ran 1s without errors");
        });
      }
      return Promise.resolve().then(function () { return def.selfTest(t); }).then(function () {
        t._drain();
        if (!out.results.length) rec(false, "selfTest made no expectations");
      }, function (e) {
        t._drain();
        rec(false, "selfTest threw: " + errMsg(e));
      });
    }).then(null, function (e) {
      rec(false, errMsg(e));
    });

    var guard = new Promise(function (resolve) {
      if (typeof root.setTimeout !== "function") return;
      timer = root.setTimeout(function () {
        rec(false, "selfTest did not finish within " + Math.round(limitMs / 1000) + "s");
        resolve();
      }, limitMs);
    });

    return Promise.race([main, guard]).then(function () {
      if (timer !== null && typeof root.clearTimeout === "function") root.clearTimeout(timer);
      finished = true;
      if (inst) { try { inst.destroy(); } catch (e) { /* nothing left to clean */ } }
      return { id: out.id, passed: out.passed, failed: out.failed, results: out.results.slice() };
    });
  }

  DL.simTest = { run: run };

  if (typeof module !== "undefined" && module.exports) module.exports = DL;
})(typeof window !== "undefined" ? window : globalThis);
