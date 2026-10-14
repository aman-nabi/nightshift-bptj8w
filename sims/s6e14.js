/* sims/s6e14-v1.0.0.js  (published as sims/s6e14.js)
   Case s6e14 "The Conductor": a cluster lab for the Quillford Sinfonia's online ticket shop, which
   runs on Kubernetes. A Deployment keeps 3 pods (running copies) of the shop; a Service sends buyers
   to every ready pod in the namespace "tickets" labelled app: box-office. At 22:00 the auditor starts
   last season's shop as a second Deployment, box-office-audit, with 1 pod and the same label. The
   learner sets the auditor's label and namespace, the live replicas and a unique live label, deletes
   the auditor's pod (once or every 5 minutes), deletes its Deployment, or deletes and recreates the
   Service, then runs the night from 21:59:00 to midnight and reads where every buyer went.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: auditor's namespace (tickets or audit) and label
     (app: box-office or app: box-office-audit); live replicas 3 or 9; unique live label (release:
     live on the live pods and in the Service's selector); keep deleting the auditor's pod every 5
     minutes from 22:40. Buttons: forward 10 s, run to 22:40, run to midnight, delete the auditor's
     pod, delete its Deployment, delete and recreate the Service, start the night again, reset.
     A table of pods with labels, picked or not, buyers and March seats. selfTest: 11 assertions.

   The model (stated in sim.lede and the post):
   - One step is one second. The night opens at 21:59:00 with nothing run; each step moves the clock
     on one second and runs that moment. Order inside a moment: starting pods become ready, the
     auditor starts his copy (22:00:00), the every-5-minutes deletion (if on), a buyer arrives, the
     hourly tally.
   - The live Deployment box-office keeps 3 pods (or 9), all ready from the start, labels
     app: box-office (plus release: live when the unique label is on), namespace tickets.
   - The auditor's Deployment box-office-audit asks for 1 pod; it is created at 22:00:00 and is ready
     8 s later (22:00:08). A pod takes 8 s to start.
   - The Service lives in the namespace tickets. It picks every ready pod in that namespace whose
     labels include its selector: app: box-office (plus release: live when the unique label is on).
     Pods in another namespace are never picked.
   - Buyers: 60 an hour, one a minute, at 22:00:30, 22:01:30 ... 23:59:30: 120 in all. The Service
     hands each new buyer to the next picked pod in turn (live pods first, then the auditor's). Real
     clusters often pick at random instead; the lab goes in turn so every run is the same.
   - A buyer sent to the auditor's pod gets seats for 14 March, last season's spring gala, because
     that copy carries last season's data and concert list.
   - Deleting the auditor's pod: it is gone at once. Its Deployment still wants 1 pod and has 0, so
     its controller starts a new one at once, with a new name, ready 8 s later.
   - Deleting the auditor's Deployment removes its wish and its pod; nothing starts a new one.
   - Deleting and recreating the Service: the new Service picks pods by the same selector, so it
     picks the same pods.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e14-v1.0.0.json).
   Worked out from the model and checked by the selfTest:
   - As tonight: from 22:00:30 the Service picks 4 pods, so buyer turns 3, 7, 11 ... go to the
     auditor's pod: 30 of 120 (one in four). By 22:40:00: 40 buyers, 10 March. At 23:00:00: 60
     buyers, 15 March.
   - Delete the pod at 22:40:00: box-office-audit-58c2d-tn6vb gone, box-office-audit-58c2d-jk9fs
     ready at 22:40:08. The next buyer is at 22:40:30, so none falls in the 8 s gap: still 30 of 120.
   - Keep deleting every 5 minutes from 22:40: 22:40, 22:45 ... 23:55, 16 deletions, each back in
     8 s, every gap between buyers: still 30 of 120.
   - Delete and recreate the Service at 22:40: it picks the same 4 pods: still 30 of 120.
   - 9 live pods: the Service picks 10, turns 9, 19 ... 119 go to the auditor's: 12 of 120 (one in
     ten).
   - Delete the auditor's Deployment at 22:40:00: 10 March seats before, none after: 10 of 120.
   - Unique live label from the start, or the auditor in the namespace audit, or with the label
     app: box-office-audit: the Service picks 3 pods, 0 of 120.
*/
(function () {
  "use strict";

  var T0 = 21 * 3600 + 59 * 60;   // 21:59:00, step 0
  var AUD_AT = 60;                // 22:00:00
  var START = 8;                  // seconds a pod takes to start
  var FIRST_BUYER = 90;           // 22:00:30
  var EVERY = 60;                 // one buyer a minute, 60 an hour
  var BUYERS = 120;               // 22:00:30 to 23:59:30
  var AT_2240 = 2460;             // 22:40:00
  var HOUR = 3660;                // 23:00:00
  var END = 7260;                 // 24:00:00
  var KEEP_EVERY = 300;           // keep deleting: every 5 minutes from 22:40

  var LIVE_SUFFIX = ["hq2wn", "x7pzm", "c4rtk", "m9vbd", "f2lsj", "w6ghq", "t3nkx", "b8dzr", "r5yqp"];
  var AUD_SUFFIX = ["tn6vb", "jk9fs", "p7mzc", "h4rlk", "d2wxq", "s9gtn", "v3kbm", "z6fhc", "g8qrd",
    "n5ctw", "k2mvx", "q7bzl", "l4hsn", "y9dkf", "c3tpw", "w8rgm", "f6nxb", "m2qjh"];

  var NAMESPACES = [
    { value: "tickets", label: "tickets, the shop's own (as tonight)" },
    { value: "audit", label: "audit, a namespace of its own" }
  ];
  var LABELS = [
    { value: "box-office", label: "app: box-office (as tonight)" },
    { value: "box-office-audit", label: "app: box-office-audit" }
  ];
  var REPLICAS = [{ value: 3, label: "3 (as tonight)" }, { value: 9, label: "9" }];

  /* ---------- small helpers ---------- */

  function two(n) { return n < 10 ? "0" + n : String(n); }
  function clock(s) {
    var x = T0 + s;
    return two(Math.floor(x / 3600) % 24) + ":" + two(Math.floor(x / 60) % 60) + ":" + two(x % 60);
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return list[0];
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  /* ---------- the model ---------- */

  function liveLabels(C) {
    var l = { app: "box-office" };
    if (C.unique) l.release = "live";
    return l;
  }
  function selector(C) { return liveLabels(C); }
  function labelText(l) {
    return Object.keys(l).map(function (k) { return k + ": " + l[k]; }).join(", ");
  }

  function newNight(C) {
    var R = {
      C: C, s: 0, pods: [], audDep: false, audMade: 0, turn: 0,
      buyers: 0, march: 0, live: 0, deletes: 0, events: []
    };
    for (var i = 0; i < C.replicas; i++) {
      R.pods.push({ name: "box-office-6f9b8-" + LIVE_SUFFIX[i], ns: "tickets", labels: liveLabels(C),
        owner: "live", readyAt: 0, sent: 0, march: 0 });
    }
    return R;
  }

  function matches(C, p) {
    if (p.ns !== "tickets" || p.readyAt > 0) return false;
    var sel = selector(C);
    for (var k in sel) if (Object.prototype.hasOwnProperty.call(sel, k) && p.labels[k] !== sel[k]) return false;
    return true;
  }
  function picked(R) {
    var live = R.pods.filter(function (p) { return p.owner === "live" && matches(R.C, p); });
    var aud = R.pods.filter(function (p) { return p.owner === "audit" && matches(R.C, p); });
    return live.concat(aud);
  }
  function inTickets(R) { return R.pods.filter(function (p) { return p.ns === "tickets" && p.readyAt === 0; }).length; }
  function audPod(R) {
    for (var i = 0; i < R.pods.length; i++) if (R.pods[i].owner === "audit") return R.pods[i];
    return null;
  }

  function say(R, msg, tone) { R.events.push({ msg: clock(R.s) + " " + msg, tone: tone || "" }); }

  function makeAudPod(R) {
    var name = "box-office-audit-58c2d-" + AUD_SUFFIX[R.audMade % AUD_SUFFIX.length];
    R.audMade += 1;
    var p = { name: name, ns: R.C.audNs, labels: { app: R.C.audLabel }, owner: "audit", readyAt: R.s + START, sent: 0, march: 0 };
    R.pods.push(p);
    return p;
  }

  function deletePod(R) {
    var p = audPod(R);
    if (!p) { say(R, "There is no auditor's pod to delete.", ""); return; }
    R.pods.splice(R.pods.indexOf(p), 1);
    R.deletes += 1;
    var q = makeAudPod(R);
    say(R, "Pod " + p.name + " deleted. Deployment box-office-audit wants 1 pod and has 0, so it starts " + q.name + ".", "warn");
  }

  function deleteDeployment(R) {
    if (!R.audDep) { say(R, "There is no Deployment box-office-audit to delete.", ""); return; }
    R.audDep = false;
    var p = audPod(R);
    if (p) R.pods.splice(R.pods.indexOf(p), 1);
    say(R, "Deployment box-office-audit deleted, and its pod with it. Nothing wants it back. The Service picks " +
      plural(picked(R).length, "pod", "pods") + ".", "ok");
  }

  function recreateService(R) {
    var n = picked(R).length;
    var aud = picked(R).some(function (p) { return p.owner === "audit"; });
    say(R, "Service deleted and created again. It picks pods by " + labelText(selector(R.C)) + " again: " +
      plural(n, "pod", "pods") + (aud ? ", the auditor's among them." : "."), aud ? "bad" : "");
  }

  // Runs the next moment (one second).
  function stepSecond(R) {
    var C = R.C;
    R.s += 1;
    var s = R.s;
    R.pods.forEach(function (p) {
      if (p.readyAt === s) {
        p.readyAt = 0;
        if (p.owner === "audit") {
          say(R, p.name + " ready in namespace " + p.ns + ", label app: " + p.labels.app + ". The Service picks " +
            plural(picked(R).length, "pod", "pods") + ".", matches(C, p) ? "bad" : "");
        }
      }
    });
    if (s === AUD_AT) {
      R.audDep = true;
      makeAudPod(R);
      say(R, "Osvaldo starts last season's shop: Deployment box-office-audit, 1 pod, label app: " + C.audLabel +
        ", namespace " + C.audNs + ".", "warn");
    }
    if (C.keep && s >= AT_2240 && s < END && (s - AT_2240) % KEEP_EVERY === 0 && R.audDep) deletePod(R);
    if (s >= FIRST_BUYER && (s - FIRST_BUYER) % EVERY === 0 && R.buyers < BUYERS) {
      var list = picked(R);
      var p = list[R.turn % list.length];
      R.turn += 1;
      R.buyers += 1;
      p.sent += 1;
      if (p.owner === "audit") { R.march += 1; p.march += 1; } else { R.live += 1; }
    }
    if (s === HOUR) say(R, "Hour tally: " + R.buyers + " buyers, " + R.march + " with seats for 14 March.", R.march ? "bad" : "ok");
    if (s === END) say(R, "Midnight: the shop closes. " + R.buyers + " buyers, " + R.march + " with seats for 14 March.", R.march ? "bad" : "ok");
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
    var head = el("p", "margin:0;font-size:12px;");
    var wishes = el("p", "margin:0;font-size:12px;");
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:11px;border-collapse:collapse;");
    var hr = el("tr");
    ["pod", "namespace", "labels", "Service picks it", "buyers sent", "March seats"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;padding:2px 4px;", h));
    });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    [head, wishes, wrap].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { el: el, head: head, wishes: wishes, tbody: tbody };
  }

  function draw(api) {
    var S = api.state;
    var R = S.R;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "The Service, in namespace tickets, picks every ready pod there labelled " + labelText(selector(C)) +
      ", and hands each new buyer to the next one in turn.";
    ui.wishes.textContent = "Wishes stored in etcd: Deployment box-office keeps " + C.replicas + " pods" +
      (R.audDep ? "; Deployment box-office-audit keeps 1 pod (namespace " + C.audNs + ")." : ".");
    clear(ui.tbody);
    var sel = picked(R);
    R.pods.forEach(function (p) {
      var tr = ui.el("tr");
      [p.name + (p.readyAt > 0 ? " (starting)" : ""), p.ns, labelText(p.labels), sel.indexOf(p) >= 0 ? "yes" : "no",
        String(p.sent), String(p.march)].forEach(function (c) {
        tr.appendChild(ui.el("td", "padding:2px 4px;", c));
      });
      ui.tbody.appendChild(tr);
    });
    S.stat.now(clock(R.s));
    S.stat.pods(inTickets(R));
    S.stat.picked(sel.length);
    S.stat.buyers(R.buyers);
    S.stat.march(R.march);
    S.stat.live(R.live);
    S.stat.share(R.march + " of " + R.buyers);
    S.stat.deletes(R.deletes);
    var done = R.s >= END;
    S.ctl.fwd.disable(done);
    S.ctl.to2240.disable(R.s >= AT_2240);
    S.ctl.all.disable(done);
    S.ctl.delPod.disable(done || !audPod(R));
    S.ctl.delDep.disable(done || !R.audDep);
    S.ctl.svc.disable(done);
  }

  function flush(api) {
    var R = api.state.R;
    R.events.forEach(function (e) { api.log(e.msg, e.tone); });
    R.events = [];
  }

  function runTo(api, s) {
    var R = api.state.R;
    while (R.s < s && R.s < END) stepSecond(R);
    flush(api);
    draw(api);
  }

  function act(api, fn) {
    fn(api.state.R);
    flush(api);
    draw(api);
  }

  function restartNight(api, why) {
    var S = api.state;
    S.R = newNight(S.C);
    api.log((why ? why + " " : "") + "21:59:00. Deployment box-office keeps " + S.C.replicas + " pods; the Service picks " +
      plural(picked(S.R).length, "pod", "pods") + "; no buyers yet.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e14", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { audNs: "tickets", audLabel: "box-office", replicas: 3, unique: false, keep: false };
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.audNs = api.control.select("audNs", "Auditor's namespace", NAMESPACES, "tickets", function (v) {
        S.C.audNs = pick(NAMESPACES, v).value;
        restartNight(api, "Auditor's namespace: " + S.C.audNs + ".");
      });
      S.ctl.audLabel = api.control.select("audLabel", "Auditor's label", LABELS, "box-office", function (v) {
        S.C.audLabel = pick(LABELS, v).value;
        restartNight(api, "Auditor's label: app: " + S.C.audLabel + ".");
      });
      S.ctl.replicas = api.control.select("replicas", "Live pods (replicas)", REPLICAS, 3, function (v) {
        S.C.replicas = Number(pick(REPLICAS, v).value);
        restartNight(api, "Live replicas: " + S.C.replicas + ".");
      });
      S.ctl.unique = api.control.toggle("unique", "Unique live label: release: live on live pods and in the Service", false, function (on) {
        S.C.unique = !!on;
        restartNight(api, "Unique live label: " + (on ? "on." : "off."));
      });
      S.ctl.keep = api.control.toggle("keep", "Delete the auditor's pod every 5 minutes from 22:40", false, function (on) {
        S.C.keep = !!on;
        restartNight(api, "Keep deleting the auditor's pod: " + (on ? "on." : "off."));
      });
      S.ctl.fwd = api.control.button("fwd", "Forward 10 s", function () { runTo(api, S.R.s + 10); });
      S.ctl.to2240 = api.control.button("to2240", "Run to 22:40", function () { runTo(api, AT_2240); });
      S.ctl.all = api.control.button("all", "Run to midnight", function () { runTo(api, END); });
      S.ctl.delPod = api.control.button("delPod", "Delete the auditor's pod", function () { act(api, deletePod); });
      S.ctl.delDep = api.control.button("delDep", "Delete the auditor's Deployment", function () { act(api, deleteDeployment); });
      S.ctl.svc = api.control.button("svc", "Delete and recreate the Service", function () { act(api, recreateService); });
      S.ctl.again = api.control.button("again", "Start the night again", function () { restartNight(api, "Night replayed."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        now: api.stat("now", "now", ""),
        pods: api.stat("pods", "ready pods in namespace tickets", ""),
        picked: api.stat("picked", "pods the Service picks", "warn"),
        buyers: api.stat("buyers", "buyers so far", ""),
        march: api.stat("march", "buyers with seats for 14 March", "bad"),
        live: api.stat("live", "buyers with this season's seats", "ok"),
        share: api.stat("share", "March seats of all buyers", "bad"),
        deletes: api.stat("deletes", "auditor's pods deleted", "")
      };
      api.info("<strong>How to read it.</strong> Each step is one second. A buyer arrives every minute from 22:00:30, 60 an hour. The Service picks every ready pod in namespace tickets whose labels match its selector and hands buyers out in turn. A pod takes 8 s to start. The table shows every pod, whether the Service picks it, and how many buyers it got; the line above it shows each Deployment's wish.");
      restartNight(api, "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens at 21:59:00, before the auditor: 3 pods, all picked, no buyers.
      t.expect(t.stat("now") === "21:59:00" && t.stat("pods") === 3 && t.stat("picked") === 3 && t.stat("buyers") === 0 &&
        t.stat("march") === 0 && has("21:59:00. Deployment box-office keeps 3 pods; the Service picks 3 pods; no buyers yet."),
        "Opens at 21:59:00: 3 live pods, the Service picks 3, no buyers yet");

      // 2. To 22:40: the auditor's pod is picked from 22:00:08; 10 of 40 buyers got March seats.
      t.click("to2240");
      t.expect(t.stat("now") === "22:40:00" && t.stat("picked") === 4 && t.stat("buyers") === 40 && t.stat("march") === 10 &&
        has("22:00:00 Osvaldo starts last season's shop: Deployment box-office-audit, 1 pod, label app: box-office, namespace tickets.") &&
        has("22:00:08 box-office-audit-58c2d-tn6vb ready in namespace tickets, label app: box-office. The Service picks 4 pods."),
        "As tonight: from 22:00:08 the Service picks 4 pods; by 22:40, 10 of 40 buyers have March seats");

      // 3. Delete the pod at 22:40:00: gone, and back with a new name at 22:40:08.
      t.click("delPod");
      var gone = t.stat("picked") === 3 &&
        has("22:40:00 Pod box-office-audit-58c2d-tn6vb deleted. Deployment box-office-audit wants 1 pod and has 0, so it starts box-office-audit-58c2d-jk9fs.");
      t.click("fwd");
      t.expect(gone && t.stat("now") === "22:40:10" && t.stat("picked") === 4 && t.stat("deletes") === 1 &&
        has("22:40:08 box-office-audit-58c2d-jk9fs ready in namespace tickets, label app: box-office. The Service picks 4 pods."),
        "Deleted at 22:40:00, the auditor's pod is back as box-office-audit-58c2d-jk9fs at 22:40:08");

      // 4. To midnight: 30 of 120, one in four; 15 of 60 at 23:00.
      t.click("all");
      t.expect(t.stat("buyers") === 120 && t.stat("march") === 30 && t.stat("live") === 90 && t.stat("share") === "30 of 120" &&
        has("23:00:00 Hour tally: 60 buyers, 15 with seats for 14 March.") &&
        has("00:00:00 Midnight: the shop closes. 120 buyers, 30 with seats for 14 March."),
        "The record: 30 of 120 buyers, one in four, got seats for 14 March");

      // 5. Option 0: keep deleting every 5 minutes from 22:40. 16 deletions, still 30.
      t.set("keep", true);
      t.click("all");
      t.expect(t.stat("deletes") === 16 && t.stat("march") === 30 && t.stat("picked") === 4 &&
        has("23:55:00 Pod box-office-audit-58c2d-"),
        "Deleting the pod every 5 minutes from 22:40: 16 deletions, each back in 8 s, still 30 of 120");
      t.set("keep", false);

      // 6. Option 2: delete and recreate the Service at 22:40. It picks the same 4.
      t.click("to2240");
      t.click("svc");
      var svc = has("22:40:00 Service deleted and created again. It picks pods by app: box-office again: 4 pods, the auditor's among them.");
      t.click("all");
      t.expect(svc && t.stat("march") === 30 && t.stat("picked") === 4,
        "Recreating the Service: it picks the auditor's pod again by its label, 30 of 120");

      // 7. Option 3: 9 live pods. One in ten: 12 of 120.
      t.set("replicas", 9);
      t.click("all");
      t.expect(t.stat("picked") === 10 && t.stat("march") === 12 && t.stat("buyers") === 120,
        "9 live pods: the Service picks 10, and 12 of 120 buyers get March seats, one in ten");
      t.set("replicas", 3);

      // 8. Option 1, first half: delete the auditor's Deployment at 22:40. 10 before, none after.
      t.click("to2240");
      t.click("delDep");
      var dep = t.stat("picked") === 3 && t.stat("pods") === 3 &&
        has("22:40:00 Deployment box-office-audit deleted, and its pod with it. Nothing wants it back. The Service picks 3 pods.");
      t.click("all");
      t.expect(dep && t.stat("march") === 10 && t.stat("picked") === 3 && t.stat("pods") === 3,
        "Deleting the Deployment at 22:40: the pod does not come back; 10 of 120, none after 22:40");

      // 9. Option 1, second half: a unique live label. The auditor's pod runs but is never picked.
      t.set("unique", true);
      t.click("all");
      t.expect(t.stat("march") === 0 && t.stat("picked") === 3 && t.stat("pods") === 4 && t.stat("live") === 120,
        "Unique live label: the auditor's pod runs in tickets but the Service picks 3; 0 of 120");
      t.set("unique", false);

      // 10. The auditor in a namespace of his own: the Service never sees his pod.
      t.set("audNs", "audit");
      t.click("all");
      t.expect(t.stat("march") === 0 && t.stat("pods") === 3 && t.stat("picked") === 3,
        "Auditor's copy in namespace audit: the Service in tickets never picks it; 0 of 120");
      t.set("audNs", "tickets");

      // 11. Or with a label of its own.
      t.set("audLabel", "box-office-audit");
      t.click("all");
      t.expect(t.stat("march") === 0 && t.stat("pods") === 4 && t.stat("picked") === 3,
        "Auditor's copy labelled app: box-office-audit: never picked; 0 of 120");
    }
  });
})();
