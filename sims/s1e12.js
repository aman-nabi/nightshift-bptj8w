/* sims/s1e12-v1.0.0.js  (published as sims/s1e12.js)
   Case s1e12 "The Voice on Line Two": a pipe between two call centers, with a length and a width.

   CHANGELOG
   v1.0.0 (2026-10-06) first version: a widget-style sim built inside api.root. An SVG pipe from
     Brightwater in Gannet Bay to the phone server in Halden whose length follows the distance
     (100 to 20,000 km of fiber) and whose width follows the bandwidth (1 Mbps to 10 Gbps), both on a
     log scale. Send a 1 KB message or the 1 GB backup: the slug shows how much of the time is the
     trip (latency) and how much is squeezing through (bandwidth), and a results table compares the
     two. traceroute lists every hop with three round-trip times, and calls out the big jumps.
     Controls: distance, bandwidth, direct (2,000 km), detour (18,000 km), send1kb, send1gb, trace,
     reset. Stats: time to first byte (ms), total time (s), throughput (Mbps). selfTest checks the
     story's numbers: 10.9 ms and 91.05 ms one way, the 1 KB message barely changing with ten times
     the bandwidth, the 1 GB backup taking 80 s or 8 s whatever the distance, 125 MB/s for 1 Gbps,
     and traceroute's 7 hops ending at 182.1 ms on the long way and 6 hops ending at 21.8 ms direct.

   Notes for anyone copying this file:
   - Widget-style sim with no diagram. setup rebuilds everything inside api.root on every reset.
   - The numbers are worked out the moment you press a button; the slug is a slowed-down picture
     of them. Each send animates for 2.5 real seconds whatever its real length, and the share of
     that time spent on the trip versus the squeeze matches the real share (with a visible minimum).
   - The model is deliberately ideal: light covers 200 km of fiber per millisecond, each hop adds
     0.15 ms each way, and there is no TCP, no queueing and no loss. The case's limits say so.
   - Round trips are worked out in hundredths of a millisecond as whole numbers, so 91.05 and
     182.1 come out exactly. Only api.rand() is random (the small spread in traceroute's probes).
*/
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";
  var BANDWIDTHS = [1, 10, 100, 1000, 10000];                 // Mbps
  var BW_LABELS = ["1 Mbps", "10 Mbps", "100 Mbps", "1 Gbps", "10 Gbps"];
  var MIN_KM = 100;
  var MAX_KM = 20000;
  var DIRECT_KM = 2000;                                        // the cut cable
  var DETOUR_KM = 18000;                                       // the long way through Port Calloway
  var DETOUR_OVER = 6000;                                      // longer than this, the path has a halfway exchange
  var MESSAGES = {
    kb: { bytes: 1000, label: "1 KB message" },
    gb: { bytes: 1e9, label: "1 GB backup" }
  };
  var ANIM = 2.5;                                              // real seconds per send picture
  var TRACE_STEP = 0.3;                                        // real seconds between traceroute rows
  var PIPE_X = 52;

  /* ---------- the model ---------- */

  function hopsFor(km) {
    var list = [
      { name: "office-router", km: 0 },
      { name: "gannetbay-isp", km: 12 },
      { name: "landing.gannetbay", km: 40 }
    ];
    if (km > DETOUR_OVER) list.push({ name: "exchange.portcalloway", km: km / 2 });
    list.push({ name: "landing.halden", km: km - 40 });
    list.push({ name: "office.halden", km: km - 4 });
    list.push({ name: "halden-phones", km: km });
    return list;
  }

  // One way, in ms: 200 km of fiber per millisecond, plus 0.15 ms per hop. Worked in hundredths.
  function oneWayMs(km) { return (km / 2 + 15 * hopsFor(km).length) / 100; }

  // Round trip to hop number i (1-based), in ms: 100 km per millisecond there and back, 0.3 ms per hop.
  function rttMs(hopKm, i) { return (hopKm + 30 * i) / 100; }

  function compute(km, mbps, bytes) {
    var oneWay = oneWayMs(km);
    var squeeze = bytes * 8 / (mbps * 1e6);
    var total = oneWay / 1000 + squeeze;
    return {
      oneWay: oneWay,
      squeeze: squeeze,
      total: total,
      throughput: bytes * 8 / total / 1e6,
      lengthShare: (oneWay / 1000) / total
    };
  }

  /* ---------- formatting ---------- */

  function commas(n) {
    var s = String(Math.round(n));
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return s + out;
  }
  function prec4(x) { return String(Number(x.toPrecision(4))); }
  function timeText(sec) {
    if (sec < 1) return (sec * 1000).toFixed(2) + " ms";
    if (sec < 120) return sec.toFixed(2) + " s";
    if (sec < 7200) return (sec / 60).toFixed(1) + " min";
    return (sec / 3600).toFixed(1) + " hours";
  }
  function rateText(mbps) {
    if (mbps >= 1000) return prec4(mbps / 1000) + " Gbps";
    return prec4(mbps) + " Mbps";
  }
  function bwText(mbps) { return mbps >= 1000 ? (mbps / 1000) + " Gbps" : mbps + " Mbps"; }
  function mbsText(mbps) { return prec4(mbps / 8) + " MB/s"; }
  function pct(x) { return (x * 100).toFixed(2) + "%"; }

  /* ---------- the widget ---------- */

  function svgEl(doc, tag, attrs) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    return e;
  }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text !== undefined && text !== null) e.textContent = text;
      return e;
    }
    var MONO = "font-family:var(--f-ui);";
    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;");

    var ends = el("div", MONO + "display:flex;justify-content:space-between;gap:10px;font-size:12px;color:var(--muted);flex-wrap:wrap;");
    ends.appendChild(el("span", null, "Brightwater, Gannet Bay"));
    ends.appendChild(el("span", "text-align:right;", "Phone server, Halden"));

    var svg = svgEl(doc, "svg", { viewBox: "0 0 620 120", width: "100%", role: "img", preserveAspectRatio: "xMinYMid meet" });
    svg.setAttribute("style", "display:block;max-height:150px;");
    var left = svgEl(doc, "rect", { x: 4, y: 36, width: 44, height: 48, rx: 6 });
    left.setAttribute("style", "fill:var(--surface-2);stroke:var(--line);stroke-width:1.5;");
    var pipe = svgEl(doc, "rect", { x: PIPE_X, y: 45, width: 200, height: 30, rx: 8 });
    pipe.setAttribute("style", "fill:var(--bg);stroke:var(--muted);stroke-width:1.5;");
    var slug = svgEl(doc, "rect", { x: PIPE_X, y: 47, width: 0, height: 26, rx: 3 });
    slug.setAttribute("style", "fill:var(--amber);opacity:.9;");
    var right = svgEl(doc, "rect", { x: 300, y: 36, width: 44, height: 48, rx: 6 });
    right.setAttribute("style", "fill:var(--surface-2);stroke:var(--line);stroke-width:1.5;");
    svg.appendChild(left);
    svg.appendChild(pipe);
    svg.appendChild(slug);
    svg.appendChild(right);

    var units = el("p", MONO + "margin:0;font-size:12px;color:var(--fg);", "");
    units.setAttribute("aria-live", "polite");

    var tableWrap = el("div", "overflow-x:auto;min-width:0;");
    var table = el("table", MONO + "width:100%;border-collapse:collapse;font-size:12px;");
    var head = el("tr", null);
    ["Sent", "Time to first byte", "Total time", "Throughput", "Where the time went"].forEach(function (h) {
      head.appendChild(el("th", "text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);color:var(--muted);font-weight:500;", h));
    });
    var thead = el("thead", null);
    thead.appendChild(head);
    var tbody = el("tbody", null);
    var rows = {};
    ["kb", "gb"].forEach(function (k) {
      var tr = el("tr", null);
      var cells = [];
      for (var i = 0; i < 5; i++) {
        var td = el("td", "padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top;white-space:pre-line;", i === 0 ? MESSAGES[k].label : (i === 1 ? "not sent yet" : ""));
        tr.appendChild(td);
        cells.push(td);
      }
      tbody.appendChild(tr);
      rows[k] = cells;
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    tableWrap.appendChild(table);

    var traceWrap = el("div", "min-width:0;");
    traceWrap.appendChild(el("p", MONO + "margin:0 0 4px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);", "traceroute halden-phones"));
    var traceScroll = el("div", "overflow-x:auto;min-width:0;");
    var traceTable = el("table", MONO + "border-collapse:collapse;font-size:12px;");
    var traceBody = el("tbody", null);
    traceTable.appendChild(traceBody);
    traceScroll.appendChild(traceTable);
    var traceNote = el("p", MONO + "margin:6px 0 0;font-size:12px;color:var(--muted);", "Press Run traceroute to list every hop and the round trip to each one.");
    traceNote.setAttribute("aria-live", "polite");
    traceWrap.appendChild(traceScroll);
    traceWrap.appendChild(traceNote);

    box.appendChild(ends);
    box.appendChild(svg);
    box.appendChild(units);
    box.appendChild(tableWrap);
    box.appendChild(traceWrap);
    api.root.appendChild(box);
    return { el: el, svg: svg, pipe: pipe, slug: slug, right: right, units: units, rows: rows, traceBody: traceBody, traceNote: traceNote };
  }

  function pipeLength(km) {
    var lo = Math.log(MIN_KM), hi = Math.log(MAX_KM);
    return 120 + (Math.log(Math.max(MIN_KM, km)) - lo) / (hi - lo) * 380;
  }
  function pipeWidth(idx) { return 6 + idx * 12; }

  function drawPipe(api) {
    var S = api.state;
    var L = pipeLength(S.km);
    var T = pipeWidth(S.bw);
    S.geo = { L: L, T: T };
    S.ui.pipe.setAttribute("y", String(60 - T / 2));
    S.ui.pipe.setAttribute("width", L.toFixed(1));
    S.ui.pipe.setAttribute("height", String(T));
    S.ui.pipe.setAttribute("rx", String(Math.min(T / 2, 8)));
    S.ui.right.setAttribute("x", (PIPE_X + L + 4).toFixed(1));
    S.ui.slug.setAttribute("y", String(60 - T / 2 + 2));
    S.ui.slug.setAttribute("height", String(Math.max(2, T - 4)));
    var mbps = BANDWIDTHS[S.bw];
    S.ui.units.textContent = "Length: " + commas(S.km) + " km of fiber, " + oneWayMs(S.km).toFixed(2) + " ms each way. " +
      "Width: " + bwText(mbps) + ", at most " + mbsText(mbps) + " (8 bits make a byte).";
    S.ui.svg.setAttribute("aria-label", "A pipe " + commas(S.km) + " km long and " + bwText(mbps) + " wide, from Gannet Bay to Halden.");
  }

  function placeSlug(api, tail, front) {
    var S = api.state;
    var L = S.geo.L;
    var x1 = PIPE_X + tail * L;
    var x2 = PIPE_X + front * L;
    if (x2 - x1 < 6) x1 = Math.max(PIPE_X, x2 - 6);
    S.ui.slug.setAttribute("x", x1.toFixed(1));
    S.ui.slug.setAttribute("width", Math.max(0, x2 - x1).toFixed(1));
  }

  /* ---------- actions ---------- */

  function narrate(api, text) {
    var S = api.state;
    S.pendingLog = text;
    if (S.logTimer) return;
    S.logTimer = api.after(0.6, function () {
      S.logTimer = null;
      api.log(S.pendingLog, "");
    });
  }

  function setDistance(api, v) {
    var S = api.state;
    var km = Math.max(MIN_KM, Math.min(MAX_KM, Math.round(Number(v) / 100) * 100));
    if (!(km > 0)) return;
    S.km = km;
    drawPipe(api);
    narrate(api, "The pipe is now " + commas(km) + " km long: " + oneWayMs(km).toFixed(2) + " ms each way, whatever its width.");
  }

  function setBandwidth(api, v) {
    var S = api.state;
    var i = Math.max(0, Math.min(BANDWIDTHS.length - 1, Math.round(Number(v))));
    S.bw = i;
    drawPipe(api);
    narrate(api, "The pipe is now " + bwText(BANDWIDTHS[i]) + " wide, at most " + mbsText(BANDWIDTHS[i]) + ". Its length hasn't changed.");
  }

  function jumpTo(api, km) {
    var S = api.state;
    S.ctl.distance.set(km);
    setDistance(api, km);
  }

  function send(api, kind) {
    var S = api.state;
    var m = MESSAGES[kind];
    var mbps = BANDWIDTHS[S.bw];
    var r = compute(S.km, mbps, m.bytes);
    S.last = { kind: kind, km: S.km, mbps: mbps, r: r };
    S.stat.ttfb(r.oneWay.toFixed(2));
    S.stat.total(prec4(r.total));
    S.stat.throughput(prec4(r.throughput));
    var cells = S.ui.rows[kind];
    cells[0].textContent = m.label + "\n" + commas(S.km) + " km, " + bwText(mbps);
    cells[1].textContent = r.oneWay.toFixed(2) + " ms";
    cells[2].textContent = timeText(r.total);
    cells[3].textContent = rateText(r.throughput) + "\n(" + mbsText(r.throughput) + ")";
    cells[4].textContent = "length " + pct(r.lengthShare) + "\nwidth " + pct(1 - r.lengthShare);
    S.anim = api.reducedMotion ? null : { t: 0, pf: Math.max(0.08, Math.min(1, r.lengthShare)) };
    if (!S.anim) placeSlug(api, 0, 1);
    var bound = r.lengthShare >= 0.5 ? "latency-bound: the length decided it" : "bandwidth-bound: the width decided it";
    api.log(m.label + " over " + commas(S.km) + " km at " + bwText(mbps) + ": first byte after " + r.oneWay.toFixed(2) +
      " ms, all of it in " + timeText(r.total) + ". " + pct(r.lengthShare) + " of the time was the trip, so it's " + bound + ".",
      r.lengthShare >= 0.5 ? "warn" : "ok");
  }

  function trace(api) {
    var S = api.state;
    var hops = hopsFor(S.km);
    var rows = hops.map(function (h, i) {
      var base = rttMs(h.km, i + 1);
      return { n: i + 1, name: h.name, base: base, probes: [base, base + api.rand() * 0.2, base + api.rand() * 0.2] };
    });
    S.lastTrace = rows;
    S.trace = { rows: rows, shown: 0, acc: TRACE_STEP };
    var B = S.ui.traceBody;
    while (B.firstChild) B.removeChild(B.firstChild);
    S.ui.traceNote.textContent = "Probing hop by hop...";
    api.log("traceroute to halden-phones over " + commas(S.km) + " km: probes with a time to live of 1, 2, 3 and up, three each.", "");
  }

  function traceRow(api, row) {
    var S = api.state;
    var el = S.ui.el;
    var tr = el("tr", null);
    var cells = [
      String(row.n),
      row.name,
      row.probes.map(function (p) { return p.toFixed(1) + " ms"; }).join("  ")
    ];
    cells.forEach(function (c, i) {
      tr.appendChild(el("td", "padding:3px 8px;white-space:nowrap;" + (i === 0 ? "text-align:right;color:var(--muted);" : ""), c));
    });
    S.ui.traceBody.appendChild(tr);
  }

  function traceDone(api) {
    var S = api.state;
    var rows = S.trace.rows;
    var jumps = [];
    for (var i = 1; i < rows.length; i++) {
      var d = rows[i].base - rows[i - 1].base;
      if (d >= 5) jumps.push("hop " + rows[i - 1].n + " to " + rows[i].n + " (+" + d.toFixed(1) + " ms)");
    }
    var last = rows[rows.length - 1];
    var text = rows.length + " hops. Round trip to the phone server: " + last.base.toFixed(1) + " ms. " +
      (jumps.length ? "Big " + (jumps.length > 1 ? "jumps: " : "jump: ") + jumps.join(", ") +
        ". Each big jump is a long stretch of fiber: about 100 km for every 1 ms of round trip." : "No big jumps: a short path.");
    S.ui.traceNote.textContent = text;
    api.log("traceroute finished. " + text, jumps.length ? "warn" : "ok");
    S.trace = null;
  }

  /* ---------- the module ---------- */

  DL.sims.define("s1e12", {
    startClock: 2 * 3600,            // 02:00, when line two usually rings
    speed: 1,                        // real time; the numbers themselves are worked out per send

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.km = DIRECT_KM;
      S.bw = 2;
      S.anim = null;
      S.trace = null;
      S.lastTrace = [];
      S.last = null;
      S.logTimer = null;
      S.pendingLog = "";
      S.ui = buildWidget(api);
      drawPipe(api);

      S.ctl = {};
      S.ctl.distance = api.control.range("distance", "Distance (km of fiber)", MIN_KM, MAX_KM, 100, DIRECT_KM,
        function (v) { setDistance(api, v); }, { format: function (v) { return commas(v) + " km"; } });
      S.ctl.bandwidth = api.control.range("bandwidth", "Bandwidth (width)", 0, BANDWIDTHS.length - 1, 1, 2,
        function (v) { setBandwidth(api, v); }, { format: function (v) { return BW_LABELS[Math.round(Number(v))] || ""; } });
      S.ctl.direct = api.control.button("direct", "The direct cable: 2,000 km", function () { jumpTo(api, DIRECT_KM); });
      S.ctl.detour = api.control.button("detour", "The long way: 18,000 km", function () { jumpTo(api, DETOUR_KM); });
      S.ctl.kb = api.control.button("send1kb", "Send a 1 KB message", function () { send(api, "kb"); }, { tone: "primary" });
      S.ctl.gb = api.control.button("send1gb", "Send the 1 GB backup", function () { send(api, "gb"); }, { tone: "primary" });
      S.ctl.trace = api.control.button("trace", "Run traceroute", function () { trace(api); }, { wide: true });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        ttfb: api.stat("ttfb", "time to first byte (ms)", ""),
        total: api.stat("total", "total time (s)", ""),
        throughput: api.stat("throughput", "throughput (Mbps)", "")
      };

      api.info("<strong>How to read the pipe.</strong> Its length grows with distance and its width with bandwidth, both on a log scale. The orange slug is what you sent, slowed down: a 1 KB message is a thin sliver that crosses the whole length, while the 1 GB backup fills the pipe and stays as long as the width makes it.");
      api.log("Before the cut. The direct cable to Halden: 2,000 km of fiber, and the office line is 100 Mbps.", "");
    },

    step: function (api, dt) {
      var S = api.state;
      if (!S.ui) return;
      if (S.anim) {
        S.anim.t += dt;
        var u = Math.min(1, S.anim.t / ANIM);
        var pf = S.anim.pf;
        var front = Math.min(1, u / pf);
        var tail = Math.max(0, (u - (1 - pf)) / pf);
        placeSlug(api, tail, front);
        if (u >= 1) {
          S.anim = null;
          placeSlug(api, 1, 1);
          S.ui.slug.setAttribute("width", "0");
        }
      }
      if (S.trace) {
        S.trace.acc += dt;
        while (S.trace && S.trace.acc >= TRACE_STEP && S.trace.shown < S.trace.rows.length) {
          S.trace.acc -= TRACE_STEP;
          traceRow(api, S.trace.rows[S.trace.shown]);
          S.trace.shown += 1;
          if (S.trace.shown >= S.trace.rows.length) traceDone(api);
        }
      }
    },

    selfTest: async function (t) {
      var S = t.api.state;
      function n(id) { return Number(t.stat(id)); }

      // 1. The story before the cut: 1 KB over 2,000 km at 100 Mbps.
      t.click("send1kb");
      t.expect(Math.abs(n("ttfb") - 10.9) < 0.005 && Math.abs(n("total") * 1000 - 10.98) < 0.005,
        "a 1 KB message over the direct 2,000 km cable arrives first after 10.90 ms and in full after 10.98 ms");

      // 2. Ten times the width barely changes a small message.
      var before = n("total");
      t.set("bandwidth", 3);
      t.click("send1kb");
      t.expect(Math.abs(n("total") - before) * 1000 < 0.1 && Math.abs(n("ttfb") - 10.9) < 0.005,
        "at 1 Gbps the same 1 KB message saves less than 0.1 ms, and its time to first byte doesn't move");

      // 3. The long way round: the length is what grew.
      t.click("detour");
      t.click("send1kb");
      t.expect(S.km === 18000 && Math.abs(n("ttfb") - 91.05) < 0.005 && n("throughput") < 0.1,
        "over the 18,000 km detour the first byte takes 91.05 ms, and a 1 KB message gets under 0.1 Mbps out of a 1 Gbps pipe");

      // 4. The 1 GB backup is bandwidth-bound: 8 s at 1 Gbps, 80 s at 100 Mbps.
      t.click("send1gb");
      var fast = n("total");
      t.set("bandwidth", 2);
      t.click("send1gb");
      var slow = n("total");
      t.expect(Math.abs(fast - 8.091) < 0.001 && Math.abs(slow - 80.09) < 0.001 && n("throughput") > 99.8,
        "the 1 GB backup takes 8.09 s at 1 Gbps and 80.09 s at 100 Mbps, close to the full width");

      // 5. For the backup, distance hardly matters.
      t.click("direct");
      t.click("send1gb");
      t.expect(Math.abs(n("total") - 80.01) < 0.001 && Math.abs(slow - n("total")) < 0.1,
        "at 100 Mbps the backup takes about 80 s whether the pipe is 2,000 km or 18,000 km long");

      // 6. traceroute on the long way: 7 hops, the jump at hop 4, 182.1 ms at the end.
      t.click("detour");
      t.click("trace");
      await t.run(3);
      var rows = S.lastTrace;
      t.expect(rows.length === 7 && S.ui.traceBody.children.length === 7 && Math.abs(rows[2].base - 1.3) < 1e-9 &&
        Math.abs(rows[3].base - 91.2) < 1e-9 && Math.abs(rows[6].base - 182.1) < 1e-9 &&
        S.ui.traceNote.textContent.indexOf("hop 3 to 4") >= 0,
        "traceroute on the detour shows 7 hops, a jump from 1.3 ms at hop 3 to 91.2 ms at hop 4, and 182.1 ms at the phone server");

      // 7. Direct: 6 hops ending at 21.8 ms, the old ping of about 22 ms.
      t.click("direct");
      t.click("trace");
      await t.run(3);
      rows = S.lastTrace;
      t.expect(rows.length === 6 && Math.abs(rows[5].base - 21.8) < 1e-9 && rows[5].probes.every(function (p) { return p >= rows[5].base; }),
        "on the direct cable traceroute shows 6 hops ending at 21.8 ms, and no probe comes back faster than the light allows");

      // 8. Bits and bytes.
      t.set("bandwidth", 3);
      t.expect(S.ui.units.textContent.indexOf("1 Gbps, at most 125 MB/s") >= 0,
        "1 Gbps is shown as at most 125 MB/s, because 8 bits make a byte");
    }
  });
})();
