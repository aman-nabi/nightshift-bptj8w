/* sims/s1e02-v1.0.0.js  (published as sims/s1e02.js)
   Case s1e02 "Knock Knock": a box with five doors (ports) you can knock on.

   CHANGELOG
   v1.0.0 (2026-10-06) first version: Dell's laptop (outside), a firewall, the box at 192.0.2.40
     with doors 22, 80, 443, 5432 and 8080, and a client inside the box (localhost). Controls: door,
     knock from the laptop, knock from inside, start a program, stop it, firewall on or off for the
     door, reset. Stats: answered, refused, timed out, failed starts (address already in use).
     selfTest covers the behaviours the case teaches.

   Notes:
   - Everything sits inside one function so nothing leaks into the page.
   - Every outcome is decided the moment a button is pressed. Log lines and stats run on real-second
     timers (api.after), computed from the dot's path length, so they never depend on a dot arriving.
     The dots are a slow-motion picture of knocks that really take a millisecond or two.
   - The starting state matches the story at 01:40: SSH on 22 (firewall drops outsiders), nothing on
     80, a web server on 443, PostgreSQL on 5432 listening on localhost only, and Hal's old board v1
     holding 8080 because the start-up list launched it before Rosa's v2.
   - 192.0.2.40 comes from a documentation range (RFC 5737), so it never points at a real machine.
*/
(function () {
  "use strict";

  var BOX_IP = "192.0.2.40";
  var SPEED = 2;              // sim seconds per real second
  var WAIT = 5;               // sim seconds the knock tool waits before giving up, as in the story
  var DOT_SPEED = 600;        // viewBox units per real second
  var START = 1 * 3600 + 40 * 60;   // 01:40:00, when Dell knocked

  var DOORS = [
    { port: "22", id: "d22", name: "Door 22 · SSH", y: 64 },
    { port: "80", id: "d80", name: "Door 80 · web", y: 138 },
    { port: "443", id: "d443", name: "Door 443 · web", y: 212 },
    { port: "5432", id: "d5432", name: "Door 5432 · database", y: 286 },
    { port: "8080", id: "d8080", name: "Door 8080 · board", y: 360 }
  ];

  // What answers when a program is listening. "says" is what the knocker hears back.
  var PROGRAMS = {
    ssh: { name: "the SSH program", short: "SSH program", says: "a login prompt", local: false },
    web: { name: "the web server", short: "web server", says: "the company's home page", local: false },
    db: { name: "the database", short: "database", says: "the database's hello", local: true },
    v1: { name: "Hal's board v1", short: "Hal's board v1", says: "GOOD NIGHT, HAL", local: false, hal: true },
    v2: { name: "Rosa's board v2", short: "Rosa's board v2", says: "ORDER BOARD v2", local: false }
  };

  // What the Start button launches on each door.
  var STARTS = { "22": "ssh", "80": "web", "443": "web", "5432": "db", "8080": "v2" };

  var ABOUT = {
    "22": "Port 22 is the standard door for SSH, the way to log in to a machine from far away.",
    "80": "Port 80 is the standard door for web pages.",
    "443": "Port 443 is the standard door for web pages over an encrypted connection.",
    "5432": "Port 5432 is the standard door for the PostgreSQL database, which by default listens only on localhost.",
    "8080": "Port 8080 is a common pick for a team's own program. The order board lives here."
  };

  /* Layout: the laptop and the firewall on the left, the box (a group) on the right with five doors
     in a column and a client inside it. Label widths were checked at 0.6 x font size per character
     (label 13px, sub 12px, meta 11px). The group label sits above the first door. */
  function buildDiagram() {
    var nodes = [
      { id: "laptop", label: "Dell's laptop", sub: "outside the box", meta: "waits up to 5 s", x: 85, y: 212, w: 140, h: 72, shape: "box", tone: "" },
      { id: "fw", label: "Firewall", sub: "door 443", meta: "lets outsiders in", x: 265, y: 212, w: 120, h: 72, shape: "box", tone: "" },
      { id: "inside", label: "Inside the box", sub: "localhost", meta: "127.0.0.1", x: 655, y: 212, w: 130, h: 72, shape: "box", tone: "" }
    ];
    var edges = [{ from: "laptop", to: "fw", label: "knock" }];
    DOORS.forEach(function (d) {
      nodes.push({ id: d.id, label: d.name, sub: "", meta: "", x: 470, y: d.y, w: 180, h: 60, shape: "box", tone: "" });
      edges.push({ from: "fw", to: d.id });
      edges.push({ from: "inside", to: d.id });
    });
    return {
      type: "arch",
      w: 740,
      h: 420,
      aria: "Port knocking sim. Dell's laptop knocks through a firewall on five doors of the box at " + BOX_IP + ": ports 22, 80, 443, 5432 and 8080. A client inside the box can knock on the same doors through localhost, which the firewall never sees.",
      groups: [{ label: "The box · " + BOX_IP, x: 350, y: 4, w: 386, h: 410 }],
      nodes: nodes,
      edges: edges
    };
  }

  var DIAGRAM = buildDiagram();

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  function center(id) {
    for (var i = 0; i < DIAGRAM.nodes.length; i++) {
      if (DIAGRAM.nodes[i].id === id) return DIAGRAM.nodes[i];
    }
    return { x: 0, y: 0 };
  }

  function dist(a, b) {
    var p = center(a), q = center(b);
    return Math.sqrt((q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y));
  }

  function doorByPort(port) {
    for (var i = 0; i < DOORS.length; i++) if (DOORS[i].port === String(port)) return DOORS[i];
    return DOORS[0];
  }

  function doorById(id) {
    for (var i = 0; i < DOORS.length; i++) if (DOORS[i].id === id) return DOORS[i];
    return null;
  }

  function makeProgram(key) {
    var p = PROGRAMS[key];
    return { key: key, name: p.name, short: p.short, says: p.says, local: p.local, hal: !!p.hal };
  }

  function updateStats(api) {
    var S = api.state;
    S.stat.answered(S.count.answered);
    S.stat.refused(S.count.refused);
    S.stat.timedout(S.count.timedout);
    S.stat.inuse(S.count.inuse);
  }

  function setBusy(api, on) {
    var S = api.state;
    S.busy = on;
    S.ctl.knock.disable(on);
    S.ctl.local.disable(on);
  }

  /* ---------- drawing the current state ---------- */

  function render(api) {
    var S = api.state;
    DOORS.forEach(function (d) {
      var p = S.progs[d.port];
      var node = api.node(d.id);
      if (!p) {
        node.text("sub", "nobody listening");
        node.text("meta", "door is empty");
        node.set("muted");
      } else {
        node.text("sub", p.short);
        node.text("meta", p.local ? "listens: localhost only" : "listens: all addresses");
        node.set(p.hal ? "zombie" : (p.local ? "warn" : "ok"));
      }
      api.edge("fw", d.id).set(S.fw[d.port] ? "" : "cut");
    });
    var open = !!S.fw[S.sel];
    api.node("fw").text("sub", "door " + S.sel);
    api.node("fw").text("meta", open ? "lets outsiders in" : "drops outsiders");
    api.node("fw").set(open ? "" : "warn");
  }

  /* ---------- a knock ---------- */

  // Runs steps[k] when the dot reaches path[k] (k >= 1), on real-second timers, so the story goes on
  // even if a dot is dropped. onArrive only changes the dot's colour.
  function play(api, path, steps, onArrive) {
    var session = api.state.session;
    var dot = api.dot({ path: path, cls: "dot-req", r: 5, speed: DOT_SPEED, onArrive: onArrive });
    var t = 0;
    for (var k = 1; k < path.length; k++) {
      t += dist(path[k - 1], path[k]) / DOT_SPEED;
      if (steps[k]) {
        (function (fn, at) {
          api.after(at, function () { if (api.state.session === session) fn(); });
        })(steps[k], t);
      }
    }
    return dot;
  }

  function knock(api, fromInside) {
    var S = api.state;
    if (S.busy) return;
    var d = doorByPort(S.sel);
    var prog = S.progs[d.port];
    var outcome;
    if (!fromInside && !S.fw[d.port]) outcome = "dropped";
    else if (!prog) outcome = "empty";
    else if (prog.local && !fromInside) outcome = "local";
    else outcome = "answered";

    setBusy(api, true);
    var session = S.session;

    if (fromInside) {
      api.log("From inside the box, you knock on localhost (127.0.0.1), door " + d.port + ". This knock never leaves the machine, so the firewall never sees it.", "");
    } else {
      api.log("You knock on " + BOX_IP + ", door " + d.port + ", from Dell's laptop.", "");
    }

    if (outcome === "dropped") {
      var waiting = api.dot({
        path: ["laptop", "fw"], cls: "dot-req", r: 5, speed: DOT_SPEED,
        onArrive: function (dot) { dot.cls("dot-wait"); dot.park(); }
      });
      api.after(dist("laptop", "fw") / DOT_SPEED, function () {
        if (api.state.session !== session) return;
        api.log("The firewall drops the knock on door " + d.port + " without a word. Your laptop doesn't know that. It keeps waiting.", "warn");
      });
      api.after(WAIT / SPEED, function () {
        if (api.state.session !== session) return;
        if (waiting) {
          waiting.cls("dot-fail");
          api.after(0.4, function () { waiting.remove(); });
        }
        S.count.timedout += 1;
        updateStats(api);
        api.log(WAIT + " seconds and no answer. Your laptop gives up: timed out. From out here you can't tell whether anyone is behind the door.", "bad");
        setBusy(api, false);
      });
      return;
    }

    var path = fromInside ? ["inside", d.id, "inside"] : ["laptop", "fw", d.id, "fw", "laptop"];
    var atDoor = fromInside ? 1 : 2;
    var good = outcome === "answered";
    var steps = {};
    if (!fromInside) {
      steps[1] = function () { api.log("The firewall lets the knock through to door " + d.port + ".", ""); };
    }
    steps[atDoor] = function () {
      if (outcome === "empty") {
        api.log("Nobody is listening behind door " + d.port + ". The box answers for it at once: refused. Nobody here.", "warn");
      } else if (outcome === "local") {
        api.log(prog.name.charAt(0).toUpperCase() + prog.name.slice(1) + " is running, but it listens only on localhost. Your knock came in on " + BOX_IP + ", where nobody listens on " + d.port + ", so the box refuses it at once.", "warn");
      } else if (prog.hal) {
        api.log("Door " + d.port + " answers: " + prog.says + ". It's Hal's board v1, the program Rosa replaced three weeks ago.", "warn");
      } else {
        api.log("Door " + d.port + " answers: " + prog.says + ". It's " + prog.name + ".", "ok");
      }
    };
    steps[path.length - 1] = function () {
      if (good) S.count.answered += 1; else S.count.refused += 1;
      updateStats(api);
      setBusy(api, false);
    };
    play(api, path, steps, function (dot, wp) {
      if (wp === d.id) dot.cls(good ? "dot-ok" : "dot-bad");
    });
  }

  /* ---------- the other controls ---------- */

  function startProgram(api) {
    var S = api.state;
    var d = doorByPort(S.sel);
    var want = makeProgram(STARTS[d.port]);
    var held = S.progs[d.port];
    if (held) {
      S.count.inuse += 1;
      updateStats(api);
      api.log("You start " + want.name + " on door " + d.port + ". It asks the box for port " + d.port + ", and the box says no: address already in use. " + held.name.charAt(0).toUpperCase() + held.name.slice(1) + " holds that door, so the new program quits.", "bad");
      return;
    }
    S.progs[d.port] = want;
    api.log("You start " + want.name + ". It takes port " + d.port + " and listens " + (want.local ? "on localhost only." : "on all the box's addresses."), "ok");
    render(api);
  }

  function stopProgram(api) {
    var S = api.state;
    var d = doorByPort(S.sel);
    var held = S.progs[d.port];
    if (!held) {
      api.log("Nothing to stop: door " + d.port + " is already empty.", "");
      return;
    }
    S.progs[d.port] = null;
    if (held.hal) {
      api.log("You stop Hal's board v1. It had held door 8080 since the box powered on at 1:12. The door is empty now.", "ok");
    } else {
      api.log("You stop " + held.name + ". Door " + d.port + " is empty now, so a knock there will be refused.", "");
    }
    render(api);
  }

  function setFirewall(api, on) {
    var S = api.state;
    S.fw[S.sel] = !!on;
    if (on) api.log("The firewall now lets outsiders knock on door " + S.sel + ".", "");
    else api.log("The firewall now drops outside knocks on door " + S.sel + " without a reply.", "warn");
    render(api);
  }

  function pickDoor(api, v) {
    var S = api.state;
    S.sel = String(v);
    S.ctl.fw.set(!!S.fw[S.sel]);
    render(api);
    api.info(INFO.door(S, doorByPort(S.sel)));
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    laptop: function () {
      return "<strong>Dell's laptop.</strong> A client outside the box. It knocks on the box's doors across the office network, so every knock has to get past the firewall first. Its knock tool waits up to 5 seconds for an answer, then gives up.";
    },
    fw: function (S) {
      return "<strong>Firewall.</strong> A guard in front of the box's doors. For each door it either lets outside knocks through or drops them without a word, which leaves the knocker waiting until it gives up. It can't change which program answers, and it never sees knocks from inside the box. Door " + S.sel + " right now: " + (S.fw[S.sel] ? "outsiders are let in." : "outside knocks are dropped.");
    },
    inside: function () {
      return "<strong>Inside the box (localhost).</strong> A client running on the box itself, knocking on 127.0.0.1. Those knocks never leave the machine, so the firewall never sees them, and programs that listen only on localhost can answer them.";
    },
    door: function (S, d) {
      var p = S.progs[d.port];
      var who = !p ? "Nobody is listening here, so any knock that reaches it is refused at once."
        : p.local ? capital(p.name) + " listens here, but only on localhost: knocks from inside are answered, knocks from outside are refused."
        : capital(p.name) + " listens here on all addresses. It answers: " + p.says + ".";
      return "<strong>" + d.name + " (port " + d.port + ").</strong> " + ABOUT[d.port] + " " + who + " Firewall: " + (S.fw[d.port] ? "lets outsiders in." : "drops outside knocks.");
    }
  };

  function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- the module ---------- */

  DL.sims.define("s1e02", {
    diagram: DIAGRAM,

    setup: function (api) {
      var S = api.state;
      S.session = {};
      S.busy = false;
      S.sel = "443";
      S.progs = {
        "22": makeProgram("ssh"),
        "80": null,
        "443": makeProgram("web"),
        "5432": makeProgram("db"),
        "8080": makeProgram("v1")
      };
      S.fw = { "22": false, "80": true, "443": true, "5432": true, "8080": true };
      S.count = { answered: 0, refused: 0, timedout: 0, inuse: 0 };
      api.speed = SPEED;
      api.clock = START;

      S.ctl = {};
      S.ctl.door = api.control.select("door", "Door (port)", [
        { value: "22", label: "22 · SSH" },
        { value: "80", label: "80 · web" },
        { value: "443", label: "443 · web" },
        { value: "5432", label: "5432 · database" },
        { value: "8080", label: "8080 · order board" }
      ], "443", function (v) { pickDoor(api, v); });
      S.ctl.knock = api.control.button("knock", "Knock from Dell's laptop", function () { knock(api, false); });
      S.ctl.local = api.control.button("local", "Knock from inside the box (localhost)", function () { knock(api, true); });
      S.ctl.start = api.control.button("start", "Start a program on this door", function () { startProgram(api); });
      S.ctl.stop = api.control.button("stop", "Stop the program on this door", function () { stopProgram(api); });
      S.ctl.fw = api.control.toggle("fw", "Firewall lets outsiders knock on this door", true, function (on) { setFirewall(api, on); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); }, { tone: "ghost" });

      S.stat = {
        answered: api.stat("answered", "answered", "ok"),
        refused: api.stat("refused", "refused", "warn"),
        timedout: api.stat("timedout", "timed out", "bad"),
        inuse: api.stat("inuse", "failed starts (in use)", "")
      };
      updateStats(api);
      render(api);

      api.onNodeClick(function (id) {
        var st = api.state;
        var d = doorById(id);
        if (d) { api.info(INFO.door(st, d)); return; }
        var f = INFO[id];
        if (f) api.info(f(st));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");
      api.log("01:40. The box powered back on at 1:12 AM. Its start-up list launched Hal's board v1 and Rosa's v2. Hal's got door 8080 first. Rosa's v2 found the door taken and quit.", "");
    },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. A program is listening on 443 and the firewall lets outsiders in.
      t.set("door", "443");
      t.click("knock");
      await t.run(3);
      t.expect(n("answered") === 1, "a knock on door 443 is answered: a web server is listening there");

      // 2. Nothing listens on 80: refused at once, not a timeout.
      t.set("door", "80");
      t.click("knock");
      await t.run(3);
      t.expect(n("refused") === 1 && n("timedout") === 0, "door 80 has no program behind it, so the box refuses the knock at once");

      // 3. The firewall drops outside knocks on 22: nothing comes back until the laptop gives up.
      t.set("door", "22");
      t.click("knock");
      await t.run(1);
      t.expect(n("timedout") === 0 && n("refused") === 1, "one second in, the dropped knock on door 22 is still waiting for an answer");
      await t.run(3);
      t.expect(n("timedout") === 1 && n("answered") === 1, "the firewall drops knocks on door 22, so the laptop gives up after 5 seconds: timed out");

      // 4. The same door from inside the box: the SSH program was there all along.
      t.click("local");
      await t.run(3);
      t.expect(n("answered") === 2, "from inside the box (localhost), door 22 answers: the firewall only guards the outside");

      // 5. The database runs but listens only on localhost.
      t.set("door", "5432");
      t.click("knock");
      await t.run(3);
      t.expect(n("refused") === 2, "the database refuses a knock from the laptop because it listens only on localhost");
      t.click("local");
      await t.run(3);
      t.expect(n("answered") === 3, "the same database answers a knock from inside the box");

      // 6. Hal's v1 holds 8080: starting v2 fails, and knocks still reach Hal's program.
      t.set("door", "8080");
      t.click("start");
      t.expect(n("inuse") === 1 && has("address already in use") && t.node("d8080").text.sub === "Hal's board v1", "starting v2 while Hal's v1 holds door 8080 fails with address already in use");
      t.click("knock");
      await t.run(3);
      t.expect(n("answered") === 4 && has("GOOD NIGHT, HAL"), "door 8080 is still answered by Hal's v1");

      // 7. The senior fix: stop the old program, start v2, knock and check who answers.
      t.click("stop");
      t.click("start");
      t.click("knock");
      await t.run(3);
      t.expect(t.node("d8080").text.sub === "Rosa's board v2" && n("answered") === 5 && has("ORDER BOARD v2"), "after stopping Hal's program, v2 gets door 8080 and answers");

      // 8. Opening the firewall on 22 lets the laptop's knock through.
      t.set("door", "22");
      t.click("fw");
      t.click("knock");
      await t.run(3);
      t.expect(n("answered") === 6 && n("timedout") === 1, "with the firewall letting outsiders in on door 22, the laptop's knock is answered");
    }
  });
})();
