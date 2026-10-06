/* sims/s1e06-v1.0.1.js  (published as sims/s1e06.js)
   Case s1e06 "The Room With Too Many Doors": an API console for the museum's collection API.

   CHANGELOG
   v1.0.1 (2026-10-06) review fixes: a door's JSON may now carry its catalog number ("catalog":
     "cdm-001"). A new body preset, the Ashby door with its catalog number, shows the case's fix: a
     POST whose catalog number is already filed gets 409 Conflict and creates nothing. A POST with a
     new catalog number is filed as before and keeps the number. PUT refuses (400) a body whose
     catalog number doesn't match the address, and PATCH refuses (400) to change a door's catalog
     number. The existing presets and the 3 AM job still send no catalog number, as in the story, so
     their POSTs keep making copies. selfTest adds one check: the catalog preset POSTed to /v1/doors
     gets 409 Conflict and the door list doesn't change.
   v1.0.0 (2026-10-06) first version: a small diagram (you, the 3 AM import job, the collection API,
     the door list, the Room 3 kiosk) above a request builder: an editable path, an editable JSON body,
     the API's response and the stored door list. The API is a REST collection at /v1/doors with
     GET, POST, PUT, PATCH and DELETE, a ?room= or ?material= filter, 201/200/204/400/404/405 answers,
     and no /v2/. Controls: method, endpoint, body (presets that fill the editable fields), send,
     import (the 3 AM job), importput (job uses PUT instead of POST), reset. Stats: requests, created,
     duplicates, errors. selfTest covers GET, PUT twice, POST twice, DELETE twice, bad JSON, the job
     with POST and with PUT, PATCH plus a query filter, and a version that doesn't exist.

   Notes for anyone copying this file:
   - Widget-style sim: the request builder is plain DOM built inside api.root, after the diagram, and
     rebuilt by setup on every reset. Anything the user typed goes into textContent or .value, never
     innerHTML or api.info.
   - The presets in the side panel only fill the editable path and body fields, so the self-test can
     drive the sim through stable control ids while a person can still type anything.
   - The museum is the story's: nine doors, each at an address made from its catalog number. The job
     posts the curator's nine spreadsheet rows, so three runs give 18, 27 and 36 doors and the third
     run files d-19 to d-27, as in the post's log.
*/
(function () {
  "use strict";

  var DOT_SPEED = 560;

  // The curator's spreadsheet, in order. The first run of the job files these as d-1 to d-9.
  var SHEET = [
    { id: "cdm-001", name: "Ashby front door", year: 1891, material: "oak" },
    { id: "cdm-002", name: "Mercer cellar door", year: 1874, material: "elm" },
    { id: "cdm-003", name: "Hollis chapel door", year: 1862, material: "oak" },
    { id: "cdm-004", name: "Vane nursery door", year: 1903, material: "pine" },
    { id: "cdm-005", name: "Pell kitchen door", year: 1888, material: "pine" },
    { id: "cdm-006", name: "Orrin attic door", year: 1910, material: "pine" },
    { id: "cdm-007", name: "Sable garden door", year: 1897, material: "iron" },
    { id: "cdm-008", name: "Calder study door", year: 1869, material: "walnut" },
    { id: "cdm-009", name: "Wren back door", year: 1921, material: "oak" }
  ];
  var ROOM = 3;

  var METHODS = [
    { value: "GET", label: "GET (read)" },
    { value: "POST", label: "POST (add new)" },
    { value: "PUT", label: "PUT (store at this address)" },
    { value: "PATCH", label: "PATCH (change some fields)" },
    { value: "DELETE", label: "DELETE (remove)" }
  ];

  var ENDPOINTS = [
    { value: "/v1/doors", label: "/v1/doors (the collection)" },
    { value: "/v1/doors?room=3", label: "/v1/doors?room=3 (a filter)" },
    { value: "/v1/doors/cdm-001", label: "/v1/doors/cdm-001 (Ashby door)" },
    { value: "/v1/doors/cdm-010", label: "/v1/doors/cdm-010 (not filed yet)" },
    { value: "/v1/doors/d-1", label: "/v1/doors/d-1 (the first copy)" },
    { value: "/v2/doors", label: "/v2/doors (a version that doesn't exist)" }
  ];

  var BODIES = {
    ashby: "{\n  \"name\": \"Ashby front door\",\n  \"year\": 1891,\n  \"material\": \"oak\",\n  \"room\": 3\n}",
    ashbycat: "{\n  \"catalog\": \"cdm-001\",\n  \"name\": \"Ashby front door\",\n  \"year\": 1891,\n  \"material\": \"oak\",\n  \"room\": 3\n}",
    tenth: "{\n  \"name\": \"Vell Street door\",\n  \"year\": 1899,\n  \"material\": \"oak\",\n  \"room\": 3\n}",
    move: "{\n  \"room\": 5\n}",
    broken: "{\n  \"name\": \"Ashby front door\",\n  \"year\": 1891\n",
    none: ""
  };
  var BODY_OPTIONS = [
    { value: "ashby", label: "Ashby front door (whole door)" },
    { value: "ashbycat", label: "Ashby front door with its catalog number" },
    { value: "tenth", label: "Vell Street door (the tenth door)" },
    { value: "move", label: "{\"room\": 5} (one field)" },
    { value: "broken", label: "Broken JSON (missing a brace)" },
    { value: "none", label: "No body" }
  ];

  var STATUS_TEXT = {
    200: "OK", 201: "Created", 204: "No Content", 400: "Bad Request",
    404: "Not Found", 405: "Method Not Allowed", 409: "Conflict"
  };

  /* Layout checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px, edge 11px),
     including the longest text each box can show ("last: 405 Method Not Allowed" fits 200px). */
  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 300,
    aria: "Museum API sim. You, at a laptop, and the 3 AM import job both send requests to the collection API. The API reads and writes the door list. The Room 3 kiosk asks the API for the doors in room 3 and shows how many it got.",
    nodes: [
      { id: "console", label: "You (Theo)", sub: "sending by hand", x: 110, y: 80, w: 180, h: 52, shape: "box", tone: "" },
      { id: "job", label: "3 AM import job", sub: "uses POST", x: 110, y: 220, w: 180, h: 52, shape: "box", tone: "warn" },
      { id: "api", label: "Collection API", sub: "/v1/doors", meta: "last: none yet", x: 370, y: 150, w: 200, h: 62, shape: "box", tone: "" },
      { id: "coll", label: "Door list", sub: "9 doors", meta: "0 copies", x: 630, y: 150, w: 180, h: 72, shape: "db", tone: "ok" },
      { id: "kiosk", label: "Room 3 kiosk", sub: "says 9 doors", x: 630, y: 270, w: 180, h: 52, shape: "box", tone: "ok" }
    ],
    edges: [
      { from: "console", to: "api", label: "request" },
      { from: "job", to: "api", label: "nightly" },
      { from: "api", to: "coll", label: "writes" },
      { from: "kiosk", to: "api", label: "GET ?room=3" }
    ]
  };

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  function copyDoor(d) {
    var o = { id: d.id };
    ["catalog", "name", "year", "material", "room"].forEach(function (k) { if (d[k] !== undefined) o[k] = d[k]; });
    return o;
  }

  // The catalog number a body carries, lowercased, or null when it carries none.
  function catalogOf(v) {
    return v && v.catalog !== undefined ? String(v.catalog).trim().toLowerCase() : null;
  }

  // Is a door with this catalog number already filed? The nine original doors and any door stored
  // with PUT live at /v1/doors/{catalog number}; a POSTed door keeps the number in its catalog field.
  function catalogTaken(doors, cat) {
    for (var i = 0; i < doors.length; i++) {
      if (doors[i].id === cat || doors[i].catalog === cat) return true;
    }
    return false;
  }

  function startDoors() {
    return SHEET.map(function (r) { return { id: r.id, name: r.name, year: r.year, material: r.material, room: ROOM }; });
  }

  function rowBody(r) {
    return JSON.stringify({ name: r.name, year: r.year, material: r.material, room: ROOM });
  }

  function find(doors, id) {
    for (var i = 0; i < doors.length; i++) if (doors[i].id === id) return i;
    return -1;
  }

  function sameName(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }

  // Is there already another door with this name?
  function nameTaken(doors, name, exceptId) {
    for (var i = 0; i < doors.length; i++) {
      if (doors[i].id !== exceptId && sameName(doors[i].name, name)) return true;
    }
    return false;
  }

  function copies(doors) {
    var seen = {}, n = 0;
    doors.forEach(function (d) {
      var k = String(d.name).toLowerCase();
      if (seen[k]) n += 1; else seen[k] = true;
    });
    return n;
  }

  function inRoom(doors, room) {
    return doors.filter(function (d) { return d.room === room; });
  }

  function parseQuery(q) {
    var out = {};
    if (!q) return out;
    q.split("&").forEach(function (part) {
      if (!part) return;
      var i = part.indexOf("=");
      var k = i >= 0 ? part.slice(0, i) : part;
      var v = i >= 0 ? part.slice(i + 1) : "";
      try { k = decodeURIComponent(k); v = decodeURIComponent(v); } catch (e) { /* keep it raw */ }
      out[k] = v;
    });
    return out;
  }

  function route(raw) {
    var p = String(raw === undefined || raw === null ? "" : raw).trim();
    var q = "";
    var qi = p.indexOf("?");
    if (qi >= 0) { q = p.slice(qi + 1); p = p.slice(0, qi); }
    if (p.length > 1 && p.charAt(p.length - 1) === "/") p = p.slice(0, -1);
    var query = parseQuery(q);
    var v = /^\/(v[0-9]+)(\/|$)/.exec(p);
    if (v && v[1] !== "v1") return { kind: "version", version: v[1], path: p, query: query };
    if (p === "/v1/doors") return { kind: "collection", path: p, query: query };
    var m = /^\/v1\/doors\/([A-Za-z0-9_-]+)$/.exec(p);
    if (m) return { kind: "item", id: m[1].toLowerCase(), path: p, query: query };
    return { kind: "none", path: p || "(empty)", query: query };
  }

  // Parses a JSON body into a door's fields. Returns { value } or { error }.
  function parseBody(text, needName) {
    var t = String(text === undefined || text === null ? "" : text).trim();
    if (!t) return { error: "This request needs a JSON body, and the body is empty." };
    var v;
    try { v = JSON.parse(t); } catch (e) { return { error: "The body is not valid JSON, so the API can't read it." }; }
    if (!v || typeof v !== "object" || Array.isArray(v)) return { error: "The body must be one JSON object, like {\"name\": \"...\"}." };
    if (needName && !(typeof v.name === "string" && v.name.trim())) {
      return { error: "A whole door needs a name. PUT and POST replace or create the whole door, so send every field." };
    }
    if (v.name !== undefined && typeof v.name !== "string") return { error: "name must be text." };
    if (v.year !== undefined && typeof v.year !== "number") return { error: "year must be a number." };
    if (v.room !== undefined && typeof v.room !== "number") return { error: "room must be a number." };
    if (v.material !== undefined && typeof v.material !== "string") return { error: "material must be text." };
    if (v.catalog !== undefined && !(typeof v.catalog === "string" && v.catalog.trim())) return { error: "catalog must be text, like \"cdm-001\"." };
    return { value: v };
  }

  function fill(door, v) {
    ["name", "year", "material", "room"].forEach(function (k) { if (v[k] !== undefined) door[k] = v[k]; });
    return door;
  }

  function answer(status, body, extra) {
    var o = { status: status, body: body === undefined ? null : body, headers: {}, note: "", created: false, duplicate: false };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  }

  /* ---------- the API ---------- */

  function handle(S, method, rawPath, bodyText) {
    var r = route(rawPath);
    var doors = S.doors;

    if (r.kind === "version") {
      return answer(404, { error: "There is no " + r.version + " of this API. Version 1 is the only one, and every kiosk is built for it." },
        { note: "There is no " + r.version + " yet: the version is part of the address, and only v1 exists." });
    }
    if (r.kind === "none") {
      return answer(404, { error: "No endpoint at " + r.path + ". Try /v1/doors or /v1/doors/{id}." }, { note: "Nothing lives at that address." });
    }

    if (r.kind === "collection") {
      if (method === "GET") {
        var list = doors.slice();
        var filters = [];
        if (r.query.room !== undefined) {
          var room = Number(r.query.room);
          list = list.filter(function (d) { return d.room === room; });
          filters.push("room " + r.query.room);
        }
        if (r.query.material !== undefined) {
          list = list.filter(function (d) { return sameName(d.material, r.query.material); });
          filters.push(r.query.material);
        }
        return answer(200, list.map(copyDoor), {
          note: list.length + " door" + (list.length === 1 ? "" : "s") + (filters.length ? " match the filter (" + filters.join(", ") + ")" : " in the collection") + ". Nothing changed."
        });
      }
      if (method === "POST") {
        var p = parseBody(bodyText, true);
        if (p.error) return answer(400, { error: p.error }, { note: p.error });
        var cat = catalogOf(p.value);
        if (cat && catalogTaken(doors, cat)) {
          return answer(409, { error: "Catalog number " + cat + " is already filed." }, {
            note: "The body carries catalog number " + cat + ", and the API already has that door, so it refuses to file a copy. Nothing changed."
          });
        }
        var id = "d-" + S.nextId;
        S.nextId += 1;
        var dup = nameTaken(doors, p.value.name, id);
        var door = fill({ id: id }, p.value);
        if (cat) door.catalog = cat;
        doors.push(door);
        return answer(201, copyDoor(door), {
          headers: { Location: "/v1/doors/" + id },
          created: true,
          duplicate: dup,
          note: dup
            ? "A new door at a new address, " + id + ". There was already a " + door.name + ", so now there are two."
            : "A new door at a new address, " + id + "."
        });
      }
      if (method === "PUT") return answer(405, { error: "PUT needs the address of one door, like /v1/doors/cdm-001." }, { note: "PUT stores one door at one address, so it needs that address." });
      if (method === "PATCH") return answer(405, { error: "PATCH needs the address of one door." }, { note: "PATCH changes one door, so it needs that door's address." });
      if (method === "DELETE") return answer(405, { error: "This API won't delete the whole collection in one request." }, { note: "Deleting every door in one request isn't allowed here." });
    }

    // One door.
    var at = find(doors, r.id);
    var path = "/v1/doors/" + r.id;
    if (method === "GET") {
      if (at < 0) return answer(404, { error: "No door at " + path + "." }, { note: "Nothing is filed at that address." });
      return answer(200, copyDoor(doors[at]), { note: "Here is the door at that address. Nothing changed." });
    }
    if (method === "POST") {
      return answer(405, { error: "POST adds to a collection, like /v1/doors. To store a door at this exact address, use PUT." },
        { note: "POST goes to the collection; the API picks the address." });
    }
    if (method === "PUT") {
      var q = parseBody(bodyText, true);
      if (q.error) return answer(400, { error: q.error }, { note: q.error });
      var qc = catalogOf(q.value);
      if (qc && qc !== r.id) {
        return answer(400, { error: "The body's catalog number, " + qc + ", doesn't match the address, " + path + "." },
          { note: "PUT stores the door at the address you named, so a catalog number in the body must match it." });
      }
      if (at >= 0) {
        doors[at] = fill({ id: r.id }, q.value);
        return answer(200, copyDoor(doors[at]), { note: "Replaced the door at " + path + " with what you sent. Still " + doors.length + " doors." });
      }
      var dupPut = nameTaken(doors, q.value.name, r.id);
      var made = fill({ id: r.id }, q.value);
      doors.push(made);
      return answer(201, copyDoor(made), {
        headers: { Location: path },
        created: true,
        duplicate: dupPut,
        note: "Nothing was at " + path + ", so the API created the door there." + (dupPut ? " Another door already has that name, so it's a copy." : "")
      });
    }
    if (method === "PATCH") {
      if (at < 0) return answer(404, { error: "No door at " + path + " to change." }, { note: "PATCH can only change a door that exists." });
      var pp = parseBody(bodyText, false);
      if (pp.error) return answer(400, { error: pp.error }, { note: pp.error });
      var pc = catalogOf(pp.value);
      if (pc && pc !== (doors[at].catalog || doors[at].id)) {
        return answer(400, { error: "A door's catalog number names it, so PATCH can't change it." },
          { note: "The catalog number is the door's stable ID. Changing it would break every link to the door." });
      }
      fill(doors[at], pp.value);
      return answer(200, copyDoor(doors[at]), { note: "Changed only the fields you sent. Everything else about the door stayed." });
    }
    if (method === "DELETE") {
      if (at < 0) return answer(404, { error: "No door at " + path + "." }, { note: "Already gone. The collection is the same as after the first DELETE: that's idempotent, even though the answer differs." });
      doors.splice(at, 1);
      return answer(204, null, { note: "Removed. " + doors.length + " doors left." });
    }
    return answer(405, { error: "Unknown method." }, { note: "Unknown method." });
  }

  /* ---------- counting and drawing ---------- */

  function statusLine(st) { return st + " " + (STATUS_TEXT[st] || ""); }

  function responseText(out) {
    var lines = ["HTTP/1.1 " + statusLine(out.status)];
    Object.keys(out.headers).forEach(function (k) { lines.push(k + ": " + out.headers[k]); });
    if (out.body !== null) {
      lines.push("Content-Type: application/json");
      lines.push("");
      lines.push(JSON.stringify(out.body, null, 2));
    }
    return lines.join("\n");
  }

  function record(api, out) {
    var S = api.state;
    S.count.requests += 1;
    if (out.created) S.count.created += 1;
    if (out.duplicate) S.count.duplicates += 1;
    if (out.status >= 400) S.count.errors += 1;
  }

  function updateStats(api) {
    var S = api.state;
    S.stat.requests(S.count.requests);
    S.stat.created(S.count.created);
    S.stat.duplicates(S.count.duplicates);
    S.stat.errors(S.count.errors);
  }

  function listText(doors) {
    if (!doors.length) return "(empty)";
    var seen = {};
    return doors.map(function (d) {
      var k = String(d.name).toLowerCase();
      var copy = seen[k];
      seen[k] = true;
      var id = (d.id + "         ").slice(0, 9);
      return id + " " + d.name + (d.room !== undefined ? ", room " + d.room : ", no room") + (copy ? "  (copy)" : "");
    }).join("\n");
  }

  function draw(api) {
    var S = api.state;
    var c = copies(S.doors);
    var room = inRoom(S.doors, ROOM);
    api.node("coll").text("sub", S.doors.length + " doors");
    api.node("coll").text("meta", c + (c === 1 ? " copy" : " copies"));
    api.node("coll").set(c ? "warn" : "ok");
    api.node("kiosk").text("sub", "says " + room.length + " doors");
    api.node("kiosk").set(copies(room) ? "bad" : "ok");
    api.node("job").text("sub", S.importPut ? "uses PUT" : "uses POST");
    api.node("job").set(S.importPut ? "ok" : "warn");
    if (S.ui) S.ui.list.textContent = listText(S.doors);
    updateStats(api);
  }

  function tone(out) {
    if (out.status >= 400) return "bad";
    if (out.duplicate) return "warn";
    return "ok";
  }

  // A refused request turns red at the API and comes straight back. Anything else goes on to the door
  // list and comes back green, or red-orange when it filed a copy.
  function sendDot(api, from, out, delay) {
    var refused = out.status >= 400;
    var go = function () {
      api.dot({
        path: refused ? [from, "api", from] : [from, "api", "coll", "api", from],
        cls: "dot-req",
        r: 5,
        speed: DOT_SPEED,
        onArrive: function (d, wp) {
          if (!d) return;
          if (refused && wp === "api") d.cls("dot-fail");
          if (!refused && wp === "coll") d.cls(out.duplicate ? "dot-bad" : "dot-ok");
        }
      });
    };
    if (delay > 0) api.after(delay, go); else go();
  }

  /* ---------- controls ---------- */

  function send(api) {
    var S = api.state;
    var method = String(S.ctl.method.value || "GET");
    var path = S.ui.path.value;
    var body = S.ui.body.value;
    var out = handle(S, method, path, body);
    record(api, out);
    S.ui.out.textContent = responseText(out);
    api.node("api").text("meta", "last: " + statusLine(out.status));
    api.node("api").set(out.status >= 400 ? "bad" : out.duplicate ? "warn" : "ok");
    var shown = String(path).trim() || "(empty)";
    api.log(method + " " + shown + ": " + statusLine(out.status) + ". " + out.note, tone(out));
    draw(api);
    sendDot(api, "console", out, 0);
  }

  function runImport(api) {
    var S = api.state;
    var put = S.importPut;
    var before = S.doors.length;
    var codes = {};
    var lines = [];
    SHEET.forEach(function (row, i) {
      var method = put ? "PUT" : "POST";
      var path = put ? "/v1/doors/" + row.id : "/v1/doors";
      var out = handle(S, method, path, rowBody(row));
      record(api, out);
      codes[out.status] = (codes[out.status] || 0) + 1;
      lines.push(method + " " + path + "  " + row.name + "  ->  " + statusLine(out.status) +
        (out.headers.Location && method === "POST" ? "  " + out.headers.Location : ""));
      sendDot(api, "job", out, i * 0.18);
    });
    S.runs += 1;
    var summary = Object.keys(codes).map(function (k) { return codes[k] + " x " + statusLine(Number(k)); }).join(", ");
    var after = S.doors.length;
    S.ui.out.textContent = "3 AM job, run " + S.runs + "\n\n" + lines.join("\n");
    api.node("api").text("meta", "last: " + statusLine(put ? 200 : 201));
    api.node("api").set(after > before ? "warn" : "ok");
    api.log("3 AM job, run " + S.runs + ": 9 " + (put ? "PUTs" : "POSTs") + ", " + summary + ". The list went from " + before + " to " + after + " doors." +
      (after > before ? " The spreadsheet didn't change. The list did." : " Same nine rows, same nine addresses, nothing new."),
      after > before ? "warn" : "ok");
    draw(api);
  }

  /* ---------- the request builder (plain DOM inside api.root) ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text !== undefined && text !== null) e.textContent = text;
      return e;
    }
    var field = "width:100%;box-sizing:border-box;font-family:var(--f-ui);font-size:13px;color:var(--fg);" +
      "background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r);padding:8px;";
    var labelStyle = "display:block;color:var(--muted);font-family:var(--f-ui);font-size:12px;margin:0 0 4px;";
    var paneStyle = "margin:0;max-height:240px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:12px;";

    var box = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:12px;min-width:0;");

    var req = el("div", "min-width:0;");
    var lp = el("label", labelStyle, "Address (path, with any query parameters)");
    lp.setAttribute("for", "s1e06-path");
    var path = el("input", field);
    path.type = "text";
    path.id = "s1e06-path";
    path.setAttribute("autocomplete", "off");
    path.setAttribute("spellcheck", "false");
    var lb = el("label", labelStyle + "margin-top:10px;", "JSON body (POST, PUT and PATCH send one)");
    lb.setAttribute("for", "s1e06-body");
    var body = el("textarea", field + "resize:vertical;");
    body.id = "s1e06-body";
    body.rows = 7;
    body.setAttribute("spellcheck", "false");
    req.appendChild(lp);
    req.appendChild(path);
    req.appendChild(lb);
    req.appendChild(body);

    var res = el("div", "min-width:0;");
    res.appendChild(el("p", labelStyle, "The API's answer"));
    var out = el("pre", paneStyle, "Nothing sent yet. Pick a method and an endpoint, then press Send.");
    out.className = "logline";
    out.setAttribute("aria-live", "polite");
    out.setAttribute("tabindex", "0");
    res.appendChild(out);

    var lst = el("div", "min-width:0;");
    lst.appendChild(el("p", labelStyle, "The door list (what the API has stored)"));
    var list = el("pre", paneStyle, "");
    list.className = "logline";
    list.setAttribute("tabindex", "0");
    lst.appendChild(list);

    box.appendChild(req);
    box.appendChild(res);
    box.appendChild(lst);
    api.root.appendChild(box);
    return { path: path, body: body, out: out, list: list };
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    console: function () {
      return "<strong>You (Theo).</strong> Sending requests to the API by hand. A request is a method (what to do), a path (which resource) and sometimes a JSON body (the door itself). Edit the fields under the diagram and press <em>Send</em>.";
    },
    job: function (S) {
      return "<strong>3 AM import job.</strong> Reads the curator's spreadsheet, nine rows, and sends each row to the API. Right now it uses <strong>" + (S.importPut ? "PUT to /v1/doors/{catalog number}" : "POST to /v1/doors") + "</strong>. " +
        (S.importPut ? "Each row lands on its own fixed address, so running it again changes nothing." : "Each POST means \"add a new door\", so every run adds nine more.");
    },
    api: function () {
      return "<strong>Collection API.</strong> The front desk for programs. It checks each request, reads or changes the door list, and answers with a status code and JSON. Endpoints: GET, POST on /v1/doors; GET, PUT, PATCH, DELETE on /v1/doors/{id}. Filters: ?room= and ?material=. A POST whose body carries a catalog number that is already filed gets 409 Conflict. A POST without one can't be checked, so it files a new door.";
    },
    coll: function (S) {
      return "<strong>Door list.</strong> What the API has stored: " + S.doors.length + " doors, " + copies(S.doors) + " of them copies of a door already listed. The real Room 3 has nine. The full list is under the diagram.";
    },
    kiosk: function (S) {
      return "<strong>Room 3 kiosk.</strong> Sends GET /v1/doors?room=3 and draws whatever comes back: right now " + inRoom(S.doors, ROOM).length + " doors. It has no way to know which ones are real.";
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s1e06", {
    diagram: DIAGRAM,

    setup: function (api) {
      var S = api.state;
      S.doors = startDoors();
      S.nextId = 1;
      S.runs = 0;
      S.importPut = false;
      S.count = { requests: 0, created: 0, duplicates: 0, errors: 0 };
      S.ui = buildWidget(api);
      S.ui.path.value = "/v1/doors";
      S.ui.body.value = BODIES.none;

      S.ctl = {};
      // send() reads the method from this control's value, so the handler has nothing else to do.
      S.ctl.method = api.control.select("method", "Method", METHODS, "GET", function () {});
      S.ctl.endpoint = api.control.select("endpoint", "Endpoint (fills the address)", ENDPOINTS, "/v1/doors", function (v) {
        var val = v && v.target ? v.target.value : v;
        if (val === undefined || val === null) val = S.ctl.endpoint && S.ctl.endpoint.value;
        S.ui.path.value = String(val);
      });
      S.ctl.body = api.control.select("body", "Body (fills the JSON)", BODY_OPTIONS, "none", function (v) {
        var val = v && v.target ? v.target.value : v;
        if (val === undefined || val === null) val = S.ctl.body && S.ctl.body.value;
        if (Object.prototype.hasOwnProperty.call(BODIES, val)) S.ui.body.value = BODIES[val];
      });
      S.ctl.send = api.control.button("send", "Send", function () { send(api); }, { tone: "primary", wide: true });
      S.ctl.importBtn = api.control.button("import", "Run the 3 AM job", function () { runImport(api); });
      S.ctl.importput = api.control.toggle("importput", "Job uses PUT", false, function (on) {
        S.importPut = !!on;
        api.log(S.importPut
          ? "The job now sends PUT /v1/doors/{catalog number} for each row: a fixed address per door."
          : "The job is back to POST /v1/doors for each row: \"add a new door\", nine times.", S.importPut ? "ok" : "warn");
        draw(api);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        requests: api.stat("requests", "requests", ""),
        created: api.stat("created", "created (201)", "ok"),
        duplicates: api.stat("duplicates", "duplicates", "warn"),
        errors: api.stat("errors", "errors (4xx)", "bad")
      };
      draw(api);

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");
      api.log("Monday night. Nine doors, each at /v1/doors/{catalog number}. The 3 AM job hasn't run yet.", "");
    },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      function doors() { return num(t.node("coll").text.sub); }
      function kiosk() { return num(t.node("kiosk").text.sub); }
      function send(method, endpoint, body) {
        t.set("method", method);
        t.set("endpoint", endpoint);
        t.set("body", body);
        t.click("send");
      }

      // 1. Reading changes nothing.
      send("GET", "/v1/doors", "none");
      t.expect(n("requests") === 1 && n("errors") === 0 && doors() === 9, "GET /v1/doors reads the nine doors and changes nothing");
      t.expect(t.logText().indexOf("GET /v1/doors: 200 OK") >= 0, "the log shows the request and its 200 OK");

      // 2. PUT to an address you choose: the first creates, the second replaces.
      send("PUT", "/v1/doors/cdm-010", "tenth");
      send("PUT", "/v1/doors/cdm-010", "tenth");
      t.expect(n("created") === 1 && doors() === 10 && n("duplicates") === 0, "PUT twice to /v1/doors/cdm-010 creates one door, then replaces it");

      // 3. POST twice: two new doors, both copies of the Ashby door.
      send("POST", "/v1/doors", "ashby");
      send("POST", "/v1/doors", "ashby");
      t.expect(n("created") === 3 && n("duplicates") === 2 && doors() === 12, "POST twice creates two new doors, both duplicates");

      // 4. DELETE twice: same end state, different answer.
      send("DELETE", "/v1/doors/d-1", "none");
      var e0 = n("errors");
      send("DELETE", "/v1/doors/d-1", "none");
      t.expect(doors() === 11 && n("errors") === e0 + 1 && t.logText().indexOf("404 Not Found") >= 0, "a second DELETE leaves the list unchanged and answers 404");

      // 5. A body that isn't JSON.
      var c0 = n("created");
      send("POST", "/v1/doors", "broken");
      t.expect(n("created") === c0 && n("errors") === e0 + 2 && t.logText().indexOf("400 Bad Request") >= 0, "broken JSON gets 400 and creates nothing");

      // 6. The story's job: POST adds nine every run, PUT adds none.
      t.click("import");
      t.expect(doors() === 20 && n("created") === c0 + 9, "the 3 AM job with POST adds nine doors in one run");
      t.click("importput");
      t.click("import");
      t.click("import");
      t.expect(doors() === 20 && n("created") === c0 + 9, "with PUT the job can run twice more and nothing new appears");

      // 7. PATCH one field, then filter with a query parameter.
      var k0 = kiosk();
      send("PATCH", "/v1/doors/cdm-001", "move");
      send("GET", "/v1/doors?room=3", "none");
      t.expect(kiosk() === k0 - 1 && t.logText().indexOf("match the filter (room 3)") >= 0, "PATCH moves one door to room 5 and the ?room=3 filter leaves it out");

      // 8. A version that doesn't exist.
      send("GET", "/v2/doors", "none");
      t.expect(t.logText().indexOf("There is no v2") >= 0, "GET /v2/doors answers 404: only version 1 exists");

      // 9. The fix: a POST that carries a catalog number already filed is refused with 409 Conflict.
      var d9 = doors(), c9 = n("created"), e9 = n("errors");
      send("POST", "/v1/doors", "ashbycat");
      t.expect(doors() === d9 && n("created") === c9 && n("errors") === e9 + 1 && t.logText().indexOf("409 Conflict") >= 0,
        "a POST whose catalog number cdm-001 is already filed gets 409 Conflict and creates nothing");
    }
  });
})();
