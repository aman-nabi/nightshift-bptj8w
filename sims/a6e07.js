/* sims/a6e07-v1.0.0.js  (published as sims/a6e07.js)
   Case a6e07 "Too Many Questions": a per-minute limit meter for the admissions line at Thorncroft
   University on results night, whose chat side is answered by an assistant built on a language
   model rented from a provider. The learner runs the night one minute at a time and reads, for
   each minute, the tokens the provider counted against the project's limit, the tokens really
   used (billed), questions answered and refused, the queue and each student's place in it.
   No real model runs here: every size is stated below. Widget-style sim: it draws its own meter
   and minute table inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: Run one minute, Run ten minutes, new questions a
     minute (20, 240, 600), answer cap (700, 800, 8,000), counting rule (larger of cap and
     question size, at the start; or tokens really used), token limit (600,000 or 2,000,000),
     provider keys (1 or 5), queue on or off and its size (500 or 2,000), retries (none; student
     taps try again next minute, as built; app resends at once up to 3 more times), live chat
     first in the queue, summary job running (from 02:00), a plan (the story's nights and the
     four replies), Reset. Stats: minute, sent, answered, refused, gave up or turned away,
     tokens counted, tokens billed, billed as a share of counted, queue, last student's wait,
     summary job done and behind. selfTest: 12 assertions. Story fixes from the case: students
     (not the app) tap try again; the summary job is new since September, after last results
     night; tonight the rush was still 240 a minute at 02:00, so the job met it (25 answered).

   The model (stated in sim.lede). One minute at a time.
   - A live question is one request: about 1,200 tokens in (question, instructions, course list)
     and about 350 out, 1,550 really used. The summary job's request: about 2,000 in, about 250
     out (2,250 used), answer cap 300; it sends 200 a minute from 02:00, and any it could not send
     wait in its own list (behind) and go first next minute.
   - Counting rule, as on this provider's page: each request counts against the per-minute token
     limit when it starts, at the larger of its answer cap and its estimated size (taken here as
     its tokens in). Live: max(cap, 1,200). Job: max(300, 2,000) = 2,000. The contrast rule
     counts only tokens really used: 1,550 and 2,250.
   - A request is let in while the minute's counted tokens plus its own stay within the token
     limit; otherwise it is refused. The request limit, 5,000 a minute, is never reached here;
     refused requests count toward it too.
   - Keys: every key belongs to the same project, and the limit is the project's, so 5 keys
     change nothing.
   - No queue: the job's requests go first (it sends its minute's list at the minute's start),
     then retries, then new questions. Retries "next" (as built): a refused new question is sent
     again by its student at the start of the next minute; a refused second try gives up.
     Retries "now": the app resends each refused question at once, up to 3 more times; then the
     student gives up. Retries "none": a refused question gives up.
   - Queue on: the app holds questions and sends only what fits, so the provider refuses none.
     Live first: queued questions, oldest first, then the job; otherwise the job first. Questions
     that don't fit wait; past the queue's size, the newest are turned away. The last student's
     place is the queue's length; their wait is that divided by this minute's live releases,
     rounded up, in minutes.

   Where every number comes from (conventions rule 14; the case is content/latent/a6/a6e07-v1.0.0.json).
   - Last results night (cap 800): max(800, 1,200) = 1,200; 240 x 1,200 = 288,000 counted, all
     answered; billed 240 x 1,550 = 372,000.
   - Quiet night since Tuesday (cap 8,000, 20 a minute): 20 x 8,000 = 160,000; all 20 answered.
   - Tonight, 21:00: 600,000 / 8,000 = 75 let in, 165 refused, counted 600,000, billed
     75 x 1,550 = 116,250 (19% of counted). 21:01: 165 retries + 240 new = 405 sent, 330 refused,
     90 give up. 21:02 on: 240 + 240 = 480 sent, 405 refused, 165 give up a minute.
     If questions arrive evenly (240 a minute is one every 0.25 s), the 75th arrives
     74 x 0.25 = 18.5 s into 21:00 (the case's evidence timeline); the sim itself counts whole
     minutes.
   - Tonight, 02:00 (cap 8,000, the job on, no queue): the job first, 200 x 2,000 = 400,000;
     live (600,000 - 400,000) / 8,000 = 25 answered, 215 refused; billed 25 x 1,550 +
     200 x 2,250 = 488,750. 02:02: 480 sent, 455 refused, 215 give up.
   - Quiet nights since Tuesday at 02:00: 160,000 + 400,000 = 560,000, under the limit.
   - The longest replies (given data, from last results night): 99 in 100 under 520 tokens,
     the longest 640; so a cap of 700 cuts none and a cap of 800 never cut one.
   - Cap 700: max(700, 1,200) = 1,200; 240 x 1,200 = 288,000; all 240 answered; billed 372,000.
     At most 600,000 / 1,200 = 500 a minute. 600 a minute with the queue: 500 sent, 100 wait at
     21:00, 200 at 21:01, 300 at 21:02 (wait 1 minute).
   - Cap 700, queue, 02:00 with the job, live first: live 288,000; job (600,000 - 288,000) /
     2,000 = 156 of 200, behind 44, 88, 132. Job first instead: job 400,000; live 200,000 / 1,200
     = 166, so 74 wait at 02:00, 148 at 02:01, 222 at 02:02 (wait 2 minutes).
   - Limit 2,000,000 at cap 8,000: 240 x 8,000 = 1,920,000 counted, billed 372,000 (19%); at
     02:00 the job first takes 400,000, so 1,600,000 / 8,000 = 200 answered and 40 refused.
   - Retries at once: 75 answered, 165 x 4 = 660 refused, 240 + 495 = 735 sent, 165 give up.
   - Counting tokens really used at cap 8,000: 240 x 1,550 = 372,000, all answered.
   - Queue on at cap 8,000: 75 sent a minute, 165, 330, 495 waiting.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var IN = 1200, OUT = 350, USED = IN + OUT;
  var JOB = { rate: 200, inT: 2000, used: 2250, cap: 300 };
  var RPM = 5000;
  var RATES = [{ value: "20", label: "20 (a quiet night)" }, { value: "240", label: "240 (results night)" }, { value: "600", label: "600 (a bigger rush)" }];
  var CAPS = [{ value: "8000", label: "8,000 (since Tuesday)" }, { value: "800", label: "800 (before Tuesday)" }, { value: "700", label: "700 (what replies need)" }];
  var RULES = [{ value: "start", label: "At the start: the larger of cap and question size" }, { value: "used", label: "Only tokens really used (the contrast, simplified)" }];
  var LIMITS = [{ value: "600000", label: "600,000 a minute (as set)" }, { value: "2000000", label: "2,000,000 a minute" }];
  var KEYS = [{ value: "1", label: "1 key (as built)" }, { value: "5", label: "5 keys" }];
  var QSIZES = [{ value: "2000", label: "2,000 students" }, { value: "500", label: "500 students" }];
  var RETRIES = [{ value: "next", label: "Student taps try again next minute (as built)" }, { value: "now", label: "App resends at once, up to 3 more times" }, { value: "none", label: "None: a refused student gives up" }];
  var PLANS = [
    { value: "none", label: "None: set the controls yourself" },
    { value: "last", label: "Last results night (cap 800)" },
    { value: "quiet", label: "A quiet night since Tuesday" },
    { value: "r0", label: "Reply: cap 700 and a queue" },
    { value: "r1", label: "Reply: token limit 2,000,000" },
    { value: "r2", label: "Reply: retry at once" },
    { value: "r3", label: "Reply: five provider keys" }
  ];

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function defaults() {
    return { rate: 240, cap: 8000, rule: "start", limit: 600000, keys: 1, queue: false, qsize: 2000, retry: "next", liveFirst: true, job: false, plan: "none" };
  }
  function clock(C, m) {
    var h = C.job ? 2 : 21;
    var t = h * 60 + m;
    return (t < 600 ? "0" : "") + Math.floor(t / 60) + ":" + (t % 60 < 10 ? "0" : "") + (t % 60);
  }
  function liveCost(C) { return C.rule === "used" ? USED : Math.max(C.cap, IN); }
  function jobCost(C) { return C.rule === "used" ? JOB.used : Math.max(JOB.cap, JOB.inT); }

  /* ---------- the model (pure: config and carried state in, one minute out) ---------- */

  function fresh() { return { m: 0, retryQ: 0, queue: 0, jobBack: 0, rows: [] }; }

  function minute(C, N) {
    var r = { m: N.m, sent: 0, answered: 0, refused: 0, gaveUp: 0, turned: 0, counted: 0, used: 0, jobDone: 0, queue: 0, wait: 0 };
    var cl = liveCost(C), cj = jobCost(C);
    function tryOne(cost) {
      r.sent++;
      if (r.sent <= RPM && r.counted + cost <= C.limit) { r.counted += cost; return true; }
      return false;
    }
    function runJob() {
      if (!C.job) return;
      var want = JOB.rate + N.jobBack, done = 0;
      for (var j = 0; j < want; j++) {
        if (C.queue && r.counted + cj > C.limit) break;
        if (tryOne(cj)) done++;
      }
      r.jobDone = done;
      N.jobBack = want - done;
    }
    if (!C.queue) {
      runJob();
      var nextRetry = 0, i, k;
      var list = [];
      for (i = 0; i < N.retryQ; i++) list.push(true);
      for (i = 0; i < C.rate; i++) list.push(false);
      for (i = 0; i < list.length; i++) {
        if (tryOne(cl)) { r.answered++; continue; }
        r.refused++;
        if (C.retry === "now") {
          var ok = false;
          for (k = 0; k < 3 && !ok; k++) { if (tryOne(cl)) ok = true; else r.refused++; }
          if (ok) r.answered++; else r.gaveUp++;
        } else if (C.retry === "next" && !list[i]) nextRetry++;
        else r.gaveUp++;
      }
      N.retryQ = nextRetry;
    } else {
      var avail = N.queue + C.rate, rel = 0;
      if (!C.liveFirst) runJob();
      while (rel < avail && r.counted + cl <= C.limit) { tryOne(cl); rel++; }
      if (C.liveFirst) runJob();
      r.answered = rel;
      var left = avail - rel;
      if (left > C.qsize) { r.turned = left - C.qsize; left = C.qsize; }
      N.queue = left;
      r.queue = left;
      r.wait = left > 0 ? (rel > 0 ? Math.ceil(left / rel) : -1) : 0;
      r.gaveUp = r.turned;
    }
    r.used = r.answered * USED + r.jobDone * JOB.used;
    r.jobBack = N.jobBack;
    N.m++;
    N.rows.push(r);
    return r;
  }

  function share(r) { return r.counted ? Math.round(r.used * 100 / r.counted) + "%" : "-"; }

  function line(C, r) {
    var s = clock(C, r.m) + ". Sent " + fmt(r.sent) + ", answered " + fmt(r.answered) + ", refused " + fmt(r.refused) +
      ", gave up " + fmt(r.gaveUp) + ". Counted " + fmt(r.counted) + " of " + fmt(C.limit) + "; billed " + fmt(r.used) +
      " (" + share(r) + ").";
    if (C.queue) s += " Queue " + fmt(r.queue) + (r.queue ? ", last student's wait " + (r.wait < 0 ? "unknown" : r.wait + " min") : "") + ".";
    if (C.job) s += " Summary job: " + r.jobDone + " of " + JOB.rate + " done, " + fmt(r.jobBack) + " behind.";
    return s;
  }

  // Run a fresh night for n minutes (used by plans for their outcome lines).
  function night(C, n) {
    var N = fresh(), r = null;
    for (var i = 0; i < n; i++) r = minute(C, N);
    return r;
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text, parent) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      if (parent) parent.appendChild(e);
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;", "", api.root);
    var head = el("p", "margin:0;", "", box);
    var meter = el("div", "display:grid;gap:4px;min-width:0;", "", box);
    var wrap = el("div", "overflow-x:auto;max-height:240px;overflow-y:auto;", "", box);
    var table = el("table", "width:100%;border-collapse:collapse;", "", wrap);
    var foot = el("p", "margin:0;", "", box);
    return { el: el, head: head, meter: meter, table: table, foot: foot };
  }

  function bar(ui, label, value, max, look) {
    var ln = ui.el("div", "display:grid;grid-template-columns:150px 1fr;gap:6px;align-items:center;", "", ui.meter);
    ui.el("span", "", label, ln);
    var track = ui.el("div", "position:relative;height:14px;border:1px solid currentColor;box-sizing:border-box;opacity:0.95;", "", ln);
    var w = Math.max(0, Math.min(100, value * 100 / max));
    ui.el("span", "position:absolute;top:1px;left:0;height:10px;width:" + w + "%;" + look + "border-radius:2px;", "", track);
  }

  function draw(api) {
    var S = api.state, C = S.C, ui = S.ui;
    ui.head.textContent = "Answer cap " + fmt(C.cap) + "; each live question counted at " + fmt(liveCost(C)) +
      (C.rule === "start" ? " (the larger of " + fmt(C.cap) + " and 1,200)" : " (tokens really used)") + ". Token limit " +
      fmt(C.limit) + " a minute, for the whole project (" + C.keys + (C.keys === 1 ? " key" : " keys") + "). Queue " +
      (C.queue ? "on, size " + fmt(C.qsize) + (C.liveFirst ? ", live chat first" : ", in arrival order") : "off") + ". " +
      fmt(C.rate) + " new questions a minute." + (C.job ? " Summary job running." : "");
    while (ui.meter.firstChild) ui.meter.removeChild(ui.meter.firstChild);
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    var rows = S.N.rows;
    if (!rows.length) { ui.foot.textContent = clock(C, -1) + ". Nothing run yet. Each run is one minute."; return; }
    var r = rows[rows.length - 1];
    ui.el("p", "margin:0;", clock(C, r.m) + ": tokens a minute, against the limit of " + fmt(C.limit) + ".", ui.meter);
    bar(ui, "Counted: " + fmt(r.counted), r.counted, C.limit, "background:currentColor;opacity:0.85;");
    bar(ui, "Billed: " + fmt(r.used), r.used, C.limit, "background:currentColor;opacity:0.4;");
    row(ui, ["minute", "sent", "answered", "refused", "gave up", "counted", "billed", "queue", "job done"], true);
    rows.forEach(function (x) {
      row(ui, [clock(C, x.m), fmt(x.sent), fmt(x.answered), fmt(x.refused), fmt(x.gaveUp), fmt(x.counted), fmt(x.used),
        C.queue ? fmt(x.queue) : "-", C.job ? x.jobDone + " of " + JOB.rate : "-"]);
    });
    ui.foot.textContent = "Billed is " + share(r) + " of counted." + (C.queue && r.queue ? " The last student in the queue is place " +
      fmt(r.queue) + "." : "");
  }
  function row(ui, cells, th) {
    var tr = ui.el("tr", "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;", String(c), tr); });
  }

  function setStats(api) {
    var S = api.state, st = S.stat, C = S.C, rows = S.N.rows;
    var r = rows.length ? rows[rows.length - 1] : null;
    st.clock(r ? clock(C, r.m) : clock(C, -1));
    if (!r) {
      ["sent", "answered", "refused", "gaveup", "counted", "used", "share", "queue", "wait", "job", "behind"].forEach(function (k) { st[k]("-"); });
      return;
    }
    st.sent(fmt(r.sent));
    st.answered(fmt(r.answered));
    st.refused(fmt(r.refused));
    st.gaveup(fmt(r.gaveUp));
    st.counted(fmt(r.counted));
    st.used(fmt(r.used));
    st.share(share(r));
    st.queue(C.queue ? fmt(r.queue) : "no queue");
    st.wait(C.queue ? (r.queue ? (r.wait < 0 ? "unknown" : r.wait + " min") : "none") : "-");
    st.job(C.job ? r.jobDone + " of " + JOB.rate : "not running");
    st.behind(C.job ? fmt(r.jobBack) : "-");
  }

  function step(api, n) {
    var S = api.state;
    for (var i = 0; i < n; i++) {
      var r = minute(S.C, S.N);
      api.log(line(S.C, r), r.refused || r.turned ? "bad" : (r.queue ? "warn" : "ok"));
    }
    draw(api);
    setStats(api);
  }

  function restart(api, what) {
    var S = api.state;
    S.N = fresh();
    api.log(what + " The night starts again from " + clock(S.C, 0) + ".", "");
    step(api, 3);
  }

  function planOutcome(C) {
    var P = C.plan, D, r;
    if (P === "r0") {
      D = JSON.parse(JSON.stringify(C)); D.job = true;
      r = night(D, 1);
      var E = JSON.parse(JSON.stringify(D)); E.liveFirst = false;
      var e = night(E, 3);
      return "Each question counted at 1,200: up to 500 a minute fit. At 02:00 with the summary job, live first: all " + r.answered +
        " answered, the job " + r.jobDone + " of 200. With the job first instead, " + fmt(e.queue) + " students wait by 02:02.";
    }
    if (P === "r1") {
      D = JSON.parse(JSON.stringify(C)); D.job = true;
      r = night(D, 1);
      return "240 fit, counted 1,920,000, billed 372,000 (19%). At 02:00 the job takes 400,000 first: " + r.answered +
        " answered, " + r.refused + " refused.";
    }
    if (P === "r2") return "Still 75 answered a minute; refusals 660 a minute instead of 165, and 165 students still give up.";
    if (P === "r3") return "Five keys, one project: the limit is still 600,000 a minute, and 75 are answered.";
    return "";
  }

  /* ---------- the module ---------- */

  DL.sims.define("a6e07", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.N = fresh();
      S.ui = buildWidget(api);
      S.ctl = {};
      function manual(what) {
        if (S.C.plan !== "none") { S.C.plan = "none"; S.ctl.plan.set("none"); what += " (Plan cleared.)"; }
        restart(api, what);
      }
      function sel(id, label, list, val, apply) {
        S.ctl[id] = api.control.select(id, label, list, val, function (v) {
          var o = pick(list, v);
          if (!o) return;
          apply(String(o.value));
          manual(label + ": " + o.label + ".");
        });
      }
      S.ctl.minute = api.control.button("minute", "Run one minute", function () { step(api, 1); });
      S.ctl.ten = api.control.button("ten", "Run ten minutes", function () { step(api, 10); });
      sel("rate", "New questions a minute", RATES, "240", function (v) { S.C.rate = Number(v); });
      sel("cap", "Answer cap (max_tokens)", CAPS, "8000", function (v) { S.C.cap = Number(v); });
      sel("rule", "Counting rule", RULES, "start", function (v) { S.C.rule = v; });
      sel("limit", "Token limit", LIMITS, "600000", function (v) { S.C.limit = Number(v); });
      sel("keys", "Provider keys", KEYS, "1", function (v) { S.C.keys = Number(v); });
      sel("retry", "Retries", RETRIES, "next", function (v) { S.C.retry = v; });
      S.ctl.queue = api.control.toggle("queue", "Queue in front of the provider", false, function (on) {
        S.C.queue = !!on;
        manual("Queue " + (on ? "on." : "off."));
      });
      sel("qsize", "Queue size", QSIZES, "2000", function (v) { S.C.qsize = Number(v); });
      S.ctl.live = api.control.toggle("live", "Live chat ahead of the summary job (queue only)", true, function (on) {
        S.C.liveFirst = !!on;
        manual("Live chat first " + (on ? "on." : "off."));
      });
      S.ctl.job = api.control.toggle("job", "Summary job running (from 02:00)", false, function (on) {
        S.C.job = !!on;
        manual("Summary job " + (on ? "on." : "off."));
      });
      S.ctl.plan = api.control.select("plan", "Play a night or a reply (runs 3 minutes)", PLANS, "none", function (v) {
        var o = pick(PLANS, v);
        if (!o || o.value === "none") return;
        var C = defaults();
        C.plan = String(o.value);
        if (C.plan === "last") C.cap = 800;
        if (C.plan === "quiet") C.rate = 20;
        if (C.plan === "r0") { C.cap = 700; C.queue = true; }
        if (C.plan === "r1") C.limit = 2000000;
        if (C.plan === "r2") C.retry = "now";
        if (C.plan === "r3") C.keys = 5;
        S.C = C;
        S.ctl.rate.set(String(C.rate)); S.ctl.cap.set(String(C.cap)); S.ctl.rule.set(C.rule); S.ctl.limit.set(String(C.limit));
        S.ctl.keys.set(String(C.keys)); S.ctl.retry.set(C.retry); S.ctl.queue.set(C.queue); S.ctl.qsize.set(String(C.qsize));
        S.ctl.live.set(C.liveFirst); S.ctl.job.set(C.job);
        restart(api, "Plan: " + o.label + ".");
        var out = planOutcome(C);
        if (out) api.log(out, "");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        clock: api.stat("clock", "minute", ""),
        sent: api.stat("sent", "requests sent to the provider", ""),
        answered: api.stat("answered", "questions answered", "ok"),
        refused: api.stat("refused", "requests refused (busy)", "bad"),
        gaveup: api.stat("gaveup", "students who gave up or were turned away", "bad"),
        counted: api.stat("counted", "tokens counted against the limit", "warn"),
        used: api.stat("used", "tokens really used (billed)", ""),
        share: api.stat("share", "billed as a share of counted", ""),
        queue: api.stat("queue", "students waiting in the queue", "warn"),
        wait: api.stat("wait", "last student's wait", ""),
        job: api.stat("job", "summary job requests done this minute", ""),
        behind: api.stat("behind", "summary job requests behind", "")
      };

      api.info("<strong>How to read it.</strong> Each run is one minute. Counted is what the provider set against the token limit when each request started; billed is what the model really read and wrote. The table lists every minute run. With the queue on, nobody is refused by the provider: students wait, and the last one's place is the queue's length.");

      draw(api);
      setStats(api);
      api.log("20:59. Results go online at 21:00. Answer cap 8,000 since Tuesday; token limit 600,000 a minute; about 240 new questions a minute expected. Nothing run yet.", "");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }

      // 1. The opening state: 20:59, nothing run.
      t.expect(t.stat("clock") === "20:59" && t.stat("answered") === "-" &&
        t.logText().indexOf("20:59. Results go online at 21:00. Answer cap 8,000 since Tuesday; token limit 600,000 a minute; about 240 new questions a minute expected. Nothing run yet.") >= 0,
        "Opens at 20:59, before the first minute, with nothing run");

      // 2. Tonight's first minute: 75 let in, 165 refused, 600,000 counted, 116,250 billed.
      begin();
      t.click("minute");
      t.expect(t.stat("clock") === "21:00" && t.stat("sent") === 240 && t.stat("answered") === 75 && t.stat("refused") === 165 &&
        t.stat("counted") === "600,000" && t.stat("used") === "116,250" && t.stat("share") === "19%" &&
        has("21:00. Sent 240, answered 75, refused 165, gave up 0. Counted 600,000 of 600,000; billed 116,250 (19%)."),
        "21:00: 75 answered, 165 refused, 600,000 counted, 116,250 billed");

      // 3. Retries pile up: 405 sent at 21:01, 480 from 21:02.
      begin();
      t.click("minute");
      var m1 = has("21:01. Sent 405, answered 75, refused 330, gave up 90.");
      t.click("minute");
      t.expect(m1 && t.stat("clock") === "21:02" && t.stat("sent") === 480 && t.stat("refused") === 405 && t.stat("gaveup") === 165 &&
        t.stat("answered") === 75,
        "Students' retries: 405 sent at 21:01, 480 at 21:02, still 75 answered");

      // 3b. Tonight at 02:00: the summary job goes first and the chat gets 25 a minute.
      t.set("job", true);
      t.expect(t.stat("clock") === "02:02" && t.stat("answered") === 25 && t.stat("job") === "200 of 200" &&
        t.stat("counted") === "600,000" && t.stat("used") === "488,750" && t.stat("refused") === 455,
        "Tonight at 02:00: the job takes 400,000 first, 25 students answered a minute");
      t.set("job", false);

      // 4. Last results night: cap 800, each counted 1,200, 288,000.
      t.set("plan", "last");
      t.expect(t.stat("counted") === "288,000" && t.stat("answered") === 240 && t.stat("refused") === 0 && t.stat("used") === "372,000",
        "Last results night: 240 x 1,200 = 288,000 counted, all answered");

      // 5. A quiet night since Tuesday: 20 x 8,000 = 160,000.
      t.set("plan", "quiet");
      t.expect(t.stat("counted") === "160,000" && t.stat("answered") === 20 && t.stat("refused") === 0,
        "Quiet night since Tuesday: 160,000 counted, all 20 answered");

      // 6. The ok reply: cap 700, queue; live chat ahead of the job at 02:00.
      begin();
      t.set("plan", "r0");
      var r0 = t.stat("counted") === "288,000" && t.stat("answered") === 240 && t.stat("queue") === 0 && t.stat("wait") === "none";
      t.expect(r0 && has("At 02:00 with the summary job, live first: all 240 answered, the job 156 of 200. With the job first instead, 222 students wait by 02:02."),
        "Cap 700: all 240 counted at 1,200 (288,000); at 02:00 the job gets 156 a minute behind the chat");

      // 7. The job without live-first priority: students wait.
      t.set("job", true);
      t.set("live", false);
      t.expect(t.stat("clock") === "02:02" && t.stat("answered") === 166 && t.stat("queue") === 222 && t.stat("wait") === "2 min" &&
        t.stat("job") === "200 of 200",
        "Job first: 166 students a minute, 222 waiting by 02:02, the last waits 2 minutes");

      // 8. A rush of 600 a minute through the queue at cap 700: 500 sent, the rest told their place.
      t.set("live", true);
      t.set("job", false);
      t.set("rate", "600");
      t.expect(t.stat("answered") === 500 && t.stat("queue") === 300 && t.stat("wait") === "1 min" && t.stat("refused") === 0,
        "600 a minute: 500 fit at 1,200 each; 300 waiting by 21:02, nobody refused");

      // 9. A higher limit: 240 fit at 8,000, four fifths of the count unused; the job still crowds them at 02:00.
      begin();
      t.set("plan", "r1");
      t.expect(t.stat("counted") === "1,920,000" && t.stat("used") === "372,000" && t.stat("share") === "19%" &&
        has("At 02:00 the job takes 400,000 first: 200 answered, 40 refused."),
        "Limit 2,000,000: 1,920,000 counted, 372,000 billed; 40 refused at 02:00");

      // 10. Retry at once, and five keys: neither answers more.
      t.set("plan", "r2");
      var r2 = t.stat("answered") === 75 && t.stat("refused") === 660 && t.stat("sent") === 735 && t.stat("gaveup") === 165;
      t.set("plan", "r3");
      t.expect(r2 && t.stat("answered") === 75 && t.stat("counted") === "600,000",
        "Retry at once: 660 refused a minute, still 75 answered; five keys: still 75");

      // 11. The contrast rule: counting only tokens really used, 240 fit at cap 8,000.
      t.set("plan", "none");
      t.set("keys", "1");
      t.set("rule", "used");
      t.expect(t.stat("counted") === "372,000" && t.stat("answered") === 240 && t.stat("refused") === 0,
        "Counting only tokens really used: 240 x 1,550 = 372,000, all answered even at cap 8,000");
    }
  });
})();
