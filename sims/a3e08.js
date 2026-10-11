/* sims/a3e08-v1.0.0.js  (published as sims/a3e08.js)
   Case a3e08 "Threads Between Names": a graph lab over a stated sample of 10 Ashlock records and
   the graph pulled from them (22 relationships, each with its source record; 14 entities merged
   by name, 15 checked). No live extraction, no real model.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: merge by name or check dates and places; fact, connection
     and whole-collection questions; chunks (top 3 or 8), graph, or by hand; path, sources, one
     community summary, model calls. selfTest: 10 assertions.

   The model (stated in sim.lede):
   - One chunk per record, each with a stated stand-in similarity to each question; chunk mode
     sends the top k.
   - Merge by name: same first initial and surname, one node. Check: a mention joins a person only
     if the place matches and the year is inside that person's known life. No model call.
   - Graph path: breadth-first search from the fire to the petition, relationships in list order.
   - Chunk stand-in: joins two sent records only when they name the same thing (people by first
     initial and surname), fewest joins first.
   - Graph fact answer: the fire's alarm relationship and the person node, with all its records.
   - Whole collection: the four threads are the checked graph's four communities. The graph reads
     every community summary: one call each, plus one to combine.
   - Indexing calls: one extraction per chunk, one summary per entity and per pair of entities
     described by more than one record, one report per community. By hand: 6 minutes a record.

   Where every number comes from (conventions rule 14; the case is
   content/latent/a3/a3e08-v1.0.0.json). All are worked out from the data below and checked by the
   selfTest.
   - The false thread (merge by name): fence petition -> E. Tallentire (R1, moved to decline it)
     -> chapel fire (R8, raised the alarm): 2 hops, sources R1, R8. One Tallentire node, built from
     4 records: R1 (1894), R6 (died 1921, aged 60), R7 (1953, aged 22), R8 (1954). R1 and R8 are
     60 years apart. 14 entities, 22 relationships, 3 communities.
   - Checked with dates and places: two Tallentires (1861 to 1921, Tanpit Lane; born 1931, Tenter
     Row). 15 entities, 4 communities. Path: fence petition -> Long Pond (R1) -> plot 4 (R4) ->
     gas pipe (R9) -> chapel fire (R9): 4 hops, sources R1, R4, R9.
   - Indexing the sample: 10 extraction calls. Merged: 10 entity summaries + 2 pair summaries
     (chapel and plot 4; Tallentire and Tanpit Lane) + 3 community reports = 25. Checked:
     10 + 11 + 2 + 4 = 27. Chunks: 0 model calls (10 embeddings).
   - Full collection: 4,960 records cut into 7,480 chunks: 7,480 extraction calls; by hand
     4,960 x 6 min = 29,760 min = 496 h. Sample by hand: 10 x 6 = 60 min.
   - Connection, chunks: top 3 = R8, R1, R2; top 8 adds R9, R10, R4, R3, R5. Either way the
     fewest joins is R1 -> R8 on the name E. Tallentire: the same false thread.
   - Fact, chunks top 3: R8 first: night of 15 March 1954, alarm at 02:10 by E. Tallentire of
     Tenter Row. Graph, merged: the person node says died 1921: wrong person. Graph, checked: the
     Tenter Row man, born 1931.
   - Whole collection: chunks top 3 = R2, R9, R1: 2 of 4 threads; top 8 misses R5 and R7: 3 of 4
     (no Tenter Row). Graph, checked: 4 of 4, 5 calls. Graph, merged: 3 threads, one of them the
     false man, 4 calls.
*/
(function () {
  "use strict";

  /* ---------- the stated data ---------- */

  var FULL_RECORDS = 4960;
  var FULL_CHUNKS = 7480;
  var MIN_PER_RECORD = 6;

  // sim: stand-in similarity to the fact (f), connection (c) and whole-collection (g) questions.
  var REC = [
    { id: "R1", what: "Council minutes, 3 Sep 1894", text: "Petition to fence Long Pond declined; moved by Cllr E. Tallentire, tanner, of Tanpit Lane.", f: 0.22, c: 0.81, g: 0.66 },
    { id: "R2", what: "Courier clipping, 8 Sep 1894", text: "Pond Cottages families angry: no fence for Long Pond.", f: 0.20, c: 0.74, g: 0.71 },
    { id: "R3", what: "Council minutes, 2 Jun 1897", text: "Long Pond to be filled with tannery spoil and laid out as Kiln Street.", f: 0.35, c: 0.47, g: 0.60 },
    { id: "R4", what: "Planning file, 11 Mar 1901", text: "Wesleyan chapel approved on Kiln Street, plot 4, the old Long Pond.", f: 0.58, c: 0.50, g: 0.52 },
    { id: "R5", what: "Courier clipping, 6 Oct 1902", text: "The new chapel on Kiln Street opens.", f: 0.66, c: 0.44, g: 0.41 },
    { id: "R6", what: "Courier clipping, 19 Jan 1921", text: "Death of Mr Ezekiel Tallentire, tanner, of Tanpit Lane, aged 60.", f: 0.30, c: 0.28, g: 0.48 },
    { id: "R7", what: "Planning file, 4 May 1953", text: "Ezekiel Tallentire, aged 22, of Tenter Row, applies to open a cycle repair shop.", f: 0.40, c: 0.31, g: 0.37 },
    { id: "R8", what: "Courier clipping, 16 Mar 1954", text: "Kiln Street chapel burns on the night of 15 March. Alarm raised at 02:10 by Mr E. Tallentire, of Tenter Row. The chapel was empty; no one was hurt.", f: 0.91, c: 0.84, g: 0.62 },
    { id: "R9", what: "Council minutes, 7 Apr 1954", text: "Inquiry: the old pond ground under plot 4 settled and cracked the gas pipe beneath the chapel floor.", f: 0.78, c: 0.69, g: 0.69 },
    { id: "R10", what: "Planning file, 2 Feb 1955", text: "Rebuilding the chapel on plot 4 refused: unstable ground, former pond.", f: 0.61, c: 0.52, g: 0.55 }
  ];

  var ENT = {
    petition: "Fence petition, 1894",
    families: "Pond Cottages families",
    council: "Ashlock council",
    tanpit: "Tanpit Lane",
    pond: "Long Pond",
    tannery: "Tallentire's tannery",
    kiln: "Kiln Street",
    plot4: "Plot 4, Kiln Street",
    chapel: "Wesleyan chapel",
    pipe: "Gas pipe",
    fire: "Chapel fire, 1954",
    tenter: "Tenter Row",
    shop: "Cycle repair shop"
  };

  // Person mentions: the name as written, the place, the record's year, and what the record adds.
  var MENTIONS = [
    { id: "m1", rec: "R1", name: "E. Tallentire", place: "Tanpit Lane", year: 1894, note: "tanner and councillor" },
    { id: "m2", rec: "R6", name: "Ezekiel Tallentire", place: "Tanpit Lane", year: 1921, died: 1921, born: 1861, note: "died 1921, aged 60" },
    { id: "m3", rec: "R7", name: "Ezekiel Tallentire", place: "Tenter Row", year: 1953, born: 1931, note: "aged 22 in 1953" },
    { id: "m4", rec: "R8", name: "E. Tallentire", place: "Tenter Row", year: 1954, note: "raised the alarm" }
  ];

  // Relationships, in the order the search reads them. Each has its source record.
  var REL = [
    ["pipe", "fire", "cracked and fed", "R9"],
    ["fire", "chapel", "destroyed", "R8"],
    ["m4", "fire", "raised the alarm", "R8"],
    ["plot4", "pipe", "settled and cracked", "R9"],
    ["m1", "petition", "moved to decline", "R1"],
    ["council", "petition", "declined", "R1"],
    ["petition", "pond", "asked to fence", "R1"],
    ["m1", "tanpit", "lived on", "R1"],
    ["families", "petition", "signed", "R2"],
    ["council", "pond", "ordered filled in", "R3"],
    ["tannery", "pond", "spoil filled", "R3"],
    ["pond", "kiln", "laid out as", "R3"],
    ["plot4", "kiln", "a plot on", "R4"],
    ["plot4", "pond", "stands on the old", "R4"],
    ["chapel", "plot4", "built on", "R4"],
    ["chapel", "kiln", "opened on", "R5"],
    ["m2", "tannery", "owned", "R6"],
    ["m2", "tanpit", "lived on", "R6"],
    ["m3", "tenter", "lived on", "R7"],
    ["m3", "shop", "applied to open", "R7"],
    ["shop", "tenter", "on", "R7"],
    ["chapel", "plot4", "rebuild refused on", "R10"]
  ];

  // Communities, as the indexer's clustering grouped them. Thread of each record for the
  // whole-collection question.
  var COMM_CHECKED = [
    { id: "petition", title: "The 1894 petition", members: ["P1", "families", "council", "petition", "tanpit"],
      summary: "In September 1894 the Pond Cottages families petitioned Ashlock council to fence Long Pond. Councillor Ezekiel Tallentire (1861 to 1921), a tanner of Tanpit Lane, moved to decline it, and the council did. He owned the tannery and died in 1921." },
    { id: "pond", title: "Long Pond to Kiln Street", members: ["pond", "tannery", "kiln", "plot4"],
      summary: "In 1897 the council had Long Pond filled with tannery spoil and laid out as Kiln Street. Plot 4 stands on the old pond." },
    { id: "chapel", title: "The chapel and its fire", members: ["chapel", "fire", "pipe"],
      summary: "The Wesleyan chapel was built on plot 4 and opened in 1902. It burned on the night of 15 March 1954; the inquiry found the old pond ground had settled and cracked a gas pipe beneath it. A rebuild was refused in 1955." },
    { id: "tenter", title: "Tenter Row, 1950s", members: ["P2", "tenter", "shop"],
      summary: "Ezekiel Tallentire (born 1931), of Tenter Row, applied in 1953 to open a cycle repair shop, and in 1954 raised the alarm at the chapel fire." }
  ];
  var COMM_MERGED = [
    { id: "petition", title: "E. Tallentire (merged)", members: ["P1", "families", "council", "petition", "tanpit", "tenter", "shop"],
      summary: "E. Tallentire, tanner and councillor of Tanpit Lane, moved to decline the 1894 fence petition, died in 1921 aged 60, applied for a cycle repair shop on Tenter Row in 1953 and raised the alarm at the 1954 chapel fire: one man joins the pond and the fire." },
    COMM_CHECKED[1],
    COMM_CHECKED[2]
  ];
  var THREAD_OF = { R1: "petition", R2: "petition", R3: "pond", R4: "pond", R5: "chapel", R6: "petition", R7: "tenter", R8: "chapel", R9: "chapel", R10: "pond" };

  var QUESTIONS = [
    { value: "fact", label: "Fact: on what night did the chapel burn, and who raised the alarm?" },
    { value: "conn", label: "Connection: what links the 1894 fence petition to the 1954 chapel fire?" },
    { value: "global", label: "Whole collection: what are the main threads in these records?" }
  ];
  var MODES = [
    { value: "chunks", label: "Chunks (top k by similarity)" },
    { value: "graph", label: "The graph" },
    { value: "hand", label: "By hand (read every record)" }
  ];
  var MERGES = [
    { value: "name", label: "Merge by name (as indexed)" },
    { value: "check", label: "Check dates and places before merging" }
  ];

  /* ---------- helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function recById(id) { for (var i = 0; i < REC.length; i++) if (REC[i].id === id) return REC[i]; return null; }
  function nameKey(n) { var p = n.split(" "); return p[0].charAt(0) + ". " + p[p.length - 1]; }
  function uniq(a) { var o = []; a.forEach(function (x) { if (o.indexOf(x) < 0) o.push(x); }); return o; }
  function recSort(a) { return a.slice().sort(function (x, y) { return Number(x.slice(1)) - Number(y.slice(1)); }); }

  /* ---------- the model ---------- */

  // Which person node each mention belongs to.
  function resolve(merge) {
    var people = [];
    var of = {};
    MENTIONS.forEach(function (m) {
      var hit = null;
      for (var i = 0; i < people.length; i++) {
        var p = people[i];
        if (merge === "name") { if (p.key === nameKey(m.name)) { hit = p; break; } continue; }
        var inLife = (p.born === undefined || m.year >= p.born) && (p.died === undefined || m.year <= p.died);
        if (p.key === nameKey(m.name) && p.place === m.place && inLife) { hit = p; break; }
      }
      if (!hit) { hit = { id: "P" + (people.length + 1), key: nameKey(m.name), place: m.place, mentions: [] }; people.push(hit); }
      hit.mentions.push(m);
      if (m.born !== undefined) hit.born = m.born;
      if (m.died !== undefined) hit.died = m.died;
      of[m.id] = hit.id;
    });
    return { people: people, of: of };
  }

  function buildGraph(merge) {
    var r = resolve(merge);
    var nodeOf = function (x) { return r.of[x] || x; };
    var edges = REL.map(function (e) { return { a: nodeOf(e[0]), b: nodeOf(e[1]), label: e[2], rec: e[3] }; });
    var recsOf = {};
    edges.forEach(function (e) {
      [e.a, e.b].forEach(function (n) { recsOf[n] = recsOf[n] || []; if (recsOf[n].indexOf(e.rec) < 0) recsOf[n].push(e.rec); });
    });
    var nodes = Object.keys(recsOf);
    var pairs = {};
    edges.forEach(function (e) { var k = [e.a, e.b].sort().join("|"); pairs[k] = (pairs[k] || 0) + 1; });
    var entitySummaries = nodes.filter(function (n) { return recsOf[n].length > 1; }).length;
    var pairSummaries = Object.keys(pairs).filter(function (k) { return pairs[k] > 1; }).length;
    var comms = merge === "name" ? COMM_MERGED : COMM_CHECKED;
    return {
      merge: merge, people: r.people, edges: edges, nodes: nodes, recsOf: recsOf, comms: comms,
      entitySummaries: entitySummaries, pairSummaries: pairSummaries,
      indexCalls: REC.length + entitySummaries + pairSummaries + comms.length
    };
  }

  function label(G, n) {
    for (var i = 0; i < G.people.length; i++) {
      var p = G.people[i];
      if (p.id === n) {
        if (G.people.length === 1) return "E. Tallentire";
        return "Ezekiel Tallentire (" + (p.died ? p.born + " to " + p.died : "born " + p.born) + ")";
      }
    }
    return ENT[n];
  }

  // Breadth-first search from the fire to the petition; relationships read in list order.
  function graphPath(G, from, to) {
    var prev = {};
    prev[from] = null;
    var q = [from];
    while (q.length) {
      var n = q.shift();
      if (n === to) break;
      for (var i = 0; i < G.edges.length; i++) {
        var e = G.edges[i];
        var m = e.a === n ? e.b : (e.b === n ? e.a : null);
        if (m === null || prev.hasOwnProperty(m)) continue;
        prev[m] = { node: n, edge: e };
        q.push(m);
      }
    }
    if (!prev.hasOwnProperty(to)) return null;
    var hops = [];
    var cur = to;
    while (prev[cur]) { hops.push({ from: cur, to: prev[cur].node, edge: prev[cur].edge }); cur = prev[cur].node; }
    return hops; // reads from the petition towards the fire
  }

  function topK(q, k) {
    return REC.slice().sort(function (a, b) { return b[q] - a[q]; }).slice(0, k).map(function (r) { return r.id; });
  }

  // What each record names, people by first initial and surname (the chunk stand-in reads names).
  function namesIn(rid) {
    var out = [];
    REL.forEach(function (e) {
      if (e[3] !== rid) return;
      [e[0], e[1]].forEach(function (x) {
        var m = null;
        MENTIONS.forEach(function (mm) { if (mm.id === x) m = mm; });
        var nm = m ? nameKey(m.name) : ENT[x];
        if (out.indexOf(nm) < 0) out.push(nm);
      });
    });
    return out;
  }

  function chunkChain(sent) {
    var starts = sent.filter(function (r) { return namesIn(r).indexOf(ENT.petition) >= 0; });
    var ends = sent.filter(function (r) { return namesIn(r).indexOf(ENT.fire) >= 0; });
    var prev = {};
    var q = [];
    starts.forEach(function (s) { prev[s] = null; q.push(s); });
    while (q.length) {
      var r = q.shift();
      if (ends.indexOf(r) >= 0) {
        var chain = [r];
        while (prev[chain[0]]) chain.unshift(prev[chain[0]].r);
        var via = [];
        for (var i = 1; i < chain.length; i++) via.push(prev[chain[i]].name);
        return { chain: chain, via: via };
      }
      for (var j = 0; j < sent.length; j++) {
        var s = sent[j];
        if (prev.hasOwnProperty(s)) continue;
        var shared = namesIn(r).filter(function (x) { return namesIn(s).indexOf(x) >= 0; });
        if (shared.length) { prev[s] = { r: r, name: shared[0] }; q.push(s); }
      }
    }
    return null;
  }

  // The answer for the current settings: verdict, hops, sources, calls, html for the panel.
  function answer(C) {
    var G = buildGraph(C.merge);
    var out = { G: G, hops: "none", sources: "", queryCalls: 0, sent: 0, verdict: "", lines: [], tone: "ok", threads: "" };
    if (C.mode === "hand") {
      out.queryCalls = 0;
      out.sent = REC.length;
      if (C.q === "fact") { out.verdict = "right"; out.sources = "R8"; out.lines.push("Night of 15 March 1954; alarm at 02:10 by Ezekiel Tallentire of Tenter Row, born 1931 (R7, R8)."); }
      if (C.q === "conn") {
        var GP = graphPath(buildGraph("check"), "fire", "petition");
        out.verdict = "true path"; out.hops = GP.length; out.sources = recSort(uniq(GP.map(function (h) { return h.edge.rec; }))).join(", ");
        out.lines.push("You check every name against its dates and places, and trace the ground: " + pathText(buildGraph("check"), GP) + ".");
      }
      if (C.q === "global") { out.verdict = "4 of 4 threads"; out.threads = "4 of 4"; out.sources = "R1 to R10"; out.lines.push("You read all 10 records and find the four threads."); }
      return out;
    }
    if (C.mode === "chunks") {
      var sent = topK(C.q === "fact" ? "f" : (C.q === "conn" ? "c" : "g"), C.k);
      out.sent = sent.length;
      out.queryCalls = 1;
      if (C.q === "fact") {
        out.verdict = "right"; out.sources = sent[0];
        out.lines.push("From " + sent[0] + ": the night of 15 March 1954; the alarm at 02:10 by E. Tallentire, of Tenter Row.");
      } else if (C.q === "conn") {
        var ch = chunkChain(sent);
        out.hops = ch.chain.length - 1;
        out.sources = ch.chain.join(", ");
        out.verdict = ch.via.indexOf("E. Tallentire") >= 0 ? "false thread" : "true path";
        out.tone = out.verdict === "false thread" ? "bad" : "ok";
        out.lines.push("Sent: " + sent.join(", ") + ". Joined " + ch.chain.join(" to ") + " on the name " + ch.via.join(", then ") + ": " + (out.tone === "bad" ? "E. Tallentire links them." : "a path through the places."));
      } else {
        var th = uniq(sent.map(function (r) { return THREAD_OF[r]; }));
        out.threads = th.length + " of 4";
        out.verdict = out.threads + " threads";
        out.tone = th.length === 4 ? "ok" : "warn";
        out.sources = sent.join(", ");
        out.lines.push("Sent: " + sent.join(", ") + ". Threads found: " + th.length + " of 4" + (th.indexOf("tenter") < 0 ? "; nothing about Tenter Row." : "."));
      }
      return out;
    }
    // the graph
    if (C.q === "fact") {
      out.queryCalls = 1;
      var who = null;
      G.edges.forEach(function (e) { if (e.b === "fire" && e.label === "raised the alarm") who = e.a; });
      var p = null;
      G.people.forEach(function (pp) { if (pp.id === who) p = pp; });
      out.sources = recSort(p.mentions.map(function (m) { return m.rec; }).concat(["R8"]).filter(function (x, i, a) { return a.indexOf(x) === i; })).join(", ");
      out.sent = 1;
      if (G.people.length === 1) {
        out.verdict = "wrong person"; out.tone = "bad";
        out.lines.push("The alarm was raised by E. Tallentire: " + p.mentions.map(function (m) { return m.note; }).join("; ") + ". A man who died in 1921 raised an alarm in 1954.");
      } else {
        out.verdict = "right";
        out.lines.push("The night of 15 March 1954 (R8); the alarm raised by " + label(G, who) + ", of Tenter Row.");
      }
      return out;
    }
    if (C.q === "conn") {
      out.queryCalls = 1;
      var hops = graphPath(G, "fire", "petition");
      out.hops = hops.length;
      out.sources = recSort(uniq(hops.map(function (h) { return h.edge.rec; }))).join(", ");
      var falseT = G.people.length === 1 && hops.some(function (h) { return h.to === "P1" || h.from === "P1"; });
      out.verdict = falseT ? "false thread" : "true path";
      out.tone = falseT ? "bad" : "ok";
      out.sent = hops.length;
      out.lines.push(pathText(G, hops) + ".");
      return out;
    }
    out.queryCalls = G.comms.length + 1;
    out.sent = G.comms.length;
    out.sources = "R1 to R10";
    if (C.merge === "name") {
      out.threads = "3, one false"; out.verdict = "3 threads, one false"; out.tone = "bad";
      out.lines.push("Read " + G.comms.length + " community summaries: one of them says a single man joins the pond and the fire.");
    } else {
      out.threads = "4 of 4"; out.verdict = "4 of 4 threads";
      out.lines.push("Read " + G.comms.length + " community summaries: the petition, the pond becoming Kiln Street, the chapel and its fire, and Tenter Row.");
    }
    return out;
  }

  function pathText(G, hops) {
    var s = label(G, "petition");
    hops.forEach(function (h) { s += " to " + label(G, h.to) + " (" + h.edge.rec + ", " + h.edge.label + ")"; });
    return s;
  }

  /* ---------- the diagram ---------- */

  function nd(id, l, sub, x, y) { return { id: id, label: l, sub: sub, x: x, y: y, w: 136, h: 52, shape: "box", tone: "" }; }
  var DIAGRAM = {
    type: "arch", w: 760, h: 400,
    aria: "Merriam's graph: 15 entities in five columns, from Tanpit Lane and the elder Ezekiel Tallentire on the left, through the petition, Long Pond, Kiln Street and plot 4, to the chapel, its fire and the gas pipe, and the younger Ezekiel Tallentire of Tenter Row on the right. Lines are relationships, each from one record.",
    nodes: [
      nd("tanpit", "Tanpit Lane", "a street", 80, 50),
      nd("P1", "E. Tallentire", "1861 to 1921", 80, 150),
      nd("tannery", "Tannery", "Tallentire's", 80, 250),
      nd("council", "Ashlock council", "minutes", 230, 50),
      nd("petition", "Fence petition", "1894", 230, 150),
      nd("families", "Pond Cottages", "families", 230, 350),
      nd("kiln", "Kiln Street", "laid out 1897", 380, 50),
      nd("pond", "Long Pond", "filled in 1897", 380, 150),
      nd("plot4", "Plot 4", "the old pond", 380, 250),
      nd("chapel", "Wesleyan chapel", "opened 1902", 530, 150),
      nd("fire", "Chapel fire", "15 March 1954", 530, 250),
      nd("pipe", "Gas pipe", "under the floor", 530, 350),
      nd("tenter", "Tenter Row", "a street", 680, 150),
      nd("P2", "E. Tallentire", "born 1931", 680, 250),
      nd("shop", "Cycle shop", "applied 1953", 680, 350)
    ],
    edges: [],
    notes: [{ x: 605, y: 54, text: "each line: one record", tone: "muted", anchor: "middle" }]
  };
  (function () {
    var seen = {};
    var r = resolve("check");
    var VIA = { "kiln|plot4": [[455, 250], [455, 50]], "shop|tenter": [[755, 350], [755, 150]] };
    REL.forEach(function (e) {
      var a = r.of[e[0]] || e[0];
      var b = r.of[e[1]] || e[1];
      var k = [a, b].sort().join("|");
      if (seen[k]) return;
      seen[k] = true;
      var ed = { from: a, to: b, tone: "muted" };
      if (VIA[k]) ed.via = VIA[k];
      DIAGRAM.edges.push(ed);
    });
  })();

  /* ---------- the module ---------- */

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var A = answer(C);
    S.A = A;
    var G = A.G;
    // nodes
    DIAGRAM.nodes.forEach(function (n) { api.node(n.id).set(""); });
    if (G.people.length === 1) {
      api.node("P1").text("sub", "merged, 4 records");
      api.node("P2").text("sub", "merged into one");
      api.node("P2").set("zombie");
    } else {
      api.node("P1").text("sub", "1861 to 1921");
      api.node("P2").text("sub", "born 1931");
    }
    if (C.mode !== "chunks" && C.q === "conn") {
      var hops = C.mode === "hand" ? graphPath(buildGraph("check"), "fire", "petition") : graphPath(G, "fire", "petition");
      var on = ["petition"];
      hops.forEach(function (h) { on.push(h.to); on.push(h.from); });
      uniq(on).forEach(function (n) { api.node(n).set(A.tone === "bad" ? "bad" : "ok"); });
    }
    // stats
    S.stat.verdict(A.verdict);
    S.stat.hops(A.hops);
    S.stat.sources(A.sources || "none");
    S.stat.people(G.people.length);
    S.stat.entities(G.nodes.length);
    S.stat.rels(G.edges.length);
    S.stat.comms(C.mode === "graph" ? G.comms.length : "not built");
    S.stat.index(C.mode === "graph" ? G.indexCalls : 0);
    S.stat.query(A.queryCalls);
    S.stat.full(C.mode === "graph" ? fmt(FULL_CHUNKS) + " extraction calls" :
      (C.mode === "chunks" ? fmt(FULL_CHUNKS) + " embeddings, 0 model calls" : fmt(FULL_RECORDS * MIN_PER_RECORD / 60) + " h by hand"));
    // the panel: the answer, its path and sources, and one community summary
    var comms = G.comms;
    var ci = Math.min(S.comm, comms.length - 1);
    if (G.people.length === 1 && S.comm === 3) ci = 0;
    var cm = comms[ci];
    var h = "<p><strong>Answer (" + esc(A.verdict) + ").</strong> " + esc(A.lines.join(" ")) + "</p>";
    var srcs = A.sources && A.sources !== "R1 to R10" ? A.sources.split(", ") : [];
    if (srcs.length) {
      h += "<p><strong>Sources.</strong></p><ul>";
      srcs.forEach(function (id) { var r = recById(id); h += "<li>" + esc(r.id + ", " + r.what + ": " + r.text) + "</li>"; });
      h += "</ul>";
    }
    h += "<p><strong>Community summary: " + esc(cm.title) + ".</strong> " + esc(cm.summary) + "</p>";
    h += "<p>Indexing the 10 records: " + (C.mode === "graph" ? REC.length + " extraction calls, " + G.entitySummaries + " entity summaries, " + G.pairSummaries + " pair summaries and " + comms.length + " community reports = " + G.indexCalls + " model calls." : (C.mode === "chunks" ? "10 embeddings, no model calls." : REC.length + " records at " + MIN_PER_RECORD + " minutes = " + (REC.length * MIN_PER_RECORD) + " minutes.")) + "</p>";
    S.infoHtml = h;
    api.info(h);
  }

  function ask(api, what) {
    draw(api);
    var A = api.state.A;
    api.log(what + " Answer: " + A.verdict + (A.hops !== "none" ? ", " + A.hops + (A.hops === 1 ? " hop" : " hops") : "") + ". Sources: " + (A.sources || "none") + ". Query model calls: " + A.queryCalls + ".", A.tone === "bad" ? "bad" : (A.tone === "warn" ? "warn" : "ok"));
  }

  function pick(list, v) { for (var i = 0; i < list.length; i++) if (list[i].value === String(v)) return list[i]; return null; }

  DL.sims.define("a3e08", {
    diagram: DIAGRAM,
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { merge: "name", q: "conn", mode: "graph", k: 3 };
      S.comm = 0;
      S.stat = {
        verdict: api.stat("verdict", "answer", "bad"),
        hops: api.stat("hops", "hops in the path", ""),
        sources: api.stat("sources", "sources", ""),
        people: api.stat("people", "Tallentire nodes", "warn"),
        entities: api.stat("entities", "entities", ""),
        rels: api.stat("rels", "relationships", ""),
        comms: api.stat("comms", "communities", ""),
        index: api.stat("index", "indexing model calls (10 records)", "warn"),
        query: api.stat("query", "model calls for this question", ""),
        full: api.stat("full", "indexing the full collection", "warn")
      };
      api.control.select("merge", "Same-name people", MERGES, "name", function (v) {
        var o = pick(MERGES, v); if (!o) return;
        S.C.merge = o.value;
        ask(api, o.value === "name" ? "Merging by name." : "Checking dates and places before merging." + (S.C.mode === "chunks" ? " Chunks carry no entities, so this changes only the graph." : ""));
      });
      api.control.select("question", "Question", QUESTIONS, "conn", function (v) {
        var o = pick(QUESTIONS, v); if (!o) return;
        S.C.q = o.value;
        ask(api, "Asked: " + o.label);
      });
      api.control.select("mode", "Answer it with", MODES, "graph", function (v) {
        var o = pick(MODES, v); if (!o) return;
        S.C.mode = o.value;
        ask(api, o.value === "chunks" ? "Answering from chunks." : (o.value === "graph" ? "Answering from the graph." : "Answering by hand."));
      });
      api.control.select("k", "Chunks sent (chunk mode)", [{ value: "3", label: "Top 3" }, { value: "8", label: "Top 8" }], "3", function (v) {
        S.C.k = Number(v) === 8 ? 8 : 3;
        ask(api, "Chunks sent: top " + S.C.k + ".");
      });
      api.control.select("comm", "Community summary to read", COMM_CHECKED.map(function (c, i) { return { value: String(i), label: c.title }; }), "0", function (v) {
        S.comm = Math.max(0, Math.min(3, Number(v) || 0));
        draw(api);
      });
      api.control.button("reset", "Reset", function () { api.reset(); });
      ask(api, "The night: same-name people merged, the connection question asked from the graph.");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      function info() { return t.api.state.infoHtml || ""; }

      // 1. Opening state: the night, merged by name, the connection question on the graph.
      t.expect(t.stat("verdict") === "false thread" && t.stat("hops") === 2 && t.stat("sources") === "R1, R8" &&
        t.stat("people") === 1 && t.stat("entities") === 14 && t.stat("rels") === 22 && t.stat("comms") === 3 &&
        t.stat("index") === 25 && t.stat("query") === 1 && t.stat("full") === "7,480 extraction calls" &&
        t.logText().indexOf("Answer: false thread, 2 hops. Sources: R1, R8.") >= 0,
        "Opens on the night: one E. Tallentire node, a 2-hop false thread from R1 to R8, 25 indexing calls");
      var S = t.api.state;
      var hp = graphPath(S.A.G, "fire", "petition");
      t.expect(hp.length === 2 && hp[0].to === "P1" && hp[0].edge.rec === "R1" && hp[1].to === "fire" && hp[1].edge.rec === "R8" &&
        S.A.G.people[0].mentions.length === 4 && t.node("P1").state === "bad",
        "The false thread runs petition, E. Tallentire (R1, moved to decline), chapel fire (R8, raised the alarm), through one node built from 4 records");

      // 2. Checking dates and places splits the man in two and the thread disappears.
      begin();
      t.set("merge", "check");
      var S2 = t.api.state;
      t.expect(has("Answer: true path, 4 hops. Sources: R1, R4, R9.") && t.stat("people") === 2 && t.stat("entities") === 15 &&
        t.stat("comms") === 4 && t.stat("index") === 27 && t.node("P1").state === "" && t.node("pipe").state === "ok",
        "Checked: two Tallentires, 15 entities, 4 communities, 27 indexing calls; the path is 4 hops through R1, R4, R9");
      var hp2 = graphPath(S2.A.G, "fire", "petition");
      t.expect(hp2.map(function (h) { return h.to; }).join(",") === "pond,plot4,pipe,fire" &&
        S2.A.G.people[0].born === 1861 && S2.A.G.people[0].died === 1921 && S2.A.G.people[1].born === 1931,
        "The true path: petition to Long Pond to plot 4 to the gas pipe to the fire; the men are 1861 to 1921 and born 1931");

      // 3. Option 1: more chunks for the connection question keeps the same false thread.
      t.set("merge", "name");
      t.set("mode", "chunks");
      var c3 = t.stat("verdict") === "false thread" && t.stat("sources") === "R1, R8" && t.stat("index") === 0;
      begin();
      t.set("k", 8);
      t.expect(c3 && has("Answer: false thread, 1 hop. Sources: R1, R8.") && t.api.state.A.sent === 8 &&
        t.stat("full") === "7,480 embeddings, 0 model calls",
        "Chunks, top 3 or top 8: joined R1 to R8 on the name E. Tallentire, the same false thread");
      t.set("merge", "check");
      t.expect(t.stat("verdict") === "false thread", "Chunks carry no entities: checking dates and places doesn't change the chunk answer");

      // 4. Whole-collection question: chunks see part of the town, the graph reads every community.
      t.set("question", "global");
      var g8 = t.stat("verdict");
      t.set("k", 3);
      var g3 = t.stat("verdict");
      t.set("mode", "graph");
      var gc = t.stat("verdict") === "4 of 4 threads" && t.stat("query") === 5;
      t.set("merge", "name");
      t.expect(g3 === "2 of 4 threads" && g8 === "3 of 4 threads" && gc && t.stat("verdict") === "3 threads, one false" && t.stat("query") === 4,
        "Whole collection: chunks top 3 find 2 of 4 threads, top 8 3 of 4; the graph 4 of 4 checked (5 calls), 3 with one false merged (4 calls)");

      // 5. Option 0: the fact question on the merged graph names a man who died in 1921.
      t.set("question", "fact");
      var f0 = t.stat("verdict");
      t.set("merge", "check");
      var f1 = t.stat("verdict");
      t.set("mode", "chunks");
      t.expect(f0 === "wrong person" && f1 === "right" && t.stat("verdict") === "right" && t.stat("sources") === "R8" &&
        t.stat("query") === 1 && t.stat("index") === 0,
        "Fact: merged graph gives the wrong person; checked graph and chunks are right; chunks need no indexing calls and cite R8");

      // 6. Option 3: by hand is right and slow.
      t.set("mode", "hand");
      var h1 = t.stat("full") === "496 h by hand" && t.stat("verdict") === "right";
      t.set("question", "conn");
      t.expect(h1 && t.stat("verdict") === "true path" && t.stat("sources") === "R1, R4, R9" && t.stat("query") === 0,
        "By hand: right answers, the true path, no model calls, and 496 h for the full collection");

      // 7. The community panel shows the merged community's false sentence.
      t.set("mode", "graph");
      t.set("merge", "name");
      t.set("comm", "3");
      t.expect(info().indexOf("one man joins the pond and the fire") >= 0, "Merged: the community summary repeats the false thread");
    }
  });
})();
