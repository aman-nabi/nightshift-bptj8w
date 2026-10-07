/* engine/ui-v1.2.3.js
   Dead Letter UI (DL.ui): the shell, router wiring and every view. Published as engine/ui.js.
   Contract: docs/dead-letter-engine-contract-v1.1.0.md, sections 6 and 9.9. Needs engine/core-v1.2.0.js (the merged
   catalog, state v2, DL.builds, DL.credits, decision cards; DL.sync, DL.prompts and the #interview/<id> route from
   v1.1). Styles: index-v1.1.0.html. Publishing: docs/dead-letter-conventions-v1.1.0.md section 3.
   CHANGELOG
   v1.2.3 (2026-10-07) the first-shift card's date hint matches the default plan: "About 4 months out fits both courses in
        parallel at the default nights." (it said 3 months, from before plan B).
   v1.2.2 (2026-10-07) cold-case and decision-card replies come from the case's own course guide (the course
        registry's `guide`: u/grey_pager for Dead Letter, u/gradient_ghost for LATENT), found by guideOf(course id).
   v1.2.1 (2026-10-07) the first-shift card and the pace line default to a finish date about 4 months out (plan B: both courses in parallel).
   v1.2.0 (2026-10-07) two courses on one forum (Dead Letter and LATENT) plus Build Nights, contract section 9.9:
     1. Board switcher in the masthead: All, Dead Letter (/n/nightshift), LATENT (/n/latent), from catalog.courses.
        It filters the Seasons and Evidence views and is remembered in localStorage ("dl.board", every access in
        try/catch). Tonight always shows both courses. Hidden when the catalog has one course (no courses.json).
     2. Course look. The view root (#view) gets class course-lt on LATENT case pages, interview pages and LATENT
        Build Nights (X1 to X7), so the accent turns cyan; Dead Letter keeps amber. The LATENT case player is the
        same case player: only the masthead (the forum header) changes, to /n/latent and the course tagline from
        catalog.courses. Every session card on Tonight and Seasons carries a small course chip.
     3. Tonight. Sessions come from DL.pace.plan with remaining = the orderedSessions items that are open (written
        cases, open interviews, unlocked builds), weekendOnly passed through. An interview opens once the cases
        before it in its own course and season are closed. Build Night cards show the project, milestone, minutes
        and an "Open Build Night" button (#build/<id>); locked builds never appear. Closing a case then calls
        DL.credits.applyToStore(). The orderedSessions cache is dropped on every "progress" event, since build
        locks and settings.schedule change it.
     4. Build Night view #build/<id>: project title and pitch, milestone title and minutes, the unlock status (the
        cases still needed, linked), the spec (DL.util.md per paragraph, lines starting "- " as a bullet list),
        the prompt pack in a read-only block with Copy prompt pack (clipboard inside the click, falling back to
        selecting the text), the done-when checklist (ticks saved in localStorage only, try/catch), repo and tag
        instructions with the git commands as text, Verify on GitHub (DL.builds.checkTag only on press, never on
        load, disabled while it runs, the result in plain words), a decision note (the milestone's decisionPrompt
        as placeholder), Mark done (enabled once verified) and "I built it, mark as self-reported" (both through
        DL.builds.markDone), the share hint when share is true, and after done the date, verified or
        self-reported, and the note. A first mark done counts as one of the night's sessions, like a closed case.
     5. Seasons: grouped by course (Dead Letter seasons, then LATENT seasons, each season keyed by course and
        number), each with its cases and finale interviews as before. Below them, Projects: Gatekeeper, Loadout
        and Nightwatch with each milestone's state (locked, ready, done verified or done self-reported). Cases with
        creditedFrom show "Credited from LATENT" (also on the case page).
     6. Cold cases: decision cards (build:<id>) render as "<course guide> asks about your build:" plus the prompt.
        After an answer, your own note is shown as the model answer, then the self-grade buttons (no key-idea
        check and no Claude code for these). The Evidence board keys its columns by course and season.
     7. Settings: a schedule select (both courses in parallel, Dead Letter only, LATENT only) and a GitHub
        username field (default aman-nabi), both through DL.store.update. Everything from v1.1 stays; sync and
        delete messages mention Build Nights.
     8. Router: #build/<id>. Core's router doesn't know it, so this file sets the hash and renders the view itself,
        and a hash naming a route only this file knows wins over DL.router.current(). Case routes work for both
        s... and a... ids. Since caseMeta(id) now finds interviews and builds too, an interview or build id under
        #case/ is sent to its own view by the catalog list it is in.
   v1.1.0 (2026-10-06) the static GitHub Pages build (no window.claude, local storage, offline grading):
     A. Sync. Boot runs DL.sync.consumeHash() right after DL.store.init() (before the router reads the hash)
        and shows a one-line note above the view saying what merged, or why the link failed. Settings has a
        "Move my progress to another device" card: Copy sync link (clipboard inside the click, falling back
        to a selected read-only field), "Open this link on your other device. It merges; nothing is lost.",
        and a paste field with a Merge button (DL.sync.apply) that shows the readable sync errors. A merge
        that changes anything re-renders Settings so the form shows the merged values. The JSON export stays.
        A "#sync=" link opened while the page is already open is merged too.
     B. Deeper grading. Free-text answers in Pin it and Cold cases get, after the offline result, a "Get a
        deeper grade from Claude" button (copies DL.prompts.grade) with "Paste into the Claude app or
        claude.ai on any account.", and a "Paste Claude's result code" field. A grade code for this case
        applies that grade: cold cases through onGrade (DL.sched.grade from the card as it was, so it can
        replace an earlier self-grade), Pin it by setting the self-grade (easy counts as Got it there).
     C. Interviews. Finale interviews are sessions: Seasons lists and links them, Tonight shows them when
        due by syllabus order, and closing a season's last case links to its finale. New view
        #interview/<id>: title and level (the season's rank), three steps, "Open the interview room in
        Claude" (fetches content/interview-room.html once, fills {{INTERVIEW_ID}}, {{INTERVIEW_TITLE}},
        {{LEVEL}}, {{SEASON}} in one pass, title and level HTML-escaped, and copies the publish request with
        the HTML), "Copy a text-only interview" (DL.prompts.interview), a result-code field that stores
        { score, max, d } (plus a short "tries" history) in state.interviews[id] and marks the session done
        (cases[id].done and the night's session count, like closing a case), past attempts, and a dim line
        about /interview <id> in Claude Code. The room file is prefetched when the view opens so the copy
        happens inside the click.
     D. Storage line. Away from the cloud store: "Progress saves in this browser. To carry it to another
        device: Settings, Move my progress." (memory mode says storage is blocked instead, since nothing saves).
     E. Review fixes. (1) A wipe() that resolves false says "Deleted on this device. Your account copy
        couldn't be removed yet." with a Retry button. (2) viaAi is set only when the result's source is
        "ai". (3) The AI notice sits above "Check my answer" before the first answer is sent, shown while
        aiNoticeSeen is false and DL.ai.available() is true (the setting is on and Claude grading exists
        here; on the static site nothing is sent, so the notice stays hidden); aiNoticeSeen is set after the
        first AI-graded result. (4) MCQ options are shuffled once per render (seeded by the render and the
        prompt); letters, marks and the right answer follow the shuffled positions. (5) DL.pace.plan gets
        only ready cases plus open interviews as `remaining`. An interview is open when every case or
        low-level design session before it in its season (in the plan's syllabus order) is closed, and
        there is at least one. Tonight says "caught up" instead of "every session closed" while unwritten
        sessions remain. Seasons still lists planned items as "being written". Evidence board skips
        interview ids.
   v1.0.0 (2026-10-04) first version: boot with loading and error states, masthead and sticky nav with the
     cold-case count, Tonight (first-shift card, pace line, due cold cases, new sessions, storage line),
     case player (post, comments, reply box, lazy sim, explanation, words, spot it at work, pin it, own
     words, close the case), cold cases, seasons, rulebook, evidence board, notes and settings.
     Test hooks: DL.ui.render(route) returns a Promise, DL.ui.diagrams holds the current view's diagram handles. */
