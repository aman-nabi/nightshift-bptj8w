/* sims/s3e11-v1.0.1.js  (published as sims/s3e11.js)
   Case s3e11 "The Word Index": inverted indexes, analysis, BM25 relevance and near-real-time
   refresh in the Gullstone Herald's morgue. A widget-style sim built inside api.root (no diagram).
   Two parts share one set of controls:
   - The search lab: six clippings in Lanyon's test index, a visible inverted index, an analyzer
     with toggles (lowercase, synonyms, stop words, stemmer), fixed preset searches, BM25 scores
     and the tokens each result matched. A LIKE switch searches the database instead.
   - The night: Thursday from 23:14:00 to 07:30:00, a second at a time: the reindex job, the
     refresh interval, the obituary at 23:40:00, the alert, refresh=wait_for and the day shift's
     refresh at 07:12:00.

   CHANGELOG
   v1.0.1 (2026-10-11) rule 15 rename: the skipper lost in 1952 is now Pascoe; the case is
     content/s3/s3e11-v1.0.1.json
   v1.0.0 (2026-10-11) first version. Controls: refresh interval (1s, 30s, 1ms, -1), the reindex
     job (as now, finally step, leaves the interval alone, off), the crash at 23:19:00, the alert,
     refresh=wait_for for the obituary desk, lowercase, synonyms, stop words, stemmer, LIKE on the
     database, the search box (5 presets), run 5 minutes, run to 01:30:00, run to 07:30:00, reset.
     Stats: refresh interval now, job clippings loaded, not yet searchable, time until searchable
     (the obituary), the desk's save, segments written, alert, hits, top score, what the search
     read. selfTest: 15 assertions.

   Where every number comes from (conventions rule 14; the case is content/s3/s3e11-v1.0.1.json):
   - post: the morgue holds 1,214,000 clippings. The reindex job starts at 23:15:00, sets
     refresh_interval to -1 and loads 48,000 rescanned clippings, 100 a second; it hits an
     unreadable scan at 23:19:00 after 24,000 (240 s x 100) and its last line, which restores 1s,
     never runs. The obituary is indexed at 23:40:00. Loveday searches at 01:30. The day shift runs
     POST /morgue/_refresh at 07:12:00, so the obituary was hidden 07:12:00 - 23:40:00 = 27,120 s
     (7 h 32 min), and 24,000 + 1 = 24,001 clippings were indexed but not searchable.
   - Elasticsearch facts (the case's sources): refresh every 1 s by default, only on indices
     searched in the last 30 s, unless refresh_interval is set explicitly; -1 disables refresh;
     refresh=wait_for waits for a refresh and, with -1, waits indefinitely; BM25 is the default
     similarity with k1 = 1.2 and b = 0.75; overlap tokens (synonyms at the same position) don't
     count toward length (discount_overlaps true); Elasticsearch's BM25 applies the (k1 + 1)
     factor (LegacyBM25Similarity), so score = idf x f x 2.2 / (f + 1.2 x (0.25 + 0.75 x dl / avgdl)),
     idf = ln(1 + (N - n + 0.5) / (n + 0.5)) as in Lucene. The sim keeps lengths exactly.
   - The test index (stated in sim.lede): six clippings c1 to c6, texts below. As now the analyzer
     lowercases, applies lost at sea => lost at sea, drowned, keeps stop words and stems with three
     rules (-ing, else -ed, else a final -s not -ss, when at least 3 letters remain). Lengths:
     c1 29 (31 tokens minus 2 synonym overlaps), c2 22, c3 20, c4 21, c5 20, c6 22.
     At 01:30, as now, N = 5 (c6 hidden), avgdl = 112 / 5 = 22.4:
       Bolitho: c1 only, idf ln(1 + 4.5 / 1.5) = 1.386, f 1, dl 29: 1.2372 (also at 23:14:00).
       drowned -> drown, n = 3, idf = ln(1 + 2.5 / 3.5) = 0.5390: c3 (f 2, dl 20) 0.7641,
       c4 (f 2, dl 21) 0.7544, c1 (f 2 from the synonym, dl 29) 0.6844.
     After the refresh, N = 6, avgdl = 134 / 6 = 22.333, drown n = 4, idf = ln(1 + 2.5 / 4.5):
       drowned: c3 0.6259, c4 0.6179, c6 0.6101, c1 0.5605. Bolitho: c6 1.4217, c1 0.9176.
     Stemmer and synonyms off, at 01:30: drowned finds c3 only (f 2, n 1): 1.9654.
     "the drowning" at 23:14:00: 5 hits with stop words off, 3 with them on.
   - LIKE (teaching model): case-sensitive substring on the database, newest first, no score; each
     search reads all 1,214,000 clippings, 4 to an 8 KB page = 303,500 pages x 0.008 ms (the page
     cost from The Card Catalog) = 2,428 ms. At 01:30 '%drowned%' finds c6 and c3.
   - Teaching cost model: a refresh that finds new clippings writes one segment and takes 0.5 ms
     from indexing. At 1ms that is 1,000 refreshes a second, half of every second, so the job
     loads 50 a second: 12,000 by 23:19:00 (240 s x 50) and 240,000 segments, plus 1 for the
     obituary = 240,001; a full run takes 960 s (to 23:31:00) and writes 960,000 + 1 = 960,001.
     At 1s the job (when it leaves the interval alone) loads 99.95 a second.
   - Alert (fix): fires after 600 s with refreshing off: as now 23:15:00 + 600 s = 23:25:00; Lanyon
     sets 1s again 300 s later, 23:30:00; the refresh at 23:30:01 makes the 24,000 searchable. A
     normal run takes 480 s, 23:15:00 to 23:23:00, so it never fires.
   - Finally step (fix): restores 1s at the crash, 23:19:00; refresh at 23:19:01 (24,000); the
     obituary refreshes at 23:40:01, 1 s after indexing; 2 segments by 01:30. With 30s the
     obituary waits to 23:40:30.

   Teaching model, one slot a second (slot T is a second after midnight on Thursday; 83,640 is
   23:14:00 and 113,400 is 07:30:00 on Friday). In each slot, in order: (1) a periodic refresh if
   one is due (every interval since it was last set; at 1ms, whenever anything is pending);
   (2) at 07:12:00, the day shift's refresh if anything is pending; (3) the job starts, crashes or
   finishes, setting or restoring the interval; (4) the alert fires or Lanyon restores the
   interval; (5) indexing: the job's clippings for this second, and the obituary at 23:40:00.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var START = 83640;             // 23:14:00 Thursday
  var JOB_START = 83700;         // 23:15:00
  var CRASH_T = 83940;           // 23:19:00
  var OBIT_T = 85200;            // 23:40:00
  var Q_0130 = 91800;            // 01:30:00 Friday
  var DAY_T = 112320;            // 07:12:00 Friday
  var END = 113400;              // 07:30:00 Friday
  var JOB_TOTAL = 48000;         // rescanned clippings
  var JOB_RATE = 100;            // a second, with nothing refreshing
  var ALERT_AFTER = 600;         // 10 minutes with refreshing off
  var ONCALL = 300;              // Lanyon restores 5 minutes after the page
  var CLIPPINGS = 1214000;       // the whole morgue
  var LIKE_MS = 2428;            // 1,214,000 / 4 = 303,500 pages x 0.008 ms
  var K1 = 1.2;
  var B = 0.75;

  var STOP = ["a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is", "it",
    "no", "not", "of", "on", "or", "such", "that", "the", "their", "then", "there", "these", "they", "this",
    "to", "was", "will", "with"];

  var DOCS = [
    { id: "c1", date: "1952-03-14", head: "GUILLEMOT FEARED LOST AT SEA",
      text: "GUILLEMOT FEARED LOST AT SEA. The Gullstone trawler Guillemot has not come home and is feared lost at sea with her crew of three, skipper Pascoe Bolitho among them." },
    { id: "c2", date: "1952-03-21", head: "SEARCH CALLED OFF",
      text: "SEARCH CALLED OFF. The lifeboat came back to Gullstone at dusk. No trace of the trawler or her three men was found." },
    { id: "c3", date: "1987-08-02", head: "BOY DROWNED OFF THE QUAY",
      text: "BOY DROWNED OFF THE QUAY. A boy of nine drowned off Gullstone quay on Saturday. Lifeboat crews searched until dark." },
    { id: "c4", date: "1999-06-11", head: "LIFEBOAT SAVES DROWNING SWIMMER",
      text: "LIFEBOAT SAVES DROWNING SWIMMER. The Gullstone lifeboat pulled a drowning swimmer from the harbour mouth. He is recovering at home tonight." },
    { id: "c5", date: "2011-01-05", head: "SEA WALL REPAIRS BEGIN",
      text: "SEA WALL REPAIRS BEGIN. Work on the sea wall at Gullstone harbour starts on Monday and will last six weeks." },
    { id: "c6", date: "2026-10-08", head: "JAGO BOLITHO, 81 (obituary)",
      text: "JAGO BOLITHO, 81. Jago Bolitho, fisherman, drowned off Gullstone quay on Thursday evening. His father Pascoe was lost at sea in 1952." }
  ];

  var QUERIES = [
    { value: "Bolitho", label: "Bolitho" },
    { value: "drowned", label: "drowned" },
    { value: "drowning", label: "drowning" },
    { value: "lost at sea", label: "lost at sea" },
    { value: "the drowning", label: "the drowning" }
  ];
  var INTERVALS = [
    { value: "1000", label: "1s (the default)" },
    { value: "30000", label: "30s" },
    { value: "1", label: "1ms (always fresh)" },
    { value: "-1", label: "-1 (refresh off)" }
  ];
  var JOBS = [
    { value: "asnow", label: "As now: -1 while loading, restored by its last line" },
    { value: "finally", label: "-1 while loading, restored in a finally step" },
    { value: "alone", label: "Leaves the refresh interval alone" },
    { value: "off", label: "No job tonight" }
  ];

  /* ---------- small helpers ---------- */

  // 24001 -> "24,001". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function hms(sec) {
    var s = Math.floor(sec) % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function ivText(ms) {
    if (ms === -1) return "-1 (disabled)";
    if (ms < 1000) return ms + "ms";
    return (ms / 1000) + "s";
  }

  // Seconds between indexing and searchable: "0.001 s", "1 s", "27,120 s".
  function secText(d) {
    if (d < 1) return d.toFixed(3) + " s";
    return fmt(d) + " s";
  }

  function docOf(id) {
    for (var i = 0; i < DOCS.length; i++) if (DOCS[i].id === id) return DOCS[i];
    return null;
  }

  /* ---------- the analyzer ---------- */

  function stem(w) {
    if (w.length - 3 >= 3 && w.slice(-3) === "ing") return w.slice(0, -3);
    if (w.length - 2 >= 3 && w.slice(-2) === "ed") return w.slice(0, -2);
    if (w.length - 1 >= 3 && w.slice(-1) === "s" && w.slice(-2) !== "ss") return w.slice(0, -1);
    return w;
  }

  // Tokens: { t: the token, pre: the text before stemming, syn: added by the synonym rule }.
  function analyze(text, an) {
    var raw = text.match(/[A-Za-z0-9]+/g) || [];
    var toks = raw.map(function (w) { return { t: an.lower ? w.toLowerCase() : w, syn: false }; });
    if (an.syn) {
      var out = [];
      var i = 0;
      while (i < toks.length) {
        if (i + 2 < toks.length && toks[i].t === "lost" && toks[i + 1].t === "at" && toks[i + 2].t === "sea") {
          out.push(toks[i], { t: "drowned", syn: true }, toks[i + 1], toks[i + 2]);
          i += 3;
        } else {
          out.push(toks[i]);
          i += 1;
        }
      }
      toks = out;
    }
    if (an.stop) toks = toks.filter(function (k) { return STOP.indexOf(k.t) < 0; });
    return toks.map(function (k) {
      return { t: an.stem ? stem(k.t) : k.t, pre: k.t, syn: k.syn };
    });
  }

  function lengthOf(toks) {
    var n = 0;
    for (var i = 0; i < toks.length; i++) if (!toks[i].syn) n += 1;
    return n;
  }

  function anText(an) {
    return "lowercase " + (an.lower ? "on" : "off") + ", synonyms " + (an.syn ? "on" : "off") +
      ", stop words " + (an.stop ? "on" : "off") + ", stemmer " + (an.stem ? "on" : "off");
  }

  /* ---------- the inverted index and BM25 ---------- */

  function buildIndex(ids, an) {
    var docs = {};
    var post = {};
    var total = 0;
    ids.forEach(function (id) {
      var toks = analyze(docOf(id).text, an);
      var dl = lengthOf(toks);
      docs[id] = { toks: toks, dl: dl };
      total += dl;
      toks.forEach(function (k) {
        if (!post[k.t]) post[k.t] = {};
        post[k.t][id] = (post[k.t][id] || 0) + 1;
      });
    });
    return { ids: ids, docs: docs, post: post, N: ids.length, avgdl: ids.length ? total / ids.length : 0 };
  }

  function idf(N, n) { return Math.log(1 + (N - n + 0.5) / (n + 0.5)); }

  function bm25(f, dl, avgdl, N, n) {
    return idf(N, n) * f * (K1 + 1) / (f + K1 * (1 - B + B * dl / avgdl));
  }

  function queryTokens(q, an) {
    var out = [];
    analyze(q, an).forEach(function (k) { if (out.indexOf(k.t) < 0) out.push(k.t); });
    return out;
  }

  // "drown x2: from lost at sea (synonym)", "drown x2: from drowned (stemmed)", "bolitho x1".
  function matchedText(toks, t) {
    var f = 0;
    var from = {};
    var order = [];
    toks.forEach(function (k) {
      if (k.t !== t) return;
      f += 1;
      var why = k.syn ? "from lost at sea (synonym)" : (k.pre !== k.t ? "from " + k.pre + " (stemmed)" : "");
      if (!why) return;
      if (!from[why]) { from[why] = 0; order.push(why); }
      from[why] += 1;
    });
    var s = t + " x" + f;
    if (order.length) s += ": " + order.map(function (w) { return from[w] < f || order.length > 1 ? w + " x" + from[w] : w; }).join(", ");
    return s;
  }

  function searchIndex(q, an, ids) {
    var ix = buildIndex(ids, an);
    var qt = queryTokens(q, an);
    var hits = [];
    var reads = 0;
    qt.forEach(function (t) { if (ix.post[t]) reads += Object.keys(ix.post[t]).length; });
    ids.forEach(function (id) {
      var d = ix.docs[id];
      var score = 0;
      var matched = [];
      qt.forEach(function (t) {
        var f = ix.post[t] ? (ix.post[t][id] || 0) : 0;
        if (!f) return;
        score += bm25(f, d.dl, ix.avgdl, ix.N, Object.keys(ix.post[t]).length);
        matched.push(matchedText(d.toks, t));
      });
      if (score > 0) {
        var doc = docOf(id);
        hits.push({ id: id, date: doc.date, head: doc.head, score: score, scoreText: score.toFixed(4), matched: matched });
      }
    });
    hits.sort(function (a, b) { return b.score - a.score || (a.id < b.id ? -1 : 1); });
    return { mode: "index", q: q, qt: qt, ix: ix, hits: hits, reads: reads };
  }

  function searchLike(q, dbIds) {
    var hits = [];
    dbIds.forEach(function (id) {
      var doc = docOf(id);
      if (doc.text.indexOf(q) >= 0) hits.push({ id: id, date: doc.date, head: doc.head, score: null, scoreText: "-", matched: ["contains " + q] });
    });
    hits.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return { mode: "like", q: q, hits: hits };
  }

  function searchSummary(res) {
    if (res.mode === "like") {
      return "LIKE '%" + res.q + "%' on the database: " + (res.hits.length ? res.hits.length + (res.hits.length === 1 ? " hit" : " hits") +
        ", newest first: " + res.hits.map(function (h) { return h.date; }).join(", ") : "no hits") +
        ". Read " + fmt(CLIPPINGS) + " rows, " + fmt(LIKE_MS) + " ms.";
    }
    if (!res.hits.length) return "Search \"" + res.q + "\": no hits.";
    return "Search \"" + res.q + "\": " + res.hits.length + (res.hits.length === 1 ? " hit: " : " hits: ") +
      res.hits.map(function (h) { return h.date + " " + h.scoreText; }).join(", ") + ".";
  }

  /* ---------- the night ---------- */

  function makeNight(cfg) {
    var N = {
      cfg: cfg, t: START, eff: cfg.interval, lastSet: START, job: cfg.job === "off" ? "off" : "idle",
      loaded: 0, visJob: 0, obitFiled: false, obitVisAt: null, saveAt: null, segments: 0,
      disabledSince: cfg.interval === -1 ? START : null, alertAt: null, restoreAt: null, done: false
    };

    function pendingJob() { return Math.floor(N.loaded) - Math.floor(N.visJob); }
    N.pending = function () { return pendingJob() + (N.obitFiled && N.obitVisAt === null ? 1 : 0); };

    function setEff(v, T) {
      if (v === -1 && N.eff !== -1) N.disabledSince = T;
      if (v !== -1) N.disabledSince = null;
      N.eff = v;
      N.lastSet = T;
    }

    function refresh(T, kind, ev) {
      var nj = pendingJob();
      var no = N.obitFiled && N.obitVisAt === null;
      N.visJob = N.loaded;
      if (nj <= 0 && !no) return;
      N.segments += 1;
      if (no) {
        N.obitVisAt = T;
        if (cfg.waitfor) { N.saveAt = T; ev.push({ type: "save", t: T }); }
      }
      if (kind === "manual" || no || nj >= 1000) ev.push({ type: "refresh", kind: kind, t: T, n: nj + (no ? 1 : 0), obit: no });
    }

    N.step = function () {
      var ev = [];
      if (N.t >= END) return ev;
      var T = N.t;
      var c = N.cfg;

      // (1) periodic refresh
      if (N.eff > 0) {
        if (N.eff < 1000) {
          if (N.pending() > 0) refresh(T, "periodic", ev);
        } else if (T > N.lastSet && ((T - N.lastSet) * 1000) % N.eff === 0) {
          refresh(T, "periodic", ev);
        }
      }

      // (2) the day shift
      if (T === DAY_T && N.pending() > 0) refresh(T, "manual", ev);

      // (3) the job
      if (N.job === "idle" && T === JOB_START) {
        N.job = "running";
        if (c.job === "asnow" || c.job === "finally") {
          ev.push({ type: "jobstart", t: T, was: N.eff });
          setEff(-1, T);
        } else {
          ev.push({ type: "jobalone", t: T });
        }
      } else if (N.job === "running" && N.loaded >= JOB_TOTAL) {
        N.job = "done";
        if (c.job === "asnow" || c.job === "finally") setEff(c.interval, T);
        ev.push({ type: "jobdone", t: T });
      } else if (N.job === "running" && c.crash && T === CRASH_T) {
        N.job = "crashed";
        ev.push({ type: "crash", t: T, loaded: Math.floor(N.loaded) });
        if (c.job === "finally") setEff(c.interval, T);
      }

      // (4) the alert and Lanyon
      if (c.alert) {
        if (N.eff === -1 && N.disabledSince !== null && N.alertAt === null && T - N.disabledSince >= ALERT_AFTER) {
          N.alertAt = T;
          N.restoreAt = T + ONCALL;
          ev.push({ type: "alert", t: T });
        }
        if (N.restoreAt === T) {
          N.restoreAt = null;
          if (N.eff === -1) { setEff(1000, T); ev.push({ type: "oncall", t: T }); }
        }
      }

      // (5) indexing
      var fast = N.eff > 0 && N.eff < 1000;
      if (N.job === "running") {
        var R = N.eff > 0 ? 1000 / N.eff : 0;
        var rate = JOB_RATE * (1 - R / 2000);
        var add = Math.min(rate, JOB_TOTAL - N.loaded);
        if (add > 0) {
          N.loaded += add;
          if (fast) { N.visJob = N.loaded; N.segments += R; }
        }
      }
      if (T === OBIT_T) {
        N.obitFiled = true;
        if (fast) {
          N.obitVisAt = T + N.eff / 1000;
          N.segments += 1;
          if (c.waitfor) N.saveAt = N.obitVisAt;
        }
        ev.push({ type: "obit", t: T, fast: fast });
        if (fast && c.waitfor) ev.push({ type: "save", t: T });
      }

      N.t += 1;
      if (N.t >= END) N.done = true;
      return ev;
    };

    N.visibleIds = function () {
      var ids = ["c1", "c2", "c3", "c4", "c5"];
      if (N.obitVisAt !== null && N.obitVisAt <= N.t) ids.push("c6");
      return ids;
    };
    N.dbIds = function () {
      var ids = ["c1", "c2", "c3", "c4", "c5"];
      if (N.obitFiled) ids.push("c6");
      return ids;
    };
    return N;
  }

  /* ---------- narration ---------- */

  function logEvents(api, evs) {
    var S = api.state;
    var N = S.night;
    var c = N.cfg;
    evs.forEach(function (e) {
      api.clock = Math.floor(e.t) % 86400;
      if (e.type === "jobstart") {
        api.log("Reindex job starts: PUT /morgue/_settings refresh_interval -1 (was " + ivText(e.was) + "). Loading 48,000 rescanned clippings.", "warn");
      } else if (e.type === "jobalone") {
        api.log("Reindex job starts, leaving refresh_interval at " + ivText(N.eff) + ". Loading 48,000 rescanned clippings.", "");
      } else if (e.type === "crash") {
        api.log("Reindex job: ERROR scan 1961-07-22 p4 unreadable. Stopped at " + fmt(e.loaded) + " of 48,000." +
          (c.job === "asnow" ? " Its last line never runs: refresh_interval stays -1." :
            c.job === "finally" ? " Its finally step sets refresh_interval back to " + ivText(c.interval) + "." :
              " refresh_interval is still " + ivText(N.eff) + "."), c.job === "asnow" ? "bad" : "warn");
      } else if (e.type === "jobdone") {
        api.log("Reindex job done: 48,000 of 48,000 loaded." +
          (c.job === "alone" ? "" : " Its last line sets refresh_interval back to " + ivText(c.interval) + "."), "ok");
      } else if (e.type === "refresh") {
        var lead = e.kind === "manual" ? "Day shift runs POST /morgue/_refresh: " : "Refresh: ";
        var d = secText(N.obitVisAt - OBIT_T);
        if (e.obit && e.n === 1) {
          api.log(lead + "the obituary becomes searchable, " + d + " after it was indexed.", "ok");
        } else {
          api.log(lead + fmt(e.n) + " clippings become searchable" + (e.obit ? ", the obituary among them, " + d + " after it was indexed" : "") + ".", "ok");
        }
      } else if (e.type === "obit") {
        api.log("Newsroom indexes the obituary: BOLITHO, JAGO." +
          (e.fast ? " Searchable " + secText(N.obitVisAt - OBIT_T) + " later." :
            c.waitfor ? " The desk's save waits for a refresh (refresh=wait_for)." : " Not searchable until the next refresh."), "");
      } else if (e.type === "save") {
        api.log("The obituary desk's save returns after " + secText(N.saveAt - OBIT_T) + ", searchable.", "ok");
      } else if (e.type === "alert") {
        api.log("ALERT: refreshing has been off on the morgue index for 10 minutes. Lanyon is paged.", "bad");
      } else if (e.type === "oncall") {
        api.log("Lanyon sets refresh_interval back to 1s.", "ok");
      }
    });
  }

  function cfgOf(S) {
    return { interval: S.interval, job: S.job, crash: S.crash, alert: S.alert, waitfor: S.waitfor };
  }

  function nightConfig(S) {
    return "refresh_interval " + ivText(S.interval) + ". Job: " + pick(JOBS, S.job).label.toLowerCase() + "; " +
      (S.crash ? "it hits an unreadable scan at 23:19:00" : "no unreadable scan") + ". Alert " + (S.alert ? "on" : "off") +
      ". Obituary desk: " + (S.waitfor ? "refresh=wait_for." : "no wait.");
  }

  function startNight(api) {
    var S = api.state;
    S.night = makeNight(cfgOf(S));
    api.clock = START;
    api.log("Thursday night. " + nightConfig(S), "");
    doSearch(api, false);
  }

  function replay(api, what) {
    api.clock = api.state.night.t % 86400;
    api.log(what + " Replaying from 23:14:00.", "");
    startNight(api);
  }

  function runTo(api, target) {
    var S = api.state;
    var N = S.night;
    while (N.t < target && !N.done) logEvents(api, N.step());
    api.clock = N.t % 86400;
    doSearch(api, false);
  }

  function doSearch(api, logIt) {
    var S = api.state;
    var N = S.night;
    S.res = S.like ? searchLike(S.query, N.dbIds()) : searchIndex(S.query, S.an, N.visibleIds());
    if (logIt) {
      api.clock = N.t % 86400;
      api.log(searchSummary(S.res), "");
    }
    draw(api);
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:6px;padding:10px;min-width:0;");
    box.appendChild(el("p", "margin:0;font-size:12px;opacity:.8;",
      "Lanyon's test index: six clippings. Scores are BM25 over these six, k1 = 1.2, b = 0.75. Refresh cost is a teaching model."));
    function head(t) { box.appendChild(el("p", "margin:6px 0 0;font-weight:600;letter-spacing:.04em;font-size:12px;", t)); }
    var preStyle = "margin:0;padding:8px;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid currentColor;border-radius:6px;opacity:.95;";
    head("The search");
    var query = el("pre", preStyle, "");
    query.setAttribute("aria-live", "polite");
    box.appendChild(query);
    head("Results");
    var results = el("pre", preStyle, "");
    box.appendChild(results);
    head("Inverted index (searchable clippings only)");
    var index = el("pre", preStyle + "max-height:220px;overflow:auto;", "");
    box.appendChild(index);
    head("Indexed, not yet searchable");
    var hidden = el("p", "margin:0;font-size:13px;", "");
    box.appendChild(hidden);
    head("The night");
    var night = el("p", "margin:0;font-size:13px;", "");
    night.setAttribute("aria-live", "polite");
    box.appendChild(night);
    api.root.appendChild(box);
    return { query: query, results: results, index: index, hidden: hidden, night: night };
  }

  function draw(api) {
    var S = api.state;
    var N = S.night;
    var res = S.res;

    if (res.mode === "like") {
      S.ui.query.textContent = "SELECT * FROM clippings WHERE body LIKE '%" + res.q + "%' ORDER BY date DESC;\n" +
        "Case-sensitive, no analyzer, no score. Reads all " + fmt(CLIPPINGS) + " clippings: " + fmt(LIKE_MS) + " ms.";
      S.ui.index.textContent = "Not used: LIKE reads the database.";
    } else {
      S.ui.query.textContent = "Search: " + res.q + "\nAnalyzer: " + anText(S.an) + ".\nSearch tokens: " +
        (res.qt.length ? res.qt.join(", ") : "none") + ". N = " + res.ix.N + " searchable clippings, avgdl = " +
        (Math.round(res.ix.avgdl * 1000) / 1000) + ".";
      var terms = Object.keys(res.ix.post).sort();
      S.ui.index.textContent = terms.map(function (t) {
        var p = res.ix.post[t];
        return (res.qt.indexOf(t) >= 0 ? "> " : "  ") + t + ": " + Object.keys(p).sort().map(function (id) { return id + " x" + p[id]; }).join(", ");
      }).join("\n");
    }
    S.ui.results.textContent = res.hits.length ? res.hits.map(function (h, i) {
      return (i + 1) + ". " + h.id + " " + h.date + " " + h.head + (h.score === null ? "" : "  score " + h.scoreText) +
        "\n   matched: " + h.matched.join("; ");
    }).join("\n") : "No hits.";

    var pj = Math.floor(N.loaded) - Math.floor(N.visJob);
    var po = N.obitFiled && N.obitVisAt === null;
    S.ui.hidden.textContent = (pj || po) ? [po ? "c6, the obituary, indexed at 23:40:00" : "", pj ? fmt(pj) + " rescanned clippings from the job" : ""]
      .filter(function (x) { return x; }).join(", and ") + "." : "Nothing: everything indexed is searchable.";
    S.ui.night.textContent = hms(N.t) + (N.t === START ? ", nothing run yet. " : ". ") + "refresh_interval " + ivText(N.eff) +
      ". Job: " + (N.job === "idle" ? "not started" : N.job) + ", " + fmt(Math.floor(N.loaded)) + " of 48,000 loaded. Segments written: " +
      fmt(N.segments) + ".";

    S.stat.refresh(ivText(N.eff));
    S.stat.loaded(fmt(Math.floor(N.loaded)) + " of 48,000");
    S.stat.pending(fmt(N.pending()));
    S.stat.obit(!N.obitFiled ? "not filed yet" : N.obitVisAt === null ? "waiting since 23:40:00" : secText(N.obitVisAt - OBIT_T));
    S.stat.save(!S.waitfor ? "wait_for off" : !N.obitFiled ? "not filed yet" : N.saveAt === null ? "waiting since 23:40:00" :
      "returned after " + secText(N.saveAt - OBIT_T));
    S.stat.segments(fmt(N.segments));
    S.stat.alert(!S.alert ? "off" : N.alertAt === null ? "quiet" : "fired " + hms(N.alertAt));
    S.stat.hits(String(res.hits.length));
    S.stat.top(res.hits.length && res.hits[0].score !== null ? res.hits[0].scoreText : "none");
    S.stat.reads(res.mode === "like" ? fmt(CLIPPINGS) + " rows, " + fmt(LIKE_MS) + " ms" : fmt(res.reads) + " postings");

    S.ctl.run5.disable(N.done);
    S.ctl.run0130.disable(N.done || N.t >= Q_0130);
    S.ctl.run0730.disable(N.done);
  }

  /* ---------- controls ---------- */

  function setAn(api, k, on) {
    var S = api.state;
    if (!!on === S.an[k]) return;
    S.an[k] = !!on;
    api.clock = S.night.t % 86400;
    api.log("Analyzer: " + anText(S.an) + ". The test index is rebuilt from its six clippings.", "");
    doSearch(api, true);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s3e11", {
    startClock: START,

    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      api.clock = START;
      S.interval = 1000;
      S.job = "asnow";
      S.crash = true;
      S.alert = false;
      S.waitfor = false;
      S.an = { lower: true, syn: true, stop: false, stem: true };
      S.like = false;
      S.query = "Bolitho";
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.query = api.control.select("query", "Search box", QUERIES, "Bolitho", function (v) {
        if (!pick(QUERIES, v)) return;
        S.query = v;
        doSearch(api, true);
      });
      S.ctl.lower = api.control.toggle("lower", "Lowercase", true, function (on) { setAn(api, "lower", on); });
      S.ctl.syn = api.control.toggle("syn", "Synonym: lost at sea => lost at sea, drowned", true, function (on) { setAn(api, "syn", on); });
      S.ctl.stop = api.control.toggle("stop", "Stop words (default English list)", false, function (on) { setAn(api, "stop", on); });
      S.ctl.stem = api.control.toggle("stem", "Stemmer", true, function (on) { setAn(api, "stem", on); });
      S.ctl.like = api.control.toggle("like", "Search the database with LIKE instead", false, function (on) {
        if (!!on === S.like) return;
        S.like = !!on;
        doSearch(api, true);
      });
      S.ctl.interval = api.control.select("interval", "The index's refresh_interval", INTERVALS, "1000", function (v) {
        var o = pick(INTERVALS, v);
        if (!o) return;
        S.interval = Number(o.value);
        replay(api, "refresh_interval set to " + ivText(S.interval) + ".");
      });
      S.ctl.job = api.control.select("job", "The reindex job", JOBS, "asnow", function (v) {
        var o = pick(JOBS, v);
        if (!o) return;
        S.job = o.value;
        replay(api, "Job: " + o.label.toLowerCase() + ".");
      });
      S.ctl.crash = api.control.toggle("crash", "Unreadable scan at 23:19:00", true, function (on) {
        if (!!on === S.crash) return;
        S.crash = !!on;
        replay(api, on ? "The job will hit the unreadable scan." : "The unreadable scan is fixed.");
      });
      S.ctl.alert = api.control.toggle("alert", "Alert after 10 min with refreshing off", false, function (on) {
        if (!!on === S.alert) return;
        S.alert = !!on;
        replay(api, on ? "Alert on." : "Alert off.");
      });
      S.ctl.waitfor = api.control.toggle("waitfor", "Obituary desk saves with refresh=wait_for", false, function (on) {
        if (!!on === S.waitfor) return;
        S.waitfor = !!on;
        replay(api, on ? "The obituary desk saves with refresh=wait_for." : "The obituary desk saves without waiting.");
      });
      S.ctl.run5 = api.control.button("run5", "Run 5 minutes", function () { runTo(api, api.state.night.t + 300); });
      S.ctl.run0130 = api.control.button("run0130", "Run to 01:30:00", function () { runTo(api, Q_0130); });
      S.ctl.run0730 = api.control.button("run0730", "Run to 07:30:00", function () { runTo(api, END); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        refresh: api.stat("refresh", "refresh interval now", ""),
        loaded: api.stat("loaded", "job clippings loaded", ""),
        pending: api.stat("pending", "not yet searchable", "bad"),
        obit: api.stat("obit", "time until searchable (obituary)", "warn"),
        save: api.stat("save", "obituary desk's save", ""),
        segments: api.stat("segments", "segments written", ""),
        alert: api.stat("alert", "alert", ""),
        hits: api.stat("hits", "hits", ""),
        top: api.stat("top", "top score", "ok"),
        reads: api.stat("reads", "what the search read", "")
      };

      api.info("<strong>How to read it.</strong> The search box runs a preset search now, against the clippings that are " +
        "searchable at this moment of the night. The inverted index lists every token and its postings. Run the night to " +
        "01:30:00 or 07:30:00 and search again: what is searchable, and every score, depends on the last refresh.");

      startNight(api);
    },

    selfTest: async function (t) {
      function has(part) { return t.logText().indexOf(part) >= 0; }
      function ids() { return t.api.state.res.hits.map(function (h) { return h.id; }).join(","); }
      function scores() { return t.api.state.res.hits.map(function (h) { return h.scoreText; }).join(","); }
      function hit(id) {
        var hs = t.api.state.res.hits;
        for (var i = 0; i < hs.length; i++) if (hs[i].id === id) return hs[i];
        return null;
      }

      // 1. The opening state, before the job starts.
      t.expect(t.api.state.night.t === START && t.stat("refresh") === "1s" && t.stat("pending") === 0 &&
        t.stat("obit") === "not filed yet" && t.stat("segments") === 0 && t.stat("loaded") === "0 of 48,000" &&
        t.stat("hits") === 1 && t.stat("top") === 1.2372 && ids() === "c1",
        "23:14:00: refresh 1s, nothing pending, obituary not filed; Bolitho finds only the 1952 clipping, 1.2372");

      // 2. As now, to 01:30: refreshing off since 23:15:00, 24,001 hidden.
      t.click("run0130");
      t.expect(has("23:15:00 Reindex job starts: PUT /morgue/_settings refresh_interval -1 (was 1s). Loading 48,000 rescanned clippings.") &&
        has("23:19:00 Reindex job: ERROR scan 1961-07-22 p4 unreadable. Stopped at 24,000 of 48,000. Its last line never runs: refresh_interval stays -1.") &&
        has("23:40:00 Newsroom indexes the obituary: BOLITHO, JAGO. Not searchable until the next refresh.") &&
        t.stat("refresh") === "-1 (disabled)" && t.stat("pending") === "24,001" && t.stat("loaded") === "24,000 of 48,000" &&
        t.stat("obit") === "waiting since 23:40:00" && ids() === "c1",
        "As now at 01:30: -1 since 23:15:00, stopped at 24,000, 24,001 not yet searchable, Bolitho still finds only 1952");

      // 3. drowned at 01:30: the 1952 clipping matches through the synonym.
      t.set("query", "drowned");
      var c1 = hit("c1");
      t.expect(ids() === "c3,c4,c1" && scores() === "0.7641,0.7544,0.6844" && t.stat("top") === 0.7641 && t.stat("hits") === 3 &&
        c1 && c1.matched[0] === "drown x2: from lost at sea (synonym)" &&
        has("Search \"drowned\": 3 hits: 1987-08-02 0.7641, 1999-06-11 0.7544, 1952-03-14 0.6844."),
        "drowned at 01:30: 1987 0.7641, 1999 0.7544, 1952 0.6844, the 1952 one matched drown x2 from lost at sea");

      // 4. The 1952 score, checked against the stated formula by hand.
      var byHand = Math.log(1 + 2.5 / 3.5) * 2 * 2.2 / (2 + 1.2 * (0.25 + 0.75 * 29 / 22.4));
      var ix = t.api.state.res.ix;
      t.expect(byHand.toFixed(4) === "0.6844" && Math.abs(c1.score - byHand) < 1e-12 && ix.N === 5 &&
        ix.docs.c1.dl === 29 && Math.abs(ix.avgdl - 22.4) < 1e-12 && Object.keys(ix.post.drown).length === 3,
        "BM25 by hand: ln(1 + 2.5 / 3.5) x 2 x 2.2 / (2 + 1.2 x (0.25 + 0.75 x 29 / 22.4)) = 0.6844, N 5, dl 29, avgdl 22.4");

      // 5. The day shift's refresh at 07:12:00.
      t.click("run0730");
      t.expect(has("07:12:00 Day shift runs POST /morgue/_refresh: 24,001 clippings become searchable, the obituary among them, 27,120 s after it was indexed.") &&
        t.stat("obit") === "27,120 s" && t.stat("pending") === 0 && t.stat("segments") === 1 &&
        ids() === "c3,c4,c6,c1" && scores() === "0.6259,0.6179,0.6101,0.5605",
        "07:12:00 refresh: 24,001 searchable, obituary after 27,120 s; drowned now 0.6259, 0.6179, 0.6101 (obituary), 0.5605 (1952)");

      // 6. Bolitho after the refresh: the obituary first.
      t.set("query", "Bolitho");
      t.expect(ids() === "c6,c1" && scores() === "1.4217,0.9176",
        "Bolitho after the refresh: the obituary 1.4217, 1952 0.9176");

      // 7. wait_for as now: the desk's save waits all night.
      t.set("waitfor", true);
      t.click("run0130");
      var waiting = t.stat("save") === "waiting since 23:40:00";
      t.click("run0730");
      t.expect(waiting && t.stat("save") === "returned after 27,120 s" &&
        has("07:12:00 The obituary desk's save returns after 27,120 s, searchable."),
        "refresh=wait_for with the job as now: the save still waits at 01:30 and returns at 07:12:00, after 27,120 s");

      // 8. The finally step.
      t.set("job", "finally");
      t.click("run0130");
      t.expect(has("23:19:00 Reindex job: ERROR scan 1961-07-22 p4 unreadable. Stopped at 24,000 of 48,000. Its finally step sets refresh_interval back to 1s.") &&
        has("23:19:01 Refresh: 24,000 clippings become searchable.") &&
        has("23:40:01 Refresh: the obituary becomes searchable, 1 s after it was indexed.") &&
        t.stat("obit") === "1 s" && t.stat("save") === "returned after 1 s" && t.stat("pending") === 0 &&
        t.stat("segments") === 2 && t.stat("refresh") === "1s" && ids() === "c6,c1",
        "Finally step: 1s again at 23:19:00, 24,000 searchable 23:19:01, obituary 1 s after indexing, save after 1 s, 2 segments");

      // 9. The alert, with the job as now.
      t.click("reset");
      t.set("alert", true);
      t.click("run0130");
      t.expect(has("23:25:00 ALERT: refreshing has been off on the morgue index for 10 minutes. Lanyon is paged.") &&
        has("23:30:00 Lanyon sets refresh_interval back to 1s.") && has("23:30:01 Refresh: 24,000 clippings become searchable.") &&
        t.stat("alert") === "fired 23:25:00" && t.stat("obit") === "1 s" && t.stat("pending") === 0,
        "Alert: fires at 23:25:00, 1s again at 23:30:00, 24,000 searchable 23:30:01, obituary 1 s");

      // 10. 1 ms with the job as now: the job sets -1 anyway.
      t.set("alert", false);
      t.set("interval", "1");
      t.click("run0130");
      t.expect(t.stat("refresh") === "-1 (disabled)" && t.stat("pending") === "24,001" && t.stat("obit") === "waiting since 23:40:00" &&
        has("Reindex job starts: PUT /morgue/_settings refresh_interval -1 (was 1ms)."),
        "1ms on the index, job as now: the job still sets -1, 24,001 hidden at 01:30");

      // 11. 1 ms with the job leaving it alone: half the load speed and 240,001 segments.
      t.set("job", "alone");
      t.click("run0130");
      var ms = t.stat("loaded") === "12,000 of 48,000" && t.stat("segments") === "240,001" && t.stat("obit") === "0.001 s" &&
        t.stat("refresh") === "1ms" && t.stat("pending") === 0;
      t.set("crash", false);
      t.click("run0130");
      t.expect(ms && t.stat("loaded") === "48,000 of 48,000" && t.stat("segments") === "960,001" &&
        has("23:31:00 Reindex job done: 48,000 of 48,000 loaded."),
        "1ms, job leaves it alone: 12,000 loaded by 23:19:00, 240,001 segments, obituary 0.001 s; a full run ends 23:31:00 with 960,001");

      // 12. Stemmer and synonyms off, as now: one hit, and the obituary still hidden.
      t.click("reset");
      t.set("stem", false);
      t.set("syn", false);
      t.click("run0130");
      t.set("query", "drowned");
      t.expect(ids() === "c3" && scores() === "1.9654" && t.stat("obit") === "waiting since 23:40:00" && t.stat("pending") === "24,001",
        "Stemmer and synonyms off at 01:30: drowned finds only 1987 (1.9654), and the obituary is still hidden");

      // 13. LIKE on the database: fresh, unranked, slow.
      t.set("like", true);
      var likeDrowned = ids() === "c6,c3" && t.stat("reads") === "1,214,000 rows, 2,428 ms" && t.stat("top") === "none" &&
        has("LIKE '%drowned%' on the database: 2 hits, newest first: 2026-10-08, 1987-08-02. Read 1,214,000 rows, 2,428 ms.");
      t.set("query", "Bolitho");
      var likeBol = ids() === "c6,c1";
      t.set("query", "the drowning");
      t.expect(likeDrowned && likeBol && t.stat("hits") === 0,
        "LIKE at 01:30: drowned finds the obituary and 1987, newest first, 2,428 ms; Bolitho finds both; the drowning finds nothing");

      // 14. Stop words: the drowning at 23:14:00.
      t.click("reset");
      t.set("query", "the drowning");
      var off = t.stat("hits") === 5;
      t.set("stop", true);
      t.expect(off && t.stat("hits") === 3 && ids() === "c3,c4,c1",
        "the drowning at 23:14:00: 5 hits with stop words off (the matches c2 and c5), 3 with them on");

      // 15. Reset returns to the opening state.
      t.click("reset");
      t.expect(t.api.state.night.t === START && t.stat("refresh") === "1s" && t.stat("pending") === 0 && t.stat("top") === 1.2372 &&
        t.api.state.job === "asnow" && t.api.state.crash && !t.api.state.alert && !t.api.state.waitfor && !t.api.state.like &&
        t.api.state.an.lower && t.api.state.an.syn && !t.api.state.an.stop && t.api.state.an.stem,
        "Reset returns to Thursday as now at 23:14:00");
    }
  });
})();
