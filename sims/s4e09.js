/* sims/s4e09-v1.0.0.js  (published as sims/s4e09.js)
   Case s4e09 "Replay the Night": an event store lab for the listings system at Cressbrook
   Magistrates' Court. Every change to a case is an event in the event store; the docket the court
   reads is a projection built from those events. On Monday 5 October 2026 a fixed projection (v2)
   replayed every event since 3 January 2019 into the live docket, and the projection also emailed a
   witness summons for every HearingListed it saw. The learner picks the projection version, where
   the summons is sent from, where the replay writes, whether it starts from last night's
   checkpoint, whether the email is switched off, whether the clerk edits the docket by hand, and
   runs the night. Widget-style sim: it draws its own tables inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: a 27-event sample stream over 7 cases; projection v1 (ignores
     HearingAdjourned) or v2 (fixed); summons sent inside the projection or by a handler that
     records what it sent; replay into the live docket or into a new one, then switch; replay from
     the start or from last night's checkpoint; email switched off 23:25 to 06:00; the clerk's hand
     edits; replay tonight on or off. Stats: clock, events, replayed, length, docket, wrong, sent,
     stale, twice, lost, total. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - The full store holds 43,200 events before the night (since Thu 3 Jan 2019). The replay reads 4
     events a second, starting at Mon 23:30:00; an event at store position p is handled at
     23:30:00 + ceil(p / 4) seconds. So the full replay takes 10,800 s, 3 h 00 min, and reaches the
     last pre-night event at 02:30:00.
   - Last night's checkpoint was saved by the v1 projection at Sun 4 Oct 23:00, at position 43,164.
     A replay from it handles positions 43,165 to 43,200 (Monday's 36 events): 9 s, to 23:30:09.
   - One live event arrives during the night: the listing office's batch lists hearing H12 at Tue
     02:10:00, position 43,201, naming 1 witness.
   - v1 ignores HearingAdjourned, so an adjourned hearing stays "listed". v2 marks it "adjourned".
   - Inside the projection: every HearingListed the projection handles, replayed or live, emails a
     summons to each witness on it. Handler: a separate program follows only new events, sends each
     summons once, and records (hearing, witness) in a table of summonses sent; a replay never
     reaches it.
   - Live docket: the replay wipes it (or resets it to the checkpoint) and refills it; the 02:10
     listing waits for the replay to reach it. New docket: the old live docket (v1, with any hand
     edits) keeps serving and handles 02:10 itself; the new one is built beside it, reads to the end
     of the stream, and the court switches over when it has caught up.
   - Email switched off by hand from 23:25 to 06:00: every summons in that window is dropped.
   - Hand edits: before the night the clerk sets the upcoming hearings the docket wrongly shows as
     listed (H7, Thu 8 Oct; H8, Wed 7 Oct) to adjourned. A replay into the live docket overwrites
     them; the checkpoint was saved before them.
   - Rows wrong: docket rows whose status differs from v2 run over every event.

   Where every number comes from (conventions rule 14; the case is content/s4/s4e09-v1.0.0.json):
   - Sample listings before the night name 2+3+3+2+1+1+2+1+2+1+2 = 20 witnesses. 15 are for
     hearings already over or adjourned (H1 to H6: 12; H7, H8: 3), 5 for hearings still to come
     (H9 2, H10 1, H11 2). Monday's listings after the checkpoint: H10 1 + H11 2 = 3.
   - The widow: H4 (case 21/0412), listed Tue 4 May 2021 at position 12,988, for Mon 14 Jun 2021,
     witnesses H. Quarrington and the reporting officer. Replayed at 23:30:00 + 3,247 s = 00:24:07.
   - The night as it ran (v2, inside, live docket, from the start, email on): 20 replayed summonses
     + H12's at 02:30:01 (ceil(43,201 / 4) = 10,801 s) = 21 in the sample; full store 1,263
     replayed (stated: 287 listings naming 1 witness, 344 naming 2, 96 naming 3, so 287 + 688 + 288
     = 1,263; 1,222 for hearings over or adjourned, 41 second summonses) + 1 = 1,264. Rows wrong at
     06:00: 0. Docket half-built 23:30:00 to 02:30:01.
   - New docket, summons inside: 20 + H12 by the old v1 at 02:10:00 + H12 again at 02:30:01 = 22,
     6 twice; full store 1,265.
   - Handler (either target): 1 summons, H12 at 02:10:00; full store 1. Rows wrong 0.
   - Checkpoint, v2, inside: 3 summonses again + H12 at 02:10:00 = 4; rows wrong 3 (H2, H5, H7
     adjourned before the checkpoint). Replay length 9 s.
   - Before the night (v1): rows wrong 4 (H2, H5, H7, H8). Hand edits: 2 (H2, H5).
   - Email off: 0 sent, 1 lost (H12's witness), 0 in the full store.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var STORE = 43200;          // events before the night
  var RATE = 4;               // events a second during a replay
  var CHECKPOINT = 43164;     // position of Sunday's checkpoint
  var STORE_SUMMONS = 1263;   // 287 x 1 + 344 x 2 + 96 x 3
  var STORE_STALE = 1222;
  var STORE_TWICE = 41;
  var TODAY = "2026-10-06";   // the night runs into Tuesday 6 October 2026
  var START = 23 * 3600 + 30 * 60;

  var CASES = {
    C1: "19/0031", C2: "20/1187", C3: "21/0412", C4: "23/2264", C5: "26/1530", C6: "26/1702", C7: "26/1906"
  };
  // pos: position in the full store; at: when it was appended; h: hearing; d: hearing date; w: witnesses
  var EV = [
    { pos: 60, at: "Mon 7 Jan 2019", type: "CaseFiled", c: "C1" },
    { pos: 276, at: "Mon 21 Jan 2019", type: "HearingListed", c: "C1", h: "H1", d: "2019-02-25", w: ["witness A", "witness B"] },
    { pos: 808, at: "Mon 25 Feb 2019", type: "HearingHeard", c: "C1", h: "H1" },
    { pos: 9280, at: "Thu 3 Sep 2020", type: "CaseFiled", c: "C2" },
    { pos: 9388, at: "Thu 10 Sep 2020", type: "HearingListed", c: "C2", h: "H2", d: "2020-10-19", w: ["witness A", "witness B", "witness C"] },
    { pos: 9876, at: "Mon 12 Oct 2020", type: "HearingAdjourned", c: "C2", h: "H2" },
    { pos: 9880, at: "Mon 12 Oct 2020", type: "HearingListed", c: "C2", h: "H3", d: "2020-12-07", w: ["witness A", "witness B", "witness C"] },
    { pos: 10728, at: "Mon 7 Dec 2020", type: "HearingHeard", c: "C2", h: "H3" },
    { pos: 12864, at: "Mon 26 Apr 2021", type: "CaseFiled", c: "C3" },
    { pos: 12988, at: "Tue 4 May 2021", type: "HearingListed", c: "C3", h: "H4", d: "2021-06-14", w: ["H. Quarrington", "the reporting officer"] },
    { pos: 13608, at: "Mon 14 Jun 2021", type: "HearingHeard", c: "C3", h: "H4" },
    { pos: 27156, at: "Mon 20 Nov 2023", type: "CaseFiled", c: "C4" },
    { pos: 27264, at: "Mon 27 Nov 2023", type: "HearingListed", c: "C4", h: "H5", d: "2024-01-15", w: ["witness A"] },
    { pos: 27904, at: "Mon 8 Jan 2024", type: "HearingAdjourned", c: "C4", h: "H5" },
    { pos: 27908, at: "Mon 8 Jan 2024", type: "HearingListed", c: "C4", h: "H6", d: "2024-03-04", w: ["witness A"] },
    { pos: 28760, at: "Mon 4 Mar 2024", type: "HearingHeard", c: "C4", h: "H6" },
    { pos: 42412, at: "Mon 17 Aug 2026", type: "CaseFiled", c: "C5" },
    { pos: 42520, at: "Mon 24 Aug 2026", type: "HearingListed", c: "C5", h: "H7", d: "2026-10-08", w: ["witness A", "witness B"] },
    { pos: 42840, at: "Mon 14 Sep 2026", type: "CaseFiled", c: "C6" },
    { pos: 42948, at: "Mon 21 Sep 2026", type: "HearingListed", c: "C6", h: "H8", d: "2026-10-07", w: ["witness A"] },
    { pos: 43112, at: "Fri 2 Oct 2026", type: "HearingAdjourned", c: "C5", h: "H7" },
    { pos: 43116, at: "Fri 2 Oct 2026", type: "HearingListed", c: "C5", h: "H9", d: "2026-11-12", w: ["witness A", "witness B"] },
    { pos: 43180, at: "Mon 5 Oct 11:40", type: "HearingAdjourned", c: "C6", h: "H8" },
    { pos: 43184, at: "Mon 5 Oct 11:40", type: "HearingListed", c: "C6", h: "H10", d: "2026-11-25", w: ["witness A"] },
    { pos: 43192, at: "Mon 5 Oct 14:05", type: "CaseFiled", c: "C7" },
    { pos: 43196, at: "Mon 5 Oct 14:05", type: "HearingListed", c: "C7", h: "H11", d: "2026-10-21", w: ["witness A", "witness B"] },
    { pos: 43201, at: "Tue 6 Oct 02:10", type: "HearingListed", c: "C5", h: "H12", d: "2026-10-22", w: ["witness A"], live: true }
  ];
  var LIVE_AT = 2 * 3600 + 10 * 60 + 24 * 3600;   // Tue 02:10:00, counted from Monday 00:00
  var EMAIL_OFF = [23 * 3600 + 25 * 60, 30 * 3600]; // 23:25 Monday to 06:00 Tuesday

  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hms(s) {
    var d = ((s % 86400) + 86400) % 86400;
    return two(Math.floor(d / 3600)) + ":" + two(Math.floor(d / 60) % 60) + ":" + two(d % 60);
  }
  function longDate(iso) {
    var p = iso.split("-");
    var dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
    return DAYS[dt.getUTCDay()] + " " + Number(p[2]) + " " + MONTHS[Number(p[1]) - 1] + " " + p[0];
  }
  function replayTime(pos) { return START + Math.ceil(pos / RATE); }
  function length(n) {
    var s = Math.ceil(n / RATE);
    if (s < 60) return s + " s";
    return Math.floor(s / 3600) + " h " + two(Math.floor(s / 60) % 60) + " min";
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure functions) ---------- */

  function preNight() { return EV.filter(function (e) { return !e.live; }); }

  // One projection step: v1 ignores HearingAdjourned.
  function project(version, docket, e) {
    if (e.type === "HearingListed") docket[e.h] = { c: e.c, d: e.d, status: "listed", hand: false };
    else if (e.type === "HearingAdjourned" && version === "v2" && docket[e.h]) docket[e.h].status = "adjourned";
    else if (e.type === "HearingHeard" && docket[e.h]) docket[e.h].status = "heard";
  }
  function build(version, events, start) {
    var d = start ? copy(start) : {};
    events.forEach(function (e) { project(version, d, e); });
    return d;
  }
  function copy(d) {
    var o = {};
    Object.keys(d).forEach(function (k) { o[k] = { c: d[k].c, d: d[k].d, status: d[k].status, hand: d[k].hand }; });
    return o;
  }
  function truth(events) { return build("v2", events); }
  function wrongRows(docket, events) {
    var t = truth(events);
    return Object.keys(t).filter(function (h) { return !docket[h] || docket[h].status !== t[h].status; });
  }
  function handEdit(docket, events) {
    var t = truth(events);
    Object.keys(docket).forEach(function (h) {
      if (docket[h].d >= TODAY && docket[h].status === "listed" && t[h] && t[h].status === "adjourned") {
        docket[h].status = "adjourned";
        docket[h].hand = true;
      }
    });
    return docket;
  }
  function liveBefore(C) {
    var d = build("v1", preNight());
    return C.hand ? handEdit(d, preNight()) : d;
  }
  function overOrAdjourned(h, allTruth) { return allTruth[h].d < TODAY || allTruth[h].status === "adjourned"; }

  // The whole night, from Monday 23:30 to Tuesday 06:00.
  function night(C) {
    var all = EV.slice();
    var allTruth = truth(all);
    var pre = preNight();
    var live = EV[EV.length - 1];
    var R = { sends: [], lost: 0, replayed: 0, events: [], docket: null, note: "never rebuilt", len: "none", switchAt: null };
    var count = {};
    pre.forEach(function (e) { if (e.type === "HearingListed") count[e.h] = 1; });
    var oldLive = liveBefore(C);

    function send(e, t, by) {
      e.w.forEach(function (who) {
        var off = C.emailOff && t >= EMAIL_OFF[0] && t < EMAIL_OFF[1];
        var kind = overOrAdjourned(e.h, allTruth) ? "stale" : ((count[e.h] || 0) >= 1 ? "twice" : "first");
        if (off) { R.sends.push({ t: t, e: e, who: who, kind: kind, by: by, dropped: true }); return; }
        if (kind !== "stale") count[e.h] = (count[e.h] || 0) + 1;
        R.sends.push({ t: t, e: e, who: who, kind: kind, by: by, dropped: false });
      });
    }
    function listed(e, t, by) { if (e.type === "HearingListed" && C.send === "inside") send(e, t, by); }

    var newDocket = oldLive;
    var endT = null;
    if (C.replay) {
      var from = C.checkpoint ? CHECKPOINT : 0;
      var base = C.checkpoint ? build("v1", pre.filter(function (e) { return e.pos <= from; })) : {};
      var range = pre.filter(function (e) { return e.pos > from; });
      R.replayed = range.length;
      R.len = length(STORE - from);
      newDocket = copy(base);
      range.forEach(function (e) {
        project(C.proj, newDocket, e);
        listed(e, replayTime(e.pos - from), "replay");
        R.events.push(e);
      });
      endT = START + Math.ceil((STORE - from) / RATE);
      if (!C.checkpoint) {
        // The 02:10 listing arrives while the replay is still running.
        if (C.target === "new") { project("v1", oldLive, live); listed(live, LIVE_AT, "old docket"); }
        endT = replayTime(live.pos);
        project(C.proj, newDocket, live);
        listed(live, endT, "replay");
        R.events.push(live);
      } else {
        project(C.proj, newDocket, live);
        listed(live, LIVE_AT, "live");
        R.events.push(live);
      }
      if (C.target === "new") { R.note = "switched at " + hms(endT); R.switchAt = endT; }
      else R.note = "half-built " + hms(START) + " to " + hms(endT);
    } else {
      project(C.proj, newDocket, live);
      listed(live, LIVE_AT, "live");
    }
    if (C.send === "handler") send(live, LIVE_AT, "handler");
    R.docket = newDocket;
    R.wrong = wrongRows(newDocket, all);
    var sent = R.sends.filter(function (s) { return !s.dropped; });
    R.sent = sent.length;
    R.stale = sent.filter(function (s) { return s.kind === "stale"; }).length;
    R.twice = sent.filter(function (s) { return s.kind === "twice"; }).length;
    R.lost = count[live.h] ? 0 : live.w.length;
    var liveSent = sent.filter(function (s) { return s.e.live; }).length;
    var replaySent = sent.length - liveSent;
    R.total = (C.replay && !C.checkpoint && replaySent > 0 ? STORE_SUMMONS : replaySent) + liveSent;
    R.endT = endT;
    return R;
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
    var head = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(head);
    function table(title, cols) {
      var wrap = el("div", "overflow-x:auto;min-width:0;");
      wrap.appendChild(el("p", "margin:0 0 4px;font-size:12px;font-weight:600;", title));
      var t = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
      var tr = el("tr");
      cols.forEach(function (c) { tr.appendChild(el("th", "text-align:left;padding:2px 6px;", c)); });
      var th = el("thead");
      th.appendChild(tr);
      t.appendChild(th);
      var tb = el("tbody");
      t.appendChild(tb);
      wrap.appendChild(t);
      box.appendChild(wrap);
      return tb;
    }
    var docket = table("The docket the court reads at 06:00", ["hearing", "case", "date", "shows", "events say", ""]);
    var stream = table("The event stream (a sample of the 43,200)", ["pos", "appended", "event", "case", "hearing", "tonight"]);
    api.root.appendChild(box);
    return { el: el, head: head, docket: docket, stream: stream };
  }

  function row(ui, tb, cells, tone) {
    var tr = ui.el("tr", tone === "bad" ? "font-weight:600;" : (tone === "muted" ? "opacity:0.6;" : ""));
    cells.forEach(function (c) { tr.appendChild(ui.el("td", "padding:2px 6px;", c)); });
    if (tone) tr.setAttribute("class", "st-" + tone);
    tb.appendChild(tr);
  }
  function clearTb(tb) { while (tb.firstChild) tb.removeChild(tb.firstChild); }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var R = S.R;
    var all = R ? EV.slice() : preNight();
    var docket = R ? R.docket : liveBefore(C);
    var t = truth(all);
    var wrong = wrongRows(docket, all);
    ui.head.textContent = (R ? "Tuesday 06:00, after the night. " : "Monday 23:29:59, before the night. ") +
      "Projection " + C.proj + "; summons sent " + (C.send === "inside" ? "inside the projection" : "by a handler that records what it sent") +
      "; replay " + (C.replay ? "into " + (C.target === "live" ? "the live docket" : "a new docket, then switch") + (C.checkpoint ? " from last night's checkpoint" : " from the start") : "off") +
      (C.emailOff ? "; email switched off 23:25 to 06:00" : "") + (C.hand ? "; the clerk's hand edits" : "") + ".";

    clearTb(ui.docket);
    Object.keys(t).forEach(function (h) {
      var r = docket[h];
      var bad = wrong.indexOf(h) >= 0;
      row(ui, ui.docket, [h, CASES[t[h].c], longDate(t[h].d), r ? r.status + (r.hand ? " (by hand)" : "") : "missing", t[h].status, bad ? "wrong" : ""], bad ? "bad" : "");
    });

    clearTb(ui.stream);
    var touched = {};
    if (R) R.events.forEach(function (e) { touched[e.pos] = true; });
    var sentAt = {};
    if (R) R.sends.forEach(function (s) {
      var k = s.e.pos;
      sentAt[k] = (sentAt[k] ? sentAt[k] + ", " : "") + hms(s.t) + (s.dropped ? " dropped" : " sent");
    });
    all.forEach(function (e) {
      var note = "";
      if (R) note = (touched[e.pos] ? "replayed" : (e.live ? "live" : "not replayed")) + (sentAt[e.pos] ? "; summons " + sentAt[e.pos] : "");
      row(ui, ui.stream, [fmt(e.pos), e.at, e.type, CASES[e.c], e.h || "", note],
        sentAt[e.pos] && R.sends.some(function (s) { return s.e.pos === e.pos && !s.dropped && s.kind !== "first"; }) ? "bad" : (R && !touched[e.pos] && !e.live ? "muted" : ""));
    });

    S.stat.clock(R ? "Tue 06:00:00" : "Mon 23:29:59");
    S.stat.events(all.length);
    S.stat.replayed(R ? R.replayed : 0);
    S.stat.len(R ? R.len : "not run");
    S.stat.docket(R ? R.note : "built by v1");
    S.stat.wrong(wrong.length);
    S.stat.sent(R ? R.sent : 0);
    S.stat.stale(R ? R.stale : 0);
    S.stat.twice(R ? R.twice : 0);
    S.stat.lost(R ? R.lost : 0);
    S.stat.total(R ? fmt(R.total) : "0");
  }

  function changed(api, what) {
    var S = api.state;
    var had = !!S.R;
    S.R = null;
    api.log(what + (had ? " Back to Monday 23:29:59; press Run the night." : ""), "");
    draw(api);
  }

  function run(api) {
    var S = api.state;
    var C = S.C;
    var before = liveBefore(C);
    var wrongBefore = wrongRows(before, preNight()).length;
    var R = night(C);
    S.R = R;
    var s = "Night run. Before it the docket had " + wrongBefore + " rows wrong. ";
    if (C.replay) {
      s += "Replay with " + C.proj + " from " + (C.checkpoint ? "last night's checkpoint (position " + fmt(CHECKPOINT) + ")" : "position 1") +
        ": " + fmt(STORE - (C.checkpoint ? CHECKPOINT : 0)) + " events at " + RATE + " a second, " + R.len + ", 23:30:00 to " + hms(R.endT) + ".";
    } else {
      s += "No replay.";
    }
    api.log(s, "");
    var widow = R.sends.filter(function (x) { return x.who === "H. Quarrington"; })[0];
    if (widow) {
      api.log(hms(widow.t) + " summons " + (widow.dropped ? "dropped (email off)" : "emailed") + " to H. Quarrington: give evidence " +
        longDate(widow.e.d) + ", 10:00, case " + CASES[widow.e.c] + ".", widow.dropped ? "warn" : "bad");
    }
    var h12 = R.sends.filter(function (x) { return x.e.live; });
    if (h12.length) {
      api.log("H12, listed at 02:10:00: summons " + h12.map(function (x) { return hms(x.t) + (x.dropped ? " dropped" : " sent") + " (" + x.by + ")"; }).join(", ") + ".",
        h12.filter(function (x) { return !x.dropped; }).length === 1 ? "ok" : "warn");
    }
    api.log("By 06:00: " + R.sent + " summonses sent from the sample, " + R.stale + " for hearings over or adjourned, " + R.twice +
      " second summonses, " + R.lost + " never sent. Full store: " + fmt(R.total) + ". Docket rows wrong: " + R.wrong.length +
      (R.wrong.length ? " (" + R.wrong.join(", ") + ")" : "") + ".", R.sent > 1 || R.wrong.length || R.lost ? "bad" : "ok");
    if (C.replay && !C.checkpoint && C.send === "inside" && R.sent && !C.emailOff) {
      api.log("Full store: " + fmt(STORE_SUMMONS) + " replayed summonses, " + fmt(STORE_STALE) + " for hearings over or adjourned and " +
        STORE_TWICE + " second summonses for hearings still to come.", "bad");
    }
    if (R.switchAt !== null) api.log("Switch-over at " + hms(R.switchAt) + ": the new docket caught up to position " + fmt(EV[EV.length - 1].pos) + " and the court reads it from now on.", "ok");
    draw(api);
  }

  /* ---------- the module ---------- */

  var PROJ = [
    { value: "v2", label: "v2, fixed (marks adjourned hearings)" },
    { value: "v1", label: "v1, as it ran (ignores adjournments)" }
  ];
  var SEND = [
    { value: "inside", label: "Inside the projection" },
    { value: "handler", label: "A handler that records what it sent" }
  ];
  var TARGET = [
    { value: "live", label: "Into the live docket" },
    { value: "new", label: "Into a new docket, then switch" }
  ];

  DL.sims.define("s4e09", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { proj: "v2", send: "inside", target: "live", replay: true, checkpoint: false, emailOff: false, hand: false };
      S.R = null;
      S.ui = buildWidget(api);

      api.control.select("proj", "Projection code", PROJ, "v2", function (v) {
        var o = pick(PROJ, v); if (!o) return;
        S.C.proj = String(o.value);
        changed(api, "Projection code: " + S.C.proj + ".");
      });
      api.control.select("send", "Where the summons is sent from", SEND, "inside", function (v) {
        var o = pick(SEND, v); if (!o) return;
        S.C.send = String(o.value);
        changed(api, "Summons sent " + (S.C.send === "inside" ? "inside the projection." : "by a handler that records what it sent."));
      });
      api.control.select("target", "Replay writes", TARGET, "live", function (v) {
        var o = pick(TARGET, v); if (!o) return;
        S.C.target = String(o.value);
        changed(api, "Replay " + (S.C.target === "live" ? "into the live docket." : "into a new docket, then switch."));
      });
      api.control.toggle("replay", "Replay tonight", true, function (on) {
        S.C.replay = !!on;
        changed(api, "Replay tonight: " + (on ? "on." : "off."));
      });
      api.control.toggle("checkpoint", "Start from last night's checkpoint", false, function (on) {
        S.C.checkpoint = !!on;
        changed(api, "Start from last night's checkpoint: " + (on ? "on." : "off."));
      });
      api.control.toggle("email", "Email switched off, 23:25 to 06:00", false, function (on) {
        S.C.emailOff = !!on;
        changed(api, "Email switched off: " + (on ? "yes." : "no."));
      });
      api.control.toggle("hand", "Clerk edits the docket by hand first", false, function (on) {
        S.C.hand = !!on;
        changed(api, "Hand edits: " + (on ? "the clerk sets H7 and H8 to adjourned." : "none."));
      });
      api.control.button("run", "Run the night", function () { run(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        clock: api.stat("clock", "time", ""),
        events: api.stat("events", "events in the sample", ""),
        replayed: api.stat("replayed", "sample events replayed", ""),
        len: api.stat("len", "replay length (full store)", ""),
        docket: api.stat("docket", "live docket overnight", "warn"),
        wrong: api.stat("wrong", "docket rows wrong", "bad"),
        sent: api.stat("sent", "summonses sent tonight (sample)", "bad"),
        stale: api.stat("stale", "for hearings over or adjourned", "bad"),
        twice: api.stat("twice", "second summonses", "warn"),
        lost: api.stat("lost", "summonses never sent", "warn"),
        total: api.stat("total", "night's total (full store)", "bad")
      };

      api.info("<strong>How to read it.</strong> The event stream is the record: every change to a case, in order, with its position in the store. The docket is a projection: a table built by running code over those events. Rows marked wrong show a status the events don't support. Replaying runs the projection over the events again; whatever else the projection does, such as emailing a summons, it does again too.");
      api.log("Monday 23:29:59. The docket was built by v1: " + wrongRows(liveBefore(S.C), preNight()).length + " rows wrong, including H7 on Thu 8 Oct 2026.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening: before the night, the docket v1 built.
      t.expect(t.stat("clock") === "Mon 23:29:59" && t.stat("events") === 26 && t.stat("wrong") === 4 && t.stat("sent") === 0 &&
        t.stat("total") === 0 && t.stat("len") === "not run" && t.logText().indexOf("4 rows wrong, including H7 on Thu 8 Oct 2026") >= 0,
        "Opens Monday 23:29:59: 26 events, the docket v1 built has 4 rows wrong, nothing sent");

      // 2. The night as it ran: v2, inside, live docket, from the start.
      t.click("run");
      t.expect(t.stat("sent") === 21 && t.stat("stale") === 15 && t.stat("twice") === 5 && t.stat("lost") === 0 &&
        t.stat("total") === "1,264" && t.stat("wrong") === 0 && t.stat("len") === "3 h 00 min" && t.stat("replayed") === 26 &&
        t.stat("docket") === "half-built 23:30:00 to 02:30:01",
        "As it ran: 21 summonses from the sample (15 for hearings over or adjourned, 5 second), 1,264 in the full store, docket right by 06:00");
      t.expect(has("00:24:07 summons emailed to H. Quarrington: give evidence Mon 14 Jun 2021, 10:00, case 21/0412.") &&
        has("1,263 replayed summonses, 1,222 for hearings over or adjourned and 41 second summonses") &&
        has("H12, listed at 02:10:00: summons 02:30:01 sent (replay)."),
        "The widow's summons at 00:24:07 for 14 June 2021; the full store's 1,263; H12's summons waits until 02:30:01");

      // 3. A new docket, summons still inside: the old docket and the new one both send H12's.
      t.set("target", "new");
      t.click("run");
      t.expect(t.stat("sent") === 22 && t.stat("twice") === 6 && t.stat("total") === "1,265" && t.stat("docket") === "switched at 02:30:01" &&
        has("Switch-over at 02:30:01: the new docket caught up to position 43,201"),
        "New docket with the summons inside: 22 sent, H12's witness summoned twice, 1,265 in the full store");

      // 4. The handler that records what it sent, with a new docket: one summons, sent once, docket right.
      t.set("send", "handler");
      t.click("run");
      t.expect(t.stat("sent") === 1 && t.stat("stale") === 0 && t.stat("twice") === 0 && t.stat("total") === 1 &&
        t.stat("wrong") === 0 && has("H12, listed at 02:10:00: summons 02:10:00 sent (handler)."),
        "Handler and new docket: only H12's summons, at 02:10:00, once; 0 rows wrong");

      // 5. Handler into the live docket: still one summons, but the docket is half-built for 3 hours.
      t.set("target", "live");
      t.click("run");
      t.expect(t.stat("sent") === 1 && t.stat("total") === 1 && t.stat("docket") === "half-built 23:30:00 to 02:30:01",
        "Handler into the live docket: one summons, but the court's docket is half-built from 23:30:00 to 02:30:01");

      // 6. Last night's checkpoint, summons inside: short, but the bug and the repeats stay.
      t.set("send", "inside");
      t.set("checkpoint", true);
      t.click("run");
      t.expect(t.stat("len") === "9 s" && t.stat("replayed") === 4 && t.stat("sent") === 4 && t.stat("twice") === 3 &&
        t.stat("wrong") === 3 && t.stat("total") === 4,
        "From the checkpoint: 9 s, 4 sample events, 3 second summonses plus H12, and 3 rows still wrong (H2, H5, H7)");
      t.set("checkpoint", false);

      // 7. Email off: nothing sent, H12's real summons lost.
      t.set("email", true);
      t.click("run");
      t.expect(t.stat("sent") === 0 && t.stat("lost") === 1 && t.stat("total") === 0 && t.stat("wrong") === 0,
        "Email off 23:25 to 06:00: 0 sent, H12's summons lost, docket right");
      t.set("email", false);

      // 8. Never replay; the clerk edits by hand: two old rows stay wrong.
      t.set("replay", false);
      t.set("hand", true);
      var handBefore = t.stat("wrong");
      t.click("run");
      t.expect(handBefore === 2 && t.stat("wrong") === 2 && t.stat("sent") === 1 && t.stat("len") === "none" && t.stat("docket") === "never rebuilt",
        "Hand edits, no replay: H7 and H8 fixed, H2 and H5 still wrong; H12 summoned once");

      // 9. Hand edits, then a v1 replay into the live docket: the edits are gone.
      t.set("replay", true);
      t.set("proj", "v1");
      t.click("run");
      t.expect(t.stat("wrong") === 4 && t.stat("sent") === 21,
        "v1 replay over the hand edits: back to 4 rows wrong, and 21 summonses again");

      // 10. The model: the widow's event and the store's figures add up.
      var w = EV.filter(function (e) { return e.h === "H4" && e.type === "HearingListed"; })[0];
      t.expect(hms(replayTime(w.pos)) === "00:24:07" && 287 + 344 * 2 + 96 * 3 === STORE_SUMMONS && STORE_STALE + STORE_TWICE === STORE_SUMMONS &&
        Math.ceil(STORE / RATE) === 10800 && STORE - CHECKPOINT === 36,
        "The numbers: 00:24:07 for position 12,988; 287 + 688 + 288 = 1,263 = 1,222 + 41; 43,200 events = 10,800 s; 36 since the checkpoint");
    }
  });
})();
