/* sims/w11-v1.0.0.js  (published as sims/w11.js)
   Workshop case w11 "The Doors That Didn't Lock": a workbench for the publish-and-subscribe
   library in the Kelpmouth aquarium's building controller, finished by Odgerel from Winifrith
   Torvaine's work order. One closing at a time: the event "aquarium closed", published at
   23:30:00, delivered to the subscribers on its list.
   Widget-style sim: it draws its own table inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: the design (as built, walking the live list; no
     unsubscribing, a run-once subscriber keeps a done flag; walking the list backwards; a queue
     with one worker taking one job a second; walking a copy taken at publish time, with each
     subscriber's error caught), the night (Tuesday 13 October, or Tuesday 20 October), step
     (one delivery step), play (the whole closing), reset. Shows the live list, the list being
     walked and what each subscriber did. Stats: subscribers run, subscribers never run, the front
     doors, the gallery lights, the feeding timer, errors caught, the live list's length after,
     how long the doors stood unlocked after the event. selfTest: 12 assertions.

   The model (stated in sim.lede):
   - The event is published at 23:30:00. Each subscriber's job is instant, so in a walk every
     line carries 23:30:00. A run-once subscriber unsubscribes itself as the last thing it does.
   - As built: i = 0; while i < length(list): run list[i]; i = i + 1. unsubscribe removes the
     subscriber from that same live list. A subscriber's error is not caught: the walk stops.
   - No unsubscribing: unsubscribe is refused; a run-once subscriber sets its own done flag and
     does nothing on later nights. It stays on the list. Errors are not caught.
   - Backwards: i = length - 1; while i >= 0: run list[i]; i = i - 1. Errors are not caught.
   - Queue: publish puts one job per subscriber in a queue, in list order. One worker takes one
     job a second, from 23:30:01. A job's error is caught by the worker and logged.
   - Copy: publish copies the list first and walks the copy in list order; unsubscribe changes
     only the live list. Each subscriber's run is wrapped so its error is caught and logged.

   Where every number comes from (conventions rule 14; the case is content/s5/w11-v1.0.0.json).
   Given data:
   - The startup list for both nights, in order: place 0 dim gallery lights, place 1 start feeding
     timer, place 2 a run-once test (13 October: test exit lights; 20 October: test fire doors),
     place 3 lock doors and arm the door alarm. 4 subscribers.
   - 13 October: no subscriber fails. 20 October: start feeding timer fails with the error
     "feeders not answering" (the feeders' control box was unplugged that day).
   - The queue's worker takes one job a second, so job k (counted from 1) runs at 23:30:00 + k s.
   Reproduced by the model and checked by the selfTest:
   - 13 October as built: places 0, 1, 2 run; the test unsubscribes, the list is 3 long and lock
     doors moves to place 2; i becomes 3, 3 < 3 is false, the walk ends. 3 run, 1 never run, the
     doors unlocked all night. The live list after: 3.
   - 13 October, no unsubscribing: 4 run, doors locked 23:30:00, the list after: 4.
   - 13 October, backwards: doors first, then the test, the timer, the lights: 4 run, doors locked
     23:30:00, the list after: 3.
   - 13 October, queue: jobs at 23:30:01, :02, :03, :04; doors locked 23:30:04, 4 s after the event.
   - 13 October, copy: 4 run, doors locked 23:30:00, the list after: 3.
   - 20 October as built and with no unsubscribing: the lights run, the timer fails, the walk
     stops: 2 run, 2 never run, doors unlocked all night (list after 4 in both: nothing reached the
     test).
   - 20 October, backwards: doors, test, timer fails: 3 run, the lights never run (full all night),
     doors locked 23:30:00.
   - 20 October, queue: 4 run, 1 error caught, doors locked 23:30:04.
   - 20 October, copy: 4 run, 1 error caught, doors locked 23:30:00, the list after: 3.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  function at(h, m, s) { return h * 3600 + m * 60 + s; }
  var OPEN = at(23, 29, 50);
  var CLOSE = at(23, 30, 0);
  var JOB_GAP = 1;

  var NIGHTS = {
    tue13: {
      label: "tuesday 13 october: exit-light test added",
      subs: [
        { id: "lights", name: "dim gallery lights", did: "gallery lights dimmed" },
        { id: "feed", name: "start feeding timer", did: "feeding timer started" },
        { id: "test", name: "test exit lights", did: "exit lights tested", once: true },
        { id: "doors", name: "lock doors, arm alarm", did: "doors locked, alarm armed" }
      ],
      fails: null
    },
    tue20: {
      label: "tuesday 20 october: fire-door test added, feeders unplugged",
      subs: [
        { id: "lights", name: "dim gallery lights", did: "gallery lights dimmed" },
        { id: "feed", name: "start feeding timer", did: "feeding timer started" },
        { id: "test", name: "test fire doors", did: "fire doors tested", once: true },
        { id: "doors", name: "lock doors, arm alarm", did: "doors locked, alarm armed" }
      ],
      fails: { id: "feed", error: "feeders not answering" }
    }
  };
  var NIGHT_OPTS = [
    { value: "tue13", label: NIGHTS.tue13.label },
    { value: "tue20", label: NIGHTS.tue20.label }
  ];
  var DESIGNS = [
    { value: "built", label: "as built: walk the live list" },
    { value: "forbid", label: "no unsubscribing: a run-once keeps a done flag" },
    { value: "back", label: "walk the live list backwards" },
    { value: "queue", label: "a queue: one worker, one job a second" },
    { value: "copy", label: "walk a copy taken at publish time; catch each error" }
  ];
  var SHORT = {
    built: "as built", forbid: "no unsubscribing", back: "walking backwards",
    queue: "a queue and one worker", copy: "a copy, each error caught"
  };

  /* ---------- helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(s) { return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function names(list) { return list.map(function (s) { return s.name; }).join(" | "); }

  /* ---------- the model: one closing, as a list of steps ---------- */

  function closing(C) {
    var N = NIGHTS[C.night];
    var live = N.subs.slice();
    var walked = live.slice();
    var steps = [];
    var R = { ran: 0, never: 0, caught: 0, doors: "not yet", lights: "not yet", feed: "not yet", gap: "not yet" };
    var ranIds = {};

    function snap() {
      return { ran: R.ran, never: R.never, caught: R.caught, doors: R.doors, lights: R.lights, feed: R.feed,
        gap: R.gap, len: live.length, live: names(live), walked: names(walked) };
    }
    function record(t, msg, tone) { steps.push({ t: t, msg: hms(t) + " " + msg, tone: tone, snap: snap() }); }
    function unsub(s) {
      var k = live.indexOf(s);
      if (k >= 0) live.splice(k, 1);
    }
    // Runs one subscriber. Returns "" or the error text if it failed.
    function run(s, t) {
      R.ran += 1;
      ranIds[s.id] = true;
      if (N.fails && N.fails.id === s.id) {
        if (s.id === "feed") R.feed = C.design === "queue" || C.design === "copy" ? "failed: error caught" : "failed: walk stopped";
        return N.fails.error;
      }
      if (s.id === "doors") { R.doors = "locked " + hms(t); R.gap = (t - CLOSE) + " s"; }
      if (s.id === "lights") R.lights = "dimmed " + hms(t);
      if (s.id === "feed") R.feed = "started " + hms(t);
      return "";
    }
    function finish(t) {
      N.subs.forEach(function (s) { if (!ranIds[s.id]) R.never += 1; });
      if (R.doors === "not yet") { R.doors = "unlocked all night"; R.gap = "all night"; }
      if (R.lights === "not yet") R.lights = "full all night";
      if (R.feed === "not yet") R.feed = "never ran";
      var missed = N.subs.filter(function (s) { return !ranIds[s.id]; }).map(function (s) { return s.name; });
      record(t, "closing over: " + R.ran + " run, " + R.never + " never run" +
        (missed.length ? " (" + missed.join(", ") + ")" : "") + "; the front doors " +
        (R.doors.indexOf("locked") === 0 ? "were " + R.doors : "stayed unlocked all night") + ".",
        R.doors.indexOf("locked") === 0 && R.lights.indexOf("dimmed") === 0 ? "ok" : "bad");
    }

    var D = C.design;
    if (D === "copy") {
      walked = live.slice();
      record(CLOSE, "aquarium closed is published; publish copies the list (" + walked.length + " long) and walks the copy.", "");
    } else if (D === "queue") {
      walked = live.slice();
      record(CLOSE, "aquarium closed is published; publish puts " + walked.length + " jobs in the queue, one per subscriber, in list order.", "");
    } else {
      walked = live;
      record(CLOSE, "aquarium closed is published; publish walks the live list (" + live.length + " long).", "");
    }

    if (D === "built" || D === "forbid") {
      var i = 0;
      var stopped = false;
      while (i < live.length) {
        var s = live[i];
        var before = "i = " + i + ", list " + live.length + " long: " + s.name;
        var err = run(s, CLOSE);
        if (err) {
          record(CLOSE, before + " fails with the error " + err + "; nothing catches it, so the walk stops here.", "bad");
          stopped = true;
          break;
        }
        if (s.once && D === "built") {
          unsub(s);
          record(CLOSE, before + ": " + s.did + "; it unsubscribes, so the list is now " + live.length +
            " long and " + (live[i] ? live[i].name + " moves to place " + i : "nothing is left behind it") + ".", "warn");
        } else if (s.once) {
          record(CLOSE, before + ": " + s.did + "; unsubscribing is refused, so it sets done = yes and stays on the list.", "");
        } else {
          record(CLOSE, before + ": " + s.did + ".", s.id === "doors" ? "ok" : "");
        }
        i += 1;
      }
      if (!stopped) {
        record(CLOSE, "i = " + i + ", list " + live.length + " long: " + i + " is not less than " + live.length + ", so the walk ends.",
          ranIds.doors ? "" : "bad");
      }
      finish(CLOSE);
    } else if (D === "back") {
      var j = live.length - 1;
      var halted = false;
      while (j >= 0) {
        var b = live[j];
        var pre = "i = " + j + ", list " + live.length + " long: " + b.name;
        var e2 = run(b, CLOSE);
        if (e2) {
          record(CLOSE, pre + " fails with the error " + e2 + "; nothing catches it, so the walk stops here.", "bad");
          halted = true;
          break;
        }
        if (b.once) {
          unsub(b);
          record(CLOSE, pre + ": " + b.did + "; it unsubscribes; only places already walked move.", "");
        } else {
          record(CLOSE, pre + ": " + b.did + ".", b.id === "doors" ? "ok" : "");
        }
        j -= 1;
      }
      if (!halted) record(CLOSE, "i = -1: the walk ends.", "");
      finish(CLOSE);
    } else {
      var t = CLOSE;
      for (var k = 0; k < walked.length; k++) {
        var c = walked[k];
        if (D === "queue") t = CLOSE + JOB_GAP * (k + 1);
        var head = (D === "queue" ? "the worker takes job " + (k + 1) + ": " : "copy place " + k + ": ") + c.name;
        var e3 = run(c, t);
        if (e3) {
          R.caught += 1;
          record(t, head + " fails with the error " + e3 + "; it is caught and logged, and delivery goes on.", "warn");
          continue;
        }
        if (c.once) {
          unsub(c);
          record(t, head + ": " + c.did + "; it unsubscribes from the live list, now " + live.length + " long; the " +
            (D === "queue" ? "queue" : "copy") + " is unchanged.", "");
        } else {
          record(t, head + ": " + c.did + ".", c.id === "doors" ? "ok" : "");
        }
      }
      finish(t);
    }
    return { steps: steps };
  }

  /* ---------- the widget ---------- */

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;", "");
    var live = el("p", "margin:0;font-size:12px;", "");
    var walked = el("p", "margin:0;font-size:12px;", "");
    var last = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(head);
    box.appendChild(live);
    box.appendChild(walked);
    box.appendChild(last);
    api.root.appendChild(box);
    return { head: head, live: live, walked: walked, last: last };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var lastStep = S.shown ? S.N.steps[S.shown - 1] : null;
    var startList = names(NIGHTS[C.night].subs);
    var snap = lastStep ? lastStep.snap : { ran: 0, never: 0, caught: 0, doors: "not yet", lights: "not yet",
      feed: "not yet", gap: "not yet", len: NIGHTS[C.night].subs.length, live: startList, walked: "nothing yet" };
    S.ui.head.textContent = "design: " + SHORT[C.design] + "; night: " + pick(NIGHT_OPTS, C.night).label +
      "; steps shown: " + S.shown + " of " + S.N.steps.length + ".";
    S.ui.live.textContent = "live list now: " + snap.live + ".";
    S.ui.walked.textContent = (C.design === "queue" ? "the queue's jobs: " : "being walked: ") + snap.walked + ".";
    S.ui.last.textContent = lastStep ? lastStep.msg : "23:29:50: the last cleaner is at the panel; nothing is published yet.";
    S.stat.ran(snap.ran);
    S.stat.never(snap.never);
    S.stat.doors(snap.doors);
    S.stat.lights(snap.lights);
    S.stat.feed(snap.feed);
    S.stat.caught(snap.caught);
    S.stat.len(snap.len);
    S.stat.gap(snap.gap);
    api.clock = lastStep ? lastStep.t : OPEN;
    S.ctl.step.disable(S.shown >= S.N.steps.length);
    S.ctl.play.disable(S.shown >= S.N.steps.length);
  }

  function showTo(api, n) {
    var S = api.state;
    var to = Math.min(S.N.steps.length, n);
    for (var i = S.shown; i < to; i++) {
      api.clock = S.N.steps[i].t;
      api.log(S.N.steps[i].msg, S.N.steps[i].tone);
    }
    S.shown = to;
  }

  function rebuild(api) {
    var S = api.state;
    S.N = closing(S.C);
    S.shown = 0;
    api.log("design: " + SHORT[S.C.design] + "; night: " + pick(NIGHT_OPTS, S.C.night).label + "; press step or play.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("w11", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { design: "built", night: "tue13" };
      S.N = closing(S.C);
      S.shown = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.design = api.control.select("design", "design", DESIGNS, "built", function (v) {
        var o = pick(DESIGNS, v);
        if (!o) return;
        S.C.design = String(o.value);
        rebuild(api);
      });
      S.ctl.night = api.control.select("night", "night", NIGHT_OPTS, "tue13", function (v) {
        var o = pick(NIGHT_OPTS, v);
        if (!o) return;
        S.C.night = String(o.value);
        rebuild(api);
      });
      S.ctl.step = api.control.button("step", "step", function () { showTo(api, S.shown + 1); draw(api); });
      S.ctl.play = api.control.button("play", "play the closing", function () { showTo(api, S.N.steps.length); draw(api); });
      api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        ran: api.stat("ran", "subscribers run", "ok"),
        never: api.stat("never", "subscribers never run", "bad"),
        doors: api.stat("doors", "front doors", ""),
        lights: api.stat("lights", "gallery lights", ""),
        feed: api.stat("feed", "feeding timer", ""),
        caught: api.stat("caught", "errors caught", "warn"),
        len: api.stat("len", "live list length", ""),
        gap: api.stat("gap", "doors unlocked after the event", "warn")
      };

      api.info("<strong>how to read it:</strong> at 23:30:00 the event aquarium closed is published to its subscribers. " +
        "i is the place in the list being walked, counted from 0. the live list is the one unsubscribe changes; " +
        "the line below it shows what publish is walking, which is the live list itself unless the design copies it. " +
        "step shows one delivery step; play runs the rest of the closing.");

      api.log("23:29:50: 4 subscribers wait for aquarium closed; press step or play.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens at 23:29:50, before the event.
      t.expect(t.stat("ran") === 0 && t.stat("never") === 0 && t.stat("len") === 4 && t.stat("doors") === "not yet" &&
        has("23:29:50: 4 subscribers wait for aquarium closed"),
        "opens at 23:29:50: nothing published, 4 subscribers on the list");

      // 2. As built, 13 October: the doors are skipped.
      for (var i = 0; i < 4; i++) t.click("step");
      t.expect(has("23:30:00 i = 2, list 4 long: test exit lights: exit lights tested; it unsubscribes, so the list is now 3 long and lock doors, arm alarm moves to place 2.") &&
        t.stat("ran") === 3 && t.stat("len") === 3,
        "as built: the test unsubscribes at place 2 and lock doors moves to place 2");
      t.click("play");
      t.expect(has("23:30:00 i = 3, list 3 long: 3 is not less than 3, so the walk ends.") &&
        t.stat("never") === 1 && t.stat("doors") === "unlocked all night" && t.stat("gap") === "all night",
        "as built, 13 October: the walk ends at i = 3 and the doors stay unlocked all night");

      // 3. No unsubscribing, 13 October.
      t.set("design", "forbid");
      t.click("play");
      t.expect(t.stat("ran") === 4 && t.stat("doors") === "locked 23:30:00" && t.stat("len") === 4,
        "no unsubscribing, 13 October: doors locked, the test stays on the list");

      // 4. Backwards, 13 October.
      t.set("design", "back");
      t.click("play");
      t.expect(t.stat("ran") === 4 && t.stat("doors") === "locked 23:30:00" && t.stat("len") === 3 &&
        has("23:30:00 i = 3, list 4 long: lock doors, arm alarm: doors locked, alarm armed."),
        "backwards, 13 October: the doors go first and lock");

      // 5. Queue, 13 October.
      t.set("design", "queue");
      t.click("play");
      t.expect(t.stat("doors") === "locked 23:30:04" && t.stat("gap") === "4 s" && t.stat("ran") === 4,
        "queue, 13 October: the doors lock at 23:30:04, 4 s after the event");

      // 6. Copy, 13 October.
      t.set("design", "copy");
      t.click("play");
      t.expect(t.stat("ran") === 4 && t.stat("never") === 0 && t.stat("doors") === "locked 23:30:00" && t.stat("len") === 3 &&
        has("copy place 2: test exit lights: exit lights tested; it unsubscribes from the live list, now 3 long; the copy is unchanged."),
        "copy, 13 October: all 4 run, the doors lock at 23:30:00");

      // 7. As built, 20 October: the feeders' error stops the walk.
      t.set("night", "tue20");
      t.set("design", "built");
      t.click("play");
      t.expect(t.stat("ran") === 2 && t.stat("never") === 2 && t.stat("doors") === "unlocked all night" &&
        t.stat("feed") === "failed: walk stopped" &&
        has("23:30:00 i = 1, list 4 long: start feeding timer fails with the error feeders not answering; nothing catches it, so the walk stops here."),
        "as built, 20 October: the error stops the walk at place 1");

      // 8. No unsubscribing, 20 October: the same.
      t.set("design", "forbid");
      t.click("play");
      t.expect(t.stat("ran") === 2 && t.stat("never") === 2 && t.stat("doors") === "unlocked all night" && t.stat("len") === 4,
        "no unsubscribing, 20 October: the doors stay unlocked again");

      // 9. Backwards, 20 October: the lights never dim.
      t.set("design", "back");
      t.click("play");
      t.expect(t.stat("ran") === 3 && t.stat("never") === 1 && t.stat("doors") === "locked 23:30:00" &&
        t.stat("lights") === "full all night",
        "backwards, 20 October: doors locked, the gallery lights full all night");

      // 10. Queue, 20 October.
      t.set("design", "queue");
      t.click("play");
      t.expect(t.stat("ran") === 4 && t.stat("caught") === 1 && t.stat("doors") === "locked 23:30:04" &&
        t.stat("feed") === "failed: error caught",
        "queue, 20 October: the error is caught; the doors lock at 23:30:04");

      // 11. Copy, 20 October.
      t.set("design", "copy");
      t.click("play");
      t.expect(t.stat("ran") === 4 && t.stat("never") === 0 && t.stat("caught") === 1 && t.stat("doors") === "locked 23:30:00" &&
        t.stat("lights") === "dimmed 23:30:00" && t.stat("len") === 3,
        "copy, 20 October: the error is caught; every other subscriber runs and the doors lock at 23:30:00");
    }
  });
})();