(function (root) {
  "use strict";
  var DL = root.DL || (root.DL = {});
  var doc = root.document;
  var SVGNS = "http://www.w3.org/2000/svg";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
  var GRADE_LABELS = { missed: "Missed", partly: "Partly", good: "Got it", easy: "Easy" };
  var AI_NOTICE = "Your free-text answers are sent to Claude for grading. Turn this off to self-grade.";
  var NAV = [
    ["tonight", "Tonight"], ["reviews", "Cold cases"], ["seasons", "Seasons"], ["rules", "Rulebook"],
    ["board", "Evidence"], ["notes", "Notes"], ["settings", "Settings"]
  ];
  var ROUTES = { tonight: 1, "case": 1, interview: 1, build: 1, reviews: 1, rules: 1, board: 1, seasons: 1, notes: 1, settings: 1 };
  var ARG_ROUTES = { "case": 1, interview: 1, build: 1 };
  /* Routes core's router knows, used when DL.router.ROUTES is missing. Anything else (build) is routed here. */
  var CORE_ROUTES = ["tonight", "case", "interview", "reviews", "rules", "board", "seasons", "notes", "settings"];
  var DL_TAGLINE = "Stories from people who work while you sleep.";
  var BOARD_KEY = "dl.board";
  var CHECKS_KEY = "dl.build.checks.";
  var DEFAULT_OWNER = "aman-nabi";
  var GH_OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
  var SCHEDULES = [
    ["parallel", "Both courses in parallel"], ["dl-only", "Dead Letter only"], ["lt-only", "LATENT only"]
  ];
  var SHARE_HINT = "Worth posting about: a chart or GIF plus one honest line about what broke";
  var VERIFY_LABELS = {
    checking: "Checking", found: "Verified", missing: "Tag not found yet", "no-repo": "Repo not found",
    "rate-limited": "GitHub is busy", error: "Couldn't check"
  };
  var ROOM_PATH = "content/interview-room.html";
  var ROOM_ASK = "Please publish the HTML below as an interactive artifact exactly as written. Do not redesign, shorten or explain it; just create the artifact.\n\n```html\n";
  var ROOM_COPIED = "Copied. Paste it into claude.ai or the Claude app (any account). Claude will open the 3 AM Interview room.";
  var CLAUDE_HINT = "Paste into the Claude app or claude.ai on any account.";
  var SELECT_HINT = "Selected. Press Ctrl+C (or Cmd+C) to copy.";
  var PIN_REPLY = {
    missed: "That's fine. This is exactly what the cold cases are for.",
    partly: "Halfway there. The cold case will check it again.",
    good: "Nice. It still comes back later, so it sticks.",
    easy: "Nice. It still comes back later, so it sticks."
  };

  var S = {
    booted: false, shellReady: false, wired: false, bootPromise: null, catalog: null,
    route: null, routeKey: "", view: null, lastRender: null, progressTimer: 0, flash: null, uid: 0, sess: {},
    notice: null, room: "", roomP: null, renderSeed: 1,
    board: "all", verified: {}
  };

  var ui = DL.ui = DL.ui || {};
  ui.version = "1.2.0";
  ui.diagrams = [];

  /* ======================================================================
     DOM helpers. Content strings only ever reach the page through textContent
     ("text") or DL.util.md ("md"); there is no raw-HTML path for content.
     ====================================================================== */
  function escapeHtml(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function mdHtml(text) {
    var t = text === null || text === undefined ? "" : String(text);
    if (DL.util && typeof DL.util.md === "function") return DL.util.md(t);
    return escapeHtml(t);
  }
  function applyProps(node, props) {
    if (!props) return;
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") node.setAttribute("class", String(v));
      else if (k === "text") node.textContent = String(v);
      else if (k === "md") node.innerHTML = mdHtml(v);
      else if (k === "on") Object.keys(v).forEach(function (ev) { node.addEventListener(ev, v[ev]); });
      else if (v === true) node.setAttribute(k, "");
      else node.setAttribute(k, String(v));
    });
  }
  function append(node, kids) {
    if (kids === null || kids === undefined || kids === false) return;
    if (Array.isArray(kids)) { kids.forEach(function (c) { append(node, c); }); return; }
    if (typeof kids === "string" || typeof kids === "number") { node.appendChild(doc.createTextNode(String(kids))); return; }
    node.appendChild(kids);
  }
  function h(tag, props, kids) {
    var node = doc.createElement(tag);
    applyProps(node, props);
    append(node, kids);
    return node;
  }
  function s(tag, attrs, kids) {
    var node = doc.createElementNS(SVGNS, tag);
    applyProps(node, attrs);
    append(node, kids);
    return node;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function setText(id, value) { var n = doc.getElementById(id); if (n) n.textContent = value; }
  function paras(text, cls) {
    if (text === null || text === undefined || text === "") return [];
    return String(text).split(/\n\s*\n/).filter(function (p) { return p.trim() !== ""; })
      .map(function (p) { return h("p", { class: cls, md: p.trim() }); });
  }
  function nextId(prefix) { S.uid += 1; return "dl-" + (prefix || "id") + "-" + S.uid; }
  function errMsg(e) { return e && e.message ? String(e.message) : String(e || "Unknown error"); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  function capFirst(t) { t = String(t || ""); return t.charAt(0).toUpperCase() + t.slice(1); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function fmtNum(n) { try { return Number(n).toLocaleString("en-US"); } catch (e) { return String(n); } }
  function isIso(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")); }
  function removeNode(n) { if (n && n.parentNode) n.parentNode.removeChild(n); }
  function joinList(parts) {
    if (parts.length < 2) return parts.join("");
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  }
  function sameId(a, b) { return String(a || "").toLowerCase() === String(b || "").toLowerCase(); }

  /* A stable shuffle for one render: seeded by the render (S.renderSeed, new on every renderRoute) and a
     text such as the prompt, so the order never changes while the view is on screen. */
  function hashStr(t) {
    var x = 2166136261;
    t = String(t || "");
    for (var i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
    return x >>> 0;
  }
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffledOrder(n, text) {
    var order = [];
    for (var i = 0; i < n; i++) order.push(i);
    var rand = seeded((hashStr(text) ^ S.renderSeed) >>> 0);
    for (var j = n - 1; j > 0; j--) {
      var k = Math.floor(rand() * (j + 1));
      var tmp = order[j]; order[j] = order[k]; order[k] = tmp;
    }
    return order;
  }

  /* Copies text inside the click that called it. If the clipboard is missing or refuses, the text goes into
     `field` (a read-only textarea), which is shown and selected so the learner can copy it by hand.
     o: { field, status, ok, btn, hideField }. hideField hides the field again after a successful copy. */
  function copyText(text, o) {
    o = o || {};
    var field = o.field, status = o.status, btn = o.btn;
    function say(t, tone) {
      if (!status) return;
      status.textContent = t;
      status.classList.remove("ok", "bad");
      if (tone) status.classList.add(tone);
    }
    function selectIt() {
      if (btn) btn.removeAttribute("data-copied");
      if (!field) { say("Copying isn't allowed in this browser.", "bad"); return; }
      field.value = text;
      field.hidden = false;
      try { field.focus(); field.select(); field.setSelectionRange(0, text.length); } catch (e) { /* best effort */ }
      say(SELECT_HINT, "");
    }
    function copied() {
      if (field && o.hideField) field.hidden = true;
      if (btn) btn.setAttribute("data-copied", "true");
      say(o.ok || "Copied.", "ok");
    }
    var clip = root.navigator && root.navigator.clipboard;
    if (clip && typeof clip.writeText === "function") {
      try { Promise.resolve(clip.writeText(text)).then(copied, selectIt); } catch (e) { selectIt(); }
    } else {
      selectIt();
    }
  }
  function copyField(label) {
    return h("textarea", { class: "copy-field", rows: "4", readonly: true, spellcheck: "false", hidden: true, "aria-label": label });
  }
  /* Selects the text inside `node` (a read-only block), for a copy by hand. False when the browser can't. */
  function selectNodeText(node) {
    try {
      var sel = root.getSelection ? root.getSelection() : null;
      if (!sel || !doc.createRange) return false;
      try { node.focus({ preventScroll: true }); } catch (e) { /* not focusable: selecting still works */ }
      var range = doc.createRange();
      range.selectNodeContents(node);
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch (e2) {
      return false;
    }
  }
  function sayTo(el, t, tone) {
    if (!el) return;
    el.textContent = t;
    el.classList.remove("ok", "bad");
    if (tone) el.classList.add(tone);
  }

  /* Browser storage for per-viewer conveniences only (the board filter, Build Night ticks). Every access is
     wrapped: storage can be blocked, full, or throw on the getter itself. */
  function lsGet(key) {
    try {
      var ls = root.localStorage;
      return ls && typeof ls.getItem === "function" ? ls.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }
  function lsSet(key, value) {
    try {
      var ls = root.localStorage;
      if (ls && typeof ls.setItem === "function") ls.setItem(key, value);
    } catch (e) { /* not saved: it only lasts this visit */ }
  }

  function head(eyebrow, title, lede, level) {
    return h("header", { class: "sec-head" }, [
      eyebrow ? h("p", { class: "eyebrow", text: eyebrow }) : null,
      h(level || "h1", { text: title }),
      lede ? h("p", { class: "lede", text: lede }) : null
    ]);
  }
  function field(label, input, help) {
    return h("div", { class: "field" }, [
      h("label", { class: "field-k", for: input.id, text: label }),
      input,
      help ? h("p", { class: "field-help", text: help }) : null
    ]);
  }
  function radio(name, value, checked, label, help) {
    var id = name + "-" + value;
    return [
      h("input", { type: "radio", name: name, id: id, value: value, checked: !!checked }),
      h("label", { for: id }, [h("span", { text: label }), help ? h("small", { text: help }) : null])
    ];
  }
  function numberInput(id, value) {
    return h("input", { type: "number", id: id, min: "10", max: "240", step: "5", inputmode: "numeric", value: String(value) });
  }
  function minutesValue(v) {
    var n = Math.round(Number(v));
    if (!isFinite(n) || String(v).trim() === "" || n < 10 || n > 240) return null;
    return n;
  }

  /* ======================================================================
     Dates (local "YYYY-MM-DD" strings; math comes from DL.util)
     ====================================================================== */
  function today() { return DL.util.today(); }
  function addDays(iso, n) { return DL.util.addDays(iso, n); }
  function fmtDate(iso, withYear) {
    if (!isIso(iso)) return String(iso || "");
    var p = iso.split("-");
    var showYear = withYear || p[0] !== today().slice(0, 4);
    return Number(p[2]) + " " + MONTHS[Number(p[1]) - 1] + (showYear ? " " + p[0] : "");
  }
  function weekdayOf(iso) {
    if (!isIso(iso)) return "";
    var p = iso.split("-").map(Number);
    return DAYS[new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).getUTCDay()];
  }
  function laterText(n) {
    if (n < 1) return "today";
    if (n < 14) return plural(n, "day") + " later";
    if (n < 60) return plural(Math.round(n / 7), "week") + " later";
    return plural(Math.round(n / 30), "month") + " later";
  }

  /* ======================================================================
     State and catalog lookups
     ====================================================================== */
  function state() { return (DL.store && DL.store.get && DL.store.get()) || {}; }
  function settings() { return state().settings || {}; }
  function planOf() { return settings().plan === "all" ? "all" : "core"; }
  function catalog() { return S.catalog || (DL.content && DL.content.catalog) || {}; }
  function caseRec(id) { return (state().cases || {})[id] || {}; }
  function buildRec(id) { return (state().builds || {})[id] || {}; }
  /* A session is done when its case record has a date (cases, interviews, credited cases) or, for a Build
     Night, when state.builds has a date. Build ids (G1, X3) never collide with case ids. */
  function isDone(id) { return !!caseRec(id).done || !!buildRec(id).done; }
  function isCredited(id) {
    var r = caseRec(id);
    return !!r.done && Array.isArray(r.creditedFrom) && r.creditedFrom.length > 0;
  }
  function cardFor(id) { return (state().cards || {})[id] || null; }
  function isFading(id) {
    var c = cardFor(id);
    if (!c) return false;
    try { return DL.sched.overdueDays(c, today()) >= 3; } catch (e) { return false; }
  }
  function dayRec(d, t) {
    d.daily = d.daily || {};
    return d.daily[t] || (d.daily[t] = { sessions: 0, reviews: 0 });
  }
  function findIn(list, id) {
    list = list || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }
  function metaFor(id) {
    if (!id) return null;
    var m = null;
    try { m = DL.content.caseMeta ? DL.content.caseMeta(id) : null; } catch (e) { m = null; }
    if (m) return m;
    var cat = catalog();
    return findIn(cat.cases, id) || findIn(cat.lld, id) || findIn(cat.interviews, id) || findIn(cat.builds, id);
  }

  /* Courses (contract 9.1). Without content/courses.json the catalog has no `courses`: one course, Dead Letter. */
  function courseList() {
    var list = Array.isArray(catalog().courses) ? catalog().courses.filter(function (c) { return c && c.id; }) : [];
    if (list.length) return list;
    var forum = catalog().forum || {};
    return [{ id: "dl", title: "Dead Letter", board: forum.board || "/n/nightshift", prefix: "s", tagline: DL_TAGLINE }];
  }
  function courseInfo(id) { return findIn(courseList(), id); }
  function multiCourse() { return courseList().length > 1; }
  function courseOf(x) { return x && typeof x.course === "string" && x.course ? x.course : "dl"; }
  /* The course's guide in replies and cold cases: the registry's `guide`, else the built-in one. */
  function guideOf(id) {
    var c = courseInfo(id);
    if (c && typeof c.guide === "string" && c.guide) return c.guide;
    return id === "lt" ? "u/gradient_ghost" : "u/grey_pager";
  }
  function courseTitle(id) {
    var c = courseInfo(id);
    return (c && c.title) || (id === "lt" ? "LATENT" : "Dead Letter");
  }
  function courseRank(id) {
    var list = courseList();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return list.length;
  }
  function courseChip(id) {
    return h("span", { class: "chip chip-course", "data-course": id === "lt" ? "lt" : "dl", text: courseTitle(id) });
  }
  /* The board switcher's filter: "all" or a course id. Seasons and Evidence use it; Tonight never does. */
  function boardShows(course) { return S.board === "all" || !multiCourse() || course === S.board; }

  /* Build Nights (contract 9.6). Milestones come from the merged catalog with project, projectTitle, repo,
     course and minutes attached. */
  function buildMeta(id) {
    if (!id) return null;
    try {
      if (DL.builds && typeof DL.builds.get === "function") {
        var m = DL.builds.get(id);
        if (m) return m;
      }
    } catch (e) { /* fall back to the catalog list */ }
    return findIn(catalog().builds, id);
  }
  function projectOf(m) {
    var list = catalog().projects || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].project === m.project) return list[i];
    return { project: m.project || "", title: m.projectTitle || m.project || "", repo: m.repo || m.project || "", language: "", pitch: "" };
  }
  function buildUnlocked(id) {
    try { return !!(DL.builds && DL.builds.isUnlocked(id)); } catch (e) { return false; }
  }
  function githubOwner() { return String(settings().githubOwner == null ? DEFAULT_OWNER : settings().githubOwner).trim(); }

  /* orderedSessions results, cached until the next "progress" event (build locks follow state.cases, and the
     list follows settings.schedule). */
  function sessionsFor(plan) {
    if (!S.sess[plan]) {
      var list = [];
      try { list = DL.content.orderedSessions(plan) || []; } catch (e) { list = []; }
      S.sess[plan] = list;
    }
    return S.sess[plan];
  }
  /* One course's sessions in plan order, whatever the schedule setting says. */
  function courseSessions(plan, course) {
    var key = plan + "|" + course;
    if (!S.sess[key]) {
      var list = [];
      try { list = DL.content.orderedSessions(plan, course + "-only") || []; } catch (e) { list = []; }
      S.sess[key] = list.filter(function (it) { return courseOf(it) === course; });
    }
    return S.sess[key];
  }
  function indexOfId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }
  function sessionInfo(it) {
    var m = metaFor(it.id) || {};
    var o = findIn(sessionsFor("all"), it.id) || {};
    var kind = it.kind || o.kind || "case";
    var isBuild = kind === "build";
    return {
      id: it.id,
      kind: kind,
      course: it.course || o.course || courseOf(m),
      title: m.title || o.title || it.title || it.id,
      setting: m.setting || "",
      season: m.season || o.season || it.season || null,
      n: m.n || null,
      minutes: it.minutes || o.minutes || m.minutes || null,
      // milestones carry no `core` or `status` in the catalog: every build is core, ready once unlocked
      core: isBuild ? true : !!m.core,
      status: isBuild ? (it.status || o.status || (buildUnlocked(it.id) ? "ready" : "locked")) : (m.status || o.status || it.status || "planned"),
      project: isBuild ? (m.projectTitle || m.project || "") : ""
    };
  }
  function interviewMeta(id) { return findIn(catalog().interviews, id); }
  function interviewRec(id) { return (state().interviews || {})[id] || null; }
  /* Season numbers repeat across courses (Dead Letter S1 and LATENT S1), so a season is found by both. */
  function seasonMeta(n, course) {
    var list = catalog().seasons || [], c = course || "dl";
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].n === n && courseOf(list[i]) === c) return list[i];
    return null;
  }
  /* Interviews need no written case file (the room is generic), so they can always be opened. Builds are
     playable once unlocked (status "ready"). */
  function playable(info) { return info.kind === "interview" || info.status === "ready"; }
  function routeFor(info) {
    if (info.kind === "build") return "build/" + info.id;
    return (info.kind === "interview" ? "interview/" : "case/") + info.id;
  }
  /* An interview is due by syllabus order once every case and low-level design session before it in its own
     course and season is closed (in the plan's order; the full list for a bonus interview), and there is at
     least one. Unwritten cases can't be closed, so a finale never jumps ahead of its season. */
  function interviewOpen(it) {
    var course = courseOf(it);
    var list = courseSessions(planOf(), course);
    var idx = indexOfId(list, it.id);
    if (idx < 0) { list = courseSessions("all", course); idx = indexOfId(list, it.id); }
    if (idx < 0) return false;
    var season = list[idx].season, before = 0;
    for (var i = 0; i < idx; i++) {
      var x = list[i];
      if (x.kind === "interview" || x.kind === "build" || x.season !== season || courseOf(x) !== course) continue;
      before += 1;
      if (!isDone(x.id)) return false;
    }
    return before > 0;
  }
  /* What DL.pace.plan may schedule: written cases, open interviews and unlocked builds. */
  function plannable(it) { return it.kind === "interview" ? interviewOpen(it) : it.status === "ready"; }
  /* Decision cards (contract 9.7) have ids "build:<milestone id>". */
  function isDecisionId(id) { return String(id || "").indexOf("build:") === 0; }
  function cardKnown(id) { return isDecisionId(id) ? !!buildMeta(id.slice(6)) : !!metaFor(id); }
  function reviewKindOf(card) {
    try {
      if (DL.sched && typeof DL.sched.reviewKind === "function") return DL.sched.reviewKind(card);
    } catch (e) { /* fall through */ }
    return (card.step || 0) >= 3 ? "cold" : "recall";
  }
  function dueList() {
    var t = today(), cards = state().cards || {};
    return Object.keys(cards).filter(function (id) {
      try { return cards[id] && DL.sched.isDue(cards[id], t) && cardKnown(id); } catch (e) { return false; }
    }).sort(function (a, b) {
      var da = cards[a].due || "", db = cards[b].due || "";
      if (da !== db) return da < db ? -1 : 1;
      return a < b ? -1 : 1;
    }).map(function (id) { return { id: id, kind: reviewKindOf(cards[id]) }; });
  }
  function soonestCard() {
    var t = today(), cards = state().cards || {}, best = null;
    Object.keys(cards).forEach(function (id) {
      var c = cards[id];
      if (!c || !c.due || c.due <= t || !cardKnown(id)) return;
      if (!best || c.due < best.due) best = c;
    });
    return best;
  }
  function storageLead() {
    var m = DL.store && DL.store.mode;
    if (m === "cloud") return "Progress saves to your account.";
    if (m === "local") return "Progress saves in this browser.";
    return "Progress isn't being saved here, because this browser blocks storage.";
  }
  /* Settings wording: the sync card sits above the line there. */
  function storageText() {
    var m = DL.store && DL.store.mode;
    if (m === "cloud") return storageLead();
    return storageLead() + " To carry it to another device, use Move my progress above.";
  }
  /* Tonight wording, with the way to the sync card as a link. */
  function storageLine() {
    var m = DL.store && DL.store.mode;
    if (m === "cloud") return h("p", { class: "storage-line", text: storageLead() });
    return h("p", { class: "storage-line" }, [
      storageLead() + " To carry it to another device: ",
      link("Settings, Move my progress", "settings"),
      "."
    ]);
  }
  function exportText() {
    try { return DL.store.exportJSON(); } catch (e) { return JSON.stringify(state(), null, 2); }
  }
  function saveSettings(fn) {
    return Promise.resolve(DL.store.update(function (d) { fn(d.settings || (d.settings = {})); }));
  }

  /* ======================================================================
     Routing
     ====================================================================== */
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function normRoute(r) {
    if (!r || typeof r !== "object") r = {};
    // own keys only, so a hash such as "#constructor" can't pass as a route
    var name = typeof r.name === "string" && hasOwn(ROUTES, r.name) ? r.name : "tonight";
    var arg = r.arg === undefined || r.arg === null || r.arg === "" ? null : String(r.arg);
    if (hasOwn(ARG_ROUTES, name) && !arg) name = "tonight";
    return { name: name, arg: hasOwn(ARG_ROUTES, name) ? arg : null };
  }
  function parseRoute(str) {
    var t = String(str || "").replace(/^#/, "");
    try { t = decodeURIComponent(t); } catch (e) { /* keep it as written */ }   // a host may encode the slash
    t = t.replace(/^[#\/]+/, "").replace(/\/+$/, "");
    var i = t.indexOf("/");
    return normRoute({ name: i < 0 ? t : t.slice(0, i), arg: i < 0 ? null : t.slice(i + 1) });
  }
  function keyOf(r) { return r.name + (r.arg ? "/" + r.arg : ""); }
  /* A route this file renders but core's router doesn't know (build). Core would turn it into #tonight. */
  function uiOnly(name) {
    var list = DL.router && Array.isArray(DL.router.ROUTES) ? DL.router.ROUTES : CORE_ROUTES;
    return hasOwn(ROUTES, name) && list.indexOf(name) < 0;
  }
  function hashRoute() {
    try { return root.location ? parseRoute(root.location.hash) : null; } catch (e) { return null; }
  }
  function currentRoute() {
    var hr = hashRoute();
    if (hr && uiOnly(hr.name)) return hr;   // #build/<id>: the hash is the only record of it
    var r = null;
    if (!S.routerIgnored) {
      try { if (DL.router && typeof DL.router.current === "function") r = DL.router.current(); } catch (e) { r = null; }
    }
    if (!r) r = parseRoute(root.location ? root.location.hash : "");
    return normRoute(r);
  }
  /* Ask the router to move, then check that it did. If the router ignored the call (for example it expects
     another argument shape), set the hash ourselves and render the route directly. */
  function go(route) {
    var target = parseRoute(route);
    var want = keyOf(target);
    if (uiOnly(target.name)) {
      // Not through DL.router.go: it would rewrite the hash to #tonight. Set the hash and render here.
      try {
        if (root.location && String(root.location.hash || "") !== "#" + want) root.location.hash = want;
      } catch (e) { /* the render below still happens */ }
      if (S.routeKey !== want) renderRoute(target, { focus: true });
      return;
    }
    try {
      if (DL.router && typeof DL.router.go === "function") DL.router.go(route);
    } catch (e) { /* checked below */ }
    setTimeout(function () {
      if (keyOf(currentRoute()) === want) { syncRoute(); return; }
      S.routerIgnored = true;   // from now on the hash is the source of truth
      try { root.location.hash = route; } catch (e2) { /* the render below still happens */ }
      if (S.routeKey !== want) renderRoute(target, { focus: true });
    }, 0);
  }
  function syncRoute() {
    if (!S.booted || !S.shellReady) return;
    var r = currentRoute();
    if (keyOf(r) !== S.routeKey) renderRoute(r, { focus: true });
  }
  function link(label, route, cls) {
    var a = h("a", { class: cls, href: "#" + route }, label);
    a.addEventListener("click", function (e) {
      if (e.defaultPrevented || (e.button !== undefined && e.button !== 0) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (route === S.routeKey) { renderRoute(parseRoute(route), { focus: true }); return; }
      go(route);
    });
    return a;
  }

  /* ======================================================================
     Render pipeline
     ====================================================================== */
  var VIEWS = {
    tonight: viewTonight, "case": viewCase, interview: viewInterview, build: viewBuild, reviews: viewReviews,
    seasons: viewSeasons, rules: viewRules, board: viewBoard, notes: viewNotes, settings: viewSettings
  };

  function runCleanups() {
    var v = S.view;
    if (!v) return;
    v.alive = false;
    v.cleanups.forEach(function (fn) { try { fn(); } catch (e) { /* keep going */ } });
    v.cleanups = [];
  }
  function scrollTop() { try { root.scrollTo(0, 0); } catch (e) { /* not available */ } }
  function focusFirst(container, sel) {
    var target = container && container.querySelector(sel || "h1");
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    try { target.focus({ preventScroll: true }); } catch (e) { try { target.focus(); } catch (e2) { /* ignore */ } }
  }
  function viewError(err) {
    return h("section", { class: "wrap" }, h("div", { class: "error-panel", role: "alert" }, [
      h("p", { class: "eyebrow", text: "Something broke" }),
      h("h1", { text: "This page hit a problem." }),
      h("p", { text: "Try another tab, or reload the page. Your saved progress is untouched." }),
      h("pre", { class: "err-detail", text: errMsg(err) })
    ]));
  }
  function renderRoute(r, opts) {
    opts = opts || {};
    var view = doc.getElementById("view");
    if (!view) return Promise.resolve();
    runCleanups();
    r = normRoute(r);
    S.route = r;
    S.routeKey = keyOf(r);
    S.renderSeed = (Math.floor(Math.random() * 4294967296) >>> 0) || 1;
    if (S.notice) {
      if (S.notice.key === null) S.notice.key = S.routeKey;
      else if (S.notice.key !== S.routeKey) hideNotice();
    }
    ui.diagrams = [];
    clear(view);
    var ctx = { root: view, name: r.name, arg: r.arg, alive: true, cleanups: [], rerender: false, onProgress: null, course: null };
    S.view = ctx;
    // Every render starts in the home look; case, interview and build views call setCourse for their course.
    if (view.classList) view.classList.remove("course-lt");
    setMasthead(null);
    updateNav();
    if (opts.focus) scrollTop();
    var result = null;
    try { result = VIEWS[r.name](ctx); } catch (err) { clear(view); view.appendChild(viewError(err)); result = null; }
    var p = Promise.resolve(result).then(function () {
      if (ctx.alive && opts.focus) focusFirst(view);
    }, function (err) {
      if (ctx.alive) { clear(view); view.appendChild(viewError(err)); }
    });
    S.lastRender = p;
    return p;
  }
  /* Course look (contract 9.9): LATENT pages get .course-lt on the view root (cyan accent) and the masthead shows
     the page's board and tagline. */
  function setCourse(ctx, course) {
    ctx.course = course === "lt" ? "lt" : "dl";
    if (ctx.root && ctx.root.classList) {
      if (ctx.course === "lt") ctx.root.classList.add("course-lt");
      else ctx.root.classList.remove("course-lt");
    }
    setMasthead(ctx.course);
  }
  /* The forum header. A course page shows its course; Seasons and Evidence follow the board switcher; every
     other view shows the home board, as in v1.1. */
  function setMasthead(course) {
    if (!doc || !S.shellReady) return;
    var c = course ? courseInfo(course) : null;
    var name = S.route ? S.route.name : "";
    if (!c && S.board !== "all" && (name === "seasons" || name === "board")) c = courseInfo(S.board);
    var forum = catalog().forum || {};
    var home = courseInfo("dl") || {};
    setText("brand-board", c ? (c.board || "") : (forum.board || home.board || "/n/nightshift"));
    var tag = doc.getElementById("brand-tag") || doc.querySelector(".mast .brand-tag");
    if (tag) tag.textContent = (c && c.tagline) || home.tagline || DL_TAGLINE;
    var mast = doc.querySelector(".mast");
    if (mast) {
      if (c && c.id === "lt") mast.setAttribute("data-course", "lt");
      else mast.removeAttribute("data-course");
    }
  }

  /* Board switcher (contract 9.9): All, then one button per course. Remembered in localStorage. */
  function loadBoard() {
    var v = lsGet(BOARD_KEY);
    S.board = v && v !== "all" && courseInfo(v) && multiCourse() ? v : "all";
  }
  function renderSwitcher() {
    var mast = doc.querySelector(".mast");
    var box = doc.getElementById("board-switch");
    if (!box && mast) {
      box = h("div", { class: "board-switch", id: "board-switch", role: "group", "aria-label": "Board: filters Seasons and Evidence" });
      mast.appendChild(box);
    }
    if (!box) return;
    clear(box);
    if (!multiCourse()) { box.hidden = true; return; }
    var opts = [{ id: "all", title: "All", board: "" }].concat(courseList().map(function (c) {
      return { id: c.id, title: c.title || c.id, board: c.board || "" };
    }));
    opts.forEach(function (o) {
      var b = h("button", { class: "board-btn", type: "button", "data-board": o.id, "aria-pressed": String(S.board === o.id) }, [
        h("span", { class: "board-btn-name", text: o.title }),
        o.board ? h("span", { class: "board-btn-board", text: o.board }) : null
      ]);
      b.addEventListener("click", function () { setBoard(o.id); });
      box.appendChild(b);
    });
    box.hidden = false;
  }
  function setBoard(id) {
    S.board = id !== "all" && courseInfo(id) ? id : "all";
    lsSet(BOARD_KEY, S.board);
    Array.prototype.forEach.call(doc.querySelectorAll("#board-switch .board-btn"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-board") === S.board));
    });
    var name = S.route ? S.route.name : "";
    if (name === "seasons" || name === "board") renderRoute(S.route, {});
  }
  /* One line under a filtered Seasons or Evidence heading, so a hidden course is never a surprise. */
  function filterNote() {
    if (S.board === "all" || !multiCourse()) return null;
    return h("p", { class: "filter-note", text: "Showing " + courseTitle(S.board) + " only. Pick All at the top to see both courses." });
  }

  function onProgress() {
    if (S.progressTimer) return;
    S.progressTimer = setTimeout(function () {
      S.progressTimer = 0;
      updateNav();
      var v = S.view;
      if (!v || !v.alive) return;
      if (typeof v.onProgress === "function") { try { v.onProgress(); } catch (e) { /* view stays as is */ } }
      else if (v.rerender) renderRoute(S.route, {});
    }, 0);
  }

  /* ======================================================================
     Shell: masthead text, sticky nav, cold-case count
     ====================================================================== */
  function renderShell() {
    var forum = catalog().forum || {};
    setText("brand-name", forum.name || "nocturne");
    setText("brand-board", forum.board || "/n/nightshift");
    var nav = doc.getElementById("nav");
    var holder = doc.getElementById("nav-links") || nav;
    if (holder) {
      clear(holder);
      NAV.forEach(function (n) {
        var a = link(n[1], n[0], null);
        a.setAttribute("data-route", n[0]);
        if (n[0] === "reviews") a.appendChild(h("span", { class: "tab-count", "aria-hidden": "true", hidden: true }));
        holder.appendChild(a);
      });
    }
    if (nav) nav.hidden = false;
    S.shellReady = true;
  }
  function updateNav() {
    var holder = doc.getElementById("nav-links");
    if (!holder) return;
    var active = S.route ? S.route.name : "";
    var due = 0;
    try { due = S.shellReady ? dueList().length : 0; } catch (e) { due = 0; }
    Array.prototype.forEach.call(holder.querySelectorAll("a[data-route]"), function (a) {
      var r = a.getAttribute("data-route");
      if (r === active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      if (r === "reviews") {
        var c = a.querySelector(".tab-count");
        if (c) { c.textContent = String(due); c.hidden = due === 0; }
        a.setAttribute("aria-label", due ? "Cold cases, " + due + " due" : "Cold cases");
      }
    });
  }

  /* ======================================================================
     Sync notice: one line above the view (outside #view, so a re-render of
     the view keeps it). It goes when dismissed or on the next other route.
     ====================================================================== */
  function hideNotice() {
    if (S.notice) removeNode(S.notice.el);
    S.notice = null;
  }
  function showNotice(text, tone) {
    hideNotice();
    var view = doc && doc.getElementById("view");
    if (!view || !view.parentNode) return;
    var close = h("button", { class: "btn btn-small btn-ghost", type: "button", text: "Dismiss" });
    var el = h("div", { class: "wrap notice-bar" + (tone ? " " + tone : ""), role: "status", "aria-live": "polite" }, [
      h("p", { text: text }),
      close
    ]);
    close.addEventListener("click", hideNotice);
    view.parentNode.insertBefore(el, view);
    S.notice = { el: el, key: null };   // the next render claims it
  }
  function mergeText(sm) {
    sm = sm || {};
    var parts = [];
    if (sm.cases) parts.push(plural(sm.cases, "case"));
    if (sm.cards) parts.push(plural(sm.cards, "cold case"));
    if (sm.notes) parts.push(plural(sm.notes, "note"));
    if (sm.interviews) parts.push(plural(sm.interviews, "interview result"));
    if (sm.builds) parts.push(plural(sm.builds, "Build Night"));
    if (sm.settings) parts.push("your settings");
    if (!parts.length && sm.daily) parts.push("your nightly history");
    if (!parts.length) return "Nothing new in that sync link. This device already had all of it.";
    return "Merged from your other device: " + joinList(parts) + ". Nothing here was lost.";
  }
  function mergeChanged(sm) {
    sm = sm || {};
    return !!(sm.cases || sm.cards || sm.notes || sm.interviews || sm.builds || sm.daily || sm.settings);
  }
  /* Reads "#sync=<code>" (core clears it from the address first) and says what merged. */
  function runSyncHash() {
    if (!DL.sync || typeof DL.sync.consumeHash !== "function") return false;
    var sm = null;
    try { sm = DL.sync.consumeHash(); } catch (e) {
      showNotice("That sync link couldn't be merged. " + errMsg(e), "bad");
      return true;
    }
    if (!sm) return false;
    showNotice(mergeText(sm), "ok");
    return true;
  }

  /* ======================================================================
     Boot
     ====================================================================== */
  function wireEvents() {
    if (S.wired) return;
    S.wired = true;
    if (DL.events && typeof DL.events.on === "function") {
      DL.events.on("route", function () { syncRoute(); });
      // The cached session lists go at once (not debounced): build locks and the schedule live in the state.
      DL.events.on("progress", function () { S.sess = {}; onProgress(); });
    }
    if (root.addEventListener) {
      root.addEventListener("hashchange", function () {
        var hash = "";
        try { hash = String(root.location.hash || ""); } catch (e) { hash = ""; }
        // A sync link opened in a tab that already runs the app: merge it, then show Tonight.
        if (hash.indexOf("#sync=") === 0 && runSyncHash()) {
          try { if (DL.router && typeof DL.router.go === "function") DL.router.go("tonight"); } catch (e2) { /* the render below still happens */ }
          setTimeout(function () { if (S.routeKey !== "tonight") renderRoute({ name: "tonight" }, { focus: true }); }, 0);
          return;
        }
        setTimeout(syncRoute, 0);
      });
    }
  }
  function startRouter() {
    var r = DL.router;
    try {
      if (r && typeof r.start === "function") r.start();
      else if (r && typeof r.init === "function") r.init();
    } catch (e) { /* the router also works without a start call */ }
  }

  ui.boot = function () {
    if (S.bootPromise) return S.bootPromise;
    S.bootPromise = Promise.resolve().then(function () {
      var missing = ["util", "events", "content", "store", "sched", "pace", "router"].filter(function (k) { return !DL[k]; });
      if (missing.length) throw new Error("The engine core didn't load (missing DL." + missing.join(", DL.") + "). Check engine/core.js.");
      return DL.store.init();
    }).then(function () {
      // Before the router reads the address: a "#sync=" link is merged and cleared here.
      runSyncHash();
      return DL.content.loadCatalog();
    }).then(function (cat) {
      S.catalog = cat || DL.content.catalog || {};
      S.sess = {};
      S.booted = true;
      loadBoard();
      renderShell();
      renderSwitcher();
      wireEvents();
      startRouter();
      var r = currentRoute();
      if (S.lastRender && keyOf(r) === S.routeKey) return S.lastRender;
      return renderRoute(r, {});
    }).then(null, function (err) {
      ui.showError(err);
    });
    return S.bootPromise;
  };

  ui.showError = function (err) {
    var view = doc && doc.getElementById("view");
    if (!view) return;
    runCleanups();
    clear(view);
    view.appendChild(h("section", { class: "wrap" }, h("div", { class: "error-panel", role: "alert" }, [
      h("p", { class: "eyebrow", text: "Couldn't clock in" }),
      h("h1", { text: "The night shift didn't start." }),
      h("p", { text: "Reload the page to try again. Nothing you saved has been changed." }),
      h("pre", { class: "err-detail", text: errMsg(err) })
    ])));
  };

  /* Test hook: render a route ("case/s1e01" or {name, arg}) into #view. Resolves when async content is in. */
  ui.render = function (route) {
    var r = typeof route === "string" ? parseRoute(route) : normRoute(route || currentRoute());
    return renderRoute(r, {});
  };

  /* ======================================================================
     View: Tonight
     ====================================================================== */
  /* Only written cases, open interviews and unlocked builds go to the pace plan (contract 9.5), so sessions
     that are still being written or locked never fill Tonight or make the plan look behind. Build Nights carry
     weekendOnly, so the plan holds them for Saturday and Sunday. `waiting` counts the open sessions left out. */
  function paceNow() {
    var st = state(), set = st.settings || {}, t = today();
    var open = sessionsFor(planOf()).filter(function (it) { return !isDone(it.id); });
    var remaining = open.filter(plannable).map(function (it) {
      return {
        id: it.id, kind: it.kind, minutes: it.minutes, weekendOnly: it.weekendOnly === true,
        course: it.course, status: it.status, title: it.title, season: it.season
      };
    });
    var due = dueList();
    var doneToday = ((st.daily || {})[t] || {}).sessions || 0;
    var out = DL.pace.plan({
      today: t, targetDate: set.targetDate || null,
      weekdayMin: Number(set.weekdayMin) || 30, weekendMin: Number(set.weekendMin) || 60,
      remaining: remaining, due: due, doneToday: doneToday
    }) || {};
    return { out: out, due: due, target: set.targetDate || addDays(t, 120), waiting: open.length - remaining.length, remaining: remaining };
  }
  function paceText(out, target, waiting) {
    var tgt = fmtDate(target);
    switch (out.status) {
      case "done":
        return waiting > 0 ? "You're caught up on everything open so far. The next sessions are being written or unlock as you close cases."
          : "Every session on your plan is closed.";
      case "past-target": return "Your date, " + tgt + ", has passed. Pick a new one whenever you like.";
      case "behind":
        return "Behind: about " + Math.max(1, Math.round(Number(out.extraMinutes) || 0)) + " extra minutes a day" +
          (out.suggestedDate ? ", or move your date to " + fmtDate(out.suggestedDate) : "") + ".";
      case "ahead": return "Ahead of plan for " + tgt + ". Anything more tonight is extra.";
      default: return "On track for " + tgt + ".";
    }
  }
  /* "S1·04" for Dead Letter, "A1·04" for LATENT (the course's case prefix), the milestone id for a build. */
  function sessionKey(info) {
    if (info.kind === "interview") return "3AM";
    if (info.kind === "lld") return "LLD";
    if (info.kind === "build") return String(info.id);
    var c = courseInfo(info.course);
    var prefix = String((c && c.prefix) || "s").toUpperCase();
    return prefix + (info.season || "?") + (info.n ? "·" + pad2(info.n) : "");
  }
  function kindLabel(info) {
    if (info.kind === "interview") return "3 AM interview" + (info.season ? " · Season " + info.season : "");
    if (info.kind === "lld") return "Low-level design";
    if (info.kind === "build") return "Build Night";
    return info.season ? "Season " + info.season : "Case";
  }
  /* A Build Night on Tonight: project, milestone, minutes and a button. The title is plain text (no stretched
     link), so the button is what opens it. */
  function buildCard(info) {
    var ready = info.status === "ready";
    return h("li", { class: "session build " + (ready ? "ready" : "planned") }, [
      h("span", { class: "session-k", "aria-hidden": "true", text: sessionKey(info) }),
      h("div", null, [
        h("p", { class: "session-project", text: "Build Night · " + (info.project || "Project") }),
        h("h3", { class: "session-title", text: info.title }),
        h("div", { class: "chips" }, [
          courseChip(info.course),
          info.minutes ? h("span", { class: "chip", text: info.minutes + " min" }) : null,
          h("span", { class: "chip", text: "weekend" }),
          ready ? null : h("span", { class: "chip", text: "locked" })
        ]),
        ready ? h("div", { class: "btn-row" }, link("Open Build Night", "build/" + info.id, "btn btn-primary")) : null
      ])
    ]);
  }
  function sessionCard(it) {
    var info = sessionInfo(it);
    if (info.kind === "build") return buildCard(info);
    var ready = playable(info);
    var title = h("h3", { class: "session-title" }, ready ? link(info.title, routeFor(info)) : h("span", { text: info.title }));
    return h("li", { class: "session " + (ready ? "ready" : "planned") }, [
      h("span", { class: "session-k", "aria-hidden": "true", text: sessionKey(info) }),
      h("div", null, [
        title,
        info.setting ? h("p", { class: "session-setting", text: info.setting }) : null,
        h("div", { class: "chips" }, [
          courseChip(info.course),
          h("span", { class: "chip", text: kindLabel(info) }),
          info.minutes ? h("span", { class: "chip", text: info.minutes + " min" }) : null,
          h("span", { class: "chip" + (info.core ? " core" : ""), text: info.core ? "core" : "bonus" }),
          ready ? null : h("span", { class: "chip", text: "being written" })
        ])
      ])
    ]);
  }
  function planSummary(plan) {
    var list = sessionsFor(plan);
    var mins = list.reduce(function (a, it) { return a + (Number(it.minutes) || 0); }, 0);
    return (plan === "all" ? "Everything" : "Core") + ": " + plural(list.length, "session") + ", about " +
      plural(Math.max(1, Math.round(mins / 60)), "hour") + " in all, plus a few minutes of cold cases on most nights.";
  }

  function firstShift() {
    var set = settings(), t = today();
    var planName = nextId("plan");
    var target = h("input", { type: "date", id: nextId("target"), value: isIso(set.targetDate) ? set.targetDate : addDays(t, 120), min: addDays(t, 1), required: true });
    var wd = numberInput(nextId("wd"), set.weekdayMin || 30);
    var we = numberInput(nextId("we"), set.weekendMin || 60);
    var summary = h("p", { class: "field-help", "aria-live": "polite", text: planSummary(set.plan === "all" ? "all" : "core") });
    var msg = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    var submit = h("button", { class: "btn btn-primary", type: "submit", text: "Clock in" });
    var planField = h("fieldset", { class: "field" }, [
      h("legend", { class: "field-k", text: "Plan" }),
      h("div", { class: "seg-opts" }, [
        radio(planName, "core", set.plan !== "all", "Core", "What interviews and day-to-day work need"),
        radio(planName, "all", set.plan === "all", "Everything", "Core plus the bonus cases")
      ]),
      summary
    ]);
    planField.addEventListener("change", function (e) {
      summary.textContent = planSummary(e.target && e.target.value === "all" ? "all" : "core");
    });
    var form = h("form", { class: "card-panel", novalidate: true, "aria-labelledby": "fs-h" }, [
      h("header", { class: "sec-head" }, [
        h("p", { class: "eyebrow", text: "Your first shift" }),
        h("h1", { id: "fs-h", text: "Set your pace" }),
        h("p", { class: "lede", text: "Pick a date to finish by and how long a normal night is. If you miss a night, the rest spreads out again on its own. Nothing nags." })
      ]),
      h("div", { class: "fields" }, [
        field("Finish by", target, "About 4 months out fits both courses in parallel at the default nights."),
        field("Weekday nights (minutes)", wd),
        field("Weekend nights (minutes)", we)
      ]),
      planField,
      h("div", { class: "btn-row" }, [submit, msg])
    ]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var picked = form.querySelector("input[name='" + planName + "']:checked");
      var plan = picked && picked.value === "all" ? "all" : "core";
      var tgt = target.value;
      if (!isIso(tgt) || tgt <= t) { msg.textContent = "Pick a finish date after today."; target.focus(); return; }
      var a = minutesValue(wd.value), b = minutesValue(we.value);
      if (a === null) { msg.textContent = "Use minutes between 10 and 240, like 30."; wd.focus(); return; }
      if (b === null) { msg.textContent = "Use minutes between 10 and 240, like 60."; we.focus(); return; }
      submit.disabled = true;
      saveSettings(function (st) {
        st.plan = plan; st.targetDate = tgt; st.weekdayMin = a; st.weekendMin = b; st.startedOn = t;
      }).then(function () {
        if (!form.isConnected || !S.route || S.route.name !== "tonight") return;
        if (S.progressTimer) { clearTimeout(S.progressTimer); S.progressTimer = 0; }
        renderRoute(S.route, { focus: true });
      }, function (err) {
        submit.disabled = false;
        msg.textContent = "Couldn't save: " + errMsg(err);
      });
    });
    return h("section", { class: "wrap section" }, form);
  }

  function viewTonight(ctx) {
    ctx.rerender = true;
    if (!settings().startedOn) { ctx.root.appendChild(firstShift()); return null; }
    var t = today();
    var p = paceNow(), out = p.out;
    var sec = h("section", { class: "wrap section" });
    sec.appendChild(head("Tonight · " + weekdayOf(t) + " " + fmtDate(t), "Tonight's shift"));

    var box = h("div", { class: "pace-box", "data-status": out.status || "on-track" }, h("p", { class: "pace", text: paceText(out, p.target, p.waiting) }));
    var sub = [];
    if (typeof out.minutesToday === "number") sub.push("Your night: " + Math.round(out.minutesToday) + " minutes");
    if (typeof out.daysLeft === "number" && out.status !== "done" && out.status !== "past-target") sub.push(plural(out.daysLeft, "day") + " to go");
    if (sub.length) box.appendChild(h("p", { class: "pace-sub", text: sub.join(" · ") }));
    if (out.status === "behind" && isIso(out.suggestedDate)) {
      var move = h("button", { class: "btn btn-small", type: "button", text: "Move my date to " + fmtDate(out.suggestedDate) });
      move.addEventListener("click", function () {
        move.disabled = true;
        saveSettings(function (st) { st.targetDate = out.suggestedDate; }).then(null, function () { move.disabled = false; });
      });
      box.appendChild(h("div", { class: "btn-row" }, move));
    }
    if (out.status === "past-target") box.appendChild(h("div", { class: "btn-row" }, link("Pick a new date in Settings", "settings", "btn btn-small")));
    sec.appendChild(box);

    var due = out.reviews || p.due || [];
    if (due.length) {
      var mins = due.reduce(function (a, d) { return a + (d.kind === "cold" ? 3 : 1.5); }, 0);
      sec.appendChild(h("div", { class: "callout due" }, [
        h("p", null, [
          h("strong", { text: plural(due.length, "cold case") + " came back tonight." }),
          " About " + plural(Math.max(1, Math.round(mins)), "minute") + ". Answer these first, from memory."
        ]),
        link("Open the cold cases", "reviews", "btn btn-primary")
      ]));
    } else {
      sec.appendChild(h("div", { class: "callout" }, h("p", { class: "muted", text: "No cold cases tonight." })));
    }

    sec.appendChild(h("h2", { class: "h-small", text: "New tonight" }));
    var items = out.newItems || [];
    if (items.length) {
      sec.appendChild(h("ol", { class: "sessions" }, items.map(sessionCard)));
    } else if (out.status === "done" && p.waiting > 0) {
      sec.appendChild(h("p", { class: "muted", text: "You've closed everything that's written so far. New cases show up here as soon as they're ready. Cold cases keep coming back in the meantime." }));
    } else if (out.status === "done") {
      sec.appendChild(h("p", { class: "muted", text: "Every session on your plan is closed. Cold cases keep coming back so it stays with you." }));
    } else {
      sec.appendChild(h("p", { class: "muted", text: "That's tonight's new work done. You can always play more from Seasons." }));
    }
    // On a weekday the plan holds Build Nights back (contract 9.5); say so when one is open and waiting.
    var heldBuild = null;
    try { if (!DL.util.isWeekend(t)) heldBuild = (p.remaining || []).filter(function (it) { return it.weekendOnly; })[0] || null; } catch (e) { heldBuild = null; }
    if (heldBuild) {
      sec.appendChild(h("p", { class: "more-line" }, [
        "Build Night ", link(heldBuild.title || heldBuild.id, "build/" + heldBuild.id), " is unlocked. It shows up here on the weekend."
      ]));
    }
    sec.appendChild(h("p", { class: "more-line" }, ["Want more? Every case is in ", link("Seasons", "seasons"), "."]));
    sec.appendChild(storageLine());
    ctx.root.appendChild(sec);
    return null;
  }

  /* ======================================================================
     Shared pieces: diagrams, answer widgets, grading
     ====================================================================== */
  function drawDiagram(spec, host) {
    if (!spec) return null;
    if (!DL.diagram || typeof DL.diagram.render !== "function") {
      host.appendChild(h("p", { class: "diagram-error", text: "This diagram can't be drawn: the drawing engine didn't load." }));
      return null;
    }
    try {
      var handle = DL.diagram.render(spec, host, {});
      var svg = handle && handle.svg;
      var w = 0;
      if (svg) {
        var vb = String(svg.getAttribute("viewBox") || "").split(/[\s,]+/);
        w = Number(vb[2]) || Number(spec.w) || 0;
        if (svg.classList) svg.classList.add("dg");
        if (w && svg.style) {
          svg.style.maxWidth = w + "px";
          svg.style.minWidth = Math.min(w, 600) + "px";
        }
      }
      if (handle) ui.diagrams.push(handle);
      return { handle: handle, width: w };
    } catch (err) {
      host.appendChild(h("p", { class: "diagram-error", text: "This diagram couldn't be drawn (" + errMsg(err) + ")." }));
      return null;
    }
  }

  function normalizeGrade(r, keyIdeas) {
    r = r || {};
    var marks = Array.isArray(r.marks) ? r.marks : [];
    var out = { marks: keyIdeas.map(function (k, i) { return !!marks[i]; }), feedback: r.feedback ? String(r.feedback) : "", suggested: r.suggested };
    if (!GRADE_LABELS[out.suggested] || out.suggested === "easy") {
      var n = out.marks.filter(Boolean).length;
      out.suggested = !keyIdeas.length ? "partly" : n === keyIdeas.length ? "good" : n ? "partly" : "missed";
    }
    return out;
  }
  function offlineGrade(keyIdeas, answer) {
    try {
      if (DL.ai && typeof DL.ai.offlineGrade === "function") return normalizeGrade(DL.ai.offlineGrade({ keyIdeas: keyIdeas, answer: answer }), keyIdeas);
    } catch (e) { /* fall through to the local check */ }
    var text = String(answer || "").toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, "\"");
    var marks = keyIdeas.map(function (k) {
      return (k.match || []).some(function (f) { return text.indexOf(String(f).toLowerCase()) >= 0; });
    });
    return normalizeGrade({ marks: marks, feedback: "" }, keyIdeas);
  }
  function gradeAnswer(item, answer) {
    var keyIdeas = item.keyIdeas || [];
    function offline() { var r = offlineGrade(keyIdeas, answer); r.viaAi = false; return r; }
    if (!DL.ai || typeof DL.ai.available !== "function" || typeof DL.ai.gradeFree !== "function") return Promise.resolve(offline());
    return Promise.resolve().then(function () { return DL.ai.available(); }).then(function (ok) {
      if (!ok) return offline();
      return Promise.resolve(DL.ai.gradeFree({ prompt: item.prompt, keyIdeas: keyIdeas, model: item.model, answer: answer }))
        .then(function (r) { var n = normalizeGrade(r, keyIdeas); n.viaAi = !!r && r.source === "ai"; return n; });
    }).then(null, function () { return offline(); });
  }

  /* An answer box for one prompt. item: {kind: "mcq"|"free", prompt, options, answer, why, keyIdeas, model}.
     opts: {showPrompt, grades, allowEasy, label, onGrade(g) -> text shown after grading, after(container),
     deep: {caseId, caseTitle} to offer a deeper grade from Claude on free-text answers} */
  function answerWidget(item, opts) {
    return item && item.kind === "mcq" ? mcqWidget(item, opts) : freeWidget(item || {}, opts);
  }
  /* Options are shown in a shuffled order. `pos` is a display position, order[pos] the authored index,
     and item.answer stays an authored index. */
  function mcqWidget(item, opts) {
    var box = h("div", { class: "recall" });
    if (opts.showPrompt && item.prompt) box.appendChild(h("p", { class: "recall-q", md: item.prompt }));
    var fb = h("div", { class: "feedback", "aria-live": "polite" });
    var answer = Number(item.answer);
    var answered = false;
    var options = item.options || [];
    var order = shuffledOrder(options.length, String(item.prompt || "") + "|" + options.length);
    var answerPos = order.indexOf(answer);
    var buttons = order.map(function (orig, pos) {
      var b = h("button", { class: "opt", type: "button" }, [h("span", { class: "sr-only", text: "Answer " + LETTERS[pos] + ": " }), h("span", { md: options[orig] })]);
      b.addEventListener("click", function () { choose(pos); });
      return b;
    });
    box.appendChild(h("div", { class: "opts", role: "group", "aria-label": "Answers" }, buttons));
    box.appendChild(fb);
    function mark(b, ok) {
      b.classList.add(ok ? "right" : "wrong");
      b.insertBefore(h("span", { "aria-hidden": "true", text: ok ? "✓ " : "✗ " }), b.firstChild);
      b.insertBefore(h("span", { class: "sr-only", text: ok ? "Right answer. " : "Your pick, not right. " }), b.firstChild);
    }
    function choose(pos) {
      if (answered) return;
      answered = true;
      var right = pos === answerPos;
      buttons.forEach(function (b) { b.disabled = true; });
      buttons[pos].setAttribute("aria-pressed", "true");
      mark(buttons[pos], right);
      if (!right && answerPos >= 0 && buttons[answerPos]) mark(buttons[answerPos], true);
      clear(fb);
      fb.appendChild(h("p", { class: "verdict-line " + (right ? "ok" : "bad"), text: right ? "Right." : "Not quite. The right answer is marked." }));
      paras(item.why).forEach(function (p) { fb.appendChild(p); });
      var next = h("p", { class: "next-line", text: opts.onGrade ? (opts.onGrade(right ? "good" : "missed") || "") : "" });
      fb.appendChild(next);
      if (right && opts.allowEasy) {
        var easy = h("button", { class: "btn btn-small", type: "button", "aria-pressed": "false", text: GRADE_LABELS.easy });
        easy.addEventListener("click", function () {
          easy.disabled = true;
          easy.setAttribute("aria-pressed", "true");
          var t2 = opts.onGrade ? opts.onGrade("easy") : "";
          if (t2) next.textContent = t2;
        });
        fb.appendChild(h("div", { class: "btn-row" }, [easy, h("span", { class: "muted small", text: "Too easy? Push it further out." })]));
      }
      if (opts.after) opts.after(fb);
    }
    return box;
  }
  function freeWidget(item, opts) {
    var box = h("div", { class: "recall" });
    var id = nextId("answer");
    var hasPrompt = opts.showPrompt && item.prompt;
    if (hasPrompt) box.appendChild(h("p", { class: "recall-q", id: id + "-q", md: item.prompt }));
    var ta = h("textarea", { id: id, rows: "4", placeholder: "Answer from memory. A few sentences is plenty.", "aria-describedby": hasPrompt ? id + "-q" : null });
    var check = h("button", { class: "btn", type: "button", text: "Check my answer" });
    var out = h("div", { class: "feedback", "aria-live": "polite" });
    box.appendChild(h("label", { class: "field-k", for: id, text: opts.label || "Your answer, in your own words" }));
    box.appendChild(ta);
    var notice = aiNoticeBefore();
    if (notice) box.appendChild(notice);
    box.appendChild(check);
    box.appendChild(out);
    var graded = false;
    check.addEventListener("click", function () {
      var answer = ta.value.trim();
      clear(out);
      if (!answer) {
        out.appendChild(h("p", { text: "Write at least one sentence first. Answering from memory is the whole point." }));
        ta.focus();
        return;
      }
      check.disabled = true;
      ta.readOnly = true;
      out.appendChild(h("p", { class: "loading-inline", text: "Reading your answer..." }));
      gradeAnswer(item, answer).then(function (res) { clear(out); showResult(res, answer); });
    });
    function showResult(res, answer) {
      // The notice was shown above the button before sending; the first AI-graded result retires it.
      if (res.viaAi && !settings().aiNoticeSeen) {
        saveSettings(function (st) { st.aiNoticeSeen = true; }).then(null, function () { /* shown again next time */ });
      }
      var ideas = item.keyIdeas || [];
      if (ideas.length) {
        out.appendChild(h("p", { class: "field-k", text: "Key ideas" }));
        out.appendChild(h("ul", { class: "marks" }, ideas.map(function (k, i) {
          var ok = !!res.marks[i];
          return h("li", null, [
            h("span", { class: ok ? "mark-ok" : "mark-no", "aria-hidden": "true", text: ok ? "✓" : "✗" }),
            h("span", null, [h("span", { class: "sr-only", text: ok ? "In your answer: " : "Missing: " }), h("span", { md: (k && k.idea) || "" })])
          ]);
        })));
      }
      paras(res.feedback).forEach(function (p) { out.appendChild(p); });
      if (item.model) out.appendChild(h("div", { class: "model" }, [h("p", { class: "part2-label", text: "A strong answer" })].concat(paras(item.model))));
      out.appendChild(h("p", { class: "field-k", text: "How did you do?" }));
      var next = h("p", { class: "next-line" });
      var grades = opts.grades || ["missed", "partly", "good", "easy"];
      var btns = grades.map(function (g) {
        var b = h("button", { class: "btn" + (g === res.suggested ? " suggested" : ""), type: "button", "aria-pressed": "false", text: GRADE_LABELS[g] || g });
        b.addEventListener("click", function () {
          if (graded) return;
          setGrade(g);
        });
        return b;
      });
      /* One path for a self-grade click and for Claude's result code. A later call (Claude's code after a
         self-grade) replaces the grade; `after` (the Next button) still runs only once. */
      function setGrade(g) {
        var first = !graded;
        graded = true;
        btns.forEach(function (x, i) {
          x.disabled = true;
          x.setAttribute("aria-pressed", String(grades[i] === g));
        });
        next.textContent = opts.onGrade ? (opts.onGrade(g) || "") : "";
        if (first && opts.after) opts.after(out);
      }
      out.appendChild(h("div", { class: "btn-row", role: "group", "aria-label": "Grade yourself" }, btns));
      if (GRADE_LABELS[res.suggested]) out.appendChild(h("p", { class: "muted small", text: "Suggested: " + GRADE_LABELS[res.suggested] + ". You know best." }));
      out.appendChild(next);
      if (opts.deep && DL.prompts) out.appendChild(deepGrade(item, answer, opts.deep, grades, setGrade));
    }
    return box;
  }
  /* The AI notice, placed above "Check my answer" before anything is sent. It shows only while the notice
     is unseen and DL.ai.available() says answers really go to Claude here (on the static site they don't). */
  function aiNoticeBefore() {
    var set = settings();
    if (set.aiNoticeSeen || set.aiGrading === false || !DL.ai || typeof DL.ai.available !== "function") return null;
    var p = h("p", { class: "ai-notice", hidden: true, text: AI_NOTICE });
    Promise.resolve().then(function () { return DL.ai.available(); }).then(function (ok) {
      if (ok && !settings().aiNoticeSeen) p.hidden = false;
    }, function () { /* stays hidden */ });
    return p;
  }
  /* Claude's grade may be one this widget doesn't offer (Pin it has no Easy): use the nearest one below. */
  function fitGrade(g, grades) {
    if (grades.indexOf(g) >= 0) return g;
    if (g === "easy" && grades.indexOf("good") >= 0) return "good";
    return grades.indexOf("partly") >= 0 ? "partly" : grades[0];
  }
  /* "Get a deeper grade from Claude": copies DL.prompts.grade for this answer, then takes Claude's result
     code (DL-G-<case>-<grade>) and applies it through setGrade. */
  function deepGrade(item, answer, deep, grades, setGrade) {
    var caseId = String(deep.caseId || "");
    var copyBtn = h("button", { class: "btn btn-copy", type: "button", text: "Get a deeper grade from Claude" });
    var copyStatus = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    var fallback = copyField("Grading prompt to copy");
    copyBtn.addEventListener("click", function () {
      var text = DL.prompts.grade({
        caseId: caseId, caseTitle: deep.caseTitle || "", prompt: item.prompt || "",
        keyIdeas: item.keyIdeas || [], model: item.model || "", answer: answer
      });
      copyText(text, { field: fallback, status: copyStatus, btn: copyBtn, hideField: true,
        ok: "Copied. " + CLAUDE_HINT + " Then paste Claude's result code below." });
    });
    var pid = nextId("code");
    var paste = h("textarea", { id: pid, class: "paste-field", rows: "2", spellcheck: "false", autocomplete: "off",
      placeholder: "DL-G-" + (caseId || "case") + "-good" });
    var use = h("button", { class: "btn", type: "button", text: "Use Claude's grade" });
    var msg = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    function say(t, tone) {
      msg.textContent = t;
      msg.classList.remove("ok", "bad");
      if (tone) msg.classList.add(tone);
    }
    use.addEventListener("click", function () {
      var raw = paste.value;
      if (!raw.trim()) { say("Paste Claude's result code first.", "bad"); paste.focus(); return; }
      var r = DL.prompts.parseCode(raw);
      if (!r) { say("No result code found. Claude's reply ends with a line like DL-G-" + (caseId || "case") + "-good.", "bad"); return; }
      if (r.kind !== "grade") { say("That's a 3 AM interview code. Paste it on that interview's page.", "bad"); return; }
      if (!sameId(r.id, caseId)) { say("That code is for case " + r.id + ", not this one.", "bad"); return; }
      var g = fitGrade(r.grade, grades);
      setGrade(g);
      say("Claude's grade: " + (GRADE_LABELS[r.grade] || r.grade) +
        (g !== r.grade ? ", counted as " + (GRADE_LABELS[g] || g) : "") + ". It's set above.", "ok");
    });
    return h("div", { class: "deep-grade" }, [
      h("p", { class: "field-k", text: "Want a closer read?" }),
      h("div", { class: "btn-row" }, copyBtn),
      h("p", { class: "field-help", text: CLAUDE_HINT }),
      copyStatus,
      fallback,
      h("label", { class: "field-k", for: pid, text: "Paste Claude's result code" }),
      paste,
      h("div", { class: "btn-row" }, use),
      msg
    ]);
  }

  /* ======================================================================
     View: case player  #case/<id>
     ====================================================================== */
  function viewCase(ctx) {
    var id = ctx.arg;
    var cat = catalog();
    // caseMeta(id) finds interviews and builds too since core v1.2.0, so the id goes to the view of the catalog
    // list it is in: a build or interview id under #case/ opens its own view instead of a "being written" panel.
    var isCaseId = !!(findIn(cat.cases, id) || findIn(cat.lld, id));
    if (!isCaseId && findIn(cat.builds, id)) return viewBuild(ctx);
    if (!isCaseId && interviewMeta(id)) return viewInterview(ctx);
    var meta = metaFor(id);
    if (!meta) {
      ctx.root.appendChild(messagePanel("Not on file", "There's no case called “" + id + "”.", null));
      return null;
    }
    setCourse(ctx, courseOf(meta));
    ctx.root.appendChild(h("section", { class: "wrap" }, h("p", { class: "loading", role: "status", text: "Pulling the case file..." })));
    return DL.content.loadCase(id).then(function (c) {
      if (!ctx.alive) return;
      clear(ctx.root);
      buildCase(ctx, c || {}, meta);
    }, function (err) {
      if (!ctx.alive) return;
      clear(ctx.root);
      var planned = meta.status && meta.status !== "ready";
      ctx.root.appendChild(planned
        ? messagePanel("Being written", "“" + (meta.title || id) + "” is still being written. It shows up here when it's ready.", null)
        : messagePanel("Couldn't open the file", "This case file couldn't be opened. Reload the page to try again.", err));
    });
  }
  function messagePanel(eyebrow, title, err) {
    return h("section", { class: "wrap section" }, [
      head(eyebrow, title),
      err ? h("pre", { class: "err-detail", text: errMsg(err) }) : null,
      h("div", { class: "btn-row mt" }, [link("Back to tonight", "tonight", "btn"), link("Seasons", "seasons", "btn btn-ghost")])
    ]);
  }

  function buildCase(ctx, c, meta) {
    c.id = c.id || meta.id;
    var R = ctx.root;
    var story = h("section", { class: "wrap section", "aria-label": "The story" }, [
      caseCrumbs(c, meta),
      postEl(c),
      commentsEl(c.comments || [])
    ]);
    if (c.reply && c.reply.options && c.reply.options.length) story.appendChild(replyBox(c));
    R.appendChild(story);
    if (c.sim && c.sim.module) R.appendChild(simSection(ctx, c));
    R.appendChild(explainEl(c));
    var tail = h("section", { class: "wrap section", "aria-label": "After the case" });
    var terms = termsEl(c);
    if (terms) tail.appendChild(terms);
    if (c.atWork) tail.appendChild(h("div", { class: "block at-work" }, [h("h3", { text: "Spot it at work" })].concat(paras(c.atWork))));
    var pin = pinIt(c);
    if (pin) tail.appendChild(pin);
    tail.appendChild(ownWords(c));
    tail.appendChild(closeBox(ctx, c));
    R.appendChild(tail);
  }

  function caseCrumbs(c, meta) {
    var season = c.season || meta.season;
    var bits = [];
    if (season) bits.push("Season " + season + (c.n || meta.n ? ", case " + (c.n || meta.n) : ""));
    if (c.minutes || meta.minutes) bits.push((c.minutes || meta.minutes) + " min");
    var core = c.core !== undefined ? c.core : meta.core;
    return h("div", { class: "case-crumbs" }, [
      link("Seasons", "seasons"),
      h("span", { "aria-hidden": "true", text: "/" }),
      h("span", { text: bits.join(" · ") }),
      courseChip(courseOf(meta)),
      h("span", { class: "chip" + (core ? " core" : ""), text: core ? "core" : "bonus" }),
      isDone(c.id) ? h("span", { class: "chip ok", text: isCredited(c.id) ? "Credited from LATENT" : "closed" }) : null
    ]);
  }

  function countComments(list) {
    return (list || []).reduce(function (n, cm) { return n + 1 + countComments(cm && cm.replies); }, 0);
  }
  function votesEl(n) {
    var base = Number(n) || 0;
    var up = h("button", { class: "vote", type: "button", "aria-pressed": "false", "aria-label": "Upvote", text: "▲" });
    var down = h("button", { class: "vote", type: "button", "aria-pressed": "false", "aria-label": "Downvote", text: "▼" });
    var count = h("span", { class: "vote-n", text: fmtNum(base) });
    function setVote(dir) {
      var isUp = dir === "up" && up.getAttribute("aria-pressed") !== "true";
      var isDown = dir === "down" && down.getAttribute("aria-pressed") !== "true";
      up.setAttribute("aria-pressed", String(isUp));
      down.setAttribute("aria-pressed", String(isDown));
      count.textContent = fmtNum(base + (isUp ? 1 : 0) - (isDown ? 1 : 0));
    }
    up.addEventListener("click", function () { setVote("up"); });
    down.addEventListener("click", function () { setVote("down"); });
    return h("div", { class: "votes" }, [up, count, down]);
  }
  function blockEl(b) {
    if (!b || !b.t) return null;
    switch (b.t) {
      case "p": return h("p", { md: b.text });
      case "beat": return h("p", { class: "beat-line", md: b.text });
      case "log": return h("pre", { class: "logline", tabindex: "0", "aria-label": "Log lines", text: b.text || "" });
      case "note": {
        var items = b.items || [];
        return h("figure", { class: "rules-note" }, [
          b.title ? h("p", { class: "note-title", md: b.title }) : null,
          items.length ? h("ol", null, items.map(function (it) { return h("li", { md: it }); })) : null,
          paras(b.text),
          b.sig ? h("p", { class: "sig", text: b.sig }) : null
        ]);
      }
      case "evidence": {
        var sx = h("div", { class: "scroll-x" });
        var fig = h("figure", { class: "attach" }, [h("p", { class: "attach-label", text: "Attachment · " + (b.label || "evidence") }), sx]);
        drawDiagram(b.diagram, sx);
        if (b.caption) fig.appendChild(h("figcaption", { md: b.caption }));
        return fig;
      }
      default: return b.text ? h("p", { md: b.text }) : null;
    }
  }
  function postEl(c) {
    var p = c.post || {};
    var story = h("div", { class: "story" });
    (p.blocks || []).forEach(function (b) { var n = blockEl(b); if (n) story.appendChild(n); });
    var n = countComments(c.comments);
    return h("article", { class: "post" }, [
      votesEl(p.votes),
      h("div", { class: "post-body" }, [
        h("div", { class: "post-meta" }, [
          p.flair ? h("span", { class: "flair", text: p.flair }) : null,
          h("span", null, ["Posted by ", h("span", { class: "user", text: p.author || "anonymous" })]),
          p.age ? h("span", { text: p.age }) : null
        ]),
        h("h1", { class: "post-title", tabindex: "-1", md: p.title || c.title || "" }),
        story,
        h("div", { class: "post-actions" }, [h("span", { text: plural(n, "comment") }), h("span", { text: "Reply below" })])
      ])
    ]);
  }
  function commentEl(cm) {
    cm = cm || {};
    var bits = [h("span", { class: "user", text: cm.author || "anonymous" })];
    if (cm.op) { bits.push(" "); bits.push(h("span", { class: "op-tag", text: "OP" })); }
    if (typeof cm.points === "number") bits.push(" · " + plural(cm.points, "point"));
    if (cm.age) bits.push(" · " + cm.age);
    var node = h("div", { class: "comment" }, [h("div", { class: "c-meta" }, bits)].concat(paras(cm.text)));
    (cm.replies || []).forEach(function (r) { node.appendChild(commentEl(r)); });
    return node;
  }
  function commentsEl(list) {
    return h("section", { class: "comments", "aria-label": "Comments" }, list.map(commentEl));
  }

  function replyBox(c) {
    var reply = c.reply || {};
    var opts = reply.options || [];
    var verdict = h("span", { class: "verdict" });
    var part2 = h("blockquote", { class: "part2" });
    var senior = h("span");
    var result = h("div", { class: "reply-result", hidden: true, "aria-live": "polite" }, [
      verdict,
      h("p", { class: "part2-label", text: "Part 2 preview" }),
      part2,
      h("p", { class: "senior" }, [h("strong", { text: "A senior would say:" }), " ", senior])
    ]);
    var first = h("p", { class: "reply-first", "aria-live": "polite" });
    var buttons = opts.map(function (o, i) {
      var b = h("button", { class: "choice", type: "button", "aria-pressed": "false" }, [
        h("span", { class: "choice-k", "aria-hidden": "true", text: LETTERS[i] }),
        h("span", { md: o.text })
      ]);
      b.addEventListener("click", function () { pick(i, true); });
      return b;
    });
    function show(i) {
      var o = opts[i] || {};
      buttons.forEach(function (b, j) { b.setAttribute("aria-pressed", String(j === i)); });
      result.hidden = false;
      result.setAttribute("data-tone", o.tone === "ok" || o.tone === "warn" ? o.tone : "bad");
      verdict.textContent = o.verdict || "";
      part2.innerHTML = mdHtml(o.part2 || "");
      senior.innerHTML = mdHtml(o.senior || "");
    }
    function pick(i, store) {
      show(i);
      var rec = caseRec(c.id);
      if (store && (rec.choice === undefined || rec.choice === null)) {
        var ok = (opts[i] || {}).tone === "ok";
        Promise.resolve(DL.store.update(function (d) {
          d.cases = d.cases || {};
          var r = d.cases[c.id] || (d.cases[c.id] = {});
          if (r.choice === undefined || r.choice === null) { r.choice = i; r.firstTryOk = ok; }
        })).then(null, function () { /* the pick still shows */ });
        first.textContent = ok
          ? "Saved: the senior answer, first try. The other replies are worth a look too."
          : "Your first pick is saved. Try the others to see where they lead.";
      }
    }
    var box = h("section", { class: "reply-box", "aria-labelledby": "reply-h" }, [
      h("h2", { id: "reply-h", class: "reply-h", text: "Your reply to OP" }),
      reply.prompt ? h("p", { class: "reply-sub", md: reply.prompt }) : null,
      h("div", { class: "choices" }, buttons),
      result,
      first
    ]);
    var rec0 = caseRec(c.id);
    if (typeof rec0.choice === "number" && opts[rec0.choice]) {
      show(rec0.choice);
      first.textContent = "Your first pick was " + LETTERS[rec0.choice] + ". Try the others any time.";
    }
    return box;
  }

  function simSection(ctx, c) {
    var sim = c.sim;
    var host = h("div", { class: "sim-host" });
    var startBtn = h("button", { class: "btn btn-primary", type: "button", text: "Start the sim" });
    host.appendChild(h("div", { class: "sim-placeholder" }, [
      h("p", { text: "OP's system, live. It starts when you scroll here, or right now:" }),
      startBtn
    ]));
    var started = false, instance = null, io = null;
    function start() {
      if (started || !ctx.alive) return;
      started = true;
      if (io) { io.disconnect(); io = null; }
      clear(host);
      var note = h("p", { class: "loading-inline", role: "status", text: "Starting the sim..." });
      var mountEl = h("div", { class: "sim" });
      host.appendChild(note);
      host.appendChild(mountEl);
      if (!DL.sims || typeof DL.sims.mount !== "function") { failed(new Error("The sim engine didn't load (engine/sim.js).")); return; }
      Promise.resolve().then(function () { return DL.sims.mount(sim.module, mountEl, {}); }).then(function (inst) {
        removeNode(note);
        if (!ctx.alive) { try { if (inst && inst.destroy) inst.destroy(); } catch (e) { /* gone */ } return; }
        instance = inst;
      }, failed);
    }
    function failed(err) {
      if (!ctx.alive) return;
      clear(host);
      host.appendChild(h("div", { class: "inline-error" }, [
        h("p", { text: "The sim couldn't start. The rest of the case still works." }),
        h("pre", { class: "err-detail", text: errMsg(err) })
      ]));
    }
    startBtn.addEventListener("click", start);
    if (typeof root.IntersectionObserver === "function") {
      try {
        io = new root.IntersectionObserver(function (entries) {
          if (entries.some(function (e) { return e.isIntersecting; })) start();
        }, { rootMargin: "300px 0px" });
        io.observe(host);
      } catch (e) { io = null; }
    }
    ctx.cleanups.push(function () {
      if (io) { io.disconnect(); io = null; }
      if (instance && typeof instance.destroy === "function") { try { instance.destroy(); } catch (e) { /* gone */ } }
      instance = null;
    });
    return h("section", { class: "wide section sim-section", "aria-labelledby": "sim-h" }, [
      h("header", { class: "sec-head" }, [
        h("p", { class: "eyebrow", text: "OP's system · live" }),
        h("h2", { id: "sim-h", md: sim.title || "Break it yourself" }),
        sim.lede ? h("p", { class: "lede", md: sim.lede }) : null
      ]),
      host,
      sim.tryThis ? h("p", { class: "try" }, [h("strong", { text: "Try this: " }), h("span", { md: sim.tryThis })]) : null
    ]);
  }

  function sourceLink(src) {
    if (!src) return null;
    var url = String(src.url || "");
    var label = src.title || url;
    if (!/^https?:\/\//i.test(url)) return h("span", { text: label });
    return h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, [label, h("span", { class: "sr-only", text: " (opens in a new tab)" })]);
  }
  function explainEl(c) {
    var ex = c.explain || {};
    var sources = c.sources || [];
    var sec = h("section", { class: "section", "aria-labelledby": "ex-h" });
    var top = h("div", { class: "wrap" }, h("header", { class: "sec-head" }, [
      h("p", { class: "eyebrow", text: "Case closed · the explanation" }),
      h("h2", { id: "ex-h", text: "What actually happened" }),
      ex.oneLine ? h("p", { class: "oneline", md: ex.oneLine }) : null,
      c.rule && c.rule.n ? h("p", { class: "rule-tie", text: "This case explains Rule " + c.rule.n + "." }) : null
    ]));
    if (ex.steps && ex.steps.length) {
      top.appendChild(h("ol", { class: "steps" }, ex.steps.map(function (st) {
        st = st || {};
        return h("li", null, [h("strong", { md: st.title || "" }), " ", h("span", { md: st.text || "" })]);
      })));
    }
    sec.appendChild(top);

    if (ex.diagram) {
      var sx = h("div", { class: "scroll-x" });
      var fig = h("figure", { class: "diagram" }, sx);
      var holder = h("div", { class: "wrap fig-block" }, fig);
      var res = drawDiagram(ex.diagram, sx);
      if (ex.caption) fig.appendChild(h("figcaption", { md: ex.caption }));
      if (res && res.width > 790) holder.className = "wide fig-block";
      sec.appendChild(holder);
    }

    var rest = h("div", { class: "wrap" });
    if (ex.fix) rest.appendChild(h("div", { class: "block" }, [ex.fix.title ? h("h3", { md: ex.fix.title }) : null].concat(paras(ex.fix.text))));
    if (ex.limits && ex.limits.length) {
      rest.appendChild(h("div", { class: "block" }, [
        h("h3", { text: "Limits" }),
        h("ul", { class: "limits" }, ex.limits.map(function (l) { return h("li", { md: l }); }))
      ]));
    }
    if (ex.tradeoff && ex.tradeoff.rows && ex.tradeoff.rows.length) {
      var table = h("table", { class: "tradeoff" }, [
        ex.tradeoff.head ? h("thead", null, h("tr", null, ex.tradeoff.head.map(function (x) { return h("th", { scope: "col", md: x }); }))) : null,
        h("tbody", null, ex.tradeoff.rows.map(function (row) {
          return h("tr", null, (row || []).map(function (cell) { return h("td", { md: cell }); }));
        }))
      ]);
      rest.appendChild(h("div", { class: "block" }, [
        h("h3", { text: "The trade-off" }),
        h("div", { class: "table-wrap", tabindex: "0", role: "region", "aria-label": "Trade-off table" }, table)
      ]));
    }
    if (ex.seniorTake) {
      rest.appendChild(h("div", { class: "block" }, [
        h("p", { class: "pull", md: ex.seniorTake }),
        h("p", { class: "pull-by", text: "The senior take" })
      ]));
    }
    var panels = [];
    if (ex.realWorld && ex.realWorld.length) {
      var rw = h("div", { class: "panel" }, h("h3", { text: "It happened for real" }));
      ex.realWorld.forEach(function (r) {
        r = r || {};
        rw.appendChild(h("p", null, [r.title ? h("strong", { md: String(r.title).replace(/\.\s*$/, "") + "." }) : null, " ", h("span", { md: r.text || "" })]));
        var src = typeof r.source === "number" ? sources[r.source] : null;
        if (src) rw.appendChild(h("p", { class: "src-link" }, ["Source: ", sourceLink(src)]));
      });
      panels.push(rw);
    }
    if (ex.interview && ((ex.interview.asked && ex.interview.asked.length) || ex.interview.answer)) {
      var iv = h("div", { class: "panel" }, h("h3", { text: "How interviews ask it" }));
      if (ex.interview.asked && ex.interview.asked.length) {
        iv.appendChild(h("ul", null, ex.interview.asked.map(function (q) { return h("li", { md: "“" + q + "”" }); })));
      }
      if (ex.interview.answer) iv.appendChild(h("p", null, [h("strong", { text: "Senior answer:" }), " ", h("span", { md: ex.interview.answer })]));
      panels.push(iv);
    }
    if (panels.length) rest.appendChild(h("div", { class: "duo" }, panels));
    if (sources.length) {
      rest.appendChild(h("div", { class: "block sources" }, [
        h("h3", { text: "Sources" }),
        h("ol", null, sources.map(function (src) { return h("li", null, sourceLink(src)); }))
      ]));
    }
    sec.appendChild(rest);
    return sec;
  }

  function termsEl(c) {
    var terms = c.terms || [];
    if (!terms.length) return null;
    return h("div", { class: "block" }, h("details", { class: "terms" }, [
      h("summary", { text: "Words used here (" + terms.length + ")" }),
      h("dl", { class: "term-list" }, terms.map(function (t) {
        t = t || {};
        return [h("dt", { md: t.term || "" }), h("dd", { md: t.def || "" })];
      }))
    ]));
  }

  function pinPrompt(c) {
    var rec = (c.recall || []).filter(Boolean);
    if (!rec.length) return null;
    for (var i = rec.length - 1; i >= 0; i--) if (rec[i].kind === "free") return rec[i];
    return rec[rec.length - 1];
  }
  function pinIt(c) {
    var item = pinPrompt(c);
    if (!item) return null;
    return h("div", { class: "block" }, [
      h("h2", { class: "part-head", text: "Pin it" }),
      h("p", { class: "lede", text: "One question from memory before you close the case. The case comes back later as a cold case, right before you'd forget it." }),
      answerWidget(item, {
        showPrompt: true,
        grades: ["missed", "partly", "good"],
        allowEasy: false,
        onGrade: function (g) { return PIN_REPLY[g] || ""; },
        deep: { caseId: c.id, caseTitle: (metaFor(c.id) || {}).title || c.title || c.id }
      })
    ]);
  }

  function ownWords(c) {
    var note = (state().notes || {})[c.id] || null;
    var id = nextId("note");
    var ta = h("textarea", { id: id, rows: "4", placeholder: "In plain words, what went wrong, and what fixes it?" });
    ta.value = note && note.text ? String(note.text) : "";
    var status = h("span", { class: "status-line", role: "status", "aria-live": "polite" });
    var save = h("button", { class: "btn", type: "button", text: "Save note" });
    save.addEventListener("click", function () {
      var text = ta.value.trim();
      save.disabled = true;
      Promise.resolve(DL.store.update(function (d) {
        d.notes = d.notes || {};
        if (text) d.notes[c.id] = { text: text, d: today() };
        else delete d.notes[c.id];
      })).then(function () {
        save.disabled = false;
        status.textContent = text ? "Saved. It's in Notes too." : "Note removed.";
      }, function (err) {
        save.disabled = false;
        status.textContent = "Couldn't save: " + errMsg(err);
      });
    });
    return h("div", { class: "block" }, [
      h("h3", { text: "Explain it in your own words" }),
      h("label", { class: "field-help", for: id, text: "Optional. Putting it in your own words is one of the best ways to keep it." }),
      ta,
      h("div", { class: "btn-row" }, [save, status])
    ]);
  }

  function nextSessionAfter(id) {
    var list = sessionsFor(planOf());
    var idx = indexOfId(list, id);
    if (idx < 0) { list = sessionsFor("all"); idx = indexOfId(list, id); }
    if (idx < 0) {
      // a case outside the schedule setting (a LATENT case on "Dead Letter only"): its own course's order
      var course = courseOf(metaFor(id));
      list = courseSessions(planOf(), course);
      idx = indexOfId(list, id);
      if (idx < 0) { list = courseSessions("all", course); idx = indexOfId(list, id); }
    }
    for (var i = idx + 1; i < list.length; i++) if (!isDone(list[i].id)) return list[i];
    return null;
  }
  /* Auto-credit (contract 9.8): a Dead Letter case whose LATENT sources are all closed is marked done with
     creditedFrom and no card. A failure here never undoes the close. */
  function applyCredits() {
    if (!DL.credits || typeof DL.credits.applyToStore !== "function") return Promise.resolve([]);
    return Promise.resolve().then(function () { return DL.credits.applyToStore(); }).then(null, function () { return []; });
  }
  function closeCase(id) {
    var t = today();
    return Promise.resolve(DL.store.update(function (d) {
      d.cases = d.cases || {};
      d.cards = d.cards || {};
      var r = d.cases[id] || (d.cases[id] = {});
      if (!r.done) {
        r.done = t;
        var day = dayRec(d, t);
        day.sessions = (day.sessions || 0) + 1;
      }
      if (!d.cards[id]) d.cards[id] = DL.sched.newCard(t);
    })).then(function (st) {
      return applyCredits().then(function () { return st; });
    });
  }
  function closeBox(ctx, c) {
    var box = h("div", { class: "close-box", "aria-live": "polite" });
    function renderDone(justClosed) {
      clear(box);
      box.classList.add("done");
      var t = today(), rec = caseRec(c.id), card = cardFor(c.id);
      var line = justClosed ? "Case closed." : "You closed this case on " + fmtDate(rec.done) + ".";
      if (!justClosed && isCredited(c.id)) {
        line = "Credited from LATENT on " + fmtDate(rec.done) + ", for closing " + joinList(rec.creditedFrom.map(function (x) {
          return (metaFor(x) || {}).title || x;
        })) + ". Their cold cases cover this one.";
      }
      if (card) {
        line += DL.sched.isDue(card, t) ? " Its cold case is waiting for you now." : " It comes back as a cold case " + DL.sched.nextReviewText(card, t) + ".";
      }
      box.appendChild(h("p", { text: line }));
      if (c.rule && c.rule.n) box.appendChild(h("p", { class: "muted", text: "Rule " + c.rule.n + "'s reason is now in your rulebook." }));
      if (c.next) box.appendChild(h("p", { class: "teaser", md: c.next }));
      var row = h("div", { class: "btn-row" });
      var nx = nextSessionAfter(c.id);
      if (nx) {
        var info = sessionInfo(nx);
        if (info.kind === "build") {
          if (info.status === "ready") row.appendChild(link("Next: Build Night, " + info.title, routeFor(info), "btn btn-primary"));
          else box.appendChild(h("p", { class: "muted", text: "Next up: Build Night, " + info.title + " (it unlocks as you close its cases)." }));
        } else if (playable(info)) {
          row.appendChild(link((info.kind === "interview" ? "Next: the 3 AM interview, " : "Next: ") + info.title, routeFor(info), "btn btn-primary"));
        } else {
          box.appendChild(h("p", { class: "muted", text: "Next up: " + info.title + " (being written)." }));
        }
      } else {
        box.appendChild(h("p", { class: "muted", text: "That was the last session on the list." }));
      }
      row.appendChild(link("Back to tonight", "tonight", "btn"));
      box.appendChild(row);
    }
    if (isDone(c.id)) {
      renderDone(false);
    } else {
      var btn = h("button", { class: "btn btn-primary", type: "button", text: "Close the case" });
      btn.addEventListener("click", function () {
        btn.disabled = true;
        closeCase(c.id).then(function () {
          if (ctx.alive) renderDone(true);
        }, function (err) {
          btn.disabled = false;
          box.appendChild(h("p", { class: "diagram-error", text: "Couldn't save: " + errMsg(err) }));
        });
      });
      box.appendChild(h("p", { text: "Closing marks the case done and starts its cold cases." }));
      box.appendChild(h("div", { class: "btn-row" }, btn));
    }
    return h("div", { class: "block" }, [h("h2", { class: "part-head", text: "Close the case" }), box]);
  }

  /* ======================================================================
     View: cold cases  #reviews
     The queue is a snapshot taken on entry; this view never re-renders on
     "progress", so a graded card and its "Next time" line stay on screen.
     ====================================================================== */
  function reviewCard(c, id, onFirst, after) {
    var t = today();
    var orig = cardFor(id) || DL.sched.newCard(t);
    var prompt = DL.sched.promptFor(orig, c) || {};
    var isCold = prompt.kind === "cold";
    var rec = caseRec(id);
    var since = isIso(rec.done) ? DL.util.daysBetween(rec.done, t) : 0;
    var author = (c.post && c.post.author) || "OP";
    var story = h("div", { class: "story" });
    if (isCold) {
      paras(prompt.update).forEach(function (p) { story.appendChild(p); });
    } else {
      story.appendChild(h("div", { class: "gp-reply" }, [
        h("p", { class: "c-meta" }, [h("span", { class: "user", text: guideOf(courseOf(metaFor(id))) }), " replied to your case:"]),
        h("p", { md: prompt.prompt || "" })
      ]));
    }
    var art = h("article", { class: "post post-update" }, h("div", { class: "post-body" }, [
      h("div", { class: "post-meta" }, [
        h("span", { class: "flair", text: "Update" }),
        h("span", null, ["Posted by ", h("span", { class: "user", text: author })]),
        since > 0 ? h("span", { text: laterText(since) }) : null
      ]),
      h("h2", { class: "post-title small", tabindex: "-1", md: "UPDATE: " + (c.title || id) }),
      story
    ]));
    var committed = false;
    var item = isCold ? { kind: "free", prompt: prompt.prompt, keyIdeas: prompt.keyIdeas, model: prompt.model } : prompt;
    var widget = answerWidget(item, {
      showPrompt: isCold,
      grades: ["missed", "partly", "good", "easy"],
      allowEasy: true,
      label: isCold ? "Your reply to OP, in your own words" : "Your answer, in your own words",
      deep: { caseId: id, caseTitle: (metaFor(id) || {}).title || c.title || id },
      // Always graded from the card as it was when the view opened, so Claude's code can replace a self-grade.
      onGrade: function (g) {
        var next = DL.sched.grade(orig, g, t);
        var first = !committed;
        committed = true;
        Promise.resolve(DL.store.update(function (d) {
          d.cards = d.cards || {};
          d.cards[id] = next;
          if (first) { var day = dayRec(d, t); day.reviews = (day.reviews || 0) + 1; }
        })).then(null, function () { /* the local copy is kept by the store */ });
        if (first && onFirst) onFirst();
        return "Next time: " + DL.sched.nextReviewText(next, t) + ".";
      },
      after: after
    });
    widget.classList.add("review-answer");
    return h("div", null, [art, widget]);
  }
  /* A decision card's answer box (contract 9.7): answer from memory, then your own note from the Build Night is
     shown as the model answer, then the self-grade buttons. There are no key ideas, so there is no automatic check
     and no Claude result code for these. */
  function decisionWidget(item, opts) {
    var box = h("div", { class: "recall" });
    var id = nextId("answer");
    var ta = h("textarea", { id: id, rows: "4", placeholder: "Answer from memory: what did you decide, and why?" });
    var check = h("button", { class: "btn", type: "button", text: "Check my answer" });
    var out = h("div", { class: "feedback", "aria-live": "polite" });
    box.appendChild(h("label", { class: "field-k", for: id, text: "Your answer, in your own words" }));
    box.appendChild(ta);
    box.appendChild(check);
    box.appendChild(out);
    var graded = false;
    check.addEventListener("click", function () {
      var answer = ta.value.trim();
      clear(out);
      if (!answer) {
        out.appendChild(h("p", { text: "Write at least one sentence first. Answering from memory is the whole point." }));
        ta.focus();
        return;
      }
      check.disabled = true;
      ta.readOnly = true;
      var note = String(item.model || "").trim();
      out.appendChild(h("div", { class: "model" }, [h("p", { class: "part2-label", text: "Your note from the Build Night" })].concat(
        note ? paras(note) : [h("p", { class: "muted", text: "You didn't leave a note when you marked it done. Compare your answer with what you remember building." })]
      )));
      out.appendChild(h("p", { class: "field-k", text: "How did you do?" }));
      var next = h("p", { class: "next-line" });
      var grades = ["missed", "partly", "good", "easy"];
      var btns = grades.map(function (g) {
        var b = h("button", { class: "btn", type: "button", "aria-pressed": "false", text: GRADE_LABELS[g] });
        b.addEventListener("click", function () {
          if (graded) return;
          graded = true;
          btns.forEach(function (x, i) {
            x.disabled = true;
            x.setAttribute("aria-pressed", String(grades[i] === g));
          });
          next.textContent = opts.onGrade ? (opts.onGrade(g) || "") : "";
          if (opts.after) opts.after(out);
        });
        return b;
      });
      out.appendChild(h("div", { class: "btn-row", role: "group", "aria-label": "Grade yourself" }, btns));
      out.appendChild(next);
    });
    return box;
  }
  /* A due decision card "build:<id>", built from the milestone (no case file to fetch). */
  function decisionCard(id, onFirst, after) {
    var t = today();
    var bid = id.slice(6);
    var m = buildMeta(bid) || { id: bid, title: bid };
    var orig = cardFor(id) || Object.assign(DL.sched.newCard(t), { build: bid });
    var prompt = null;
    try { prompt = DL.sched.promptFor(orig, m); } catch (e) { prompt = null; }
    if (!prompt || prompt.kind !== "decision") {
      prompt = { kind: "decision", prompt: m.decisionPrompt || "What did you decide while building " + (m.title || bid) + ", and why?", model: buildRec(bid).note || "" };
    }
    var rec = buildRec(bid);
    var since = isIso(rec.done) ? DL.util.daysBetween(rec.done, t) : 0;
    var proj = projectOf(m);
    var art = h("article", { class: "post post-update" }, h("div", { class: "post-body" }, [
      h("div", { class: "post-meta" }, [
        h("span", { class: "flair", text: "Build Night" }),
        courseChip(courseOf(m)),
        since > 0 ? h("span", { text: laterText(since) }) : null
      ]),
      h("h2", { class: "post-title small", tabindex: "-1", text: (proj.title ? proj.title + ": " : "") + (m.title || bid) }),
      h("div", { class: "story" }, h("div", { class: "gp-reply" }, [
        h("p", { class: "c-meta" }, [h("span", { class: "user", text: guideOf(courseOf(m)) }), " asks about your build:"]),
        h("p", { md: prompt.prompt || "" })
      ]))
    ]));
    var committed = false;
    var widget = decisionWidget(prompt, {
      // Graded from the card as it was when the view opened, like the case cards.
      onGrade: function (g) {
        var next = DL.sched.grade(orig, g, t);
        var first = !committed;
        committed = true;
        Promise.resolve(DL.store.update(function (d) {
          d.cards = d.cards || {};
          d.cards[id] = next;
          if (first) { var day = dayRec(d, t); day.reviews = (day.reviews || 0) + 1; }
        })).then(null, function () { /* the local copy is kept by the store */ });
        if (first && onFirst) onFirst();
        return "Next time: " + DL.sched.nextReviewText(next, t) + ".";
      },
      after: after
    });
    widget.classList.add("review-answer");
    return h("div", null, [art, widget]);
  }
  function shiftOver(n) {
    var nextCard = soonestCard();
    return h("div", { class: "shift-over" }, [
      h("h2", { tabindex: "-1", text: "Shift over." }),
      h("p", { text: n ? "You worked " + plural(n, "cold case") + " tonight." : "Nothing was graded this time. They'll be back." }),
      nextCard ? h("p", { class: "muted", text: "The next one comes back " + DL.sched.nextReviewText(nextCard, today()) + "." }) : null,
      h("div", { class: "btn-row" }, link("Back to tonight", "tonight", "btn"))
    ]);
  }
  function emptyReviews() {
    var any = Object.keys(state().cards || {}).length > 0;
    var nextCard = soonestCard();
    var line = !any
      ? "Close a case and its cold cases start showing up here, right before you'd forget it."
      : nextCard ? "The next cold case comes back " + DL.sched.nextReviewText(nextCard, today()) + "." : "";
    return h("div", { class: "shift-over" }, [
      h("h2", { text: "Nothing came back tonight." }),
      line ? h("p", { class: "muted", text: line }) : null,
      h("div", { class: "btn-row" }, link("Back to tonight", "tonight", "btn"))
    ]);
  }
  function viewReviews(ctx) {
    var sec = h("section", { class: "wrap section" }, head("Reopened files", "Cold cases", "Old cases come back right before you'd forget them. Answer from memory, no re-reading."));
    ctx.root.appendChild(sec);
    var queue = dueList().map(function (d) { return d.id; });
    if (!queue.length) { sec.appendChild(emptyReviews()); return null; }
    var prog = h("p", { class: "review-progress", "aria-live": "polite" });
    var stage = h("div", { class: "review-stage" });
    sec.appendChild(prog);
    sec.appendChild(stage);
    var idx = 0, graded = 0;
    function advance() { idx += 1; show(true); }
    function countGraded() { graded += 1; }
    function addNext(fb) {
      var last = idx >= queue.length - 1;
      var nextBtn = h("button", { class: "btn btn-primary", type: "button", text: last ? "Finish the shift" : "Next cold case" });
      nextBtn.addEventListener("click", advance);
      fb.appendChild(h("div", { class: "btn-row" }, nextBtn));
    }
    function show(focus) {
      if (!ctx.alive) return null;
      clear(stage);
      if (idx >= queue.length) {
        prog.textContent = "";
        stage.appendChild(shiftOver(graded));
        if (focus) focusFirst(stage, "h2");
        return null;
      }
      var id = queue[idx];
      prog.textContent = "Cold case " + (idx + 1) + " of " + queue.length;
      if (isDecisionId(id)) {
        stage.appendChild(decisionCard(id, countGraded, addNext));
        if (focus) focusFirst(stage, "h2");
        return null;
      }
      stage.appendChild(h("p", { class: "loading", role: "status", text: "Pulling the file..." }));
      return DL.content.loadCase(id).then(function (c) {
        if (!ctx.alive) return;
        clear(stage);
        stage.appendChild(reviewCard(c || {}, id, countGraded, addNext));
        if (focus) focusFirst(stage, "h2");
      }, function (err) {
        if (!ctx.alive) return;
        clear(stage);
        var skip = h("button", { class: "btn", type: "button", text: "Skip it for now" });
        skip.addEventListener("click", advance);
        stage.appendChild(h("div", { class: "inline-error" }, [
          h("p", { text: "This case file couldn't be opened. It stays in your queue for next time." }),
          h("pre", { class: "err-detail", text: errMsg(err) }),
          h("div", { class: "btn-row" }, skip)
        ]));
      });
    }
    return show(false);
  }

  /* ======================================================================
     View: seasons
     ====================================================================== */
  /* The season of the first open session of one course, on your plan (builds have no season). */
  function currentSeason(course) {
    var list = courseSessions(planOf(), course);
    for (var i = 0; i < list.length; i++) {
      if (list[i].kind === "build") continue;
      if (!isDone(list[i].id)) return list[i].season || null;
    }
    return null;
  }
  /* Interviews are always linked (the room needs no written case). Their chip says "ready" once they're due
     by syllabus order, and "after the cases" before that. */
  function seasonItem(it) {
    var info = sessionInfo(it);
    var isIv = info.kind === "interview";
    var done = isDone(it.id), canOpen = playable(info);
    var ready = isIv ? interviewOpen(it) : canOpen;
    var kind = isIv ? "Finale · 3 AM interview" : info.kind === "lld" ? "Low-level design" : info.setting;
    var rec = isIv ? interviewRec(it.id) : null;
    var doneText = isCredited(it.id) ? "Credited from LATENT"
      : "done ✓" + (rec && typeof rec.score === "number" && typeof rec.max === "number" ? " " + rec.score + "/" + rec.max : "");
    var stateText = ready ? "ready" : isIv ? "after the cases" : "being written";
    return h("li", { class: "season-item" }, [
      h("span", { class: "si-mark" + (done ? " done" : ready ? " ready" : ""), "aria-hidden": "true", text: done ? "✓" : ready ? "•" : "·" }),
      h("div", { class: "si-title" }, [
        canOpen ? link(info.title, routeFor(info)) : h("span", { text: info.title }),
        kind ? h("span", { class: "si-kind", text: kind }) : null
      ]),
      h("div", { class: "chips" }, [
        courseChip(info.course),
        h("span", { class: "chip" + (info.core ? " core" : ""), text: info.core ? "core" : "bonus" }),
        done ? h("span", { class: "chip ok", text: doneText }) : h("span", { class: "chip", text: stateText })
      ])
    ]);
  }
  /* One course's seasons, in plan order within each season (cases, then the finale interviews). Seasons are
     keyed by course and number, since both courses have a Season 1. Builds go to Projects, not here. */
  function courseSeasons(course, withHead) {
    var cid = course.id;
    var groups = {};
    courseSessions("all", cid).forEach(function (it) {
      if (it.kind === "build") return;
      var k = it.season || 0;
      (groups[k] = groups[k] || []).push(it);
    });
    var current = currentSeason(cid);
    var list = h("ol", { class: "seasons" });
    var seasons = (catalog().seasons || []).filter(function (se) { return se && courseOf(se) === cid; })
      .sort(function (a, b) { return a.n - b.n; });
    seasons.forEach(function (se) {
      var items = groups[se.n] || [];
      var coreItems = items.filter(function (it) { return sessionInfo(it).core; });
      var doneAll = items.filter(function (it) { return isDone(it.id); }).length;
      var solved = coreItems.length > 0 && coreItems.every(function (it) { return isDone(it.id); });
      var here = !solved && se.n === current;
      var chip = solved ? h("span", { class: "chip ok", text: "Solved" })
        : here ? h("span", { class: "chip warn", text: "You are here" })
        : h("span", { class: "chip", text: doneAll ? doneAll + " of " + items.length + " closed" : plural(items.length, "session") });
      list.appendChild(h("li", { class: "season-block" + (solved ? " solved" : here ? " here" : "") }, [
        h("div", { class: "season-head" }, [
          h("span", { class: "s-n", text: "S" + se.n }),
          h("div", null, [
            h(withHead ? "h3" : "h2", { md: se.title || "Season " + se.n }),
            se.rank ? h("p", { class: "s-rank", text: se.rank }) : null,
            se.blurb ? h("p", { class: "s-blurb", md: se.blurb }) : null
          ]),
          chip
        ]),
        items.length ? h("ul", { class: "season-items" }, items.map(seasonItem))
          : h("p", { class: "season-empty", text: "Cases for this season are being written." })
      ]));
    });
    if (groups[0] && groups[0].length) {
      list.appendChild(h("li", { class: "season-block" }, [
        h("div", { class: "season-head" }, [h("span", { class: "s-n", text: "+" }), h("div", null, h(withHead ? "h3" : "h2", { text: "More sessions" }))]),
        h("ul", { class: "season-items" }, groups[0].map(seasonItem))
      ]));
    }
    if (!withHead) return list;
    var hid = nextId("course");
    return h("section", { class: "course-group", "data-course": cid, "aria-labelledby": hid }, [
      h("header", { class: "course-head" }, [
        h("h2", { id: hid, text: course.title || cid }),
        course.board ? h("span", { class: "course-board", text: course.board }) : null,
        course.tagline ? h("p", { class: "course-tag", text: course.tagline }) : null
      ]),
      list
    ]);
  }

  /* Projects (contract 9.9): each project with its milestones and their state. */
  function projectList() {
    var cat = catalog();
    var builds = (cat.builds || []).filter(Boolean);
    if (Array.isArray(cat.projects) && cat.projects.length) return cat.projects.filter(Boolean);
    var list = [], seen = {};
    builds.forEach(function (m) {
      if (!m.project || seen[m.project]) return;
      seen[m.project] = true;
      list.push({
        project: m.project, title: m.projectTitle || m.project, repo: m.repo || m.project, language: "", pitch: "",
        milestones: builds.filter(function (x) { return x.project === m.project; }).map(function (x) { return x.id; })
      });
    });
    return list;
  }
  /* "locked", "ready", "verified" (done, tag found on GitHub) or "self" (done, self-reported). */
  function milestoneState(id) {
    var rec = buildRec(id);
    if (rec.done) return rec.verified ? "verified" : "self";
    return buildUnlocked(id) ? "ready" : "locked";
  }
  var MILESTONE_TEXT = { locked: "locked", ready: "ready", verified: "done ✓ verified", self: "done ✓ self-reported" };
  function milestoneItem(m) {
    var st = milestoneState(m.id);
    var done = st === "verified" || st === "self";
    return h("li", { class: "season-item milestone" }, [
      h("span", { class: "si-mark" + (done ? " done" : st === "ready" ? " ready" : ""), "aria-hidden": "true", text: done ? "✓" : st === "ready" ? "•" : "·" }),
      h("div", { class: "si-title" }, [
        link(m.title || m.id, "build/" + m.id),
        h("span", { class: "si-kind", text: m.id + " · Build Night · " + (m.minutes || 75) + " min" })
      ]),
      h("div", { class: "chips" }, [
        courseChip(courseOf(m)),
        h("span", { class: "chip" + (done ? " ok" : ""), text: MILESTONE_TEXT[st] })
      ])
    ]);
  }
  function projectsSection() {
    var blocks = [];
    projectList().forEach(function (p) {
      var ms = (p.milestones || []).map(function (id) { return buildMeta(id); })
        .filter(function (m) { return m && boardShows(courseOf(m)); });
      if (!ms.length) return;
      var doneN = ms.filter(function (m) { return !!buildRec(m.id).done; }).length;
      var all = doneN === ms.length;
      var title = p.title || p.project || "Project";
      blocks.push(h("li", { class: "season-block project-block" + (all ? " solved" : "") }, [
        h("div", { class: "season-head" }, [
          h("span", { class: "s-n", "aria-hidden": "true", text: title.charAt(0).toUpperCase() }),
          h("div", null, [
            h("h3", { text: title }),
            p.language || p.repo ? h("p", { class: "s-rank", text: [p.language, p.repo ? "repo " + p.repo : ""].filter(Boolean).join(" · ") }) : null,
            p.pitch ? h("p", { class: "s-blurb", md: p.pitch }) : null
          ]),
          h("span", { class: "chip" + (all ? " ok" : ""), text: all ? "All done" : doneN + " of " + ms.length + " done" })
        ]),
        h("ul", { class: "season-items" }, ms.map(milestoneItem))
      ]));
    });
    if (!blocks.length) return null;
    return h("section", { class: "course-group projects", "aria-labelledby": "proj-h" }, [
      h("header", { class: "course-head" }, [
        h("h2", { id: "proj-h", text: "Projects" }),
        h("p", { class: "course-tag", text: "Build Nights: real code on weekends, in your own GitHub repos. A milestone unlocks when its cases are closed." })
      ]),
      h("ol", { class: "seasons" }, blocks)
    ]);
  }

  function viewSeasons(ctx) {
    ctx.rerender = true;
    var plan = planOf(), multi = multiCourse();
    var sec = h("section", { class: "wrap section" }, head("The full run", "Seasons",
      "Every case in order. Core cases cover what interviews and day-to-day work need; bonus cases go deeper and stay open after your date. Your plan: " +
      (plan === "all" ? "everything." : "core only.") + (multi ? " Dead Letter first, then LATENT, then the Build Night projects." : "")));
    var note = filterNote();
    if (note) sec.appendChild(note);
    if (!multi) {
      sec.appendChild(courseSeasons(courseList()[0], false));
    } else {
      courseList().filter(function (c) { return boardShows(c.id); }).forEach(function (c) {
        sec.appendChild(courseSeasons(c, true));
      });
    }
    var projects = projectsSection();
    if (projects) sec.appendChild(projects);
    ctx.root.appendChild(sec);
    return null;
  }

  /* ======================================================================
     View: rulebook
     ====================================================================== */
  function setReason(el, tag, reason) {
    clear(el);
    if (tag) { el.appendChild(h("span", { class: "tag", md: tag })); el.appendChild(doc.createTextNode(" ")); }
    el.appendChild(h("span", { md: reason || "" }));
  }
  function fillReason(el, rule, caseId, ctx) {
    var reason = rule.why || rule.reason || "";
    if (reason) { setReason(el, rule.tag || rule.title || "", reason); return; }
    el.textContent = "Pulling the reason from the case file...";
    DL.content.loadCase(caseId).then(function (c) {
      if (!ctx.alive) return;
      var ex = (c && c.explain) || {};
      var tag = ex.fix && ex.fix.title ? capFirst(String(ex.fix.title).replace(/^the fix:\s*/i, "").replace(/\.$/, "")) + "." : "";
      setReason(el, tag, ex.seniorTake || ex.oneLine || "");
    }, function () {
      if (ctx.alive) el.textContent = "The case file couldn't be opened just now.";
    });
  }
  function redaction(n) {
    var a = 22 + (n * 17) % 26, b = 14 + (n * 29) % 30;
    var wrap = h("div", { class: "redacted", role: "img", "aria-label": "Reason hidden until you close this rule's case" });
    [a, b].forEach(function (w) { var sp = h("span"); sp.style.width = w + "%"; wrap.appendChild(sp); });
    return wrap;
  }
  function viewRules(ctx) {
    ctx.rerender = true;
    var t = today();
    var rules = (catalog().rules || []).slice().sort(function (a, b) { return a.n - b.n; });
    var sec = h("section", { class: "wrap section" }, head("Your rulebook", "The rules, and why they exist",
      "Every rule on the note is a real engineering practice. You earn the reason by closing its case. Rules you don't revisit start to fade."));
    if (!rules.length) sec.appendChild(h("p", { class: "muted", text: "The rulebook is empty for now." }));
    var ol = h("ol", { class: "rulebook" });
    rules.forEach(function (rule) {
      var caseId = rule["case"];
      var meta = metaFor(caseId) || {};
      var done = isDone(caseId), card = cardFor(caseId), fading = done && isFading(caseId);
      var due = false;
      try { due = !!card && DL.sched.isDue(card, t); } catch (e) { due = false; }
      var body = h("div", null, h("p", { class: "rule-text", md: rule.text || "" }));
      var status = h("div", { class: "rule-status" });
      if (done) {
        var why = h("p", { class: "rule-why" });
        fillReason(why, rule, caseId, ctx);
        body.appendChild(why);
        if (fading) {
          status.appendChild(h("span", { class: "chip warn", text: "fading" }));
        } else {
          var txt = "Solved" + (meta.season ? " in Season " + meta.season : "");
          if (card) txt += due ? " · review due" : " · next review " + DL.sched.nextReviewText(card, t);
          status.appendChild(h("span", { class: "chip ok", text: txt }));
        }
        if (due) status.appendChild(link("Review it now", "reviews", "btn btn-small"));
        status.appendChild(link("Reread the case", "case/" + caseId, "btn btn-small btn-ghost"));
      } else {
        body.appendChild(redaction(Number(rule.n) || 1));
        status.appendChild(h("span", { class: "chip", text: meta.season ? "Unlocks in Season " + meta.season : "Unlocks later" }));
      }
      body.appendChild(status);
      ol.appendChild(h("li", { class: "rule " + (done ? (fading ? "fading" : "known") : "locked") }, [
        h("span", { class: "rule-n", text: String(rule.n) }),
        body
      ]));
    });
    sec.appendChild(ol);
    ctx.root.appendChild(sec);
    return null;
  }

  /* ======================================================================
     View: evidence board (an SVG built here, columns by season)
     ====================================================================== */
  /* Closed cases with a case file, on the boards the switcher shows. Interviews are marked done in `cases` too,
     but pin nothing; builds live in state.builds and pin nothing either. */
  function doneCaseIds() {
    var cases = state().cases || {};
    var ids = sessionsFor("all").filter(function (it) { return it.kind !== "interview" && it.kind !== "build"; })
      .map(function (it) { return it.id; }).filter(function (id) { return cases[id] && cases[id].done; });
    Object.keys(cases).sort().forEach(function (id) {
      if (cases[id] && cases[id].done && ids.indexOf(id) < 0 && metaFor(id) && !interviewMeta(id) && !findIn(catalog().builds, id)) ids.push(id);
    });
    return ids.filter(function (id) { return boardShows(courseOf(metaFor(id))); });
  }
  function boardColLabel(course, season) {
    if (!season) return course === "lt" ? "LATENT MORE" : "MORE";
    return (course === "lt" ? "LATENT SEASON " : "SEASON ") + season;
  }
  function boardSeasonText(course, season) {
    if (!season) return course === "lt" ? "LATENT" : "";
    return course === "lt" ? "LATENT S" + season : "Season " + season;
  }
  function wrapText(text, max) {
    var words = String(text || "").split(/\s+/).filter(Boolean), lines = [], cur = "";
    words.forEach(function (w) {
      while (w.length > max) { if (cur) { lines.push(cur); cur = ""; } lines.push(w.slice(0, max)); w = w.slice(max); }
      if (!cur) cur = w;
      else if ((cur + " " + w).length <= max) cur += " " + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    if (lines.length > 2) lines = [lines[0], (lines[1].length > max - 3 ? lines[1].slice(0, max - 3) : lines[1]) + "..."];
    return lines.length ? lines : [""];
  }
  function tilt(id) {
    var hsh = 0;
    for (var i = 0; i < id.length; i++) hsh = (hsh * 31 + id.charCodeAt(i)) % 997;
    return ((hsh % 41) / 10 - 2).toFixed(1);
  }
  function drawBoard(sec, cases) {
    var cards = {}, order = [], strings = [], seen = {};
    cases.forEach(function (c) {
      var fading = isFading(c.id);
      var course = courseOf(metaFor(c.id) || c);
      ((c.board || {}).cards || []).forEach(function (k) {
        if (!k || !k.id || cards[k.id]) return;
        cards[k.id] = { id: k.id, title: k.title || k.id, season: Number(c.season) || 0, course: course, caseId: c.id, fading: fading };
        order.push(k.id);
      });
    });
    cases.forEach(function (c) {
      ((c.board || {}).strings || []).forEach(function (st) {
        if (!st || !cards[st.from] || !cards[st.to] || st.from === st.to) return;
        var key = [st.from, st.to].sort().join("|");
        if (seen[key]) return;
        seen[key] = true;
        strings.push({ from: st.from, to: st.to, label: st.label || "" });
      });
    });
    if (!order.length) { sec.appendChild(h("p", { class: "muted", text: "These cases don't pin any cards yet." })); return; }

    var CW = 160, GAPX = 90, ROWH = 96, TOP = 46, PAD = 24;
    // One column per course and season (both courses have a Season 1): Dead Letter's first, then LATENT's.
    var seasons = [];
    function colKey(cd) { return cd.course + ":" + cd.season; }
    order.forEach(function (id) { if (seasons.indexOf(colKey(cards[id])) < 0) seasons.push(colKey(cards[id])); });
    seasons.sort(function (a, b) {
      var pa = a.split(":"), pb = b.split(":");
      var ra = courseRank(pa[0]), rb = courseRank(pb[0]);
      if (ra !== rb) return ra - rb;
      return Number(pa[1]) - Number(pb[1]);
    });
    var counts = {}, rowsMax = 1;
    order.forEach(function (id) {
      var cd = cards[id];
      var key = colKey(cd);
      cd.col = seasons.indexOf(key);
      cd.row = counts[key] || 0;
      counts[key] = cd.row + 1;
      rowsMax = Math.max(rowsMax, cd.row + 1);
      cd.lines = wrapText(cd.title, 19);
      cd.h = cd.lines.length > 1 ? 66 : 56;
    });
    var natW = PAD * 2 + seasons.length * CW + (seasons.length - 1) * GAPX;
    var W = Math.max(natW, 480), offX = (W - natW) / 2;
    var H = TOP + 40 + (rowsMax - 1) * ROWH + 33 + 22;
    order.forEach(function (id) {
      var cd = cards[id];
      cd.cx = offX + PAD + CW / 2 + cd.col * (CW + GAPX);
      cd.cy = TOP + 40 + cd.row * ROWH;
    });
    var fadingCount = order.filter(function (id) { return cards[id].fading; }).length;
    var svg = s("svg", {
      viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Evidence board: " + plural(order.length, "card") + " from " +
        plural(cases.length, "closed case") + ", joined by " + plural(strings.length, "string") + (fadingCount ? ". " + fadingCount + " fading." : ".")
    });
    if (svg.style) { svg.style.minWidth = Math.min(W, 620) + "px"; svg.style.maxWidth = W + "px"; }
    svg.appendChild(s("rect", { class: "bd-cork", x: 0, y: 0, width: W, height: H, rx: 10 }));
    seasons.forEach(function (key, i) {
      var parts = key.split(":");
      svg.appendChild(s("text", { class: "bd-col", x: offX + PAD + CW / 2 + i * (CW + GAPX), y: TOP - 18, "text-anchor": "middle" }, boardColLabel(parts[0], Number(parts[1]) || 0)));
    });
    var gS = s("g", { class: "bd-strings" }), gC = s("g", { class: "bd-cards" }), gL = s("g", { class: "bd-labels" });
    strings.forEach(function (st) {
      var a = cards[st.from], b = cards[st.to], lx, ly, anchor = "middle";
      if (a.col === b.col) {
        var top = a.cy < b.cy ? a : b, bot = a.cy < b.cy ? b : a;
        if (bot.row - top.row === 1) {
          gS.appendChild(s("line", { class: "bd-string", x1: a.cx, y1: top.cy, x2: a.cx, y2: bot.cy }));
          lx = a.cx + 8; ly = (top.cy + top.h / 2 + bot.cy - bot.h / 2) / 2 + 4; anchor = "start";
        } else {
          var ex = a.cx + CW / 2, bulge = ex + 28 + Math.min(30, (bot.row - top.row) * 8), my = (top.cy + bot.cy) / 2;
          gS.appendChild(s("path", { class: "bd-string", d: "M" + ex + "," + top.cy + " Q" + bulge + "," + my + " " + ex + "," + bot.cy }));
          lx = (ex + bulge) / 2 + 6; ly = my + 4; anchor = "start";
        }
      } else {
        gS.appendChild(s("line", { class: "bd-string", x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy }));
        lx = (a.cx + b.cx) / 2; ly = (a.cy + b.cy) / 2 - 6;
      }
      if (st.label) gL.appendChild(s("text", { class: "bd-lbl", x: lx, y: ly, "text-anchor": anchor }, st.label));
    });
    order.forEach(function (id) {
      var cd = cards[id];
      var x0 = cd.cx - CW / 2, y0 = cd.cy - cd.h / 2;
      var g = s("g", { class: "bd-card" + (cd.fading ? " fading" : ""), transform: "rotate(" + tilt(id) + " " + cd.cx + " " + cd.cy + ")" }, [
        s("title", null, cd.title + (cd.fading ? " (fading: its cold case is overdue)" : "")),
        s("rect", { x: x0, y: y0, width: CW, height: cd.h, rx: 3 }),
        s("circle", { class: "bd-pin", cx: cd.cx, cy: y0 + 6, r: 5 })
      ]);
      var ty = cd.lines.length > 1 ? cd.cy - 6 : cd.cy + 2;
      cd.lines.forEach(function (ln, i) { g.appendChild(s("text", { class: "bd-title", x: cd.cx, y: ty + i * 15, "text-anchor": "middle" }, ln)); });
      g.appendChild(s("text", { class: "bd-sub", x: cd.cx, y: y0 + cd.h - 9, "text-anchor": "middle" }, (cd.fading ? "fading · " : "") + boardSeasonText(cd.course, cd.season)));
      if (cd.fading) {
        var kx = x0 + CW - 10, ky = y0 + 3;
        var pts = [[kx, ky], [kx - 5, ky + 8], [kx - 1, ky + 15], [kx - 6, ky + 23]].map(function (pt) { return pt[0] + "," + pt[1]; }).join(" ");
        g.appendChild(s("polyline", { class: "bd-crack", points: pts }));
      }
      gC.appendChild(g);
    });
    svg.appendChild(gS);
    svg.appendChild(gC);
    svg.appendChild(gL);

    sec.appendChild(h("figure", { class: "board" }, [
      h("div", { class: "scroll-x" }, svg),
      h("figcaption", null, [
        "Red string means “these explain each other.” A dashed, cracked card is fading: its cold case is overdue.",
        fadingCount ? [" ", link("Open the cold cases", "reviews")] : null
      ])
    ]));
    sec.appendChild(h("details", { class: "terms board-list" }, [
      h("summary", { text: "Read the board as a list" }),
      h("ul", null, order.map(function (id) {
        var cd = cards[id];
        var out = strings.filter(function (st) { return st.from === id; }).map(function (st) {
          return (st.label ? st.label + " → " : "→ ") + cards[st.to].title;
        });
        var where = boardSeasonText(cd.course, cd.season);
        return h("li", null, [
          h("strong", { text: cd.title }),
          (where ? " · " + where : "") + (cd.fading ? " · fading" : "") + (out.length ? ". " + out.join("; ") : "")
        ]);
      }))
    ]));
  }
  function viewBoard(ctx) {
    ctx.rerender = true;
    var sec = h("section", { class: "wrap section" }, head("Evidence board", "How it all connects",
      "Every case you close pins its cards and red string here. Ideas that connect to other ideas are the ones that last."));
    var note = filterNote();
    if (note) sec.appendChild(note);
    ctx.root.appendChild(sec);
    var ids = doneCaseIds();
    if (!ids.length) {
      sec.appendChild(h("p", { class: "muted", text: note
        ? "Nothing pinned from " + courseTitle(S.board) + " yet. Close one of its cases and its cards go up here."
        : "Nothing pinned yet. Close your first case and its cards go up here." }));
      return null;
    }
    var loading = h("p", { class: "loading", role: "status", text: "Pinning the cards..." });
    sec.appendChild(loading);
    return Promise.all(ids.map(function (id) {
      return Promise.resolve().then(function () { return DL.content.loadCase(id); }).then(function (c) {
        if (c && !c.id) c.id = id;
        return c;
      }, function () { return null; });
    })).then(function (cases) {
      if (!ctx.alive) return;
      removeNode(loading);
      drawBoard(sec, cases.filter(Boolean));
    });
  }

  /* ======================================================================
     View: notes
     ====================================================================== */
  function viewNotes(ctx) {
    ctx.rerender = true;
    var notes = state().notes || {};
    var ids = Object.keys(notes).filter(function (id) { return notes[id] && notes[id].text; }).sort(function (a, b) {
      var da = notes[a].d || "", db = notes[b].d || "";
      if (da !== db) return da < db ? 1 : -1;
      return a < b ? -1 : 1;
    });
    var sec = h("section", { class: "wrap section" }, head("Your notes", "Notes", "Your own explanations, newest first."));
    if (!ids.length) {
      sec.appendChild(h("p", { class: "muted", text: "No notes yet. Each case ends with an optional box to explain it in your own words. Those land here." }));
    } else {
      sec.appendChild(h("ol", { class: "notes-list" }, ids.map(function (id) {
        var meta = metaFor(id) || {};
        return h("li", { class: "note-item" }, [
          h("div", { class: "note-head" }, [
            link(meta.title || id, "case/" + id),
            notes[id].d ? h("span", { class: "muted small", text: fmtDate(notes[id].d) }) : null
          ]),
          h("p", { class: "note-text", text: String(notes[id].text) })
        ]);
      })));
    }
    ctx.root.appendChild(sec);
    return null;
  }

  /* ======================================================================
     View: 3 AM interview  #interview/<id>
     The interview runs in Claude (the room artifact, or a text-only
     prompt); the learner brings back the result code DL-I-<id>-<n>/<max>.
     ====================================================================== */
  /* The room template, fetched once per page load and kept. */
  function loadRoom() {
    if (S.room) return Promise.resolve(S.room);
    if (S.roomP) return S.roomP;
    var f = root.fetch;
    if (typeof f !== "function") return Promise.reject(new Error("This browser can't load the interview room."));
    var p = Promise.resolve().then(function () { return f.call(root, ROOM_PATH); }).then(function (res) {
      if (!res || res.ok === false) throw new Error("The interview room couldn't be loaded (" + ROOM_PATH + (res && res.status ? ", HTTP " + res.status : "") + ").");
      return res.text();
    }).then(function (text) {
      text = String(text || "");
      if (!text.trim()) throw new Error("The interview room file is empty.");
      S.room = text;
      return text;
    });
    S.roomP = p;
    p.then(function () { if (S.roomP === p) S.roomP = null; }, function () { if (S.roomP === p) S.roomP = null; });
    return p;
  }
  /* One pass over the template, so a filled value is never filled again. Title and level land in HTML text,
     so they are escaped; the id lands in JS strings too and is kept to [A-Za-z0-9_-]. */
  function fillRoom(html, iv, level) {
    var values = {
      INTERVIEW_ID: String(iv.id || "").replace(/[^A-Za-z0-9_-]/g, ""),
      INTERVIEW_TITLE: escapeHtml(iv.title || iv.id || ""),
      LEVEL: escapeHtml(level || ""),
      SEASON: escapeHtml(typeof iv.season === "number" ? String(iv.season) : "")
    };
    return String(html).replace(/\{\{(INTERVIEW_ID|INTERVIEW_TITLE|LEVEL|SEASON)\}\}/g, function (m, k) { return values[k]; });
  }
  function attemptsOf(id) {
    var rec = interviewRec(id);
    if (!rec || typeof rec !== "object") return [];
    var list = Array.isArray(rec.tries) && rec.tries.length ? rec.tries.slice()
      : typeof rec.score === "number" ? [{ score: rec.score, max: rec.max, d: rec.d }] : [];
    return list.filter(function (a) { return a && typeof a.score === "number"; }).reverse();   // newest first
  }
  /* Stores the latest attempt as { score, max, d } (core's merge keeps the newer one) with a short history in
     `tries`, and marks the session done the way closing a case does. Resolves false for a repeat paste. */
  function saveInterview(id, score, max) {
    var t = today(), repeat = false;
    return Promise.resolve(DL.store.update(function (d) {
      d.interviews = d.interviews || {};
      var prev = d.interviews[id];
      var tries = prev && Array.isArray(prev.tries) ? prev.tries.slice()
        : prev && typeof prev.score === "number" ? [{ score: prev.score, max: prev.max, d: prev.d }] : [];
      var last = tries[tries.length - 1];
      if (last && last.score === score && last.max === max && last.d === t) { repeat = true; return; }
      tries.push({ score: score, max: max, d: t });
      if (tries.length > 12) tries = tries.slice(-12);
      d.interviews[id] = { score: score, max: max, d: t, tries: tries };
      d.cases = d.cases || {};
      var r = d.cases[id] || (d.cases[id] = {});
      if (!r.done) {
        r.done = t;
        var day = dayRec(d, t);
        day.sessions = (day.sessions || 0) + 1;
      }
    })).then(function () { return !repeat; });
  }
  function attemptsEl(id) {
    var list = attemptsOf(id);
    if (!list.length) return h("p", { class: "muted small", text: "No attempts yet. Your scores land here." });
    return h("ol", { class: "attempts" }, list.map(function (a) {
      return h("li", null, [
        h("span", { class: "attempt-score", text: a.score + "/" + (typeof a.max === "number" ? a.max : "?") }),
        h("span", { class: "muted", text: isIso(a.d) ? fmtDate(a.d) : "" })
      ]);
    }));
  }
  function viewInterview(ctx) {
    var iv = interviewMeta(ctx.arg);
    if (!iv) {
      ctx.root.appendChild(messagePanel("Not on file", "There's no interview called “" + ctx.arg + "”.", null));
      return null;
    }
    var id = iv.id;
    var course = courseOf(iv);
    setCourse(ctx, course);
    var season = typeof iv.season === "number" ? iv.season : null;
    var se = season ? seasonMeta(season, course) : null;
    var level = (se && se.rank) || "";
    var sec = h("section", { class: "wrap section" });
    var crumbs = h("div", { class: "case-crumbs" }, [
      link("Seasons", "seasons"),
      h("span", { "aria-hidden": "true", text: "/" }),
      h("span", { text: (season ? "Season " + season + " finale" : "Finale") + " · 3 AM interview · about 45 min" }),
      courseChip(course),
      h("span", { class: "chip" + (iv.core ? " core" : ""), text: iv.core ? "core" : "bonus" })
    ]);
    var doneChip = h("span", { class: "chip ok", text: "done", hidden: !isDone(id) });
    crumbs.appendChild(doneChip);
    sec.appendChild(crumbs);
    sec.appendChild(h("header", { class: "sec-head" }, [
      h("h1", { md: iv.title || id }),
      level ? h("p", { class: "iv-level", text: "Level: " + level }) : null
    ]));

    var steps = h("ol", { class: "iv-steps" }, [
      h("li", null, [h("strong", { text: "Open the room in Claude." }), " The first button below copies it. Paste it into claude.ai or the Claude app, on any account."]),
      h("li", null, [h("strong", { text: "Do the interview." }), " About 45 minutes. Claude plays the interviewer and scores you at the end."]),
      h("li", null, [h("strong", { text: "Paste your result code here." }), " It's the last line Claude gives you, like DL-I-" + id + "-21/28."])
    ]);

    var roomBtn = h("button", { class: "btn btn-primary btn-copy", type: "button", text: "Open the interview room in Claude" });
    var textBtn = h("button", { class: "btn btn-copy", type: "button", text: "Copy a text-only interview" });
    var copyStatus = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    var fallback = copyField("Interview text to copy");
    function roomText(html) { return ROOM_ASK + fillRoom(html, iv, level) + "\n```"; }
    roomBtn.addEventListener("click", function () {
      var o = { field: fallback, status: copyStatus, btn: roomBtn, hideField: true, ok: ROOM_COPIED };
      if (S.room) { copyText(roomText(S.room), o); return; }   // cached: the copy stays inside the click
      copyStatus.textContent = "Fetching the room...";
      copyStatus.classList.remove("ok", "bad");
      roomBtn.disabled = true;
      loadRoom().then(function (html) {
        roomBtn.disabled = false;
        if (ctx.alive) copyText(roomText(html), o);
      }, function (err) {
        roomBtn.disabled = false;
        if (!ctx.alive) return;
        copyStatus.textContent = errMsg(err) + " Try again, or copy the text-only interview.";
        copyStatus.classList.remove("ok");
        copyStatus.classList.add("bad");
      });
    });
    textBtn.addEventListener("click", function () {
      if (!DL.prompts || typeof DL.prompts.interview !== "function") {
        copyStatus.textContent = "The interview text isn't available. Reload the page and try again.";
        return;
      }
      var text = DL.prompts.interview({ id: id, title: iv.title || id, season: season, rubric: iv.rubric });
      copyText(text, { field: fallback, status: copyStatus, btn: textBtn, hideField: true,
        ok: "Copied. Paste it into claude.ai or the Claude app (any account) to start the interview." });
    });
    sec.appendChild(h("div", { class: "iv-room" }, [
      steps,
      h("div", { class: "btn-row" }, [roomBtn, textBtn]),
      copyStatus,
      fallback,
      h("p", { class: "dim-line" }, ["or run it in Claude Code with ", h("code", { text: "/interview " + id })])
    ]));

    // the result code
    var pid = nextId("ivcode");
    var paste = h("textarea", { id: pid, class: "paste-field", rows: "2", spellcheck: "false", autocomplete: "off", placeholder: "DL-I-" + id + "-21/28" });
    var saveBtn = h("button", { class: "btn btn-primary", type: "button", text: "Save my result" });
    var msg = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    var attemptsHost = h("div", null, attemptsEl(id));
    function say(t, tone) {
      msg.textContent = t;
      msg.classList.remove("ok", "bad");
      if (tone) msg.classList.add(tone);
    }
    saveBtn.addEventListener("click", function () {
      var raw = paste.value;
      if (!raw.trim()) { say("Paste your result code first.", "bad"); paste.focus(); return; }
      var r = DL.prompts && typeof DL.prompts.parseCode === "function" ? DL.prompts.parseCode(raw) : null;
      if (!r) { say("No result code found. The interview ends with a line like DL-I-" + id + "-21/28.", "bad"); return; }
      if (r.kind !== "interview") { say("That's a grading code for a case answer. Paste it under that answer instead.", "bad"); return; }
      if (!sameId(r.id, id)) { say("That code is for interview " + r.id + ", not this one.", "bad"); return; }
      saveBtn.disabled = true;
      saveInterview(id, r.score, r.max).then(function (isNew) {
        saveBtn.disabled = false;
        if (!ctx.alive) return;
        paste.value = "";
        say(isNew ? "Saved: " + r.score + "/" + r.max + ". This session is marked done." : "That result is already saved.", "ok");
      }, function (err) {
        saveBtn.disabled = false;
        if (ctx.alive) say("Couldn't save: " + errMsg(err), "bad");
      });
    });
    sec.appendChild(h("div", { class: "block" }, [
      h("h2", { class: "part-head", text: "Your result" }),
      h("label", { class: "field-k", for: pid, text: "Paste your result code" }),
      paste,
      h("div", { class: "btn-row" }, saveBtn),
      msg,
      h("h3", { text: "Past attempts" }),
      attemptsHost
    ]));
    sec.appendChild(h("div", { class: "btn-row mt" }, [link("Back to tonight", "tonight", "btn"), link("Seasons", "seasons", "btn btn-ghost")]));

    ctx.onProgress = function () {
      clear(attemptsHost);
      attemptsHost.appendChild(attemptsEl(id));
      doneChip.hidden = !isDone(id);
    };
    ctx.root.appendChild(sec);
    loadRoom().then(null, function () { /* the button tries again and says what went wrong */ });
    return null;
  }

  /* ======================================================================
     View: Build Night  #build/<id>  (contract 9.6 and 9.9)
     The GitHub check runs only when Verify on GitHub is pressed: never on
     load, never in a loop. Done-when ticks live in this browser only.
     ====================================================================== */
  function loadChecks(id, n) {
    var arr = null;
    try { arr = JSON.parse(lsGet(CHECKS_KEY + id) || "null"); } catch (e) { arr = null; }
    var out = [];
    for (var i = 0; i < n; i++) out.push(!!(Array.isArray(arr) && arr[i]));
    return out;
  }
  function saveChecks(id, list) {
    var raw = "[]";
    try { raw = JSON.stringify(list); } catch (e) { raw = "[]"; }
    lsSet(CHECKS_KEY + id, raw);
  }
  /* The spec: paragraphs split on blank lines, each line through DL.util.md; consecutive lines starting "- "
     become one bullet list. Nothing else is formatted. */
  function specEls(text) {
    var out = [];
    String(text || "").split(/\n\s*\n/).forEach(function (para) {
      var plain = [], items = null;
      function flushPlain() { if (plain.length) { out.push(h("p", { md: plain.join(" ") })); plain = []; } }
      function flushItems() { if (items) { out.push(h("ul", null, items)); items = null; } }
      para.split("\n").forEach(function (line) {
        var t = line.trim();
        if (!t) return;
        if (t.indexOf("- ") === 0) {
          flushPlain();
          (items || (items = [])).push(h("li", { md: t.slice(2).trim() }));
        } else {
          flushItems();
          plain.push(t);
        }
      });
      flushPlain();
      flushItems();
    });
    return out;
  }
  function codeEl(text) { return h("code", { class: "inline-code", text: text }); }
  /* A first mark done counts as one of tonight's sessions, like closing a case, so the pace plan sees it. */
  function countBuildSession() {
    var t = today();
    return Promise.resolve(DL.store.update(function (d) {
      var day = dayRec(d, t);
      day.sessions = (day.sessions || 0) + 1;
    }));
  }

  function viewBuild(ctx) {
    var m = buildMeta(ctx.arg);
    if (!m) {
      ctx.root.appendChild(messagePanel("Not on file", "There's no Build Night called “" + ctx.arg + "”.", null));
      return null;
    }
    var id = m.id;
    setCourse(ctx, courseOf(m));
    var proj = projectOf(m);
    var projTitle = proj.title || m.projectTitle || m.project || "Project";
    var repo = String(m.repo || proj.repo || m.project || "");
    var tag = String(m.tag || "");
    var minutes = m.minutes || 75;
    var sec = h("section", { class: "wrap section build-view" });

    // crumbs and heading: project, pitch, milestone, minutes
    var stateChip = h("span", { class: "chip" });
    sec.appendChild(h("div", { class: "case-crumbs" }, [
      link("Seasons", "seasons"),
      h("span", { "aria-hidden": "true", text: "/" }),
      h("span", { text: "Build Night · " + id + " · " + minutes + " min · weekend" }),
      courseChip(courseOf(m)),
      stateChip
    ]));
    sec.appendChild(h("header", { class: "sec-head" }, [
      h("p", { class: "eyebrow", text: "Build Night · " + projTitle }),
      h("h1", { md: m.title || id }),
      proj.pitch ? h("p", { class: "lede", md: proj.pitch }) : null,
      h("p", { class: "build-meta", text: [projTitle, proj.language, repo ? "repo " + repo : "", minutes + " minutes"].filter(Boolean).join(" · ") })
    ]));

    // unlock status: the cases still needed, linked
    var unlockBox = h("div", { class: "build-unlock" });
    function caseTitle(cid) { return (metaFor(cid) || {}).title || cid; }
    function renderUnlock() {
      clear(unlockBox);
      var needs = Array.isArray(m.unlockAfter) ? m.unlockAfter : [];
      var missing = needs.filter(function (cid) { return !isDone(cid); });
      unlockBox.setAttribute("data-state", missing.length ? "locked" : "ready");
      if (!missing.length) {
        unlockBox.appendChild(h("p", null, [
          h("strong", { text: "Unlocked." }),
          needs.length ? " You've closed " + joinList(needs.map(caseTitle)) + "." : ""
        ]));
        return;
      }
      unlockBox.appendChild(h("p", null, [
        h("strong", { text: "Locked." }),
        " Close " + (missing.length === 1 ? "this case" : "these cases") + " first. You can read the whole plan now."
      ]));
      unlockBox.appendChild(h("ul", { class: "unlock-list" }, missing.map(function (cid) {
        var mm = metaFor(cid) || {};
        var where = [
          mm.season ? (courseOf(mm) === "lt" ? "LATENT Season " : "Season ") + mm.season : "",
          mm.status === "ready" ? "" : "being written"
        ].filter(Boolean).join(" · ");
        return h("li", null, [link(mm.title || cid, "case/" + cid), where ? h("span", { class: "muted small", text: " (" + where + ")" }) : null]);
      })));
    }
    sec.appendChild(unlockBox);

    // the spec
    sec.appendChild(h("div", { class: "block" }, [
      h("h2", { class: "build-h", text: "The spec" }),
      h("div", { class: "spec" }, specEls(m.spec))
    ]));

    // the prompt pack: read-only, copied inside the click, or selected for a copy by hand
    var packText = String(m.promptPack || "");
    var pack = h("pre", { class: "prompt-pack", tabindex: "0", role: "region", "aria-label": "Prompt pack (read-only)", text: packText });
    var copyBtn = h("button", { class: "btn btn-primary btn-copy", type: "button", text: "Copy prompt pack" });
    var copyStatus = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    copyBtn.addEventListener("click", function () {
      function fallback() {
        copyBtn.removeAttribute("data-copied");
        if (selectNodeText(pack)) sayTo(copyStatus, SELECT_HINT, "");
        else sayTo(copyStatus, "Copying isn't allowed in this browser. Select the text above by hand.", "bad");
      }
      var clip = root.navigator && root.navigator.clipboard;
      if (!clip || typeof clip.writeText !== "function") { fallback(); return; }
      try {
        Promise.resolve(clip.writeText(packText)).then(function () {
          copyBtn.setAttribute("data-copied", "true");
          sayTo(copyStatus, "Copied. Paste it into Claude Code in an empty folder for this repo.", "ok");
        }, fallback);
      } catch (e) {
        fallback();
      }
    });
    sec.appendChild(h("div", { class: "block" }, [
      h("h2", { class: "build-h", text: "Prompt pack" }),
      h("p", { class: "field-help", text: "What to hand Claude Code for this milestone, repo rules included. Read it first: the decisions stay yours." }),
      pack,
      h("div", { class: "btn-row" }, copyBtn),
      copyStatus
    ]));

    // done when: local ticks only
    var doneWhen = Array.isArray(m.doneWhen) ? m.doneWhen : [];
    if (doneWhen.length) {
      var ticks = loadChecks(id, doneWhen.length);
      var tickNote = h("p", { class: "muted small", "aria-live": "polite" });
      var tickText = function () {
        return ticks.filter(Boolean).length + " of " + doneWhen.length + " ticked. Ticks stay in this browser only.";
      };
      tickNote.textContent = tickText();
      sec.appendChild(h("div", { class: "block" }, [
        h("h2", { class: "build-h", text: "Done when" }),
        h("ul", { class: "checklist" }, doneWhen.map(function (item, i) {
          var cid = nextId("dw");
          var cb = h("input", { type: "checkbox", id: cid, checked: ticks[i] });
          cb.addEventListener("change", function () {
            ticks[i] = cb.checked;
            saveChecks(id, ticks);
            tickNote.textContent = tickText();
          });
          return h("li", null, [cb, h("label", { for: cid, md: item })]);
        })),
        tickNote
      ]));
    }

    // repo and tag, then the GitHub check (on press only)
    var ownerNow = githubOwner();
    var ownerShown = ownerNow || "your-username";
    var verifyBtn = h("button", { class: "btn", type: "button", text: "Verify on GitHub" });
    var verifyOut = h("div", { class: "verify-result", role: "status", "aria-live": "polite", hidden: true });
    sec.appendChild(h("div", { class: "block" }, [
      h("h2", { class: "build-h", text: "Push it and tag it" }),
      h("p", null, ["Create ", codeEl(ownerShown + "/" + repo), " on GitHub when you're ready, push your work, then add the tag ", codeEl(tag), "."]),
      h("pre", { class: "cmd-block", tabindex: "0", role: "region", "aria-label": "Commands to tag and push", text: "git tag " + tag + "\ngit push origin " + tag }),
      h("p", { class: "field-help" }, ["The check looks at the public repos of ", codeEl(ownerShown), ". ", link("Change your GitHub username in Settings", "settings"), "."]),
      h("div", { class: "btn-row" }, verifyBtn),
      verifyOut
    ]));
    var checking = false;
    function showVerify(res) {
      verifyOut.hidden = false;
      verifyOut.setAttribute("data-status", VERIFY_LABELS[res.status] ? res.status : "error");
      clear(verifyOut);
      verifyOut.appendChild(h("p", { class: "verify-k", text: VERIFY_LABELS[res.status] || VERIFY_LABELS.error }));
      if (res.message) verifyOut.appendChild(h("p", { text: String(res.message) }));
    }
    verifyBtn.addEventListener("click", function () {
      if (checking) return;
      if (!DL.builds || typeof DL.builds.checkTag !== "function") {
        showVerify({ status: "error", message: "The GitHub check isn't available here. Reload the page, or mark it as self-reported." });
        return;
      }
      checking = true;
      var who = githubOwner();
      verifyBtn.disabled = true;
      verifyBtn.setAttribute("aria-busy", "true");
      verifyBtn.textContent = "Checking GitHub...";
      showVerify({ status: "checking", message: "Looking for the tag " + tag + " on " + (who || "your-username") + "/" + repo + "." });
      Promise.resolve().then(function () { return DL.builds.checkTag({ owner: who, repo: repo, tag: tag }); })
        .then(null, function (err) { return { status: "error", message: "The check failed: " + errMsg(err) }; })
        .then(function (res) {
          res = res && typeof res === "object" ? res : { status: "error", message: "GitHub gave no answer. Try again in a few minutes." };
          checking = false;
          if (res.status === "found") S.verified[id] = true;
          if (!ctx.alive) return;
          verifyBtn.disabled = false;
          verifyBtn.removeAttribute("aria-busy");
          verifyBtn.textContent = "Verify on GitHub";
          showVerify(res);
          refreshDone();
        });
    });

    // the decision note: it becomes the model answer of the decision card
    var noteId = nextId("bnote");
    var noteTa = h("textarea", { id: noteId, rows: "4", placeholder: m.decisionPrompt || "What did you decide while building this, and why?", "aria-describedby": noteId + "-help" });
    noteTa.value = buildRec(id).note || "";
    sec.appendChild(h("div", { class: "block" }, [
      h("h2", { class: "build-h" }, h("label", { for: noteId, text: "Your decision note" })),
      h("p", { class: "field-help", id: noteId + "-help", text: "One or two sentences on a choice you made and why. It comes back later as a cold case." }),
      noteTa
    ]));

    // mark done: verified once GitHub has the tag, or self-reported
    var doneBox = h("div", { class: "build-done", hidden: true });
    var markBtn = h("button", { class: "btn btn-primary", type: "button", text: "Mark done" });
    var noteBtn = h("button", { class: "btn", type: "button", text: "Save note", hidden: true });
    var selfBtn = h("button", { class: "btn-link", type: "button", text: "I built it, mark as self-reported" });
    var markHelp = h("p", { class: "field-help" });
    var markMsg = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    var busy = false;
    function refreshDone() {
      var r = buildRec(id);
      var found = !!S.verified[id];
      stateChip.className = "chip" + (r.done ? " ok" : "");
      stateChip.textContent = MILESTONE_TEXT[milestoneState(id)];
      clear(doneBox);
      doneBox.hidden = !r.done;
      if (r.done) {
        doneBox.appendChild(h("p", null, [
          h("strong", { text: "Done on " + fmtDate(r.done) + "." }), " ",
          r.verified ? "Verified on GitHub" + (isIso(r.verifiedAt) ? " on " + fmtDate(r.verifiedAt) : "") + "."
            : "Self-reported. Verify on GitHub any time to make it official."
        ]));
        if (r.note) {
          doneBox.appendChild(h("p", { class: "field-k", text: "Your note" }));
          paras(r.note, "build-note").forEach(function (p) { doneBox.appendChild(p); });
        }
      }
      markBtn.hidden = !!(r.done && r.verified);
      markBtn.textContent = r.done ? "Mark as verified" : "Mark done";
      markBtn.disabled = busy || !found;
      selfBtn.hidden = !!r.done;
      selfBtn.disabled = busy;
      noteBtn.hidden = !r.done;
      noteBtn.disabled = busy;
      markHelp.textContent = r.done && r.verified ? ""
        : found ? "GitHub has your tag." + (r.done ? " Mark it as verified." : " Mark it done.")
        : r.done ? "Verify on GitHub to make it a verified milestone."
        : "Mark done opens up once Verify on GitHub finds your tag.";
      markHelp.hidden = !markHelp.textContent;
    }
    function mark(verified) {
      if (busy) return;
      var wasDone = !!buildRec(id).done;
      busy = true;
      refreshDone();
      sayTo(markMsg, "Saving...", "");
      Promise.resolve().then(function () { return DL.builds.markDone(id, { tag: tag, verified: verified, note: noteTa.value }); })
        .then(function () { return wasDone ? null : countBuildSession(); })
        .then(function () {
          busy = false;
          if (!ctx.alive) return;
          var r = buildRec(id);
          sayTo(markMsg, !wasDone ? (r.verified ? "Done and verified. Nice work." : "Marked done, self-reported.")
            : verified ? "Saved. It's verified now." : "Saved.", "ok");
          refreshDone();
        }, function (err) {
          busy = false;
          if (!ctx.alive) return;
          sayTo(markMsg, "Couldn't save: " + errMsg(err), "bad");
          refreshDone();
        });
    }
    markBtn.addEventListener("click", function () { if (S.verified[id]) mark(true); });
    selfBtn.addEventListener("click", function () { mark(false); });
    noteBtn.addEventListener("click", function () { mark(false); });
    sec.appendChild(h("div", { class: "block" }, [
      h("h2", { class: "build-h", text: "Mark it done" }),
      doneBox,
      h("div", { class: "btn-row" }, [markBtn, noteBtn]),
      markHelp,
      h("div", { class: "btn-row" }, selfBtn),
      markMsg,
      m.share ? h("p", { class: "share-hint", text: SHARE_HINT }) : null
    ]));
    sec.appendChild(h("div", { class: "btn-row mt" }, [link("Back to tonight", "tonight", "btn"), link("Seasons", "seasons", "btn btn-ghost")]));

    renderUnlock();
    refreshDone();
    ctx.onProgress = function () { renderUnlock(); refreshDone(); };
    ctx.root.appendChild(sec);
    return null;
  }

  /* ======================================================================
     View: settings
     ====================================================================== */
  function flashEl(f) {
    var text = h("p", { text: f.text || "" });
    var box = h("div", { class: "flash mb" + (f.tone ? " " + f.tone : ""), role: "status", "aria-live": "polite" }, text);
    if (f.retry) {
      var retry = h("button", { class: "btn btn-small", type: "button", text: "Retry" });
      retry.addEventListener("click", function () {
        retry.disabled = true;
        Promise.resolve().then(function () { return DL.store.wipe(); }).then(function (ok) {
          if (ok === false) {
            retry.disabled = false;
            text.textContent = "Deleted on this device. Your account copy still couldn't be removed. Try again in a moment.";
            return;
          }
          removeNode(retry);
          box.classList.remove("warn");
          text.textContent = "Your account copy is removed too. Tonight starts fresh.";
        }, function (err) {
          retry.disabled = false;
          text.textContent = "Deleted on this device. Your account copy couldn't be removed yet (" + errMsg(err) + ").";
        });
      });
      box.appendChild(retry);
    }
    return box;
  }
  /* "Move my progress to another device": a sync link to copy, and a field to merge one from elsewhere. */
  function syncCard(ctx) {
    var copyBtn = h("button", { class: "btn btn-primary btn-copy", type: "button", text: "Copy sync link" });
    var copyStatus = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    var linkField = copyField("Your sync link");
    copyBtn.addEventListener("click", function () {
      var url;
      try { url = DL.sync.linkFor(state()); } catch (e) {
        copyStatus.textContent = "The sync link couldn't be made: " + errMsg(e);
        return;
      }
      copyText(url, { field: linkField, status: copyStatus, btn: copyBtn, hideField: true,
        ok: "Copied. Open it on your other device (send it to yourself in a note or a message)." });
    });
    var pid = nextId("sync");
    var paste = h("textarea", { id: pid, class: "paste-field", rows: "3", spellcheck: "false", autocomplete: "off",
      placeholder: "A sync link from your other device, or just its code (DL1...)" });
    var mergeBtn = h("button", { class: "btn", type: "button", text: "Merge" });
    var msg = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    function say(t, tone) {
      msg.textContent = t;
      msg.classList.remove("ok", "bad");
      if (tone) msg.classList.add(tone);
    }
    mergeBtn.addEventListener("click", function () {
      var sm;
      try { sm = DL.sync.apply(paste.value); } catch (e) {
        say(errMsg(e), "bad");
        paste.focus();
        return;
      }
      paste.value = "";
      if (!mergeChanged(sm)) { say(mergeText(sm), "ok"); return; }
      // Settings may have changed too, so the whole view is drawn again with the merged values.
      S.flash = { text: mergeText(sm), tone: "ok" };
      if (S.progressTimer) { clearTimeout(S.progressTimer); S.progressTimer = 0; }
      updateNav();
      if (ctx.alive) renderRoute({ name: "settings" }, { focus: true });
    });
    return h("div", { class: "settings-group sync-card" }, [
      h("h2", { text: "Move my progress to another device" }),
      h("p", { class: "sync-lead", text: "Open this link on your other device. It merges; nothing is lost." }),
      h("div", { class: "btn-row" }, copyBtn),
      copyStatus,
      linkField,
      h("div", { class: "field" }, [
        h("label", { class: "field-k", for: pid, text: "Or paste a link or code from your other device" }),
        paste
      ]),
      h("div", { class: "btn-row" }, mergeBtn),
      msg
    ]);
  }
  function viewSettings(ctx) {
    var set = settings();
    var sec = h("section", { class: "wrap section" }, head("Your shift", "Settings"));
    if (S.flash) { sec.appendChild(flashEl(typeof S.flash === "string" ? { text: S.flash } : S.flash)); S.flash = null; }
    var status = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    function save(fn, msg) {
      return saveSettings(fn).then(function () { status.textContent = msg || "Saved."; }, function (err) { status.textContent = "Couldn't save: " + errMsg(err); });
    }

    // pace
    var planName = nextId("plan");
    var planField = h("fieldset", { class: "field" }, [
      h("legend", { class: "field-k", text: "Plan" }),
      h("div", { class: "seg-opts" }, [
        radio(planName, "core", set.plan !== "all", "Core", "What interviews and day-to-day work need"),
        radio(planName, "all", set.plan === "all", "Everything", "Core plus the bonus cases")
      ])
    ]);
    planField.addEventListener("change", function (e) {
      var v = e.target && e.target.value === "all" ? "all" : "core";
      save(function (st) { st.plan = v; }, "Saved. Plan: " + (v === "all" ? "everything." : "core only."));
    });
    var target = h("input", { type: "date", id: nextId("target"), value: isIso(set.targetDate) ? set.targetDate : "" });
    target.addEventListener("change", function () {
      var v = target.value;
      if (!v) { save(function (st) { st.targetDate = null; }, "Saved. No date set, so the plan aims about 3 months out."); return; }
      if (!isIso(v)) { status.textContent = "That date doesn't look right."; return; }
      save(function (st) { st.targetDate = v; }, "Saved. Finish by " + fmtDate(v, true) + ".");
    });
    var wd = numberInput(nextId("wd"), set.weekdayMin || 30);
    var we = numberInput(nextId("we"), set.weekendMin || 60);
    [[wd, "weekdayMin", 30], [we, "weekendMin", 60]].forEach(function (x) {
      x[0].addEventListener("change", function () {
        var n = minutesValue(x[0].value);
        if (n === null) {
          status.textContent = "Use minutes between 10 and 240, like " + x[2] + ".";
          x[0].value = String(settings()[x[1]] || x[2]);
          return;
        }
        save(function (st) { st[x[1]] = n; });
      });
    });
    sec.appendChild(h("div", { class: "settings-group" }, [
      h("h2", { text: "Your pace" }),
      planField,
      h("div", { class: "fields" }, [
        field("Finish by", target, "Leave it empty to aim about 3 months out."),
        field("Weekday nights (minutes)", wd),
        field("Weekend nights (minutes)", we)
      ]),
      status
    ]));

    // courses and Build Nights (contract 9.9): the schedule and the GitHub username
    var multi = multiCourse();
    var hasBuilds = (catalog().builds || []).length > 0;
    if (multi || hasBuilds) {
      var cStatus = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
      var cSave = function (fn, msg) {
        return saveSettings(fn).then(function () { sayTo(cStatus, msg || "Saved.", "ok"); }, function (err) { sayTo(cStatus, "Couldn't save: " + errMsg(err), "bad"); });
      };
      var groupKids = [h("h2", { text: "Courses and Build Nights" })];
      if (multi) {
        var curSched = set.schedule || "parallel";
        var sched = h("select", { id: nextId("sched") }, SCHEDULES.map(function (o) {
          return h("option", { value: o[0], selected: curSched === o[0] }, o[1]);
        }));
        sched.addEventListener("change", function () {
          var v = sched.value, label = "";
          SCHEDULES.forEach(function (o) { if (o[0] === v) label = o[1]; });
          if (!label) { v = "parallel"; label = SCHEDULES[0][1]; }
          S.sess = {};
          cSave(function (st) { st.schedule = v; }, "Saved. Schedule: " + label + ".");
        });
        groupKids.push(field("Schedule", sched, "Which course Tonight draws from. In parallel, the plan alternates the two courses, with Build Nights on weekends."));
      }
      if (hasBuilds) {
        var gh = h("input", { type: "text", id: nextId("gh"), value: githubOwner() || DEFAULT_OWNER, autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
        gh.addEventListener("change", function () {
          var v = gh.value.trim();
          if (!v) {
            sayTo(cStatus, "Add your GitHub username, like " + DEFAULT_OWNER + ".", "bad");
            gh.value = githubOwner() || DEFAULT_OWNER;
            return;
          }
          if (!GH_OWNER_RE.test(v)) {
            sayTo(cStatus, "That doesn't look like a GitHub username: letters, digits and single hyphens, up to 39 characters.", "bad");
            return;
          }
          gh.value = v;
          cSave(function (st) { st.githubOwner = v; }, "Saved. Build Nights check github.com/" + v + ".");
        });
        groupKids.push(field("GitHub username", gh, "Build Nights look for your milestone tags in this account's public repos. The check runs only when you press Verify on GitHub."));
      }
      groupKids.push(cStatus);
      sec.appendChild(h("div", { class: "settings-group" }, groupKids));
    }

    // grading
    var swId = nextId("ai");
    var sw = h("input", { type: "checkbox", role: "switch", id: swId, checked: set.aiGrading !== false });
    var swState = h("span", { class: "switch-state", "aria-hidden": "true", text: set.aiGrading !== false ? "on" : "off" });
    var avail = h("p", { class: "field-help", "aria-live": "polite" });
    var aiStatus = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    function checkAvail() {
      avail.textContent = "";
      if (!sw.checked || !DL.ai || typeof DL.ai.available !== "function") return;
      Promise.resolve().then(function () { return DL.ai.available(); }).then(function (ok) {
        if (ctx.alive && sw.checked && !ok) avail.textContent = "Claude grading isn't available here right now, so answers get the quick key-idea check instead.";
      }, function () { /* leave it blank */ });
    }
    sw.addEventListener("change", function () {
      var on = sw.checked;
      swState.textContent = on ? "on" : "off";
      saveSettings(function (st) { st.aiGrading = on; }).then(function () {
        aiStatus.textContent = on ? "Saved. Claude grades your free-text answers." : "Saved. You grade yourself, with a quick key-idea check.";
        checkAvail();
      }, function (err) { aiStatus.textContent = "Couldn't save: " + errMsg(err); });
    });
    sec.appendChild(h("div", { class: "settings-group" }, [
      h("h2", { text: "Grading" }),
      h("div", { class: "switch-row" }, [sw, h("label", { for: swId, text: "Grade free-text answers with Claude" }), swState]),
      h("p", { class: "ai-notice", text: AI_NOTICE }),
      avail,
      aiStatus
    ]));
    checkAvail();

    // move my progress to another device
    if (DL.sync && typeof DL.sync.linkFor === "function") sec.appendChild(syncCard(ctx));

    // progress
    var taId = nextId("json");
    var ta = h("textarea", { id: taId, rows: "10", readonly: true, spellcheck: "false" });
    ta.value = exportText();
    var storeLine = h("p", { class: "field-help", text: storageText() });
    var copyStatus = h("span", { class: "status-line", role: "status", "aria-live": "polite" });
    var copyBtn = h("button", { class: "btn btn-copy", type: "button", text: "Copy" });
    copyBtn.addEventListener("click", function () {
      copyText(ta.value, { field: ta, status: copyStatus, btn: copyBtn, ok: "Copied." });
    });
    sec.appendChild(h("div", { class: "settings-group" }, [
      h("h2", { text: "Your progress" }),
      storeLine,
      h("label", { class: "field-k", for: taId, text: "Progress as JSON (read-only)" }),
      ta,
      h("div", { class: "btn-row" }, [copyBtn, copyStatus])
    ]));

    // delete, with an in-page two-step confirm
    var delBtn = h("button", { class: "btn btn-danger", type: "button", "aria-expanded": "false", text: "Delete my progress" });
    var yes = h("button", { class: "btn btn-danger", type: "button", text: "Yes, delete everything" });
    var no = h("button", { class: "btn", type: "button", text: "Keep my progress" });
    var confirmId = nextId("confirm");
    var confirmBox = h("div", { class: "confirm", id: confirmId, hidden: true, role: "group", "aria-label": "Confirm delete" }, [
      h("p", { text: "Are you sure? Every closed case, cold case and note goes, and Tonight starts again from the first shift. This can't be undone." }),
      h("div", { class: "btn-row" }, [yes, no])
    ]);
    delBtn.setAttribute("aria-controls", confirmId);
    delBtn.addEventListener("click", function () {
      confirmBox.hidden = false;
      delBtn.setAttribute("aria-expanded", "true");
      delBtn.disabled = true;
      no.focus();
    });
    no.addEventListener("click", function () {
      confirmBox.hidden = true;
      delBtn.disabled = false;
      delBtn.setAttribute("aria-expanded", "false");
      delBtn.focus();
    });
    yes.addEventListener("click", function () {
      yes.disabled = true;
      no.disabled = true;
      Promise.resolve().then(function () { return DL.store.wipe(); }).then(function (ok) {
        // wipe() resolves false when this device is cleared but the account copy couldn't be deleted.
        S.flash = ok === false
          ? { text: "Deleted on this device. Your account copy couldn't be removed yet.", tone: "warn", retry: true }
          : { text: "Your progress is deleted. Tonight starts fresh." };
        if (ctx.alive) renderRoute({ name: "settings" }, { focus: true });
        else updateNav();
      }, function (err) {
        yes.disabled = false;
        no.disabled = false;
        confirmBox.appendChild(h("p", { class: "diagram-error", text: "Couldn't delete: " + errMsg(err) }));
      });
    });
    var where = DL.store && DL.store.mode === "cloud" ? " from your account and this browser" : " from this browser";
    sec.appendChild(h("div", { class: "settings-group danger" }, [
      h("h2", { text: "Delete my progress" }),
      h("p", { class: "field-help", text: "Removes every closed case, cold case, note, interview result, Build Night and setting" + where + ". Copy your progress first if you might want it back." }),
      h("div", { class: "btn-row" }, delBtn),
      confirmBox
    ]));

    ctx.onProgress = function () {
      if (ta.isConnected) ta.value = exportText();
      storeLine.textContent = storageText();
    };
    ctx.root.appendChild(sec);
    return null;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = DL;
})(typeof window !== "undefined" ? window : globalThis);
