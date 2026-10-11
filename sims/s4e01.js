/* sims/s4e01-v1.0.0.js  (published as sims/s4e01.js)
   Case s4e01 "Three Ways to Ask": a pagination lab for the remote interpreting booth at the Corvallo
   Nickel arbitration. The booth console reads the hearing's speaker list from the Hearline platform,
   page by page, and maps each seat to a name. The learner picks offset or cursor paging, REST or
   GraphQL, the page size, a single load or a reload every 10 seconds, when the three late delegates
   register, how the platform reports a busy moment, and whether it is busy at all, then steps through
   the requests and reads who the console names at seat 14. Widget-style sim: it draws tables in
   api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: paging offset (newest first) or cursor (registration id,
     oldest first); REST (whole record) or GraphQL (id, name, seat); page size 10, 20, 100, 500
     (the platform returns at most 100); load once at 02:00:00 or the whole list every 10 s;
     late registrations between page 1 and page 2, before page 1, or after the load; errors as
     200 with the error inside (console retries in 30 s), 200 with the error inside (console takes
     it as the end), or 503 with Retry-After: 30 and a problem body; platform busy at 02:00:01 on
     or off. Five preset buttons. Stats: requests, errors seen, rows read, bytes, names seen twice,
     names never seen, seat 14 at 02:06, requests and bytes in the hour. selfTest: 12 assertions.

   The model (stated in sim.lede):
   - Delegates R-101 to R-127 registered before 02:00. R-1nn sits in seat nn - 100 (R-114 in seat
     14). R-114, Emeric Vidmar, left the room at 01:04; the platform does not record leaving.
   - Three late delegates: R-128 Femi Oyelaran (seat 28), R-129 Rozalia Rautenbach (seat 14, Vidmar's
     old seat), R-130 Sorin Ivanescu (seat 29). On the night they register at 02:00:12, 02:00:17,
     02:00:24. "Before" moves them to 01:59:12, :17, :24; "after" to 02:05:12, :17, :24.
   - Offset paging: GET /v1/speakers?offset=o&limit=n, newest registration first. Cursor paging:
     /v2/speakers?limit=n&after=<cursor>, oldest first by registration id; the cursor is opaque and
     stands for the last id read. The platform returns at most 100 rows. The console asks for the next
     page 1 s after a page, and stops when a page has fewer rows than it asked for.
   - Busy: any request at 02:00:01 fails. "retry": 200 OK with {"speakers":null,"error":"busy"}
     (32 bytes), the console finds no rows and asks again 30 s later. "problem": 503 with
     Retry-After: 30 and a problem body of 187 bytes; the console waits 30 s. "end": 200 with the
     error inside, and the console reads no rows as the end of the list. In 10 s mode a failed pass
     is dropped (or, in "end" mode, kept short) and the next pass starts 10 s after the last began.
   - Bytes received: 40 per page envelope, 240 per REST row, 64 per GraphQL row, error bodies above.
   - Seat map: for each seat, the newest registration (highest id) in the console's list with that
     seat. The truth at 02:06:00: the newest registration for the seat among those registered by then,
     leaving out R-114.
   - The microphone at seat 14 goes live at 02:06:00. The hour is 02:00:00 to 03:00:00.

   Where every number comes from (conventions rule 14; the case is content/s4/s4e01-v1.0.0.json):
   - The night: page 1 at 02:00:00, offset 0, 20 rows, R-127 to R-108, 40 + 20 x 240 = 4,840 bytes.
     Page 2 at 02:00:01: 200 with the error inside, 32 bytes. The list grows to 30 at 02:00:24. Page 2
     again at 02:00:31, offset 20: offsets 0 to 2 now hold R-130, R-129, R-128, so offset 20 is R-110;
     10 rows, R-110 to R-101, 2,440 bytes. 3 requests, 7,312 bytes, 30 rows, 27 names. Seen twice:
     R-110 Felix Coldicott, R-109 Anders Eskildsen, R-108 Joaquim Ilunga (offsets 17 to 19, then 20 to
     22). Never seen: R-128, R-129, R-130. Seat 14: newest in the list is R-114, Emeric Vidmar.
   - Cursor, v2 errors: page 1 R-101 to R-120 (4,840), 503 (187), page 2 after R-120 at 02:00:31:
     R-121 to R-130 (2,440). 3 requests, 7,467 bytes, 1 error seen, 30 names, none twice or missing.
     Seat 14: R-129, Rozalia Rautenbach.
   - GraphQL, offset: same rows as the night; 40 + 20 x 64 = 1,320, then 200 OK with
     {"data":null,"errors":[{"message":"busy"}]} (43 bytes; in GraphQL mode the busy answer is this 200 even
     when "503, Retry-After: 30" is chosen, as GraphQL over HTTP usually answers), then 40 + 10 x 64 = 680: 2,043 bytes.
   - 500 a page: one request at 02:00:00, 27 rows, 6,520 bytes, before the late three: 3 never seen,
     Vidmar at seat 14.
   - Every 10 s: 360 passes, 2 requests each, 720 requests in the hour (1 failed, at 02:00:01).
     Bytes: pass 1 4,872; 02:00:10 (27 rows) 6,560; 02:00:20 (29 rows) 7,040; 357 passes of 30 rows
     at 7,280: 2,617,432 bytes. Seat 14 at 02:06: Rautenbach.
   - "end" errors on the night: 2 requests, 20 rows; never seen R-101 to R-107 and the late three, 10.
*/
(function () {
  "use strict";

  var T0 = 7200;            // 02:00:00
  var SPEECH = 7560;        // 02:06:00
  var HOUR_END = 10800;     // 03:00:00
  var BUSY_AT = 7201;       // 02:00:01
  var CAP = 100;
  var ENV = 40;
  var ROW = { rest: 240, graphql: 64 };
  var ERR_V1 = 32;
  var ERR_PROBLEM = 187;
  var ERR_GQL = 43;
  var WAIT = 30;

  var NAMED = {
    108: "Joaquim Ilunga", 109: "Anders Eskildsen", 110: "Felix Coldicott", 114: "Emeric Vidmar",
    128: "Femi Oyelaran", 129: "Rozalia Rautenbach", 130: "Sorin Ivanescu"
  };
  var LATE = { 128: 28, 129: 14, 130: 29 };
  var LATE_AT = { between: [7212, 7217, 7224], before: [7152, 7157, 7164], after: [7512, 7517, 7524] };
  var LEFT = 114;

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function clock(t) {
    function p(x) { return (x < 10 ? "0" : "") + x; }
    return p(Math.floor(t / 3600)) + ":" + p(Math.floor(t / 60) % 60) + ":" + p(t % 60);
  }
  function rid(id) { return "R-" + id; }
  function nameOf(id) { return NAMED[id] || "delegate " + rid(id); }
  function full(id) { return NAMED[id] ? NAMED[id] + " (" + rid(id) + ")" : rid(id); }
  function cursorFor(id) { return "c" + (id * 7919).toString(36); }

  /* ---------- the model ---------- */

  function delegates(C) {
    var out = [];
    for (var id = 101; id <= 127; id++) out.push({ id: id, seat: id - 100, at: 0 });
    var times = LATE_AT[C.late];
    [128, 129, 130].forEach(function (id, k) { out.push({ id: id, seat: LATE[id], at: times[k] }); });
    return out;
  }
  function registeredBy(all, t) { return all.filter(function (d) { return d.at < t; }); }

  function path(C, off, cur) {
    var v = (C.paging === "cursor" || C.errors === "problem") ? "/v2" : "/v1";
    if (C.ask === "graphql") {
      return "POST /graphql speakers(" + (C.paging === "cursor" ? "first: " + C.size + (cur ? ", after: \"" + cursorFor(cur) + "\"" : "") :
        "offset: " + off + ", limit: " + C.size) + ") { id name seat }";
    }
    if (C.paging === "cursor") return "GET " + v + "/speakers?limit=" + C.size + (cur ? "&after=" + cursorFor(cur) : "");
    return "GET " + v + "/speakers?offset=" + off + "&limit=" + C.size;
  }

  // One pass through the list starting at time s. Returns its requests and the rows it read.
  function pass(C, all, s, polling) {
    var reqs = [];
    var rows = [];
    var t = s;
    var off = 0;
    var cur = 0;
    var eff = Math.min(C.size, CAP);
    var rowBytes = ROW[C.ask];
    for (var guard = 0; guard < 40; guard++) {
      var p = path(C, off, cur);
      var list = registeredBy(all, t);
      if (C.busy && t === BUSY_AT) {
        var problem = C.errors === "problem" && C.ask === "rest";
        reqs.push({ t: t, path: p, status: problem ? 503 : 200, n: 0, bytes: problem ? ERR_PROBLEM : (C.ask === "graphql" ? ERR_GQL : ERR_V1),
          err: true, gql: C.ask === "graphql", size: list.length });
        if (C.errors === "end") return { reqs: reqs, rows: rows, ok: true, end: t };
        if (polling) return { reqs: reqs, rows: rows, ok: false, end: t };
        t += WAIT;
        continue;
      }
      var page;
      if (C.paging === "cursor") {
        list.sort(function (a, b) { return a.id - b.id; });
        page = list.filter(function (d) { return d.id > cur; }).slice(0, eff);
      } else {
        list.sort(function (a, b) { return b.id - a.id; });
        page = list.slice(off, off + eff);
      }
      reqs.push({ t: t, path: p, status: 200, n: page.length, bytes: ENV + page.length * rowBytes, size: list.length, off: off,
        first: page.length ? page[0].id : 0, last: page.length ? page[page.length - 1].id : 0 });
      rows = rows.concat(page);
      if (page.length < C.size) return { reqs: reqs, rows: rows, ok: true, end: t };
      off += C.size;
      cur = page[page.length - 1].id;
      t += 1;
    }
    return { reqs: reqs, rows: rows, ok: true, end: t };
  }

  // The whole hour. Events up to 02:06:00 carry a snapshot for stepping.
  function simulate(C) {
    var all = delegates(C);
    var events = [];
    var listNow = null;
    var cnt = { req: 0, err: 0, rows: 0, bytes: 0 };
    var hour = { req: 0, bytes: 0 };
    function snap() { return { req: cnt.req, err: cnt.err, rows: cnt.rows, bytes: cnt.bytes, list: listNow }; }
    var starts = [];
    if (C.reload === "10s") for (var k = 0; k < 360; k++) starts.push(T0 + 10 * k); else starts.push(T0);
    var passes = starts.map(function (s) { return pass(C, all, s, C.reload === "10s"); });
    passes.forEach(function (ps) {
      ps.reqs.forEach(function (r) { hour.req += 1; hour.bytes += r.bytes; });
    });
    var timeline = [];
    all.forEach(function (d) { if (d.at) timeline.push({ t: d.at, kind: "reg", d: d }); });
    if (C.reload === "10s") {
      passes.forEach(function (ps, i) { if (ps.end < SPEECH) timeline.push({ t: starts[i], kind: "pass", ps: ps }); });
    } else {
      passes[0].reqs.forEach(function (r, i) { timeline.push({ t: r.t, kind: "req", r: r, ps: passes[0], last: i === passes[0].reqs.length - 1 }); });
    }
    timeline.push({ t: SPEECH, kind: "speech" });
    timeline.sort(function (a, b) { return a.t - b.t; });
    timeline.forEach(function (ev) {
      if (ev.kind === "req") {
        cnt.req += 1; cnt.bytes += ev.r.bytes; cnt.rows += ev.r.n;
        if (ev.r.status >= 400) cnt.err += 1;
        if (ev.last) listNow = ev.ps.rows;
      } else if (ev.kind === "pass") {
        ev.ps.reqs.forEach(function (r) {
          cnt.req += 1; cnt.bytes += r.bytes; cnt.rows += r.n;
          if (r.status >= 400) cnt.err += 1;
        });
        if (ev.ps.ok) listNow = ev.ps.rows;
      }
      ev.snap = snap();
      ev.registered = registeredBy(all, ev.t + 1).length;
      events.push(ev);
    });
    return { events: events, hour: hour, all: all };
  }

  function seatMap(rows) {
    var m = {};
    (rows || []).forEach(function (d) { if (!m[d.seat] || d.id > m[d.seat]) m[d.seat] = d.id; });
    return m;
  }
  function truthMap(all, t) {
    return seatMap(registeredBy(all, t + 1).filter(function (d) { return d.id !== LEFT; }));
  }
  function twice(rows) {
    var c = {};
    var out = [];
    (rows || []).forEach(function (d) { c[d.id] = (c[d.id] || 0) + 1; if (c[d.id] === 2) out.push(d.id); });
    return out;
  }
  function never(rows, all, t) {
    var have = {};
    (rows || []).forEach(function (d) { have[d.id] = true; });
    return registeredBy(all, t + 1).filter(function (d) { return !have[d.id]; }).map(function (d) { return d.id; });
  }
  function names(ids) { return ids.length ? ids.map(full).join(", ") : "none"; }

  /* ---------- log lines (each describes the state the step met) ---------- */

  function reqLine(r) {
    var s = r.path + " (list holds " + r.size + "): ";
    if (r.err && r.status === 503) return s + "503 Service Unavailable, Retry-After: 30, problem body, " + ERR_PROBLEM + " bytes.";
    if (r.err && r.gql) return s + "200 OK with {\"data\":null,\"errors\":[{\"message\":\"busy\"}]} inside, 0 rows, " + ERR_GQL + " bytes.";
    if (r.err) return s + "200 OK with {\"speakers\":null,\"error\":\"busy\"} inside, 0 rows, " + ERR_V1 + " bytes.";
    return s + "200 OK, " + r.n + " rows" + (r.n ? ", " + rid(r.first) + " to " + rid(r.last) : "") + ", " + fmt(r.bytes) + " bytes.";
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text !== undefined) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;");
    var head = el("p", "margin:0;");
    var last = el("p", "margin:0;font-family:monospace;overflow-wrap:anywhere;");
    var listP = el("p", "margin:0;overflow-wrap:anywhere;");
    var table = el("table", "width:100%;border-collapse:collapse;");
    var hr = el("tr");
    ["seat", "the console names", "really there at 02:06"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    [head, last, listP, table].forEach(function (e) { box.appendChild(e); });
    api.root.appendChild(box);
    return { el: el, head: head, last: last, listP: listP, tbody: tbody };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ev = S.k > 0 ? S.run.events[S.k - 1] : null;
    var sn = ev ? ev.snap : { req: 0, err: 0, rows: 0, bytes: 0, list: null };
    var t = ev ? ev.t : T0;
    var ui = S.ui;
    ui.head.textContent = (C.paging === "cursor" ? "Cursor on registration id" : "Offset, newest first") + ", " +
      (C.ask === "graphql" ? "GraphQL" : "REST") + ", " + C.size + " a page, " + (C.reload === "10s" ? "whole list every 10 s" : "loaded once") +
      ". Step " + S.k + " of " + S.run.events.length + ".";
    ui.last.textContent = ev ? clock(ev.t) + " " + ev.text : "Nothing asked yet. Next step, at " + clock(S.run.events[0].t) + ": " + S.run.events[0].text;
    var L = sn.list;
    ui.listP.textContent = L ? "The console's list: " + L.map(function (d) { return rid(d.id); }).join(" ") : "The console's list: empty.";
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    var cm = seatMap(L);
    var tm = truthMap(S.run.all, t);
    for (var seat = 1; seat <= 29; seat++) {
      if (!cm[seat] && !tm[seat]) continue;
      var bad = cm[seat] !== tm[seat];
      var tr = ui.el("tr", bad ? "font-weight:600;" : "");
      tr.appendChild(ui.el("td", "", String(seat)));
      tr.appendChild(ui.el("td", "", cm[seat] ? full(cm[seat]) : "nobody"));
      tr.appendChild(ui.el("td", "", tm[seat] ? full(tm[seat]) : "empty"));
      ui.tbody.appendChild(tr);
    }
    var loaded = !!L;
    S.stat.requests(sn.req);
    S.stat.errors(sn.err);
    S.stat.rows(sn.rows);
    S.stat.bytes(fmt(sn.bytes));
    S.stat.twice(loaded ? twice(L).length : "-");
    S.stat.never(loaded ? never(L, S.run.all, t).length : "-");
    S.stat.seat14(ev && ev.kind === "speech" ? (cm[14] ? nameOf(cm[14]) : "unknown") : "not yet");
    S.stat.hourReq(fmt(S.run.hour.req));
    S.stat.hourBytes(fmt(S.run.hour.bytes));
  }

  function describe(S) {
    var all = S.run.all;
    S.run.events.forEach(function (ev) {
      var at = "";
      if (ev.kind === "reg") {
        ev.text = at + full(ev.d.id) + " registers for seat " + ev.d.seat + ". The list held " + (ev.registered - 1) + ".";
      } else if (ev.kind === "req") {
        ev.text = at + reqLine(ev.r) + (ev.r.err ? (S.C.errors === "end" ? " The console takes no rows as the end of the list." : " The console asks again in 30 s.") : "");
        if (ev.last) {
          var L = ev.ps.rows;
          var tw = twice(L);
          var nv = never(L, all, ev.t);
          ev.text += " Loaded: " + L.length + " rows, " + (L.length - tw.length) + " names. Seen twice: " + names(tw) + ". Never seen: " + names(nv) + ".";
        }
      } else if (ev.kind === "pass") {
        ev.text = at + "Pass: " + ev.ps.reqs.length + " requests" + (ev.ps.ok ? ", " + ev.ps.rows.length + " rows." : ", failed; the console keeps its last list.");
      } else {
        var L2 = ev.snap.list;
        var m = seatMap(L2);
        var tr = truthMap(all, ev.t);
        ev.text = at + "Seat 14 microphone on. The console names " + (m[14] ? full(m[14]) + (m[14] === LEFT ? ", who left at 01:04" : "") : "nobody") +
          ". Really " + full(tr[14]) + ".";
      }
    });
  }

  function rebuild(api, why) {
    var S = api.state;
    S.run = simulate(S.C);
    describe(S);
    S.k = 0;
    api.clock = T0;
    if (why) api.log(why + " Back to 02:00:00, nothing asked yet.", "");
    draw(api);
  }

  function stepTo(api, k) {
    var S = api.state;
    while (S.k < k && S.k < S.run.events.length) {
      var ev = S.run.events[S.k];
      api.clock = ev.t;
      var tone = "";
      if (ev.kind === "speech") tone = ev.text.indexOf("left at 01:04") >= 0 ? "bad" : "ok";
      else if (ev.kind === "req" && ev.r.err) tone = "warn";
      api.log(ev.text, tone);
      S.k += 1;
    }
    draw(api);
  }

  var PRESETS = {
    night: { paging: "offset", ask: "rest", size: 20, reload: "once", late: "between", errors: "retry", busy: true },
    graphql: { paging: "offset", ask: "graphql", size: 20, reload: "once", late: "between", errors: "retry", busy: true },
    cursor: { paging: "cursor", ask: "rest", size: 20, reload: "once", late: "between", errors: "problem", busy: true },
    big: { paging: "offset", ask: "rest", size: 500, reload: "once", late: "between", errors: "retry", busy: true },
    poll: { paging: "offset", ask: "rest", size: 20, reload: "10s", late: "between", errors: "retry", busy: true }
  };

  DL.sims.define("s4e01", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      api.clock = T0;
      S.C = {};
      Object.keys(PRESETS.night).forEach(function (k) { S.C[k] = PRESETS.night[k]; });
      S.ui = buildWidget(api);
      S.ctl = {};
      function sel(id, label, opts, key, num) {
        S.ctl[key] = api.control.select(id, label, opts, S.C[key], function (v) {
          S.C[key] = num ? Number(v) : String(v);
          rebuild(api, label + ": " + v + ".");
        });
      }
      sel("paging", "Paging", [{ value: "offset", label: "Offset, newest first (as now)" }, { value: "cursor", label: "Cursor on registration id" }], "paging");
      sel("ask", "Ask with", [{ value: "rest", label: "REST, whole record" }, { value: "graphql", label: "GraphQL, id, name and seat" }], "ask");
      sel("size", "Page size", [10, 20, 100, 500].map(function (n) { return { value: n, label: String(n) }; }), "size", true);
      sel("reload", "Reload", [{ value: "once", label: "Once, at 02:00:00 (as now)" }, { value: "10s", label: "Whole list every 10 s" }], "reload");
      sel("late", "Late delegates register", [{ value: "between", label: "02:00:12, :17, :24 (the night)" },
        { value: "before", label: "01:59:12, :17, :24" }, { value: "after", label: "02:05:12, :17, :24" }], "late");
      sel("errors", "Busy answer", [{ value: "retry", label: "200 with error inside, retry in 30 s (as now)" },
        { value: "end", label: "200 with error inside, read as the end" }, { value: "problem", label: "503, Retry-After: 30, problem body" }], "errors");
      S.ctl.busy = api.control.toggle("busy", "Platform busy at 02:00:01", true, function (on) {
        S.C.busy = !!on;
        rebuild(api, "Platform busy at 02:00:01: " + (on ? "on." : "off."));
      });
      api.control.button("next", "Next step", function () { stepTo(api, S.k + 1); });
      api.control.button("run", "Run to 02:06", function () { stepTo(api, S.run.events.length); });
      function preset(id, label, key) {
        api.control.button(id, label, function () {
          var P = PRESETS[key];
          Object.keys(P).forEach(function (k) { S.C[k] = P[k]; if (S.ctl[k]) S.ctl[k].set(P[k]); });
          rebuild(api, "Preset: " + label + ".");
        });
      }
      preset("night", "As on the night", "night");
      preset("pgraphql", "Try: GraphQL, same paging", "graphql");
      preset("pcursor", "Try: cursor, v2, real errors", "cursor");
      preset("pbig", "Try: 500 a page", "big");
      preset("ppoll", "Try: whole list every 10 s", "poll");
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        requests: api.stat("requests", "requests so far", ""),
        errors: api.stat("errors", "errors monitoring saw (4xx, 5xx)", "warn"),
        rows: api.stat("rows", "rows read", ""),
        bytes: api.stat("bytes", "bytes received", ""),
        twice: api.stat("twice", "names seen twice", "bad"),
        never: api.stat("never", "names never seen", "bad"),
        seat14: api.stat("seat14", "seat 14 at 02:06, the console names", "bad"),
        hourReq: api.stat("hourReq", "requests in the hour, 02:00 to 03:00", ""),
        hourBytes: api.stat("hourBytes", "bytes in the hour", "")
      };
      api.info("<strong>How to read it.</strong> Each step is one request, one registration, or the seat 14 microphone at 02:06. The table maps each seat to the newest registration the console holds for it, next to who is really there; rows that differ are bold. Offset paging counts rows from the top of a list that grows at the top. A cursor marks the last registration read.");
      S.run = simulate(S.C);
      describe(S);
      S.k = 0;
      api.log("The afternoon session opens with 27 delegates registered. The console has not asked yet.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: 02:00:00, nothing asked.
      t.expect(t.stat("requests") === 0 && t.stat("bytes") === 0 && t.stat("twice") === "-" && t.stat("seat14") === "not yet" &&
        has("The afternoon session opens with 27 delegates registered."), "Opens at 02:00:00 with 27 registered and nothing asked");

      // 2. Page 1 and the busy page 2.
      t.click("next");
      var p1 = has("GET /v1/speakers?offset=0&limit=20 (list holds 27): 200 OK, 20 rows, R-127 to R-108, 4,840 bytes.") && t.stat("requests") === 1;
      t.click("next");
      t.expect(p1 && has("GET /v1/speakers?offset=20&limit=20 (list holds 27): 200 OK with {\"speakers\":null,\"error\":\"busy\"} inside, 0 rows, 32 bytes. The console asks again in 30 s.") &&
        t.stat("errors") === 0, "Page 1 is R-127 to R-108; page 2 at 02:00:01 is a 200 with the error inside, and monitoring sees no error");

      // 3. The late three, then page 2 again at offset 20.
      t.click("next"); t.click("next"); t.click("next");
      t.expect(has("Rozalia Rautenbach (R-129) registers for seat 14. The list held 28."), "R-129 takes seat 14 at 02:00:17");
      t.click("next");
      t.expect(has("GET /v1/speakers?offset=20&limit=20 (list holds 30): 200 OK, 10 rows, R-110 to R-101, 2,440 bytes.") &&
        has("Loaded: 30 rows, 27 names. Seen twice: Felix Coldicott (R-110), Anders Eskildsen (R-109), Joaquim Ilunga (R-108). Never seen: Femi Oyelaran (R-128), Rozalia Rautenbach (R-129), Sorin Ivanescu (R-130).") &&
        t.stat("twice") === 3 && t.stat("never") === 3 && t.stat("requests") === 3 && t.stat("bytes") === "7,312",
        "Page 2 at 02:00:31 starts at R-110: three names twice, three never seen, 3 requests, 7,312 bytes");

      // 4. The microphone.
      t.click("run");
      t.expect(t.stat("seat14") === "Emeric Vidmar" && has("Seat 14 microphone on. The console names Emeric Vidmar (R-114), who left at 01:04. Really Rozalia Rautenbach (R-129)."),
        "At 02:06 the console names Emeric Vidmar, who left at 01:04, for Rozalia Rautenbach");

      // 5. Cursor, v2, real errors.
      t.click("pcursor"); t.click("run");
      t.expect(t.stat("twice") === 0 && t.stat("never") === 0 && t.stat("seat14") === "Rozalia Rautenbach" && t.stat("errors") === 1 &&
        t.stat("requests") === 3 && t.stat("bytes") === "7,467" && has("503 Service Unavailable, Retry-After: 30, problem body, 187 bytes."),
        "Cursor on registration id with a 503: 30 names, none twice or missing, Rautenbach at seat 14, 7,467 bytes, 1 error seen");

      // 6. GraphQL with the same paging.
      t.click("pgraphql"); t.click("run");
      t.expect(t.stat("twice") === 3 && t.stat("never") === 3 && t.stat("seat14") === "Emeric Vidmar" && t.stat("bytes") === "2,043",
        "GraphQL, offset paging: 2,043 bytes instead of 7,312, the same 3 twice and 3 never seen, Vidmar at seat 14");

      // 7. 500 a page.
      t.click("pbig"); t.click("run");
      t.expect(t.stat("requests") === 1 && t.stat("twice") === 0 && t.stat("never") === 3 && t.stat("seat14") === "Emeric Vidmar" && t.stat("bytes") === "6,520",
        "500 a page: one request of 27 rows before the late three register; Vidmar at seat 14");

      // 8. The whole list every 10 s.
      t.click("ppoll"); t.click("run");
      t.expect(t.stat("seat14") === "Rozalia Rautenbach" && t.stat("hourReq") === 720 && t.stat("hourBytes") === "2,617,432",
        "Every 10 s: right at 02:06, at 720 requests and 2,617,432 bytes in the hour");

      // 9. A client that reads the error as the end of the list.
      t.click("night"); t.set("errors", "end"); t.click("run");
      t.expect(t.stat("requests") === 2 && t.stat("rows") === 20 && t.stat("never") === 10,
        "Read as the end: 2 requests, 20 rows, 10 delegates never seen");

      // 10. Inserts before page 1: offset paging works by luck.
      t.click("night"); t.set("late", "before"); t.click("run");
      t.expect(t.stat("twice") === 0 && t.stat("never") === 0 && t.stat("seat14") === "Rozalia Rautenbach",
        "Late three before page 1: nothing shifts, Rautenbach at seat 14");

      // 11. A cursor only finds what exists before it reaches the end.
      t.click("pcursor"); t.set("late", "after"); t.click("run");
      t.expect(t.stat("never") === 3 && t.stat("seat14") === "Emeric Vidmar",
        "Cursor, late three at 02:05: the load ended at 02:00:31, so 3 never seen until the console asks again");
    }
  });
})();
