/* sims/a3e09-v1.0.0.js  (published as sims/a3e09.js)
   Case a3e09 "Keeping It Fresh" (LATENT Season 3): an ingestion lab for the Gullstone Herald's
   archive assistant. No real model. Six stated documents from the content system (five articles
   and one investigations draft), with versions, access groups, chunks and stated scores for the
   question "background on Councillor Hedley Carnsew", and a stated stream of changes (create,
   edit, delete, embargo lifted) at stated times. The learner picks the moment, how the index is
   fed, how access is handled and who is asking, and reads what the index holds against the
   content system, which four chunks go to the model, and the freshness lag. Widget-style sim: it
   builds its own panel inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: four moments (Thu 18:00, Thu 22:30, Fri 03:10, Fri 06:10),
     four ways to feed the index (one-off load, nightly rebuild, change feed without deletes as
     now, change feed with deletes), five ways to handle access (none as now, a line in the system
     prompt, a separate index per desk, access groups filtered inside the search, the filter plus
     a check against the content system), two askers, and a button that delivers the 20:47 edit
     twice and then a late copy of version 1. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - Truth at time t: a document exists if it was created at or before t and not deleted at or
     before t; its version is the last one dated at or before t. Each version carries its access
     groups and its chunks.
   - One-off load: the index is the truth at Tue 2 Apr 2024 03:00, and nothing after.
   - Nightly rebuild: the index is the truth at the last 02:00 at or before t.
   - Change feed: each change reaches the index 90 seconds after it happens (the stated lag). As
     now, delete events are ignored; with deletes, they remove every chunk of the document.
     Upserts are keyed by document ID and version, so a repeat is harmless and an older version
     never overwrites a newer one.
   - Retrieval: every chunk in the index the asker may search, highest stated score first, top 4.
     Filter: keep chunks whose stored access groups share a group with the asker's. Separate index
     per desk: the newsroom desk's index holds chunks in newsroom; the investigations desk's holds
     chunks in newsroom or investigations, so each newsroom chunk is stored twice. Check again:
     after the top 4, drop any chunk whose document is gone from the content system or whose
     current groups the asker isn't in. The system prompt line changes no chunk.
   - Not allowed: a chunk sent whose document exists but whose current groups the asker isn't in.
     Deleted: a chunk sent whose document is gone. Stale: index chunks of an older version than
     the content system's. Missing: chunks of a live document the index doesn't hold at all.
   - Oldest change not yet in the index: t minus the time of the earliest change at or before t
     that the index doesn't reflect. The alert fires above 5 minutes.

   Where every number comes from (conventions rule 14; the case is
   content/latent/a3/a3e09-v1.0.0.json). Worked out from the model above and checked by selfTest.
   - Scores: art-1187 #1 0.91 and #2 0.84 (retracted, deleted Thu 17 Oct 2024 16:05);
     art-2290 #1 0.88 and #2 0.80 (corrected to v2 Thu 8 Oct 2026 20:47); inv-0912 #1 0.86 and
     #2 0.79 (draft created 18:12, investigations only, embargo lifted Fri 06:00 as v2, newsroom);
     art-0655 0.83; art-2418 0.77; art-1960 0.41.
   - Opening, Thu 18:00, as now: 7 chunks in the index, 5 in the content system, 2 deleted but
     still there. Sent: 1187#1, 2290#1, 1187#2, 0655#1. Oldest change: 721 d 1 h 55 min.
   - Thu 22:30, as now (the post): 9 chunks against 7. Sent: art-1187#1 v1 (0.91), art-2290#1 v2
     (0.88), inv-0912#1 v1 (0.86), art-1187#2 v1 (0.84): 2 deleted, 1 not allowed for the night
     desk. Oldest change not yet in the index: 721 d 6 h 25 min (the delete of 17 Oct 2024).
   - Change feed with deletes and the filter, night desk: art-2290#1 (0.88), art-0655#1 (0.83),
     art-2290#2 (0.80), art-2418#1 (0.77). Lag none.
   - As now plus the check: the filter's top 4 holds both art-1187 chunks; the check drops them,
     2 sent.
   - Separate index per desk, as now: 16 chunks stored, 7 of them twice; art-1187 still sent.
   - Nightly rebuild, Thu 22:30: 5 chunks, 2 stale (art-2290 v1, "chair"), 2 missing (the
     draft), oldest change 4 h 18 min (18:12). Fri 03:10, no filter: the draft's chunk is sent
     second to the night desk. Fri 06:10 with the filter: the draft is stale for 10 min and
     filtered out; the change feed has it as v2 at 06:01:30.
   - One-off load, Thu 22:30: 4 chunks, 5 missing, 2 deleted; sent ends with art-1960#1 (0.41).
*/
(function () {
  "use strict";

  function T(y, mo, d, h, mi) { return Date.UTC(y, mo - 1, d, h, mi) / 60000; }

  var LOAD = T(2024, 4, 2, 3, 0);
  var LAG = 1.5;
  var ALERT = 5;
  var TOPK = 4;
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var NEWS = ["newsroom"];
  var INV = ["investigations"];

  var DOCS = [
    { id: "art-0655", title: "Carnsew wins Harbour ward", deleted: null, versions: [
      { v: 1, at: T(2021, 5, 7, 9, 30), kind: "create", groups: NEWS, chunks: [
        { s: 0.83, text: "Hedley Carnsew won Harbour ward by 212 votes." }] }] },
    { id: "art-1960", title: "Lifeboat appeal passes its target", deleted: null, versions: [
      { v: 1, at: T(2023, 12, 5, 11, 0), kind: "create", groups: NEWS, chunks: [
        { s: 0.41, text: "The lifeboat appeal passed its target on Saturday." }] }] },
    { id: "art-1187", title: "Carnsew and the harbour car park", deleted: T(2024, 10, 17, 16, 5), versions: [
      { v: 1, at: T(2024, 3, 11, 8, 0), kind: "create", groups: NEWS, chunks: [
        { s: 0.91, text: "Two sources claim Councillor Carnsew took money from the car park contractor." },
        { s: 0.84, text: "Carnsew denies it and says his solicitor will reply." }] }] },
    { id: "art-2418", title: "Budget passes by one vote", deleted: null, versions: [
      { v: 1, at: T(2025, 3, 4, 22, 10), kind: "create", groups: NEWS, chunks: [
        { s: 0.77, text: "Councillor Carnsew's vote carried the harbour budget." }] }] },
    { id: "art-2290", title: "Carnsew joins the harbour board", deleted: null, versions: [
      { v: 1, at: T(2025, 5, 14, 7, 45), kind: "create", groups: NEWS, chunks: [
        { s: 0.88, text: "Carnsew was elected chair of the harbour board." },
        { s: 0.80, text: "He has represented Harbour ward since 2021." }] },
      { v: 2, at: T(2026, 10, 8, 20, 47), kind: "edit", groups: NEWS, chunks: [
        { s: 0.88, text: "Carnsew was elected vice-chair of the harbour board." },
        { s: 0.80, text: "He has represented Harbour ward since 2021." }] }] },
    { id: "inv-0912", title: "The dredging contract (draft, embargoed)", deleted: null, versions: [
      { v: 1, at: T(2026, 10, 8, 18, 12), kind: "create", groups: INV, chunks: [
        { s: 0.86, text: "Carnsew met the dredging firm's director on 3 September; the meeting is not in his register of interests." },
        { s: 0.79, text: "The council gave the firm the dredging contract on 24 September." }] },
      { v: 2, at: T(2026, 10, 9, 6, 0), kind: "embargo lifted", groups: NEWS, chunks: [
        { s: 0.86, text: "Carnsew met the dredging firm's director on 3 September; the meeting is not in his register of interests." },
        { s: 0.79, text: "The council gave the firm the dredging contract on 24 September." }] }] }
  ];

  var MOMENTS = [
    { value: "thu1800", label: "Thu 8 Oct 2026, 18:00 (before tonight's changes)", t: T(2026, 10, 8, 18, 0) },
    { value: "thu2230", label: "Thu 8 Oct 2026, 22:30 (the question)", t: T(2026, 10, 8, 22, 30) },
    { value: "fri0310", label: "Fri 9 Oct 2026, 03:10 (after the nightly rebuild)", t: T(2026, 10, 9, 3, 10) },
    { value: "fri0610", label: "Fri 9 Oct 2026, 06:10 (after the embargo lifts)", t: T(2026, 10, 9, 6, 10) }
  ];
  var INGEST = [
    { value: "nodel", label: "Change feed, creates and edits only (as now)" },
    { value: "feed", label: "Change feed with deletes" },
    { value: "nightly", label: "Nightly rebuild at 02:00" },
    { value: "load", label: "One-off load (2 Apr 2024)" }
  ];
  var ACCESS = [
    { value: "off", label: "No access check (as now)" },
    { value: "prompt", label: "A line in the system prompt" },
    { value: "desks", label: "A separate index per desk" },
    { value: "filter", label: "Access groups, filtered inside the search" },
    { value: "check", label: "Filter inside the search, then check again" }
  ];
  var ASKERS = [
    { value: "night", label: "Morvoren, night desk (newsroom)", groups: ["newsroom"] },
    { value: "inv", label: "Wylla, investigations (newsroom, investigations)", groups: ["newsroom", "investigations"] }
  ];

  /* ---------- helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return list[0];
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function when(t) {
    var d = new Date(t * 60000);
    var s = d.getUTCSeconds();
    return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear() +
      " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + (s ? ":" + pad(s) : "");
  }
  function span(m) {
    if (m === null) return "none";
    m = Math.round(m);
    var d = Math.floor(m / 1440);
    var h = Math.floor((m % 1440) / 60);
    var mi = m % 60;
    var out = [];
    if (d) out.push(d + " d");
    if (d || h) out.push(h + " h");
    out.push(mi + " min");
    return out.join(" ");
  }
  function share(a, b) {
    for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) >= 0) return true;
    return false;
  }
  function docById(id) {
    for (var i = 0; i < DOCS.length; i++) if (DOCS[i].id === id) return DOCS[i];
    return null;
  }

  /* ---------- the model ---------- */

  // The content system at time t: id -> version object.
  function truth(t) {
    var out = {};
    DOCS.forEach(function (d) {
      if (d.deleted !== null && d.deleted <= t) return;
      var cur = null;
      d.versions.forEach(function (v) { if (v.at <= t) cur = v; });
      if (cur) out[d.id] = cur;
    });
    return out;
  }

  function lastRebuild(t) {
    var day = Math.floor(t / 1440) * 1440 + 120;
    return day <= t ? day : day - 1440;
  }

  // Every change in the stream: create, edit, embargo lifted, delete.
  function changes() {
    var out = [];
    DOCS.forEach(function (d) {
      d.versions.forEach(function (v) { out.push({ id: d.id, at: v.at, kind: v.kind, v: v.v }); });
      if (d.deleted !== null) out.push({ id: d.id, at: d.deleted, kind: "delete", v: null });
    });
    out.sort(function (a, b) { return a.at - b.at; });
    return out;
  }
  var CHANGES = changes();

  function applied(c, mode, t) {
    if (mode === "load") return c.at <= LOAD;
    if (mode === "nightly") return c.at <= lastRebuild(t);
    if (mode === "nodel" && c.kind === "delete") return false;
    return c.at + LAG <= t;
  }

  // The index at time t: id -> version object it holds.
  function index(mode, t) {
    if (mode === "load") return truth(LOAD);
    if (mode === "nightly") return truth(lastRebuild(t));
    var out = {};
    CHANGES.forEach(function (c) {
      if (!applied(c, mode, t)) return;
      if (c.kind === "delete") { delete out[c.id]; return; }
      var held = out[c.id];
      if (held && held.v >= c.v) return;
      out[c.id] = docById(c.id).versions[c.v - 1];
    });
    return out;
  }

  function oldest(mode, t) {
    for (var i = 0; i < CHANGES.length; i++) {
      var c = CHANGES[i];
      if (c.at <= t && !applied(c, mode, t)) return t - c.at;
    }
    return null;
  }

  function evaluate(C) {
    var t = pick(MOMENTS, C.moment).t;
    var tr = truth(t);
    var ix = index(C.ingest, t);
    var groups = pick(ASKERS, C.asker).groups;
    var r = { t: t, tr: tr, ix: ix, chunks: 0, truth: 0, stale: 0, ghost: 0, missing: 0, dups: 0, sent: [], dropped: 0, notallowed: 0, deleted: 0 };
    var id;
    for (id in tr) if (tr.hasOwnProperty(id)) {
      r.truth += tr[id].chunks.length;
      if (!ix[id]) r.missing += tr[id].chunks.length;
    }
    var pool = [];
    for (id in ix) if (ix.hasOwnProperty(id)) {
      var ver = ix[id];
      var n = ver.chunks.length;
      r.chunks += n;
      if (!tr[id]) r.ghost += n;
      else if (tr[id].v !== ver.v) r.stale += n;
      if (C.access === "desks" && share(ver.groups, NEWS)) r.dups += n;
      ver.chunks.forEach(function (ch, k) { pool.push({ id: id, k: k + 1, v: ver.v, s: ch.s, text: ch.text, groups: ver.groups }); });
    }
    r.chunks += r.dups;
    var filtered = C.access === "desks" || C.access === "filter" || C.access === "check";
    var hits = pool.filter(function (c) { return !filtered || share(c.groups, groups); });
    hits.sort(function (a, b) { return (b.s - a.s) || (a.id < b.id ? -1 : 1) || (a.k - b.k); });
    hits = hits.slice(0, TOPK);
    if (C.access === "check") {
      var kept = hits.filter(function (c) { return tr[c.id] && share(tr[c.id].groups, groups); });
      r.dropped = hits.length - kept.length;
      hits = kept;
    }
    hits.forEach(function (c) {
      if (!tr[c.id]) r.deleted += 1;
      else if (!share(tr[c.id].groups, groups)) r.notallowed += 1;
    });
    r.sent = hits;
    r.lag = oldest(C.ingest, t);
    return r;
  }

  function label(c) { return c.id + "#" + c.k + " v" + c.v + " (" + c.s.toFixed(2) + ")"; }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;");
    var head = el("p", "margin:0;");
    var sentHead = el("p", "margin:0;font-weight:600;", "Sent to the model (top 4)");
    var sent = el("ol", "margin:0;padding-left:20px;");
    var table = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
    var tr = el("tr");
    ["document", "content system now", "index holds", "state"].forEach(function (h) { tr.appendChild(el("th", "text-align:left;padding:2px 4px;", h)); });
    var thead = el("thead");
    thead.appendChild(tr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    var wrap = el("div", "overflow-x:auto;");
    wrap.appendChild(table);
    box.appendChild(head);
    box.appendChild(sentHead);
    box.appendChild(sent);
    box.appendChild(wrap);
    api.root.appendChild(box);
    return { el: el, head: head, sent: sent, tbody: tbody };
  }

  function describe(ver) {
    if (!ver) return "-";
    return "v" + ver.v + ", " + ver.groups.join(" + ") + ", " + ver.chunks.length + (ver.chunks.length === 1 ? " chunk" : " chunks");
  }

  function draw(api, r) {
    var S = api.state;
    var ui = S.ui;
    var C = S.C;
    ui.head.textContent = when(r.t) + ". " + pick(INGEST, C.ingest).label + ". " + pick(ACCESS, C.access).label +
      ". Asking: " + pick(ASKERS, C.asker).label + ". Question: background on Councillor Hedley Carnsew.";
    while (ui.sent.firstChild) ui.sent.removeChild(ui.sent.firstChild);
    var groups = pick(ASKERS, C.asker).groups;
    if (!r.sent.length) ui.sent.appendChild(ui.el("li", "", "nothing"));
    r.sent.forEach(function (c) {
      var note = !r.tr[c.id] ? " DELETED from the content system" : (!share(r.tr[c.id].groups, groups) ? " NOT ALLOWED for this asker" : "");
      ui.sent.appendChild(ui.el("li", note ? "color:var(--bad, #b3261e);" : "", label(c) + ": " + c.text + note));
    });
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    DOCS.forEach(function (d) {
      var a = r.tr[d.id];
      var b = r.ix[d.id];
      if (!a && !b) return;
      var state = "current";
      if (!a) state = "deleted, still in the index";
      else if (!b) state = "missing from the index";
      else if (a.v !== b.v) state = "stale: index has v" + b.v + ", now v" + a.v;
      var row = ui.el("tr");
      [d.id + " " + d.title, a ? describe(a) : "deleted " + when(d.deleted), describe(b), state].forEach(function (x) {
        row.appendChild(ui.el("td", "padding:2px 4px;", x));
      });
      ui.tbody.appendChild(row);
    });
    S.stat.chunks(r.chunks);
    S.stat.truth(r.truth);
    S.stat.ghost(r.ghost);
    S.stat.stale(r.stale);
    S.stat.missing(r.missing);
    S.stat.dups(r.dups);
    S.stat.sent(r.sent.length ? r.sent.map(label).join(", ") : "nothing");
    S.stat.dropped(r.dropped);
    S.stat.notallowed(r.notallowed);
    S.stat.deleted(r.deleted);
    S.stat.lag(span(r.lag));
    S.stat.alert(r.lag !== null && r.lag > ALERT ? "on" : "off");
  }

  function run(api, what) {
    var S = api.state;
    var r = evaluate(S.C);
    S.last = r;
    var s = what + " Sent: " + (r.sent.length ? r.sent.map(label).join(", ") : "nothing") + ".";
    if (r.deleted) s += " " + r.deleted + " from a deleted document.";
    if (r.notallowed) s += " " + r.notallowed + " the asker may not see.";
    if (r.dropped) s += " The check dropped " + r.dropped + ".";
    if (S.C.access === "prompt") s += " The prompt line reaches the model with these same chunks; nothing in them says retracted or embargoed.";
    api.log(s, r.deleted || r.notallowed ? "bad" : "ok");
    draw(api, r);
  }

  /* ---------- the module ---------- */

  DL.sims.define("a3e09", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { moment: "thu1800", ingest: "nodel", access: "off", asker: "night" };
      S.ui = buildWidget(api);

      api.control.select("moment", "When", MOMENTS.map(function (m) { return { value: m.value, label: m.label }; }), "thu1800", function (v) {
        S.C.moment = pick(MOMENTS, v).value;
        run(api, "Time: " + when(pick(MOMENTS, v).t) + ".");
      });
      api.control.select("ingest", "How the index is fed", INGEST, "nodel", function (v) {
        S.C.ingest = pick(INGEST, v).value;
        run(api, "Index fed by: " + pick(INGEST, v).label + ".");
      });
      api.control.select("access", "Access", ACCESS, "off", function (v) {
        S.C.access = pick(ACCESS, v).value;
        run(api, "Access: " + pick(ACCESS, v).label + ".");
      });
      api.control.select("asker", "Who is asking", ASKERS.map(function (a) { return { value: a.value, label: a.label }; }), "night", function (v) {
        S.C.asker = pick(ASKERS, v).value;
        run(api, "Asking: " + pick(ASKERS, v).label + ".");
      });
      api.control.button("replay", "Deliver the 20:47 edit twice", function () {
        var r = evaluate(S.C);
        var held = r.ix["art-2290"];
        if (S.C.ingest !== "nodel" && S.C.ingest !== "feed") {
          api.log("Only the change feed delivers events; this index is loaded in bulk.", "");
          return;
        }
        if (!held || held.v < 2) {
          api.log("The 20:47 edit hasn't happened yet at " + when(r.t) + ".", "");
          return;
        }
        api.log("The 20:47 edit of art-2290 arrives a second time: the upsert is keyed by art-2290 and version 2, so it overwrites the same 2 chunks. Chunks in the index: " +
          r.chunks + " before, " + evaluate(S.C).chunks + " after. Then a late copy of version 1 arrives: version 1 is older than the stored version 2, so it is skipped.", "ok");
      });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        chunks: api.stat("chunks", "chunks in the index", ""),
        truth: api.stat("truth", "chunks in the content system", ""),
        ghost: api.stat("ghost", "deleted but still in the index", "bad"),
        stale: api.stat("stale", "stale chunks (older version)", "warn"),
        missing: api.stat("missing", "missing from the index", "warn"),
        dups: api.stat("dups", "chunks stored twice", ""),
        sent: api.stat("sent", "sent to the model", ""),
        dropped: api.stat("dropped", "dropped by the check", ""),
        notallowed: api.stat("notallowed", "sent, not allowed for the asker", "bad"),
        deleted: api.stat("deleted", "sent, from a deleted document", "bad"),
        lag: api.stat("lag", "oldest change not yet in the index", "warn"),
        alert: api.stat("alert", "lag alert (over 5 min)", "")
      };

      api.info("<strong>How to read it.</strong> The table compares each document in the content system with what the index holds for it. The list shows the four chunks the archive assistant would send to the model for the question about Councillor Carnsew, with their stated scores. Red lines are chunks from a deleted document or ones the asker may not see.");

      var r = evaluate(S.C);
      S.last = r;
      api.log("Thu 8 Oct 2026 18:00, as now: " + r.chunks + " chunks in the index, " + r.truth + " in the content system. Oldest change not yet in the index: " + span(r.lag) + ".", "");
      draw(api, r);
    },

    selfTest: async function (t) {
      function log(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: Thursday 18:00, as now, before tonight's changes.
      t.expect(t.stat("chunks") === 7 && t.stat("truth") === 5 && t.stat("ghost") === 2 && t.stat("stale") === 0 &&
        t.stat("missing") === 0 && t.stat("dups") === 0 &&
        t.stat("sent") === "art-1187#1 v1 (0.91), art-2290#1 v1 (0.88), art-1187#2 v1 (0.84), art-0655#1 v1 (0.83)" &&
        t.stat("deleted") === 2 && t.stat("notallowed") === 0 && t.stat("lag") === "721 d 1 h 55 min" && t.stat("alert") === "on" &&
        log("Thu 8 Oct 2026 18:00, as now: 7 chunks in the index, 5 in the content system."),
        "Opens Thu 18:00 as now: 7 chunks against 5, the two art-1187 chunks still there, oldest change 721 d 1 h 55 min");

      // 2. The question at 22:30: both leaks in the top 4.
      t.set("moment", "thu2230");
      t.expect(t.stat("sent") === "art-1187#1 v1 (0.91), art-2290#1 v2 (0.88), inv-0912#1 v1 (0.86), art-1187#2 v1 (0.84)" &&
        t.stat("deleted") === 2 && t.stat("notallowed") === 1 && t.stat("chunks") === 9 && t.stat("truth") === 7 &&
        t.stat("ghost") === 2 && t.stat("lag") === "721 d 6 h 25 min",
        "Thu 22:30 as now: the retracted article at ranks 1 and 4, the embargoed draft at rank 3, 9 chunks against 7");

      // 3. A line in the system prompt changes no chunk.
      t.set("access", "prompt");
      t.expect(t.stat("sent") === "art-1187#1 v1 (0.91), art-2290#1 v2 (0.88), inv-0912#1 v1 (0.86), art-1187#2 v1 (0.84)" &&
        log("nothing in them says retracted or embargoed"),
        "The prompt line: the same four chunks reach the model");

      // 4. Change feed with deletes, no access check: the ghost goes, the draft still leaks.
      t.set("access", "off");
      t.set("ingest", "feed");
      t.expect(t.stat("ghost") === 0 && t.stat("chunks") === 7 && t.stat("deleted") === 0 && t.stat("notallowed") === 1 &&
        t.stat("lag") === "none" && t.stat("alert") === "off",
        "Feed with deletes alone: art-1187 is gone, but the draft is still sent to the night desk");

      // 5. Add the filter: only what the night desk may see; the investigations desk sees the draft.
      t.set("access", "filter");
      var night = t.stat("sent");
      var na = t.stat("notallowed");
      t.set("asker", "inv");
      var inv = t.stat("sent");
      t.set("asker", "night");
      t.expect(night === "art-2290#1 v2 (0.88), art-0655#1 v1 (0.83), art-2290#2 v2 (0.80), art-2418#1 v1 (0.77)" && na === 0 &&
        inv === "art-2290#1 v2 (0.88), inv-0912#1 v1 (0.86), art-0655#1 v1 (0.83), art-2290#2 v2 (0.80)",
        "Feed with deletes and the filter: the night desk gets four allowed, current chunks; investigations gets its draft");

      // 6. As now plus the check: the check drops the ghost chunks after the fact.
      t.set("ingest", "nodel");
      t.set("access", "check");
      t.expect(t.stat("sent") === "art-2290#1 v2 (0.88), art-0655#1 v1 (0.83)" && t.stat("dropped") === 2 && t.stat("ghost") === 2,
        "As now with the check: both art-1187 chunks reach the top 4 and are dropped, so only 2 are sent");

      // 7. A separate index per desk: duplicates, and still no deletes.
      t.set("access", "desks");
      t.expect(t.stat("chunks") === 16 && t.stat("dups") === 7 && t.stat("deleted") === 2 && t.stat("notallowed") === 0,
        "Separate index per desk: 16 chunks stored, 7 twice, and the retracted article still sent");

      // 8. Nightly rebuild: stale at 22:30, the draft leaks after 02:00.
      t.set("access", "off");
      t.set("ingest", "nightly");
      var n22 = t.stat("chunks") === 5 && t.stat("stale") === 2 && t.stat("missing") === 2 && t.stat("ghost") === 0 &&
        t.stat("lag") === "4 h 18 min" && t.stat("alert") === "on" && t.stat("sent").indexOf("art-2290#1 v1 (0.88)") === 0;
      t.set("moment", "fri0310");
      t.expect(n22 && t.stat("sent") === "art-2290#1 v2 (0.88), inv-0912#1 v1 (0.86), art-0655#1 v1 (0.83), art-2290#2 v2 (0.80)" &&
        t.stat("notallowed") === 1 && t.stat("lag") === "none",
        "Nightly rebuild: 22:30 serves art-2290 v1 and lags 4 h 18 min; at 03:10 the draft is sent second to the night desk");

      // 9. After the embargo lifts: the rebuild's groups are 10 minutes old, the feed's are current.
      t.set("moment", "fri0610");
      t.set("access", "filter");
      var nf = t.stat("stale") === 2 && t.stat("lag") === "10 min" && t.stat("alert") === "on" && t.stat("sent").indexOf("inv-0912") < 0;
      t.set("ingest", "feed");
      t.expect(nf && t.stat("sent") === "art-2290#1 v2 (0.88), inv-0912#1 v2 (0.86), art-0655#1 v1 (0.83), art-2290#2 v2 (0.80)" &&
        t.stat("lag") === "none" && t.stat("stale") === 0,
        "Fri 06:10: the rebuild still holds the draft's old groups for 10 min; the feed has it as v2 for the newsroom");

      // 10. One-off load: frozen in April 2024.
      t.set("moment", "thu2230");
      t.set("access", "off");
      t.set("ingest", "load");
      t.expect(t.stat("chunks") === 4 && t.stat("missing") === 5 && t.stat("ghost") === 2 &&
        t.stat("sent") === "art-1187#1 v1 (0.91), art-1187#2 v1 (0.84), art-0655#1 v1 (0.83), art-1960#1 v1 (0.41)",
        "One-off load at 22:30: 4 chunks, 5 missing, and the lifeboat story fills rank 4");

      // 11. Idempotent upserts: a repeated edit changes nothing, a late older version is skipped.
      t.set("ingest", "feed");
      t.click("replay");
      t.expect(log("Chunks in the index: 7 before, 7 after.") && log("so it is skipped"),
        "Delivering the 20:47 edit twice leaves 7 chunks, and a late version 1 is skipped");
    }
  });
})();
