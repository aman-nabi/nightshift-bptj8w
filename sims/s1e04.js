/* sims/s1e04-v1.0.1.js  (published as sims/s1e04.js)
   Case s1e04 "The Letter With No Return Address": a request builder and a toy hotel website.

   CHANGELOG
   v1.0.1 (2026-10-06) review fixes: PUT and DELETE on /requests with no valid session now answer
     401 Unauthorized (sign in first) instead of 404, as interviewers expect for a missing or unknown
     session (RFC 9110 section 15.5.2). GET and POST /requests with no session still answer 200 and
     print ROOM ???, because that broken behaviour is the story; the log now says a careful website
     would answer 401 there too. The status box's help text mentions 401. selfTest adds one check:
     a PUT with the cookie off gets 401. The case's tryThis order (switch on the database, sign in
     again, then restart) is what selfTest step 7 already does.
   v1.0.0 (2026-10-06) first version: the room 412 tablet sends HTTP requests (method, path, cookie
     on or off) to the Hotel Ashgrove's website, which keeps sessions in its memory or in the
     database. The response's status code, headers and body show in the diagram. Paths: /login,
     /requests, /spa (301), /wellness, /minibar (404), /invoice (500). More than 5 requests in 10
     seconds get 429. A restart answers 503 for 30 seconds and, with sessions in memory, forgets
     everyone. Controls: method, path, send cookie, send, restart, sessions in the database, reset.
     Stats: responses per status family. selfTest covers the behaviours the case teaches.

   Notes:
   - Everything sits inside one function so nothing leaks into the page.
   - Each response is decided the moment Send is pressed and shown REPLY real seconds later, the same
     delay for every request, so responses always appear in the order they were sent. The dot is a
     slow-motion picture of a request that really takes milliseconds.
   - Numbers match the story: room 412, Mr. Okafor, first session id 7f3a, a 30-second restart with
     Retry-After: 30, and a limit of 5 requests in 10 seconds.
   - Request and response text is built only from fixed strings in this file (no user typing), so
     nothing untrusted reaches the page.
*/
(function () {
  "use strict";

  var SPEED = 3;                       // clock seconds per real second
  var START = 2 * 3600 + 58 * 60;      // 02:58:00, just before the story's 3:00 restart
  var WINDOW = 10;                     // clock seconds in the rate-limit window
  var LIMIT = 5;                       // requests allowed in that window; the next one gets 429
  var RESTART = 30;                    // clock seconds the website is down after a restart
  var REPLY = 1.6;                     // real seconds from Send to the response showing
  var ROOM = "412";
  var FIRST_SID = "7f3a";

  var REASONS = {
    200: "OK",
    301: "Moved Permanently",
    401: "Unauthorized",
    404: "Not Found",
    405: "Method Not Allowed",
    429: "Too Many Requests",
    500: "Internal Server Error",
    503: "Service Unavailable"
  };

  var PATHS = ["/login", "/requests", "/spa", "/wellness", "/minibar", "/invoice"];
  var METHODS = ["GET", "POST", "PUT", "DELETE"];

  /* Layout: tablet, website and session memory across the top; the last request on the left and the
     last response (status, headers, body) on the right. Label widths were checked at 0.6 x font size
     per character (label 13px, sub 12px, meta 11px). Group labels sit above the boxes inside them. */
  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 370,
    aria: "HTTP sim. The room 412 tablet sends a request to the hotel website, which may look up the tablet's cookie in its session memory. The last request is shown on the left, and the last response, with its status code, headers and body, on the right.",
    groups: [
      { label: "Last request", x: 4, y: 136, w: 262, h: 224 },
      { label: "Last response", x: 272, y: 136, w: 464, h: 224 }
    ],
    nodes: [
      { id: "tablet", label: "Room 412 tablet", sub: "cookie: none", meta: "sends cookie: on", x: 100, y: 70, w: 170, h: 72, shape: "box", tone: "" },
      { id: "server", label: "Hotel website", sub: "up and running", meta: "limit: 5 per 10 s", x: 380, y: 70, w: 180, h: 72, shape: "box", tone: "" },
      { id: "store", label: "Session memory", sub: "in website memory", meta: "empty", x: 640, y: 70, w: 170, h: 72, shape: "db", tone: "muted" },
      { id: "req", label: "POST /login", sub: "Cookie: (none)", meta: "to the hotel website", x: 135, y: 230, w: 240, h: 72, shape: "box", tone: "" },
      { id: "status", label: "No response yet", x: 504, y: 188, w: 440, h: 44, shape: "box", tone: "muted" },
      { id: "headers", label: "Headers", sub: "(none yet)", meta: "", x: 504, y: 258, w: 440, h: 64, shape: "box", tone: "" },
      { id: "body", label: "Body", sub: "Press Send.", x: 504, y: 330, w: 440, h: 48, shape: "box", tone: "" }
    ],
    edges: [
      { from: "tablet", to: "server", label: "request" },
      { from: "server", to: "store", label: "looks up" }
    ]
  };

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  function center(id) {
    for (var i = 0; i < DIAGRAM.nodes.length; i++) {
      if (DIAGRAM.nodes[i].id === id) return DIAGRAM.nodes[i];
    }
    return { x: 0, y: 0 };
  }

  function pathLength(path) {
    var len = 0;
    for (var i = 1; i < path.length; i++) {
      var a = center(path[i - 1]), b = center(path[i]);
      len += Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
    }
    return len;
  }

  function sessionCount(S) { return Object.keys(S.sessions).length; }

  function family(code) { return Math.floor(code / 100); }

  function newSid(api) {
    var S = api.state;
    if (!S.usedFirst) { S.usedFirst = true; return FIRST_SID; }
    var sid;
    var guard = 0;
    do {
      sid = Math.floor(api.rand() * 65536).toString(16);
      while (sid.length < 4) sid = "0" + sid;
      guard += 1;
    } while (S.sessions[sid] && guard < 20);
    return sid;
  }

  function updateStats(api) {
    var S = api.state;
    S.stat.s2(S.count[2]);
    S.stat.s3(S.count[3]);
    S.stat.s4(S.count[4]);
    S.stat.s5(S.count[5]);
  }

  /* ---------- drawing ---------- */

  function render(api) {
    var S = api.state;
    var down = api.clock < S.downUntil;
    api.node("tablet").text("sub", "cookie: " + (S.jar ? "sid=" + S.jar : "none"));
    api.node("tablet").text("meta", "sends cookie: " + (S.sendCookie ? "on" : "off"));
    api.node("server").text("sub", down ? "restarting: 503s" : "up and running");
    api.node("server").set(down ? "bad" : "");
    var n = sessionCount(S);
    var ids = Object.keys(S.sessions);
    api.node("store").text("label", S.store === "db" ? "Session database" : "Session memory");
    api.node("store").text("sub", S.store === "db" ? "in the database" : "in website memory");
    api.node("store").text("meta", n === 0 ? "empty" : (n === 1 ? ids[0] + " is room " + S.sessions[ids[0]] : n + " sessions"));
    api.node("store").set(n === 0 ? "muted" : "ok");
  }

  function showResponse(api, res) {
    var S = api.state;
    var fam = family(res.code);
    api.node("status").text("label", res.code + " " + REASONS[res.code]);
    api.node("status").set(fam === 2 ? "ok" : fam === 3 ? "accent" : fam === 4 ? "warn" : "bad");
    api.node("headers").text("sub", res.headers[0] || "(no headers)");
    api.node("headers").text("meta", res.headers[1] || "");
    api.node("body").text("sub", res.body);
    S.count[fam] = (S.count[fam] || 0) + 1;
    updateStats(api);
    api.log(res.code + " " + REASONS[res.code] + ". " + res.body + (res.note ? " " + res.note : ""), res.tone);
    render(api);
  }

  /* ---------- the toy hotel website ---------- */

  function response(code, headers, body, note, tone) {
    return { code: code, headers: headers, body: body, note: note || "", tone: tone || "", lookup: false };
  }

  // Decides the response the moment the request is sent.
  function handle(api, method, path, sid) {
    var S = api.state;
    var now = api.clock;
    var keep = [];
    for (var i = 0; i < S.recent.length; i++) if (S.recent[i] > now - WINDOW) keep.push(S.recent[i]);
    var limited = keep.length >= LIMIT;
    keep.push(now);
    S.recent = keep;

    if (limited) {
      return response(429, ["Retry-After: " + WINDOW, "Content-Type: text/plain"], "Too many requests. Please slow down.",
        "More than " + LIMIT + " requests in " + WINDOW + " seconds. Wait " + WINDOW + " seconds before asking again.", "warn");
    }
    if (now < S.downUntil) {
      return response(503, ["Retry-After: " + RESTART, "Content-Type: text/plain"], "The website is restarting. Try again soon.",
        "The website isn't running, so the proxy in front of it answers for it.", "bad");
    }

    var plain = "Content-Type: text/plain";
    var room = sid && S.sessions[sid] ? S.sessions[sid] : null;
    var res;

    if (path === "/login") {
      if (method === "GET") return response(200, [plain], "Sign in: room number and surname.", "", "ok");
      if (method === "POST") {
        var fresh = newSid(api);
        S.sessions[fresh] = ROOM;
        S.jar = fresh;
        res = response(200, ["Set-Cookie: sid=" + fresh + "; HttpOnly", plain], "Welcome back, Mr. Okafor. Room 412.",
          "The website saves a session (" + fresh + " is room 412) and hands the tablet a cookie to show next time.", "ok");
        res.lookup = true;
        return res;
      }
      return response(405, ["Allow: GET, POST", plain], "/login only takes GET or POST.", "", "warn");
    }

    if (path === "/requests") {
      var note = "";
      var tone = "ok";
      if (sid && !room) {
        note = "The tablet sent sid=" + sid + ", but the website has no session with that number. As far as it knows, you're a stranger.";
        tone = "bad";
      } else if (!sid) {
        note = "No cookie, no session: the website can't tell who is asking.";
        tone = "bad";
      }
      if (method === "GET") {
        res = room
          ? response(200, [plain], "Room " + room + ": " + S.requests + " request" + (S.requests === 1 ? "" : "s") + " on file.", "The cookie matched a session, so the website knows it's room 412.", "ok")
          : response(200, [plain], "Hello, guest. I don't know who you are.", note, tone);
      } else if (method === "POST") {
        if (room) {
          S.requests += 1;
          res = response(200, [plain], "Slip printed: ROOM " + room + ", extra blanket.", "", "ok");
        } else {
          res = response(200, [plain], "Slip printed: ROOM ???, extra blanket.", note + " A letter with no return address. A careful website would answer 401 Unauthorized here and ask the tablet to sign in, as it does for PUT and DELETE.", "bad");
        }
      } else if (method === "PUT") {
        res = room
          ? response(200, [plain], "Replaced: ROOM " + room + " now wants two pillows.", "", "ok")
          : response(401, [plain], "Please sign in first.", note + " Changing a room's requests needs a valid session, so the website answers 401 Unauthorized: sign in and try again.", "warn");
      } else {
        if (room) {
          S.requests = 0;
          res = response(200, [plain], "Cancelled every request for room " + room + ".", "", "ok");
        } else {
          res = response(401, [plain], "Please sign in first.", note + " Cancelling a room's requests needs a valid session, so the website answers 401 Unauthorized: sign in and try again.", "warn");
        }
      }
      res.lookup = !!sid;
      return res;
    }

    if (path === "/spa") {
      return response(301, ["Location: /wellness"], "(empty: the page has moved)",
        "Look elsewhere: the spa page moved for good. A browser would now ask for /wellness.", "");
    }
    if (path === "/wellness") {
      if (method === "GET") return response(200, [plain], "Spa: open 7 AM to 9 PM.", "", "ok");
      return response(405, ["Allow: GET", plain], "/wellness only takes GET.", "", "warn");
    }
    if (path === "/minibar") {
      return response(404, [plain], "Nothing here. The minibar page was removed.", "Your letter was fine, but there's no such page.", "warn");
    }
    return response(500, [plain], "Something broke inside the website.",
      "The invoice code failed while answering. Not your fault, and resending the same letter won't fix it.", "bad");
  }

  /* ---------- controls ---------- */

  function send(api) {
    var S = api.state;
    var method = S.method;
    var path = S.path;
    var sid = S.sendCookie && S.jar ? S.jar : null;

    api.node("req").text("label", method + " " + path);
    api.node("req").text("sub", sid ? "Cookie: sid=" + sid : "Cookie: (none)");

    if (sid) {
      api.log(method + " " + path + ", with Cookie: sid=" + sid + ".", "");
    } else if (S.jar) {
      api.log(method + " " + path + ". The tablet has a cookie but you told it not to send it, so this letter carries no cookie: no return address.", "warn");
    } else {
      api.log(method + " " + path + ". This letter carries no cookie yet, because the tablet hasn't signed in.", "");
    }

    var res = handle(api, method, path, sid);
    var dotPath = res.lookup ? ["tablet", "server", "store", "server", "tablet"] : ["tablet", "server", "tablet"];
    var fam = family(res.code);
    var dot = api.dot({
      path: dotPath,
      cls: "dot-req",
      r: 5,
      speed: pathLength(dotPath) / REPLY,
      onArrive: function (d, wp) {
        if (wp === "server") d.cls(fam === 2 ? "dot-ok" : fam === 3 ? "dot-accent" : fam === 4 ? "dot-wait" : "dot-bad");
      }
    });
    var session = S.session;
    api.after(REPLY, function () {
      if (api.state.session !== session) return;
      showResponse(api, res);
    });
    return dot;
  }

  function restart(api) {
    var S = api.state;
    if (api.clock < S.downUntil) return;
    S.downUntil = api.clock + RESTART;
    S.ctl.restart.disable(true);
    if (S.store === "memory") {
      var n = sessionCount(S);
      S.sessions = {};
      api.log("The website restarts. Every session in its memory is gone (" + n + " wiped). For " + RESTART + " seconds the proxy in front of it answers 503.", "bad");
    } else {
      api.log("The website restarts. The sessions live in the database, so they all survive. For " + RESTART + " seconds the proxy in front of it answers 503.", "warn");
    }
    render(api);
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    tablet: function (S) {
      return "<strong>Room 412's tablet, the client.</strong> It writes the letters: a method, a path and headers. After sign-in it keeps the cookie the website handed it (" + (S.jar ? "sid=" + S.jar : "none yet") + ") and, if sending is on, shows it on every letter in a Cookie header.";
    },
    server: function () {
      return "<strong>The hotel website, the server.</strong> It answers every letter with a status code, headers and a body, and remembers nothing between letters on its own. To know who's asking, it looks the cookie up in its session memory. It allows " + LIMIT + " requests in " + WINDOW + " seconds and answers 429 after that. While it restarts, a proxy in front of it answers 503.";
    },
    store: function (S) {
      return "<strong>Session memory.</strong> The website's half of the ticket: which cookie number belongs to which room. Right now it lives " + (S.store === "db" ? "in the hotel's database, which survives restarts." : "in the website's own memory, which a restart wipes.");
    },
    req: function () {
      return "<strong>The last request.</strong> The method and path, then the Cookie header if the tablet sent one. A letter with no cookie has no return address.";
    },
    status: function () {
      return "<strong>Status code.</strong> The first digit is the family: 2xx it worked, 3xx look elsewhere, 4xx a problem with your request, 5xx a problem on the server's side. 401 Unauthorized means the website doesn't know who you are: sign in again.";
    },
    headers: function () {
      return "<strong>Headers.</strong> Extra lines on the response: Set-Cookie hands over a cookie, Location says where a page moved, Retry-After says how long to wait, Allow lists the methods a path accepts, and Content-Type says what the body is.";
    },
    body: function () {
      return "<strong>Body.</strong> The letter itself: the page, the message or the data.";
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s1e04", {
    diagram: DIAGRAM,

    setup: function (api) {
      var S = api.state;
      S.session = {};
      S.method = "POST";
      S.path = "/login";
      S.sendCookie = true;
      S.jar = null;
      S.sessions = {};
      S.store = "memory";
      S.usedFirst = false;
      S.requests = 0;
      S.recent = [];
      S.downUntil = -1;
      S.count = { 2: 0, 3: 0, 4: 0, 5: 0 };
      api.speed = SPEED;
      api.clock = START;

      S.ctl = {};
      S.ctl.method = api.control.select("method", "Method", METHODS.map(function (m) { return { value: m, label: m }; }), "POST", function (v) {
        S.method = String(v);
      });
      S.ctl.path = api.control.select("path", "Path", PATHS.map(function (p) { return { value: p, label: p }; }), "/login", function (v) {
        S.path = String(v);
      });
      S.ctl.cookie = api.control.toggle("cookie", "Send my cookie", true, function (on) {
        S.sendCookie = !!on;
        api.log(on ? "The tablet will show its cookie on every letter." : "The tablet will send letters without its cookie.", on ? "" : "warn");
        render(api);
      });
      S.ctl.send = api.control.button("send", "Send the request", function () { send(api); }, { tone: "primary", wide: true });
      S.ctl.restart = api.control.button("restart", "Restart the website (like 3:00 AM)", function () { restart(api); }, { tone: "danger" });
      S.ctl.store = api.control.toggle("store", "Keep sessions in the database", false, function (on) {
        S.store = on ? "db" : "memory";
        api.log(on ? "Sessions now live in the hotel's database. A restart won't touch them." : "Sessions now live in the website's memory again. A restart will wipe them.", on ? "ok" : "warn");
        render(api);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); }, { tone: "ghost" });

      S.stat = {
        s2: api.stat("s2", "2xx it worked", "ok"),
        s3: api.stat("s3", "3xx look elsewhere", ""),
        s4: api.stat("s4", "4xx your request", "warn"),
        s5: api.stat("s5", "5xx server side", "bad")
      };
      updateStats(api);
      render(api);

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");
      api.log("02:58. Room 412's tablet hasn't signed in yet. The website keeps its sessions in its own memory and restarts every night at 3:00.", "");
    },

    step: function (api) {
      var S = api.state;
      if (S.downUntil > 0 && api.clock >= S.downUntil) {
        S.downUntil = -1;
        S.ctl.restart.disable(false);
        api.log("The website is back up." + (S.store === "memory" ? " Its session memory starts empty." : " Its sessions are waiting in the database."), "");
        render(api);
      }
    },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      function body() { return t.node("body").text.sub; }
      function status() { return t.node("status").text.label; }
      function hdr() { var h = t.node("headers").text; return h.sub + " | " + h.meta; }
      async function send(method, path) {
        t.set("method", method);
        t.set("path", path);
        t.click("send");
        await t.run(2.5);
      }

      // 1. Signing in: 200 and a cookie.
      await send("POST", "/login");
      t.expect(status() === "200 OK" && hdr().indexOf("Set-Cookie: sid=" + FIRST_SID) >= 0, "signing in returns 200 OK with a Set-Cookie header");

      // 2. With the cookie, the website knows room 412.
      await send("GET", "/requests");
      t.expect(body().indexOf("Room 412") === 0, "with the cookie, the website remembers room 412");

      // 3. Without the cookie, the same request comes from a stranger.
      t.set("cookie", false);
      await send("GET", "/requests");
      t.expect(body().indexOf("guest") >= 0 && t.logText().indexOf("no cookie") >= 0, "without the cookie, the website has no idea who is asking");
      await send("POST", "/requests");
      t.expect(body().indexOf("ROOM ???") >= 0, "a POST with no cookie prints a slip with no room: a letter with no return address");
      t.set("cookie", true);

      // 4. Status families: 301, 404, 500.
      await send("GET", "/spa");
      t.expect(status().indexOf("301") === 0 && hdr().indexOf("Location: /wellness") >= 0, "a moved page answers 301 with a Location header");
      await send("GET", "/minibar");
      t.expect(status().indexOf("404") === 0, "a path with nothing behind it answers 404");
      await send("GET", "/invoice");
      t.expect(status().indexOf("500") === 0, "a bug inside the website answers 500");
      t.expect(n("s2") === 4 && n("s3") === 1 && n("s4") === 1 && n("s5") === 1, "every response is counted in its status family");

      // 5. Rate limit: the sixth request inside 10 seconds gets 429 with Retry-After.
      await t.run(4);
      t.set("method", "GET");
      t.set("path", "/wellness");
      for (var i = 0; i < 6; i++) t.click("send");
      await t.run(2.5);
      t.expect(status().indexOf("429") === 0 && hdr().indexOf("Retry-After") >= 0 && n("s4") === 2, "the sixth request inside 10 seconds gets 429 Too Many Requests with Retry-After");

      // 6. Restart with sessions in memory: 503 while down, then the cookie matches nothing.
      await t.run(4);
      t.click("restart");
      await send("GET", "/requests");
      t.expect(status().indexOf("503") === 0 && hdr().indexOf("Retry-After: 30") >= 0, "during the restart the website answers 503 with Retry-After: 30");
      await t.run(10);
      await send("GET", "/requests");
      t.expect(body().indexOf("guest") >= 0 && t.logText().indexOf("no session with that number") >= 0, "after the restart the same cookie matches nothing: the website forgot room 412");

      // 7. The senior fix: sessions in the database survive the restart.
      t.click("store");
      await send("POST", "/login");
      t.click("restart");
      await t.run(11);
      await send("GET", "/requests");
      t.expect(body().indexOf("Room 412") === 0, "with sessions in the database, the cookie still works after a restart");

      // 8. No valid session: changing a room's requests answers 401 Unauthorized, not 404.
      await t.run(4);
      t.set("cookie", false);
      var u4 = n("s4");
      await send("PUT", "/requests");
      t.expect(status() === "401 Unauthorized" && n("s4") === u4 + 1 && t.logText().indexOf("sign in and try again") >= 0,
        "a PUT with no valid session answers 401 Unauthorized and asks the tablet to sign in");
    }
  });
})();
