/* sims/s1e09-v1.0.0.js  (published as sims/s1e09.js)
   Case s1e09 "The Filing Cabinet": a real SQL console over a small copy of the county's records.

   CHANGELOG
   v1.0.0 (2026-10-06) first version: a widget-style sim built inside api.root (no diagram). It loads
     sql.js (SQLite compiled to JavaScript) from vendor/sql-asm.js with DL.util.loadScript, then
     initSqlJs() and new SQL.Database(), and seeds three tables: residents (no id 13), deeds and
     visits (two visits by resident 13 at 3:07 AM, as in the story). Controls: engine (SQLite or
     plain JavaScript), preset (fills the query box), run, race (the N+1 race), reset. Stats:
     queries run, rows returned, simulated ms at 1 ms per query (a teaching assumption). If sql.js
     can't load, a calm message appears, the presets are answered by plain JavaScript and the N+1
     race still runs. selfTest checks the counting rule (1 + N, 1, 2), the fallback path end to
     end, and, when initSqlJs is available, a real inner join and left join in SQLite.

   Notes for anyone copying this file:
   - Everything the user types goes into .value or textContent, never innerHTML or api.info.
   - The loaded SQL module lives in this file's closure, so a reset doesn't load it again. Each
     setup opens a fresh in-memory database and seeds it, and closes the previous one for this
     container.
   - The N+1 race runs the same counting code against either engine: a "source" object answers
     the four kinds of question, and every call to it is one query, one round trip.
   - No network is used except loading vendor/sql-asm.js. Deterministic: no randomness at all.
*/
(function () {
  "use strict";

  var VENDOR = "vendor/sql-asm.js";
  var MS_PER_QUERY = 1;           // teaching assumption: one round trip plus a little work
  var OFFICE_VISITS = 4811;       // the story's report
  var OFFICE_MS_EACH = 4;         // the story: 4,812 queries in about 19 seconds
  var LOAD_GRACE = 8;             // seconds the sim waits for the engine before falling back
  var MAX_SHOWN = 200;            // result rows drawn in the table

  var SQL_MODULE = null;          // the loaded sql.js module, shared by every mount
  var enginePromise = null;

  /* ---------- the records (a small copy of the office's cabinet) ---------- */

  // residents: id, name, street, born. Abernethy's card index never used 13.
  var RESIDENTS = [
    [1, "Agnes Merriwether", "Coldwater Lane", 1931],
    [2, "Bram Holloway", "Vesper Row", 1958],
    [3, "Cora Vane", "Lantern Street", 1944],
    [4, "Ellis Abernethy", "Thornfield Road", 1950],
    [5, "Edith Marrow", "Coldwater Lane", 1962],
    [6, "Fenwick Pell", "Vesper Row", 1939],
    [7, "Greta Lisle", "Mill Hollow", 1971],
    [8, "Hollis Crane", "Lantern Street", 1985],
    [9, "Ida Sorrel", "Coldwater Lane", 1949],
    [10, "Jonah Wick", "Thornfield Road", 1990],
    [11, "Kit Ambery", "Mill Hollow", 1967],
    [12, "Lorne Hatch", "Vesper Row", 1955],
    [14, "Mabel Quill", "Coldwater Lane", 1936],
    [15, "Nell Ashdown", "Lantern Street", 1978]
  ];

  // deeds: id, resident_id, parcel, recorded
  var DEEDS = [
    [1, 1, "CL-04", "1962-05-01"],
    [2, 5, "CL-09", "1988-10-31"],
    [3, 6, "VR-02", "1971-03-14"],
    [4, 9, "CL-11", "1979-07-22"],
    [5, 12, "VR-07", "1990-01-09"],
    [6, 14, "CL-01", "1958-11-02"],
    [7, 4, "TR-03", "1983-06-17"],
    [8, 2, "VR-05", "2001-02-27"]
  ];

  // visits: id, resident_id, visited_at, desk. Resident 13 signs in at 3:07 AM, twice.
  var VISITS = [
    [1, 13, "2026-10-04 03:07", "night door"],
    [2, 5, "2026-10-04 10:12", "deeds"],
    [3, 1, "2026-10-04 10:40", "maps"],
    [4, 9, "2026-10-04 11:05", "deeds"],
    [5, 5, "2026-10-04 14:30", "maps"],
    [6, 14, "2026-10-04 15:45", "deeds"],
    [7, 13, "2026-10-05 03:07", "night door"],
    [8, 12, "2026-10-05 09:58", "deeds"],
    [9, 6, "2026-10-05 10:20", "maps"],
    [10, 5, "2026-10-05 11:15", "deeds"],
    [11, 2, "2026-10-05 13:02", "deeds"],
    [12, 9, "2026-10-05 16:40", "maps"]
  ];

  function q(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

  function seedSql() {
    var out = [
      "CREATE TABLE residents (id INTEGER PRIMARY KEY, name TEXT NOT NULL, street TEXT, born INTEGER);",
      "CREATE TABLE deeds (id INTEGER PRIMARY KEY, resident_id INTEGER REFERENCES residents(id), parcel TEXT, recorded TEXT);",
      "CREATE TABLE visits (id INTEGER PRIMARY KEY, resident_id INTEGER REFERENCES residents(id), visited_at TEXT, desk TEXT);"
    ];
    RESIDENTS.forEach(function (r) { out.push("INSERT INTO residents VALUES (" + r[0] + ", " + q(r[1]) + ", " + q(r[2]) + ", " + r[3] + ");"); });
    DEEDS.forEach(function (d) { out.push("INSERT INTO deeds VALUES (" + d[0] + ", " + d[1] + ", " + q(d[2]) + ", " + q(d[3]) + ");"); });
    VISITS.forEach(function (v) { out.push("INSERT INTO visits VALUES (" + v[0] + ", " + v[1] + ", " + q(v[2]) + ", " + q(v[3]) + ");"); });
    return out.join("\n");
  }

  function freshData() {
    function copy(rows) { return rows.map(function (r) { return r.slice(); }); }
    return { residents: copy(RESIDENTS), deeds: copy(DEEDS), visits: copy(VISITS), fk: false };
  }

  /* ---------- plain-JavaScript answers (used when the SQL engine is missing) ---------- */

  function residentById(data, id) {
    for (var i = 0; i < data.residents.length; i++) if (data.residents[i][0] === id) return data.residents[i];
    return null;
  }

  function byTime(a, b) { return a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : a[0] - b[0]; }

  function table(columns, rows) { return { columns: columns, rows: rows, changed: 0, error: "", note: "" }; }

  function addVisit(data, rid, at, desk) {
    if (data.fk && !residentById(data, rid)) {
      var r = table([], []);
      r.error = "FOREIGN KEY constraint failed";
      return r;
    }
    var max = 0;
    data.visits.forEach(function (v) { if (v[0] > max) max = v[0]; });
    data.visits.push([max + 1, rid, at, desk]);
    var ok = table([], []);
    ok.changed = 1;
    return ok;
  }

  /* ---------- presets: the SQL text, and the same answer computed in plain JavaScript ---------- */

  var PRESETS = [
    {
      value: "all", label: "All residents (SELECT *)",
      sql: "SELECT * FROM residents;",
      js: function (d) { return table(["id", "name", "street", "born"], d.residents.map(function (r) { return r.slice(); })); }
    },
    {
      value: "where", label: "WHERE and ORDER BY",
      sql: "SELECT name, street FROM residents\nWHERE street = 'Coldwater Lane'\nORDER BY name;",
      js: function (d) {
        var rows = d.residents.filter(function (r) { return r[2] === "Coldwater Lane"; })
          .map(function (r) { return [r[1], r[2]]; })
          .sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
        return table(["name", "street"], rows);
      }
    },
    {
      value: "inner", label: "INNER JOIN visits to residents",
      sql: "SELECT visits.id, visits.visited_at, residents.name\nFROM visits\nJOIN residents ON residents.id = visits.resident_id\nORDER BY visits.visited_at;",
      js: function (d) {
        var rows = [];
        d.visits.slice().sort(byTime).forEach(function (v) {
          var r = residentById(d, v[1]);
          if (r) rows.push([v[0], v[2], r[1]]);
        });
        return table(["id", "visited_at", "name"], rows);
      }
    },
    {
      value: "left", label: "LEFT JOIN (keeps every visit)",
      sql: "SELECT visits.id, visits.visited_at, residents.name\nFROM visits\nLEFT JOIN residents ON residents.id = visits.resident_id\nORDER BY visits.visited_at;",
      js: function (d) {
        var rows = d.visits.slice().sort(byTime).map(function (v) {
          var r = residentById(d, v[1]);
          return [v[0], v[2], r ? r[1] : null];
        });
        return table(["id", "visited_at", "name"], rows);
      }
    },
    {
      value: "count", label: "GROUP BY and COUNT(*)",
      sql: "SELECT resident_id, COUNT(*) AS visits\nFROM visits\nGROUP BY resident_id\nORDER BY visits DESC, resident_id;",
      js: function (d) {
        var counts = {};
        d.visits.forEach(function (v) { counts[v[1]] = (counts[v[1]] || 0) + 1; });
        var rows = Object.keys(counts).map(function (k) { return [Number(k), counts[k]]; })
          .sort(function (a, b) { return b[1] - a[1] || a[0] - b[0]; });
        return table(["resident_id", "visits"], rows);
      }
    },
    {
      value: "orphans", label: "Visits with no resident",
      sql: "SELECT visits.*\nFROM visits\nLEFT JOIN residents ON residents.id = visits.resident_id\nWHERE residents.id IS NULL;",
      js: function (d) {
        var rows = d.visits.filter(function (v) { return !residentById(d, v[1]); })
          .sort(function (a, b) { return a[0] - b[0]; })
          .map(function (v) { return v.slice(); });
        return table(["id", "resident_id", "visited_at", "desk"], rows);
      }
    },
    {
      value: "insert", label: "INSERT a visit",
      sql: "INSERT INTO visits (resident_id, visited_at, desk)\nVALUES (7, '2026-10-06 03:30', 'deeds');",
      js: function (d) { return addVisit(d, 7, "2026-10-06 03:30", "deeds"); }
    },
    {
      value: "fk", label: "Foreign keys ON, then a visit by 13",
      sql: "PRAGMA foreign_keys = ON;\nINSERT INTO visits (resident_id, visited_at, desk)\nVALUES (13, '2026-10-06 03:07', 'night door');",
      js: function (d) { d.fk = true; return addVisit(d, 13, "2026-10-06 03:07", "night door"); }
    }
  ];

  var PRESET_OPTIONS = PRESETS.map(function (p) { return { value: p.value, label: p.label }; });

  function presetByValue(v) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].value === v) return PRESETS[i];
    return null;
  }

  function normalize(sql) {
    return String(sql || "").replace(/\s+/g, " ").replace(/\s*;\s*$/, "").trim().toLowerCase();
  }

  function presetBySql(sql) {
    var n = normalize(sql);
    for (var i = 0; i < PRESETS.length; i++) if (normalize(PRESETS[i].sql) === n) return PRESETS[i];
    return null;
  }

  /* ---------- the N+1 race: the same counting code for either engine ---------- */

  // How many queries each way of building the report needs for n visits.
  function plan(n) { return { loop: 1 + n, join: 1, batch: 2 }; }

  function sqlSource(db) {
    function rows(sql) { var r = db.exec(sql); return r.length ? r[0].values : []; }
    return {
      visits: function () { return rows("SELECT id, resident_id, visited_at FROM visits ORDER BY visited_at;"); },
      nameOf: function (id) { return rows("SELECT name FROM residents WHERE id = " + Number(id) + ";"); },
      leftJoin: function () {
        return rows("SELECT visits.id, visits.resident_id, visits.visited_at, residents.name FROM visits " +
          "LEFT JOIN residents ON residents.id = visits.resident_id ORDER BY visits.visited_at;");
      },
      namesIn: function (ids) {
        if (!ids.length) return [];
        return rows("SELECT id, name FROM residents WHERE id IN (" + ids.map(Number).join(", ") + ");");
      }
    };
  }

  function jsSource(data) {
    return {
      visits: function () { return data.visits.slice().sort(byTime).map(function (v) { return [v[0], v[1], v[2]]; }); },
      nameOf: function (id) { var r = residentById(data, Number(id)); return r ? [[r[1]]] : []; },
      leftJoin: function () {
        return data.visits.slice().sort(byTime).map(function (v) {
          var r = residentById(data, v[1]);
          return [v[0], v[1], v[2], r ? r[1] : null];
        });
      },
      namesIn: function (ids) {
        var out = [];
        ids.forEach(function (id) { var r = residentById(data, Number(id)); if (r) out.push([r[0], r[1]]); });
        return out;
      }
    };
  }

  function sameReport(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
    return true;
  }

  // Every call to the source is one query. The report is a list of [visit id, name or null].
  function race(source) {
    var loopQ = 0, loopRows = 0;
    var list = source.visits(); loopQ += 1; loopRows += list.length;
    var loopReport = list.map(function (v) {
      var found = source.nameOf(v[1]); loopQ += 1; loopRows += found.length;
      return [v[0], found.length ? found[0][0] : null];
    });

    var joined = source.leftJoin();
    var joinReport = joined.map(function (r) { return [r[0], r[3]]; });

    var list2 = source.visits();
    var ids = [];
    list2.forEach(function (v) { if (ids.indexOf(v[1]) < 0) ids.push(v[1]); });
    var names = source.namesIn(ids);
    var byId = {};
    names.forEach(function (n) { byId[n[0]] = n[1]; });
    var batchReport = list2.map(function (v) { return [v[0], Object.prototype.hasOwnProperty.call(byId, v[1]) ? byId[v[1]] : null]; });

    var blanks = 0;
    loopReport.forEach(function (r) { if (r[1] === null) blanks += 1; });
    return {
      visits: list.length,
      blanks: blanks,
      loop: { queries: loopQ, rows: loopRows },
      join: { queries: 1, rows: joined.length },
      batch: { queries: 2, rows: list2.length + names.length },
      same: sameReport(loopReport, joinReport) && sameReport(loopReport, batchReport)
    };
  }

  /* ---------- loading the SQL engine ---------- */

  function initFn() {
    var g = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null);
    return g && typeof g.initSqlJs === "function" ? g.initSqlJs : null;
  }

  function loadEngine() {
    if (!enginePromise) {
      enginePromise = new Promise(function (resolve, reject) {
        if (initFn()) { resolve(); return; }
        if (!DL.util || typeof DL.util.loadScript !== "function") { reject(new Error("no script loader")); return; }
        Promise.resolve(DL.util.loadScript(VENDOR)).then(resolve, reject);
      }).then(function () {
        var init = initFn();
        if (!init) throw new Error("initSqlJs is missing after loading " + VENDOR);
        return init();
      });
      // A failed load is forgotten, so a later reset can try again.
      enginePromise.then(null, function () { enginePromise = null; });
    }
    return enginePromise;
  }

  function startEngine(api) {
    var S = api.state;
    var session = S.session;
    if (SQL_MODULE) { openDb(api); return; }
    var p;
    try { p = loadEngine(); } catch (e) { p = Promise.reject(e); }
    p.then(function (SQL) {
      if (!SQL || typeof SQL.Database !== "function") throw new Error("the SQL module has no Database");
      SQL_MODULE = SQL;
      if (api.state.session === session) openDb(api);
    }).then(null, function (e) {
      if (api.state.session === session && api.state.engine === "loading") loadFailed(api, session, e);
    });
  }

  function openDb(api) {
    var S = api.state;
    try {
      var old = api.root._s1e09db;
      if (old) { try { old.close(); } catch (e) { /* already closed */ } }
      var db = new SQL_MODULE.Database();
      db.exec(seedSql());
      api.root._s1e09db = db;
      S.db = db;
      var late = S.engine === "failed";
      S.engine = "ready";
      S.ctl.engine.disable(false);
      if (late) {
        api.log("The SQL engine arrived late. Switch Engine to SQLite to run your own SQL.", "ok");
      } else {
        api.log("The SQL engine is ready: SQLite, running in your browser, with the three tables seeded.", "ok");
      }
      showStatus(api);
    } catch (e) {
      loadFailed(api, S.session, e);
    }
  }

  // The engine couldn't load. Nothing breaks: presets and the race run in plain JavaScript.
  function loadFailed(api, session, err) {
    var S = api.state;
    if (S.session !== session) return;
    S.engine = "failed";
    S.mode = "js";
    S.ctl.engine.set("js");
    S.ctl.engine.disable(true);
    api.log("The SQL engine didn't load (" + (err && err.message ? err.message : "unknown reason") + "). Presets and the N+1 race carry on in plain JavaScript.", "warn");
    showStatus(api);
  }

  function useSql(S) { return S.mode === "sql" && S.engine === "ready" && !!S.db; }

  /* ---------- running a query ---------- */

  function runSql(db, text) {
    try {
      var res = db.exec(text);
      var out = table([], []);
      if (res.length) {
        out.columns = res[res.length - 1].columns;
        out.rows = res[res.length - 1].values;
      }
      if (res.length > 1) out.note = "Several statements returned rows; this is the last result.";
      if (!res.length && /^\s*(insert|update|delete)/i.test(text)) out.changed = db.getRowsModified();
      return out;
    } catch (e) {
      var bad = table([], []);
      bad.error = String(e && e.message ? e.message : e);
      return bad;
    }
  }

  function record(api, queries, rows) {
    var S = api.state;
    S.count.queries += queries;
    S.count.rows += rows;
    S.count.ms += queries * MS_PER_QUERY;
    S.stat.queries(S.count.queries);
    S.stat.rows(S.count.rows);
    S.stat.ms(S.count.ms);
  }

  function run(api) {
    var S = api.state;
    var text = S.ui.sql.value;
    if (!String(text).trim()) { showMessage(api, "The query box is empty. Pick a preset or type some SQL.", ""); return; }
    var res;
    var by;
    if (useSql(S)) {
      res = runSql(S.db, text);
      by = "SQLite";
    } else {
      var preset = presetBySql(text);
      if (!preset) {
        S.last = null;
        clearTable(S.ui.result);
        showMessage(api, S.engine === "loading"
          ? "The SQL engine is still loading. Until it's ready, only the preset queries can run, answered by plain JavaScript. Try again in a moment."
          : "The SQL engine isn't running, so only the preset queries can run here, answered by plain JavaScript. The N+1 race works either way.", "warn");
        return;
      }
      res = preset.js(S.data);
      by = "plain JavaScript";
    }
    S.last = res;
    record(api, 1, res.rows.length);
    drawResult(api, res);
    var first = String(text).trim().split(/\s+/)[0].toUpperCase();
    if (res.error) {
      showMessage(api, "Refused: " + res.error + ".", "bad");
      api.log(first + " refused by " + by + ": " + res.error + ".", "bad");
    } else if (res.columns.length) {
      var nulls = 0;
      res.rows.forEach(function (r) { r.forEach(function (c) { if (c === null) nulls += 1; }); });
      showMessage(api, res.rows.length + (res.rows.length === 1 ? " row" : " rows") + " (" + by + ")." + (nulls ? " " + nulls + " empty (NULL) " + (nulls === 1 ? "value" : "values") + "." : "") + (res.note ? " " + res.note : ""), nulls ? "warn" : "ok");
      api.log(first + " returned " + res.rows.length + (res.rows.length === 1 ? " row" : " rows") + (nulls ? ", " + nulls + " NULL" : "") + ". 1 query, 1 simulated ms.", nulls ? "warn" : "");
    } else {
      showMessage(api, "Done (" + by + ")." + (res.changed ? " " + res.changed + (res.changed === 1 ? " row" : " rows") + " changed." : ""), "ok");
      api.log(first + " done" + (res.changed ? ": " + res.changed + (res.changed === 1 ? " row" : " rows") + " changed" : "") + ".", "ok");
    }
  }

  function startRace(api) {
    var S = api.state;
    var sql = useSql(S);
    var r;
    try {
      r = race(sql ? sqlSource(S.db) : jsSource(S.data));
    } catch (e) {
      S.race = null;
      S.ui.race.textContent = "The race needs the visits and residents tables as they were. Press Reset to put them back. (" + String(e && e.message ? e.message : e) + ")";
      api.log("The N+1 race couldn't run: " + String(e && e.message ? e.message : e) + ".", "bad");
      return;
    }
    r.engine = sql ? "sql" : "js";
    S.race = r;
    record(api, r.loop.queries + r.join.queries + r.batch.queries, r.loop.rows + r.join.rows + r.batch.rows);
    var office = plan(OFFICE_VISITS);
    function line(name, part) {
      var qs = part.queries + (part.queries === 1 ? " query" : " queries");
      return "  " + name.padEnd(12) + qs.padStart(11) + (part.queries * MS_PER_QUERY + " ms").padStart(8);
    }
    S.ui.race.textContent = [
      "The visitor report, three ways (" + (sql ? "SQLite" : "plain JavaScript") + ", 1 ms per query):",
      line("N+1 loop", r.loop),
      line("LEFT JOIN", r.join),
      line("batched IN", r.batch),
      "",
      (r.same ? "Same answer all three ways: " : "The answers differ: ") + r.visits + " visits, " + r.blanks + " with no name (resident 13).",
      "At the office's size, " + commas(OFFICE_VISITS) + " visits, the loop is " + commas(office.loop) +
        " queries: " + (office.loop * MS_PER_QUERY / 1000).toFixed(1) + " s at 1 ms each. The office's took about " +
        Math.round(office.loop * OFFICE_MS_EACH / 1000) + " s, about " + OFFICE_MS_EACH + " ms each."
    ].join("\n");
    api.log("N+1 race: the loop made " + r.loop.queries + " queries, the join 1, the batched IN 2. " + (r.same ? "Same report every time." : "The reports differ."), "warn");
  }

  function setMode(api, v) {
    var S = api.state;
    if (v === "sql" && S.engine !== "ready") {
      S.mode = "js";
      S.ctl.engine.set("js");
      showStatus(api);
      return;
    }
    S.mode = v === "sql" ? "sql" : "js";
    showStatus(api);
    api.log(S.mode === "sql" ? "Engine: SQLite. Any SQL you type runs for real." : "Engine: plain JavaScript. Presets and the race work; your own SQL needs SQLite.", "");
  }

  /* ---------- the console (plain DOM inside api.root) ---------- */

  function showStatus(api) {
    var S = api.state;
    var t;
    if (S.engine === "loading") t = "Loading the SQL engine (SQLite)... Presets already work.";
    else if (S.engine === "failed") t = "The SQL engine didn't load, maybe blocked or offline. That's fine: the preset queries and the N+1 race still run, answered by plain JavaScript.";
    else if (S.mode === "sql") t = "SQL engine ready: SQLite, running in your browser. Type any SQL. Reset puts the records back.";
    else t = "Running in plain JavaScript. Presets and the N+1 race work; switch Engine to SQLite to run your own SQL.";
    S.ui.status.textContent = t;
  }

  function showMessage(api, text, tone) {
    var m = api.state.ui.msg;
    m.textContent = text;
    var color = tone === "bad" ? "var(--red)" : tone === "warn" ? "var(--amber)" : tone === "ok" ? "var(--green)" : "var(--muted)";
    m.style.color = color;
  }

  function clearTable(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function drawResult(api, res) {
    var ui = api.state.ui;
    var doc = api.root.ownerDocument;
    clearTable(ui.result);
    if (!res.columns.length) return;
    var tbl = doc.createElement("table");
    tbl.setAttribute("style", "border-collapse:collapse;font-family:var(--f-ui);font-size:12px;min-width:100%;");
    var head = doc.createElement("tr");
    res.columns.forEach(function (c) {
      var th = doc.createElement("th");
      th.textContent = c;
      th.setAttribute("style", "text-align:left;padding:4px 10px 4px 0;color:var(--muted);border-bottom:1px solid var(--line);");
      head.appendChild(th);
    });
    var thead = doc.createElement("thead");
    thead.appendChild(head);
    tbl.appendChild(thead);
    var body = doc.createElement("tbody");
    res.rows.slice(0, MAX_SHOWN).forEach(function (row) {
      var tr = doc.createElement("tr");
      row.forEach(function (cell) {
        var td = doc.createElement("td");
        var isNull = cell === null || cell === undefined;
        td.textContent = isNull ? "NULL" : String(cell);
        td.setAttribute("style", "padding:3px 10px 3px 0;border-bottom:1px solid var(--line);" + (isNull ? "color:var(--amber);font-style:italic;" : ""));
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    tbl.appendChild(body);
    ui.result.appendChild(tbl);
    if (res.rows.length > MAX_SHOWN) {
      var more = doc.createElement("p");
      more.setAttribute("style", "margin:6px 0 0;color:var(--muted);font-size:12px;");
      more.textContent = "Showing the first " + MAX_SHOWN + " of " + res.rows.length + " rows.";
      ui.result.appendChild(more);
    }
  }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text !== undefined && text !== null) e.textContent = text;
      return e;
    }
    var labelStyle = "display:block;color:var(--muted);font-family:var(--f-ui);font-size:12px;margin:12px 0 4px;";
    var pane = "margin:0;overflow:auto;white-space:pre;font-size:12px;";

    var box = el("div", "min-width:0;");
    var status = el("p", "margin:0 0 4px;font-family:var(--f-ui);font-size:12px;color:var(--muted);", "");
    status.setAttribute("aria-live", "polite");
    box.appendChild(status);

    box.appendChild(el("p", labelStyle, "The cabinet: three tables"));
    var schema = el("pre", pane, [
      "residents (id PRIMARY KEY, name, street, born)              14 rows, no id 13",
      "deeds     (id PRIMARY KEY, resident_id -> residents.id, parcel, recorded)   8 rows",
      "visits    (id PRIMARY KEY, resident_id -> residents.id, visited_at, desk)  12 rows"
    ].join("\n"));
    schema.className = "logline";
    schema.setAttribute("tabindex", "0");
    box.appendChild(schema);

    var lab = el("label", labelStyle, "Your query (SQL). Ctrl+Enter runs it.");
    lab.setAttribute("for", "s1e09-sql");
    box.appendChild(lab);
    var sql = el("textarea", "width:100%;box-sizing:border-box;font-family:var(--f-ui);font-size:13px;color:var(--fg);" +
      "background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r);padding:8px;resize:vertical;");
    sql.id = "s1e09-sql";
    sql.rows = 5;
    sql.setAttribute("spellcheck", "false");
    sql.setAttribute("autocomplete", "off");
    sql.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        if (typeof e.preventDefault === "function") e.preventDefault();
        run(api);
      }
    });
    box.appendChild(sql);

    var msg = el("p", "margin:8px 0 6px;font-family:var(--f-ui);font-size:12px;color:var(--muted);", "Nothing run yet.");
    msg.setAttribute("aria-live", "polite");
    box.appendChild(msg);
    var result = el("div", "overflow-x:auto;max-height:260px;overflow-y:auto;");
    result.setAttribute("tabindex", "0");
    result.setAttribute("aria-label", "Query result");
    box.appendChild(result);

    box.appendChild(el("p", labelStyle, "N+1 race"));
    var raceOut = el("pre", pane, "Press N+1 race to build the visitor report three ways and count the queries.");
    raceOut.className = "logline";
    raceOut.setAttribute("tabindex", "0");
    raceOut.setAttribute("aria-live", "polite");
    box.appendChild(raceOut);

    api.root.appendChild(box);
    return { status: status, sql: sql, msg: msg, result: result, race: raceOut };
  }

  /* ---------- the module ---------- */

  DL.sims.define("s1e09", {
    setup: function (api) {
      var S = api.state;
      S.session = {};
      S.engine = "loading";
      S.mode = "sql";
      S.db = null;
      S.data = freshData();
      S.last = null;
      S.race = null;
      S.count = { queries: 0, rows: 0, ms: 0 };
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.engine = api.control.select("engine", "Engine", [
        { value: "sql", label: "SQLite (real SQL)" },
        { value: "js", label: "Plain JavaScript (presets only)" }
      ], "sql", function (v) { setMode(api, v); });
      S.ctl.preset = api.control.select("preset", "Preset (fills the query box)", PRESET_OPTIONS, "all", function (v) {
        var p = presetByValue(v);
        if (p) S.ui.sql.value = p.sql;
      });
      S.ctl.run = api.control.button("run", "Run query", function () { run(api); }, { tone: "primary", wide: true });
      S.ctl.race = api.control.button("race", "N+1 race", function () { startRace(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        queries: api.stat("queries", "queries run", ""),
        rows: api.stat("rows", "rows returned", ""),
        ms: api.stat("ms", "simulated ms (1 per query)", "warn")
      };
      record(api, 0, 0);
      S.ui.sql.value = PRESETS[0].sql;

      showStatus(api);
      startEngine(api);
      api.after(LOAD_GRACE, function () {
        if (api.state === S && S.engine === "loading") loadFailed(api, S.session, new Error("it took too long"));
      });

      api.info("<strong>Tip:</strong> the presets fill the query box, and you can edit them before you press Run. NULL means \"no value\": it's what a left join puts where nothing matched.");
      api.log("Larkmoor County's records, a small copy: 14 residents (no 13), 8 deeds, 12 visits.", "");
    },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      function St() { return t.api.state; }
      function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
      function nulls(res, col) {
        if (!res) return -1;
        var i = res.columns.indexOf(col);
        var c = 0;
        res.rows.forEach(function (r) { if (r[i] === null) c += 1; });
        return c;
      }

      // 1. The counting rule behind the race, and the story's numbers.
      var small = plan(VISITS.length), office = plan(OFFICE_VISITS);
      t.expect(small.loop === 13 && small.join === 1 && small.batch === 2, "12 visits: the loop needs 13 queries, a join 1, a batched IN 2");
      t.expect(office.loop === 4812 && office.loop * MS_PER_QUERY === 4812 && office.loop * OFFICE_MS_EACH === 19248,
        "the office's 4,811 visits mean 4,812 queries: 4.8 s at 1 ms each, 19.248 s at the story's 4 ms each");

      // 2. Give the engine a few real seconds to load or fail.
      for (var i = 0; i < 150 && St().engine === "loading"; i++) {
        await sleep(100);
        await t.run(0.02);
      }
      t.expect(St().engine !== "loading", "the SQL engine either loads or falls back to plain JavaScript");

      // 3. Real SQLite, when initSqlJs is available.
      if (St().engine === "ready") {
        t.set("engine", "sql");
        t.set("preset", "inner");
        t.click("run");
        var inner = St().last;
        t.set("preset", "left");
        t.click("run");
        var left = St().last;
        t.expect(!!inner && inner.rows.length === 10 && !!left && left.rows.length === 12 && nulls(left, "name") === 2,
          "real SQLite: the inner join drops resident 13's two visits, the left join keeps all 12 with 2 NULL names");
        t.click("race");
        var rs = St().race;
        t.expect(!!rs && rs.engine === "sql" && rs.loop.queries === 13 && rs.join.queries === 1 && rs.batch.queries === 2 && rs.same,
          "real SQLite race: 13 queries against 1 and 2, with the same report");
      } else {
        t.expect(St().ui.status.textContent.indexOf("plain JavaScript") >= 0, "without the SQL engine, a calm message says the presets and the race still work");
      }

      // 4. The fallback path: the engine fails to load.
      loadFailed(t.api, St().session, new Error("blocked (self-test)"));
      t.expect(St().mode === "js" && St().ui.status.textContent.indexOf("still run") >= 0, "after a failed load the sim switches to plain JavaScript and says so calmly");
      var q0 = n("queries"), ms0 = n("ms");
      t.click("race");
      var r = St().race;
      t.expect(!!r && r.engine === "js" && r.loop.queries === 13 && r.join.queries === 1 && r.batch.queries === 2 && r.same && r.blanks === 2,
        "without SQLite the N+1 race still counts 13, 1 and 2 queries, with the same report and 2 blank names");
      t.expect(n("queries") === q0 + 16 && n("ms") === ms0 + 16, "the race adds 16 queries and 16 simulated ms, 1 ms each");

      // 5. Presets answered in plain JavaScript.
      t.set("preset", "inner");
      t.click("run");
      var jsInner = St().last;
      t.set("preset", "left");
      t.click("run");
      var jsLeft = St().last;
      t.expect(!!jsInner && jsInner.rows.length === 10 && !!jsLeft && jsLeft.rows.length === 12 && nulls(jsLeft, "name") === 2,
        "in plain JavaScript the joins match SQLite: 10 rows for inner, 12 with 2 NULL names for left");
      t.set("preset", "fk");
      t.click("run");
      t.expect(!!St().last && St().last.error.indexOf("FOREIGN KEY constraint failed") >= 0, "with foreign keys on, a visit by resident 13 is refused");
      St().ui.sql.value = "SELECT name FROM deeds;";
      t.click("run");
      t.expect(St().ui.msg.textContent.indexOf("only the preset queries") >= 0, "your own SQL without the engine gets a calm explanation, not a crash");
    }
  });

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }
  function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
})();
