/* sims/s8e08-v1.0.0.js  (published as sims/s8e08.js)
   Case s8e08 "The Lock Nobody Holds": a lock lab for a church bell tower.
   Two motor controllers, A and B, must hold a lock before they ring the hour on the tower's one bell.
   The lock lives on three small lock servers that keep each grant in memory only, for 60 seconds.
   A controller holds the lock when a majority of the servers (2 of 3) grant it. At 03:00 on Thursday
   10 December 2026 an urgent update restarted server 2 one second after it granted the lock to A;
   it came back with an empty memory and granted B as well, and the bell struck six for three o'clock.
   The learner sets the number of lock servers, the lock's lifetime, the restart, memory only or saved
   to disk, a delayed restart and a token check at the motor, then steps or plays 02:59:50 to 03:01:00
   in one-second steps and reads each server's grants, who holds the lock by the servers' count, the
   strokes each controller rang, and the tokens issued and refused.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls lock servers (3 or 5), lifetime (2, 60 or 300 s),
     which servers restart (server 2, or all on the shared power strip), restart time (none,
     02:59:55, 02:59:59, 03:00:30) and length (2, 30 or 90 s), grants kept in memory only or saved to
     disk, delayed restart, token check at the motor; step 1 s, play to the end, reset. Stats: strokes
     rung, strokes by controller, majorities granted, B's request, who holds the lock now by the
     servers' count, tokens issued, strokes refused by the motor. selfTest: 12 assertions.

   Where every number comes from (conventions rule 14; the case is content/s8/s8e08-v1.0.0.json).
   All of it is given data stated in sim.lede, and each result is checked by the selfTest.
   - Time is in seconds from 03:00:00 (negative before). The replay runs 02:59:50 to 03:01:00.
   - Three o'clock is three strokes. A controller that holds the lock rings at the hour, or at once
     if it got the lock after the hour, one stroke every 3 seconds: A at 03:00:00, :03 and :06;
     B, granted at 03:00:01, at 03:00:01, :04 and :07. Six strokes in all on the night.
   - Taking the lock: ask server 1, then 2, then 3 (then 4 and 5), and stop at a majority (2 of 3,
     3 of 5). A server that is down or silent gives no answer; one that already holds a live grant
     says no; otherwise it grants and keeps the grant for the lifetime. With fewer than a majority,
     the controller hands back what it got and stands down. Nobody gives a lock back; grants expire.
   - A, the main controller, asks at 02:59:58 so the lock is in hand at the stroke. B, the spare,
     asks at 03:00:01, so it only wins if A did not. As built, A gets servers 1 and 2 and stops;
     B, on a normal night, gets only server 3 and stands down.
   - Two deliberate choices, both given data: asking in turn and stopping at a majority is what leaves
     A with a bare majority (and makes "ask every server" an honest limit, explain step 3); and the
     usual update time is 14:30, not on the hour, because the clock strikes at 14:00 and a lock is
     held then.
   - Lifetime 60 s: A's grants, given at 02:59:58, run to 03:00:58. B's, at 03:00:01, to 03:01:01.
   - The update (given): Darragh at Beaufoy pushed it at 02:59; server 2 restarted at 02:59:59 and
     was back 2 seconds later, at 03:00:01, with an empty memory. At 03:00:01 B gets server 1 no,
     server 2 yes, server 3 yes: 2 of 3, a second majority. From 02:59:59 to 03:00:01 the servers
     held one grant for A: by their count, nobody held the lock.
   - Five servers: A gets 1, 2 and 3 (3 of 5); server 2 forgets; B gets 2, 4 and 5 (3 of 5).
   - Lifetime 300 s: A's grants run to 03:04:58, but server 2 forgets them anyway: six strokes.
   - Saved to disk: each server writes each grant to its disk before it answers and reloads it after
     a restart, as a consensus service such as etcd or ZooKeeper does; the service's one counter,
     also on disk, gives each new lock a token one higher than the last: A token 1, B token 2.
     B gets only server 3: refused. Three strokes.
   - Token check at the motor: it refuses a stroke whose token is lower than the last it obeyed.
     Memory-only servers give no token, so the check has nothing to read and the motor obeys.
     With a 2 s lifetime, shorter than the ringing, A's grants run out at 03:00:00, B gets the lock
     at 03:00:01 with token 2, and the motor refuses A's strokes at 03:00:03 and 03:00:06: 4 strokes.
   - Delayed restart (Redis's documented fix): a restarted server stays silent until a bit more than
     one lifetime after it went down: lifetime + 2 s, so 02:59:59 + 62 s = 03:01:01. No token.
   - Power strip (part 2 of the warn option): all lock servers share one strip; a trip at 02:59:55
     for 2 s. With the delayed restart all are silent until 03:00:57: nobody gets the lock, no strokes.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var START = -10;     // 02:59:50
  var END = 60;        // 03:01:00
  var ASK_A = -2;      // 02:59:58
  var ASK_B = 1;       // 03:00:01
  var GAP = 3;         // seconds between strokes
  var STROKES = 3;     // three o'clock
  var DELAY_EXTRA = 2; // a delayed restart stays silent for the lifetime plus 2 s

  var COUNTS = [
    { value: "3", label: "3 (as on the night)" },
    { value: "5", label: "5" }
  ];
  var LIVES = [
    { value: "60", label: "60 s (as on the night)" },
    { value: "300", label: "300 s (5 minutes)" },
    { value: "2", label: "2 s (shorter than the ringing)" }
  ];
  var WHOS = [
    { value: "one", label: "server 2 (the update, as on the night)" },
    { value: "all", label: "all servers (the shared power strip trips)" }
  ];
  var ATS = [
    { value: "-1", label: "02:59:59 (as on the night)" },
    { value: "-5", label: "02:59:55" },
    { value: "30", label: "03:00:30" },
    { value: "none", label: "no restart" }
  ];
  var LENS = [
    { value: "2", label: "2 s (as on the night)" },
    { value: "30", label: "30 s" },
    { value: "90", label: "90 s" }
  ];
  var STORES = [
    { value: "memory", label: "in memory only (as on the night)" },
    { value: "disk", label: "saved to disk before answering, with a token counter" }
  ];
  var ONOFF = [
    { value: "off", label: "off (as on the night)" },
    { value: "on", label: "on" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function tt(sec) {
    var s = ((10800 + sec) % 86400 + 86400) % 86400;
    return two(Math.floor(s / 3600)) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60);
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (a pure function the display and self-tests read) ---------- */

  function night(C) {
    var n = Number(C.servers);
    var m = Math.floor(n / 2) + 1;
    var life = Number(C.life);
    var disk = C.store === "disk";
    var rAt = C.rAt === "none" ? null : Number(C.rAt);
    var rLen = Number(C.rLen);
    var hit = [];
    var i;
    for (i = 0; i < n; i++) if (C.rWho === "all" || i === 1) hit.push(i);
    var back = rAt === null ? null : rAt + rLen;
    var quiet = rAt === null ? null : (C.delay === "on" ? Math.max(back, rAt + life + DELAY_EXTRA) : back);

    var srv = [];
    for (i = 0; i < n; i++) srv.push({ up: true, grant: null, hit: hit.indexOf(i) >= 0 });
    function hushed(s, t) { return !s.up || (s.hit && quiet !== null && t >= back && t < quiet); }
    var ctl = {
      A: { holds: false, at: null, token: null, rung: 0 },
      B: { holds: false, at: null, token: null, rung: 0 }
    };
    var counter = 0;
    var last = null;
    var noted = false;
    var r = { lines: [], snaps: {}, n: n, m: m, majorities: 0, tokens: 0, refused: 0, bAsk: "not yet" };

    function names(list) {
      return list.length === n ? (n === 3 ? "all three servers" : "all " + n + " servers") :
        (list.length === 1 ? "server " + (list[0] + 1) : "servers " + list.map(function (k) { return k + 1; }).join(" and "));
    }
    function count(who) {
      var c = 0;
      srv.forEach(function (s) { if (s.grant && s.grant.who === who) c += 1; });
      return c;
    }
    function holdsNow() {
      var a = count("A"), b = count("B");
      var out = [];
      if (a >= m) out.push("A (" + a + " of " + n + ")");
      if (b >= m) out.push("B (" + b + " of " + n + ")");
      return out.length ? out.join(" and ") : "nobody";
    }
    function snap(t) {
      r.snaps[t] = {
        servers: srv.map(function (s) {
          var state = !s.up ? "restarting" : (hushed(s, t) ? "silent" : "answering");
          return { state: state, grant: s.grant ? s.grant.who + " until " + tt(s.grant.until) : "-" };
        }),
        strokes: ctl.A.rung + ctl.B.rung, a: ctl.A.rung, b: ctl.B.rung,
        majorities: r.majorities, tokens: r.tokens, refused: r.refused, bAsk: r.bAsk, holds: holdsNow()
      };
    }
    function ask(who, t, said) {
      var got = [];
      var parts = [];
      for (var k = 0; k < n && got.length < m; k++) {
        var s = srv[k];
        if (hushed(s, t)) parts.push("server " + (k + 1) + " no answer");
        else if (s.grant) parts.push("server " + (k + 1) + " no");
        else {
          s.grant = { who: who, until: t + life };
          got.push(k);
          parts.push("server " + (k + 1) + " yes");
        }
      }
      var c = ctl[who];
      var text = who + " asks for the lock: " + parts.join(", ") + ". ";
      if (got.length >= m) {
        c.holds = true;
        c.at = t;
        r.majorities += 1;
        if (disk) { counter += 1; c.token = counter; r.tokens += 1; }
        text += who + " holds " + got.length + " of " + n + (c.token ? ", token " + c.token : ", no token") + ", until " + tt(t + life) + ".";
        var other = ctl[who === "A" ? "B" : "A"];
        if (other.holds && other.at + life > t) text += " A second majority, while " + (who === "A" ? "B" : "A") + "'s lock still runs.";
        if (who === "B") r.bAsk = "granted, " + got.length + " of " + n;
      } else {
        got.forEach(function (k2) { srv[k2].grant = null; });
        text += got.length + " of " + n + ": " + who + " hands back what it got and stands down.";
        if (who === "B") r.bAsk = "refused, " + got.length + " of " + n;
      }
      said.push(text);
      return got.length >= m;
    }

    snap(START);
    for (var t = START + 1; t <= END; t++) {
      var said = [];
      var tone = "";
      // 1. Restarts.
      if (rAt !== null && t === rAt) {
        hit.forEach(function (k) {
          srv[k].up = false;
          if (!disk) srv[k].grant = null;
        });
        said.push((C.rWho === "all" ? "The power strip trips, and " + names(hit) + " go down. " : "The update restarts " + names(hit) + ". ") +
          (disk ? "Grants are safe on disk." : "Memory is wiped."));
        tone = "warn";
      }
      if (rAt !== null && t === back) {
        hit.forEach(function (k) { srv[k].up = true; });
        var what = disk ? "grants reloaded from disk" : "memory empty";
        said.push(names(hit).charAt(0).toUpperCase() + names(hit).slice(1) + (hit.length > 1 ? " are" : " is") + " back, " + what +
          (quiet > back ? ", silent until " + tt(quiet) + "." : "."));
      }
      if (quiet !== null && quiet > back && t === quiet) {
        said.push(names(hit).charAt(0).toUpperCase() + names(hit).slice(1) + " answer" + (hit.length > 1 ? "" : "s") + " again.");
      }
      // 2. Grants run out.
      var gone = { A: [], B: [] };
      srv.forEach(function (s, k) {
        if (s.grant && s.grant.until <= t) { gone[s.grant.who].push(k); s.grant = null; }
      });
      ["A", "B"].forEach(function (w) {
        if (gone[w].length) said.push(w + "'s grant" + (gone[w].length > 1 ? "s" : "") + " on " + names(gone[w]) + " run" + (gone[w].length > 1 ? "" : "s") + " out.");
      });
      // 3. Requests.
      if (t === ASK_A) ask("A", t, said);
      if (t === ASK_B && ask("B", t, said) && ctl.A.holds) tone = "bad";
      // 4. Strokes.
      ["A", "B"].forEach(function (w) {
        var c = ctl[w];
        if (!c.holds) return;
        var s0 = Math.max(0, c.at);
        var k = (t - s0) / GAP;
        if (t < s0 || k !== Math.floor(k) || k >= STROKES) return;
        if (C.token === "on" && c.token !== null && last !== null && c.token < last) {
          r.refused += 1;
          said.push(w + " strikes with token " + c.token + ": the motor refuses it, lower than " + last + ".");
          return;
        }
        if (C.token === "on" && c.token === null && !noted) {
          noted = true;
          said.push("The motor checks tokens, but the lock servers gave none, so it has nothing to check.");
        }
        if (c.token !== null) last = c.token;
        c.rung += 1;
        said.push(w + " strikes. Stroke " + (ctl.A.rung + ctl.B.rung) + " of the hour.");
        if (ctl.A.rung + ctl.B.rung > STROKES) tone = "bad";
      });
      if (said.length) r.lines.push({ t: t, text: tt(t) + " " + said.join(" "), tone: tone });
      snap(t);
    }
    var f = r.snaps[END];
    r.summary = tt(END) + " The hour struck " + f.strokes + " (A " + f.a + ", B " + f.b + ") for three o'clock. Majorities granted: " +
      f.majorities + ". Tokens issued: " + f.tokens + ". Strokes refused by the motor: " + f.refused + ".";
    r.end = f;
    return r;
  }

  /* ---------- the widget ---------- */

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var x = doc.createElement(tag);
      if (style) x.setAttribute("style", style);
      if (text) x.textContent = text;
      return x;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var wrap = el("div", "overflow-x:auto;");
    var tb = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["lock server", "state", "grant held"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var th = el("thead");
    th.appendChild(hr);
    tb.appendChild(th);
    var body = el("tbody");
    tb.appendChild(body);
    wrap.appendChild(tb);
    box.appendChild(wrap);
    var bell = el("p", "margin:0;font-size:12px;");
    box.appendChild(bell);
    api.root.appendChild(box);
    return { el: el, head: head, body: body, bell: bell };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var N = night(C);
    var x = N.snaps[S.now];
    S.ui.head.textContent = "Time now: " + tt(S.now) + ". Lock servers: " + C.servers + ", lifetime " + C.life + " s, grants " +
      pick(STORES, C.store).label + ". Restart: " + pick(WHOS, C.rWho).label + " at " + pick(ATS, C.rAt).label + " for " +
      C.rLen + " s. Delayed restart: " + C.delay + ". Token check at the motor: " + C.token + ".";
    clear(S.ui.body);
    x.servers.forEach(function (s, k) {
      var tr = S.ui.el("tr");
      ["server " + (k + 1), s.state, s.grant].forEach(function (v) { tr.appendChild(S.ui.el("td", "", v)); });
      S.ui.body.appendChild(tr);
    });
    S.ui.bell.textContent = "Strokes so far: " + x.strokes + " (A " + x.a + ", B " + x.b + "). Three o'clock should be three.";
    S.stat.strokes(String(x.strokes));
    S.stat.byWho("A " + x.a + ", B " + x.b);
    S.stat.majorities(String(x.majorities));
    S.stat.bAsk(x.bAsk);
    S.stat.holds(x.holds);
    S.stat.tokens(String(x.tokens));
    S.stat.refused(String(x.refused));
  }

  function change(api, what) {
    api.state.now = START;
    api.log(what + " Set back to 02:59:50.", "");
    draw(api);
  }

  function advance(api, to) {
    var S = api.state;
    var N = night(S.C);
    if (S.now >= END) {
      api.log("The replay has already reached 03:01:00. Change a setting or reset to play it again.", "");
      return;
    }
    var from = S.now;
    var target = Math.min(to, END);
    N.lines.forEach(function (l) { if (l.t > from && l.t <= target) api.log(l.text, l.tone); });
    S.now = target;
    if (S.now >= END) api.log(N.summary, N.end.strokes === STROKES ? "ok" : "bad");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s8e08", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { servers: "3", life: "60", rWho: "one", rAt: "-1", rLen: "2", store: "memory", delay: "off", token: "off" };
      S.now = START;
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("servers", "Lock servers", COUNTS, "servers");
      sel("life", "Lock lifetime", LIVES, "life");
      sel("rwho", "What restarts", WHOS, "rWho");
      sel("rat", "Restart at", ATS, "rAt");
      sel("rlen", "Restart takes", LENS, "rLen");
      sel("store", "Grants kept", STORES, "store");
      sel("delay", "Delayed restart (silent for the lifetime plus 2 s)", ONOFF, "delay");
      sel("token", "Token check at the motor", ONOFF, "token");
      api.control.button("step", "Step 1 s", function () { advance(api, S.now + 1); });
      api.control.button("play", "Play to the end", function () { advance(api, Infinity); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        strokes: api.stat("strokes", "strokes rung", "bad"),
        byWho: api.stat("bywho", "strokes by controller", ""),
        majorities: api.stat("majorities", "majorities granted", "warn"),
        bAsk: api.stat("bask", "B's request at 03:00:01", ""),
        holds: api.stat("holds", "holds the lock now, by the servers' count", ""),
        tokens: api.stat("tokens", "tokens issued", "ok"),
        refused: api.stat("refused", "strokes the motor refused", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one lock server: whether it is answering, restarting or silent, and the grant it holds now, with who holds it and until when. A controller holds the lock when a majority of servers grant it; it then rings three strokes, one every 3 seconds. The stats count strokes, majorities granted, B's request, who holds the lock right now by the servers' own count, tokens issued and strokes the motor refused. Three o'clock should be three strokes.");

      api.log("Thursday 10 December 2026, 02:59:50, as on the night: three lock servers keeping grants in memory for 60 s, and an urgent update set to restart server 2 at 02:59:59.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: 02:59:50, nothing granted, nothing rung.
      t.expect(t.stat("strokes") === 0 && t.stat("majorities") === 0 && t.stat("bask") === "not yet" &&
        t.stat("holds") === "nobody" && has("Thursday 10 December 2026, 02:59:50, as on the night"),
        "Opens at 02:59:50 with no grants and no strokes");

      // 2. Eight steps reach 02:59:58: A asks servers 1 and 2 and holds 2 of 3, until 03:00:58.
      for (var i = 0; i < 8; i++) t.click("step");
      t.expect(has("02:59:58 A asks for the lock: server 1 yes, server 2 yes. A holds 2 of 3, no token, until 03:00:58.") &&
        t.stat("holds") === "A (2 of 3)",
        "02:59:58: A gets servers 1 and 2, holds 2 of 3 until 03:00:58");

      // 3. Two more: server 2 restarts empty at 02:59:59; at 03:00:00 nobody holds the lock by count, yet A strikes.
      t.click("step");
      t.click("step");
      t.expect(has("02:59:59 The update restarts server 2. Memory is wiped.") && t.stat("holds") === "nobody" &&
        t.stat("strokes") === 1 && has("03:00:00 A strikes. Stroke 1 of the hour."),
        "03:00:00: by the servers' count nobody holds the lock, and A strikes");

      // 4. As on the night: B gets servers 2 and 3, a second majority. Six strokes.
      t.click("play");
      t.expect(t.stat("strokes") === 6 && t.stat("bywho") === "A 3, B 3" && t.stat("majorities") === 2 &&
        t.stat("bask") === "granted, 2 of 3" && t.stat("tokens") === 0 &&
        has("03:00:01 Server 2 is back, memory empty. B asks for the lock: server 1 no, server 2 yes, server 3 yes. B holds 2 of 3, no token, until 03:01:01. A second majority, while A's lock still runs.") &&
        has("03:00:58 A's grant on server 1 runs out."),
        "As on the night: two majorities and six strokes, three each");

      // 5. Option 0: five memory-only servers. A gets 1, 2, 3; B gets 2, 4, 5.
      t.set("servers", "5");
      t.click("play");
      t.expect(t.stat("strokes") === 6 && t.stat("majorities") === 2 && t.stat("bask") === "granted, 3 of 5" &&
        has("server 1 no, server 2 yes, server 3 no, server 4 yes, server 5 yes. B holds 3 of 5"),
        "Five forgetful servers: B gets 2, 4 and 5, a second majority, six strokes");
      t.set("servers", "3");

      // 6. Option 1: a 300-second lifetime. Server 2 forgets anyway.
      t.set("life", "300");
      t.click("play");
      t.expect(t.stat("strokes") === 6 && t.stat("majorities") === 2 && has("A holds 2 of 3, no token, until 03:04:58."),
        "Lifetime 300 s: A's lock runs to 03:04:58 but server 2 forgot it; six strokes");
      t.set("life", "60");

      // 7. A token check alone, on memory-only servers: no token to check, still six.
      t.set("token", "on");
      t.click("play");
      t.expect(t.stat("strokes") === 6 && t.stat("tokens") === 0 &&
        has("The motor checks tokens, but the lock servers gave none, so it has nothing to check."),
        "Token check with memory-only servers: no tokens issued, six strokes");

      // 8. Option 2: saved to disk with a token the motor checks. B refused, three strokes, token 1.
      t.set("store", "disk");
      t.click("play");
      t.expect(t.stat("strokes") === 3 && t.stat("bywho") === "A 3, B 0" && t.stat("bask") === "refused, 1 of 3" &&
        t.stat("tokens") === 1 && t.stat("refused") === 0 && t.stat("majorities") === 1 &&
        has("Server 2 is back, grants reloaded from disk."),
        "Saved to disk, with tokens: server 2 remembers A, B is refused, three strokes, token 1");

      // 9. The token's own job: a lifetime shorter than the ringing. B gets token 2; the motor refuses A's last two.
      t.set("life", "2");
      t.click("play");
      var fenced = t.stat("strokes") === 4 && t.stat("refused") === 2 && t.stat("tokens") === 2 &&
        has("A strikes with token 1: the motor refuses it, lower than 2.");
      t.set("token", "off");
      t.click("play");
      t.expect(fenced && t.stat("strokes") === 6 && t.stat("refused") === 0,
        "Lifetime 2 s on disk: with the token check, 4 strokes and A's last 2 refused; without it, 6");
      t.set("life", "60");
      t.set("store", "memory");

      // 10. Option 3: delayed restart on memory-only servers. B refused, three strokes, no token.
      t.set("delay", "on");
      t.click("play");
      t.expect(t.stat("strokes") === 3 && t.stat("bask") === "refused, 1 of 3" && t.stat("tokens") === 0 &&
        has("Server 2 is back, memory empty, silent until 03:01:01."),
        "Delayed restart: server 2 silent until 03:01:01, B refused, three strokes, no token");

      // 11. The delayed restart's price: the power strip trips at 02:59:55; every server is silent, nobody rings.
      t.set("rwho", "all");
      t.set("rat", "-5");
      t.click("play");
      var silentHour = t.stat("strokes") === 0 && t.stat("majorities") === 0 &&
        has("All three servers are back, memory empty, silent until 03:00:57.");
      t.set("delay", "off");
      t.click("play");
      t.expect(silentHour && t.stat("strokes") === 3,
        "Power strip trip at 02:59:55 with delayed restarts: no strokes at all; without them, three");

      // 12. A restart before A asks is harmless; a second play is refused.
      t.set("rwho", "one");
      t.click("play");
      var early = t.stat("strokes") === 3 && t.stat("bask") === "refused, 1 of 3";
      t.click("play");
      t.expect(early && has("The replay has already reached 03:01:00."),
        "Server 2 restarting at 02:59:55, before A asks, forgets nothing that matters: three strokes; a second play is refused");
    }
  });
})();
