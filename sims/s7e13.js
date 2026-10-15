/* sims/s7e13-v1.0.0.js  (published as sims/s7e13.js)
   Case s7e13 "Supply Chain": a dependency lab for the Tilthaven Seed Library's catalogue site,
   seven services (catalogue, search, loans, returns, members, reminders, labels). Each service uses
   libraries, and libraries use other libraries. At 21:30 on Tue 13 Oct 2026 the makers of jotlog,
   a popular logging library, announce a serious flaw in versions 3.0.0 to 3.8.2, fixed in 3.8.3.
   Oluchi searched each service's dependency file, patched loans and members, and signed the patch
   sheet "ALL CLEAR" at 00:55. The labels service carries its own copy, jotlog 3.4.0, copied in by
   hand in May 2023 and named on no list; Berenike saw its version on the 03:05 start-up line.
   Period: a FICTIONAL library on a fictional night in October 2026. Log4Shell (December 2021) and
   xz utils (March 2024) appear only in the case's realWorld section, never in this sim.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).
   It models the defence and its stated numbers only: which services hold which library versions,
   how long each way of looking takes, and when each copy is patched. There is no request, no
   pattern and no method in this file; the firewall is modelled only by what it leaves inside.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: how you look (search dependency files, as found; search an
     SBOM made from each build), update policy (pinned with a 24-hour patch deadline, as found;
     newest every night at 02:00), firewall rule (off, as found; on). Buttons: replay the night,
     reset. selfTest: 10 assertions.

   Where every number comes from (conventions rule 14; the case is content/s7/s7e13-v1.0.0.json):
   - 7 services, each with 2 libraries in its tree (given, the SERVICES table below). jotlog appears
     in 4: loans 3.8.1 (direct), members 3.6.0 (direct), search 2.9.1 (inside sievekit, transitive,
     older than the flaw, so not affected), labels 3.4.0 (bundled by hand, on no list). 3 affected.
   - Announcement 21:30 Tue 13 Oct 2026 (given). Oluchi starts looking at 21:42 (given).
   - Dependency file search: 12 minutes a service (given) x 7 = 84 minutes, answer at 23:06. It sees
     only direct entries: loans and members.
   - SBOM search: one search across all seven parts lists, 4 minutes (given), answer at 21:46. It
     sees every copy in each built bundle: loans, members, labels affected; search not affected.
   - Patching: 50 minutes a service (given), one after the other from the answer.
       File search: loans 23:56, members 00:46; the sheet is signed ALL CLEAR at 00:55 (given).
       Labels is found by chance at 03:05 (the start-up line after the 03:00 restart, given) and
       patched 50 minutes later, 03:55.
       SBOM search: loans 22:36, members 23:26, labels 00:16.
   - Exposed = patched minus 21:30. File: 146 + 196 + 385 = 727 min = 12 h 07 min, longest
     6 h 25 min (labels). SBOM: 66 + 116 + 166 = 348 min = 5 h 48 min, longest 2 h 46 min.
   - Newest every night: at 02:00 every LISTED library takes its newest version, so a listed
     flawed copy is patched by 02:00 at the latest; the bundled copy is on no list and never
     changes. The 30 nights before (given data): pinned 0 broken builds, no withdrawn release;
     newest every night 3 broken builds, and at 02:00 on Sat 26 Sep the reminders service took
     mailkite W, a release its makers withdrew as unsafe 2 days later (Mon 28 Sep).
   - Firewall rule: on from 23:40 (given). It changes no patch time and no exposure; the 3 flawed
     copies stay inside until patched.
   - Options: 0 (ok) SBOM search: 4 minutes, 3 found, labels 00:16, longest 2 h 46 min; 1 newest
     every night: labels still 3.4.0 until 03:05, 3 broken builds, mailkite W; 2 dependency file
     search: the night as it happened; 3 firewall rule: exposure unchanged, 12 h 07 min.
*/
(function () {
  "use strict";

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MIN = 60000;
  var T_ANN = Date.UTC(2026, 9, 13, 21, 30);      // Tue 13 Oct 2026 21:30, the makers' email
  var T_START = Date.UTC(2026, 9, 13, 21, 42);    // Oluchi starts looking
  var T_SHEET = Date.UTC(2026, 9, 14, 0, 55);     // patch sheet signed ALL CLEAR (file search)
  var T_NIGHTLY = Date.UTC(2026, 9, 14, 2, 0);    // the nightly update, if that policy is chosen
  var T_SEEN = Date.UTC(2026, 9, 14, 3, 5);       // labels start-up line read: jotlog 3.4.0
  var T_RULE = Date.UTC(2026, 9, 13, 23, 40);     // the hosting company's firewall rule, if on

  var FILE_MIN_EACH = 12;
  var SBOM_MIN = 4;
  var PATCH_MIN = 50;
  var FLAW_LOW = [3, 0, 0];
  var FLAW_HIGH = [3, 8, 2];
  var FIXED = "3.8.3";

  // Each service's tree: [library, version, how it got there].
  var SERVICES = [
    { id: "catalogue", libs: [["webframe", "4.2.0", "direct"], ["pagefold", "1.3.0", "inside webframe"]] },
    { id: "search", libs: [["sievekit", "2.1.0", "direct"], ["jotlog", "2.9.1", "inside sievekit"]] },
    { id: "loans", libs: [["webframe", "4.2.0", "direct"], ["jotlog", "3.8.1", "direct"]] },
    { id: "returns", libs: [["webframe", "4.2.0", "direct"], ["pagefold", "1.3.0", "inside webframe"]] },
    { id: "members", libs: [["jotlog", "3.6.0", "direct"], ["webframe", "4.2.0", "direct"]] },
    { id: "reminders", libs: [["mailkite", "4.1.2", "direct"], ["pagefold", "1.3.0", "inside mailkite"]] },
    { id: "labels", libs: [["inkpress", "1.0.4", "direct"], ["jotlog", "3.4.0", "bundled by hand, on no list"]] }
  ];

  var LOOKS = [
    { value: "file", label: "search each dependency file (as found)" },
    { value: "sbom", label: "search an SBOM made from each build" }
  ];
  var POLICIES = [
    { value: "pinned", label: "pinned, patch within 24 hours (as found)" },
    { value: "nightly", label: "newest version every night at 02:00" }
  ];

  /* ---------- small helpers ---------- */

  function hm(t) {
    var x = new Date(t);
    return ("0" + x.getUTCHours()).slice(-2) + ":" + ("0" + x.getUTCMinutes()).slice(-2);
  }
  function dur(m) {
    return Math.floor(m / 60) + " h " + ("0" + (m % 60)).slice(-2) + " min";
  }
  function parts(v) { return v.split(".").map(Number); }
  function cmp(a, b) {
    for (var i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; }
    return 0;
  }
  function flawed(lib) {
    if (lib[0] !== "jotlog") return false;
    var p = parts(lib[1]);
    return cmp(p, FLAW_LOW) >= 0 && cmp(p, FLAW_HIGH) <= 0;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // The night under choices C: each service's copies, what the search saw, and patch times.
  function night(C) {
    var answer = T_START + (C.look === "file" ? FILE_MIN_EACH * SERVICES.length : SBOM_MIN) * MIN;
    var queue = 0;
    var out = { answer: answer, minutes: C.look === "file" ? FILE_MIN_EACH * SERVICES.length : SBOM_MIN, rows: [],
      found: 0, affected: 0, missed: 0, notAffected: 0, total: 0, longest: 0, last: 0 };
    SERVICES.forEach(function (s) {
      var copies = s.libs.filter(function (l) { return l[0] === "jotlog"; });
      var seen = copies.filter(function (l) { return C.look === "sbom" || l[2] === "direct"; });
      var bad = copies.filter(flawed);
      var r = { id: s.id, copies: copies, seen: seen, affected: bad.length > 0, patched: null, chance: false };
      if (seen.length) out.found += 1;
      seen.forEach(function (l) { if (!flawed(l)) out.notAffected += 1; });
      if (r.affected) {
        out.affected += 1;
        var seenBad = seen.some(flawed);
        if (seenBad) {
          queue += 1;
          r.patched = answer + queue * PATCH_MIN * MIN;
        } else {
          out.missed += 1;
          r.chance = true;
          r.patched = T_SEEN + PATCH_MIN * MIN;
        }
        var listed = bad.some(function (l) { return l[2] === "direct"; });
        if (C.policy === "nightly" && listed && r.patched > T_NIGHTLY) r.patched = T_NIGHTLY;
        r.exposed = (r.patched - T_ANN) / MIN;
        out.total += r.exposed;
        if (r.exposed > out.longest) out.longest = r.exposed;
        if (r.patched > out.last) out.last = r.patched;
      }
      out.rows.push(r);
    });
    return out;
  }

  function sheetText(N) {
    if (N.missed) return "ALL CLEAR at " + hm(T_SHEET) + ", while labels still ran jotlog 3.4.0";
    return N.affected + " affected, all " + N.affected + " patched by " + hm(N.last);
  }

  function labelsText(N) {
    var r = N.rows[6];
    return r.chance ? "found by chance at " + hm(T_SEEN) + ", patched " + hm(r.patched) : "found by the search, patched " + hm(r.patched);
  }

  function history(C) {
    if (C.policy === "nightly") {
      return { broken: 3, untrusted: "mailkite W, taken into reminders Sat 26 Sep 02:00; withdrawn as unsafe by its makers Mon 28 Sep" };
    }
    return { broken: 0, untrusted: "none" };
  }

  function treeText(s) {
    return s.libs.map(function (l) { return l[0] + " " + l[1] + " (" + l[2] + ")" + (flawed(l) ? " FLAWED" : ""); }).join("; ");
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, txt) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (txt) e.textContent = txt;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    var wrap = el("div", "overflow:auto;max-height:320px;");
    var table = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
    wrap.appendChild(table);
    box.appendChild(head);
    box.appendChild(wrap);
    api.root.appendChild(box);
    return { el: el, head: head, table: table };
  }

  function row(ui, cells, bold, warn) {
    var tr = ui.el("tr");
    cells.forEach(function (c) {
      tr.appendChild(ui.el(bold ? "th" : "td", "text-align:left;padding:2px 6px;vertical-align:top;" + (warn ? "color:#b3261e;" : ""), String(c)));
    });
    ui.table.appendChild(tr);
  }

  function draw(api) {
    var S = api.state, C = S.C, ui = S.ui;
    ui.head.textContent = "Looking: " + (C.look === "file" ? "each dependency file" : "an SBOM made from each build") +
      ". Updates: " + (C.policy === "nightly" ? "newest every night at 02:00" : "pinned, patch within 24 hours") +
      ". Firewall rule " + (C.firewall ? "on" : "off") + "." + (S.ran ? "" : " Press Replay the night.");
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["service", "libraries in the built bundle", "this search sees jotlog", "affected?", "patched", "exposed"], true);
    var N = S.ran ? night(C) : null;
    SERVICES.forEach(function (s, i) {
      if (!N) { row(ui, [s.id, treeText(s), "-", "-", "-", "-"]); return; }
      var r = N.rows[i];
      row(ui, [
        s.id,
        treeText(s),
        r.seen.length ? r.seen.map(function (l) { return l[1]; }).join(", ") : (r.copies.length ? "no: not in the dependency file" : "no copy"),
        r.affected ? "yes" : (r.copies.length ? "no: " + r.copies[0][1] + " is older than the flaw" : "no"),
        r.affected ? hm(r.patched) + (r.chance ? " (found by chance 03:05)" : "") : "-",
        r.affected ? dur(r.exposed) : "-"
      ], false, r.affected && r.chance);
    });
    var st = S.stat;
    if (!N) {
      ["minutes", "answer", "found", "affected", "missed", "notAffected", "sheet", "labels", "longest", "total", "broken", "untrusted"].forEach(function (k) { st[k]("not run"); });
    } else {
      var H = history(C);
      st.minutes(N.minutes);
      st.answer(hm(N.answer));
      st.found(N.found);
      st.affected(N.affected);
      st.missed(N.missed);
      st.notAffected(N.notAffected);
      st.sheet(sheetText(N));
      st.labels(labelsText(N));
      st.longest(dur(N.longest));
      st.total(dur(N.total));
      st.broken(H.broken);
      st.untrusted(H.untrusted);
    }
    st.firewall(C.firewall ? "on from " + hm(T_RULE) + ": blocks requests that match the known pattern; variants that differ pass; 3 flawed copies stay inside until patched" : "off");
  }

  function replay(api) {
    var S = api.state, C = S.C;
    S.ran = true;
    var N = night(C);
    api.log("Tue 13 Oct " + hm(T_ANN) + ": jotlog's makers announce a serious flaw in 3.0.0 to 3.8.2, fixed in " + FIXED + ".", "warn");
    api.log(hm(T_START) + ": " + (C.look === "file" ? "search each dependency file, " + FILE_MIN_EACH + " minutes a service" : "one search across all 7 SBOMs") +
      "; answer at " + hm(N.answer) + " after " + N.minutes + " minutes; jotlog seen in " + N.found + " services.", "");
    if (C.firewall) api.log(hm(T_RULE) + ": firewall rule on; the flawed copies are still inside.", "warn");
    N.rows.forEach(function (r) {
      if (!r.affected) return;
      api.log(r.id + ": jotlog " + r.copies[0][1] + " (" + r.copies[0][2] + "), " + (r.chance ? "not seen by the search; found by chance at " + hm(T_SEEN) : "seen") +
        "; patched " + hm(r.patched) + ", exposed " + dur(r.exposed) + ".", r.chance ? "bad" : "ok");
    });
    api.log("Patch sheet: " + sheetText(N) + ".", N.missed ? "bad" : "ok");
    draw(api);
  }

  function restart(api, why) {
    var S = api.state;
    S.ran = false;
    api.log((why ? why + " " : "") + "Before 21:30 on Tue 13 Oct: no flaw announced yet.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s7e13", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { look: "file", policy: "pinned", firewall: false };
      S.ran = false;
      S.ui = buildWidget(api);
      function opt(key, conv) { return function (v) { S.C[key] = conv(v); restart(api, "Settings changed."); }; }
      api.control.select("look", "How you look for the flawed library", LOOKS, "file", opt("look", String));
      api.control.select("policy", "Update policy", POLICIES, "pinned", opt("policy", String));
      api.control.toggle("firewall", "Firewall rule for the known pattern", false, opt("firewall", function (v) { return !!v; }));
      api.control.button("run", "Replay the night", function () { replay(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        minutes: api.stat("minutes", "minutes to answer: are we affected?", ""),
        answer: api.stat("answer", "answer at", ""),
        found: api.stat("found", "services where the search sees jotlog", ""),
        affected: api.stat("affected", "services really affected", "bad"),
        missed: api.stat("missed", "affected but not seen by the search", "bad"),
        notAffected: api.stat("notAffected", "copies seen, older than the flaw", ""),
        sheet: api.stat("sheet", "the patch sheet", "warn"),
        labels: api.stat("labels", "the labels copy", "bad"),
        longest: api.stat("longest", "longest exposure from 21:30", "bad"),
        total: api.stat("total", "exposure added up over services", ""),
        broken: api.stat("broken", "builds broken by updates, 30 nights before", ""),
        untrusted: api.stat("untrusted", "withdrawn releases taken, 30 nights before", ""),
        firewall: api.stat("firewall", "firewall rule", "")
      };
      api.info("<strong>How to read it.</strong> Each row is one of the seven services: the libraries inside its built bundle (direct ones it asks for, ones that come inside another library, and one copied in by hand), whether the chosen search sees jotlog there, whether that copy is one of the flawed versions 3.0.0 to 3.8.2, when it was patched to 3.8.3, and how long it was exposed after the 21:30 email. A dependency file lists only what a service asks for by name. An SBOM is a parts list made by a tool at each build from what is really inside the bundle. Patching takes 50 minutes a service, one after the other. The firewall rule is modelled only by what it leaves inside; the sim holds no requests.");
      restart(api, "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens before the announcement.
      t.expect(t.stat("minutes") === "not run" && t.stat("sheet") === "not run" && t.stat("firewall") === "off",
        "Opens before 21:30: nothing replayed yet");

      // 2. As found: the dependency file search takes 84 minutes and sees jotlog in 2 services.
      t.click("run");
      t.expect(t.stat("minutes") === 84 && t.stat("answer") === "23:06" && t.stat("found") === 2 &&
        t.stat("affected") === 3 && t.stat("missed") === 1 && t.stat("notAffected") === 0,
        "File search: 84 minutes, answer 23:06, sees 2 services; 3 affected, 1 missed");

      // 3. As found: the sheet says ALL CLEAR at 00:55 while labels runs 3.4.0.
      t.expect(t.stat("sheet") === "ALL CLEAR at 00:55, while labels still ran jotlog 3.4.0" &&
        t.stat("labels") === "found by chance at 03:05, patched 03:55" &&
        has("labels: jotlog 3.4.0 (bundled by hand, on no list), not seen by the search; found by chance at 03:05; patched 03:55, exposed 6 h 25 min."),
        "File search: ALL CLEAR at 00:55; labels found by chance at 03:05 and patched 03:55");

      // 4. As found: exposure.
      t.expect(t.stat("longest") === "6 h 25 min" && t.stat("total") === "12 h 07 min" &&
        has("loans: jotlog 3.8.1 (direct), seen; patched 23:56, exposed 2 h 26 min.") &&
        has("members: jotlog 3.6.0 (direct), seen; patched 00:46, exposed 3 h 16 min."),
        "File search: loans 23:56, members 00:46; longest 6 h 25 min, total 12 h 07 min");

      // 5. Option 0 (ok): search an SBOM made from each build.
      t.set("look", "sbom");
      t.click("run");
      t.expect(t.stat("minutes") === 4 && t.stat("answer") === "21:46" && t.stat("found") === 4 &&
        t.stat("affected") === 3 && t.stat("missed") === 0 && t.stat("notAffected") === 1,
        "SBOM search: 4 minutes, answer 21:46, sees jotlog in 4 services, misses none, search's 2.9.1 not affected");

      // 6. SBOM search: patch times and exposure.
      t.expect(t.stat("labels") === "found by the search, patched 00:16" &&
        t.stat("sheet") === "3 affected, all 3 patched by 00:16" &&
        t.stat("longest") === "2 h 46 min" && t.stat("total") === "5 h 48 min" &&
        has("loans: jotlog 3.8.1 (direct), seen; patched 22:36, exposed 1 h 06 min."),
        "SBOM search: loans 22:36, members 23:26, labels 00:16; longest 2 h 46 min, total 5 h 48 min");

      // 7. Pinned: the 30 nights before had no broken builds and no withdrawn release.
      t.expect(t.stat("broken") === 0 && t.stat("untrusted") === "none",
        "Pinned: 0 broken builds, no withdrawn release in the 30 nights before");

      // 8. Option 1: newest every night, with the file search as found.
      t.set("look", "file");
      t.set("policy", "nightly");
      t.click("run");
      t.expect(t.stat("labels") === "found by chance at 03:05, patched 03:55" && t.stat("longest") === "6 h 25 min" &&
        t.stat("broken") === 3 &&
        t.stat("untrusted") === "mailkite W, taken into reminders Sat 26 Sep 02:00; withdrawn as unsafe by its makers Mon 28 Sep",
        "Newest every night: the bundled 3.4.0 is untouched; 3 broken builds and mailkite W in the 30 nights before");

      // 9. Option 3: firewall rule on; exposure unchanged.
      t.set("policy", "pinned");
      t.set("firewall", true);
      t.click("run");
      t.expect(t.stat("total") === "12 h 07 min" && t.stat("longest") === "6 h 25 min" &&
        t.stat("firewall") === "on from 23:40: blocks requests that match the known pattern; variants that differ pass; 3 flawed copies stay inside until patched",
        "Firewall rule: exposure unchanged at 12 h 07 min; 3 flawed copies stay inside");

      // 10. Option 2 is the night as it happened: the file search sheet, firewall off.
      t.set("firewall", false);
      t.click("run");
      t.expect(t.stat("sheet") === "ALL CLEAR at 00:55, while labels still ran jotlog 3.4.0" && t.stat("found") === 2 &&
        has("Patch sheet: ALL CLEAR at 00:55, while labels still ran jotlog 3.4.0."),
        "Dependency file search: the night as it happened, ALL CLEAR at 00:55");
    }
  });
})();
