/* sims/a6e08-v1.0.0.js  (published as sims/a6e08.js)
   Case a6e08 "Prompts Are Code": a replay of one night at Larkwhistle Press, a print shop that
   drafts personal wedding invitations with a language model and prints them overnight. No real
   model runs here: a card's first words follow one stated rule about the prompt's slots.
   Widget-style sim: it draws its own tables inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: the prompt in place at 01:00 (versions 1 to 8, or
     a copy retyped from memory), prompts kept as numbered versions, slot check on save, ten-card
     eval on save, proof batch of the first 5 cards behind a flag, admin page locked to the owner,
     a person reading every card from 07:00, a plan (one of the four replies), Run the night,
     Roll back, Reset. Stats: live version, slots in the prompt, slot check, ten-card eval, cards
     printed, cards right, "Dear Hortense" cards, cards with no reply-by date, where the run
     stopped, finished at, card 1's first words, the morning read, wasted cards. selfTest: 12
     assertions.

   The model (stated in sim.lede):
   - The template filler always fills five values: couple, date, venue, guest_name, rsvp_by.
   - A card is drafted from the prompt with those values in their slots. A value with no slot is
     dropped silently. With a {guest_name} slot the card begins "Dear <guest>, we would love you
     to join us."; without one the model copies the example letter: "Dear Hortense, ...". With no
     {rsvp_by} slot the card has no reply-by date. A card is right only with both.
   - Versions 1 to 7 (12 March to 8 October) have all five slots. Version 8 (14 October, 23:10)
     lost the line holding {guest_name}: four slots. The retyped copy lost {rsvp_by}: four slots.
   - Three weddings: 176 + 139 + 97 = 412 cards. The run starts at 01:00 and prints two cards a
     minute: card k is done at 01:00 + 30k seconds.
   - Slot check: fails when the code fills a value with no slot, or a slot has no value.
   - Ten-card eval: ten made-up guests; a card passes if it begins with that guest's name and
     carries the reply-by date. A version with both slots scores 10 of 10, otherwise 0 of 10.
   - A failed check stops the change before printing. With numbered versions, version 7 stays
     live and prints; without them nothing is kept to print from.
   - Proof batch: the version going live prints only cards 1 to 5, then a person looks. If any
     is wrong, the run stops there. Rollback switches to version 7 in one step and prints all 412
     from that moment.
   - The morning read: one person from 07:00, 20 seconds a card.

   Where every number comes from (conventions rule 14; the case is content/latent/a6/a6e08-v1.0.0.json):
   - 412 cards x 30 s = 12,360 s = 3 h 26 min: 01:00 to 04:26:00 (the post's "finished at 04:26").
   - As built (version 8, nothing on): 412 printed, 412 "Dear Hortense", 0 right, 412 wasted.
   - Versions 1 to 7: 412 right each.
   - Slot check on version 8: "the code fills guest_name; version 8 has no slot for it". With no
     versions kept: 0 printed. With versions: version 7 prints 412 right by 04:26:00, 0 wasted.
   - Ten-card eval on version 8: 0 of 10. On the retyped copy: 0 of 10 (no reply-by date).
   - Proof batch: 5 cards by 01:00 + 150 s = 01:02:30, all "Dear Hortense". Rollback then:
     412 more by 01:02:30 + 12,360 s = 04:28:30. 417 printed, 412 right, 5 wasted.
   - Rollback after a full bad run is found at 06:00: 412 more by 09:26:00.
   - Morning read of 412: 412 x 20 s = 8,240 s = 2 h 17 min 20 s, 07:00 to 09:17:20.
   - Retyped copy: 412 printed, 412 right names, 0 with the reply-by date, so 0 right; the slot
     check reports "the code fills rsvp_by; the retyped copy has no slot for it".
   - Lock on: the same edit, typed by Mr Tibbald at the shop's own computer: 412 "Dear Hortense".
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var FILLS = ["couple", "date", "venue", "guest_name", "rsvp_by"];
  var ALL = FILLS.slice();
  var START = 3600;        // 01:00, seconds after midnight
  var PER = 30;            // seconds per card: two cards a minute
  var PROOF = 5;           // cards in the proof batch
  var FOUND = 6 * 3600;    // 06:00, when Yannick reads the first card
  var READ0 = 7 * 3600;    // 07:00, the morning read starts
  var READ_PER = 20;       // seconds to read one card
  var WEDDINGS = [
    { name: "December wedding", n: 176 },
    { name: "January wedding", n: 139 },
    { name: "February wedding", n: 97 }
  ];
  var FIRST = ["Chidera", "Paavo", "Thandiwe", "Mihail", "Teuila"];
  var EXAMPLE = "Hortense";

  var VERSIONS = [
    { id: "1", label: "version 1", date: "12 March", slots: ALL },
    { id: "2", label: "version 2", date: "26 March", slots: ALL },
    { id: "3", label: "version 3", date: "21 April", slots: ALL },
    { id: "4", label: "version 4", date: "2 June", slots: ALL },
    { id: "5", label: "version 5", date: "14 July", slots: ALL },
    { id: "6", label: "version 6", date: "1 September", slots: ALL },
    { id: "7", label: "version 7", date: "8 October", slots: ALL },
    { id: "8", label: "version 8", date: "14 October, 23:10", slots: ["couple", "date", "venue", "rsvp_by"] },
    { id: "R", label: "the retyped copy", date: "retyped from memory", slots: ["couple", "date", "venue", "guest_name"] }
  ];
  var VOPTS = VERSIONS.map(function (v) {
    return { value: v.id, label: (v.id === "R" ? "Retyped from memory" : "Version " + v.id) + ", " + v.date };
  });
  var PLANS = [
    { value: "none", label: "None: set the controls yourself" },
    { value: "r0", label: "Reply: lock the page to the owner" },
    { value: "r1", label: "Reply: versions, checks, 5 cards first" },
    { value: "r2", label: "Reply: read every card in the morning" },
    { value: "r3", label: "Reply: retype last week's prompt" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function ver(id) { for (var i = 0; i < VERSIONS.length; i++) if (VERSIONS[i].id === String(id)) return VERSIONS[i]; return null; }
  function has(v, s) { return v.slots.indexOf(s) >= 0; }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function clock(sec) {
    var s = sec % 86400;
    return two(Math.floor(s / 3600)) + ":" + two(Math.floor(s % 3600 / 60)) + ":" + two(s % 60);
  }
  function defaults() {
    return { ver: "8", versioned: false, slot: false, evalOn: false, proof: false, lock: false, read: false, plan: "none" };
  }
  function guest(k) { return k <= FIRST.length ? FIRST[k - 1] : "guest " + k; }
  function wedding(k) {
    var n = 0;
    for (var i = 0; i < WEDDINGS.length; i++) { n += WEDDINGS[i].n; if (k <= n) return WEDDINGS[i].name; }
    return "";
  }
  function total() { var n = 0; WEDDINGS.forEach(function (w) { n += w.n; }); return n; }

  /* ---------- the model (pure: settings in, night out) ---------- */

  function card(v, k) {
    var name = has(v, "guest_name") ? guest(k) : EXAMPLE;
    return {
      k: k, guest: guest(k), wedding: wedding(k), ver: v.label,
      first: "Dear " + name + ", we would love you to join us.",
      hortense: !has(v, "guest_name"), nodate: !has(v, "rsvp_by"),
      right: has(v, "guest_name") && has(v, "rsvp_by")
    };
  }

  function slotCheck(v) {
    var extra = FILLS.filter(function (f) { return !has(v, f); });
    var missing = v.slots.filter(function (s) { return FILLS.indexOf(s) < 0; });
    if (extra.length) return { ok: false, note: "fails: the code fills " + extra.join(", ") + "; " + v.label + " has no slot for it" };
    if (missing.length) return { ok: false, note: "fails: " + v.label + " has a slot the code never fills: " + missing.join(", ") };
    return { ok: true, note: "passes: " + FILLS.length + " values, " + v.slots.length + " slots" };
  }
  function evalScore(v) {
    var n = 0;
    for (var i = 0; i < 10; i++) if (has(v, "guest_name") && has(v, "rsvp_by")) n += 1;
    return n;
  }

  function printRun(R, v, from, count) {
    for (var k = 1; k <= count; k++) R.cards.push(card(v, k));
    R.end = from + count * PER;
  }

  function night(C) {
    var v = ver(C.ver);
    var sc = slotCheck(v);
    var score = evalScore(v);
    var R = {
      saved: v, live: v, cards: [], end: null, stop: "not stopped", stopped: false,
      check: C.slot ? sc.note : "off", evalNote: C.evalOn ? score + " of 10" : "off",
      blocked: "", editor: C.lock ? "Mr Tibbald, at the shop's own computer" : "Sibylla, on her phone",
      rolled: false
    };
    if (C.slot && !sc.ok) R.blocked = "the slot check";
    else if (C.evalOn && score < 10) R.blocked = "the ten-card eval";
    if (R.blocked) {
      R.live = C.versioned ? ver("7") : null;
      R.stop = "before printing, at " + R.blocked;
    }
    if (!R.live) return finish(C, R);
    var fallback = R.blocked !== "";
    if (C.proof && !fallback) {
      printRun(R, R.live, START, PROOF);
      var bad = R.cards.filter(function (c) { return !c.right; }).length;
      if (bad) {
        R.stopped = true;
        R.stop = "at " + PROOF + " cards, " + clock(R.end);
        return finish(C, R);
      }
      R.cards = [];
    }
    printRun(R, R.live, START, total());
    return finish(C, R);
  }

  function finish(C, R) {
    R.printed = R.cards.length;
    R.right = R.cards.filter(function (c) { return c.right; }).length;
    R.hortense = R.cards.filter(function (c) { return c.hortense; }).length;
    R.nodate = R.cards.filter(function (c) { return c.nodate; }).length;
    R.wasted = R.printed - R.right;
    R.readNote = "off";
    if (C.read && R.printed && !R.stopped) {
      R.readNote = (R.wasted ? R.wasted + " of " + R.printed + " wrong" : R.printed + " read, all right") +
        ", found by " + clock(READ0 + R.printed * READ_PER);
    }
    return R;
  }

  function rollback(R) {
    var from = R.stopped ? R.end : FOUND;
    var v7 = ver("7");
    var n = total();
    for (var k = 1; k <= n; k++) R.cards.push(card(v7, k));
    R.end = from + n * PER;
    R.live = v7;
    R.rolled = true;
    R.stopped = false;
    R.printed = R.cards.length;
    R.right = n;
    R.wasted = R.printed - R.right;
    return from;
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
    var w1 = el("div", "overflow-x:auto;", "", box);
    var slots = el("table", "width:100%;border-collapse:collapse;", "", w1);
    var w2 = el("div", "overflow-x:auto;", "", box);
    var cards = el("table", "width:100%;border-collapse:collapse;", "", w2);
    var note = el("pre", "margin:0;white-space:pre-wrap;font-size:11px;", "", box);
    return { el: el, head: head, slots: slots, cards: cards, note: note };
  }
  function row(ui, table, cells, th) {
    var tr = ui.el("tr", "", "", table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }
  function clear(t) { while (t.firstChild) t.removeChild(t.firstChild); }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var R = S.R;
    var v = ver(C.ver);
    ui.head.textContent = "Prompt saved at 23:10: " + v.label + " (" + v.date + "). Numbered versions: " + (C.versioned ? "on" : "off") +
      ". Slot check: " + (C.slot ? "on" : "off") + ". Ten-card eval: " + (C.evalOn ? "on" : "off") +
      ". Proof batch: " + (C.proof ? "on" : "off") + ". Page locked: " + (C.lock ? "on" : "off") + ".";
    clear(ui.slots);
    row(ui, ui.slots, ["value the code fills"].concat(FILLS), true);
    row(ui, ui.slots, ["slot in " + v.label].concat(FILLS.map(function (f) { return has(v, f) ? "yes" : "NO: dropped"; })), false);
    clear(ui.cards);
    row(ui, ui.cards, ["card", "guest", "wedding", "prompt", "first words"], true);
    if (!R) {
      ui.note.textContent = "22:00. Version 7 is live, proofed at 16:00. Nothing printed yet.";
      return;
    }
    var show = R.cards.slice(0, 5);
    if (R.cards.length > 5) show.push(R.cards[R.cards.length - 1]);
    show.forEach(function (c) { row(ui, ui.cards, [("00" + c.k).slice(-3), c.guest, c.wedding, c.ver, c.first + (c.nodate ? " (no reply-by date)" : "")], false); });
    ui.note.textContent = "Where the run stopped: " + R.stop + ". Printed " + R.printed + ", right " + R.right +
      ", wasted " + R.wasted + (R.end !== null ? ". Finished at " + clock(R.end) : "") + ".";
  }

  function setStats(api) {
    var S = api.state;
    var R = S.R;
    var st = S.stat;
    var v = ver(S.C.ver);
    st.slots(v.slots.length + ": " + v.slots.join(", "));
    if (!R) {
      st.version("version 7"); st.check(S.C.slot ? slotCheck(v).note : "off"); st.evals(S.C.evalOn ? evalScore(v) + " of 10" : "off");
      st.printed(0); st.right(0); st.hortense(0); st.nodate(0); st.stop("-"); st.done("-");
      st.first("nothing printed yet"); st.read("off"); st.wasted(0);
      return;
    }
    st.version(R.live ? R.live.label : "none");
    st.check(R.check);
    st.evals(R.evalNote);
    st.printed(R.printed);
    st.right(R.right);
    st.hortense(R.hortense);
    st.nodate(R.nodate);
    st.stop(R.stop);
    st.done(R.end !== null && !R.stopped ? clock(R.end) : "-");
    var firstIdx = R.rolled ? R.cards.length - total() : 0;
    st.first(R.cards.length ? R.cards[firstIdx].first : "nothing printed");
    st.read(R.readNote);
    st.wasted(R.wasted);
  }

  function run(api, what) {
    var S = api.state;
    var C = S.C;
    S.R = night(C);
    var R = S.R;
    draw(api);
    setStats(api);
    var v = ver(C.ver);
    var who = (C.ver === "8" || C.ver === "R") ? " " + R.editor + ", saves " + v.label + "." : " " + v.label + " is in place.";
    api.log((what ? what + " " : "") + "23:10:" + who + " Slot check " + R.check + "; ten-card eval " + R.evalNote + ".",
      R.blocked ? "ok" : "");
    api.log("01:00 run: " + R.printed + " printed, " + R.right + " right, " + R.hortense + " \"Dear Hortense\", " + R.nodate +
      " with no reply-by date. Stopped: " + R.stop + "." + (R.end !== null && !R.stopped ? " Done at " + clock(R.end) + "." : "") +
      (R.readNote !== "off" ? " Morning read: " + R.readNote + "." : ""), R.right === total() ? "ok" : "bad");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") C.lock = true;
    if (plan === "r1") { C.versioned = true; C.slot = true; C.evalOn = true; C.proof = true; }
    if (plan === "r2") C.read = true;
    if (plan === "r3") C.ver = "R";
    return C;
  }

  /* ---------- the module ---------- */

  DL.sims.define("a6e08", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.R = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      function manual(what) {
        if (S.C.plan !== "none") { S.C.plan = "none"; S.ctl.plan.set("none"); what += " (Plan cleared.)"; }
        run(api, what);
      }
      function tog(id, label, key) {
        S.ctl[id] = api.control.toggle(id, label, false, function (on) {
          S.C[key] = !!on;
          manual(label + ": " + (on ? "on." : "off."));
        });
      }
      S.ctl.run = api.control.button("run", "Run the night", function () { run(api, ""); });
      S.ctl.version = api.control.select("version", "Prompt saved at 23:10", VOPTS, "8", function (val) {
        var o = pick(VOPTS, val);
        if (!o) return;
        S.C.ver = String(o.value);
        manual("Prompt: " + o.label + ".");
      });
      tog("versioned", "Prompts kept as numbered versions", "versioned");
      tog("slot", "Slot check on every save", "slot");
      tog("eval", "Ten-card eval on every save", "evalOn");
      tog("proof", "Proof batch: first 5 cards behind a flag", "proof");
      tog("lock", "Admin page locked to the owner", "lock");
      tog("read", "A person reads every card from 07:00", "read");
      S.ctl.rollback = api.control.button("rollback", "Roll back to version 7", function () {
        var R = S.R;
        if (!R) { api.log("Nothing has run yet. Version 7 is live.", ""); return; }
        if (!S.C.versioned) {
          api.log("No earlier version kept: the box holds only the text saved at 23:10. Nothing to switch back to.", "bad");
          return;
        }
        if (R.rolled || (R.live && R.live.id === "7" && R.right === R.printed)) { api.log("Version 7 is already live.", ""); return; }
        var from = rollback(R);
        draw(api);
        setStats(api);
        api.log("Rolled back to version 7 at " + clock(from) + ": " + total() + " cards printed again, all right, done at " +
          clock(R.end) + ". " + R.printed + " printed tonight, " + R.wasted + " wasted.", "ok");
      });
      S.ctl.plan = api.control.select("plan", "Play a reply (replays last night)", PLANS, "none", function (val) {
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        var C = planConfig(String(o.value));
        S.C = C;
        S.ctl.version.set(C.ver); S.ctl.versioned.set(C.versioned); S.ctl.slot.set(C.slot); S.ctl.eval.set(C.evalOn);
        S.ctl.proof.set(C.proof); S.ctl.lock.set(C.lock); S.ctl.read.set(C.read);
        run(api, "Plan: " + o.label + ".");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        version: api.stat("version", "live prompt version", ""),
        slots: api.stat("slots", "slots in the saved prompt", "warn"),
        check: api.stat("check", "slot check", ""),
        evals: api.stat("evals", "ten-card eval", ""),
        printed: api.stat("printed", "cards printed", ""),
        right: api.stat("right", "cards right", "ok"),
        hortense: api.stat("hortense", "cards to \"Dear Hortense\"", "bad"),
        nodate: api.stat("nodate", "cards with no reply-by date", "bad"),
        stop: api.stat("stop", "where the run stopped", "warn"),
        done: api.stat("done", "finished at", ""),
        first: api.stat("first", "card 1's first words", ""),
        read: api.stat("read", "the morning read", ""),
        wasted: api.stat("wasted", "wasted cards", "bad")
      };

      api.info("<strong>How to read it.</strong> The top table lines up the five values the code fills against the slots in the saved prompt: a value with no slot is dropped without a word. The lower table shows the first cards printed and the last, with the version that wrote each. Switch checks on and run the night again to see where each one stops it.");

      draw(api);
      setStats(api);
      api.log("22:00 at Larkwhistle Press. Version 7 is live, proofed at 16:00. Tonight's run: 412 cards for three weddings, from 01:00. Nothing printed yet.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      var DEAR_H = "Dear Hortense, we would love you to join us.";

      // 1. The opening state: 22:00, version 7 live, nothing printed.
      t.expect(t.stat("version") === "version 7" && t.stat("printed") === 0 && t.stat("first") === "nothing printed yet" &&
        has("22:00 at Larkwhistle Press. Version 7 is live"),
        "Opens at 22:00 with version 7 live and nothing printed");

      // 2. Last night as built: version 8, no checks.
      t.click("run");
      t.expect(t.stat("printed") === 412 && t.stat("hortense") === 412 && t.stat("right") === 0 &&
        t.stat("done") === "04:26:00" && t.stat("first") === DEAR_H && t.stat("wasted") === 412 &&
        t.stat("slots") === "4: couple, date, venue, rsvp_by",
        "As built: 412 cards, every one Dear Hortense, done at 04:26:00");

      // 3. Versions 1 to 7 print the right names.
      var good = 0;
      ["1", "2", "3", "4", "5", "6", "7"].forEach(function (v) {
        t.set("version", v);
        if (t.stat("right") === 412 && t.stat("hortense") === 0) good += 1;
      });
      t.expect(good === 7 && t.stat("first") === "Dear Chidera, we would love you to join us.",
        "Versions 1 to 7: 412 right cards each; card 1 is Dear Chidera");

      // 4. The slot check alone stops version 8 before printing, with nothing to print from.
      t.set("version", "8");
      t.set("slot", true);
      t.expect(t.stat("check") === "fails: the code fills guest_name; version 8 has no slot for it" &&
        t.stat("printed") === 0 && t.stat("stop") === "before printing, at the slot check" && t.stat("version") === "none",
        "Slot check: fails on guest_name before printing; with no versions kept, 0 printed");

      // 5. With numbered versions, version 7 stays live and prints.
      t.set("versioned", true);
      t.expect(t.stat("version") === "version 7" && t.stat("right") === 412 && t.stat("wasted") === 0 && t.stat("done") === "04:26:00",
        "Slot check with versions: version 7 stays live, 412 right by 04:26:00");

      // 6. The ten-card eval alone scores version 8 at 0 of 10.
      t.set("slot", false);
      t.set("eval", true);
      t.expect(t.stat("evals") === "0 of 10" && t.stat("stop") === "before printing, at the ten-card eval" && t.stat("right") === 412,
        "Ten-card eval: 0 of 10 for version 8, stopped before printing");

      // 7. The proof batch alone stops at 5 cards; rollback prints 412 right by 04:28:30.
      t.set("eval", false);
      t.set("proof", true);
      var proof = t.stat("printed") === 5 && t.stat("hortense") === 5 && t.stat("stop") === "at 5 cards, 01:02:30";
      t.click("rollback");
      t.expect(proof && t.stat("right") === 412 && t.stat("printed") === 417 && t.stat("wasted") === 5 &&
        t.stat("done") === "04:28:30" && t.stat("version") === "version 7" &&
        has("Rolled back to version 7 at 01:02:30"),
        "Proof batch: stops at 5 cards at 01:02:30; rollback to version 7 prints 412 right by 04:28:30, 5 wasted");

      // 8. Without numbered versions there is nothing to roll back to.
      t.set("proof", false);
      t.set("versioned", false);
      t.click("rollback");
      t.expect(has("No earlier version kept") && t.stat("hortense") === 412 && t.stat("version") === "version 8",
        "No versions kept: rollback has nothing to switch back to");

      // 9. Reply 0: the lock changes who typed, not the cards.
      t.set("plan", "r0");
      t.expect(t.stat("hortense") === 412 && t.stat("done") === "04:26:00" && has("Mr Tibbald, at the shop's own computer"),
        "Reply 0: Mr Tibbald makes the same edit; 412 Dear Hortense by 04:26:00");

      // 10. Reply 2: the morning read finds them all, after printing.
      t.set("plan", "r2");
      t.expect(t.stat("read") === "412 of 412 wrong, found by 09:17:20" && t.stat("wasted") === 412,
        "Reply 2: reading every card finds 412 wrong by 09:17:20; 412 wasted");

      // 11. Reply 3: retyped from memory, right names, no reply-by date.
      t.set("plan", "r3");
      var r3 = t.stat("right") === 0 && t.stat("nodate") === 412 && t.stat("hortense") === 0 && t.stat("printed") === 412 &&
        t.stat("first") === "Dear Chidera, we would love you to join us.";
      t.set("slot", true);
      t.expect(r3 && t.stat("check") === "fails: the code fills rsvp_by; the retyped copy has no slot for it",
        "Reply 3: 412 right names, 0 reply-by dates; the slot check would fail it on rsvp_by");

      // 12. Reply 1: versions, slot check, eval and proof batch.
      t.set("plan", "r1");
      t.expect(t.stat("check") === "fails: the code fills guest_name; version 8 has no slot for it" &&
        t.stat("evals") === "0 of 10" && t.stat("version") === "version 7" && t.stat("right") === 412 &&
        t.stat("wasted") === 0 && t.stat("done") === "04:26:00",
        "Reply 1: the slot check stops version 8 at save; version 7 prints 412 right by 04:26:00");
    }
  });
})();
