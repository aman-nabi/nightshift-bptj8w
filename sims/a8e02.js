/* sims/a8e02-v1.0.0.js  (published as sims/a8e02.js)
   Case a8e02 "The Small Changes": a data-prep bench for Selvedge Alterations, a shop that trained a
   small add-on (a LoRA adapter) on 2,000 old customer emails so its email assistant would write in the
   shop's voice. No real model runs here and no email text exists in this file: the training emails are
   counts with flags (a sign-off, a customer named, the old phone number, a duplicate), and the adapter's
   replies are given rates. Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: replace sign-offs, strip names and phone numbers, remove
     duplicates, adapter rank (4, 8, 16), adapter or full fine-tuning, hold back 200 and read the replies,
     cut the sign-off after writing, read 50 by hand, a reply to play, reset. Stats: examples trained on,
     examples ending with Marta, examples naming a customer, settings trained in one layer, memory to hold
     the big model, tonight's replies signed Marta, signed the Selvedge team, giving the old number, and
     the held-back read. selfTest: 11 assertions.

   The given data (stated in sim.lede):
   - 2,000 archive emails, 2016 to 2021, each a customer's email with the shop's reply, read three times
     in training (three epochs). 1,640 end with Marta's sign-off, 360 with the Selvedge team's.
   - Every one names a customer. 400 give the shop's old phone number, out of use since 2022.
   - 200 are duplicates: 164 Marta, 40 with the old number. The 200 held back hold the same mix.
   - Tonight, Friday 9 October 22:00 to 00:40 Saturday 10 October: 40 replies, 37 signed Marta,
     3 signed the Selvedge team, 8 with the old number. The adapter keeps those rates while its examples
     hold the habit, at any rank and with full fine-tuning; 0 once the habit is cleaned out.
   - One layer: 4,096 x 4,096 = 16,777,216 settings. An adapter of rank r adds 2 x 4,096 x r.
   - The big model: 7 billion settings; 2 bytes each at 16 bits = 14 GB; half a byte at 4 bits = 3.5 GB.
   - The hand read of 50 raw examples: 41 Marta, 50 name a customer, 10 old number, 5 duplicates.

   Where every number comes from (conventions rule 14; the case is content/latent/a8/a8e02-v1.0.0.json):
   - 82%: 1,640 / 2,000; with duplicates out 1,476 / 1,800; held back too 1,312 / 1,600; all 0.82.
   - Rank 4: 32,768 (0.20%); rank 8: 65,536 (0.39%); rank 16: 131,072 (0.78%); full: 16,777,216 (100%).
   - Held-back read at tonight's rates: 200 x 37 / 40 = 185 Marta; 200 x 8 / 40 = 40 old number.
   - Reply 0: rank 16, 37 of 40. Reply 1: full, 14 GB, 37 of 40. Reply 2: 0 of 40 Marta, 8 of 40 old
     number, 2,000 examples naming a customer. Reply 3: 1,600 examples, 0 Marta, 0 old number, go.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var EMAILS = 2000;
  var MARTA = 1640;
  var DUPES = 200;
  var DUPES_MARTA = 164;
  var HELD = 200;
  var HELD_MARTA = 164;
  var TONIGHT = 40;
  var TONIGHT_MARTA = 37;
  var TONIGHT_OLD = 8;
  var DIM = 4096;
  var LAYER = DIM * DIM;              // 16,777,216
  var RANKS = [
    { value: "4", label: "rank 4" },
    { value: "8", label: "rank 8 (as trained)" },
    { value: "16", label: "rank 16" }
  ];
  var METHODS = [
    { value: "adapter", label: "adapter on the 4-bit model" },
    { value: "full", label: "full fine-tuning" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: raise the rank" },
    { value: "r1", label: "reply 1: full fine-tuning" },
    { value: "r2", label: "reply 2: cut the sign-off after writing" },
    { value: "r3", label: "reply 3: clean, and test on 200 held back" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function defaults() {
    return { signoffs: false, details: false, dupes: false, rank: "8", method: "adapter",
      held: false, cut: false, plan: "none" };
  }

  /* ---------- the bench (pure: settings in, answers out) ---------- */

  function bench(C) {
    var n = C.dupes ? EMAILS - DUPES : EMAILS;
    var m = C.dupes ? MARTA - DUPES_MARTA : MARTA;
    if (C.held) { n -= HELD; m -= HELD_MARTA; }
    var R = { n: n };
    var mk = C.signoffs ? 0 : m;
    R.share = fmt(mk) + " of " + fmt(n) + " (" + Math.round(mk * 100 / n) + "%)";
    R.named = C.details ? "0 of " + fmt(n) : fmt(n) + " of " + fmt(n);
    if (C.method === "full") {
      R.settings = fmt(LAYER) + " of " + fmt(LAYER) + " (100%)";
      R.memory = "14 GB (16-bit)";
    } else {
      var add = 2 * DIM * Number(C.rank);
      R.settings = fmt(add) + " of " + fmt(LAYER) + " (" + (add * 100 / LAYER).toFixed(2) + "%)";
      R.memory = "3.5 GB (4-bit)";
    }
    var habit = !C.signoffs;
    var mt = (habit && !C.cut) ? TONIGHT_MARTA : 0;
    var team = C.cut ? 0 : (C.signoffs ? TONIGHT : TONIGHT - TONIGHT_MARTA);
    var old = C.details ? 0 : TONIGHT_OLD;
    R.mTonight = mt;
    R.marta = mt + " of " + TONIGHT;
    R.team = team + " of " + TONIGHT + (C.cut ? " (sign-offs cut)" : "");
    R.old = old + " of " + TONIGHT;
    var hm = mt * HELD / TONIGHT;
    var ho = old * HELD / TONIGHT;
    if (!C.held) R.check = "not done: went live unread";
    else if (hm || ho) {
      var parts = [];
      if (hm) parts.push(hm + " of " + HELD + " signed Marta");
      if (ho) parts.push(ho + " give the old number");
      R.check = "stop: " + parts.join(", ");
    } else R.check = "go: 0 of " + HELD + " signed Marta, 0 old number";
    R.go = C.held && !hm && !ho;
    return R;
  }

  function readFifty(C) {
    return "read 50 examples by hand: " + (C.signoffs ? 0 : 41) + " of 50 end Warm regards, Marta; " +
      (C.details ? 0 : 50) + " name a customer; " + (C.details ? 0 : 10) + " give the old shop number; " +
      (C.dupes ? 0 : 5) + " are duplicates.";
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
    var table = el("table", "width:100%;border-collapse:collapse;", "", w1);
    var note = el("pre", "margin:0;white-space:pre-wrap;font-size:11px;", "", box);
    return { el: el, head: head, table: table, note: note };
  }
  function row(ui, cells, th) {
    var tr = ui.el("tr", "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }

  function draw(api) {
    var C = api.state.C;
    var R = bench(C);
    var ui = api.state.ui;
    ui.head.textContent = "the data-prep bench at Selvedge. method: " + pick(METHODS, C.method).label +
      (C.method === "adapter" ? ", " + pick(RANKS, C.rank).label : "") + "." +
      (C.cut ? " closing line cut after writing." : "");
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["cleaning step", "on", "what it changes in the examples"], true);
    row(ui, ["replace sign-offs", C.signoffs ? "yes" : "no", C.signoffs ? "every one ends the Selvedge team" : "1,640 of 2,000 end Marta"], false);
    row(ui, ["strip names and numbers", C.details ? "yes" : "no", C.details ? "no names, no phone numbers" : "every one names a customer; 400 old number"], false);
    row(ui, ["remove duplicates", C.dupes ? "yes" : "no", C.dupes ? "200 dropped" : "200 saved twice"], false);
    row(ui, ["hold back 200", C.held ? "yes" : "no", C.held ? "200 kept out to read replies" : "none held back"], false);
    ui.note.textContent = "examples trained on: " + fmt(R.n) + ". ending with Marta: " + R.share +
      ". tonight's replies signed Marta: " + R.marta + ". held-back read: " + R.check + ".";
  }

  function setStats(api) {
    var R = bench(api.state.C);
    var st = api.state.stat;
    st.examples(fmt(R.n));
    st.share(R.share);
    st.named(R.named);
    st.settings(R.settings);
    st.memory(R.memory);
    st.marta(R.marta);
    st.team(R.team);
    st.old(R.old);
    st.check(R.check);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = bench(api.state.C);
    if (what) api.log(what + " examples " + fmt(R.n) + "; signed Marta " + R.marta + "; old number " + R.old + ".",
      R.mTonight === 0 && R.old.indexOf("0 ") === 0 ? "ok" : (R.mTonight === 0 ? "warn" : "bad"));
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") C.rank = "16";
    if (plan === "r1") C.method = "full";
    if (plan === "r2") C.cut = true;
    if (plan === "r3") { C.signoffs = true; C.details = true; C.dupes = true; C.held = true; }
    return C;
  }

  function planFollowUp(api, plan) {
    var C = api.state.C;
    var R = bench(C);
    if (plan === "r0") api.log("rank 16 on the same 2,000 emails: " + R.settings + " of the layer trained. replies signed Marta: " + R.marta + ".", "bad");
    if (plan === "r1") api.log("full fine-tuning on the same 2,000 emails: " + R.memory + " just to hold the model, more for training, bigger cards. replies signed Marta: " + R.marta + ".", "bad");
    if (plan === "r2") api.log("closing line cut before sending: signed Marta " + R.marta + ", but old number " + R.old +
      " and " + R.named + " examples still name a customer.", "warn");
    if (plan === "r3") {
      api.log(readFifty(C), "ok");
      api.log("trained on " + fmt(R.n) + " at rank 8. held-back read: " + R.check + ". every reply signed the Selvedge team.", "ok");
    }
  }

  /* ---------- the module ---------- */

  DL.sims.define("a8e02", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.signoffs.set(S.C.signoffs);
        S.ctl.details.set(S.C.details);
        S.ctl.dupes.set(S.C.dupes);
        S.ctl.rank.set(S.C.rank);
        S.ctl.method.set(S.C.method);
        S.ctl.held.set(S.C.held);
        S.ctl.cut.set(S.C.cut);
        S.sync = false;
      }
      function manual(what) {
        if (S.C.plan !== "none") {
          S.C.plan = "none";
          S.sync = true; S.ctl.plan.set("none"); S.sync = false;
          what += " (reply cleared.)";
        }
        refresh(api, what);
      }
      function flag(id, label) {
        S.ctl[id] = api.control.toggle(id, label, false, function (on) {
          if (S.sync) return;
          S.C[id] = !!on;
          manual(label + ": " + (on ? "on." : "off."));
          if (id === "signoffs" && on && !S.C.cut) api.log("sign-offs replaced: " + bench(S.C).team + " replies signed the Selvedge team.", "ok");
        });
      }
      flag("signoffs", "replace sign-offs with the shop's");
      flag("details", "strip names and phone numbers");
      flag("dupes", "remove duplicates");
      S.ctl.rank = api.control.select("rank", "adapter rank", RANKS, "8", function (val) {
        if (S.sync) return;
        var o = pick(RANKS, val);
        if (!o) return;
        S.C.rank = String(o.value);
        manual(o.label + ".");
      });
      S.ctl.method = api.control.select("method", "what is trained", METHODS, "adapter", function (val) {
        if (S.sync) return;
        var o = pick(METHODS, val);
        if (!o) return;
        S.C.method = String(o.value);
        manual(o.label + ".");
      });
      flag("held", "hold back 200 and read the replies");
      flag("cut", "cut the closing line after writing");
      S.ctl.read = api.control.button("read", "read 50 by hand", function () {
        api.log(readFifty(S.C), S.C.signoffs && S.C.details && S.C.dupes ? "ok" : "warn");
      });
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        if (S.sync) return;
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        S.C = planConfig(String(o.value));
        syncControls();
        refresh(api, "plan: " + o.label + ".");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        examples: api.stat("examples", "examples trained on", ""),
        share: api.stat("share", "examples ending with Marta", "warn"),
        named: api.stat("named", "examples naming a customer", "warn"),
        settings: api.stat("settings", "settings trained in one layer", ""),
        memory: api.stat("memory", "memory to hold the big model", ""),
        marta: api.stat("marta", "tonight's replies signed Marta", "bad"),
        team: api.stat("team", "signed the Selvedge team", "ok"),
        old: api.stat("old", "replies giving the old number", "bad"),
        check: api.stat("check", "held-back read before going live", "")
      };

      api.info("<strong>How to read it.</strong> Each row is a cleaning step for the 2,000 training emails: whether it is on, and what it changes. Switch steps on, change the rank or train the whole model, and watch the share of examples ending with Marta, the settings trained, and what tonight's 40 replies would have said.");

      refresh(api, "");
      api.log("Saturday 10 October, 00:45 at Selvedge, after the 00:40 reply. the adapter learned from " + fmt(EMAILS) +
        " raw emails at rank 8, none held back. tonight: " + TONIGHT_MARTA + " of " + TONIGHT + " signed Marta.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: raw emails, rank 8, none held back, 37 of 40 signed Marta.
      t.expect(t.stat("examples") === "2,000" && t.stat("share") === "1,640 of 2,000 (82%)" &&
        t.stat("settings") === "65,536 of 16,777,216 (0.39%)" && t.stat("memory") === "3.5 GB (4-bit)" &&
        t.stat("marta") === "37 of 40" && t.stat("old") === "8 of 40" && t.stat("check") === "not done: went live unread" &&
        has("00:45 at Selvedge"), "Opens at 00:45: 1,640 of 2,000 (82%), rank 8 is 0.39%, 37 of 40 signed Marta");

      // 2. Rank changes the settings, not the habit.
      t.set("rank", "4"); var r4 = t.stat("settings"); var m4 = t.stat("marta");
      t.set("rank", "16"); var r16 = t.stat("settings"); var m16 = t.stat("marta");
      t.set("rank", "8");
      t.expect(r4 === "32,768 of 16,777,216 (0.20%)" && r16 === "131,072 of 16,777,216 (0.78%)" &&
        m4 === "37 of 40" && m16 === "37 of 40", "Rank 4 is 0.20%, rank 16 is 0.78%; 37 of 40 at both");

      // 3. Full fine-tuning: every setting, 14 GB, the same habit.
      t.set("method", "full");
      t.expect(t.stat("settings") === "16,777,216 of 16,777,216 (100%)" && t.stat("memory") === "14 GB (16-bit)" &&
        t.stat("marta") === "37 of 40", "Full fine-tuning: 100% of the layer, 14 GB, still 37 of 40");
      t.set("method", "adapter");

      // 4. The held-back read shows the habit before go-live.
      t.set("held", true);
      t.expect(t.stat("check") === "stop: 185 of 200 signed Marta, 40 give the old number" && t.stat("examples") === "1,800" &&
        t.stat("share") === "1,476 of 1,800 (82%)", "Held back: 1,800 trained, the read stops at 185 of 200 Marta");

      // 5. Duplicates out as well: 1,600 examples, still 82%.
      t.set("dupes", true);
      t.expect(t.stat("examples") === "1,600" && t.stat("share") === "1,312 of 1,600 (82%)",
        "Duplicates out and 200 held back: 1,312 of 1,600 (82%)");

      // 6. The hand read of 50 raw examples.
      t.set("dupes", false); t.set("held", false);
      t.click("read");
      t.expect(has("41 of 50 end Warm regards, Marta") && has("10 give the old shop number") && has("5 are duplicates"),
        "Read 50: 41 Marta, 10 old number, 5 duplicates");

      // 7. Replacing sign-offs: 0 Marta, 40 of 40 the Selvedge team.
      t.set("signoffs", true);
      t.expect(t.stat("marta") === "0 of 40" && t.stat("team") === "40 of 40" && t.stat("share") === "0 of 2,000 (0%)" &&
        has("40 of 40 replies signed the Selvedge team"), "Sign-offs replaced: 0 of 40 Marta, 40 of 40 the Selvedge team");
      t.set("signoffs", false);

      // 8. Reply 0: raise the rank.
      t.set("plan", "r0");
      t.expect(t.stat("marta") === "37 of 40" && t.stat("settings") === "131,072 of 16,777,216 (0.78%)",
        "Reply 0: rank 16, still 37 of 40");

      // 9. Reply 1: full fine-tuning.
      t.set("plan", "r1");
      t.expect(t.stat("marta") === "37 of 40" && t.stat("memory") === "14 GB (16-bit)",
        "Reply 1: full fine-tuning, 14 GB, still 37 of 40");

      // 10. Reply 2: cut after writing hides the other habits.
      t.set("plan", "r2");
      t.expect(t.stat("marta") === "0 of 40" && t.stat("old") === "8 of 40" && t.stat("named") === "2,000 of 2,000",
        "Reply 2: 0 of 40 Marta, but 8 of 40 old number and 2,000 examples naming a customer");

      // 11. Reply 3: clean, dedupe, hold back, read: go.
      t.set("plan", "r3");
      t.expect(t.stat("examples") === "1,600" && t.stat("marta") === "0 of 40" && t.stat("old") === "0 of 40" &&
        t.stat("named") === "0 of 1,600" && t.stat("share") === "0 of 1,600 (0%)" &&
        t.stat("check") === "go: 0 of 200 signed Marta, 0 old number", "Reply 3: 1,600 cleaned, 0 of 200 Marta, go");
    }
  });
})();
