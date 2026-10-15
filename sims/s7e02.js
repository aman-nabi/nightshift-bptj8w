/* sims/s7e02-v1.0.0.js  (published as sims/s7e02.js)
   Case s7e02 "What May You Do": a permission lab for the Tollemache Theatre. Three systems (box
   office, costume hire, payroll) keep their bookings in one shared table with a kind column, and a
   nightly clean-up job for the ticket printer deletes the custom ticket drafts at 02:00. The learner
   picks the accounts, the rights model, the slip in the filter, a second reader, and the backup,
   then runs the job and reads the access grid, the rows deleted, the name the audit log would
   record, and what the last backup gives back. Widget-style sim: it draws inside api.root.
   It models the defence and its numbers only; there is no attack tooling here.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: accounts (one shared, theatre_all, or one per system:
     boxoffice, costumes, payroll, with the printer's job under boxoffice); rights (full rights,
     roles, roles plus attributes); the slip (in the filter or not); a second reader of the filter;
     the backup (weekly, Sunday 23:00, or nightly, 23:00). Stats: rows deleted, costume hires left,
     the name the audit log would record, rows the job's account may delete, costume hires the last
     backup gives back, costume hires lost for good. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - The bookings table on the night, as given data: ticket 38,400; custom 41 (the night's
     drafts); costume 1,860 (the season's costume hires); shift 2,940. Total 43,241.
   - Each kind belongs to one system: ticket and custom to the box office (account boxoffice),
     costume to costume hire (costumes), shift to payroll (payroll).
   - Shared account: theatre_all holds every system's rights, so it may read, change and delete
     every kind whatever the model (a rule about who is asking can't tell the systems apart).
   - One account per system, full rights: each account may read, change and delete every kind.
   - Roles: each account may read, change and delete only its own system's kinds.
   - Roles plus attributes: as roles, but boxoffice may delete custom drafts only between 02:00
     and 03:00 (D*), and may never delete tickets (they are marked refunded instead).
   - The job runs at 02:00, inside the 02:00 to 03:00 window. Its filter names 'costume' when the
     slip is in and no second reader is on; otherwise 'custom'. The database deletes every row of
     that kind if the job's account may delete it, otherwise it refuses and deletes none.
   - Backups: costume hires booked after the last backup are lost when it is put back. As given
     data: 64 booked since Sunday 23:00 (weekly), 3 since 23:00 last night (nightly).

   Where every number comes from (conventions rule 14; the case is content/s7/s7e02-v1.0.0.json).
   - 1,860 deleted as built (shared account, slip in): COUNT.costume.
   - 1,796 back, 64 lost from the weekly backup: 1,860 - 64. 1,857 back, 3 lost, nightly: 1,860 - 3.
   - 41 deleted when the filter reads 'custom' (slip out, or the second reader catches it).
   - What the job's account may delete: theatre_all or full rights 43,241 (all four kinds); roles
     38,441 (38,400 tickets + 41 drafts); roles plus attributes 41 (drafts only, in the window).
   - Per system with roles or attributes and the slip in: refused, 0 deleted, 1,860 kept.
   - The audit log's name: theatre_all (shared) or boxoffice (one per system).
   - 44 clean nights (1 September to 14 October) and the 02:00:04 timestamp come from the post.
   - From the post, not modelled: 37 drafts deleted on 14 October; the 06:00 collections list; the
     courier at 07:15 for 30 sailor suits; the account set up in June.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var KINDS = ["ticket", "custom", "costume", "shift"];
  var COUNT = { ticket: 38400, custom: 41, costume: 1860, shift: 2940 };
  var KIND_LABEL = { ticket: "tickets", custom: "custom drafts", costume: "costume hires", shift: "payroll shifts" };
  var OWNER = { ticket: "boxoffice", custom: "boxoffice", costume: "costumes", shift: "payroll" };
  var SYSTEMS = ["boxoffice", "costumes", "payroll"];
  var SINCE = { weekly: 64, nightly: 3 };

  var ACCOUNTS = [
    { value: "shared", label: "One shared account, theatre_all (as built)" },
    { value: "per", label: "One account per system (job runs as boxoffice)" }
  ];
  var MODELS = [
    { value: "full", label: "Full rights (as built)" },
    { value: "roles", label: "Roles: each account, its own kinds" },
    { value: "attrs", label: "Roles plus attributes (what and when)" }
  ];
  var BACKUPS = [
    { value: "weekly", label: "Weekly, Sunday 23:00 (as built)" },
    { value: "nightly", label: "Nightly, 23:00" }
  ];
  var MODEL_SHORT = { full: "full rights", roles: "roles", attrs: "roles plus attributes" };
  var BACKUP_SHORT = { weekly: "weekly (Sunday 23:00)", nightly: "nightly (23:00)" };

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function accountsOf(C) { return C.accounts === "shared" ? ["theatre_all"] : SYSTEMS.slice(); }
  function jobAccount(C) { return C.accounts === "shared" ? "theatre_all" : "boxoffice"; }

  // Rights of one account on one kind: r, c true or false; d true, false or "window" (02:00 to 03:00 only).
  function rights(C, acct, kind) {
    if (acct === "theatre_all" || C.model === "full") return { r: true, c: true, d: true };
    if (OWNER[kind] !== acct) return { r: false, c: false, d: false };
    if (C.model === "attrs" && acct === "boxoffice") {
      if (kind === "ticket") return { r: true, c: true, d: false };
      if (kind === "custom") return { r: true, c: true, d: "window" };
    }
    return { r: true, c: true, d: true };
  }

  function cellText(rt) {
    var s = [];
    if (rt.r) s.push("R");
    if (rt.c) s.push("C");
    if (rt.d === true) s.push("D");
    else if (rt.d === "window") s.push("D*");
    return s.length ? s.join(" ") : "-";
  }

  function grid(C) {
    var cells = {};
    accountsOf(C).forEach(function (a) {
      KINDS.forEach(function (k) { cells[a + "|" + k] = cellText(rights(C, a, k)); });
    });
    return cells;
  }

  // Rows the job's account may delete at 02:00 (inside the attribute window).
  function reach(C) {
    var a = jobAccount(C);
    var n = 0;
    KINDS.forEach(function (k) { if (rights(C, a, k).d) n += COUNT[k]; });
    return n;
  }

  function filterKind(C) { return C.slip && !C.check ? "costume" : "custom"; }

  function runJob(C) {
    var kind = filterKind(C);
    var acct = jobAccount(C);
    var allowed = !!rights(C, acct, kind).d;
    return { kind: kind, acct: acct, allowed: allowed, deleted: allowed ? COUNT[kind] : 0 };
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
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    var caption = el("p", "margin:0;font-size:12px;", "Access grid: which account may read (R), change (C) or delete (D) each kind. D* means only between 02:00 and 03:00. A dash means nothing.");
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
    var thead = el("thead");
    var hr = el("tr");
    hr.appendChild(el("th", "text-align:left;", "account"));
    KINDS.forEach(function (k) { hr.appendChild(el("th", "text-align:left;", k + " (" + fmt(COUNT[k]) + ")")); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    var job = el("pre", "margin:0;font-size:12px;white-space:pre-wrap;");
    var audit = el("pre", "margin:0;font-size:12px;white-space:pre-wrap;");
    box.appendChild(head);
    box.appendChild(caption);
    box.appendChild(wrap);
    box.appendChild(job);
    box.appendChild(audit);
    api.root.appendChild(box);
    return { el: el, head: head, tbody: tbody, job: job, audit: audit };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var el = ui.el;
    S.cells = grid(C);
    ui.head.textContent = "Accounts: " + (C.accounts === "shared" ? "one shared, theatre_all" : "one per system") +
      ". Rights: " + MODEL_SHORT[C.model] + ". Slip in the filter: " + (C.slip ? "yes" : "no") +
      ". Second reader: " + (C.check ? "on" : "off") + ". Backup: " + BACKUP_SHORT[C.backup] + ".";
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    accountsOf(C).forEach(function (a) {
      var tr = el("tr");
      tr.appendChild(el("td", "", a + (a === jobAccount(C) ? " (job)" : "")));
      KINDS.forEach(function (k) { tr.appendChild(el("td", "", S.cells[a + "|" + k])); });
      ui.tbody.appendChild(tr);
    });
    ui.job.textContent = "02:00 clean-up job, signed in as " + jobAccount(C) + ":\nDELETE FROM bookings WHERE kind = '" + filterKind(C) + "'";
    if (S.out) {
      var o = S.out;
      ui.audit.textContent = "Audit log: 02:00:04  DELETE  kind=" + o.kind + "  rows " + fmt(o.deleted) + "  " +
        (o.allowed ? "allowed" : "refused") + "  account " + o.acct;
    } else {
      ui.audit.textContent = "Audit log: nothing yet tonight. The job hasn't run.";
    }

    S.stat.name(jobAccount(C));
    S.stat.reach(fmt(reach(C)));
    if (!S.out) {
      S.stat.deleted("not run yet");
      S.stat.costume(fmt(COUNT.costume));
      S.stat.back("not run yet");
      S.stat.lost("not run yet");
      return;
    }
    var hit = S.out.allowed && S.out.kind === "costume";
    S.stat.deleted(fmt(S.out.deleted));
    S.stat.costume(fmt(hit ? 0 : COUNT.costume));
    S.stat.back(hit ? fmt(COUNT.costume - SINCE[C.backup]) : "nothing to put back");
    S.stat.lost(hit ? fmt(SINCE[C.backup]) : "0");
  }

  // Any change replays the night from before 02:00.
  function change(api, what) {
    api.state.out = null;
    api.log(what + " The night is set back to before 02:00.", "");
    draw(api);
  }

  function run(api) {
    var S = api.state;
    var C = S.C;
    if (S.out) {
      api.log("The job has already run tonight. Change a setting or reset to replay the night.", "");
      return;
    }
    if (C.slip && C.check) {
      api.log("Before 02:00 the second reader reads the filter, sees 'costume' and sets it back to 'custom'.", "ok");
    }
    var o = runJob(C);
    api.log("02:00:00 The clean-up job signs in as " + o.acct + " and asks: DELETE FROM bookings WHERE kind = '" + o.kind +
      "'. " + fmt(COUNT[o.kind]) + " rows match.", "");
    if (o.allowed) {
      api.log("02:00:04 Allowed: " + o.acct + " may delete " + KIND_LABEL[o.kind] + ". " + fmt(o.deleted) + " rows deleted. Audit log: DELETE kind=" +
        o.kind + " rows " + fmt(o.deleted) + " allowed, account " + o.acct + ".", o.kind === "costume" ? "bad" : "ok");
    } else {
      api.log("02:00:04 Refused: " + o.acct + " may not delete " + KIND_LABEL[o.kind] + ". 0 rows deleted. The refusal is logged under " +
        o.acct + ", and the job stops with an error.", "ok");
    }
    S.out = o;
    if (o.allowed && o.kind === "costume") {
      api.log("Putting back the costume hires from the " + BACKUP_SHORT[C.backup] + " backup: " + fmt(COUNT.costume - SINCE[C.backup]) +
        " come back, and the " + SINCE[C.backup] + " booked since it are lost.", "warn");
    }
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s7e02", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { accounts: "shared", model: "full", slip: true, check: false, backup: "weekly" };
      S.out = null;
      S.ui = buildWidget(api);
      S.ctl = {};

      S.ctl.accounts = api.control.select("accounts", "Accounts", ACCOUNTS, "shared", function (v) {
        var o = pick(ACCOUNTS, v);
        if (!o) return;
        S.C.accounts = String(o.value);
        change(api, "Accounts: " + (S.C.accounts === "shared" ? "one shared, theatre_all." : "one per system; the job signs in as boxoffice."));
      });
      S.ctl.model = api.control.select("model", "Rights", MODELS, "full", function (v) {
        var o = pick(MODELS, v);
        if (!o) return;
        S.C.model = String(o.value);
        change(api, "Rights: " + MODEL_SHORT[S.C.model] + "." + (S.C.accounts === "shared" ? " theatre_all still holds every system's rights." : ""));
      });
      S.ctl.slip = api.control.toggle("slip", "Last night's slip in the filter ('costume' for 'custom')", true, function (on) {
        S.C.slip = !!on;
        change(api, "Slip in the filter: " + (on ? "yes." : "no."));
      });
      S.ctl.check = api.control.toggle("check", "A second person reads the filter first", false, function (on) {
        S.C.check = !!on;
        change(api, "Second reader: " + (on ? "on." : "off."));
      });
      S.ctl.backup = api.control.select("backup", "Backup", BACKUPS, "weekly", function (v) {
        var o = pick(BACKUPS, v);
        if (!o) return;
        S.C.backup = String(o.value);
        change(api, "Backup: " + BACKUP_SHORT[S.C.backup] + ".");
      });
      S.ctl.run = api.control.button("run", "Run the 02:00 clean-up", function () { run(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        deleted: api.stat("deleted", "rows the job deleted", "bad"),
        costume: api.stat("costume", "costume hires left", ""),
        name: api.stat("name", "name the audit log would record", "warn"),
        reach: api.stat("reach", "rows the job's account may delete", "warn"),
        back: api.stat("back", "costume hires the last backup gives back", "ok"),
        lost: api.stat("lost", "costume hires lost for good", "bad")
      };

      api.info("<strong>How to read it.</strong> One table holds every booking, each labelled with its kind. The grid shows what each account may do to each kind. The clean-up job signs in, sends its delete, and the database checks the account's rights first: allowed, every matching row goes; refused, none do. The audit log records what happened; with names on, it records the account, which is only useful when each system has its own.");

      api.log("Before 02:00, as built: one shared account, theatre_all, with full rights over 43,241 bookings. The filter has the slip in it.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function since() { return t.logText().slice(mark); }
      function has(s) { return since().indexOf(s) >= 0; }
      function cell(a, k) { return t.api.state.cells[a + "|" + k]; }

      // 1. Opening state: before 02:00, nothing deleted yet.
      t.expect(t.stat("deleted") === "not run yet" && t.stat("costume") === "1,860" && t.stat("name") === "theatre_all" &&
        t.stat("reach") === "43,241" && t.stat("back") === "not run yet" && cell("theatre_all", "costume") === "R C D",
        "Opens before 02:00: 1,860 costume hires, theatre_all may delete all 43,241 bookings");

      // 2. As built: the shared account deletes every costume hire.
      begin();
      t.click("run");
      t.expect(t.stat("deleted") === "1,860" && t.stat("costume") === 0 && t.stat("name") === "theatre_all" &&
        has("02:00:04 Allowed: theatre_all may delete costume hires. 1,860 rows deleted."),
        "As built: the job, as theatre_all, deletes all 1,860 costume hires, and the database allows it");

      // 3. The weekly backup gives back 1,796; 64 are lost.
      t.expect(t.stat("back") === "1,796" && t.stat("lost") === 64,
        "Weekly backup (Sunday 23:00): 1,796 come back, 64 are lost");

      // 4. A nightly backup: 1,857 back, 3 lost, and the delete still happens.
      t.set("backup", "nightly");
      t.click("run");
      t.expect(t.stat("deleted") === "1,860" && t.stat("back") === "1,857" && t.stat("lost") === 3,
        "Nightly backup (23:00): still 1,860 deleted; 1,857 come back, 3 are lost");

      // 5. A second reader catches the slip, but theatre_all may still delete everything, payroll included.
      t.set("backup", "weekly");
      t.set("check", true);
      begin();
      t.click("run");
      t.expect(t.stat("deleted") === 41 && t.stat("costume") === "1,860" && t.stat("reach") === "43,241" &&
        cell("theatre_all", "shift") === "R C D" && has("sees 'costume' and sets it back to 'custom'"),
        "Second reader: 41 drafts deleted, but theatre_all may still delete all 43,241, payroll's shifts among them");

      // 6. No slip at all: the 44 clean nights' outcome.
      t.set("check", false);
      t.set("slip", false);
      t.click("run");
      t.expect(t.stat("deleted") === 41 && t.stat("back") === "nothing to put back" && t.stat("lost") === 0,
        "No slip: the job deletes the 41 custom drafts and nothing else");

      // 7. One account per system, but full rights: same loss, a better name.
      t.set("slip", true);
      t.set("accounts", "per");
      t.click("run");
      t.expect(t.stat("deleted") === "1,860" && t.stat("name") === "boxoffice" && t.stat("reach") === "43,241",
        "One account per system with full rights: still 1,860 deleted, now under boxoffice");

      // 8. Per system with roles: refused, nothing deleted.
      t.set("model", "roles");
      begin();
      t.click("run");
      t.expect(t.stat("deleted") === 0 && t.stat("costume") === "1,860" && t.stat("reach") === "38,441" &&
        cell("boxoffice", "costume") === "-" && has("02:00:04 Refused: boxoffice may not delete costume hires. 0 rows deleted."),
        "Roles: the database refuses boxoffice's delete of costume hires; 0 deleted, 1,860 kept");

      // 9. Roles plus attributes: the job's account may delete only the 41 drafts, in the window.
      t.set("model", "attrs");
      t.click("run");
      t.expect(t.stat("deleted") === 0 && t.stat("reach") === 41 && cell("boxoffice", "custom") === "R C D*" &&
        cell("boxoffice", "ticket") === "R C",
        "Roles plus attributes: refused again, and the job's account may delete only 41 drafts, 02:00 to 03:00");

      // 10. Attributes allow the real job: no slip, the 41 drafts go at 02:00.
      t.set("slip", false);
      t.click("run");
      t.expect(t.stat("deleted") === 41 && t.stat("costume") === "1,860",
        "Roles plus attributes, no slip: the job still deletes its 41 drafts at 02:00");

      // 11. A shared account can't be narrowed by roles: it holds them all.
      t.set("slip", true);
      t.set("accounts", "shared");
      t.set("model", "roles");
      t.click("run");
      t.expect(t.stat("deleted") === "1,860" && t.stat("reach") === "43,241" && t.stat("name") === "theatre_all",
        "Shared account with roles: theatre_all holds every role, so 1,860 are deleted again");
    }
  });
})();
