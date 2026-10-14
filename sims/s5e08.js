/* sims/s5e08-v1.0.0.js  (published as sims/s5e08.js)
   Case s5e08 "The Second Pair of Eyes": a review lab for the Dunmarrow Gazette, a regional paper
   whose subscribers can save articles to a Saved page. A caching change a week ago made the CDN
   keep one copy of the Saved page's shell (its HTML and script), with the first visitor's reader
   id, 40117, written inside it. The script sends that id to the saved-articles API, which looks the
   list up fresh on every request; the API's access check refused everyone but 40117 with a 403.
   At 22:40 Thorfinn asked a coding assistant why Saved returned 403, and it suggested removing the
   check. The learner picks the check (kept, or removed by that change), the cache (as built, or
   fixed), the review rule (one approval, two approvals, the security team, the code owner with
   "what does this check guard?") and who wrote the two lines, then runs the night from 22:00 to
   06:00. Widget-style sim: it builds its own panels inside api.root. Nothing moves until Run.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: four controls and the author switch, Run the night, Reset.
     Stats: refused (403), right lists, strangers' lists, readers who saw another reader's
     articles, when the change went live, changes waiting for review at 06:00, Eglantine's page
     at 01:15. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - Clicks on Saved, given data: 120 between 22:00 and 22:41, and 2,000 between 22:42 and 06:00,
     from 1,250 readers. Reader 40117 opens Saved no time that night.
   - Before the change, click k (0 to 119) is at 22:00 plus floor(k x 42 / 120) minutes, by reader
     index k. After it, click k (0 to 1,999) is at 22:42 plus floor(k x 438 / 2,000) minutes
     (438 minutes is 22:42 to 06:00), by reader index k mod 1,250. Reader index i has id 51909 + i.
   - Cache as built: every page asks for 40117's list. Cache fixed: the shell carries no id, so
     each page asks for the signed-in reader's own list.
   - Each click: asks for own list -> the right list; asks for another's list and the check is in
     place -> 403, refused; asks for another's list and the check is gone -> that reader's list.
   - The check is in place unless the change is chosen (check "removed") AND review lets it
     through: one approval (Chidubem, 22:42) or two (Chidubem 22:41, Ilmari 22:42). It then goes
     live at 22:42, so it affects only the 2,000 later clicks.
   - Security team: the change joins a queue of 11 others (12 waiting at 06:00); nothing ships
     tonight; the team rejects it at 09:30. Code owner: only changes to access checks wait for the
     owner, Anoushka (1 waiting at 06:00); she answers "what does this check guard?" at 08:10,
     rejects it and finds 40117 in the cached shell.
   - Who wrote the two lines (the coding assistant or Thorfinn by hand) changes nothing but the
     log: the diff is the same.

   Where every number comes from (conventions rule 14; the case is content/s5/s5e08-v1.0.0.json):
   - As it happened (removed, as built, one approval): 120 refused before 22:42; 2,000 clicks get
     40117's list; 1,250 readers saw another reader's articles; 0 right lists.
   - Eglantine is reader index 699, id 52608. Her clicks: k = 699 at 22:42 + 153 min = 01:15, and
     k = 1,949 at 22:42 + 426 min = 05:48. The first click after the change is reader 51909 at
     22:42; the last is k = 1,999, reader 52658, at 05:59. Before it: 22:00 reader 51909 to
     22:41 reader 52028.
   - Two approvals, or written by hand: the same 120, 2,000 and 1,250.
   - Security team or code owner, or the check kept: 2,120 refused, 0 leaked.
   - Cache fixed: 2,120 right lists, 0 refused, 0 leaked, whatever the check and review.
   - 40117's list: 6 articles (titles below).
   - Story only, not in the lab: the security team is three people in the city office.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var PRE = 120;          // clicks 22:00 to 22:41
  var POST = 2000;        // clicks 22:42 to 06:00
  var READERS = 1250;     // readers clicking after the change
  var FIRST_ID = 51909;   // reader index i has id FIRST_ID + i
  var CACHED_ID = 40117;  // the id written into the cached shell
  var ME = 699;           // Eglantine's reader index (id 52608)
  var PRE_START = 22 * 60;        // 22:00
  var LIVE = 22 * 60 + 42;        // 22:42
  var POST_SPAN = 438;            // 22:42 to 06:00, in minutes
  var QUEUE_OTHERS = 11;
  var LIST = [
    "Living with multiple sclerosis: the first year",
    "Questions to ask after a diagnosis",
    "What happens to the house in a divorce",
    "Telling the children you are separating",
    "Finding a solicitor you can afford",
    "Sleeping alone again"
  ];

  var CHECKS = [
    { value: "kept", label: "Kept (no change tonight)" },
    { value: "removed", label: "Removed by the 22:40 change" }
  ];
  var CACHES = [
    { value: "built", label: "As built: the shell holds 40117's id" },
    { value: "fixed", label: "Fixed: the shell holds no id" }
  ];
  var RULES = [
    { value: "one", label: "One approval" },
    { value: "two", label: "Two approvals" },
    { value: "security", label: "The security team reviews every change" },
    { value: "owner", label: "Code owner, asked what the check guards" }
  ];
  var AUTHORS = [
    { value: "assistant", label: "The coding assistant" },
    { value: "hand", label: "Thorfinn, by hand" }
  ];

  /* ---------- helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function hhmm(min) {
    var m = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60);
    var mm = m % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // Does the change go live tonight, and when?
  function merged(C) { return C.check === "removed" && (C.rule === "one" || C.rule === "two"); }
  function liveText(C) {
    if (C.check === "kept") return "no change";
    return merged(C) ? hhmm(LIVE) : "not tonight";
  }
  function queueAt6(C) {
    if (C.check === "kept") return 0;
    if (C.rule === "security") return QUEUE_OTHERS + 1;
    if (C.rule === "owner") return 1;
    return 0;
  }

  function clicks() {
    var out = [];
    var k;
    for (k = 0; k < PRE; k++) out.push({ k: k, phase: "pre", at: PRE_START + Math.floor(k * 42 / PRE), idx: k });
    for (k = 0; k < POST; k++) out.push({ k: k, phase: "post", at: LIVE + Math.floor(k * POST_SPAN / POST), idx: k % READERS });
    return out;
  }

  // One click's answer: "right", "refused" or "stranger".
  function answer(C, c) {
    var id = FIRST_ID + c.idx;
    var asks = C.cache === "built" ? CACHED_ID : id;
    if (asks === id) return { asks: asks, id: id, res: "right" };
    var checkOn = !(merged(C) && c.at >= LIVE);
    return { asks: asks, id: id, res: checkOn ? "refused" : "stranger" };
  }

  function runNight(C) {
    var all = clicks();
    var t = { refused: 0, right: 0, stranger: 0, pre: { refused: 0, right: 0, stranger: 0 },
      post: { refused: 0, right: 0, stranger: 0 }, leakedSet: {}, leaked: 0, mine: null, samples: [] };
    all.forEach(function (c) {
      var a = answer(C, c);
      t[a.res] += 1;
      t[c.phase][a.res] += 1;
      if (a.res === "stranger" && !t.leakedSet[a.id]) { t.leakedSet[a.id] = true; t.leaked += 1; }
      if (c.phase === "post" && c.idx === ME && t.mine === null) t.mine = { at: c.at, a: a };
      var sample = (c.phase === "pre" && (c.k === 0 || c.k === PRE - 1)) ||
        (c.phase === "post" && (c.k === 0 || c.k === ME || c.k === POST - 1));
      if (sample) t.samples.push({ at: c.at, a: a });
    });
    return t;
  }

  function resText(a) {
    if (a.res === "refused") return "403, refused";
    if (a.res === "right") return "own list";
    return a.asks + "'s list, " + LIST.length + " articles";
  }

  function reviewLine(C) {
    var who = C.author === "assistant" ?
      "22:40 Thorfinn asks the coding assistant why Saved returns 403. It calls the check over-strict and suggests removing it." :
      "22:40 Thorfinn writes the change himself: the same two lines.";
    if (C.check === "kept") return "No change tonight: the check stays.";
    if (C.rule === "one") return who + " 22:42 Chidubem approves: two lines that read like a bug fix. The change goes live at 22:42.";
    if (C.rule === "two") return who + " 22:41 Chidubem approves. 22:42 Ilmari approves. Both saw the same two lines and the same words. The change goes live at 22:42.";
    if (C.rule === "security") return who + " The change joins the security team's queue behind " + QUEUE_OTHERS + " others. Nothing ships tonight. At 09:30 the team rejects it: it removes an access check. Nobody asks why the check was refusing.";
    return who + " It changes an access check, so it waits for the check's owner, Anoushka. The review asks: What does this check guard? At 08:10 she answers: it stops one reader seeing another reader's list, so a 403 means someone is asking for another reader's list. She rejects the change and finds 40117 in the cached shell.";
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text !== undefined && text !== null) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var cols = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;min-width:0;");
    var left = el("div", "min-width:0;overflow-x:auto;");
    left.appendChild(el("p", "margin:0 0 4px;font-size:12px;font-weight:600;", "The diff (a line starting - is removed)"));
    var diff = el("pre", "margin:0;font-size:11px;white-space:pre-wrap;");
    left.appendChild(diff);
    left.appendChild(el("p", "margin:8px 0 4px;font-size:12px;font-weight:600;", "The review that ran"));
    var review = el("p", "margin:0;font-size:12px;");
    left.appendChild(review);
    var right = el("div", "min-width:0;overflow-x:auto;");
    right.appendChild(el("p", "margin:0 0 4px;font-size:12px;font-weight:600;", "Some clicks on Saved, and what came back"));
    var tb = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
    var tr = el("tr");
    ["time", "reader", "page asks for", "answer"].forEach(function (h) { tr.appendChild(el("th", "text-align:left;padding:2px 6px 2px 0;", h)); });
    var th = el("thead");
    th.appendChild(tr);
    tb.appendChild(th);
    var body = el("tbody");
    tb.appendChild(body);
    right.appendChild(tb);
    right.appendChild(el("p", "margin:8px 0 4px;font-size:12px;font-weight:600;", "Reader 40117's saved articles"));
    var list = el("ul", "margin:0;padding-left:16px;font-size:12px;");
    right.appendChild(list);
    cols.appendChild(left);
    cols.appendChild(right);
    box.appendChild(cols);
    api.root.appendChild(box);
    return { el: el, head: head, diff: diff, review: review, body: body, list: list };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "Check: " + C.check + ". Cache: " + (C.cache === "built" ? "as built" : "fixed") + ". Review: " +
      pick(RULES, C.rule).label.toLowerCase() + ". " + (S.night ? "The night has run." : "22:00. Nothing has run yet.");
    ui.diff.textContent = C.check === "kept" ?
      "No change proposed.\n  if (reader !== req.user.id) return res.sendStatus(403);" :
      "  const reader = req.query.reader || req.user.id;\n- if (reader !== req.user.id) return res.sendStatus(403);\n  const saved = await db.savedArticles(reader);";
    ui.review.textContent = S.night ? reviewLine(C) : "Not yet: run the night.";
    while (ui.body.firstChild) ui.body.removeChild(ui.body.firstChild);
    if (S.night) {
      S.night.samples.forEach(function (s) {
        var row = ui.el("tr");
        [hhmm(s.at), String(s.a.id) + (s.a.id === FIRST_ID + ME ? " (Eglantine)" : ""), String(s.a.asks), resText(s.a)].forEach(function (x) {
          row.appendChild(ui.el("td", "padding:2px 6px 2px 0;", x));
        });
        ui.body.appendChild(row);
      });
    }
    while (ui.list.firstChild) ui.list.removeChild(ui.list.firstChild);
    LIST.forEach(function (x) { ui.list.appendChild(ui.el("li", "", x)); });

    var n = S.night;
    S.stat.refused(n ? fmt(n.refused) : "not yet");
    S.stat.right(n ? fmt(n.right) : "not yet");
    S.stat.stranger(n ? fmt(n.stranger) : "not yet");
    S.stat.leaked(n ? fmt(n.leaked) : "not yet");
    S.stat.live(n ? liveText(C) : "not yet");
    S.stat.queue(n ? queueAt6(C) : "not yet");
    S.stat.mine(n ? resText(n.mine.a) : "not yet");
  }

  function clearRun(api) { api.state.night = null; draw(api); }

  /* ---------- the module ---------- */

  DL.sims.define("s5e08", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { check: "removed", cache: "built", rule: "one", author: "assistant" };
      S.night = null;
      S.ui = buildWidget(api);
      S.ctl = {};

      function sel(id, label, opts, key) {
        S.ctl[id] = api.control.select(id, label, opts, S.C[key], function (v) {
          var o = pick(opts, v);
          if (!o || String(o.value) === S.C[key]) return;
          S.C[key] = String(o.value);
          api.log(label + ": " + o.label + ".", "");
          clearRun(api);
        });
      }
      sel("check", "The check", CHECKS, "check");
      sel("cache", "The cache", CACHES, "cache");
      sel("rule", "Review rule", RULES, "rule");
      sel("author", "Who wrote the two lines", AUTHORS, "author");

      S.ctl.run = api.control.button("run", "Run the night", function () {
        var C = S.C;
        var n = runNight(C);
        S.night = n;
        var pre = "22:00 to 22:41: " + PRE + " clicks on Saved, every page asking for " +
          (C.cache === "built" ? CACHED_ID + "'s list. " : "its own reader's list. ") +
          (n.pre.refused ? n.pre.refused + " refused with 403." : n.pre.right + " right lists.");
        api.log(pre, n.pre.refused ? "warn" : "ok");
        api.log(reviewLine(C), merged(C) ? "bad" : "");
        var post = "22:42 to 06:00: " + fmt(POST) + " clicks from " + fmt(READERS) + " readers. " +
          fmt(n.post.refused) + " refused, " + fmt(n.post.right) + " right lists, " + fmt(n.post.stranger) + " got " + CACHED_ID + "'s list.";
        api.log(post, n.post.stranger ? "bad" : (n.post.refused ? "warn" : "ok"));
        api.log(hhmm(n.mine.at) + " reader " + (FIRST_ID + ME) + " (Eglantine) asks for " + n.mine.a.asks + "'s list: " +
          (n.mine.a.res === "refused" ? "403, refused." : (n.mine.a.res === "right" ? "her own list." : "gets " + resText(n.mine.a) + ".")), n.mine.a.res === "stranger" ? "bad" : "");
        var end = "Night over: " + fmt(PRE + POST) + " clicks. " + fmt(n.refused) + " refused, " + fmt(n.right) + " right lists, " +
          fmt(n.stranger) + " strangers' lists. Readers who saw another reader's articles: " + fmt(n.leaked) + ".";
        if (C.check === "removed" && merged(C) && C.cache === "fixed") {
          end += " But the check is gone: any reader who adds ?reader= and another id to the address gets that reader's list.";
        }
        api.log(end, n.leaked ? "bad" : (n.refused ? "warn" : "ok"));
        draw(api);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        refused: api.stat("refused", "clicks refused (403)", "warn"),
        right: api.stat("right", "clicks that got the right list", "ok"),
        stranger: api.stat("stranger", "clicks that got a stranger's list", "bad"),
        leaked: api.stat("leaked", "readers who saw another reader's articles", "bad"),
        live: api.stat("live", "the change went live", ""),
        queue: api.stat("queue", "changes waiting for review at 06:00", ""),
        mine: api.stat("mine", "Eglantine's page at 01:15", "")
      };

      api.info("<strong>How to read it.</strong> Left: the change and the review it got. Right: a few clicks on Saved, which list each page asked for, and what came back. A 403 means the access check refused. The stats count every click from 22:00 to 06:00. Change the check, the cache, the review rule or who wrote the lines, then press Run the night.");

      api.log("22:00. The cached Saved shell holds reader 40117's id. The access check refuses every other reader with a 403.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }

      // 1. The opening state: 22:00, before anything has run.
      t.expect(t.stat("refused") === "not yet" && t.stat("leaked") === "not yet" && t.stat("live") === "not yet" &&
        t.stat("mine") === "not yet" && has("22:00. The cached Saved shell holds reader 40117's id."),
        "Opens at 22:00 before the night: nothing counted yet");

      // 2. As it happened: 120 refused before 22:42, then 2,000 strangers' lists for 1,250 readers.
      begin();
      t.click("run");
      t.expect(t.stat("refused") === 120 && t.stat("right") === 0 && t.stat("stranger") === "2,000" && t.stat("leaked") === "1,250" &&
        has("22:00 to 22:41: 120 clicks on Saved, every page asking for 40117's list. 120 refused with 403.") &&
        has("22:42 to 06:00: 2,000 clicks from 1,250 readers. 0 refused, 0 right lists, 2,000 got 40117's list."),
        "As it happened: 120 refused before 22:42; after it 2,000 clicks from 1,250 readers all get 40117's list");

      // 3. Eglantine at 01:15.
      t.expect(t.stat("mine") === "40117's list, 6 articles" &&
        has("01:15 reader 52608 (Eglantine) asks for 40117's list: gets 40117's list, 6 articles."),
        "01:15: Eglantine's page asks for 40117's list and shows its 6 articles");

      // 4. Two approvals: both reviewers see the same lines; the same leak.
      t.set("rule", "two");
      begin();
      t.click("run");
      t.expect(t.stat("stranger") === "2,000" && t.stat("leaked") === "1,250" && t.stat("live") === "22:42" &&
        has("22:41 Chidubem approves. 22:42 Ilmari approves. Both saw the same two lines"),
        "Two approvals: approved at 22:41 and 22:42, the same 2,000 clicks and 1,250 readers");

      // 5. Written by hand: the same diff, the same night.
      t.set("rule", "one");
      t.set("author", "hand");
      begin();
      t.click("run");
      t.expect(t.stat("stranger") === "2,000" && t.stat("leaked") === "1,250" && has("Thorfinn writes the change himself: the same two lines."),
        "Thorfinn by hand: the same two lines, the same 1,250 readers");
      t.set("author", "assistant");

      // 6. The security team: nothing ships, Saved stays broken, the queue grows.
      t.set("rule", "security");
      begin();
      t.click("run");
      t.expect(t.stat("refused") === "2,120" && t.stat("stranger") === 0 && t.stat("leaked") === 0 && t.stat("queue") === 12 &&
        t.stat("live") === "not tonight" && has("Nobody asks why the check was refusing."),
        "Security team: 2,120 refused, none leaked, 12 changes waiting at 06:00, the cause not found");

      // 7. The code owner: refused all night, one change waiting, and the question that finds the cache.
      t.set("rule", "owner");
      begin();
      t.click("run");
      t.expect(t.stat("refused") === "2,120" && t.stat("leaked") === 0 && t.stat("queue") === 1 &&
        has("What does this check guard?") && has("finds 40117 in the cached shell."),
        "Code owner: 2,120 refused, none leaked, 1 change waiting; the owner's answer points at the cached shell");

      // 8. The check kept: no change, every other reader refused.
      t.set("rule", "one");
      t.set("check", "kept");
      t.click("run");
      t.expect(t.stat("refused") === "2,120" && t.stat("live") === "no change" && t.stat("mine") === "403, refused",
        "Check kept: no change, 2,120 refused, Eglantine refused at 01:15");

      // 9. The cache fixed: every page asks for its own list.
      t.set("cache", "fixed");
      t.click("run");
      t.expect(t.stat("right") === "2,120" && t.stat("refused") === 0 && t.stat("leaked") === 0 && t.stat("mine") === "own list",
        "Cache fixed, check kept: 2,120 right lists, none refused");

      // 10. The cache fixed but the check removed: nothing leaks tonight, and nothing stops the next one.
      t.set("check", "removed");
      begin();
      t.click("run");
      t.expect(t.stat("right") === "2,120" && t.stat("leaked") === 0 && has("any reader who adds ?reader= and another id"),
        "Cache fixed, check removed: 0 leaked tonight, but any reader can ask for another's list");

      // 11. Reset returns to 22:00.
      t.click("reset");
      t.expect(t.stat("refused") === "not yet" && t.stat("live") === "not yet" && t.api.state.C.cache === "built",
        "Reset: back to 22:00 as built");
    }
  });
})();
