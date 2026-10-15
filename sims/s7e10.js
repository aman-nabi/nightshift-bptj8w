/* sims/s7e10-v1.0.0.js  (published as sims/s7e10.js)
   Case s7e10 "What We Keep": a retention lab for Fenwhistle Enquiries, a small private-investigation
   agency that has kept every record since 2014, "in case". A former client, Ms Brannigan, asked on
   Monday 21 September 2026 for the personal data the agency holds about her. On the night of Tuesday
   13 October 2026 the night researcher, Vasanthi, puts the reply together and finds her 2016 case file,
   with notes on three neighbours who never hired the agency. The learner chooses how long records are
   kept (keep everything, as built, or a schedule per kind), whether each record carries a purpose label,
   whether deletion reaches the backups (each nightly copy kept 35 days), whether other people's data is
   taken out of access replies, and whether the stores are encrypted. One button plays the six weeks
   from the night to the end of the backup cycle. Widget-style sim: it draws inside api.root.
   It models the defence and its numbers only. No real file, record or person is read; every record is
   a count, and her records are described in general words.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: retention (keep everything, schedule per kind); purpose labels
     (on, off); deletion reaches backups (on, off); remove other people's data from access replies
     (on, off); encryption (on, off). Stats: records held after the first deletion run, notes on people
     who were never clients still held, records in her reply, people in her reply who were never
     clients, the 2016 file in live data, days until deleted data leaves the last backup, the date the
     2016 file leaves every backup, what a stolen copy shows. selfTest: 11 assertions.

   The model (stated in sim.lede), as given data from the case content/s7/s7e10-v1.0.0.json:
   - Cases opened per year, 2014 to 2026: 12, 14, 16, 15, 17, 18, 14, 16, 18, 19, 20, 20, 15. Sum 214.
   - Every case leaves 10 records: 1 client contact record, 5 case notes, 2 notes on other people the
     case touched (people who never hired the agency), 2 invoices. So 2,140 records: 214 contact, 1,070
     case notes, 428 notes on other people, 428 invoices.
   - Her 2016 case is one of 2016's 16 cases: 10 records. Its 2 notes on other people name 3 people
     (a couple across the road, the man next door) who were never clients.
   - Dates: request received Monday 21 September 2026; the PDPC guidance's 30 days end Wednesday
     21 October 2026; the reply is put together on Tuesday 13 October and sent Tuesday 20 October;
     the first deletion run is Monday 26 October 2026; a nightly copy is kept 35 days, so the last copy
     holding anything deleted on 26 October is gone on Monday 30 November 2026 (26 October + 35 days).
   - The schedule (given data): contact details, case notes and invoices kept for 7 years after the
     year the case closed; notes on people who were never clients kept until the end of the year after
     the case closed (1 year). On 26 October 2026 a record is deleted when its case year + its keep
     years is 2025 or earlier. With labels: kept 2019 to 2026 for the 7-year kinds (140 cases), 2025 to
     2026 for notes on others (35 cases): 140 + 700 + 280 + 70 = 1,190 held, 950 deleted, 70 notes on
     others. Without labels the run cannot tell the kinds apart and keeps every record 7 years:
     140 x 10 = 1,400 held, 740 deleted, 280 notes on others. Her 2016 file is deleted either way.
   - Backups as built: every nightly copy since 2014 kept, none deleted, so deleted data never leaves.
   - Her reply holds her 10 records; with other people's data taken out, 8 records and 0 people.
     Retention does not change tonight's reply: a request that is open holds its records back.
   - Encryption changes what a stolen copy shows, and no count.
   Where every number comes from (conventions rule 14): 2,140, 214, 10, 3, 8, the dates and 35 days come
   from the post and the given data above; 1,190, 950, 70, 1,400, 740 and 280 follow from it; every
   count is checked by the selfTest.
   Not modelled: the 22:10 search itself, the consent form of option 2 (it changes no number).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var NOW_YEAR = 2026;
  var HER_YEAR = 2016;
  var BACKUP_DAYS = 35;
  var YEARS = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  var CASES = { 2014: 12, 2015: 14, 2016: 16, 2017: 15, 2018: 17, 2019: 18, 2020: 14, 2021: 16, 2022: 18, 2023: 19, 2024: 20, 2025: 20, 2026: 15 };
  var KINDS = [
    { id: "contact", label: "contact details", per: 1, keep: 7 },
    { id: "notes", label: "case notes", per: 5, keep: 7 },
    { id: "others", label: "notes on others", per: 2, keep: 1 },
    { id: "invoices", label: "invoices", per: 2, keep: 7 }
  ];
  var LONGEST = 7;
  // Her 2016 file, in general words. people = people named who were never clients.
  var HER_FILE = [
    { kind: "contact", text: "07 Nov 2016  contact  her name, address and phone", people: 0 },
    { kind: "notes", text: "07 Nov 2016  case     what she asked us to find", people: 0 },
    { kind: "notes", text: "14 Nov 2016  case     progress", people: 0 },
    { kind: "notes", text: "21 Nov 2016  case     progress", people: 0 },
    { kind: "notes", text: "28 Nov 2016  case     what we found", people: 0 },
    { kind: "notes", text: "02 Dec 2016  case     case closed; file kept, no reason recorded", people: 0 },
    { kind: "others", text: "07-20 Nov    other    a couple across the road: times out and back, visitors", people: 2 },
    { kind: "others", text: "07-20 Nov    other    the man next door: times out and back, his car", people: 1 },
    { kind: "invoices", text: "21 Nov 2016  invoice  deposit", people: 0 },
    { kind: "invoices", text: "02 Dec 2016  invoice  final", people: 0 }
  ];

  var RETENTION = [
    { value: "keep", label: "keep everything (as built)" },
    { value: "schedule", label: "a schedule: how long each kind is kept, and why" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function keepYears(C, kind) {
    if (C.retention === "keep") return Infinity;
    return C.labels ? kind.keep : LONGEST;
  }
  // Is a record of this kind from this case year still held after the 26 October run?
  function kept(C, year, kind) {
    return year + keepYears(C, kind) >= NOW_YEAR;
  }
  function heldBy(C, year, kind) {
    return kept(C, year, kind) ? CASES[year] * kind.per : 0;
  }
  function totals(C) {
    var all = 0, held = 0, others = 0;
    YEARS.forEach(function (y) {
      KINDS.forEach(function (k) {
        all += CASES[y] * k.per;
        var h = heldBy(C, y, k);
        held += h;
        if (k.id === "others") others += h;
      });
    });
    return { all: all, held: held, deleted: all - held, others: others };
  }
  function herFileKept(C) {
    var any = false;
    KINDS.forEach(function (k) { if (kept(C, HER_YEAR, k)) any = true; });
    return any;
  }
  function reply(C) {
    var rows = HER_FILE.filter(function (r) { return !(C.strip && r.kind === "others"); });
    var people = 0;
    rows.forEach(function (r) { people += r.people; });
    return { rows: rows, people: people };
  }
  function backupLine(C) {
    if (totals(C).deleted === 0) return "nothing deleted";
    return C.backups ? BACKUP_DAYS : "never";
  }
  function goneLine(C) {
    if (herFileKept(C)) return "not deleted";
    return C.backups ? "30 November 2026" : "never";
  }

  /* ---------- the widget ---------- */

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["year", "cases", "contact details", "case notes", "notes on others", "invoices", "held"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;", h));
    });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);
    var her = el("pre", "margin:0;font-size:12px;white-space:pre-wrap;");
    box.appendChild(her);
    api.root.appendChild(box);
    return { el: el, head: head, tbody: tbody, her: her };
  }

  function drawTable(S) {
    var ui = S.ui;
    var C = S.C;
    clear(ui.tbody);
    YEARS.forEach(function (y) {
      var tr = ui.el("tr");
      var cells = [String(y) + (y === HER_YEAR ? " (her file)" : ""), String(CASES[y])];
      var rowHeld = 0;
      KINDS.forEach(function (k) {
        var n = CASES[y] * k.per;
        if (!S.ran) { cells.push(fmt(n)); rowHeld += n; return; }
        var h = heldBy(C, y, k);
        rowHeld += h;
        cells.push(h === n ? fmt(n) : "0 of " + fmt(n));
      });
      cells.push(fmt(rowHeld));
      cells.forEach(function (c) { tr.appendChild(ui.el("td", "", c)); });
      ui.tbody.appendChild(tr);
    });
  }

  function drawReply(S) {
    var C = S.C;
    var lines = ["Her 2016 file, in general words (kind, then what it holds):"];
    HER_FILE.forEach(function (r) {
      var out = C.strip && r.kind === "others";
      lines.push((out ? "  taken out  " : "  in reply   ") + r.text);
    });
    if (S.ran) {
      lines.push("");
      lines.push(herFileKept(C) ? "After 26 October: the file is still held." : "After 26 October: the file is deleted from live data.");
    }
    S.ui.her.textContent = lines.join("\n");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    S.ui.head.textContent = "Retention: " + pick(RETENTION, C.retention).label + ". Purpose labels: " + (C.labels ? "on" : "off") +
      ". Deletion reaches backups: " + (C.backups ? "on, each nightly copy kept 35 days" : "off, every nightly copy kept") +
      ". Other people taken out of replies: " + (C.strip ? "on" : "off") + ". Encryption: " + (C.encrypt ? "on" : "off") + ".";
    drawTable(S);
    drawReply(S);
    S.stat.stolen(C.encrypt ? "nothing readable" : "every record");
    if (!S.ran) {
      ["held", "others", "reply", "strangers", "live", "backup", "gone"].forEach(function (k) { S.stat[k]("not run yet"); });
      return;
    }
    var T = totals(C);
    var R = reply(C);
    S.stat.held(fmt(T.held));
    S.stat.others(fmt(T.others));
    S.stat.reply(String(R.rows.length));
    S.stat.strangers(String(R.people));
    S.stat.live(herFileKept(C) ? "held" : "deleted 26 October 2026");
    S.stat.backup(String(backupLine(C)));
    S.stat.gone(goneLine(C));
  }

  // Any change sets the story back to the night of 13 October.
  function change(api, what) {
    api.state.ran = false;
    api.log(what + " Set back to the night of Tuesday 13 October.", "");
    draw(api);
  }

  function run(api) {
    var S = api.state;
    var C = S.C;
    if (S.ran) {
      api.log("Already played to 30 November. Change a setting or reset to play it again.", "");
      return;
    }
    var R = reply(C);
    var T = totals(C);
    api.log("Tuesday 13 October, 22:10: the search for her name finds her 2016 file: 10 records, 2 of them notes on people who were never clients, naming 3.", "warn");
    api.log("Her request is open, so her records are held back from any deletion until the reply goes out.", "");
    if (C.strip) {
      api.log("Tuesday 20 October, a day before the 30 days end: her reply goes out with " + R.rows.length + " records, her own; the 2 notes on other people are taken out, so it names " + R.people + " people who were never clients.", "ok");
    } else {
      api.log("Tuesday 20 October, a day before the 30 days end: her reply goes out with " + R.rows.length + " records, and it names " + R.people + " people who were never clients.", "bad");
    }
    if (C.encrypt) api.log("Encryption on: a stolen disk or backup copy shows nothing readable. Every count stays the same.", "ok");
    else api.log("Encryption off: a stolen disk or backup copy shows every record.", "warn");
    if (C.retention === "keep") {
      api.log("Monday 26 October: nothing is deleted. " + fmt(T.held) + " records are held, " + T.others + " of them notes on people who were never clients, her neighbours' among them.", "bad");
    } else {
      api.log("Monday 26 October: the first deletion run removes " + fmt(T.deleted) + " records from live data; " + fmt(T.held) + " remain, " + T.others + " of them notes on people who were never clients.", "ok");
      if (!C.labels) api.log("Without purpose labels the run cannot tell notes on other people from case notes, so it keeps every record 7 years.", "warn");
      api.log("Her 2016 file is deleted from live data.", "ok");
      if (C.backups) api.log("Monday 30 November: the last nightly copy from before 26 October is deleted, 35 days on. The " + fmt(T.deleted) + " deleted records, her 2016 file among them, are gone from every backup.", "ok");
      else api.log("Every nightly copy since 2014 is kept, so the " + fmt(T.deleted) + " deleted records stay in the backups, and a restore would bring them back.", "bad");
    }
    S.ran = true;
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s7e10", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { retention: "keep", labels: false, backups: false, strip: false, encrypt: false };
      S.ran = false;
      S.ui = buildWidget(api);

      api.control.select("retention", "How long records are kept", RETENTION, "keep", function (v) {
        var o = pick(RETENTION, v);
        if (!o) return;
        S.C.retention = String(o.value);
        change(api, "Retention: " + o.label + ".");
      });
      api.control.toggle("labels", "A purpose label on each record: its kind and the case it serves", false, function (on) {
        S.C.labels = !!on;
        change(api, "Purpose labels: " + (on ? "on." : "off."));
      });
      api.control.toggle("backups", "Deletion reaches backups: keep each nightly copy 35 days", false, function (on) {
        S.C.backups = !!on;
        change(api, "Deletion reaches backups: " + (on ? "on." : "off."));
      });
      api.control.toggle("strip", "Take other people's data out of access replies", false, function (on) {
        S.C.strip = !!on;
        change(api, "Other people taken out of replies: " + (on ? "on." : "off."));
      });
      api.control.toggle("encrypt", "Encrypt the shared drive and the backups", false, function (on) {
        S.C.encrypt = !!on;
        change(api, "Encryption: " + (on ? "on." : "off."));
      });
      api.control.button("run", "Play 13 October to 30 November", function () { run(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        held: api.stat("held", "records held after 26 October", ""),
        others: api.stat("others", "notes on people who were never clients, held", "bad"),
        reply: api.stat("reply", "records in her reply", ""),
        strangers: api.stat("strangers", "people in her reply who were never clients", "bad"),
        live: api.stat("live", "her 2016 file in live data", "warn"),
        backup: api.stat("backup", "days until deleted data leaves the last backup", "warn"),
        gone: api.stat("gone", "her 2016 file gone from every backup", "warn"),
        stolen: api.stat("stolen", "what a stolen copy shows", "bad")
      };

      api.info("<strong>How to read it.</strong> Each row is a year of cases; every case leaves 10 records of four kinds. After the six weeks play, a cell reads 0 when the schedule deleted that kind for that year. Her 2016 file is listed below the table: the lines marked taken out are left out of her reply. The keep periods and the 35-day backup cycle are given data.");

      api.log("Tuesday 13 October 2026, before 22:10, as built: every record since 2014 kept, no purpose labels, every nightly backup kept, nothing taken out of replies, nothing encrypted. Her request came on Monday 21 September; the 30 days end on Wednesday 21 October.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: the night of 13 October, before the search.
      t.expect(t.stat("held") === "not run yet" && t.stat("reply") === "not run yet" && t.stat("strangers") === "not run yet" &&
        t.stat("gone") === "not run yet" && t.stat("stolen") === "every record",
        "Opens before the search: stats waiting, a stolen copy shows every record");

      // 2. As built: the reply holds the 2016 neighbour notes; 2,140 records stay.
      t.click("run");
      t.expect(t.stat("reply") === 10 && t.stat("strangers") === 3 && t.stat("held") === "2,140" && t.stat("others") === 428 &&
        t.stat("live") === "held" && t.stat("backup") === "nothing deleted" && t.stat("gone") === "not deleted" &&
        has("finds her 2016 file: 10 records, 2 of them notes on people who were never clients, naming 3."),
        "Keep everything: her reply holds 10 records naming 3 people who were never clients; 2,140 held, 428 notes on others");

      // 3. Option 0: encryption alone changes what a thief sees, not the reply or the shelf.
      t.set("encrypt", true);
      t.click("run");
      t.expect(t.stat("stolen") === "nothing readable" && t.stat("reply") === 10 && t.stat("strangers") === 3 && t.stat("held") === "2,140",
        "Encryption on: a stolen copy shows nothing readable, but the reply still names 3 people and 2,140 records stay");

      // 4. Option 1: taking other people out of the reply cleans the reply, not the shelf.
      t.set("encrypt", false);
      t.set("strip", true);
      t.click("run");
      t.expect(t.stat("reply") === 8 && t.stat("strangers") === 0 && t.stat("held") === "2,140" && t.stat("others") === 428 && t.stat("live") === "held",
        "Other people taken out: 8 records, 0 strangers in the reply, but 2,140 records and the 2016 file stay");

      // 5. A schedule without labels or backup deletion: everything kept 7 years, backups keep the rest.
      t.set("retention", "schedule");
      t.click("run");
      t.expect(t.stat("held") === "1,400" && t.stat("others") === 280 && t.stat("live") === "deleted 26 October 2026" &&
        t.stat("backup") === "never" && t.stat("gone") === "never" && has("so it keeps every record 7 years") && has("a restore would bring them back"),
        "Schedule, no labels, backups kept: 1,400 held, 280 notes on others, the 2016 file never leaves the backups");

      // 6. Purpose labels let each kind keep its own period.
      t.set("labels", true);
      t.click("run");
      t.expect(t.stat("held") === "1,190" && t.stat("others") === 70 && has("removes 950 records from live data"),
        "Schedule with labels: 950 removed, 1,190 held, 70 notes on others");

      // 7. Option 3: deletion reaches the backups by 30 November, 35 days on.
      t.set("backups", true);
      t.click("run");
      t.expect(t.stat("backup") === 35 && t.stat("gone") === "30 November 2026" && t.stat("live") === "deleted 26 October 2026" &&
        t.stat("reply") === 8 && t.stat("strangers") === 0 && has("Monday 30 November: the last nightly copy"),
        "Schedule, labels, backups: the 2016 file leaves live data on 26 October and the last backup on 30 November 2026");

      // 8. The schedule does not clean tonight's reply: other people must still be taken out.
      t.set("strip", false);
      t.click("run");
      t.expect(t.stat("reply") === 10 && t.stat("strangers") === 3 && t.stat("held") === "1,190",
        "Schedule without taking other people out: tonight's reply still names 3 people");

      // 9. Keep everything with backups on: nothing deleted, so nothing leaves.
      t.set("retention", "keep");
      t.click("run");
      t.expect(t.stat("held") === "2,140" && t.stat("backup") === "nothing deleted" && t.stat("gone") === "not deleted",
        "Keep everything: backup cycle on, but nothing is deleted, so nothing leaves");

      // 10. Playing twice changes nothing.
      t.click("run");
      t.expect(has("Already played to 30 November.") && t.stat("held") === "2,140", "A second play is refused until something changes");

      // 11. Any change sets the story back to the night.
      t.set("labels", false);
      t.expect(t.stat("held") === "not run yet" && t.stat("reply") === "not run yet",
        "Any change sets the story back to the night of 13 October");
    }
  });
})();
