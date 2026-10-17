/* engine/ui-v3.1.0.js
   Dead Letter UI (DL.ui): the shell, router wiring and every view. Published as engine/ui.js.
   Contract: docs/dead-letter-engine-contract-v1.1.0.md, sections 6 and 9.9. Needs engine/core-v1.2.0.js (the merged
   catalog, state v2, DL.builds, DL.credits, decision cards; DL.sync, DL.prompts and the #interview/<id> route from
   v1.1). Styles: index-v3.1.0.html. Publishing: docs/dead-letter-conventions-v1.1.0.md section 3.
   CHANGELOG
   v3.1.0 (2026-10-18) readability and reading (contract journey-contract-v3.0.0): lesson rows show the story
        headline with the tech topics under it (.ls block, from the catalog's hook and topics); the Reading panel
        (layout one step at a time or whole lesson, Night or Paper theme site wide, text size; keys dl-layout,
        dl-theme, dl-text-size); a contents sheet to jump to any step; All lessons with live search across both
        courses; Open this lesson from journey stops.
   v3.0.0 (2026-10-18) the journey (approved mockup guided-flow-v1.0.0.html, contract scratchpad journey-contract-v2.0.0):
        plain words through one LABELS map (lesson, memory check, weekend project, practice interview, grade labels
        with hints); home is a vertical journey with a you-are-here marker and one Continue button (continueNext:
        memory checks, then tonight's items, then done for tonight), landmarks with projected 'about' dates, a sticky
        Continue bar; memory checks flow on into the lesson; lessons play one step per screen (parts kept in the DOM,
        others hidden), with Back/Next, a step bar, resume via dl-step-<id>, and a Finish lesson panel back to the
        journey; weekend-project and practice-interview checklists, Skip this weekend (dl-snooze-<id>); a Journey map
        route. Needs index-v3.0.0.html and core-v1.2.3.js.
   v2.0.1 (2026-10-17) the site is 3AM Labs (3amlabs.dev): the top-bar wordmark always reads "3AM Labs"; the
        catalog's forum name ("nocturne") stays the forum inside the stories, and the board (/n/nightshift) still shows
        beside the wordmark.
   v2.0.0 (2026-10-17) Night console redesign (mockup redesign-c-console-v1.0.0.html, contract scratchpad
        console-markup-contract-v1.0.0): one-row top bar (Tonight, Cold cases, current section) with a Menu overlay
        for the rest, a live clock, a progress line (plan progress, reading progress on cases); the board switcher
        moves into Seasons and Evidence; Tonight is a status strip, a hero sentence with Start shift, a night bar of
        tonight's minutes and a queue without chips; case pages open in focus mode with a case bar, a dot rail of the
        parts, a Words popover (W key) and a phone bottom bar; Seasons is a timeline with codes and minutes on each
        row. Needs index-v2.0.0.html and core-v1.2.3.js.
        First shift is a fill-in sentence (finish date with 3/4/6 month presets, minute pills, plan rows, a live
        'it fits' line, the big Clock in button); Settings uses the same minute pills; number spinners hidden.
   v1.2.6 (2026-10-17) UI and UX pass: Seasons rows drop the repeated course chip, the 'core' chip and the 'ready'
        chip (a row shows a 'bonus' chip, a state chip only when it is not ready, or its done chip); each season is a
        collapsible block with a progress bar and an 'N of M closed' count, open by default only for the season you
        are in (your toggles are kept for the visit in S.seasonOpen, which a progress event does not clear); each course head shows its core progress;
        the Evidence board's empty state is a panel with a link to Tonight. Needs index-v1.2.0.html for the new
        styles.
   v1.2.5 (2026-10-16) the 3 AM Interview room and the text-only interview name the interview's own course and subject
        (LATENT finales no longer say Dead Letter or system design): fillRoom fills {{COURSE}} and {{SUBJECT}} from the
        course (courses-v1.0.2.json `subject`; fallback by id: dl system design, lt AI engineering), and
        DL.prompts.interview gets course and subject. Needs engine/core-v1.2.2.js and content/interview-room-v1.0.1.html.
   v1.2.4 (2026-10-14) "How it works" (#guide), in plain words, for readers who have never studied computers: what
        the site is, each part of a case in order, what cold cases are and when they come back (1, 3, 7, 21, 60
        and 120 days, moved by your grade), why you answer from memory, how to remember more, the rest of the site,
        and how to move progress between devices. Linked from the menu, from a dismissable first-visit callout on
        Tonight ("dl.guide.seen" in localStorage, every access in try/catch), from the first-shift card and from
        the Cold cases page. Bold runs in the guide render as <strong> (DL.util.md does italics only).
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
  /* Plain words (v3.0.0, contract section 1): one map, used everywhere a kind of thing is named. */
  var LABELS = {
    lesson: "lesson", lessons: "lessons", memoryCheck: "memory check", memoryChecks: "memory checks",
    part2: "What happened next", tryIt: "Try it", explanation: "The explanation", words: "Words",
    inYourJob: "In your job", quickCheck: "Quick check", yourNote: "Your note", finish: "Finish lesson",
    weekendProject: "weekend project", practiceInterview: "practice interview", connects: "How it connects",
    rules: "The rules", season: "season"
  };
  var GRADE_LABELS = { missed: "Didn't remember", partly: "Half", good: "Got it", easy: "Easy" };
  var GRADE_HINTS = { missed: "ask me again tomorrow", partly: "same gap again", good: "ask me later", easy: "much later" };
  var AI_NOTICE = "Your free-text answers are sent to Claude for grading. Turn this off to self-grade.";
  /* The top bar holds Journey and Memory checks (plus the current section); the Menu holds the rest (v3.0.0). */
  var NAV_TOP = [["tonight", "Journey"], ["reviews", capFirst(LABELS.memoryChecks)]];
  var NAV_MENU = [
    ["journey", "Journey map"], ["seasons", "All lessons"], ["notes", "Notes"], ["board", LABELS.connects],
    ["rules", LABELS.rules], ["guide", "How it works"], ["settings", "Settings"]
  ];
  var TEXT_KEY = "dl-text-size";
  var TEXT_SIZES = ["m", "l", "xl"];
  var TEXT_SIZE_NAMES = { m: "Normal", l: "Large", xl: "Extra large" };
  /* The Reading panel (v3.1.0, contract C): layout and theme, saved in localStorage like the text size. The theme
     is site wide: body[data-theme] (and the root element's) is "night" or "paper"; body[data-layout] is "step" or
     "whole". */
  var LAYOUT_KEY = "dl-layout";
  var THEME_KEY = "dl-theme";
  var LAYOUTS = [["step", "One step at a time"], ["whole", "Whole lesson"]];
  var THEMES = [["night", "Night"], ["paper", "Paper"]];
  var LOCKED_LINE = "Pick your advice above to read what happened next.";
  /* The lesson player's steps (contract 5): title and the one-line "what this is", always shown under the title. */
  var STEP_INFO = {
    post: ["The story", "Someone on a night shift tells you what happened. The clue is in here."],
    comments: ["The comments", "Other people reply. Not all of them are right."],
    reply: ["Your pick", "Pick the advice you'd give. A wrong pick costs nothing."],
    part2: [LABELS.part2, "What your advice led to. Most of the learning is here."],
    sim: [LABELS.tryIt, "A small simulator. Change the settings and watch it fail. You can't break anything real."],
    explain: [LABELS.explanation, "What was really going on, step by step, and the fix."],
    terms: [LABELS.words, "Every technical word in this lesson, in plain words."],
    work: [LABELS.inYourJob, "Where you'd meet this at work. Just read it."],
    pin: [LABELS.quickCheck, "One question. Answer without scrolling back. Remembering it yourself is what makes it stick."],
    words: [LABELS.yourNote, "One or two sentences in your own words. It comes back to you later."],
    close: [LABELS.finish, "This lesson comes back as a memory check tomorrow, then in 3, 7 and 21 days."]
  };
  /* Tapping a stop on the journey shows one of these (contract 2). */
  var JR_EXPLAIN = {
    lesson: "A short story with a lesson inside. About 12 minutes.",
    check: "Quick questions on lessons you finished, right before you'd forget them.",
    project: "A real project you build in your own GitHub repo, with Claude Code. About 75 minutes, on a weekend.",
    interview: "A mock job interview on this season. Claude asks the questions.",
    season: "A new set of lessons, like a new TV season."
  };
  var STEP_KEY = "dl-step-";
  var SNOOZE_KEY = "dl-snooze-";
  var ROUTES = { tonight: 1, journey: 1, "case": 1, interview: 1, build: 1, reviews: 1, rules: 1, board: 1, seasons: 1, notes: 1, guide: 1, settings: 1 };
  var ARG_ROUTES = { "case": 1, interview: 1, build: 1 };
  /* Routes core's router knows, used when DL.router.ROUTES is missing. Anything else (build, journey) is routed here. */
  var CORE_ROUTES = ["tonight", "case", "interview", "reviews", "rules", "board", "seasons", "notes", "settings"];
  var SITE_NAME = "3AM Labs";   // the site brand (v2.0.1); the catalog's forum.name is the in-story forum
  var DL_TAGLINE = "Stories from people who work while you sleep.";
  var BOARD_KEY = "dl.board";
  var GUIDE_SEEN_KEY = "dl.guide.seen";
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
    missed: "That's fine. This is exactly what memory checks are for.",
    partly: "Halfway there. The memory check will ask it again.",
    good: "Nice. It still comes back later, so it sticks.",
    easy: "Nice. It still comes back later, so it sticks."
  };

  var S = {
    booted: false, shellReady: false, wired: false, bootPromise: null, catalog: null,
    route: null, routeKey: "", view: null, lastRender: null, progressTimer: 0, flash: null, uid: 0, sess: {},
    notice: null, room: "", roomP: null, renderSeed: 1,
    board: "all", verified: {}, menuWired: false, clockTimer: 0, clockText: "",
    // The night's flow (v3.0.0): never under S.sess, which every progress event clears. See flowState().
    flow: null,
    // The All lessons search text (v3.1.0), kept while the page is open, dropped on any other route.
    lsQuery: ""
  };

  var ui = DL.ui = DL.ui || {};
  ui.version = "3.1.0";
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
  /* Adds a listener and removes it again in the view's cleanup (v3.1.0). */
  function listen(ctx, target, type, fn, opts) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(type, fn, opts);
    ctx.cleanups.push(function () {
      if (typeof target.removeEventListener === "function") target.removeEventListener(type, fn, opts);
    });
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
  /* Minute pills (v2.0.0): a radio group of preset minute counts drawn as pills, used by the first shift and
     Settings. A saved value that is not a preset gets its own pill. onChange gets the picked number. The caller
     labels the group (aria-labelledby). */
  function minutePills(name, presets, value, onChange) {
    var cur = Math.round(Number(value));
    var list = presets.slice();
    if (isFinite(cur) && cur > 0 && list.indexOf(cur) < 0) {
      list.push(cur);
      list.sort(function (a, b) { return a - b; });
    }
    var box = h("div", { class: "fs-chips", role: "radiogroup" });
    list.forEach(function (n) {
      var id = nextId(name);
      box.appendChild(h("input", { type: "radio", name: name, id: id, value: String(n), checked: n === cur }));
      box.appendChild(h("label", { for: id }, [String(n), h("span", { class: "sr-only", text: " minutes" })]));
    });
    box.addEventListener("change", function (e) {
      var n = minutesValue(e.target && e.target.value);
      if (n !== null && typeof onChange === "function") onChange(n);
    });
    return box;
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
  /* The story headline and the tech topics (v3.1.0, contract B). caseMeta may not carry them, so the raw catalog
     entry is the fallback. Topics: up to 4 plain labels. */
  function rawEntry(id) {
    var cat = catalog();
    return findIn(cat.cases, id) || findIn(cat.lld, id) || findIn(cat.interviews, id) || {};
  }
  function hookOf(m, o, it) {
    var raw = rawEntry(it.id);
    var v = m.hook || o.hook || it.hook || raw.hook || "";
    return typeof v === "string" ? v : "";
  }
  function topicList(m, o, it) {
    var raw = rawEntry(it.id);
    var v = [m.topics, o.topics, it.topics, raw.topics].filter(function (x) { return Array.isArray(x) && x.length; })[0] || [];
    return v.filter(function (t) { return typeof t === "string" && t.trim() !== ""; }).slice(0, 4);
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
      hook: isBuild ? "" : hookOf(m, o, it),
      topics: isBuild ? [] : topicList(m, o, it),
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
    if (m === "cloud") return "Your progress is saved to your account.";
    if (m === "local") return "Your progress is saved in this browser.";
    return "Your progress isn't being saved here, because this browser blocks storage.";
  }
  /* Settings wording: the sync card sits above the line there. */
  function storageText() {
    var m = DL.store && DL.store.mode;
    if (m === "cloud") return storageLead();
    return storageLead() + " To back it up or use another device, use Move my progress above.";
  }
  /* Journey wording, with the way to the sync card as a link. */
  function storageLine() {
    var m = DL.store && DL.store.mode;
    if (m === "cloud") return h("p", { class: "storage-line", text: storageLead() });
    return h("p", { class: "storage-line" }, [
      storageLead() + " To back it up or use another device: Menu, ",
      link("Settings, Move my progress to another device", "settings"),
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
  /* go(), but a route that is already on screen is drawn again (Continue on the journey, or on Memory checks). */
  function goRoute(route) {
    var target = parseRoute(route);
    if (keyOf(target) === S.routeKey) { renderRoute(target, { focus: true }); return; }
    go(route);
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
    tonight: viewTonight, journey: viewJourney, "case": viewCase, interview: viewInterview, build: viewBuild, reviews: viewReviews,
    seasons: viewSeasons, rules: viewRules, board: viewBoard, notes: viewNotes, guide: viewGuide, settings: viewSettings
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
    if (r.name !== "seasons") S.lsQuery = "";
    S.route = r;
    S.routeKey = keyOf(r);
    S.renderSeed = (Math.floor(Math.random() * 4294967296) >>> 0) || 1;
    if (S.notice) {
      if (S.notice.key === null) S.notice.key = S.routeKey;
      else if (S.notice.key !== S.routeKey) hideNotice();
    }
    ui.diagrams = [];
    clear(view);
    closeMenu(false);
    var ctx = { root: view, name: r.name, arg: r.arg, alive: true, cleanups: [], rerender: false, onProgress: null, course: null, readMode: false };
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
     other view shows the home board, as in v1.1. The top bar (v2.0.0) has no tagline and no .mast, so both are
     optional; the bar gets data-course="lt" on LATENT pages. */
  function setMasthead(course) {
    if (!doc || !S.shellReady) return;
    var c = course ? courseInfo(course) : null;
    var name = S.route ? S.route.name : "";
    if (!c && S.board !== "all" && (name === "seasons" || name === "board" || name === "journey")) c = courseInfo(S.board);
    var forum = catalog().forum || {};
    var home = courseInfo("dl") || {};
    setText("brand-board", c ? (c.board || "") : (forum.board || home.board || "/n/nightshift"));
    var tag = doc.getElementById("brand-tag");
    if (tag) tag.textContent = (c && c.tagline) || home.tagline || DL_TAGLINE;
    var bars = [doc.getElementById("nav"), doc.querySelector(".mast")];
    bars.forEach(function (bar) {
      if (!bar) return;
      if (c && c.id === "lt") bar.setAttribute("data-course", "lt");
      else bar.removeAttribute("data-course");
    });
  }

  /* Board switcher (contract 9.9): All, then one button per course. Remembered in localStorage. Since v2.0.0 it
     sits inside Seasons and Evidence, right after the section head. */
  function loadBoard() {
    var v = lsGet(BOARD_KEY);
    S.board = v && v !== "all" && courseInfo(v) && multiCourse() ? v : "all";
  }
  function boardSwitchInline() {
    if (!multiCourse()) return null;
    var box = h("div", { class: "board-switch-inline", role: "group", "aria-label": "Board" });
    var opts = [{ id: "all", title: "All" }].concat(courseList().map(function (c) {
      return { id: c.id, title: c.title || c.id };
    }));
    opts.forEach(function (o) {
      var b = h("button", { class: "board-btn", type: "button", "data-board": o.id, "aria-pressed": String(S.board === o.id), text: o.title });
      b.addEventListener("click", function () { setBoard(o.id); });
      box.appendChild(b);
    });
    return box;
  }
  function setBoard(id) {
    S.board = id !== "all" && courseInfo(id) ? id : "all";
    lsSet(BOARD_KEY, S.board);
    Array.prototype.forEach.call(doc.querySelectorAll(".board-switch-inline .board-btn"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-board") === S.board));
    });
    var name = S.route ? S.route.name : "";
    if (name === "seasons" || name === "board" || name === "journey") renderRoute(S.route, {});
  }
  /* One line under a filtered Seasons or Evidence heading, so a hidden course is never a surprise. */
  function filterNote() {
    if (S.board === "all" || !multiCourse()) return null;
    return h("p", { class: "filter-note", text: "Showing " + courseTitle(S.board) + " only." });
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
     Shell: top bar (Tonight, Cold cases, the current section), the Menu
     overlay, the cold-case count, the clock and the progress line (v2.0.0)
     ====================================================================== */
  function routeLabel(name) {
    var all = NAV_TOP.concat(NAV_MENU);
    for (var i = 0; i < all.length; i++) if (all[i][0] === name) return all[i][1];
    return "";
  }
  function isMenuRoute(name) {
    for (var i = 0; i < NAV_MENU.length; i++) if (NAV_MENU[i][0] === name) return true;
    return false;
  }
  function navLink(label, route, cls) {
    var a = link(label, route, cls);
    a.setAttribute("data-route", route);
    return a;
  }
  function renderShell() {
    var forum = catalog().forum || {};
    setText("brand-name", SITE_NAME);
    setText("brand-board", forum.board || "/n/nightshift");
    var nav = doc.getElementById("nav");
    var holder = doc.getElementById("nav-links");   // never #nav itself: it also holds the wordmark, clock and Menu button
    if (holder) {
      clear(holder);
      NAV_TOP.forEach(function (n) {
        var a = navLink(n[1], n[0], "top-link");
        if (n[0] === "reviews") a.appendChild(h("span", { class: "tab-count", "aria-hidden": "true", hidden: true }));
        holder.appendChild(a);
      });
    }
    var menuHolder = doc.getElementById("menu-links");
    if (menuHolder) {
      clear(menuHolder);
      NAV_MENU.forEach(function (n) {
        if (n[0] === "guide") menuHolder.appendChild(h("hr", { class: "menu-sep" }));
        menuHolder.appendChild(navLink([
          h("span", { class: "ml-name", text: n[1] }),
          n[0] === "guide" ? null : h("span", { class: "ml-hint" })
        ], n[0], "menu-link"));
      });
    }
    if (nav) nav.hidden = false;
    S.shellReady = true;
    wireMenu();
    updateClock();
  }
  /* Tonight's minutes from the settings (weekend or weekday), for when the pace plan doesn't say. */
  function tonightMinutes() {
    var set = settings(), we = false;
    try { we = !!DL.util.isWeekend(today()); } catch (e) { we = false; }
    return we ? (Number(set.weekendMin) || 60) : (Number(set.weekdayMin) || 30);
  }
  function planWord() { return planOf() === "all" ? "everything" : "core"; }
  /* Sessions closed and sessions on the plan, across all courses. */
  function planCounts() {
    var list = sessionsFor(planOf());
    var done = list.filter(function (it) { return isDone(it.id); }).length;
    return { done: done, total: list.length };
  }
  /* "S2 · 2 of 19": the current season of the first course on the plan, or "every lesson" when none is open. */
  function seasonsHint() {
    var plan = sessionsFor(planOf()), course = null;
    for (var i = 0; i < plan.length; i++) if (plan[i] && plan[i].kind !== "build") { course = courseOf(plan[i]); break; }
    course = course || (courseList()[0] || {}).id || "dl";
    var n = currentSeason(course);
    if (!n) return "every lesson";
    var items = courseSessions("all", course).filter(function (it) { return it.kind !== "build" && it.season === n; });
    var done = items.filter(function (it) { return isDone(it.id); }).length;
    var c = courseInfo(course);
    var prefix = String((c && c.prefix) || "s").toUpperCase();
    return prefix + n + " · " + done + " of " + items.length;
  }
  function menuHints() {
    var out = {};
    out.journey = "the whole map";
    try { out.seasons = seasonsHint(); } catch (e) { out.seasons = "every lesson"; }
    out.rules = plural((catalog().rules || []).length, "rule");
    out.board = "ideas, linked";
    out.notes = "your own words";
    try { out.settings = planWord() + " · " + tonightMinutes() + " min"; } catch (e2) { out.settings = ""; }
    return out;
  }
  function updateNav() {
    var holder = doc.getElementById("nav-links");
    var active = S.route ? S.route.name : "";
    var due = 0;
    try { due = S.shellReady ? dueList().length : 0; } catch (e) { due = 0; }
    if (holder) {
      // The third top link names the current section when it lives in the Menu. link() keeps its route, so a
      // different section gets a new link.
      var extra = holder.querySelector(".top-current");
      if (extra && extra.getAttribute("data-route") !== active) { removeNode(extra); extra = null; }
      if (!extra && isMenuRoute(active)) holder.appendChild(navLink(routeLabel(active), active, "top-link top-current"));
      Array.prototype.forEach.call(holder.querySelectorAll("a[data-route]"), function (a) {
        var r = a.getAttribute("data-route");
        if (r === active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
        if (r === "reviews") {
          var c = a.querySelector(".tab-count");
          if (c) { c.textContent = String(due); c.hidden = due === 0; }
          a.setAttribute("aria-label", due ? "Memory checks, " + due + " due" : "Memory checks");
        }
      });
    }
    var menu = doc.getElementById("menu-links");
    if (menu) {
      var hints = S.shellReady ? menuHints() : {};
      Array.prototype.forEach.call(menu.querySelectorAll("a[data-route]"), function (a) {
        var r = a.getAttribute("data-route");
        if (r === active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
        var hint = a.querySelector(".ml-hint");
        if (hint) hint.textContent = hints[r] || "";
      });
    }
    // A case page owns the line (reading progress); every other route shows plan progress.
    if (S.shellReady && !(S.view && S.view.readMode)) {
      try {
        var pc = planCounts();
        setProgressLine(pc.total ? pc.done * 100 / pc.total : 0, null);
      } catch (e3) { /* the line stays as it was */ }
    }
  }

  /* The progress line: #progress-fill's width in percent; mode "read" on case pages, none elsewhere. */
  function setProgressLine(pct, mode) {
    if (!doc) return;
    var fill = doc.getElementById("progress-fill");
    var line = doc.getElementById("progress-line");
    var n = Number(pct);
    if (!isFinite(n)) n = 0;
    n = Math.max(0, Math.min(100, n));
    if (fill && fill.style) fill.style.width = (Math.round(n * 10) / 10) + "%";
    if (line) {
      if (mode) line.setAttribute("data-mode", mode);
      else line.removeAttribute("data-mode");
    }
  }

  /* The Menu overlay: #menu-btn opens it; Esc, the scrim, #menu-close or a link close it and focus goes back
     to #menu-btn. Wired once. */
  function isMenuOpen() {
    var m = doc && doc.getElementById("menu");
    return !!m && !m.hidden;
  }
  function openMenu() {
    var m = doc.getElementById("menu"), btn = doc.getElementById("menu-btn");
    if (!m) return;
    m.hidden = false;
    if (btn) btn.setAttribute("aria-expanded", "true");
    var first = m.querySelector("#menu-links a") || m.querySelector("a, button");
    if (first) { try { first.focus(); } catch (e) { /* not focusable */ } }
  }
  function closeMenu(returnFocus) {
    var m = doc && doc.getElementById("menu");
    if (!m || m.hidden) return false;
    m.hidden = true;
    var btn = doc.getElementById("menu-btn");
    if (btn) {
      btn.setAttribute("aria-expanded", "false");
      if (returnFocus) { try { btn.focus(); } catch (e) { /* not focusable */ } }
    }
    return true;
  }
  function wireMenu() {
    if (S.menuWired) return;
    var m = doc.getElementById("menu"), btn = doc.getElementById("menu-btn");
    if (!m || !btn) return;
    S.menuWired = true;
    btn.addEventListener("click", function () {
      if (isMenuOpen()) closeMenu(true); else openMenu();
    });
    m.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || typeof t.closest !== "function") return;
      if (t.closest("[data-close]") || t.closest("#menu-close") || t.closest("a.menu-link")) closeMenu(true);
    });
    doc.addEventListener("keydown", function (e) {
      if ((e.key === "Escape" || e.key === "Esc") && isMenuOpen()) {
        e.preventDefault();   // the case view's Esc handler skips a handled key
        closeMenu(true);
      }
    });
  }

  /* The clock: every .clock in the document (the top bar's and any inside a view) shows local HH:MM, the colon
     in its own span. One interval, started once at boot; it rewrites a clock only when the minute changes. */
  function clockParts(d) { return [pad2(d.getHours()), pad2(d.getMinutes())]; }
  function hhmm(d) { var p = clockParts(d); return p[0] + ":" + p[1]; }
  function fillClock(el, d) {
    var p = clockParts(d), t = p[0] + ":" + p[1];
    if (el.getAttribute("data-t") === t) return;
    el.setAttribute("data-t", t);
    clear(el);
    el.appendChild(doc.createTextNode(p[0]));
    el.appendChild(h("span", { class: "clock-colon", text: ":" }));
    el.appendChild(doc.createTextNode(p[1]));
  }
  function updateClock() {
    try {
      if (!doc || typeof doc.querySelectorAll !== "function") return;
      var d = new Date();
      Array.prototype.forEach.call(doc.querySelectorAll(".clock"), function (el) { fillClock(el, d); });
      var date = DAYS[d.getDay()].slice(0, 3) + " " + d.getDate() + " " + MONTHS[d.getMonth()];
      if (date !== S.clockText) { S.clockText = date; setText("top-date", date); }
    } catch (e) { /* the clock just stays as it was */ }
  }
  function startClock() {
    updateClock();
    if (S.clockTimer || typeof setInterval !== "function") return;
    S.clockTimer = setInterval(updateClock, 1000);
    // In node (tests), don't keep the process alive for the clock.
    if (S.clockTimer && typeof S.clockTimer.unref === "function") S.clockTimer.unref();
  }

  /* Story text size: body[data-text] is "m", "l" or "xl", kept in localStorage ("dl-text-size"). */
  function textSize() {
    var v = lsGet(TEXT_KEY);
    return TEXT_SIZES.indexOf(v) >= 0 ? v : "m";
  }
  function applyTextSize(v) {
    var b = doc && doc.body;
    if (b && TEXT_SIZES.indexOf(v) >= 0) b.setAttribute("data-text", v);
  }
  /* "A-" and "A+" in the Reading panel: one size down or up (m, l, xl), saved at once. */
  function stepTextSize(dir) {
    var cur = (doc.body && doc.body.getAttribute("data-text")) || textSize();
    var i = Math.max(0, TEXT_SIZES.indexOf(cur));
    var next = TEXT_SIZES[Math.max(0, Math.min(TEXT_SIZES.length - 1, i + dir))];
    applyTextSize(next);
    lsSet(TEXT_KEY, next);
    return next;
  }
  /* Layout (dl-layout: "step" or "whole") and theme (dl-theme: "night" or "paper"), v3.1.0. */
  function layoutPref() { return lsGet(LAYOUT_KEY) === "whole" ? "whole" : "step"; }
  function themePref() { return lsGet(THEME_KEY) === "paper" ? "paper" : "night"; }
  function applyLayout(v) {
    var b = doc && doc.body;
    if (b && typeof b.setAttribute === "function") b.setAttribute("data-layout", v === "whole" ? "whole" : "step");
  }
  function applyTheme(v) {
    var t = v === "paper" ? "paper" : "night";
    [doc && doc.documentElement, doc && doc.body].forEach(function (n) {
      if (n && typeof n.setAttribute === "function") n.setAttribute("data-theme", t);
    });
  }
  function setLayoutPref(v) {
    v = v === "whole" ? "whole" : "step";
    lsSet(LAYOUT_KEY, v);
    applyLayout(v);
    return v;
  }
  function setThemePref(v) {
    v = v === "paper" ? "paper" : "night";
    lsSet(THEME_KEY, v);
    applyTheme(v);
    return v;
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
    if (sm.cases) parts.push(plural(sm.cases, LABELS.lesson));
    if (sm.cards) parts.push(plural(sm.cards, LABELS.memoryCheck));
    if (sm.notes) parts.push(plural(sm.notes, "note"));
    if (sm.interviews) parts.push(plural(sm.interviews, LABELS.practiceInterview + " result"));
    if (sm.builds) parts.push(plural(sm.builds, LABELS.weekendProject));
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
      applyTextSize(lsGet(TEXT_KEY));
      applyTheme(themePref());
      applyLayout(layoutPref());
      renderShell();
      startClock();
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
        return waiting > 0 ? "You're caught up on everything open so far. The next lessons are being written or open up as you go."
          : "Every lesson on your plan is finished.";
      case "past-target": return "Your finish date, " + tgt + ", has passed. Pick a new one whenever you like.";
      case "behind":
        return "A little behind: about " + Math.max(1, Math.round(Number(out.extraMinutes) || 0)) + " extra minutes a night" +
          (out.suggestedDate ? ", or move your finish date to " + fmtDate(out.suggestedDate) : "") + " gets you there.";
      case "ahead": return "Ahead of plan for " + tgt + ". Anything more tonight is extra.";
      default: return "On track to finish by " + tgt + ".";
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
    if (info.kind === "interview") return capFirst(LABELS.practiceInterview) + (info.season ? " · Season " + info.season : "");
    if (info.kind === "lld") return "Low-level design " + LABELS.lesson;
    if (info.kind === "build") return capFirst(LABELS.weekendProject);
    return info.season ? "Season " + info.season : capFirst(LABELS.lesson);
  }
  function planSummary(plan) {
    var list = sessionsFor(plan);
    var mins = list.reduce(function (a, it) { return a + (Number(it.minutes) || 0); }, 0);
    return (plan === "all" ? "Everything" : "Core") + ": " + plural(list.length, "stop") + ", about " +
      plural(Math.max(1, Math.round(mins / 60)), "hour") + " in all, plus a few minutes of " + LABELS.memoryChecks + " on most nights.";
  }

  /* First shift (v2.0.0): a sentence you fill in. The finish date (with 3, 4 and 6 month presets), weeknight
     and weekend minutes as pills, the plan as two rows, and a live line that says whether the nights fit. */
  var FS_SPANS = [[91, "3 months"], [122, "4 months"], [183, "6 months"]];
  var FS_WD = [20, 30, 45, 60, 90];
  var FS_WE = [30, 45, 60, 80, 120];
  function firstShift() {
    var set = settings(), t = today();
    var planName = nextId("plan"), spanName = nextId("span");
    var titleId = nextId("fs-h"), dateQ = nextId("fs-q"), wdQ = nextId("fs-q"), weQ = nextId("fs-q"), planQ = nextId("fs-q");
    var wdVal = set.weekdayMin || 30, weVal = set.weekendMin || 60;
    var target = h("input", {
      type: "date", class: "fs-date", id: nextId("target"), "aria-label": "Finish date",
      value: isIso(set.targetDate) ? set.targetDate : addDays(t, 122), min: addDays(t, 1), required: true
    });
    var dateText = h("span", { class: "fs-date-text", "aria-hidden": "true" });
    var wdNum = h("b", { class: "fs-val", text: String(wdVal) });
    var weNum = h("b", { class: "fs-val", text: String(weVal) });
    var fit = h("p", { class: "fs-fit", "data-fit": "ok", "aria-live": "polite" });
    var msg = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    var submit = h("button", { class: "btn-start", type: "submit" }, ["Clock in ", h("span", { "aria-hidden": "true", text: "→" })]);

    // the finish date: the transparent date input sits over the text, so a click opens the native picker
    target.addEventListener("click", function () {
      if (typeof target.showPicker === "function") {
        try { target.showPicker(); } catch (e) { /* the browser opens its own picker, or refuses: both are fine */ }
      }
    });
    var spans = h("div", { class: "fs-chips", role: "radiogroup", "aria-labelledby": dateQ });
    FS_SPANS.forEach(function (p) {
      var id = nextId("span");
      spans.appendChild(h("input", { type: "radio", name: spanName, id: id, value: addDays(t, p[0]) }));
      spans.appendChild(h("label", { for: id, text: p[1] }));
    });
    spans.addEventListener("change", function (e) {
      var v = e.target && e.target.value;
      if (isIso(v)) { target.value = v; refresh(); }
    });

    var wdBox = minutePills(nextId("wd"), FS_WD, wdVal, function (n) { wdVal = n; wdNum.textContent = String(n); refresh(); });
    var weBox = minutePills(nextId("we"), FS_WE, weVal, function (n) { weVal = n; weNum.textContent = String(n); refresh(); });
    wdBox.setAttribute("aria-labelledby", wdQ);
    weBox.setAttribute("aria-labelledby", weQ);

    function planRow(value, name, help) {
      var id = nextId("plan");
      return h("div", { class: "fs-plan" }, [
        h("input", { type: "radio", name: planName, id: id, value: value, checked: (set.plan === "all") === (value === "all") }),
        h("label", { for: id }, [h("span", { class: "fs-plan-name", text: name }), h("span", { class: "fs-plan-help", text: help })])
      ]);
    }
    var plans = h("div", { class: "fs-plans", role: "radiogroup", "aria-labelledby": planQ }, [
      planRow("core", "Core", "What interviews and day-to-day work need"),
      planRow("all", "Everything", "Core plus the bonus lessons")
    ]);
    plans.addEventListener("change", function () { refresh(); });

    function pickedPlan() {
      var picked = plans.querySelector("input[name='" + planName + "']:checked");
      return picked && picked.value === "all" ? "all" : "core";
    }
    function weekend(iso) {
      try { return !!DL.util.isWeekend(iso); } catch (e) { return false; }
    }
    // needed: the plan's minutes plus 10% for memory checks; have: each night from tomorrow to the finish date
    function fitLine() {
      var plan = pickedPlan(), list = sessionsFor(plan);
      var need = list.reduce(function (a, it) { return a + (Number(it.minutes) || 0); }, 0) * 1.1;
      var lead = (plan === "all" ? "Everything" : "Core") + ": " + plural(list.length, "stop") + ", about " +
        plural(Math.round(need / 60), "hour") + ".";
      var tgt = target.value;
      if (!isIso(tgt) || tgt <= t) return { ok: false, text: lead + " Pick a finish date after today." };
      var a = minutesValue(wdVal) || 0, b = minutesValue(weVal) || 0, have = 0;
      for (var i = 1; i <= 3660; i++) {
        var d = addDays(t, i);
        if (d > tgt) break;
        have += weekend(d) ? b : a;
      }
      var ok = have >= need;
      return {
        ok: ok,
        text: lead + " Your nights add up to about " + plural(Math.round(have / 60), "hour") + " before " + fmtDate(tgt, true) + ". " +
          (ok ? "It fits." : "That's tight: pick a later date or longer nights.")
      };
    }
    function refresh() {
      var v = target.value;
      dateText.textContent = isIso(v) ? fmtDate(v, true) : "pick a date";
      Array.prototype.forEach.call(spans.querySelectorAll("input"), function (r) { r.checked = r.value === v; });
      var f = fitLine();
      fit.setAttribute("data-fit", f.ok ? "ok" : "tight");
      fit.textContent = f.text;
    }
    target.addEventListener("input", refresh);
    target.addEventListener("change", refresh);
    function focusGroup(box) {
      var r = box.querySelector("input:checked") || box.querySelector("input");
      if (r) r.focus();
    }

    var guide = link("How it works", "guide");
    guide.setAttribute("data-route", "guide");
    var form = h("form", { class: "fs-form", novalidate: true, "aria-labelledby": titleId }, [
      h("div", { class: "fs-q" }, [
        h("p", { class: "fs-sentence", id: dateQ }, [
          "I'll finish by ",
          h("label", { class: "fs-date-wrap" }, [target, dateText]),
          "."
        ]),
        spans
      ]),
      h("div", { class: "fs-q" }, [
        h("p", { class: "fs-sentence", id: wdQ }, ["On weeknights I have ", wdNum, " minutes."]),
        wdBox
      ]),
      h("div", { class: "fs-q" }, [
        h("p", { class: "fs-sentence", id: weQ }, ["On weekends I have ", weNum, " minutes."]),
        weBox
      ]),
      h("div", { class: "fs-q" }, [
        h("p", { class: "fs-sentence", id: planQ, text: "Plan:" }),
        plans
      ]),
      fit,
      h("div", { class: "fs-actions" }, [submit, msg]),
      h("p", { class: "fs-new" }, ["New here? ", guide])
    ]);
    refresh();
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var plan = pickedPlan();
      var tgt = target.value;
      if (!isIso(tgt) || tgt <= t) { msg.textContent = "Pick a finish date after today."; target.focus(); return; }
      var a = minutesValue(wdVal), b = minutesValue(weVal);
      if (a === null) { msg.textContent = "Use minutes between 10 and 240, like 30."; focusGroup(wdBox); return; }
      if (b === null) { msg.textContent = "Use minutes between 10 and 240, like 60."; focusGroup(weBox); return; }
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
    return h("section", { class: "wrap section fs" }, [
      h("p", { class: "eyebrow", text: "Your first shift" }),
      h("h1", { class: "fs-title", id: titleId, text: "Set your pace." }),
      h("p", { class: "fs-lede", text: "If you miss a night, the rest spreads out on its own. Nothing nags." }),
      form
    ]);
  }

  /* ----- Tonight pieces (v2.0.0): queue rows, the night bar ----- */
  var COLD_MIN = 3;   // a cold case counts 3 minutes on Tonight
  function stopped(t) {
    t = String(t || "");
    return /[.?!…]["”’)]*$/.test(t) ? t : t + ".";
  }
  function courseAttr(course) { return course === "lt" ? "lt" : "dl"; }
  function rowKind(info) { return info.kind === "interview" || info.kind === "build" ? info.kind : "case"; }
  /* The short "where" line of a stop: the lesson's setting, or what kind of stop it is. */
  function infoSetting(info) {
    if (info.kind === "build") return capFirst(LABELS.weekendProject) + (info.project ? " · " + info.project : "");
    if (info.kind === "interview") return kindLabel(info);
    if (info.kind === "lld") return info.setting || "Low-level design";
    return info.setting || "";
  }
  function goLink(label, route, cls) {
    return navLink([label + " ", h("span", { "aria-hidden": "true", text: "→" })], route, cls || "q-go");
  }
  /* The tech topics of a lesson, as plain text (v3.1.0). */
  function topicsOf(info) {
    return (Array.isArray(info && info.topics) ? info.topics : []).map(plainText)
      .filter(function (t) { return t.trim() !== ""; }).slice(0, 4);
  }
  function isLessonKind(info) { return info.kind !== "build" && info.kind !== "interview"; }
  /* The lesson summary (v3.1.0, contract B): the story headline, the tech topics under it, then the code, the
     short title and the minutes. Without a hook (builds, interviews, lld) the title is the headline and is not
     repeated in the meta line. o: { route } makes the headline a link; { extra } adds one more meta bit. */
  function lsBlock(info, o) {
    o = o || {};
    var hook = plainText(info.hook || "").trim();
    var title = plainText(info.title || info.id || "");
    var headline = hook || title;
    var topics = topicsOf(info);
    var meta = [h("span", { class: "q-code", text: sessionKey(info) })];
    if (hook && title) meta.push(" · " + title);
    if (o.extra) meta.push(" · " + o.extra);
    if (info.minutes) meta.push(" · " + info.minutes + " min");
    return h("div", { class: "ls", "data-course": courseAttr(info.course) }, [
      h("p", { class: "ls-hook" }, o.route ? link(headline, o.route, "ls-link") : headline),
      topics.length ? h("p", { class: "ls-topic", text: topics.join(" · ") }) : null,
      h("p", { class: "ls-meta" }, meta)
    ]);
  }
  /* What the All lessons search matches: hook, title and topics, lower case. */
  function searchText(info) {
    return [plainText(info.hook || ""), plainText(info.title || ""), topicsOf(info).join(" ")].join(" ").toLowerCase();
  }
  /* One row of a list of stops: the lesson summary (or, for a project or interview, its title and setting),
     "bonus" when it applies, and a way in. */
  function queueRow(info) {
    var where = infoSetting(info);
    var goText = info.kind === "build" ? "Open the " + LABELS.weekendProject : info.kind === "interview" ? "Open the " + LABELS.practiceInterview : "Open the " + LABELS.lesson;
    if (isLessonKind(info)) {
      return h("li", { class: "q-row", "data-kind": rowKind(info), "data-course": courseAttr(info.course) }, [
        h("span", { class: "q-main" }, [
          lsBlock(info),
          info.core ? null : h("span", { class: "q-tag", text: "bonus" })
        ]),
        playable(info) ? goLink(goText, routeFor(info)) : null
      ]);
    }
    return h("li", { class: "q-row", "data-kind": rowKind(info), "data-course": courseAttr(info.course) }, [
      h("span", { class: "q-code", text: sessionKey(info) }),
      h("span", { class: "q-main" }, [
        h("span", { class: "q-title", text: info.title }),
        where ? h("span", { class: "q-set", text: where }) : null,
        info.core ? null : h("span", { class: "q-tag", text: "bonus" })
      ]),
      info.minutes ? h("span", { class: "q-min", text: info.minutes + " min" }) : null,
      playable(info) ? goLink(goText, routeFor(info)) : null
    ]);
  }
  /* A due memory check: a lesson id or a decision card id ("build:<milestone>"). Kept from v2 (unused on the journey). */
  function coldRow(d) {
    var id = d.id, t = today();
    var title = id, where = "", code = id, course = "dl", doneOn = null;
    if (isDecisionId(id)) {
      var bid = id.slice(6), m = buildMeta(bid) || { id: bid };
      var proj = projectOf(m);
      title = m.title || bid;
      where = capFirst(LABELS.weekendProject) + (proj.title ? " · " + proj.title : "");
      code = bid;
      course = courseOf(m);
      doneOn = buildRec(bid).done;
    } else {
      if (metaFor(id)) {
        var info = sessionInfo({ id: id });
        title = info.title || id;
        where = info.setting || "";
        code = sessionKey(info);
        course = info.course;
      }
      doneOn = caseRec(id).done;
    }
    var since = 0;
    try { since = isIso(doneOn) ? DL.util.daysBetween(doneOn, t) : 0; } catch (e) { since = 0; }
    return h("li", { class: "q-row", "data-kind": "cold", "data-course": courseAttr(course) }, [
      h("span", { class: "q-code", text: code }),
      h("span", { class: "q-main" }, [
        h("span", { class: "q-title", text: title }),
        where ? h("span", { class: "q-set", text: where }) : null,
        h("span", { class: "q-tag", text: "UPDATE" + (since > 0 ? " · " + laterText(since) : "") })
      ]),
      h("span", { class: "q-min", text: COLD_MIN + " min" }),
      goLink("Review", "reviews")
    ]);
  }
  function nbSeg(cls, min, title) {
    var el = h("span", { class: "seg " + cls, title: title });
    if (el.style) el.style.flexGrow = String(min);
    return el;
  }
  /* Tonight's minutes as one bar: cold cases, then each new session by course (or build), then spare time. */
  function nightBar(due, infos, total) {
    var now = new Date();
    var end = new Date(now.getTime() + total * 60000);
    var track = h("div", { class: "nb-track", role: "img" });
    var legend = h("div", { class: "nb-legend" });
    var said = [], used = 0;
    if (due.length) {
      var coldMin = due.length * COLD_MIN;
      due.forEach(function () { track.appendChild(nbSeg("seg-cold", COLD_MIN, "Cold case, " + COLD_MIN + " min")); });
      legend.appendChild(h("span", { class: "nb-key seg-cold" }, [h("b", { text: "Cold" }), " " + coldMin]));
      said.push(plural(due.length, "cold case") + ", " + coldMin + " min");
      used += coldMin;
    }
    infos.forEach(function (info) {
      var min = Number(info.minutes) || 0;
      if (min <= 0) return;
      var cls = info.kind === "build" ? "seg-build" : courseAttr(info.course) === "lt" ? "seg-lt" : "seg-dl";
      var code = sessionKey(info);
      track.appendChild(nbSeg(cls, min, code + " " + info.title + ", " + min + " min"));
      legend.appendChild(h("span", { class: "nb-key " + cls }, [h("b", { text: code }), " " + min]));
      said.push(code + " " + info.title + ", " + min + " min");
      used += min;
    });
    var spare = Math.round(total - used);
    if (spare > 0) {
      track.appendChild(nbSeg("seg-spare", spare, "Spare, " + spare + " min"));
      legend.appendChild(h("span", { class: "nb-key seg-spare" }, [h("b", { text: "Spare" }), " " + spare]));
      said.push(spare + " min spare");
    }
    track.setAttribute("aria-label", "Tonight's " + total + " minutes: " + (said.length ? said.join("; ") : "nothing planned") + ".");
    return h("div", { class: "night-bar" }, [
      h("div", { class: "nb-head" }, [
        h("span", { text: "Tonight's " + total + " minutes" }),
        h("span", { text: hhmm(now) + " now · ends about " + hhmm(end) })
      ]),
      track,
      legend
    ]);
  }
  /* ======================================================================
     The night's flow (v3.0.0, contract 3): S.flow and continueNext()
     ====================================================================== */
  /* In memory only, one per day: the memory checks already handled tonight (graded or skipped), the practice
     interviews put off with "Not now", and whether the journey plays the marker's arrival. Never in S.sess. */
  function flowState() {
    var t = today();
    if (!S.flow || S.flow.day !== t) S.flow = { day: t, handled: {}, notNow: {}, arrive: false };
    return S.flow;
  }
  function markHandled(id) { if (id) flowState().handled[id] = true; }
  /* "Skip this weekend" (contract 0): an ISO date in dl-snooze-<buildId>; Continue skips the build until then. */
  function snoozedUntil(id) {
    var v = lsGet(SNOOZE_KEY + id);
    return isIso(v) && v > today() ? v : null;
  }
  function nextSaturday(iso) {
    for (var i = 1; i <= 7; i++) {
      var d = addDays(iso, i);
      if (weekdayOf(d) === "Saturday") return d;
    }
    return addDays(iso, 7);
  }
  /* Put off for now (snoozed, or "Not now" tonight): Continue walks past it. */
  function putOff(it) { return !!(it && (snoozedUntil(it.id) || flowState().notNow[it.id])); }
  function plainText(t) { return String(t === null || t === undefined ? "" : t).replace(/[*_`]/g, ""); }
  /* The due memory checks Continue still has to walk tonight. */
  function flowDue(p) {
    var handled = flowState().handled;
    var list = (p && p.out && p.out.reviews) || (p && p.due) || [];
    return list.map(function (d) { return typeof d === "string" ? { id: d } : d; })
      .filter(function (d) { return d && d.id && !handled[d.id]; });
  }
  function tonightItems(p) {
    return ((p && p.out && p.out.newItems) || []).filter(function (it) { return it && it.id && !isDone(it.id); });
  }
  function firstPlayable(list) {
    for (var i = 0; i < list.length; i++) if (!putOff(list[i])) return list[i];
    return null;
  }
  /* Every Continue button calls this, the single source of "what's next": due memory checks first, then the
     first of tonight's items that isn't done or put off (a lesson opens at its saved step), then the journey,
     which shows the done-for-tonight state. */
  function continueNext() {
    var p = null;
    try { p = paceNow(); } catch (e) { p = null; }
    if (!p) { goRoute("tonight"); return; }
    if (flowDue(p).length) { goRoute("reviews"); return; }
    var item = firstPlayable(tonightItems(p));
    if (item) { goRoute(routeFor(sessionInfo(item))); return; }
    goRoute("tonight");
  }
  /* Back to the journey with the marker's arrival played (the Finish lesson panel, contract 3). */
  function backToJourney() {
    flowState().arrive = true;
    goRoute("tonight");
  }
  function continueButton() {
    var b = h("button", { class: "btn-continue", type: "button" }, ["Continue ", h("span", { "aria-hidden": "true", text: "→" })]);
    b.addEventListener("click", function () { continueNext(); });
    return b;
  }

  /* ======================================================================
     View: the journey  #tonight  (v3.0.0, contract 2) and the Journey map
     #journey (contract 7)
     ====================================================================== */
  /* "Sat 24 Oct" */
  function dowDate(iso) {
    if (!isIso(iso)) return String(iso || "");
    var p = iso.split("-");
    return weekdayOf(iso).slice(0, 3) + " " + Number(p[2]) + " " + MONTHS[Number(p[1]) - 1];
  }
  function weekendDay(iso) {
    try { return !!DL.util.isWeekend(iso); } catch (e) { return false; }
  }
  /* Date projection (contract 2, decided): walk the items in plan order and fill nights from tomorrow. A night
     holds the settings' minutes (weekendMin on Sat and Sun, weekdayMin otherwise) and each item its catalog
     minutes. When an item doesn't fit, everything after it waits for the next night (plan order is kept); only a
     weekend-only build is passed over on a weekday without holding the rest back. Returns { id: "YYYY-MM-DD" }. */
  function projectDates(items, t) {
    var set = settings();
    var wd = Number(set.weekdayMin) || 30, we = Number(set.weekendMin) || 60;
    var left = (items || []).slice(), out = {};
    for (var night = 1; night <= 730 && left.length; night++) {
      var d = addDays(t, night), weekend = weekendDay(d), cap = weekend ? we : wd, used = 0, blocked = false, keep = [];
      for (var i = 0; i < left.length; i++) {
        var it = left[i], min = Number(it.minutes) || 12;
        if (blocked || (it.weekendOnly && !weekend)) { keep.push(it); continue; }
        if (used > 0 && used + min > cap) { blocked = true; keep.push(it); continue; }
        out[it.id] = d;
        used += min;
      }
      left = keep;
    }
    return out;
  }
  /* "Gatekeeper step 1": the project and the milestone's place in it. */
  function buildStepNo(m) {
    var p = projectOf(m);
    var ids = Array.isArray(p.milestones) && p.milestones.length ? p.milestones
      : (catalog().builds || []).filter(function (x) { return x && x.project === m.project; }).map(function (x) { return x.id; });
    var i = ids.indexOf(m.id);
    return i >= 0 ? i + 1 : null;
  }
  function buildName(m) {
    m = m || {};
    var p = projectOf(m), n = buildStepNo(m);
    return plainText(p.title || m.projectTitle || m.project || m.title || m.id || "Project") + (n ? " step " + n : "");
  }
  function buildNameById(id) { return buildName(buildMeta(id) || { id: id }); }
  function stopKind(info) { return info.kind === "build" ? "project" : info.kind === "interview" ? "interview" : "lesson"; }
  /* One stop on the path: li.jr-stop with its dot and body (contract 2). o: kind, code, title, sub, when, done,
     landmark, course, cls; ls (a lesson's .ls block, shown instead of code and title, v3.1.0); open (a route:
     tapping the stop then offers "Open this lesson" or "Look at it", written as data-open). */
  function jrStop(o) {
    return h("li", {
      class: "jr-stop" + (o.done ? " is-done" : "") + (o.landmark ? " is-landmark" : "") + (o.cls ? " " + o.cls : ""),
      "data-kind": o.kind, "data-course": o.course ? courseAttr(o.course) : null, "data-open": o.open || null, tabindex: "0"
    }, [
      h("span", { class: "jr-dot", "aria-hidden": "true" }),
      h("div", { class: "jr-body" }, o.ls ? [
        o.when ? h("span", { class: "jr-when", text: o.when }) : null,
        o.ls,
        o.sub ? h("span", { class: "jr-sub", text: o.sub }) : null
      ] : [
        o.when ? h("span", { class: "jr-when", text: o.when }) : null,
        o.code ? h("span", { class: "q-code", text: o.code }) : null,
        o.code ? " " : null,
        h("span", { class: "jr-title", text: o.title }),
        o.sub ? h("span", { class: "jr-sub", text: o.sub }) : null
      ])
    ]);
  }
  /* A plan item as a stop. o: { done, when, sub } (sub undefined: minutes and setting for landmarks; nothing for a
     lesson, whose .ls block already says its code, title and minutes). */
  function itemStop(it, o) {
    o = o || {};
    var info = sessionInfo(it);
    var kind = stopKind(info);
    var m = kind === "project" ? (buildMeta(it.id) || { id: it.id }) : null;
    var title = kind === "project" ? capFirst(LABELS.weekendProject) + ": " + buildName(m)
      : kind === "interview" ? capFirst(LABELS.practiceInterview) + ": " + plainText(info.title) : plainText(info.title);
    var sub = o.sub;
    if (sub === undefined) {
      var mins = info.minutes ? info.minutes + " min" : "";
      sub = kind === "project" ? [mins, plainText(m.title || "")].filter(Boolean).join(" · ")
        : kind === "interview" ? [info.season ? "on Season " + info.season : "", "about " + (info.minutes || 30) + " min"].filter(Boolean).join(" · ")
        : "";
    }
    // the way in from the stop's explain line: a project page opens even while locked (it shows what's needed)
    var open = kind === "project" ? routeFor(info) : playable(info) ? routeFor(info) : null;
    return jrStop({
      kind: kind, code: kind === "lesson" ? sessionKey(info) : "", title: title, sub: sub, when: o.when,
      done: !!o.done, landmark: kind !== "lesson", course: info.course, open: open,
      ls: kind === "lesson" ? lsBlock(info) : null
    });
  }
  function seasonStop(s, when, done) {
    var se = seasonMeta(s.n, s.course);
    return jrStop({
      kind: "season", title: (multiCourse() ? courseTitle(s.course) + " " : "") + "Season " + s.n + " starts" + (se && se.title ? ": " + plainText(se.title) : ""),
      sub: "", when: when, done: !!done, landmark: true, course: s.course
    });
  }
  /* The first lesson of each season nothing has been finished in yet: { lessonId: { course, n } }. */
  function seasonStarts() {
    var out = {};
    courseList().forEach(function (co) {
      var started = {}, first = {};
      courseSessions(planOf(), co.id).forEach(function (it) {
        if (!it || it.kind === "build" || it.kind === "interview" || !it.season) return;
        if (isDone(it.id)) started[it.season] = true;
        if (!first[it.season]) first[it.season] = it.id;
      });
      Object.keys(first).forEach(function (k) { if (!started[k]) out[first[k]] = { course: co.id, n: Number(k) }; });
    });
    return out;
  }
  /* Finished seasons fold into one line each (every item of the season on your plan finished). */
  function foldedSeasons() {
    var out = [];
    courseList().forEach(function (co) {
      var groups = {}, order = [];
      courseSessions(planOf(), co.id).forEach(function (it) {
        if (!it || it.kind === "build" || !it.season) return;
        if (!groups[it.season]) { groups[it.season] = []; order.push(it.season); }
        groups[it.season].push(it);
      });
      order.forEach(function (n) {
        var items = groups[n];
        if (!items.every(function (it) { return isDone(it.id); })) return;
        var lessons = items.filter(function (it) { return it.kind !== "interview"; }).length;
        out.push({
          course: co.id, n: n,
          text: (multiCourse() && co.id !== "dl" ? courseTitle(co.id) + " " : "") + "Season " + n + " · " +
            plural(lessons, LABELS.lesson, LABELS.lessons) + ", done"
        });
      });
    });
    return out;
  }
  function doneOn(id) { return String(caseRec(id).done || buildRec(id).done || ""); }
  /* The last n finished stops outside the folded seasons, oldest first. */
  function pastStops(folded, n) {
    var skip = {};
    folded.forEach(function (f) { skip[f.course + ":" + f.n] = true; });
    var list = sessionsFor(planOf()).map(function (it, i) { return { it: it, i: i, d: doneOn(it.id) }; })
      .filter(function (x) { return x.d && !skip[courseOf(x.it) + ":" + x.it.season]; });
    list.sort(function (a, b) { return a.d === b.d ? a.i - b.i : (a.d < b.d ? -1 : 1); });
    return list.slice(-n).map(function (x) { return x.it; });
  }
  function dueTitle(id) {
    if (isDecisionId(id)) return buildNameById(id.slice(6));
    return plainText((metaFor(id) || {}).title || id);
  }
  /* Tonight's memory-check stop: "2 memory checks · 6 min · on Knock Knock and Three Handshakes". */
  function checkStop(due) {
    var titles = due.slice(0, 2).map(function (d) { return dueTitle(d.id); });
    var on = due.length > 2 ? titles.join(", ") + " and " + (due.length - 2) + " more" : joinList(titles);
    return jrStop({
      kind: "check", cls: "jr-check", title: plural(due.length, LABELS.memoryCheck, LABELS.memoryChecks),
      sub: (due.length * COLD_MIN) + " min · on " + on
    });
  }
  /* Short names for the marker's list. */
  function shortItem(it) {
    var info = sessionInfo(it);
    var name = info.kind === "build" ? capFirst(LABELS.weekendProject) + ": " + buildNameById(it.id)
      : info.kind === "interview" ? capFirst(LABELS.practiceInterview) + ": " + plainText(info.title)
      : plainText(info.title) + (multiCourse() && info.course === "lt" ? " (" + courseTitle("lt") + ")" : "");
    return name + (info.minutes ? " · " + info.minutes + " min" : "");
  }
  function nextPhrase(it) {
    var info = sessionInfo(it);
    if (info.kind === "build") return ["your " + LABELS.weekendProject + ", ", h("em", { text: buildNameById(it.id) })];
    if (info.kind === "interview") return ["a " + LABELS.practiceInterview + ", ", h("em", { text: plainText(info.title) })];
    // v3.1.0 (contract B): the first two topics, "a new lesson on HTTPS and TLS"; the title when there are none
    var topics = topicsOf(info).slice(0, 2);
    if (topics.length) return ["a new " + LABELS.lesson + " on " + joinList(topics)];
    return ["a new " + LABELS.lesson + ", ", h("em", { text: plainText(info.title) })];
  }
  /* One of tonight's items: a lesson as its .ls block (v3.1.0), anything else as a short line. */
  function tonightRow(it, cls, suffix) {
    var info = sessionInfo(it);
    if (isLessonKind(info)) return h("li", { class: cls || null }, suffix ? [lsBlock(info), h("span", { class: "jr-sub", text: suffix })] : lsBlock(info));
    return h("li", { class: cls || null, text: shortItem(it) + (suffix ? " · " + suffix : "") });
  }
  /* Tonight's items: the next one (shown in full) first, what's finished tonight (ticked), the memory checks, then
     what's left. `next` is the item Continue opens after the checks. */
  function tonightList(J, next) {
    var t = J.t, rows = [];
    if (next) rows.push(tonightRow(next, "jr-up", ""));
    var reviewed = ((state().daily || {})[t] || {}).reviews || 0;
    if (reviewed) rows.push(h("li", { class: "is-done", text: plural(reviewed, LABELS.memoryCheck, LABELS.memoryChecks) + " · done" }));
    sessionsFor(planOf()).forEach(function (it) {
      if (doneOn(it.id) === t) rows.push(tonightRow(it, "is-done", ""));
    });
    if (J.due.length) rows.push(h("li", { text: plural(J.due.length, LABELS.memoryCheck, LABELS.memoryChecks) + " · " + (J.due.length * COLD_MIN) + " min" }));
    J.tonight.forEach(function (it) {
      if (next && it.id === next.id) return;
      var off = putOff(it);
      rows.push(tonightRow(it, off ? "is-put-off" : "", off ? "not tonight" : ""));
    });
    return rows.length ? h("ul", { class: "jr-tonight", "aria-label": "Tonight" }, rows) : null;
  }
  /* The marker when nothing is left tonight: what tomorrow brings, and a quiet "Keep going anyway". */
  function doneState(J) {
    var t = J.t;
    if (!J.later.length && !J.tonight.length) {
      return [h("p", { class: "jr-next", text: J.p.waiting > 0
        ? "You've finished everything that's written so far. New lessons show up here as soon as they're ready. Memory checks keep coming in the meantime."
        : "You've reached the end of the plan. Memory checks keep coming so it stays with you." })];
    }
    var open = J.later.filter(function (it) { return !putOff(it); });
    var nextOne = open.filter(function (it) { return it.kind !== "build"; })[0] || open[0] || null;
    var tomorrow = addDays(t, 1), cards = state().cards || {}, checks = 0;
    Object.keys(cards).forEach(function (id) {
      var c = cards[id];
      if (c && isIso(c.due) && c.due > t && c.due <= tomorrow && cardKnown(id)) checks += 1;
    });
    var bits = [];
    if (checks) bits.push(plural(checks, LABELS.memoryCheck, LABELS.memoryChecks));
    if (nextOne) bits.push(plainText(sessionInfo(nextOne).title));
    var mins = checks * COLD_MIN + (nextOne ? Number(sessionInfo(nextOne).minutes) || 0 : 0);
    var out = [h("p", { class: "jr-next", text: "That's tonight done." + (bits.length ? " Tomorrow: " + joinList(bits) + ", about " + mins + " min." : "") })];
    if (nextOne) {
      var keep = h("button", { class: "jr-keep btn-link", type: "button", text: "Keep going anyway" });
      keep.addEventListener("click", function () { goRoute(routeFor(sessionInfo(nextOne))); });
      out.push(keep);
    }
    return out;
  }
  /* The "you are here" marker with the only big Continue button (contract 2). */
  function markerEl(J) {
    var next = firstPlayable(J.tonight);
    var kids = [h("p", { class: "jr-here", text: "You are here" })];
    if (J.due.length || next) {
      // v3.1.0 (contract B): the line stays short; the next lesson's full .ls block is the first item under Continue
      var line = ["Up next: "];
      if (J.due.length) line.push(plural(J.due.length, LABELS.memoryCheck, LABELS.memoryChecks));
      if (J.due.length && next) line.push(", then ");
      if (next) line = line.concat(nextPhrase(next));
      line.push(".");
      kids.push(h("p", { class: "jr-next" }, line));
      kids.push(continueButton());
    } else {
      kids = kids.concat(doneState(J));
    }
    var list = tonightList(J, next);
    if (list) kids.push(list);
    return h("li", { class: "jr-marker", id: "jr-marker" }, kids);
  }
  /* Ahead of the marker: tonight's items, then the plan in order, up to 12 lessons, plus every landmark within
     about 6 weeks (season starts before their first lesson), then the way to the Journey map. */
  function aheadStops(J, starts) {
    var lim = addDays(J.t, 42), shown = 0, hidden = 0, out = [];
    J.tonight.forEach(function (it) {
      if (starts[it.id]) out.push(seasonStop(starts[it.id], "", false));
      var sn = snoozedUntil(it.id), o = {};
      if (sn) o.sub = "skipped · waits for next weekend, " + dowDate(sn);
      else if (flowState().notNow[it.id]) o.sub = "not now · it waits for you";
      out.push(itemStop(it, o));
    });
    J.later.forEach(function (it) {
      var d = J.dates[it.id] || "", near = !!d && d <= lim, when = d ? "about " + dowDate(d) : "";
      if (it.kind === "build" || it.kind === "interview") {
        if (near) out.push(itemStop(it, { when: when })); else hidden += 1;
        return;
      }
      if (starts[it.id] && (shown < 12 || near)) out.push(seasonStop(starts[it.id], when, false));
      if (shown < 12) { out.push(itemStop(it, {})); shown += 1; } else hidden += 1;
    });
    out.push(h("li", { class: "jr-more" }, navLink(hidden ? "and " + plural(hidden, "more stop") + " → Journey map" : "The whole plan → Journey map", "journey")));
    return out;
  }
  /* Tapping a stop (or Enter / Space on it) toggles its one-line .jr-explain. A stop with data-open adds a way in
     (v3.1.0, contract D.3): "Open this lesson", or "Look at it" for projects and interviews, to read ahead or
     revisit. Opening a lesson this way never changes the plan: Continue still follows it. */
  function wireStops(ctx, list) {
    function toggle(li) {
      var ex = li.querySelector(".jr-explain");
      if (ex) { removeNode(ex); return; }
      var kind = li.getAttribute("data-kind");
      var text = JR_EXPLAIN[kind];
      if (!text) return;
      var route = li.getAttribute("data-open");
      li.appendChild(h("p", { class: "jr-explain" }, route ? [
        text, " ",
        navLink(kind === "lesson" ? "Open this lesson" : "Look at it", route, "jr-open")
      ] : text));
    }
    function onClick(e) {
      var tg = e.target;
      if (!tg || typeof tg.closest !== "function" || tg.closest("a, button, input, textarea, select")) return;
      var li = tg.closest(".jr-stop");
      if (li && list.contains(li)) toggle(li);
    }
    function onKey(e) {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      var li = e.target;
      if (!li || !li.classList || !li.classList.contains("jr-stop")) return;
      e.preventDefault();
      toggle(li);
    }
    listen(ctx, list, "click", onClick);
    listen(ctx, list, "keydown", onKey);
  }
  /* The sticky Continue bar shows only while #jr-marker is off screen: IntersectionObserver when it exists, else a
     throttled scroll check. No layout (jsdom) counts as on screen, so the bar stays hidden there. */
  function watchMarker(ctx, marker, bar) {
    var io = null, timer = 0;
    function setOn(visible) { bar.hidden = !!visible; }
    if (typeof root.IntersectionObserver === "function") {
      try {
        io = new root.IntersectionObserver(function (entries) {
          if (!ctx.alive) return;
          entries.forEach(function (en) { setOn(en.isIntersecting); });
        }, { threshold: 0 });
        io.observe(marker);
      } catch (e) { io = null; }
    }
    function check() {
      timer = 0;
      if (!ctx.alive) return;
      var r = null;
      try { r = marker.getBoundingClientRect(); } catch (e) { r = null; }
      if (!r || (!r.top && !r.height)) { setOn(true); return; }
      var vh = Number(root.innerHeight) || (doc.documentElement ? Number(doc.documentElement.clientHeight) || 0 : 0);
      setOn(r.bottom > 0 && (!vh || r.top < vh));
    }
    function onScroll() { if (!timer) timer = setTimeout(check, 120); }
    var listening = !io && typeof root.addEventListener === "function";
    if (listening) {
      root.addEventListener("scroll", onScroll, { passive: true });
      root.addEventListener("resize", onScroll);
    }
    ctx.cleanups.push(function () {
      if (io) { try { io.disconnect(); } catch (e) { /* gone */ } io = null; }
      if (timer) { clearTimeout(timer); timer = 0; }
      if (listening && typeof root.removeEventListener === "function") {
        root.removeEventListener("scroll", onScroll, { passive: true });
        root.removeEventListener("resize", onScroll);
      }
    });
  }
  /* Back from a finished lesson: the marker slides in from the previous stop (CSS .is-arriving) and is scrolled
     into view. */
  function arriveMarker(ctx, marker) {
    // --jr-from: how far the slide travels, the height of the stop just before the marker (CSS default -64px)
    var prev = marker.previousElementSibling, ph = prev ? Number(prev.offsetHeight) || 0 : 0;
    if (ph > 0 && marker.style && typeof marker.style.setProperty === "function") {
      try { marker.style.setProperty("--jr-from", (-Math.round(ph)) + "px"); } catch (e) { /* the CSS default applies */ }
    }
    if (marker.classList) marker.classList.add("is-arriving");
    var tm = setTimeout(function () { if (marker.classList) marker.classList.remove("is-arriving"); }, 600);
    ctx.cleanups.push(function () { clearTimeout(tm); });
    if (typeof marker.scrollIntoView === "function") {
      try { marker.scrollIntoView({ block: "center" }); } catch (e) {
        try { marker.scrollIntoView(); } catch (e2) { /* can't scroll here */ }
      }
    }
  }
  function journeyData() {
    var t = today();
    var p = paceNow();
    var tonight = tonightItems(p), ids = {};
    tonight.forEach(function (it) { ids[it.id] = true; });
    var later = (p.remaining || []).filter(function (it) { return it && it.id && !ids[it.id] && !isDone(it.id); });
    return { t: t, p: p, out: p.out || {}, due: flowDue(p), tonight: tonight, later: later, dates: projectDates(later, t) };
  }

  function viewTonight(ctx) {
    ctx.rerender = true;
    if (!settings().startedOn) { ctx.root.appendChild(firstShift()); return null; }
    var J = journeyData();
    var t = J.t, out = J.out, p = J.p, fl = flowState();
    var st = out.status || "on-track";
    var counts = planCounts();
    var nightN = 1;
    try { nightN = Math.max(1, (Number(DL.util.daysBetween(settings().startedOn, t)) || 0) + 1); } catch (e) { nightN = 1; }
    var sec = h("section", { class: "wrap section journey" });
    sec.appendChild(h("header", { class: "jr-head" }, [
      h("h1", { class: "sr-only", text: "Your journey" }),
      h("p", { class: "jr-kicker", text: "Your shift · night " + nightN }),
      h("p", { class: "jr-count", text: counts.done + " of " + counts.total + " stops" })
    ]));

    // behind or past the date: the pace sentence with its action (kept from v2, in plain words)
    if (st === "behind" || st === "past-target") {
      var act = h("div", { class: "ss-action" }, h("span", { text: paceText(out, p.target, p.waiting) }));
      if (st === "behind" && isIso(out.suggestedDate)) {
        var move = h("button", { class: "btn btn-small", type: "button", text: "Move my finish date to " + fmtDate(out.suggestedDate) });
        move.addEventListener("click", function () {
          move.disabled = true;
          saveSettings(function (s2) { s2.targetDate = out.suggestedDate; }).then(null, function () { move.disabled = false; });
        });
        act.appendChild(move);
      }
      if (st === "past-target") act.appendChild(link("Pick a new date in Settings", "settings", "btn btn-small"));
      sec.appendChild(act);
    }
    // "New here?" shows while the guide hasn't been opened or dismissed (the v1.2.4 callout's key).
    if (!lsGet(GUIDE_SEEN_KEY)) {
      var x = h("button", { class: "ss-x", type: "button", "aria-label": "Dismiss", text: "×" });
      var newHere = h("p", { class: "more-line jr-new" }, ["New here? ", navLink("How it works", "guide"), " ", x]);
      x.addEventListener("click", function () { lsSet(GUIDE_SEEN_KEY, "1"); removeNode(newHere); });
      sec.appendChild(newHere);
    }

    var path = h("ol", { class: "jr-path" });
    // the past: finished seasons folded, then the last 3 finished stops
    var folded = foldedSeasons();
    folded.forEach(function (f) { path.appendChild(h("li", { class: "jr-fold", text: f.text })); });
    pastStops(folded, 3).forEach(function (it) {
      var d = doneOn(it.id);
      path.appendChild(itemStop(it, { done: true, sub: d === t ? "finished tonight" : "finished " + fmtDate(d) }));
    });
    // tonight: the memory checks, the marker, then what's ahead
    path.appendChild(h("li", { class: "jr-night", text: "Tonight · " + dowDate(t) }));
    if (J.due.length) path.appendChild(checkStop(J.due));
    var marker = markerEl(J);
    path.appendChild(marker);
    aheadStops(J, seasonStarts()).forEach(function (li) { path.appendChild(li); });
    sec.appendChild(path);
    wireStops(ctx, path);

    var bar = null;
    if (marker.querySelector(".btn-continue")) {
      bar = h("div", { class: "continue-bar", hidden: true }, continueButton());
      sec.appendChild(bar);
    }
    sec.appendChild(storageLine());
    ctx.root.appendChild(sec);
    if (bar) watchMarker(ctx, marker, bar);
    if (fl.arrive) { fl.arrive = false; arriveMarker(ctx, marker); }
    return null;
  }

  /* The legend of the stop kinds, for the Journey map. */
  function jrLegend() {
    var kinds = [["lesson", LABELS.lesson], ["check", LABELS.memoryCheck], ["project", LABELS.weekendProject],
      ["interview", LABELS.practiceInterview], ["season", LABELS.season]];
    return h("ul", { class: "jr-legend", "aria-label": "What the stops mean" }, kinds.map(function (k) {
      return h("li", { "data-kind": k[0] }, [
        h("span", { class: "jr-dot", "aria-hidden": "true" }),
        h("b", { text: capFirst(k[1]) }), " ",
        h("span", { class: "jr-legend-what", text: JR_EXPLAIN[k[0]] })
      ]);
    }));
  }
  /* The Journey map (contract 7): every stop of the plan for each course on the board, done ticks, landmarks with
     their projected dates, and "you are here" before the first open stop. */
  function viewJourney(ctx) {
    ctx.rerender = true;
    var t = today(), J = null;
    try { J = journeyData(); } catch (e) { J = null; }
    var dates = (J && J.dates) || {}, tonightIds = {};
    if (J) J.tonight.forEach(function (it) { tonightIds[it.id] = true; });
    var target = settings().targetDate || addDays(t, 120);
    var sec = h("section", { class: "wrap section journey jr-map" }, h("header", { class: "sec-head" }, [
      h("p", { class: "eyebrow", text: "Journey map" }),
      h("h1", { text: "Your whole journey" }),
      h("p", { class: "lede", text: (multiCourse() ? "Both courses, start to finish." : "The whole course, start to finish.") +
        " A season is a set of lessons, like a TV season. Dates are guesses from your pace, aiming for " + fmtDate(target, true) +
        ", and move a little if you skip a night." })
    ]));
    var sw = boardSwitchInline();
    if (sw) sec.appendChild(sw);
    var note = filterNote();
    if (note) sec.appendChild(note);
    sec.appendChild(jrLegend());
    var markerPlaced = false;
    courseList().filter(function (c) { return boardShows(c.id); }).forEach(function (co) {
      var items = courseSessions(planOf(), co.id);
      if (!items.length) return;
      var path = h("ol", { class: "jr-path" });
      var seen = {}, here = false;
      items.forEach(function (it) {
        var done = isDone(it.id), d = dates[it.id] || "";
        var when = done ? "" : tonightIds[it.id] ? "tonight" : d ? "about " + dowDate(d) : "";
        var lm = it.kind === "build" || it.kind === "interview";
        if (!lm && it.season && !seen[it.season]) {
          seen[it.season] = true;
          path.appendChild(seasonStop({ course: co.id, n: it.season }, when, done));
        }
        if (!done && !here) {
          here = true;
          path.appendChild(h("li", { class: "jr-marker", id: markerPlaced ? null : "jr-marker" }, [
            h("p", { class: "jr-here", text: "You are here" }),
            h("p", { class: "jr-next", text: "Up next: " + shortItem(it) + "." })
          ]));
          markerPlaced = true;
        }
        var sub;
        if (done) sub = "done";
        else if (lm && !when) sub = it.kind === "build" ? "opens after its lessons" : "opens after the season's lessons";
        else if (!lm && it.status && it.status !== "ready") sub = "being written";
        else if (!lm && tonightIds[it.id]) sub = "tonight";
        path.appendChild(itemStop(it, { done: done, when: lm ? when : "", sub: sub }));
      });
      wireStops(ctx, path);
      sec.appendChild(h("section", { class: "jr-course", "data-course": courseAttr(co.id), "aria-label": co.title || co.id }, [
        h("header", { class: "course-head" }, [
          h("h2", { text: co.title || co.id }),
          co.board ? h("span", { class: "course-board", text: co.board }) : null
        ]),
        path
      ]));
    });
    sec.appendChild(h("p", { class: "more-line", text: "Memory checks aren't on this map: they come back on their own at the start of each night, and your journey shows the ones due." }));
    sec.appendChild(h("p", { class: "more-line" }, link("Back to your journey", "tonight")));
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
        var b = h("button", { class: "btn grade" + (g === res.suggested ? " suggested" : ""), type: "button", "aria-pressed": "false" }, gradeKids(g, opts));
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
  /* A grade button's content (contract 4): the plain label, then (on memory checks, opts.hints) the hint as a
     second small line and the real next date when opts.preview(g) knows it. */
  function gradeKids(g, opts) {
    var kids = [h("b", { text: GRADE_LABELS[g] || g })];
    if (opts && opts.hints && GRADE_HINTS[g]) kids.push(h("span", { class: "grade-hint", text: GRADE_HINTS[g] }));
    var when = "";
    if (opts && typeof opts.preview === "function") { try { when = opts.preview(g) || ""; } catch (e) { when = ""; } }
    if (when) kids.push(h("small", { class: "grade-when", text: when }));
    return kids;
  }
  /* The next date a grade gives a card, as "Sun 18 Oct" (empty when the scheduler can't say). */
  function gradePreview(orig, t) {
    return function (g) {
      var n = null;
      try { n = DL.sched.grade(orig, g, t); } catch (e) { n = null; }
      return n && isIso(n.due) ? dowDate(n.due) : "";
    };
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
      placeholder: "DL-G-" + (caseId || "lesson") + "-good" });
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
      if (!r) { say("No result code found. Claude's reply ends with a line like DL-G-" + (caseId || "lesson") + "-good.", "bad"); return; }
      if (r.kind !== "grade") { say("That's a practice interview code. Paste it on that interview's page.", "bad"); return; }
      if (!sameId(r.id, caseId)) { say("That code is for lesson " + r.id + ", not this one.", "bad"); return; }
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
      ctx.root.appendChild(messagePanel("Not on file", "There's no lesson called “" + id + "”.", null));
      return null;
    }
    setCourse(ctx, courseOf(meta));
    // A lesson page owns the progress line: the step you are on (the player sets it).
    ctx.readMode = true;
    setProgressLine(0, "read");
    ctx.root.appendChild(h("section", { class: "wrap" }, h("p", { class: "loading", role: "status", text: "Opening the lesson..." })));
    return DL.content.loadCase(id).then(function (c) {
      if (!ctx.alive) return;
      clear(ctx.root);
      buildCase(ctx, c || {}, meta);
    }, function (err) {
      if (!ctx.alive) return;
      clear(ctx.root);
      ctx.readMode = false;
      updateNav();
      var planned = meta.status && meta.status !== "ready";
      ctx.root.appendChild(planned
        ? messagePanel("Being written", "“" + (meta.title || id) + "” is still being written. It shows up here when it's ready.", null)
        : messagePanel("Couldn't open the lesson", "This lesson couldn't be opened. Reload the page to try again.", err));
    });
  }
  function messagePanel(eyebrow, title, err) {
    return h("section", { class: "wrap section" }, [
      head(eyebrow, title),
      err ? h("pre", { class: "err-detail", text: errMsg(err) }) : null,
      h("div", { class: "btn-row mt" }, [link("Back to the journey", "tonight", "btn"), link("All lessons", "seasons", "btn btn-ghost")])
    ]);
  }

  /* Each part of a lesson carries data-part="<key>" and id="part-<key>" (contract 5), for the lesson player. */
  function markPart(el, key) {
    if (!el) return el;
    el.setAttribute("data-part", key);
    el.id = "part-" + key;
    return el;
  }
  function buildCase(ctx, c, meta) {
    c.id = c.id || meta.id;
    var R = ctx.root;
    var story = h("section", { class: "wrap section", "aria-label": "The story" }, [
      caseCrumbs(c, meta),
      markPart(postEl(c), "post"),
      markPart(commentsEl(c.comments || []), "comments")
    ]);
    if (c.reply && c.reply.options && c.reply.options.length) {
      var rb = markPart(replyBox(ctx, c), "reply");
      story.appendChild(rb);
      // What happened next (part2) is the pick's follow-up. It moves out of the reply box to sit right after it, so
      // the player can show it as its own step (it stays in the DOM, locked until a pick).
      var result = rb.querySelector(".reply-result");
      if (result) story.appendChild(markPart(result, "part2"));
    }
    R.appendChild(story);
    if (c.sim && c.sim.module) R.appendChild(markPart(simSection(ctx, c), "sim"));
    R.appendChild(markPart(explainEl(c), "explain"));
    var tail = h("section", { class: "wrap section", "aria-label": "After the lesson" });
    var terms = termsEl(c);
    if (terms) tail.appendChild(markPart(terms, "terms"));
    if (c.atWork) tail.appendChild(markPart(h("div", { class: "block at-work" }, [h("h3", { text: LABELS.inYourJob })].concat(paras(c.atWork))), "work"));
    var pin = pinIt(c);
    if (pin) tail.appendChild(markPart(pin, "pin"));
    tail.appendChild(markPart(ownWords(c), "words"));
    tail.appendChild(markPart(closeBox(ctx, c), "close"));
    R.appendChild(tail);
    caseChrome(ctx, c, meta);
  }

  /* The lesson player (contract 5). It wraps the parts buildCase rendered: one part shows at a time (.is-active),
     the others get the hidden attribute and never leave the DOM, and a wrapper section that holds no active part
     is hidden too. Around them: the case bar (first child of the view), the step bar, the step head, the Words
     popover (W key) and the sticky Back / Next. body.lesson is on while a lesson is open (the CSS hides the global
     nav). Every listener and timer is removed in the view's cleanup and every browser API is checked first. The
     hash is the route, so nothing here touches location.hash.
     v3.1.0 (contract C and D): the Aa button is now "Reading" (layout, theme, text size); the step bar opens the
     contents sheet (.toc-sheet) to jump to any step; in the "whole" layout every present part shows at once, each
     after its own step head, part2 stays a locked line until a pick, there is no Back / Next, and the step bar
     follows the scroll position. */
  function stepInfo(key) { return STEP_INFO[key] || [capFirst(key), ""]; }
  /* The Reading panel (v3.1.0, contract C): .rd-panel, a popover under the Reading button (a bottom sheet on
     phones, by CSS). Layout, theme and text size, each saved in localStorage and applied at once. `btn` opens and
     closes it; the X or a click outside closes it (the lesson's Esc handler closes it too). o.onLayout(v) hears a
     layout change. Returns { el, isOpen, setOpen }. */
  function readingPanel(ctx, btn, o) {
    o = o || {};
    var x = h("button", { class: "rd-x", type: "button", "aria-label": "Close", text: "×" });
    function choice(label, list, cur, onPick) {
      var box = h("div", { class: "rd-opts", role: "group", "aria-label": label });
      var btns = list.map(function (it) {
        var b = h("button", { class: "rd-opt", type: "button", "data-value": it[0], "aria-pressed": String(it[0] === cur), text: it[1] });
        listen(ctx, b, "click", function () {
          btns.forEach(function (b2) { b2.setAttribute("aria-pressed", String(b2 === b)); });
          onPick(it[0]);
        });
        return b;
      });
      btns.forEach(function (b) { box.appendChild(b); });
      return h("div", { class: "rd-group" }, [h("p", { class: "rd-k", text: label }), box]);
    }
    var sizeOut = h("span", { class: "rd-size", "aria-live": "polite" });
    var smaller = h("button", { class: "rd-opt rd-step", type: "button", "aria-label": "Smaller text", text: "A-" });
    var larger = h("button", { class: "rd-opt rd-step", type: "button", "aria-label": "Larger text", text: "A+" });
    function syncSize() {
      var v = (doc.body && doc.body.getAttribute("data-text")) || textSize();
      var i = TEXT_SIZES.indexOf(v);
      if (i < 0) { i = 0; v = TEXT_SIZES[0]; }
      sizeOut.textContent = TEXT_SIZE_NAMES[v] || v;
      smaller.disabled = i <= 0;
      larger.disabled = i >= TEXT_SIZES.length - 1;
      btn.setAttribute("data-size", v);
    }
    var panel = h("div", { class: "rd-panel", id: "rd-panel", role: "dialog", "aria-label": "Reading", hidden: true, tabindex: "-1" }, [
      h("div", { class: "rd-head" }, [h("p", { class: "rd-title", text: "Reading" }), x]),
      choice("Layout", LAYOUTS, layoutPref(), function (v) {
        setLayoutPref(v);
        if (typeof o.onLayout === "function") o.onLayout(v);
      }),
      choice("Theme", THEMES, themePref(), function (v) { setThemePref(v); }),
      h("div", { class: "rd-group" }, [
        h("p", { class: "rd-k", text: "Text size" }),
        h("div", { class: "rd-opts", role: "group", "aria-label": "Text size" }, [smaller, sizeOut, larger])
      ])
    ]);
    function isOpen() { return !panel.hidden; }
    function setOpen(open) {
      if (!!open === isOpen()) return;
      var wasInside = !open && typeof panel.contains === "function" && panel.contains(doc.activeElement);
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(!!open));
      if (open) {
        syncSize();
        try { panel.focus({ preventScroll: true }); } catch (e) { /* not focusable */ }
      } else if (wasInside) {
        try { btn.focus(); } catch (e2) { /* not focusable */ }
      }
    }
    listen(ctx, btn, "click", function () { setOpen(!isOpen()); });
    listen(ctx, x, "click", function () { setOpen(false); });
    listen(ctx, smaller, "click", function () { stepTextSize(-1); syncSize(); });
    listen(ctx, larger, "click", function () { stepTextSize(1); syncSize(); });
    listen(ctx, doc, "click", function (e) {
      if (!isOpen()) return;
      var t = e.target;
      if (t && typeof panel.contains === "function" && (panel.contains(t) || (typeof btn.contains === "function" && btn.contains(t)))) return;
      setOpen(false);
    });
    syncSize();
    return { el: panel, isOpen: isOpen, setOpen: setOpen };
  }
  function caseChrome(ctx, c, meta) {
    var R = ctx.root;
    var body = doc.body;
    var info = sessionInfo({ id: c.id });
    var topics = topicsOf(info);
    var terms = (c.terms || []).map(function (t) { return t || {}; });
    var stepKey = STEP_KEY + c.id;
    var reopened = isDone(c.id);   // a finished lesson opens at step 1 with every step unlocked
    var picked = reopened || typeof caseRec(c.id).choice === "number";
    var finished = false;          // Finish lesson pressed in this visit
    var mode = layoutPref();       // "step" (one step at a time) or "whole" (the whole lesson)
    var parts = Array.prototype.map.call(R.querySelectorAll("[data-part]"), function (el) {
      return { key: el.getAttribute("data-part"), el: el, top: null, head: null };
    });
    var M = parts.length, cur = 0, wrappers = [], seen = 0;   // seen: the furthest step reached in this visit
    function topOf(el) {
      var n = el;
      while (n && n.parentNode && n.parentNode !== R) n = n.parentNode;
      return n;
    }
    parts.forEach(function (p) {
      p.top = topOf(p.el);
      if (p.top && p.top !== p.el && wrappers.indexOf(p.top) < 0) wrappers.push(p.top);
    });
    function indexOfKey(key) {
      for (var i = 0; i < parts.length; i++) if (parts[i].key === key) return i;
      return -1;
    }
    function locked(i) { var p = parts[i]; return !!p && p.key === "part2" && !picked; }

    // ----- the case bar, with the Reading button (contract C: the icon plus "Reading"; the CSS hides the label on
    // phones, so the accessible name is the aria-label) and its panel
    var aa = h("button", { class: "cb-aa", type: "button", "aria-label": "Reading", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": "rd-panel" }, [
      h("span", { class: "cb-aa-icon", "aria-hidden": "true", text: "Aa" }),
      h("span", { class: "cb-aa-label", "aria-hidden": "true", text: "Reading" })
    ]);
    var bar = h("div", { class: "case-bar", role: "navigation", "aria-label": "Lesson", "data-course": courseAttr(info.course) }, [
      navLink("← Journey", "tonight", "cb-back"),
      h("span", { class: "cb-where" }, [
        h("span", { class: "q-code", text: sessionKey(info) }), " ",
        h("em", { class: "cb-title", text: meta.title || c.title || c.id })
      ]),
      aa,
      h("span", { class: "clock", "aria-hidden": "true" })
    ]);
    // A layout change draws the lesson again in the new layout; the saved step and the pick carry over.
    var rd = readingPanel(ctx, aa, {
      onLayout: function () { if (ctx.alive && S.route) renderRoute(S.route, { focus: true }); }
    });

    // ----- the step bar (a button-like control that opens the contents sheet), the step head and the sticky
    // Back / Next. Step 1's head adds the topic line.
    var fill = h("span", { class: "step-fill" });
    var label = h("p", { class: "step-label", "aria-live": "polite" });
    var stepBar = h("div", {
      class: "step-bar", role: "button", tabindex: "0", "aria-haspopup": "dialog", "aria-expanded": "false",
      "aria-controls": "toc-sheet", title: "Jump to any step"
    }, [
      h("div", { class: "step-track", "aria-hidden": "true" }, fill),
      label,
      h("span", { class: "step-caret", "aria-hidden": "true", text: "▾" })
    ]);
    var title = h("h2", { class: "step-title", tabindex: "-1" });
    var what = h("p", { class: "step-what" });
    var topicLine = topics.length ? h("p", { class: "ls-topic step-topic", hidden: true, text: topics.join(" · ") }) : null;
    var stepHead = h("header", { class: "step-head" }, [title, what, topicLine]);
    var backBtn = h("button", { class: "step-back", type: "button" });
    var nextBtn = h("button", { class: "step-next btn-continue", type: "button" });
    var nav = h("div", { class: "step-nav", role: "group", "aria-label": "Lesson steps" }, [backBtn, nextBtn]);
    function btnText(btn, text, dir) {
      clear(btn);
      if (dir === "back") btn.appendChild(h("span", { "aria-hidden": "true", text: "← " }));
      btn.appendChild(doc.createTextNode(text));
      if (dir === "next") btn.appendChild(h("span", { "aria-hidden": "true", text: " →" }));
    }
    function refreshNav() {
      var key = parts[cur] ? parts[cur].key : "", last = cur >= M - 1;
      backBtn.hidden = finished;
      btnText(backBtn, cur === 0 ? "Journey" : "Back", "back");
      nextBtn.disabled = false;
      if (key === "reply" && !picked) { nextBtn.disabled = true; btnText(nextBtn, "Pick one to go on", ""); }
      else if (!last) btnText(nextBtn, "Next", "next");
      else if (reopened) btnText(nextBtn, "Back to the journey", "next");
      else if (finished) btnText(nextBtn, "Continue", "next");
      else btnText(nextBtn, LABELS.finish, "");
    }
    /* Makes step i (0-based) the current one: the labels, the fill, the progress line (pct = n / M) and the saved
       step. show() (step mode) and the scroll tracking (whole lesson) both use it. */
    function mark(i) {
      if (!M) return;
      i = Math.max(0, Math.min(M - 1, i));
      cur = i;
      if (i > seen) seen = i;
      var key = parts[i].key, inf = stepInfo(key);
      var pct = (i + 1) * 100 / M;
      label.textContent = "Step " + (i + 1) + " of " + M + " · " + inf[0];
      if (fill.style) fill.style.width = (Math.round(pct * 10) / 10) + "%";
      title.textContent = inf[0];
      what.textContent = inf[1];
      if (topicLine) topicLine.hidden = key !== "post";
      setProgressLine(pct, "read");
      lsSet(stepKey, String(i + 1));
      if (tocOpen()) fillToc();
    }
    function focusEl(el) {
      if (!el) return;
      try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) { /* not focusable */ } }
    }
    /* Shows step i (0-based) on its own (step mode): the part, then mark(i). */
    function show(i, move) {
      if (!M) { refreshNav(); return; }
      i = Math.max(0, Math.min(M - 1, i));
      var activeTop = parts[i].top;
      parts.forEach(function (p, j) {
        var on = j === i;
        p.el.hidden = !on;
        if (p.el.classList) { if (on) p.el.classList.add("is-active"); else p.el.classList.remove("is-active"); }
      });
      wrappers.forEach(function (w) { w.hidden = w !== activeTop; });
      mark(i);
      refreshNav();
      if (move) {
        scrollTop();
        focusEl(title);
      }
    }

    // ----- the whole lesson (layout "whole", contract C.1): every present part at once, each after its own step
    // head (title, "what this is", and the topic line on step 1). part2 stays hidden until a pick, with the locked
    // line in its place. No Back / Next: the step bar follows the scroll position.
    var lockLine = null, io = null, ioEnd = null, endFull = false, scrollTimer = 0, inView = {};
    function partIndexOf(el) {
      for (var j = 0; j < parts.length; j++) if (parts[j].el === el) return j;
      return -1;
    }
    function wholeLayout() {
      parts.forEach(function (p, j) {
        var par = p.el.parentNode;
        if (!p.head && par) {
          var inf = stepInfo(p.key);
          p.head = h("header", { class: "step-head step-head-inline", "data-step": String(j + 1) }, [
            h("h2", { class: "step-title", tabindex: "-1", text: inf[0] }),
            h("p", { class: "step-what", text: inf[1] }),
            p.key === "post" && topics.length ? h("p", { class: "ls-topic step-topic", text: topics.join(" · ") }) : null
          ]);
          par.insertBefore(p.head, p.el);
        }
        if (p.key === "part2" && !lockLine && par) {
          lockLine = h("p", { class: "step-locked", text: LOCKED_LINE });
          par.insertBefore(lockLine, p.el);
        }
        var lk = locked(j);
        p.el.hidden = lk;
        if (p.el.classList) { if (lk) p.el.classList.remove("is-active"); else p.el.classList.add("is-active"); }
      });
      if (lockLine) lockLine.hidden = picked;
      wrappers.forEach(function (w) { w.hidden = false; });
      stepHead.hidden = true;
      nav.hidden = true;
      watchScroll();
    }
    /* The current section by scroll position: the first part crossing a band near the top of the screen
       (IntersectionObserver), or the last part once it is fully on screen; else a throttled scroll check. */
    function pickFromView() {
      if (!ctx.alive) return;
      if (endFull) { if (cur !== M - 1) mark(M - 1); return; }
      var shown = Object.keys(inView).map(Number).sort(function (a, b) { return a - b; });
      if (shown.length && shown[0] !== cur) mark(shown[0]);
    }
    function checkScroll() {
      scrollTimer = 0;
      if (!ctx.alive) return;
      var vh = Number(root.innerHeight) || (doc.documentElement ? Number(doc.documentElement.clientHeight) || 0 : 0);
      if (!vh) return;
      var best = -1;
      parts.forEach(function (p, j) {
        if (p.el.hidden || typeof p.el.getBoundingClientRect !== "function") return;
        var r = null;
        try { r = p.el.getBoundingClientRect(); } catch (e) { r = null; }
        if (!r || (!r.top && !r.height)) return;   // no layout (jsdom)
        if (r.top <= vh * 0.3) best = j;
        if (j === M - 1 && r.top < vh && r.bottom <= vh) best = j;
      });
      if (best >= 0 && best !== cur) mark(best);
    }
    function onScroll() { if (!scrollTimer) scrollTimer = setTimeout(checkScroll, 120); }
    function watchScroll() {
      if (io || ioEnd || !M) return;
      if (typeof root.IntersectionObserver === "function") {
        try {
          io = new root.IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
              var j = partIndexOf(en.target);
              if (j < 0) return;
              if (en.isIntersecting) inView[j] = true; else delete inView[j];
            });
            pickFromView();
          }, { rootMargin: "-25% 0px -60% 0px", threshold: 0 });
          parts.forEach(function (p) { io.observe(p.el); });
          ioEnd = new root.IntersectionObserver(function (entries) {
            entries.forEach(function (en) { endFull = !!en.isIntersecting && Number(en.intersectionRatio) >= 0.98; });
            pickFromView();
          }, { threshold: [0, 1] });
          ioEnd.observe(parts[M - 1].el);
        } catch (e) {
          if (io) { try { io.disconnect(); } catch (e2) { /* gone */ } }
          if (ioEnd) { try { ioEnd.disconnect(); } catch (e3) { /* gone */ } }
          io = null; ioEnd = null;
        }
      }
      if (!io) {
        listen(ctx, root, "scroll", onScroll, { passive: true });
        listen(ctx, root, "resize", onScroll);
      }
    }
    ctx.cleanups.push(function () {
      if (io) { try { io.disconnect(); } catch (e) { /* gone */ } io = null; }
      if (ioEnd) { try { ioEnd.disconnect(); } catch (e2) { /* gone */ } ioEnd = null; }
      if (scrollTimer) { clearTimeout(scrollTimer); scrollTimer = 0; }
      inView = {};
    });
    /* Goes to step i: shown on its own (step mode) or scrolled to (whole lesson). A locked step stays shut. */
    function goStep(i, focus) {
      if (i < 0 || i >= M || locked(i)) return;
      if (mode !== "whole") { show(i, focus !== false); return; }
      var target = parts[i].head || parts[i].el;
      if (target && typeof target.scrollIntoView === "function") {
        try { target.scrollIntoView({ block: "start" }); } catch (e) {
          try { target.scrollIntoView(); } catch (e2) { /* can't scroll here */ }
        }
      }
      mark(i);
      if (focus !== false && parts[i].head) focusEl(parts[i].head.querySelector(".step-title"));
    }
    function goNext() {
      if (nextBtn.disabled) return;
      if (cur < M - 1) { if (!locked(cur + 1)) show(cur + 1, true); return; }
      if (reopened) { goRoute("tonight"); return; }
      if (finished) { backToJourney(); return; }
      if (typeof ctx.finishLesson === "function") ctx.finishLesson();
    }
    /* The step before the current one, passing over a locked part2 (the contents sheet can jump past it). */
    function prevOpen() {
      var i = cur - 1;
      while (i >= 0 && locked(i)) i -= 1;
      return i;
    }
    function goBack() {
      var i = prevOpen();
      if (i >= 0) { show(i, true); return; }
      goRoute("tonight");
    }
    listen(ctx, backBtn, "click", goBack);
    listen(ctx, nextBtn, "click", goNext);
    // The reply box and the close box were built before the player: they call these hooks. In the whole lesson a
    // pick opens part2 in place of its locked line.
    ctx.onLessonPick = function () {
      if (picked) return;
      picked = true;
      if (mode === "whole") {
        var pi = indexOfKey("part2");
        if (pi >= 0) {
          parts[pi].el.hidden = false;
          if (parts[pi].el.classList) parts[pi].el.classList.add("is-active");
        }
        if (lockLine) lockLine.hidden = true;
      }
      refreshNav();
    };
    ctx.onLessonFinished = function () { finished = true; refreshNav(); };

    // ----- the contents sheet (contract D.1): every present step with its "what this is" and its state (done,
    // current, locked with the reason). A row jumps there (step mode) or scrolls there (whole lesson). The X, Esc
    // or a tap on the scrim closes it.
    var tocList = h("ol", { class: "toc-list" });
    var tocX = h("button", { class: "toc-x", type: "button", "aria-label": "Close", text: "×" });
    var toc = h("div", { class: "toc-sheet", id: "toc-sheet", role: "dialog", "aria-label": "Steps in this lesson", hidden: true, tabindex: "-1" }, [
      h("div", { class: "toc-head" }, [h("p", { class: "toc-title", text: "Steps in this lesson" }), tocX]),
      tocList
    ]);
    var tocScrim = h("div", { class: "toc-scrim", hidden: true, "aria-hidden": "true" });
    function tocOpen() { return !!toc && !toc.hidden; }
    function fillToc() {
      clear(tocList);
      parts.forEach(function (p, i) {
        var inf = stepInfo(p.key);
        var st = locked(i) ? "locked" : i === cur ? "current" : (reopened || finished || i < seen) ? "done" : "todo";
        var row = h("button", {
          class: "toc-row", type: "button", "data-state": st, "data-step": String(i + 1),
          "aria-current": st === "current" ? "step" : null, "aria-disabled": st === "locked" ? "true" : null
        }, [
          h("span", { class: "toc-mark", "aria-hidden": "true", text: st === "done" ? "✓" : st === "current" ? "•" : String(i + 1) }),
          h("span", { class: "toc-text" }, [
            h("span", { class: "toc-name", text: inf[0] }),
            h("span", { class: "toc-what", text: inf[1] }),
            st === "locked" ? h("span", { class: "toc-why", text: "pick your advice first" }) : null
          ]),
          st === "done" ? h("span", { class: "sr-only", text: " (done)" }) : st === "current" ? h("span", { class: "sr-only", text: " (you are here)" }) : null
        ]);
        row.addEventListener("click", function () {
          if (locked(i)) return;
          setToc(false, true);
          goStep(i, true);
        });
        tocList.appendChild(h("li", { class: "toc-item" }, row));
      });
    }
    /* open: show or hide; quiet: don't move focus back to the step bar (a row moves it to the step instead). */
    function setToc(open, quiet) {
      if (!!open === tocOpen()) return;
      if (open) {
        rd.setOpen(false);
        setWords(false);
        fillToc();
        toc.hidden = false;
        tocScrim.hidden = false;
        stepBar.setAttribute("aria-expanded", "true");
        focusEl(toc.querySelector(".toc-row[data-state='current']") || toc);
        return;
      }
      var wasInside = typeof toc.contains === "function" && toc.contains(doc.activeElement);
      toc.hidden = true;
      tocScrim.hidden = true;
      stepBar.setAttribute("aria-expanded", "false");
      if (wasInside && !quiet) focusEl(stepBar);
    }
    listen(ctx, stepBar, "click", function () { setToc(!tocOpen()); });
    listen(ctx, stepBar, "keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      e.preventDefault();
      setToc(!tocOpen());
    });
    listen(ctx, tocX, "click", function () { setToc(false); });
    listen(ctx, tocScrim, "click", function () { setToc(false); });

    // ----- the Words popover (the lesson's glossary), the pill and the W key
    var pill = null, pop = null, wpOpen = null, opener = null;
    if (terms.length) {
      pill = h("button", { class: "words-pill", type: "button", "aria-expanded": "false", "aria-controls": "words-pop" }, [
        LABELS.words + " ", h("b", { text: String(terms.length) }), " ", h("kbd", { text: "W" })
      ]);
      var ti0 = indexOfKey("terms");
      wpOpen = ti0 >= 0 ? h("button", { class: "wp-open", type: "button", text: "Go to step " + (ti0 + 1) + ", " + LABELS.words + " →" }) : null;
      pop = h("div", { class: "words-pop", id: "words-pop", hidden: true, role: "dialog", "aria-label": "Words in this lesson", tabindex: "-1" }, [
        h("p", { class: "wp-head" }, ["Words in this lesson ", h("span", { text: String(terms.length) })]),
        h("dl", { class: "wp-list" }, terms.map(function (t) {
          return h("div", { class: "wp-item" }, [h("dt", { md: t.term || "" }), h("dd", { md: t.def || "" })]);
        })),
        wpOpen
      ]);
    }
    function wordsOpen() { return !!pop && !pop.hidden; }
    function setWords(open, from) {
      if (!pop) return;
      var wasInside = !open && typeof pop.contains === "function" && pop.contains(doc.activeElement);
      pop.hidden = !open;
      pill.setAttribute("aria-expanded", String(!!open));
      if (open) {
        opener = from || pill;
        try { pop.focus({ preventScroll: true }); } catch (e) { /* not focusable */ }
      } else if (wasInside && opener) {
        try { opener.focus(); } catch (e2) { /* not focusable */ }
      }
    }
    if (pop) {
      listen(ctx, pill, "click", function () { setWords(!wordsOpen(), pill); });
      if (wpOpen) {
        listen(ctx, wpOpen, "click", function () {
          opener = null;   // focus goes to the step title, not back to the pill
          setWords(false);
          var ti = indexOfKey("terms");
          if (ti >= 0) goStep(ti, true);
        });
      }
    }
    function onDocClick(e) {
      if (!wordsOpen()) return;
      var t = e.target;
      if (t && typeof pop.contains === "function" && (pop.contains(t) || pill.contains(t))) return;
      setWords(false);
    }
    function typing(tg) {
      var tag = tg && tg.tagName ? String(tg.tagName).toLowerCase() : "";
      return tag === "input" || tag === "textarea" || tag === "select" || !!(tg && tg.isContentEditable);
    }
    function onKey(e) {
      if (!ctx.alive) return;
      var k = e.key;
      if (k === "Escape" || k === "Esc") {
        if (e.defaultPrevented || isMenuOpen()) return;   // the menu took this Esc
        // one layer at a time: the contents sheet, then the Reading panel, then the Words popover
        if (tocOpen()) { e.preventDefault(); setToc(false); }
        else if (rd.isOpen()) { e.preventDefault(); rd.setOpen(false); }
        else if (wordsOpen()) { e.preventDefault(); setWords(false); }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;   // keys in a text box (or the sim's sliders) stay there
      if ((k === "w" || k === "W") && pop) {
        e.preventDefault();
        setWords(!wordsOpen(), pill);
        return;
      }
      // the arrow keys step through the lesson in step mode; in the whole lesson they scroll the page as usual
      if (mode === "whole" || tocOpen()) return;
      if (k === "ArrowRight" || k === "Right") {
        if (!nextBtn.disabled && cur < M - 1 && !locked(cur + 1)) { e.preventDefault(); show(cur + 1, true); }
        return;
      }
      if ((k === "ArrowLeft" || k === "Left") && prevOpen() >= 0) {
        e.preventDefault();
        show(prevOpen(), true);
      }
    }

    // ----- put it on the page: the bar (with the Reading panel right after it), the step bar and head first; the
    // Words pill and popover, the contents sheet, then Back / Next last
    R.insertBefore(bar, R.firstChild);
    R.insertBefore(rd.el, bar.nextSibling);
    R.insertBefore(stepBar, rd.el.nextSibling);
    R.insertBefore(stepHead, stepBar.nextSibling);
    if (pop) {
      R.appendChild(pill);
      R.appendChild(pop);
    }
    R.appendChild(tocScrim);
    R.appendChild(toc);
    R.appendChild(nav);
    if (body && body.classList) body.classList.add("lesson");
    if (R.setAttribute) R.setAttribute("data-layout", mode);

    // resume at the saved step (dl-step-<id>), never on a locked step; a finished lesson starts at step 1
    var start = 0;
    if (!reopened) {
      var saved = parseInt(lsGet(stepKey), 10);
      if (isFinite(saved) && saved >= 1) start = Math.min(saved, M) - 1;
      while (start > 0 && locked(start)) start -= 1;
    }
    seen = start;
    if (mode === "whole" && M) {
      wholeLayout();
      mark(start);
      refreshNav();
      if (start > 0) goStep(start, false);   // resume: scroll to the saved step, focus stays where the page put it
    } else {
      show(start, false);
    }
    listen(ctx, doc, "keydown", onKey);
    listen(ctx, doc, "click", onDocClick);
    updateClock();

    ctx.cleanups.push(function () {
      if (body && body.classList) body.classList.remove("lesson");
      if (R.removeAttribute) R.removeAttribute("data-layout");
      ctx.onLessonPick = null;
      ctx.onLessonFinished = null;
      ctx.finishLesson = null;
    });
  }

  function caseCrumbs(c, meta) {
    var season = c.season || meta.season;
    var bits = [];
    if (season) bits.push("Season " + season + (c.n || meta.n ? ", " + LABELS.lesson + " " + (c.n || meta.n) : ""));
    if (c.minutes || meta.minutes) bits.push((c.minutes || meta.minutes) + " min");
    var core = c.core !== undefined ? c.core : meta.core;
    return h("div", { class: "case-crumbs" }, [
      link("All lessons", "seasons"),
      h("span", { "aria-hidden": "true", text: "/" }),
      h("span", { text: bits.join(" · ") }),
      core ? null : h("span", { class: "chip", text: "bonus" }),
      isDone(c.id) ? h("span", { class: "chip ok", text: isCredited(c.id) ? "Credited from LATENT" : "finished" }) : null
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

  /* Your pick (step 3) and What happened next (step 4). The .reply-result is built here and moved out of the box by
     buildCase, so it can be its own step; the lesson player owns its hidden attribute, and a pick tells the player
     through ctx.onLessonPick. The verdict also shows inside the box, so step 3 answers the pick at once. */
  function replyBox(ctx, c) {
    var reply = c.reply || {};
    var opts = reply.options || [];
    var verdict = h("span", { class: "verdict" });
    var part2 = h("blockquote", { class: "part2" });
    var senior = h("span");
    var result = h("div", { class: "reply-result", hidden: true, "aria-live": "polite" }, [
      verdict,
      h("p", { class: "part2-label", text: LABELS.part2 }),
      part2,
      h("p", { class: "senior" }, [h("strong", { text: "A senior would say:" }), " ", senior])
    ]);
    var inVerdict = h("span", { class: "verdict" });
    var picked = h("div", { class: "reply-picked", hidden: true, "aria-live": "polite" }, [
      inVerdict,
      h("p", { class: "muted small", text: "Next shows what happened next." })
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
      var tone = o.tone === "ok" || o.tone === "warn" ? o.tone : "bad";
      buttons.forEach(function (b, j) { b.setAttribute("aria-pressed", String(j === i)); });
      result.setAttribute("data-tone", tone);
      result.setAttribute("data-picked", "true");
      verdict.textContent = o.verdict || "";
      part2.innerHTML = mdHtml(o.part2 || "");
      senior.innerHTML = mdHtml(o.senior || "");
      picked.hidden = false;
      picked.setAttribute("data-tone", tone);
      inVerdict.textContent = o.verdict || "";
    }
    function pick(i, store) {
      show(i);
      if (typeof ctx.onLessonPick === "function") ctx.onLessonPick();
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
      h("h2", { id: "reply-h", class: "reply-h", text: "Your pick" }),
      reply.prompt ? h("p", { class: "reply-sub", md: reply.prompt }) : null,
      h("div", { class: "choices" }, buttons),
      picked,
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
      h("p", { text: "A small simulator of the system in the story. It starts when this step opens, or right now:" }),
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
        h("p", { text: "The sim couldn't start. The rest of the lesson still works." }),
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
        h("p", { class: "eyebrow", text: LABELS.tryIt + " · a small simulator" }),
        h("h2", { id: "sim-h", md: sim.title || LABELS.tryIt }),
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
      h("p", { class: "eyebrow", text: "What was really going on" }),
      h("h2", { id: "ex-h", text: LABELS.explanation }),
      ex.oneLine ? h("p", { class: "oneline", md: ex.oneLine }) : null,
      c.rule && c.rule.n ? h("p", { class: "rule-tie", text: "This lesson explains Rule " + c.rule.n + "." }) : null
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
    // Open by default: Words is a step of its own in the lesson player.
    return h("div", { class: "block" }, h("details", { class: "terms", open: true }, [
      h("summary", { text: LABELS.words + " (" + terms.length + ")" }),
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
      h("h2", { class: "part-head", text: LABELS.quickCheck }),
      h("p", { class: "lede", text: "One question, from memory. The lesson comes back later as a memory check, right before you'd forget it." }),
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
      h("h3", { text: LABELS.yourNote }),
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
  /* Builds open (unlocked, not done) right now, to name the ones a finished lesson just unlocked. */
  function openBuildIds() {
    return (catalog().builds || []).filter(function (m) { return m && m.id && !buildRec(m.id).done && buildUnlocked(m.id); })
      .map(function (m) { return m.id; });
  }
  /* When a finished lesson comes back: tomorrow, then 3, 7 and 21 days, about 2 and about 4 months later. */
  function scheduleLine(t) {
    var gaps = [[1, "tomorrow"], [3, "3 days"], [7, "7 days"], [21, "21 days"], [60, "~2 months"], [120, "~4 months"]];
    var d = t;
    return h("ol", { class: "sched", "aria-label": "When it comes back" }, gaps.map(function (g, i) {
      d = addDays(d, g[0]);
      return h("li", { class: "sc" + (i === 0 ? " first" : "") }, [
        h("span", { class: "sc-dot", "aria-hidden": "true" }),
        h("span", { class: "sc-gap", text: g[1] }),
        h("span", { class: "sc-date", text: dowDate(d) })
      ]);
    }));
  }
  /* Finish lesson (step 11, contract 3 and 5). Its button finishes the lesson, then the panel says when it comes
     back, what just unlocked, and Continue goes back to the journey, where the marker has moved. The player's Next
     on this step calls the same finish (ctx.finishLesson) and hears back through ctx.onLessonFinished. */
  function closeBox(ctx, c) {
    var box = h("div", { class: "close-box", "aria-live": "polite" });
    var busy = false;
    function renderDone(justClosed, unlocked) {
      clear(box);
      box.classList.add("done");
      var t = today(), rec = caseRec(c.id), card = cardFor(c.id);
      if (justClosed) {
        var info = sessionInfo({ id: c.id });
        box.appendChild(h("p", { class: "cp-k" }, [h("span", { class: "q-code", text: sessionKey(info) }), " " + plainText(info.title || c.title || c.id)]));
        box.appendChild(h("p", { class: "cp-lede", tabindex: "-1", text: "Lesson finished. It comes back as a memory check tomorrow, then in 3, 7 and 21 days." }));
        box.appendChild(scheduleLine(t));
        (unlocked || []).forEach(function (m) {
          box.appendChild(h("p", { class: "cp-unlocked", text: "Unlocked: " + capFirst(LABELS.weekendProject) + ", " + buildName(m) }));
        });
      } else {
        var line = "You finished this lesson on " + fmtDate(rec.done) + ".";
        if (isCredited(c.id)) {
          line = "Credited from LATENT on " + fmtDate(rec.done) + ", for finishing " + joinList(rec.creditedFrom.map(function (x) {
            return (metaFor(x) || {}).title || x;
          })) + ". Their memory checks cover this one.";
        }
        if (card) {
          var dueNow = false;
          try { dueNow = DL.sched.isDue(card, t); } catch (e) { dueNow = false; }
          line += dueNow ? " Its memory check is waiting for you now." : " It comes back as a memory check " + DL.sched.nextReviewText(card, t) + ".";
        }
        box.appendChild(h("p", { text: line }));
      }
      if (c.rule && c.rule.n) box.appendChild(h("p", { class: "muted", text: "Rule " + c.rule.n + "'s reason is now in " + LABELS.rules + "." }));
      if (c.next) box.appendChild(h("p", { class: "teaser", md: c.next }));
      if (justClosed) {
        var cont = h("button", { class: "btn-continue", type: "button" }, ["Continue ", h("span", { "aria-hidden": "true", text: "→" })]);
        cont.addEventListener("click", function () { backToJourney(); });
        box.appendChild(h("div", { class: "btn-row" }, cont));
      } else {
        box.appendChild(h("div", { class: "btn-row" }, link("Back to the journey", "tonight", "btn")));
      }
    }
    function finish() {
      if (busy || isDone(c.id)) return;
      busy = true;
      btn.disabled = true;
      var before = openBuildIds();
      closeCase(c.id).then(function () {
        busy = false;
        if (!ctx.alive) return;
        var fresh = openBuildIds().filter(function (id) { return before.indexOf(id) < 0; }).map(buildMeta).filter(Boolean);
        renderDone(true, fresh);
        if (typeof ctx.onLessonFinished === "function") ctx.onLessonFinished();
        var lede = box.querySelector(".cp-lede");
        if (lede) { try { lede.focus({ preventScroll: true }); } catch (e) { /* not focusable */ } }
      }, function (err) {
        busy = false;
        btn.disabled = false;
        box.appendChild(h("p", { class: "diagram-error", text: "Couldn't save: " + errMsg(err) }));
      });
    }
    var btn = h("button", { class: "btn btn-primary", type: "button", text: LABELS.finish });
    if (isDone(c.id)) {
      renderDone(false);
    } else {
      btn.addEventListener("click", finish);
      ctx.finishLesson = finish;
      box.appendChild(h("p", { text: "That's every step. Press Finish lesson to save it. You'll see when it comes back and what's next." }));
      box.appendChild(h("div", { class: "btn-row" }, btn));
    }
    return h("div", { class: "block" }, [h("h2", { class: "part-head", text: LABELS.finish }), box]);
  }

  /* ======================================================================
     View: memory checks  #reviews
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
        h("p", { class: "c-meta" }, [h("span", { class: "user", text: guideOf(courseOf(metaFor(id))) }), " replied to your lesson:"]),
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
      hints: true,
      preview: gradePreview(orig, t),
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
  /* A decision card's answer box (contract 9.7): answer from memory, then your own note from the weekend project is
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
      out.appendChild(h("div", { class: "model" }, [h("p", { class: "part2-label", text: "Your note from the " + LABELS.weekendProject })].concat(
        note ? paras(note) : [h("p", { class: "muted", text: "You didn't leave a note when you marked it done. Compare your answer with what you remember building." })]
      )));
      out.appendChild(h("p", { class: "field-k", text: "How did you do?" }));
      var next = h("p", { class: "next-line" });
      var grades = ["missed", "partly", "good", "easy"];
      var btns = grades.map(function (g) {
        var b = h("button", { class: "btn grade", type: "button", "aria-pressed": "false" }, gradeKids(g, opts));
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
        h("span", { class: "flair", text: capFirst(LABELS.weekendProject) }),
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
      hints: true,
      preview: gradePreview(orig, t),
      // Graded from the card as it was when the view opened, like the lesson cards.
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
  function continueRow() { return h("div", { class: "btn-row" }, continueButton()); }
  function shiftOver(n) {
    var nextCard = soonestCard();
    return h("div", { class: "shift-over" }, [
      h("h2", { tabindex: "-1", text: capFirst(LABELS.memoryChecks) + " done." }),
      h("p", { text: n ? "You did " + plural(n, LABELS.memoryCheck, LABELS.memoryChecks) + " tonight." : "Nothing was graded this time. They'll be back." }),
      nextCard ? h("p", { class: "muted", text: "The next one comes back " + DL.sched.nextReviewText(nextCard, today()) + "." }) : null,
      continueRow()
    ]);
  }
  function emptyReviews() {
    var any = Object.keys(state().cards || {}).length > 0;
    var nextCard = soonestCard();
    var line = !any
      ? "Finish a lesson and its memory checks start showing up here, right before you'd forget it."
      : nextCard ? "The next memory check comes back " + DL.sched.nextReviewText(nextCard, today()) + "." : "";
    return h("div", { class: "shift-over" }, [
      h("h2", { text: "Nothing to check tonight." }),
      line ? h("p", { class: "muted", text: line }) : null,
      continueRow()
    ]);
  }
  /* Memory checks (contract 4). One at a time; Continue after each one goes to the next, and after the last one
     straight on through continueNext() (usually into tonight's lesson). Graded or skipped checks are marked in
     S.flow, so Continue never sends you back to one you already did tonight. */
  function viewReviews(ctx) {
    var titleEl = h("h1", { text: capFirst(LABELS.memoryChecks) });
    var sec = h("section", { class: "wrap section" }, h("header", { class: "sec-head" }, [
      h("p", { class: "eyebrow", text: capFirst(LABELS.memoryChecks) }),
      titleEl,
      h("p", { class: "mc-explain", text: "A quick question on a lesson you finished. Answer from memory, then grade yourself honestly." })
    ]));
    sec.appendChild(h("p", { class: "muted" }, ["New to memory checks? ", link("How they work", "guide")]));
    ctx.root.appendChild(sec);
    var queue = dueList().map(function (d) { return d.id; });
    if (!queue.length) { sec.appendChild(emptyReviews()); return null; }
    var prog = h("p", { class: "review-progress", "aria-live": "polite" });
    var stage = h("div", { class: "review-stage" });
    sec.appendChild(prog);
    sec.appendChild(stage);
    var idx = 0, graded = 0;
    function advance() { markHandled(queue[idx]); idx += 1; show(true); }
    function addNext(fb) {
      var last = idx >= queue.length - 1;
      var nextBtn = h("button", { class: "btn-continue", type: "button" }, [
        last ? "Continue " : "Continue: " + LABELS.memoryCheck + " " + (idx + 2) + " of " + queue.length + " ",
        h("span", { "aria-hidden": "true", text: "→" })
      ]);
      if (last) {
        nextBtn.addEventListener("click", function () {
          markHandled(queue[idx]);
          nextBtn.disabled = true;
          continueNext();
        });
      } else {
        nextBtn.addEventListener("click", advance);
      }
      fb.appendChild(h("div", { class: "btn-row" }, nextBtn));
    }
    function show(focus) {
      if (!ctx.alive) return null;
      clear(stage);
      if (idx >= queue.length) {
        prog.textContent = "";
        titleEl.textContent = capFirst(LABELS.memoryChecks);
        stage.appendChild(shiftOver(graded));
        if (focus) focusFirst(stage, "h2");
        return null;
      }
      var id = queue[idx];
      var countGraded = function () { graded += 1; markHandled(id); };
      titleEl.textContent = capFirst(LABELS.memoryCheck) + " " + (idx + 1) + " of " + queue.length;
      prog.textContent = "About " + ((queue.length - idx) * COLD_MIN) + " min left.";
      if (isDecisionId(id)) {
        stage.appendChild(decisionCard(id, countGraded, addNext));
        if (focus) focusFirst(stage, "h2");
        return null;
      }
      stage.appendChild(h("p", { class: "loading", role: "status", text: "Opening the lesson..." }));
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
          h("p", { text: "This lesson couldn't be opened. Its memory check stays for next time." }),
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
  /* v2.0.0: each row starts with its code (S2·03) and ends with its minutes; the next playable row of the
     season you are in gets .is-next and a "next" tag. */
  function seasonItem(it, isNext) {
    var info = sessionInfo(it);
    var isIv = info.kind === "interview";
    var done = isDone(it.id), canOpen = playable(info);
    var ready = isIv ? interviewOpen(it) : canOpen;
    var kind = isIv ? capFirst(LABELS.practiceInterview) : info.kind === "lld" ? "Low-level design" : info.setting;
    var rec = isIv ? interviewRec(it.id) : null;
    // The row's tick already says done; a chip only adds a credit or an interview score.
    var doneText = isCredited(it.id) ? "Credited from LATENT"
      : rec && typeof rec.score === "number" && typeof rec.max === "number" ? rec.score + "/" + rec.max : "";
    var stateText = ready ? "ready" : isIv ? "after the lessons" : "being written";
    // v3.1.0 (contract B): the row is the lesson summary (.ls: headline, topics, then code, title and minutes),
    // the headline linked when the lesson can be opened. Every ready lesson opens from here, ahead of the plan too;
    // that never moves the plan. data-q is what the search matches (hook, title and topics, lower case).
    var lessonKind = isIv || info.kind === "lld" ? kind : "";
    return h("li", { class: "season-item" + (isNext ? " is-next" : ""), "data-q": searchText(info) }, [
      h("span", { class: "si-mark" + (done ? " done" : ready ? " ready" : ""), "aria-hidden": "true", text: done ? "✓" : ready ? "•" : "·" }),
      h("div", { class: "si-title" }, lsBlock(info, { route: canOpen ? routeFor(info) : null, extra: lessonKind })),
      h("div", { class: "chips" }, [
        isNext ? h("span", { class: "q-tag", text: "next" }) : null,
        info.core ? null : h("span", { class: "chip", text: "bonus" }),
        done ? (doneText ? h("span", { class: "chip ok", text: doneText }) : null) : ready ? null : h("span", { class: "chip", text: stateText })
      ])
    ]);
  }
  /* The first open, playable row of a season (on your plan), or -1. */
  function nextInSeason(items) {
    var core = planOf() === "core";
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (isDone(it.id)) continue;
      var inf = sessionInfo(it);
      if (core && !inf.core) continue;
      if (inf.kind === "interview" ? interviewOpen(it) : playable(inf)) return i;
    }
    return -1;
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
    var list = h("ol", { class: "seasons timeline" });
    var seasons = (catalog().seasons || []).filter(function (se) { return se && courseOf(se) === cid; })
      .sort(function (a, b) { return a.n - b.n; });
    seasons.forEach(function (se) {
      var items = groups[se.n] || [];
      var coreItems = items.filter(function (it) { return sessionInfo(it).core; });
      var doneAll = items.filter(function (it) { return isDone(it.id); }).length;
      var solved = coreItems.length > 0 && coreItems.every(function (it) { return isDone(it.id); });
      var here = !solved && se.n === current;
      var key = cid + ":" + se.n;
      var openMap = S.seasonOpen || (S.seasonOpen = {});
      var isOpen = hasOwn(openMap, key) ? !!openMap[key] : here;
      var pct = items.length ? Math.round(doneAll * 100 / items.length) : 0;
      var chip = solved ? h("span", { class: "chip ok", text: "Done" })
        : here ? h("span", { class: "chip warn", text: "You are here" })
        : h("span", { class: "chip", text: items.length ? doneAll + " of " + items.length + " finished" : "being written" });
      var bar = h("span", { class: "s-prog-fill" });
      bar.style.width = pct + "%";
      var prog = h("div", { class: "s-prog", role: "img", "aria-label": doneAll + " of " + items.length + " finished" }, bar);
      var summary = h("summary", { class: "season-head" }, [
        h("span", { class: "s-n", text: "S" + se.n }),
        h("div", null, [
          h(withHead ? "h3" : "h2", { md: se.title || "Season " + se.n }),
          se.rank ? h("p", { class: "s-rank", text: se.rank }) : null,
          se.blurb ? h("p", { class: "s-blurb", md: se.blurb }) : null,
          prog
        ]),
        chip
      ]);
      var nextIdx = here ? nextInSeason(items) : -1;
      var body = items.length ? h("ul", { class: "season-items" }, items.map(function (it, i) { return seasonItem(it, i === nextIdx); }))
        : h("p", { class: "season-empty", text: "Lessons for this season are being written." });
      var det = h("details", { class: "season-det" }, [summary, body]);
      if (isOpen) det.open = true;
      // the All lessons search opens seasons for a while (data-search holds how they were): not a choice to keep
      det.addEventListener("toggle", function () { if (!det.hasAttribute("data-search")) openMap[key] = det.open; });
      list.appendChild(h("li", { class: "season-block" + (solved ? " solved" : here ? " here" : "") }, [
        h("span", { class: "tl-dot", "aria-hidden": "true" }),
        det
      ]));
    });
    if (groups[0] && groups[0].length) {
      var moreKey = cid + ":0";
      var moreMap = S.seasonOpen || (S.seasonOpen = {});
      var moreDet = h("details", { class: "season-det" }, [
        h("summary", { class: "season-head" }, [h("span", { class: "s-n", text: "+" }), h("div", null, h(withHead ? "h3" : "h2", { text: "More lessons" }))]),
        h("ul", { class: "season-items" }, groups[0].map(function (it) { return seasonItem(it, false); }))
      ]);
      if (hasOwn(moreMap, moreKey) && moreMap[moreKey]) moreDet.open = true;
      moreDet.addEventListener("toggle", function () { if (!moreDet.hasAttribute("data-search")) moreMap[moreKey] = moreDet.open; });
      list.appendChild(h("li", { class: "season-block" }, [
        h("span", { class: "tl-dot", "aria-hidden": "true" }),
        moreDet
      ]));
    }
    if (!withHead) return list;
    var hid = nextId("course");
    var coreAll = courseSessions(planOf(), cid).filter(function (it) { return it.kind !== "build"; });
    var coreDone = coreAll.filter(function (it) { return isDone(it.id); }).length;
    return h("section", { class: "course-group", "data-course": cid, "aria-labelledby": hid }, [
      h("header", { class: "course-head" }, [
        h("h2", { id: hid, text: course.title || cid }),
        course.board ? h("span", { class: "course-board", text: course.board }) : null,
        course.tagline ? h("p", { class: "course-tag", text: course.tagline }) : null,
        h("p", { class: "course-prog", text: coreDone + " of " + coreAll.length + " stops on your plan finished" })
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
        h("span", { class: "si-kind", text: m.id + " · " + capFirst(LABELS.weekendProject) + " · " + (m.minutes || 75) + " min" })
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
        h("p", { class: "course-tag", text: "Weekend projects: real code on weekends, in your own GitHub repos. A step unlocks when its lessons are finished." })
      ]),
      h("ol", { class: "seasons" }, blocks)
    ]);
  }

  function viewSeasons(ctx) {
    ctx.rerender = true;
    var multi = multiCourse();
    var counts = planCounts();
    var target = settings().targetDate || addDays(today(), 120);
    // v2.0.0: the lede is one mono line (closed of total, plan, finish date), then the board switcher.
    // v3.1.0 (contract D.2): "All lessons", with a search box at the top.
    var sec = h("section", { class: "wrap section" }, h("header", { class: "sec-head" }, [
      h("p", { class: "eyebrow", text: "Every lesson" }),
      h("h1", { text: "All lessons" }),
      h("p", { class: "season-sum", text: counts.done + " of " + counts.total + " finished · " + planWord() + " plan, finish " + fmtDate(target, true) })
    ]));
    var search = h("input", {
      type: "search", class: "ls-search", placeholder: "Search lessons: a word, a topic, a story",
      "aria-label": "Search lessons", autocomplete: "off", spellcheck: "false"
    });
    search.value = S.lsQuery || "";
    var none = h("p", { class: "ls-empty", role: "status", hidden: true, text: "No lessons match" });
    sec.appendChild(search);
    var sw = boardSwitchInline();
    if (sw) sec.appendChild(sw);
    var note = filterNote();
    if (note) sec.appendChild(note);
    sec.appendChild(none);
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
    listen(ctx, search, "input", function () { lessonSearch(sec, search, none); });
    if (S.lsQuery) lessonSearch(sec, search, none);
    return null;
  }
  /* The All lessons search (v3.1.0, contract D.2): every word of the query must appear in a row's hook, title or
     topics (case-insensitive). Rows that don't match are hidden, seasons with a match open for the search (and go
     back to how they were when it is cleared), seasons and courses with none are hidden, and the projects step
     aside. Nothing left: one line, "No lessons match". */
  function lessonSearch(sec, input, none) {
    var raw = String(input.value || "");
    S.lsQuery = raw;
    var words = raw.toLowerCase().split(/\s+/).filter(Boolean);
    var on = words.length > 0, shown = 0;
    function each(sel, fn) { Array.prototype.forEach.call(sec.querySelectorAll(sel), fn); }
    each(".season-item[data-q]", function (li) {
      var hay = li.getAttribute("data-q") || "";
      var ok = !on || words.every(function (w) { return hay.indexOf(w) >= 0; });
      li.hidden = !ok;
      if (ok) shown += 1;
    });
    each("details.season-det", function (det) {
      var block = det.parentNode;
      var hit = false;
      Array.prototype.forEach.call(det.querySelectorAll(".season-item[data-q]"), function (li) { if (!li.hidden) hit = true; });
      if (on) {
        if (!det.hasAttribute("data-search")) det.setAttribute("data-search", det.open ? "open" : "shut");
        if (hit) det.open = true;
        if (block && block.classList && block.classList.contains("season-block")) block.hidden = !hit;
      } else {
        var was = det.getAttribute("data-search");
        if (was) {
          det.removeAttribute("data-search");
          det.open = was === "open";
        }
        if (block && block.classList && block.classList.contains("season-block")) block.hidden = false;
      }
    });
    each(".course-group", function (g) {
      if (g.classList && g.classList.contains("projects")) { g.hidden = on; return; }
      var any = false;
      Array.prototype.forEach.call(g.querySelectorAll(".season-item[data-q]"), function (li) { if (!li.hidden) any = true; });
      g.hidden = on && !any;
    });
    none.hidden = !(on && shown === 0);
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
    el.textContent = "Finding the reason in its lesson...";
    DL.content.loadCase(caseId).then(function (c) {
      if (!ctx.alive) return;
      var ex = (c && c.explain) || {};
      var tag = ex.fix && ex.fix.title ? capFirst(String(ex.fix.title).replace(/^the fix:\s*/i, "").replace(/\.$/, "")) + "." : "";
      setReason(el, tag, ex.seniorTake || ex.oneLine || "");
    }, function () {
      if (ctx.alive) el.textContent = "The lesson couldn't be opened just now.";
    });
  }
  function redaction(n) {
    var a = 22 + (n * 17) % 26, b = 14 + (n * 29) % 30;
    var wrap = h("div", { class: "redacted", role: "img", "aria-label": "Reason hidden until you finish this rule's lesson" });
    [a, b].forEach(function (w) { var sp = h("span"); sp.style.width = w + "%"; wrap.appendChild(sp); });
    return wrap;
  }
  /* ======================================================================
     View: how it works  #guide   (v1.2.4)
     ====================================================================== */
  /* v3.0.0: rewritten in plain words (contract 1): the journey, Continue, lessons, memory checks, weekend
     projects, practice interviews and how to remember more. */
  var GUIDE = [
    { h: "What this is", p: [
      "Every lesson is a short story from someone who works at night: a radio producer, a nurse, a train dispatcher. Something strange happens to them. Behind it is a real lesson about how computer systems work.",
      "You can start knowing nothing about computers. Lesson by lesson you build up what a senior engineer knows: not just the words, but why systems break and how to choose a fix.",
      "There are two courses. **Dead Letter** teaches system design: how websites and apps, and the data behind them, are built so they keep working. **LATENT** teaches AI engineering: how to build useful, safe products on top of AI models."
    ] },
    { h: "Your journey and Continue", p: [
      "Home is your journey: one path from top to bottom. What you finished sits above, faded. What's ahead sits below. The **You are here** marker shows where you are tonight.",
      "You only ever need one button: **Continue**. It walks the night in order: first your memory checks, then tonight's lessons, then back to your journey with the marker moved on. When tonight is done, it says so, and tells you what tomorrow brings.",
      "Tap any stop on the path to see what it is. The **Journey map** in the Menu shows the whole plan for both courses, with rough dates for what's ahead."
    ] },
    { h: "A lesson, step by step", p: [
      "A lesson shows one step at a time, about 12 minutes in all. Back and Next sit at the bottom (the arrow keys work too), and it remembers the step you were on if you stop halfway.",
      "Tap the step bar at the top to see every step and jump to any of them. The **Reading** button sets the layout (one step at a time, or the whole lesson on one page), the theme (Night, or Paper for a light page) and the text size."
    ], list: [
      "**The story.** Someone on a night shift tells you what happened. Read it like a mystery: the clue is always in there.",
      "**The comments.** Other people reply. Some ask good questions; others argue for answers that sound right but aren't. Not all of them are right.",
      "**Your pick.** Pick the advice you would give. A wrong pick costs nothing.",
      "**What happened next.** What your advice led to. Most of the learning is here.",
      "**Try it.** A small simulator of the system in the story. Change its settings and watch it fail, then recover. You can't break anything real.",
      "**The explanation.** What was really going on, step by step. Then the fix, its limits, the trade-off, how a senior engineer thinks about it, a real incident, and how job interviews ask about it.",
      "**Words.** Every technical word in the lesson, in plain words. Press W (or the Words button) on any step to look one up.",
      "**In your job.** Where you would meet this at work.",
      "**Quick check.** One question, answered from memory, without scrolling back.",
      "**Your note.** One or two sentences in your own words. Your note comes back to you later.",
      "**Finish lesson.** Saves the lesson and plans its memory checks."
    ] },
    { h: "Memory checks", p: [
      "A memory check is a quick question on a lesson you finished, coming back right before you would forget it. The person from the story posts an UPDATE, and you answer from memory, without re-reading the lesson first. Then you grade yourself honestly.",
      "Each lesson comes back 1 day after you finish it, then 3 days later, 7 days, 3 weeks, 2 months and 4 months. How you grade your answer moves it:"
    ], list: [
      "**Didn't remember:** it comes back tomorrow, and the gaps start again.",
      "**Half:** the same gap again.",
      "**Got it:** the next, longer gap.",
      "**Easy:** it skips a gap."
    ], after: [
      "A memory check more than 3 days late starts to fade, and its card on How it connects cracks. Continue always puts memory checks first. They take a few minutes."
    ] },
    { h: "Weekend projects", p: [
      "A weekend project is a small, real program you build in your own GitHub repo (your project's folder on GitHub), with ready-made instructions for Claude Code. Each one uses what a few lessons taught, about 75 minutes on a Saturday or Sunday. They unlock as you go.",
      "The page gives you four steps: copy the instructions, build it, add a tag when it works, then press **Check it**. Not this weekend? **Skip this weekend** moves it to next Saturday. Nothing is lost."
    ] },
    { h: "Practice interviews", p: [
      "When you finish a season, its practice interview waits for you. Claude plays the interviewer and asks about that season, like a real job interview, on claude.ai. It takes about 30 minutes. It's practice: you can't fail, and you can take it again.",
      "Copy the interview room, paste it into claude.ai, answer Claude's questions, then paste the result code back on the page. **Not now** keeps it waiting on your journey."
    ] },
    { h: "Why from memory", p: [
      "Reading something again feels like learning, but most of it slips away within days. Pulling an answer out of your own memory, even a half answer or a wrong one, is what makes it stay.",
      "Getting it wrong is part of the method, not a failure. A memory check you didn't remember simply comes back sooner."
    ] },
    { h: "How to remember more", list: [
      "**Answer before you look.** Even a guess helps more than re-reading.",
      "**Say it out loud,** as if explaining it to a friend who has never heard of it.",
      "**Write your note in your own words,** one or two plain sentences. Don't copy the explanation.",
      "**Draw it.** Boxes and arrows on paper, like the lesson's diagrams.",
      "**Connect it.** Open How it connects and find which earlier lesson this one explains.",
      "**Little and often.** A lesson a night plus your memory checks beats a long weekend session.",
      "**When a word feels fuzzy,** press W in the lesson to open its Words."
    ] },
    { h: "The rest of the site", list: [
      "**Journey:** your path for tonight and what's ahead, with the one Continue button.",
      "**Memory checks:** the ones due today.",
      "**Journey map:** the whole plan for both courses, with rough dates.",
      "**All lessons:** every lesson in order, and where you are, with a search box. You can open any ready lesson from here, ahead of your plan too. Continue still follows your plan.",
      "**Notes:** your own explanations, newest first.",
      "**How it connects:** a board of your finished lessons, joined with red string where they explain each other.",
      "**The rules:** short rules from the stories, each a real engineering habit. You learn why when you finish its lesson.",
      "**Settings:** your pace, your finish date, and moving your progress to another device."
    ] },
    { h: "Studying on two devices", p: [
      "Your progress is saved in this browser on this device. To carry it to your phone or another computer, open **Settings**, find **Move my progress to another device**, copy the link, and open it on the other device. It merges the two, keeping the most recent work.",
      "Automatic syncing between devices is being built."
    ] }
  ];
  /* The guide's own text: **bold** runs become <strong>; the rest goes through md (italics only). */
  function guideText(tag, t) {
    var parts = String(t).split(/\*\*(.+?)\*\*/), kids = [];
    parts.forEach(function (p, i) {
      if (!p) return;
      kids.push(i % 2 ? h("strong", { text: p }) : h("span", { md: p }));
    });
    return h(tag, null, kids);
  }
  function viewGuide(ctx) {
    lsSet(GUIDE_SEEN_KEY, "1");
    var sec = h("section", { class: "wrap section guide" }, head("Start here", "How it works",
      "How your journey works, what each step of a lesson is for, what memory checks are, and how to make it stick."));
    GUIDE.forEach(function (g) {
      var kids = [h("h2", { text: g.h })].concat((g.p || []).map(function (t) { return guideText("p", t); }));
      if (g.list) kids.push(h("ul", null, g.list.map(function (t) { return guideText("li", t); })));
      (g.after || []).forEach(function (t) { kids.push(guideText("p", t)); });
      sec.appendChild(h("div", { class: "block" }, kids));
    });
    sec.appendChild(h("p", null, link("Back to your journey", "tonight", "btn btn-primary")));
    ctx.root.appendChild(sec);
    return null;
  }
  function viewRules(ctx) {
    ctx.rerender = true;
    var t = today();
    var rules = (catalog().rules || []).slice().sort(function (a, b) { return a.n - b.n; });
    var sec = h("section", { class: "wrap section" }, head(LABELS.rules, "The rules, and why they exist",
      "Every rule on the note is a real engineering practice. You earn the reason by finishing its lesson. Rules you don't revisit start to fade."));
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
          var txt = "Learned" + (meta.season ? " in Season " + meta.season : "");
          if (card) txt += due ? " · memory check due" : " · next memory check " + DL.sched.nextReviewText(card, t);
          status.appendChild(h("span", { class: "chip ok", text: txt }));
        }
        if (due) status.appendChild(link("Check it now", "reviews", "btn btn-small"));
        status.appendChild(link("Reread the lesson", "case/" + caseId, "btn btn-small btn-ghost"));
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
    if (!order.length) { sec.appendChild(h("p", { class: "muted", text: "These lessons don't pin any cards yet." })); return; }

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
        s("title", null, cd.title + (cd.fading ? " (fading: its memory check is overdue)" : "")),
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
        "Red string means “these explain each other.” A dashed, cracked card is fading: its memory check is overdue.",
        fadingCount ? [" ", link("Open the memory checks", "reviews")] : null
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
    var sec = h("section", { class: "wrap section" }, head(LABELS.connects, "How it all connects",
      "Every lesson you finish pins its cards and red string here. Ideas that connect to other ideas are the ones that last."));
    var sw = boardSwitchInline();
    if (sw) sec.appendChild(sw);
    var note = filterNote();
    if (note) sec.appendChild(note);
    ctx.root.appendChild(sec);
    var ids = doneCaseIds();
    if (!ids.length) {
      sec.appendChild(h("div", { class: "empty-state" }, [
        h("p", { class: "empty-title", text: "Nothing pinned yet" }),
        h("p", { class: "muted", text: note
          ? "Nothing pinned from " + courseTitle(S.board) + " yet. Finish one of its lessons and its cards go up here."
          : "Nothing pinned yet. Finish your first lesson and its cards go up here." }),
        h("div", { class: "btn-row" }, link("Open your journey", "tonight", "btn btn-primary"))
      ]));
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
      sec.appendChild(h("p", { class: "muted", text: "No notes yet. Each lesson has a Your note step to put it in your own words. Those land here." }));
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
  /* The interview's course name and subject for the room and the text-only prompt (v1.2.5). `c` is a course
     info object (courses-v1.0.2.json) or null. */
  function courseTitleOf(c) { return c && typeof c.title === "string" && c.title ? c.title : "Dead Letter"; }
  function subjectOf(c) {
    if (c && typeof c.subject === "string" && c.subject) return c.subject;
    return c && c.id === "lt" ? "AI engineering" : "system design";
  }
  /* One pass over the template, so a filled value is never filled again. Title and level land in HTML text,
     so they are escaped; the id lands in JS strings too and is kept to [A-Za-z0-9_-]. */
  function fillRoom(html, iv, level, course) {
    var values = {
      INTERVIEW_ID: String(iv.id || "").replace(/[^A-Za-z0-9_-]/g, ""),
      INTERVIEW_TITLE: escapeHtml(iv.title || iv.id || ""),
      LEVEL: escapeHtml(level || ""),
      SEASON: escapeHtml(typeof iv.season === "number" ? String(iv.season) : ""),
      COURSE: escapeHtml(courseTitleOf(course)),
      SUBJECT: escapeHtml(subjectOf(course))
    };
    return String(html).replace(/\{\{(INTERVIEW_ID|INTERVIEW_TITLE|LEVEL|SEASON|COURSE|SUBJECT)\}\}/g, function (m, k) { return values[k]; });
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
      ctx.root.appendChild(messagePanel("Not on file", "There's no practice interview called “" + ctx.arg + "”.", null));
      return null;
    }
    var id = iv.id;
    var course = courseOf(iv);
    var cinfo = courseInfo(course) || { id: course };
    setCourse(ctx, course);
    var season = typeof iv.season === "number" ? iv.season : null;
    var se = season ? seasonMeta(season, course) : null;
    var level = (se && se.rank) || "";
    var sec = h("section", { class: "wrap section" });
    var crumbs = h("div", { class: "case-crumbs" }, [
      link("All lessons", "seasons"),
      h("span", { "aria-hidden": "true", text: "/" }),
      h("span", { text: (season ? "Season " + season + " · " : "") + LABELS.practiceInterview + " · about 30 min" }),
      courseChip(course),
      h("span", { class: "chip" + (iv.core ? " core" : ""), text: iv.core ? "core" : "bonus" })
    ]);
    var doneChip = h("span", { class: "chip ok", text: "done", hidden: !isDone(id) });
    crumbs.appendChild(doneChip);
    sec.appendChild(crumbs);
    sec.appendChild(h("header", { class: "sec-head" }, [
      h("p", { class: "eyebrow", text: capFirst(LABELS.practiceInterview) + (season ? " · Season " + season : "") + " · about 30 min" }),
      h("h1", { md: iv.title || id }),
      level ? h("p", { class: "iv-level", text: "Level: " + level }) : null,
      h("p", { class: "lede", text: "Claude plays the interviewer and asks about " + (season ? "Season " + season : "this season") + ", like a real job interview, on claude.ai. It's practice: you can't fail, and you can take it again." })
    ]));

    var roomBtn = h("button", { class: "btn btn-primary btn-copy", type: "button", text: "Copy the interview room" });
    var textBtn = h("button", { class: "btn btn-copy", type: "button", text: "Copy a text-only interview" });
    var copyStatus = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    var fallback = copyField("Interview text to copy");
    function roomText(html) { return ROOM_ASK + fillRoom(html, iv, level, cinfo) + "\n```"; }
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
      var text = DL.prompts.interview({ id: id, title: iv.title || id, season: season, rubric: iv.rubric, course: courseTitleOf(cinfo), subject: subjectOf(cinfo) });
      copyText(text, { field: fallback, status: copyStatus, btn: textBtn, hideField: true,
        ok: "Copied. Paste it into claude.ai or the Claude app (any account) to start the interview." });
    });
    // the result code
    var pid = nextId("ivcode");
    var paste = h("textarea", { id: pid, class: "paste-field", rows: "2", spellcheck: "false", autocomplete: "off", placeholder: "DL-I-" + id + "-21/28" });
    var saveBtn = h("button", { class: "btn btn-primary", type: "button", text: "Save my result" });
    var msg = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    var attemptsHost = h("div", null, attemptsEl(id));

    // the checklist (contract 6): copy, paste, answer, paste the result code back
    var copied = false;
    var stepLis = [
      h("li", null, [
        h("p", { class: "wp-step-t", text: "Copy the interview room" }),
        h("p", { class: "wp-step-d", text: "One button copies the interviewer's instructions, set up for this season." }),
        h("div", { class: "btn-row" }, [roomBtn, textBtn]),
        copyStatus,
        fallback
      ]),
      h("li", null, [
        h("p", { class: "wp-step-t", text: "Paste it into claude.ai" }),
        h("p", { class: "wp-step-d", text: "Open claude.ai or the Claude app (any account), start a new chat, paste and send. Claude starts the interview." })
      ]),
      h("li", null, [
        h("p", { class: "wp-step-t", text: "Answer Claude's questions" }),
        h("p", { class: "wp-step-d", text: "About 30 minutes. Talk it through in your own words. Saying \"I'm not sure\" is fine." })
      ]),
      h("li", null, [
        h("p", { class: "wp-step-t", text: "Paste the result code back here" }),
        h("label", { class: "field-help", for: pid, text: "It's the last line Claude gives you, like DL-I-" + id + "-21/28." }),
        paste,
        h("div", { class: "btn-row" }, saveBtn),
        msg
      ])
    ];
    function refreshSteps() {
      var done = isDone(id);
      stepLis.forEach(function (li, i) {
        var on = done || (i === 0 && copied);
        if (on) li.classList.add("is-done"); else li.classList.remove("is-done");
      });
    }
    [roomBtn, textBtn].forEach(function (b) {
      b.addEventListener("click", function () { copied = true; refreshSteps(); });
    });
    var notNow = h("button", { class: "btn btn-ghost", type: "button", text: "Not now" });
    notNow.addEventListener("click", function () {
      flowState().notNow[id] = true;   // Continue walks past it tonight; it waits on the journey
      goRoute("tonight");
    });
    var contRow = h("div", { class: "btn-row" }, continueButton());
    sec.appendChild(h("ol", { class: "wp-steps" }, stepLis));
    sec.appendChild(h("div", { class: "btn-row wp-actions" }, notNow));
    sec.appendChild(h("p", { class: "skip-note muted small", text: "\"Not now\" keeps it on your journey. It waits until you're ready." }));
    sec.appendChild(contRow);
    sec.appendChild(h("p", { class: "dim-line" }, ["or run it in Claude Code with ", h("code", { text: "/interview " + id })]));
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
      if (r.kind !== "interview") { say("That's a grading code for a lesson answer. Paste it under that answer instead.", "bad"); return; }
      if (!sameId(r.id, id)) { say("That code is for interview " + r.id + ", not this one.", "bad"); return; }
      saveBtn.disabled = true;
      saveInterview(id, r.score, r.max).then(function (isNew) {
        saveBtn.disabled = false;
        if (!ctx.alive) return;
        paste.value = "";
        say(isNew ? "Saved: " + r.score + "/" + r.max + ". This practice interview is marked done on your journey." : "That result is already saved.", "ok");
      }, function (err) {
        saveBtn.disabled = false;
        if (ctx.alive) say("Couldn't save: " + errMsg(err), "bad");
      });
    });
    sec.appendChild(h("div", { class: "block" }, [
      h("h2", { class: "part-head", text: "Past attempts" }),
      attemptsHost
    ]));
    sec.appendChild(h("div", { class: "btn-row mt" }, [link("Back to the journey", "tonight", "btn"), link("All lessons", "seasons", "btn btn-ghost")]));

    function refreshDoneState() {
      doneChip.hidden = !isDone(id);
      contRow.hidden = !isDone(id);
      refreshSteps();
    }
    refreshDoneState();
    ctx.onProgress = function () {
      clear(attemptsHost);
      attemptsHost.appendChild(attemptsEl(id));
      refreshDoneState();
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
      ctx.root.appendChild(messagePanel("Not on file", "There's no " + LABELS.weekendProject + " called “" + ctx.arg + "”.", null));
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
      link("All lessons", "seasons"),
      h("span", { "aria-hidden": "true", text: "/" }),
      h("span", { text: capFirst(LABELS.weekendProject) + " · " + id + " · " + minutes + " min · weekend" }),
      courseChip(courseOf(m)),
      stateChip
    ]));
    sec.appendChild(h("header", { class: "sec-head" }, [
      h("p", { class: "eyebrow", text: capFirst(LABELS.weekendProject) + " · " + buildName(m) + " · " + minutes + " min" }),
      h("h1", { md: m.title || id }),
      proj.pitch ? h("p", { class: "lede", md: proj.pitch }) : null,
      h("p", { class: "build-meta", text: [projTitle, proj.language, repo ? "repo " + repo : "", minutes + " minutes"].filter(Boolean).join(" · ") })
    ]));
    // the plain checklist and Skip this weekend (contract 6) go here; filled once the buttons below exist
    var stepsHost = h("div", { class: "wp-host" });
    sec.appendChild(stepsHost);

    // unlock status: the lessons still needed, linked
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
          needs.length ? " You've finished " + joinList(needs.map(caseTitle)) + "." : ""
        ]));
        return;
      }
      unlockBox.appendChild(h("p", null, [
        h("strong", { text: "Locked." }),
        " Finish " + (missing.length === 1 ? "this lesson" : "these lessons") + " first. You can read the whole plan now."
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
    var pack = h("pre", { class: "prompt-pack", tabindex: "0", role: "region", "aria-label": "Instructions for Claude Code (read-only)", text: packText });
    var copyBtn = h("button", { class: "btn btn-primary btn-copy", type: "button", text: "Copy instructions" });
    var copyStatus = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    var packCopied = false;
    /* Copies the instructions inside the click; when the clipboard refuses, the block above is selected instead. */
    function copyPack(btn, status) {
      function fallback() {
        btn.removeAttribute("data-copied");
        if (selectNodeText(pack)) sayTo(status, SELECT_HINT, "");
        else sayTo(status, "Copying isn't allowed in this browser. Select the instructions below by hand.", "bad");
      }
      var clip = root.navigator && root.navigator.clipboard;
      if (!clip || typeof clip.writeText !== "function") { fallback(); return; }
      try {
        Promise.resolve(clip.writeText(packText)).then(function () {
          btn.setAttribute("data-copied", "true");
          sayTo(status, "Copied. Paste it into Claude Code in an empty folder for this repo.", "ok");
          packCopied = true;
          if (ctx.alive) refreshSteps();
        }, fallback);
      } catch (e) {
        fallback();
      }
    }
    copyBtn.addEventListener("click", function () { copyPack(copyBtn, copyStatus); });
    sec.appendChild(h("div", { class: "block" }, [
      h("h2", { class: "build-h", text: "Instructions for Claude Code" }),
      h("p", { class: "field-help", text: "What to hand Claude Code for this step, repo rules included. Read it first: the decisions stay yours." }),
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
    // "Check it" and its result live in step 4 of the checklist at the top
    var verifyBtn = h("button", { class: "btn", type: "button", text: "Check it" });
    var verifyOut = h("div", { class: "verify-result", role: "status", "aria-live": "polite", hidden: true });
    sec.appendChild(h("div", { class: "block" }, [
      h("h2", { class: "build-h", text: "Push it and tag it" }),
      h("p", null, ["Create ", codeEl(ownerShown + "/" + repo), " on GitHub when you're ready, push your work, then add the tag ", codeEl(tag), "."]),
      h("pre", { class: "cmd-block", tabindex: "0", role: "region", "aria-label": "Commands to tag and push", text: "git tag " + tag + "\ngit push origin " + tag }),
      h("p", { class: "field-help" }, ["Check it looks at the public repos of ", codeEl(ownerShown), ". ", link("Change your GitHub username in Settings", "settings"), "."])
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
          verifyBtn.textContent = "Check it";
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
      h("p", { class: "field-help", id: noteId + "-help", text: "One or two sentences on a choice you made and why. It comes back later as a memory check." }),
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
            : "Self-reported. Press Check it any time to make it official."
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
        : r.done ? "Press Check it to make it verified."
        : "Mark done opens up once Check it finds your tag.";
      markHelp.hidden = !markHelp.textContent;
      refreshSteps();
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
    sec.appendChild(h("div", { class: "btn-row mt" }, [link("Back to the journey", "tonight", "btn"), link("All lessons", "seasons", "btn btn-ghost")]));

    // ----- the checklist at the top (contract 6): copy, build, tag, Check it; then Skip this weekend
    var stepCopy = h("button", { class: "btn btn-small btn-copy", type: "button", text: "Copy instructions" });
    var stepCopyStatus = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    stepCopy.addEventListener("click", function () { copyPack(stepCopy, stepCopyStatus); });
    var stepLis = [
      h("li", null, [
        h("p", { class: "wp-step-t", text: "Copy the instructions for Claude Code" }),
        h("p", { class: "wp-step-d", text: "One button copies a ready-made set of steps. Paste them into Claude Code, the AI coding helper on your computer. They are also shown in full below." }),
        h("div", { class: "btn-row" }, stepCopy),
        stepCopyStatus
      ]),
      h("li", null, [
        h("p", { class: "wp-step-t", text: "Build it in your own GitHub repo" }),
        h("p", { class: "wp-step-d" }, ["A repo is your project's folder on GitHub. Make ", codeEl(ownerShown + "/" + repo), ", open it in Claude Code, paste the instructions and follow along."])
      ]),
      h("li", null, [
        h("p", { class: "wp-step-t" }, ["Add the tag ", codeEl(tag), " when it works"]),
        h("p", { class: "wp-step-d", text: "A tag is a name you pin on one saved version of your code. The commands are below, under Push it and tag it." })
      ]),
      h("li", null, [
        h("p", { class: "wp-step-t", text: "Come back and press Check it" }),
        h("p", { class: "wp-step-d", text: "The site looks for the tag in your public repo on GitHub. It only runs when you press it." }),
        h("div", { class: "btn-row" }, verifyBtn),
        verifyOut
      ])
    ];
    function refreshSteps() {
      var r = buildRec(id), found = !!S.verified[id] || !!(r.done && r.verified);
      var on = [packCopied || !!r.done || found, !!r.done || found, !!r.done || found, found];
      stepLis.forEach(function (li, i) {
        if (on[i]) li.classList.add("is-done"); else li.classList.remove("is-done");
      });
      var sn = snoozedUntil(id);
      skipBtn.hidden = !!r.done || !!sn;
      bringBack.hidden = !sn || !!r.done;
      skipNote.hidden = !!r.done;
      skipNote.textContent = sn ? "Skipped until " + dowDate(sn) + ". It's back on your journey then."
        : "\"Skip this weekend\" keeps it on your journey: it waits for next weekend, " + dowDate(nextSaturday(today())) + ". Nothing is lost.";
      contRow.hidden = !r.done;
    }
    var skipBtn = h("button", { class: "btn btn-ghost wp-skip", type: "button", text: "Skip this weekend" });
    var bringBack = h("button", { class: "btn btn-ghost", type: "button", text: "Do it this weekend after all" });
    var skipNote = h("p", { class: "skip-note muted small" });
    var contRow = h("div", { class: "btn-row" }, continueButton());
    skipBtn.addEventListener("click", function () {
      lsSet(SNOOZE_KEY + id, nextSaturday(today()));
      goRoute("tonight");
    });
    bringBack.addEventListener("click", function () {
      lsSet(SNOOZE_KEY + id, "");
      refreshSteps();
    });
    stepsHost.appendChild(h("ol", { class: "wp-steps" }, stepLis));
    stepsHost.appendChild(h("div", { class: "btn-row wp-actions" }, [skipBtn, bringBack]));
    stepsHost.appendChild(skipNote);
    stepsHost.appendChild(contRow);

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
          text.textContent = "Your account copy is removed too. Your journey starts fresh.";
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
    var sec = h("section", { class: "wrap section" }, head("Your plan", "Settings"));
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
        radio(planName, "all", set.plan === "all", "Everything", "Core plus the bonus lessons")
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
    // weeknight and weekend minutes as pills (v2.0.0, the same pills as the first shift)
    var wdK = nextId("wd-k"), weK = nextId("we-k");
    var wd = minutePills(nextId("wd"), FS_WD, set.weekdayMin || 30, function (n) { save(function (st) { st.weekdayMin = n; }); });
    var we = minutePills(nextId("we"), FS_WE, set.weekendMin || 60, function (n) { save(function (st) { st.weekendMin = n; }); });
    wd.setAttribute("aria-labelledby", wdK);
    we.setAttribute("aria-labelledby", weK);
    sec.appendChild(h("div", { class: "settings-group" }, [
      h("h2", { text: "Your pace" }),
      planField,
      h("div", { class: "fields" }, [
        field("Finish by", target, "Leave it empty to aim about 3 months out.")
      ]),
      h("div", { class: "field" }, [h("p", { class: "field-k", id: wdK, text: "Weeknights" }), wd]),
      h("div", { class: "field" }, [h("p", { class: "field-k", id: weK, text: "Weekends" }), we]),
      status
    ]));

    // reading (v3.1.0, contract C.2): the theme, site wide, saved in this browser (dl-theme)
    var thName = nextId("theme");
    var thStatus = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
    var themeField = h("fieldset", { class: "field" }, [
      h("legend", { class: "field-k", text: "Theme" }),
      h("div", { class: "seg-opts" }, [
        radio(thName, "night", themePref() !== "paper", "Night", "Light text on a dark page"),
        radio(thName, "paper", themePref() === "paper", "Paper", "Dark text on a warm, light page")
      ])
    ]);
    listen(ctx, themeField, "change", function (e) {
      var v = setThemePref(e.target && e.target.value);
      sayTo(thStatus, "Saved. Theme: " + (v === "paper" ? "Paper." : "Night."), "ok");
    });
    sec.appendChild(h("div", { class: "settings-group" }, [
      h("h2", { text: "Reading" }),
      themeField,
      h("p", { class: "field-help", text: "Saved in this browser. In a lesson, the Reading button also sets the layout and the text size." }),
      thStatus
    ]));

    // courses and Build Nights (contract 9.9): the schedule and the GitHub username
    var multi = multiCourse();
    var hasBuilds = (catalog().builds || []).length > 0;
    if (multi || hasBuilds) {
      var cStatus = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
      var cSave = function (fn, msg) {
        return saveSettings(fn).then(function () { sayTo(cStatus, msg || "Saved.", "ok"); }, function (err) { sayTo(cStatus, "Couldn't save: " + errMsg(err), "bad"); });
      };
      var groupKids = [h("h2", { text: "Courses and weekend projects" })];
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
        groupKids.push(field("Schedule", sched, "Which course your journey draws from. In parallel, the plan alternates the two courses, with weekend projects on Saturdays and Sundays."));
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
          cSave(function (st) { st.githubOwner = v; }, "Saved. Weekend projects check github.com/" + v + ".");
        });
        groupKids.push(field("GitHub username", gh, "Weekend projects look for your tags in this account's public repos. The check runs only when you press Check it."));
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
      h("p", { text: "Are you sure? Every finished lesson, memory check and note goes, and your journey starts again from the first screen. This can't be undone." }),
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
        S.flow = null;   // tonight's handled checks belonged to the deleted progress
        S.flash = ok === false
          ? { text: "Deleted on this device. Your account copy couldn't be removed yet.", tone: "warn", retry: true }
          : { text: "Your progress is deleted. Your journey starts fresh." };
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
      h("p", { class: "field-help", text: "Removes every finished lesson, memory check, note, practice interview result, weekend project and setting" + where + ". Copy your progress first if you might want it back." }),
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
