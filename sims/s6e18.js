/* sims/s6e18-v1.0.0.js  (published as sims/s6e18.js)
   Case s6e18 "Field Report: Monkeys in Production": a game-day lab for Dunmallet, a school-photography
   lab whose developers copied Chaos Monkey from Netflix's 2011 post into a bot that kills one random
   machine in each group on weekdays, 08:00 to 17:00. Seven machines: upload-1 to upload-3, web-1 and
   web-2, print-1 and print-2. The learner replays Thursday 15 October from 08:00 to Friday 06:00:
   where a photo is saved before the tablet's tick (the upload machine's own disk, or shared storage),
   which groups the bot may pick, its hours (working hours or night), a hand release of the monkey
   on any machine (now, or at 13:52), and a new day of random picks (seeded api.rand()).
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: save on the machine's disk or in shared storage; bot groups
     all, web and print only, or none (bot off); bot hours working (08:00 to 17:00) or night
     (02:30 to 05:00); release the monkey on a chosen machine now or at 13:52; next event, play to
     the end, new day (random picks), reset. Stats: time, ticked uploaded, on upload disks, in shared
     storage, lost, kills, kills nobody watched, copied at 02:00, printed. selfTest: 10 assertions.

   The model (stated in sim.lede and the post):
   - Times are minutes from Thursday 15 October 2026 00:00. The replay runs from Thu 08:00 (480) to
     Fri 06:00 (1800). The 02:00 run is at 1560.
   - Each tablet sends 30 photos a minute (1,800 an hour) to its one upload machine, one minute at a
     time, from a school's start minute up to (not including) its end minute.
   - An upload machine that is up saves each photo (on its own disk, or in shared storage, as set)
     and the tablet ticks it uploaded. While the machine is down, the tablet keeps the photos and
     sends them in the first minute the fresh copy is up.
   - A kill at minute m: the machine and its disk are gone; whatever was on the disk is lost; a
     fresh, empty copy answers at m + 2. Web and print machines keep nothing of their own.
   - A kill between 08:00 and 17:00 on Thursday is watched by Yorick and Gotthard; any other is not.
   - At 02:00 the copy job moves every upload disk into shared storage, then the print run prints
     every photo in shared storage, school by school.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e18-v1.0.0.json):
   - Thursday's schools (stated data): tablet 1 to upload-1: Ashtonleigh 750 (09:40 to 10:05, 25
     minutes x 30), Thornreave 690 (13:07 to 13:30, 23 x 30). Tablet 2 (Ramunas) to upload-2:
     Corriemoor 600 (09:50 to 10:10, 20 x 30), Brackenrigg 720 (11:16 to 11:40, 24 x 30), Gattonside
     480 (12:34 to 12:50, 16 x 30): 1,800. Tablet 3 to upload-3: Kelderholm 660 (10:38 to 11:00, 22
     x 30), Mossfallow 630 (14:09 to 14:30, 21 x 30). Total 4,530.
   - The bot's log for Thursday (stated data): web-1 10:48, upload-2 13:52, print-2 15:17; in night
     hours the same machines at 02:41, 03:22, 04:15.
   - As built: by 13:52, 3,900 ticked (all but Mossfallow); the 13:52 kill loses 1,800 (Corriemoor
     600, Brackenrigg 720, Gattonside 480); fresh upload-2 at 13:54. 02:00: upload-1 1,440 copied
     (750 + 690), upload-2 0, upload-3 1,290 (660 + 630): 2,730 copied and printed, 4 of 7 schools
     complete, 1,800 lost, 4,530 ticked.
   - Option 0 (web and print only): 2 kills, 0 lost, 4,530 printed. With a hand release on upload-2
     at 13:52: 1,800 lost, 2,730 printed.
   - Option 1 (night): 02:00 copies all 4,530; kills at 02:41, 03:22, 04:15 find empty disks; 0 lost,
     3 kills nobody watched.
   - Option 3 (bot off): 0 bot kills; a hand release on upload-2 at 13:52 loses 1,800.
   - Option 2 (shared storage): the 13:52 kill finds 0 photos; 0 lost; 0 copied at 02:00 (all 4,530
     already stored); 4,530 printed, 7 of 7 complete. Releasing all seven machines at 08:00 as well:
     10 kills, 0 lost.
   - The tablet waits: as built, release upload-2 at 10:05: 450 lost (Corriemoor 09:50 to 10:04, 15
     minutes x 30); 60 photos wait on the tablet for 10:05 and 10:06 and arrive at 10:07; the 13:52
     kill then loses 1,350 (Corriemoor 150, Brackenrigg 720, Gattonside 480): 1,800 in all.
   - The post's Wednesday (stated data, not replayed): the bot killed upload-1 at 09:31; the first
     photo arrived at 10:05. All summer nobody uploaded, so every upload kill found an empty disk.
*/
(function () {
  "use strict";

  var START = 480;
  var RUN = 1560;
  var END = 1800;
  var WORK_FROM = 480;
  var WORK_TO = 1020;
  var NIGHT_FROM = 1590;
  var NIGHT_TO = 1740;
  var RATE = 30;
  var BACK_AFTER = 2;
  var HAND_AT = 832;

  var MACHINES = [
    { id: "upload-1", g: "upload" },
    { id: "upload-2", g: "upload" },
    { id: "upload-3", g: "upload" },
    { id: "web-1", g: "web" },
    { id: "web-2", g: "web" },
    { id: "print-1", g: "print" },
    { id: "print-2", g: "print" }
  ];
  var SCHOOLS = [
    { name: "Ashtonleigh", tablet: 1, m: "upload-1", from: 580, to: 605, n: 750 },
    { name: "Thornreave", tablet: 1, m: "upload-1", from: 787, to: 810, n: 690 },
    { name: "Corriemoor", tablet: 2, m: "upload-2", from: 590, to: 610, n: 600 },
    { name: "Brackenrigg", tablet: 2, m: "upload-2", from: 676, to: 700, n: 720 },
    { name: "Gattonside", tablet: 2, m: "upload-2", from: 754, to: 770, n: 480 },
    { name: "Kelderholm", tablet: 3, m: "upload-3", from: 638, to: 660, n: 660 },
    { name: "Mossfallow", tablet: 3, m: "upload-3", from: 849, to: 870, n: 630 }
  ];
  var STORY_PICKS = [
    { t: 648, m: "web-1", hours: "work" },
    { t: 832, m: "upload-2", hours: "work" },
    { t: 917, m: "print-2", hours: "work" },
    { t: 1601, m: "web-1", hours: "night" },
    { t: 1642, m: "upload-2", hours: "night" },
    { t: 1695, m: "print-2", hours: "night" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function when(m) {
    var r = m % 1440;
    return (m >= 1440 ? "Fri " : "Thu ") + two(Math.floor(r / 60)) + ":" + two(r % 60);
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function groupOf(id) {
    for (var i = 0; i < MACHINES.length; i++) if (MACHINES[i].id === id) return MACHINES[i].g;
    return "";
  }
  function sum(map) {
    var s = 0;
    Object.keys(map).forEach(function (k) { s += map[k]; });
    return s;
  }
  function schoolsOn(id) { return SCHOOLS.filter(function (s) { return s.m === id; }); }

  /* ---------- the model ---------- */

  function fresh(cfg, picks) {
    var M = {
      t: START, save: cfg.save, groups: cfg.groups, hours: cfg.hours,
      picks: picks, manual: [],
      disk: {}, shared: {}, uploaded: {}, pending: {}, lost: {}, printed: {},
      upAt: {}, kills: 0, unseen: 0, copied: null, printedTotal: null, done: false
    };
    SCHOOLS.forEach(function (s) {
      M.shared[s.name] = 0; M.uploaded[s.name] = 0; M.pending[s.name] = 0; M.lost[s.name] = 0; M.printed[s.name] = 0;
    });
    MACHINES.forEach(function (x) { if (x.g === "upload") { M.disk[x.id] = {}; schoolsOn(x.id).forEach(function (s) { M.disk[x.id][s.name] = 0; }); } });
    return M;
  }

  function allowed(M, g) {
    if (M.groups === "none") return false;
    if (M.groups === "webprint") return g !== "upload";
    return true;
  }
  function isUp(M, id, m) { return !(M.upAt[id] > m); }
  function onDisks(M) {
    var n = 0;
    Object.keys(M.disk).forEach(function (id) { n += sum(M.disk[id]); });
    return n;
  }

  function deliver(M, s, k) {
    M.uploaded[s.name] += k;
    if (M.save === "shared") M.shared[s.name] += k;
    else M.disk[s.m][s.name] += k;
  }

  // One minute of uploads.
  function minute(M, m) {
    SCHOOLS.forEach(function (s) {
      var up = isUp(M, s.m, m);
      if (up && M.pending[s.name] > 0) { deliver(M, s, M.pending[s.name]); M.pending[s.name] = 0; }
      if (m >= s.from && m < s.to) {
        if (up) deliver(M, s, RATE);
        else M.pending[s.name] += RATE;
      }
    });
  }

  function kill(M, id, by, m, out) {
    var who = by === "bot" ? " bot: killed " : " you released the monkey on ";
    if (!isUp(M, id, m)) { out.push({ s: when(m) + who + id + ": it is already down; a fresh copy answers at " + when(M.upAt[id]) + ".", tone: "" }); return; }
    M.kills += 1;
    var seen = m >= WORK_FROM && m < WORK_TO;
    if (!seen) M.unseen += 1;
    M.upAt[id] = m + BACK_AFTER;
    var s = when(m) + who + id + " " + (seen ? "(Yorick and Gotthard watching)" : "(nobody watching)") + ". ";
    if (groupOf(id) !== "upload") {
      out.push({ s: s + "It keeps nothing of its own; a fresh " + id + " answers at " + when(m + BACK_AFTER) + ". Nothing lost.", tone: "ok" });
      return;
    }
    var parts = [];
    var n = 0;
    schoolsOn(id).forEach(function (sc) {
      var k = M.disk[id][sc.name];
      if (k > 0) { parts.push(sc.name + " " + fmt(k)); n += k; M.lost[sc.name] += k; M.disk[id][sc.name] = 0; }
    });
    s += "On its disk: " + fmt(n) + " photos" + (n ? " (" + parts.join(", ") + "), gone with it" : "") + ". A fresh, empty " + id +
      " answers at " + when(m + BACK_AFTER) + "." + (n ? " The tablets still show them uploaded." : "");
    out.push({ s: s, tone: n ? "bad" : "ok" });
  }

  function run(M, m, out) {
    var copied = 0;
    MACHINES.forEach(function (x) {
      if (x.g !== "upload") return;
      var parts = [];
      var c = 0;
      schoolsOn(x.id).forEach(function (sc) {
        var k = M.disk[x.id][sc.name];
        if (k > 0) { parts.push(sc.name + " " + fmt(k)); c += k; M.shared[sc.name] += k; M.disk[x.id][sc.name] = 0; }
      });
      copied += c;
      out.push({ s: when(m) + " copy job: " + x.id + " " + fmt(c) + " copied" + (c ? " (" + parts.join(", ") + ")" : "") + ".", tone: "" });
    });
    M.copied = copied;
    var total = 0;
    var complete = 0;
    var short = [];
    SCHOOLS.forEach(function (sc) {
      M.printed[sc.name] = M.shared[sc.name];
      total += M.shared[sc.name];
      if (M.shared[sc.name] >= sc.n) complete += 1;
      else short.push(sc.name + " " + fmt(M.shared[sc.name]) + " of " + fmt(sc.n));
    });
    M.printedTotal = total;
    out.push({ s: when(m) + " print run: " + fmt(total) + " photos printed; " + complete + " of " + SCHOOLS.length + " schools complete." +
      (short.length ? " Short: " + short.join(", ") + "." : ""), tone: short.length ? "bad" : "ok" });
  }

  // Everything that happens at the start of minute m.
  function boundary(M, m, out) {
    SCHOOLS.forEach(function (s) {
      if (s.to !== m) return;
      var w = M.pending[s.name];
      out.push({ s: when(m) + " tablet " + s.tablet + ": " + s.name + " sent, " + fmt(M.uploaded[s.name]) + " of " + fmt(s.n) +
        " ticked uploaded" + (w ? ", " + fmt(w) + " waiting on the tablet" : "") + ".", tone: "" });
    });
    M.picks.forEach(function (p) {
      if (p.t === m && p.hours === M.hours && allowed(M, groupOf(p.m))) kill(M, p.m, "bot", m, out);
    });
    M.manual.forEach(function (p) { if (p.t === m) kill(M, p.m, "hand", m, out); });
    if (m === RUN) run(M, m, out);
    if (m === END) {
      M.done = true;
      out.push({ s: when(m) + " end of the replay. Ticked uploaded: " + fmt(sum(M.uploaded)) + ". Printed: " + fmt(M.printedTotal || 0) +
        ". Lost: " + fmt(sum(M.lost)) + ". Kills: " + M.kills + ", nobody watching: " + M.unseen + ".", tone: sum(M.lost) ? "bad" : "ok" });
    }
  }

  function nextStop(M) {
    var best = END;
    function consider(t) { if (t > M.t && t < best) best = t; }
    SCHOOLS.forEach(function (s) { consider(s.to); });
    M.picks.forEach(function (p) { if (p.hours === M.hours && allowed(M, groupOf(p.m))) consider(p.t); });
    M.manual.forEach(function (p) { consider(p.t); });
    consider(RUN);
    return best;
  }

  function nextEvent(M) {
    var out = [];
    if (M.done) return out;
    var T = nextStop(M);
    for (var m = M.t; m < T; m++) {
      if (m > M.t) boundary(M, m, out);
      minute(M, m);
    }
    boundary(M, T, out);
    M.t = T;
    return out;
  }

  function randomPicks(api) {
    var picks = [];
    ["upload", "web", "print"].forEach(function (g) {
      var members = MACHINES.filter(function (x) { return x.g === g; });
      var id = members[Math.floor(api.rand() * members.length)].id;
      picks.push({ t: WORK_FROM + Math.floor(api.rand() * (WORK_TO - WORK_FROM)), m: id, hours: "work" });
      picks.push({ t: NIGHT_FROM + Math.floor(api.rand() * (NIGHT_TO - NIGHT_FROM)), m: id, hours: "night" });
    });
    return picks;
  }

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
    function table(heads) {
      var wrap = el("div", "overflow-x:auto;");
      var t = el("table", "width:100%;font-size:11px;border-collapse:collapse;");
      var hr = el("tr");
      heads.forEach(function (h) { hr.appendChild(el("th", "text-align:left;padding:2px 4px;", h)); });
      var thead = el("thead");
      thead.appendChild(hr);
      t.appendChild(thead);
      var body = el("tbody");
      t.appendChild(body);
      wrap.appendChild(t);
      return { wrap: wrap, body: body };
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    var mt = table(["Machine", "Group", "Now", "Photos on its disk"]);
    var st = table(["School", "Tablet, machine", "Ticked uploaded", "Waiting on tablet", "On disk", "In shared storage", "Lost", "Printed"]);
    [head, mt.wrap, st.wrap].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { el: el, head: head, machines: mt.body, schools: st.body };
  }

  function fill(ui, body, rows) {
    while (body.firstChild) body.removeChild(body.firstChild);
    rows.forEach(function (cells) {
      var tr = ui.el("tr");
      cells.forEach(function (c) { tr.appendChild(ui.el("td", "padding:2px 4px;", c)); });
      body.appendChild(tr);
    });
  }

  function draw(api) {
    var S = api.state;
    var M = S.M;
    var ui = S.ui;
    var groupsText = { all: "upload, web and print", webprint: "web and print only", none: "none (bot off)" };
    ui.head.textContent = "Now: " + when(M.t) + ". A photo is saved " + (M.save === "shared" ? "in shared storage" : "on the upload machine's own disk") +
      " before the tick. The bot may pick: " + groupsText[M.groups] + ", in " + (M.hours === "night" ? "night hours, 02:30 to 05:00" : "working hours, 08:00 to 17:00") +
      ". Picks: " + (S.random ? "a random new day" : "Thursday's log") + ".";
    fill(ui, ui.machines, MACHINES.map(function (x) {
      var up = isUp(M, x.id, M.t);
      return [x.id, x.g, up ? (M.upAt[x.id] ? "up (fresh copy)" : "up") : "down until " + when(M.upAt[x.id]),
        x.g === "upload" ? fmt(sum(M.disk[x.id])) : "keeps nothing"];
    }));
    fill(ui, ui.schools, SCHOOLS.map(function (s) {
      return [s.name, "tablet " + s.tablet + ", " + s.m, fmt(M.uploaded[s.name]) + " of " + fmt(s.n), fmt(M.pending[s.name]),
        fmt(M.disk[s.m][s.name]), fmt(M.shared[s.name]), fmt(M.lost[s.name]), M.printedTotal === null ? "-" : fmt(M.printed[s.name])];
    }));
    S.stat.clock(when(M.t));
    S.stat.uploaded(fmt(sum(M.uploaded)));
    S.stat.disks(fmt(onDisks(M)));
    S.stat.stored(fmt(sum(M.shared)));
    S.stat.lost(fmt(sum(M.lost)));
    S.stat.kills(M.kills);
    S.stat.unseen(M.unseen);
    S.stat.copied(M.copied === null ? "not yet" : fmt(M.copied));
    S.stat.printed(M.printedTotal === null ? "not yet" : fmt(M.printedTotal));
    S.ctl.next.disable(M.done);
    S.ctl.play.disable(M.done);
    S.ctl.release.disable(M.done);
  }

  function say(api, lines) {
    lines.forEach(function (r) { api.log(r.s, r.tone); });
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e18", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.cfg = { save: "disk", groups: "all", hours: "work" };
      S.random = false;
      S.M = fresh(S.cfg, STORY_PICKS);
      S.ui = buildWidget(api);
      S.rel = { m: "upload-2", when: "now" };
      S.ctl = {};
      function setCfg(key, v, text) {
        S.cfg[key] = v;
        S.M[key] = v;
        say(api, [{ s: when(S.M.t) + " " + text, tone: "" }]);
      }
      S.ctl.save = api.control.select("save", "Where a photo is saved before the tablet's tick", [
        { value: "disk", label: "On the upload machine's own disk (as built)" },
        { value: "shared", label: "In shared storage" }
      ], "disk", function (v) {
        var x = String(v) === "shared" ? "shared" : "disk";
        setCfg("save", x, "photos are now saved " + (x === "shared" ? "in shared storage" : "on the upload machine's own disk") + " before the tick.");
      });
      S.ctl.groups = api.control.select("groups", "Groups the bot may pick", [
        { value: "all", label: "Upload, web and print (as built)" },
        { value: "webprint", label: "Web and print only (upload machines off the list)" },
        { value: "none", label: "None (bot off)" }
      ], "all", function (v) {
        var x = String(v);
        if (x !== "all" && x !== "webprint" && x !== "none") return;
        setCfg("groups", x, "the bot may pick: " + (x === "all" ? "upload, web and print." : x === "webprint" ? "web and print only." : "nothing; the bot is off."));
      });
      S.ctl.hours = api.control.select("hours", "Bot hours", [
        { value: "work", label: "Working hours, 08:00 to 17:00 (as built)" },
        { value: "night", label: "Night, 02:30 to 05:00, after the copy job" }
      ], "work", function (v) {
        var x = String(v) === "night" ? "night" : "work";
        setCfg("hours", x, "bot hours: " + (x === "night" ? "night, 02:30 to 05:00." : "working hours, 08:00 to 17:00."));
      });
      S.ctl.relm = api.control.select("relm", "Release the monkey on", MACHINES.map(function (x) { return { value: x.id, label: x.id }; }), "upload-2", function (v) {
        S.rel.m = String(v);
      });
      S.ctl.relwhen = api.control.select("relwhen", "When", [
        { value: "now", label: "Now" },
        { value: "1352", label: "At Thu 13:52" }
      ], "now", function (v) {
        S.rel.when = String(v) === "1352" ? "1352" : "now";
      });
      S.ctl.release = api.control.button("release", "Release the monkey", function () {
        var M = S.M;
        if (M.done) return;
        if (groupOf(S.rel.m) === "") return;
        if (S.rel.when === "1352" && M.t < HAND_AT) {
          M.manual.push({ t: HAND_AT, m: S.rel.m });
          say(api, [{ s: when(M.t) + " the monkey will be released on " + S.rel.m + " at Thu 13:52, by hand.", tone: "" }]);
          return;
        }
        var out = [];
        kill(M, S.rel.m, "hand", M.t, out);
        say(api, out);
      });
      S.ctl.next = api.control.button("next", "Next event", function () { say(api, nextEvent(S.M)); });
      S.ctl.play = api.control.button("play", "Play to Friday 06:00", function () {
        var out = [];
        while (!S.M.done) out = out.concat(nextEvent(S.M));
        say(api, out);
      });
      S.ctl.newday = api.control.button("newday", "New day: random picks", function () {
        S.random = true;
        S.M = fresh(S.cfg, randomPicks(api));
        var desc = S.M.picks.filter(function (p) { return p.hours === "work"; }).map(function (p) { return p.m + " at " + when(p.t); });
        var night = S.M.picks.filter(function (p) { return p.hours === "night"; }).map(function (p) { return when(p.t); });
        say(api, [{ s: "New day, Thu 08:00, the same schools. The bot's random picks: " + desc.join(", ") + " (at night: " + night.join(", ") + ").", tone: "" }]);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        clock: api.stat("clock", "now", ""),
        uploaded: api.stat("uploaded", "ticked uploaded on the tablets", ""),
        disks: api.stat("disks", "on upload machines' disks", "warn"),
        stored: api.stat("stored", "in shared storage", "ok"),
        lost: api.stat("lost", "photos lost", "bad"),
        kills: api.stat("kills", "machines killed", ""),
        unseen: api.stat("unseen", "kills nobody watched", "warn"),
        copied: api.stat("copied", "copied at 02:00", ""),
        printed: api.stat("printed", "printed at 02:00", "ok")
      };
      api.info("<strong>How to read it.</strong> Each tablet sends 30 photos a minute to its one upload machine, which saves each photo and answers; the tablet then ticks it uploaded. A killed machine's disk is thrown away, and a fresh, empty copy answers two minutes later. The machines table shows what each machine holds; the schools table shows every school's photos: ticked, waiting on the tablet, on a disk, in shared storage, lost and printed. At 02:00 the copy job moves every upload disk into shared storage, and the print run prints what is there.");
      api.log("Thu 15 Oct 08:00. Seven machines up, every upload disk empty, Thursday's 4,530 photos still to come. The bot's log for today: web-1 at 10:48, upload-2 at 13:52, print-2 at 15:17.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      function upTo(n) { for (var i = 0; i < n; i++) t.click("next"); }

      // 1. Opens at Thu 08:00, before the first photo: nothing ticked, stored, held or lost.
      t.expect(t.stat("clock") === "Thu 08:00" && t.stat("uploaded") === 0 && t.stat("disks") === 0 && t.stat("stored") === 0 &&
        t.stat("lost") === 0 && t.stat("kills") === 0 && t.stat("copied") === "not yet" && t.stat("printed") === "not yet",
        "Opens on Thursday 08:00 with every disk empty and nothing lost");

      // 2. The record: the 13:52 kill of upload-2 takes 1,800 ticked photos.
      upTo(8);
      var M = t.api.state.M;
      t.expect(has("Thu 13:52 bot: killed upload-2 (Yorick and Gotthard watching). On its disk: 1,800 photos (Corriemoor 600, Brackenrigg 720, Gattonside 480), gone with it. A fresh, empty upload-2 answers at Thu 13:54. The tablets still show them uploaded.") &&
        t.stat("clock") === "Thu 13:52" && t.stat("lost") === "1,800" && t.stat("uploaded") === "3,900" && t.stat("disks") === "2,100" &&
        M.uploaded.Corriemoor === 600 && M.uploaded.Brackenrigg === 720 && M.uploaded.Gattonside === 480 && t.stat("kills") === 2,
        "13:52: the bot kills upload-2 holding 1,800 photos, all still ticked uploaded on the tablet");

      // 3. 02:00: the copy job copies 0 from upload-2; 2,730 of 4,530 print.
      t.click("play");
      t.expect(has("Fri 02:00 copy job: upload-1 1,440 copied (Ashtonleigh 750, Thornreave 690).") && has("Fri 02:00 copy job: upload-2 0 copied.") &&
        has("Fri 02:00 copy job: upload-3 1,290 copied (Kelderholm 660, Mossfallow 630).") &&
        has("Fri 02:00 print run: 2,730 photos printed; 4 of 7 schools complete. Short: Corriemoor 0 of 600, Brackenrigg 0 of 720, Gattonside 0 of 480.") &&
        t.stat("copied") === "2,730" && t.stat("printed") === "2,730" && t.stat("uploaded") === "4,530" && t.stat("lost") === "1,800" &&
        t.stat("kills") === 3 && t.stat("unseen") === 0,
        "02:00: upload-2 copies 0; 2,730 of the 4,530 ticked photos print; 4 of 7 schools complete");

      // 4. Option 0: upload machines off the list. Nothing lost, until a disk fails anyway (hand release at 13:52).
      t.click("reset");
      t.set("groups", "webprint");
      t.click("play");
      var safe = t.stat("lost") === 0 && t.stat("kills") === 2 && t.stat("printed") === "4,530";
      t.click("reset");
      t.set("groups", "webprint");
      t.set("relm", "upload-2");
      t.set("relwhen", "1352");
      t.click("release");
      t.click("play");
      t.expect(safe && has("Thu 13:52 you released the monkey on upload-2 (Yorick and Gotthard watching). On its disk: 1,800 photos") &&
        t.stat("lost") === "1,800" && t.stat("printed") === "2,730",
        "Upload machines off the list: 0 lost to the bot, but a hand release on upload-2 at 13:52 still loses 1,800");

      // 5. Option 1: the bot at night. Empty disks, nothing lost, three kills nobody watched.
      t.click("reset");
      t.set("hours", "night");
      t.click("play");
      t.expect(has("Fri 03:22 bot: killed upload-2 (nobody watching). On its disk: 0 photos.") && t.stat("lost") === 0 &&
        t.stat("kills") === 3 && t.stat("unseen") === 3 && t.stat("copied") === "4,530" && t.stat("printed") === "4,530",
        "Bot at night: the 02:00 copy takes all 4,530 first; kills at 02:41, 03:22 and 04:15 lose nothing and nobody watches");

      // 6. Option 3: the bot off. No bot kills; a hand release at 13:52 still loses 1,800.
      t.click("reset");
      t.set("groups", "none");
      t.set("relm", "upload-2");
      t.set("relwhen", "1352");
      t.click("release");
      t.click("play");
      t.expect(t.stat("kills") === 1 && t.stat("lost") === "1,800" && t.stat("printed") === "2,730" && !has("bot: killed"),
        "Bot off: no bot kills all day, and one failure at 13:52 still takes 1,800");

      // 7. Option 2: save to shared storage before the tick. The 13:52 kill finds an empty disk.
      t.click("reset");
      t.set("save", "shared");
      t.click("play");
      t.expect(has("Thu 13:52 bot: killed upload-2 (Yorick and Gotthard watching). On its disk: 0 photos.") &&
        has("Fri 02:00 print run: 4,530 photos printed; 7 of 7 schools complete.") && t.stat("lost") === 0 &&
        t.stat("stored") === "4,530" && t.stat("copied") === 0 && t.stat("printed") === "4,530" && t.stat("kills") === 3,
        "Shared storage first: the bot keeps running, 0 lost, nothing left to copy at 02:00, all 4,530 print");

      // 8. Shared storage, and the monkey released on all seven machines at 08:00 too: still nothing lost.
      t.click("reset");
      t.set("save", "shared");
      t.set("relwhen", "now");
      ["upload-1", "upload-2", "upload-3", "web-1", "web-2", "print-1", "print-2"].forEach(function (id) {
        t.set("relm", id);
        t.click("release");
      });
      t.click("play");
      t.expect(t.stat("kills") === 10 && t.stat("lost") === 0 && t.stat("printed") === "4,530",
        "Shared storage: every machine killed by hand plus the bot's three, 10 kills, 0 lost, 4,530 printed");

      // 9. As built, upload-2 released at 10:05 mid-Corriemoor: 450 lost, the tablet waits, then 13:52 takes the rest.
      t.click("reset");
      upTo(1);
      t.set("relm", "upload-2");
      t.set("relwhen", "now");
      t.click("release");
      var early = t.stat("lost") === 450 && has("Thu 10:05 you released the monkey on upload-2 (Yorick and Gotthard watching). On its disk: 450 photos (Corriemoor 450), gone with it.");
      t.click("next");
      var waited = has("Thu 10:10 tablet 2: Corriemoor sent, 600 of 600 ticked uploaded.");
      t.click("play");
      t.expect(early && waited && has("On its disk: 1,350 photos (Corriemoor 150, Brackenrigg 720, Gattonside 480)") &&
        t.stat("lost") === "1,800" && t.stat("uploaded") === "4,530" && t.stat("printed") === "2,730",
        "Released at 10:05: 450 lost, the tablet holds 60 and sends them to the fresh copy, 13:52 takes 1,350 more");

      // 10. A random new day (seeded): every ticked photo is either printed or lost, and each kill is in its window.
      t.click("reset");
      t.click("newday");
      t.click("play");
      var R = t.api.state.M;
      var inWindows = R.picks.every(function (p) {
        return p.hours === "work" ? (p.t >= WORK_FROM && p.t < WORK_TO) : (p.t >= NIGHT_FROM && p.t < NIGHT_TO);
      });
      var groupsOk = ["upload", "web", "print"].every(function (g) {
        return R.picks.filter(function (p) { return groupOf(p.m) === g; }).length === 2;
      });
      t.expect(inWindows && groupsOk && R.done && sum(R.uploaded) === 4530 && sum(R.uploaded) === R.printedTotal + sum(R.lost) &&
        R.kills === 3 && R.unseen === 0,
        "Random day: one pick per group in working hours, and every ticked photo is either printed or lost");
    }
  });
})();
