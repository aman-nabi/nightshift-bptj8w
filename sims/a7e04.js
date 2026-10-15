/* sims/a7e04-v1.0.0.js  (published as sims/a7e04.js)
   Case a7e04 "Too Much Power": a tool-permission replay for Kilburne Estate, 24 holiday cottages
   whose booking assistant reached the bookings system through one open-ended tool signed in as
   admin. No real model runs here, and no request text beyond the two given requests exists in this
   file: each record is a kind (true duplicate, single enquiry, paid stay) and a count. The sim models
   the defences and their numbers, never an attack. Widget-style sim: it draws its own table inside
   api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: run the 03:00 job, tool set (one admin tool, narrow
     tools: read, change dates, flag enquiry, or access off), the request (as queued, or option 2's
     exact wording), confirmation before deleting (off, asks and nobody answers at 03:00, asks and
     is approved at 07:30), cap on changes per run (none or 10), sandbox copy first, a reply to play,
     reset. Stats: deleted live, of those true duplicates, single enquiries and paid stays,
     cancellation emails, enquiries flagged, waiting for a person, sandbox report (deletions and paid
     stays), what the tool could delete, date changes left to staff. selfTest: 10 assertions.

   The model (stated in sim.lede, given data):
   - 1,240 records before the night: 520 enquiries, 720 paid bookings.
   - Request as queued, "tidy up duplicate enquiries": the assistant pairs any two records for the
     same cottage and week and keeps the newest.
     38 pairs are the same guest asking twice: 38 deleted (true duplicates).
     262 pairs are an enquiry and someone else's paid booking: the enquiry is older in 182 (enquiry
     deleted: single enquiries) and newer in 80 (paid booking deleted: paid stays next summer).
     38 + 182 + 80 = 300. Enquiries used: 76 + 262 = 338 of 520. Paid used: 262 of 720.
   - Option 2's exact request (same guest asking twice): 38 deleted, all true duplicates.
   - Each deleted paid booking sends one cancellation email: 80 as built.
   - Narrow tools have no delete. The flag tool marks enquiries only and refuses paid bookings, so the
     same request flags 38 + 182 = 220 and touches 0 paid. Exact request: 38 flagged.
   - The cap counts changes to bookings (deletions and date changes; the run has no date changes).
     Flags are marks for a person, not changes, so the cap does not limit them.
     Given: the record's first 10 deletions were 2 true duplicates, 6 single enquiries, 2 paid.
     Cap 10, as queued: 10 deleted (2, 6, 2), 2 emails, 290 wait. Exact request: 10 deleted, all
     true duplicates, 28 wait.
   - Confirmation (deletions only): the assistant sends one ask for the whole run. Nobody is awake
     at 03:00: all planned deletions wait. Approved at 07:30: all go (the cap still applies).
   - Sandbox first: the job runs on the copy; the report shows what it would do; 0 live changes and
     0 emails; the planned actions wait for a person to read the report.
   - What the tool could delete: admin, all 1,240 records; narrow tools or access off, none.
   - Access off: nothing runs. Given: about 900 date changes in six months go to staff (900 were
     made from 14 April to 13 October).

   Where every number comes from (conventions rule 14; the case is content/latent/a7/a7e04-v1.0.0.json):
   - As built: 300 deleted (38, 182, 80), 80 emails, reach 1,240 (the post and evidence diagram).
   - Option 0 (ask first, approved at 07:30): 300 (38, 182, 80), 80 emails, reach 1,240; unanswered:
     0 deleted, 300 waiting.
   - Option 1 (narrow tools): 0 deleted, 220 flagged, 0 paid, 0 emails, reach 0.
   - Option 2 (exact request): 38 deleted, 0 emails, reach 1,240.
   - Option 3 (access off): 0 deleted, 0 flagged, 900 date changes to staff.
   - Cap 10: 10 deleted, 2 paid, 2 emails, 290 waiting. Sandbox: report 300 and 80 paid, 0 live.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var RECORDS = 1240;
  var ENQUIRIES = 520;
  var PAID = 720;
  var VAGUE = { d: 38, s: 182, p: 80 };   // as queued: true duplicates, single enquiries, paid stays
  var EXACT = { d: 38, s: 0, p: 0 };      // option 2's wording
  var FIRST10_VAGUE = { d: 2, s: 6, p: 2 };   // the record's first 10 deletions (given)
  var FIRST10_EXACT = { d: 10, s: 0, p: 0 };
  var STAFF_DATES = 900;                   // date changes in six months, if access is off (given)

  var TOOLS = [
    { value: "admin", label: "one admin tool (as built)" },
    { value: "narrow", label: "narrow tools: read, change dates, flag enquiry" },
    { value: "off", label: "access off" }
  ];
  var REQUESTS = [
    { value: "vague", label: "as queued: tidy up duplicate enquiries" },
    { value: "exact", label: "exact: the same guest asking twice" }
  ];
  var CONFIRM = [
    { value: "off", label: "off (as built)" },
    { value: "nobody", label: "asks; nobody answers at 03:00" },
    { value: "yes", label: "asks; approved at 07:30" }
  ];
  var CAPS = [
    { value: "none", label: "none (as built)" },
    { value: "10", label: "10 changes a run" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: restore, and ask before deleting" },
    { value: "r1", label: "reply 1: narrow tools, deletes for a person" },
    { value: "r2", label: "reply 2: a clearer request" },
    { value: "r3", label: "reply 3: switch off access" }
  ];

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function zero() { return { d: 0, s: 0, p: 0 }; }
  function copy(k) { return { d: k.d, s: k.s, p: k.p }; }
  function total(k) { return k.d + k.s + k.p; }
  function defaults() {
    return { tools: "admin", request: "vague", confirm: "off", cap: "none", sandbox: false, plan: "none" };
  }

  /* ---------- the model (pure: settings in, counts out) ---------- */

  function replay(C) {
    var R = { del: zero(), flag: zero(), box: zero(), boxFlag: 0, waiting: 0, emails: 0, reach: 0, staff: 0, note: "" };
    if (C.tools === "off") {
      R.staff = STAFF_DATES;
      R.note = "access off: nothing ran";
      return R;
    }
    var planned = C.request === "vague" ? VAGUE : EXACT;
    if (C.tools === "narrow") {
      var f = { d: planned.d, s: planned.s, p: 0 };     // the flag tool refuses paid bookings
      if (C.sandbox) {
        R.boxFlag = total(f);
        R.waiting = total(f);
        R.note = "sandbox: would flag " + total(f) + ", no live change";
        return R;
      }
      R.flag = f;
      R.waiting = total(f);
      R.note = "flagged " + total(f) + " for a person";
      return R;
    }
    // one admin tool
    R.reach = RECORDS;
    if (C.sandbox) {
      R.box = copy(planned);
      R.waiting = total(planned);
      R.note = "sandbox: would delete " + total(planned) + ", " + planned.p + " paid, no live change";
      return R;
    }
    if (C.confirm === "nobody") {
      R.waiting = total(planned);
      R.note = "one ask at 03:00, nobody answered";
      return R;
    }
    var live = copy(planned);
    if (C.cap === "10" && total(planned) > 10) {
      live = copy(C.request === "vague" ? FIRST10_VAGUE : FIRST10_EXACT);
      R.waiting = total(planned) - 10;
      R.note = "cap reached at 10";
    } else {
      R.note = C.confirm === "yes" ? "approved at 07:30" : "every delete allowed";
    }
    R.del = live;
    R.emails = live.p;
    return R;
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
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "tools: " + pick(TOOLS, C.tools).label + ". request: " + pick(REQUESTS, C.request).label +
      ". confirmation: " + pick(CONFIRM, C.confirm).label + ". cap: " + pick(CAPS, C.cap).label +
      ". sandbox first: " + (C.sandbox ? "on" : "off") + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["kind of record", "deleted live", "flagged", "in sandbox report"], true);
    var R = S.R;
    var kinds = [["true duplicates", "d"], ["single enquiries", "s"], ["paid stays", "p"]];
    kinds.forEach(function (k) {
      if (!R) { row(ui, [k[0], "-", "-", "-"], false); return; }
      var boxed = R.boxFlag ? (k[1] === "p" ? 0 : (C.request === "vague" ? VAGUE : EXACT)[k[1]]) : R.box[k[1]];
      row(ui, [k[0], R.del[k[1]], R.flag[k[1]], boxed], false);
    });
    if (!R) {
      ui.note.textContent = "Morning of 14 October. 1,240 records (520 enquiries, 720 paid). Nothing replayed yet.";
      return;
    }
    ui.note.textContent = "result: " + R.note + ". emails sent " + R.emails + ". waiting for a person " + R.waiting +
      ". the tool could delete " + (R.reach ? "all " + fmt(R.reach) + " records" : "nothing") + ".";
  }

  function setStats(api) {
    var S = api.state;
    var st = S.stat;
    var ids = ["deleted", "dups", "singles", "paid", "emails", "flagged", "waiting", "boxDel", "boxPaid", "reach", "staff"];
    if (!S.R) { ids.forEach(function (id) { st[id]("-"); }); return; }
    var R = S.R;
    st.deleted(total(R.del));
    st.dups(R.del.d);
    st.singles(R.del.s);
    st.paid(R.del.p);
    st.emails(R.emails);
    st.flagged(total(R.flag));
    st.waiting(R.waiting);
    st.boxDel(total(R.box));
    st.boxPaid(R.box.p);
    st.reach(fmt(R.reach));
    st.staff(R.staff);
  }

  function run(api, what) {
    var S = api.state;
    S.R = replay(S.C);
    var R = S.R;
    draw(api);
    setStats(api);
    api.log((what ? what + " " : "") + "03:00 run replayed: deleted " + total(R.del) + " (" + R.del.d + " true duplicates, " +
      R.del.s + " single enquiries, " + R.del.p + " paid stays); emails " + R.emails + "; flagged " + total(R.flag) +
      "; waiting for a person " + R.waiting + ".", R.del.p ? "bad" : (total(R.del) ? "warn" : "ok"));
    if (R.boxFlag || total(R.box)) {
      api.log("sandbox report: would delete " + total(R.box) + ", " + R.box.p + " of them paid; would flag " + R.boxFlag +
        "; 0 live changes, 0 emails.", R.box.p ? "warn" : "ok");
    }
    if (R.staff) api.log("date changes left to staff, next six months: about " + R.staff + ".", "warn");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") C.confirm = "yes";
    if (plan === "r1") C.tools = "narrow";
    if (plan === "r2") C.request = "exact";
    if (plan === "r3") C.tools = "off";
    return C;
  }

  /* ---------- the module ---------- */

  DL.sims.define("a7e04", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.R = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      function manual(what) {
        if (S.C.plan !== "none") { S.C.plan = "none"; S.ctl.plan.set("none"); what += " (reply cleared.)"; }
        run(api, what);
      }
      function sel(id, label, list, key) {
        S.ctl[id] = api.control.select(id, label, list, S.C[key], function (val) {
          var o = pick(list, val);
          if (!o) return;
          S.C[key] = String(o.value);
          manual(label + ": " + o.label + ".");
        });
      }
      S.ctl.run = api.control.button("run", "run 03:00", function () { run(api, ""); });
      sel("tools", "tool set", TOOLS, "tools");
      sel("request", "queued request", REQUESTS, "request");
      sel("confirm", "confirmation before deleting", CONFIRM, "confirm");
      sel("cap", "cap on changes per run", CAPS, "cap");
      S.ctl.sandbox = api.control.toggle("sandbox", "sandbox copy first", false, function (on) {
        S.C.sandbox = !!on;
        manual("sandbox copy first: " + (on ? "on." : "off."));
      });
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        var C = planConfig(String(o.value));
        S.C = C;
        S.ctl.tools.set(C.tools); S.ctl.request.set(C.request); S.ctl.confirm.set(C.confirm);
        S.ctl.cap.set(C.cap); S.ctl.sandbox.set(C.sandbox);
        run(api, "plan: " + o.label + ".");
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        deleted: api.stat("deleted", "records deleted live", "bad"),
        dups: api.stat("dups", "of those, true duplicates", ""),
        singles: api.stat("singles", "of those, single enquiries", "warn"),
        paid: api.stat("paid", "of those, paid stays", "bad"),
        emails: api.stat("emails", "cancellation emails sent", "bad"),
        flagged: api.stat("flagged", "enquiries flagged for a person", "ok"),
        waiting: api.stat("waiting", "actions waiting for a person", ""),
        boxDel: api.stat("boxDel", "sandbox report: would delete", "warn"),
        boxPaid: api.stat("boxPaid", "sandbox report: paid stays", "warn"),
        reach: api.stat("reach", "records the tool could delete", "warn"),
        staff: api.stat("staff", "date changes left to staff (six months)", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one kind of record the 03:00 job paired: what was deleted for real, what was flagged for a person, and what a sandbox run would report. Choose the tools and guards, then run the job.");

      draw(api);
      setStats(api);
      api.log("Morning of 14 October at Kilburne. Nothing replayed yet: " + fmt(RECORDS) + " records, " + ENQUIRIES +
        " enquiries and " + PAID + " paid.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: nothing replayed.
      t.expect(t.stat("deleted") === "-" && t.stat("reach") === "-" &&
        has("Morning of 14 October at Kilburne. Nothing replayed yet: 1,240 records, 520 enquiries and 720 paid."),
        "Opens on the morning of 14 October with nothing replayed");

      // 2. As built: one admin tool, the request as queued.
      t.click("run");
      t.expect(t.stat("deleted") === 300 && t.stat("dups") === 38 && t.stat("singles") === 182 &&
        t.stat("paid") === 80 && t.stat("emails") === 80 && t.stat("reach") === "1,240",
        "As built: 300 deleted (38, 182, 80), 80 emails, the tool could delete all 1,240");

      // 3. Narrow tools: nothing deleted, 220 enquiries flagged, no paid booking.
      t.set("tools", "narrow");
      t.expect(t.stat("deleted") === 0 && t.stat("flagged") === 220 && t.stat("paid") === 0 &&
        t.stat("emails") === 0 && t.stat("reach") === 0,
        "Narrow tools: 0 deleted, 220 flagged, 0 paid, 0 emails, nothing deletable");

      // 4. Back to admin with a cap of 10.
      t.set("tools", "admin");
      t.set("cap", "10");
      t.expect(t.stat("deleted") === 10 && t.stat("paid") === 2 && t.stat("emails") === 2 && t.stat("waiting") === 290,
        "Cap of 10: stops at 10 deletions, 2 paid, 2 emails, 290 waiting");

      // 5. Sandbox first: the copy shows the 80 paid stays, nothing live changes.
      t.set("cap", "none");
      t.set("sandbox", true);
      t.expect(t.stat("deleted") === 0 && t.stat("emails") === 0 && t.stat("boxDel") === 300 && t.stat("boxPaid") === 80 &&
        has("sandbox report: would delete 300, 80 of them paid"),
        "Sandbox: the report shows 300 and the 80 paid stays, 0 live changes");

      // 6. Confirmation with nobody awake at 03:00: everything waits.
      t.set("sandbox", false);
      t.set("confirm", "nobody");
      t.expect(t.stat("deleted") === 0 && t.stat("waiting") === 300,
        "Confirmation, nobody answers at 03:00: 0 deleted, 300 waiting");

      // 7. Reply 0: ask before deleting, approved at 07:30.
      t.set("plan", "r0");
      t.expect(t.stat("deleted") === 300 && t.stat("paid") === 80 && t.stat("emails") === 80 && t.stat("reach") === "1,240" &&
        has("plan: reply 0: restore, and ask before deleting."),
        "Reply 0: approved at 07:30, the same 300 and 80 emails; still admin");

      // 8. Reply 1: narrow tools.
      t.set("plan", "r1");
      t.expect(t.stat("deleted") === 0 && t.stat("flagged") === 220 && t.stat("paid") === 0 && t.stat("waiting") === 220,
        "Reply 1: 0 deleted, 220 flagged for a person, no paid booking touched");

      // 9. Reply 2: a clearer request.
      t.set("plan", "r2");
      t.expect(t.stat("deleted") === 38 && t.stat("dups") === 38 && t.stat("emails") === 0 && t.stat("reach") === "1,240",
        "Reply 2: 38 true duplicates deleted, 0 emails, the tool could still delete all 1,240");

      // 10. Reply 3: access off.
      t.set("plan", "r3");
      t.expect(t.stat("deleted") === 0 && t.stat("flagged") === 0 && t.stat("staff") === 900 &&
        has("date changes left to staff, next six months: about 900."),
        "Reply 3: nothing runs; about 900 date changes go to staff");
    }
  });
})();
