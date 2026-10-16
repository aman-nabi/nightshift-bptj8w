/* sims/s8e11-v1.0.0.js  (published as sims/s8e11.js)
   Case s8e11 "Merge Without Asking": a merge lab for two thriller writers who share one manuscript.
   Nomvula writes nights in Johannesburg; Beckett writes days in Tucson, nine hours behind. Their
   writing app keeps a whole copy of the book on each laptop and syncs changes of the form "at
   position N, insert or delete this text". On Tuesday 2 March 2027 she deleted the first 12
   characters of chapter 9, paragraph 3, offline on a flight, while he inserted "never " at position
   40. Her laptop replayed his insert at position 40 of her shortened copy, 12 characters past where
   he meant, and the two laptops ended with different paragraphs.
   The learner sets the merge method, whether her laptop is offline, a chapter lock, and the night,
   then steps or plays the edits and reads both laptops' text with positions under it, where his
   insert meant to land and where it landed, whether the laptops match, and the words lost.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls merge method (replay positions, last save wins,
     sort by time typed, operational transformation through the server, CRDT with ids), her laptop
     offline (on, off), chapter lock (off, on), night (2 March, 13 April); Next step, Play to the
     end, Reset. Stats: time, laptops match, his insert on each laptop, her edit, words lost, edits
     blocked by the lock. selfTest: 12 assertions.

   Where every number comes from (conventions rule 14; the case is content/s8/s8e11-v1.0.0.json).
   All of it is given data stated in sim.lede; each result is checked by the selfTest.
   - Positions count characters (letters, spaces, full stops) from the start of the paragraph; the
     first is position 0.
   - Night of Tuesday 2 March 2027 (her time; his is 9 hours earlier). Paragraph before, 69
     characters: "Rain again. Kaja heard it. The door was locked. She had the only key."
     "Rain again. " is positions 0 to 11 (12 characters); "locked" starts at 40; "had" at 52.
     Her laptop offline from 20:15 (boarding) to 23:42 (home Wi-Fi).
     21:20 N-412, hers: delete 12 characters at position 0.
     21:26 B-388, his (12:26 his time): insert "never " at position 40, just before "locked".
     In her shortened copy (57 characters) "locked" starts at 28 and position 40 is "had", so
     replayed at 40 his word lands 12 characters late: "Kaja heard it. The door was locked. She
     never had the only key." His laptop replays her delete at 0, before his word, so his copy is
     right: "Kaja heard it. The door was never locked. She had the only key." (63 characters).
   - Night of Tuesday 13 April 2027 (the next flight, a longer edit each), starting from that 63-
     character paragraph on both laptops. Offline from 20:30 to 23:05.
     21:10 N-431, hers: insert "Then silence. " (14 characters) at position 0.
     21:31 B-405, his (12:31 his time): insert " Someone else had a key." (24 characters, 5 words)
     at position 63, the end. Meant: 101 characters, his sentence at 77. Replayed at 63 of her
     longer copy, it lands 14 characters early: "... She had Someone else had a key. the only key."
   - Last save wins: each laptop sends its whole paragraph; the server keeps the one that reaches
     it last and sends it to both. Hers reaches it at 23:42 (23:05), after his at 21:26 (21:31):
     his "never" (1 word) or his sentence (5 words) is lost.
   - Sort by time typed: every laptop rebuilds from the paragraph both last had, replaying every
     change in the order of the time it was typed. Hers (21:20, 21:10) comes before his, so his
     position still shifts: 12 late (night 1), 14 early (night 2), on both laptops.
   - Operational transformation: all changes go through the server, which shifts each change past
     the ones it has already applied that its writer had not seen. Her laptop gets his insert
     shifted from 40 to 28 (night 1) and from 63 to 77 (night 2).
   - CRDT: each character has an id, her initial or his and a count. The paragraph's 69 characters
     are N7201 to N7269 (position p is N7201 + p); "never " is B9301 to B9306, pinned after N7240,
     the space before "locked". Night 2: "Then silence. " is N7301 to N7314, pinned at the start; his
     sentence is B9401 to B9424, pinned after N7269, the last full stop.
   - Chapter lock: a laptop must take the chapter's lock from the server before typing, so an
     offline laptop can't type: her edit is blocked and made when she is back (23:42, 23:05).
   - Words lost: words of the paragraph both writers meant (her edit and his, each where meant)
     missing from a laptop's copy, counted as space-separated words; the worse laptop is shown.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var NIGHTS = {
    one: {
      date: "Tuesday 2 March 2027",
      base: "Rain again. Kaja heard it. The door was locked. She had the only key.",
      off: "20:15", back: "23:42",
      her: { cid: "N-412", t: "21:20", kind: "del", at: 0, len: 12 },
      his: { cid: "B-388", t: "21:26", kind: "ins", at: 40, text: "never ", first: 9301 }
    },
    two: {
      date: "Tuesday 13 April 2027",
      off: "20:30", back: "23:05",
      her: { cid: "N-431", t: "21:10", kind: "ins", at: 0, text: "Then silence. ", first: 7301 },
      his: { cid: "B-405", t: "21:31", kind: "ins", at: 63, text: " Someone else had a key.", first: 9401 }
    }
  };
  var BASE_ID = 7201;

  var METHODS = [
    { value: "replay", label: "replay positions (as on the night)" },
    { value: "lww", label: "last save wins (whole paragraph)" },
    { value: "sort", label: "sort by the time each change was typed" },
    { value: "ot", label: "operational transformation through the server" },
    { value: "crdt", label: "CRDT: every character has an id" }
  ];
  var OFFS = [
    { value: "on", label: "on (as on the night)" },
    { value: "off", label: "off (online all evening)" }
  ];
  var LOCKS = [
    { value: "off", label: "off (as on the night)" },
    { value: "on", label: "on (take the chapter's lock before typing)" }
  ];
  var NIGHT_OPTS = [
    { value: "one", label: "Tuesday 2 March (as on the night)" },
    { value: "two", label: "Tuesday 13 April (a longer edit each)" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function mins(t) { var p = t.split(":"); return Number(p[0]) * 60 + Number(p[1]); }
  function clone(doc) { return doc.map(function (c) { return { id: c.id, ch: c.ch, dead: c.dead, anchor: c.anchor, key: c.key }; }); }
  function vis(doc) { return doc.filter(function (c) { return !c.dead; }); }
  function text(doc) { return vis(doc).map(function (c) { return c.ch; }).join(""); }
  function visIndex(doc, id) {
    var v = vis(doc);
    for (var i = 0; i < v.length; i++) if (v[i].id === id) return i;
    return -1;
  }
  function q(s) { return "\"" + s + "\""; }

  /* ---------- the documents ---------- */

  function startDoc(night) {
    if (night === "one") {
      return NIGHTS.one.base.split("").map(function (ch, i) {
        return { id: "N" + (BASE_ID + i), ch: ch, dead: false, anchor: null, key: "" };
      });
    }
    // Night two starts from night one merged as both meant (the CRDT result), dead characters dropped.
    return vis(run({ night: "one", method: "crdt", offline: "on", lock: "off" }).devs.his.doc).map(function (c) {
      return { id: c.id, ch: c.ch, dead: false, anchor: null, key: "" };
    });
  }

  // A change as its writer types it, on the writer's current copy.
  function makeOp(night, who, doc, base) {
    var e = NIGHTS[night][who];
    var op = { who: who, cid: e.cid, t: e.t, kind: e.kind };
    if (e.kind === "del") {
      op.ids = base.slice(e.at, e.at + e.len).map(function (c) { return c.id; });
      op.pos = visIndex(doc, op.ids[0]);
      op.len = e.len;
    } else {
      op.anchor = e.at === 0 ? "start" : base[e.at - 1].id;
      op.pos = op.anchor === "start" ? 0 : visIndex(doc, op.anchor) + 1;
      var pre = who === "his" ? "B" : "N";
      op.chars = e.text.split("").map(function (ch, k) { return { id: pre + (e.first + k), ch: ch }; });
    }
    return op;
  }
  function describe(op) {
    return op.kind === "del" ? "delete " + op.len + " characters at position " + op.pos :
      "insert " + q(op.chars.map(function (c) { return c.ch; }).join("")) + " at position " + op.pos;
  }

  // Apply by position: count to op.pos in the visible text.
  function applyPos(doc, op) {
    var v = vis(doc);
    if (op.kind === "del") {
      for (var k = op.pos; k < op.pos + op.len && k < v.length; k++) v[k].dead = true;
      return;
    }
    var at = op.pos >= v.length ? doc.length : doc.indexOf(v[op.pos]);
    var add = op.chars.map(function (c) { return { id: c.id, ch: c.ch, dead: false, anchor: op.anchor, key: op.cid }; });
    Array.prototype.splice.apply(doc, [at, 0].concat(add));
  }
  // Apply by id: pin an insert after its neighbour's id; hide deleted characters by id.
  function applyId(doc, op) {
    if (op.kind === "del") {
      doc.forEach(function (c) { if (op.ids.indexOf(c.id) >= 0) c.dead = true; });
      return;
    }
    var i = 0;
    if (op.anchor !== "start") {
      for (var j = 0; j < doc.length; j++) if (doc[j].id === op.anchor) { i = j + 1; break; }
    }
    // The tie rule: two inserts pinned to one neighbour sort the same way on every laptop.
    while (i < doc.length && doc[i].anchor === op.anchor && doc[i].key > op.cid) i++;
    var add = op.chars.map(function (c) { return { id: c.id, ch: c.ch, dead: false, anchor: op.anchor, key: op.cid }; });
    Array.prototype.splice.apply(doc, [i, 0].concat(add));
  }

  // Operational transformation: a, shifted past b (both made on the same version).
  function xf(a, b) {
    var r = {};
    for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) r[k] = a[k];
    var bl = b.kind === "ins" ? b.chars.length : b.len;
    if (a.kind === "ins") {
      if (b.kind === "ins") {
        if (b.pos < a.pos || (b.pos === a.pos && b.who < a.who)) r.pos = a.pos + bl;
      } else if (a.pos >= b.pos + b.len) r.pos = a.pos - b.len;
      else if (a.pos > b.pos) r.pos = b.pos;
    } else if (b.kind === "ins") {
      if (b.pos <= a.pos) r.pos = a.pos + bl;
    } else {
      var s = a.pos, e = a.pos + a.len, bs = b.pos, be = b.pos + b.len;
      r.len = a.len - Math.max(0, Math.min(e, be) - Math.max(s, bs));
      r.pos = s <= bs ? s : (s >= be ? s - b.len : bs);
    }
    return r;
  }

  /* ---------- the model (a pure function the display and self-tests read) ---------- */

  function run(C) {
    var N = NIGHTS[C.night];
    var base = startDoc(C.night);
    var offline = C.offline === "on";
    var lock = C.lock === "on";
    var M = C.method;
    var server = { doc: clone(base), log: [] };
    function mk(name) { return { name: name, doc: clone(base), online: true, out: [], inbox: [], ops: [], pending: [], ver: 0, stale: false }; }
    var devs = { mine: mk("mine"), his: mk("his") };
    function other(d) { return d.name === "mine" ? devs.his : devs.mine; }
    var said = [];
    var blocked = 0;
    var herMade = null;

    function rebuild(d) {
      d.doc = clone(base);
      d.ops.slice().sort(function (a, b) { return mins(a.t) - mins(b.t); }).forEach(function (op) { applyPos(d.doc, op); });
    }
    function type(d, op) {
      if (M === "sort") { d.ops.push(op); d.out.push(op); rebuild(d); return; }
      if (M === "crdt") applyId(d.doc, op); else applyPos(d.doc, op);
      if (M === "ot") { op.base = d.ver; d.pending.push(op); } else d.out.push(op);
    }
    function deliver(d, op) {
      if (M === "crdt") applyId(d.doc, op);
      else if (M === "sort") { d.ops.push(op); rebuild(d); }
      else applyPos(d.doc, op);
    }
    function send(d) {
      var o = other(d);
      if (M === "lww") {
        if (!d.out.length) return;
        d.out = [];
        server.doc = clone(d.doc);
        said.push("The server keeps the paragraph from " + (d.name === "mine" ? "my laptop" : "Beckett's laptop") + ", the last to reach it.");
        if (o.online) { o.doc = clone(server.doc); o.stale = false; } else o.stale = true;
        return;
      }
      if (M === "ot") {
        var origs = d.pending.slice();
        var missed = server.log.slice(d.ver).filter(function (x) { return x.who !== d.name; });
        origs.forEach(function (p) {
          var p2 = p;
          server.log.slice(p.base).forEach(function (x) { if (x.who !== d.name) p2 = xf(p2, x.op); });
          if (p2.pos !== p.pos) said.push("The server shifts " + p.cid + " from " + p.pos + " to " + p2.pos + ".");
          else if (missed.length) said.push("The server checks " + p.cid + " against " + missed.map(function (x) { return x.op.cid; }).join(", ") + ": it stays at position " + p.pos + ".");
          applyPos(server.doc, p2);
          server.log.push({ op: p2, who: d.name });
          if (o.online) { applyPos(o.doc, p2); o.ver = server.log.length; }
        });
        missed.forEach(function (x) {
          var a2 = x.op;
          origs.forEach(function (p) { a2 = xf(a2, p); });
          if (a2.pos !== x.op.pos) said.push("It sends " + x.op.cid + " to my laptop shifted from " + x.op.pos + " to " + a2.pos + ".");
          applyPos(d.doc, a2);
        });
        d.pending = [];
        d.ver = server.log.length;
        return;
      }
      d.out.forEach(function (op) { if (o.online) deliver(o, op); else o.inbox.push(op); });
      d.out = [];
    }
    function pull(d) {
      if (M === "lww") { if (d.stale) { d.doc = clone(server.doc); d.stale = false; } return; }
      if (M === "ot") {
        server.log.slice(d.ver).forEach(function (x) { applyPos(d.doc, x.op); });
        d.ver = server.log.length;
        return;
      }
      d.inbox.forEach(function (op) { deliver(d, op); });
      d.inbox = [];
    }
    function note(op) {
      if (M === "crdt") {
        if (op.kind === "del") return op.cid + " hides " + op.ids[0] + " to " + op.ids[op.ids.length - 1] + ".";
        return op.cid + " pins " + q(op.chars.map(function (c) { return c.ch; }).join("")) + " " +
          (op.anchor === "start" ? "at the start" : "after " + op.anchor) + ".";
      }
      return op.cid + ", " + describe(op) + ".";
    }

    var snaps = [];
    function snap(t) {
      snaps.push({ t: t, mine: clone(devs.mine.doc), his: clone(devs.his.doc), blocked: blocked, herMade: herMade });
    }
    var lines = [];
    snap("20:00");

    // Step 1: her edit.
    if (offline) devs.mine.online = false;
    said = [];
    var head1 = N.her.t + " My laptop" + (offline ? ", offline since " + N.off : ", online") + ": ";
    if (lock && offline) {
      blocked = 1;
      said.push("I can't take the chapter's lock without the internet, so " + N.her.cid + " is blocked.");
    } else {
      var op1 = makeOp(C.night, "her", devs.mine.doc, base);
      if (lock) said.push("I take the chapter's lock.");
      said.push(note(op1));
      type(devs.mine, op1);
      if (devs.mine.online) { send(devs.mine); said.push("It syncs at once."); }
      herMade = N.her.t;
    }
    lines.push({ text: head1 + said.join(" "), tone: blocked ? "warn" : "" });
    snap(N.her.t);

    // Step 2: his edit (he is always online).
    said = [];
    var op2 = makeOp(C.night, "his", devs.his.doc, base);
    if (lock) said.push("He takes the chapter's lock.");
    said.push(note(op2));
    type(devs.his, op2);
    send(devs.his);
    lines.push({ text: N.his.t + " Beckett's laptop, online: " + said.join(" ") + (devs.mine.online ? " My laptop gets it at once." : " My laptop is offline, so it waits."), tone: "" });
    snap(N.his.t);

    // Step 3: she is back online.
    said = [];
    var head3;
    if (offline) {
      head3 = N.back + " My laptop is back online and syncs. ";
      devs.mine.online = true;
      if (blocked) {
        pull(devs.mine);
        var op3 = makeOp(C.night, "her", devs.mine.doc, base);
        op3.t = N.back;
        said.push("Now I take the lock and make my edit: " + note(op3));
        type(devs.mine, op3);
        send(devs.mine);
        herMade = N.back;
      } else {
        var outs = devs.mine.out.slice();
        send(devs.mine);
        var ins = devs.mine.inbox.slice();
        pull(devs.mine);
        if (M === "replay") {
          outs.forEach(function (op) { said.push("Beckett's laptop replays " + op.cid + " at position " + op.pos + "."); });
          ins.forEach(function (op) { said.push("My laptop replays " + op.cid + " at position " + op.pos + "."); });
        } else if (M === "crdt") {
          said.push("Each laptop applies the other's change by id, wherever those ids now sit.");
        } else if (M === "sort") {
          said.push("Both laptops replay every change from the paragraph they last shared, in the order typed: " +
            N.her.cid + " (" + N.her.t + "), then " + N.his.cid + " (" + N.his.t + ").");
        }
      }
    } else {
      head3 = N.back + " Home. My laptop was online all evening, so nothing is waiting. ";
    }
    lines.push({ text: (head3 + said.join(" ")).replace(/\s+$/, ""), tone: "" });
    snap(N.back);

    return { devs: devs, snaps: snaps, lines: lines, base: base };
  }

  /* ---------- reading a result ---------- */

  var MEANT = {};
  function meant(night) {
    if (!MEANT[night]) MEANT[night] = text(run({ night: night, method: "crdt", offline: "on", lock: "off" }).devs.his.doc);
    return MEANT[night];
  }
  function hisFirst(night) { return "B" + NIGHTS[night].his.first; }
  function hisAnchor(night) {
    var e = NIGHTS[night].his;
    return startDoc(night)[e.at - 1].id;
  }
  function hisMeantPos(night) {
    var m = run({ night: night, method: "crdt", offline: "on", lock: "off" }).devs.his.doc;
    return visIndex(m, hisFirst(night));
  }
  // Where he meant is just after his neighbour (N7240, or N7269 on 13 April) in this copy's own
  // text, counting the neighbour's place without his own inserted characters.
  function landed(doc, night, typed) {
    if (!typed) return "not yet";
    var at = visIndex(doc, hisFirst(night));
    if (at < 0) return "lost";
    var others = doc.filter(function (c) { return c.id.charAt(0) !== "B" || Number(c.id.slice(1)) < NIGHTS[night].his.first; });
    var d = at - (visIndex(others, hisAnchor(night)) + 1);
    return d === 0 ? "where meant" : (d > 0 ? d + " late" : -d + " early");
  }
  function wordsLost(doc, night) {
    var have = {};
    text(doc).split(/\s+/).forEach(function (w) { if (w) have[w] = (have[w] || 0) + 1; });
    var lost = 0;
    meant(night).split(/\s+/).forEach(function (w) { if (!w) return; if (have[w]) have[w] -= 1; else lost += 1; });
    return lost;
  }
  function herState(s, night, step) {
    if (step === 0) return "not yet";
    if (s.blocked && !s.herMade) return "blocked";
    var e = NIGHTS[night].her;
    var ok = true;
    [s.mine, s.his].forEach(function (doc) {
      if (step < 3 && doc === s.his) return;
      if (e.kind === "del") {
        if (doc.some(function (c) { return !c.dead && c.id === "N" + BASE_ID; })) ok = false;
      } else if (visIndex(doc, "N" + e.first) !== 0) ok = false;
    });
    if (!ok) return "lost";
    return s.blocked ? "blocked, made at " + s.herMade : "kept";
  }

  /* ---------- the widget ---------- */

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function ruler(n) {
    var a = [];
    for (var i = 0; i <= n + 3; i++) a.push(" ");
    for (var k = 0; k <= n; k += 10) String(k).split("").forEach(function (ch, j) { a[k + j] = ch; });
    return a.join("").replace(/\s+$/, "");
  }
  function marks(doc, night, typed) {
    var t = text(doc);
    var a = [];
    for (var i = 0; i <= t.length; i++) a.push(" ");
    var at = typed ? visIndex(doc, hisFirst(night)) : -1;
    if (at >= 0) a[at] = "^";
    return a.join("").replace(/\s+$/, "");
  }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, txt) {
      var x = doc.createElement(tag);
      if (style) x.setAttribute("style", style);
      if (txt) x.textContent = txt;
      return x;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var panes = {};
    [["mine", "My laptop (Johannesburg)"], ["his", "Beckett's laptop (Tucson)"]].forEach(function (p) {
      box.appendChild(el("p", "margin:0;font-size:12px;font-weight:600;", p[1]));
      var pre = el("pre", "margin:0;overflow-x:auto;font-size:12px;line-height:1.4;");
      box.appendChild(pre);
      panes[p[0]] = pre;
    });
    var foot = el("p", "margin:0;font-size:12px;");
    box.appendChild(foot);
    api.root.appendChild(box);
    return { head: head, panes: panes, foot: foot };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = run(C);
    var s = R.snaps[S.step];
    var typed = S.step >= 2;
    S.ui.head.textContent = NIGHTS[C.night].date + ", " + s.t + " my time. Merge: " + pick(METHODS, C.method).label +
      ". My laptop offline: " + C.offline + ". Chapter lock: " + C.lock + ".";
    ["mine", "his"].forEach(function (k) {
      var d = s[k];
      S.ui.panes[k].textContent = text(d) + "\n" + marks(d, C.night, typed) + "\n" + ruler(text(d).length);
    });
    var hm = hisMeantPos(C.night);
    S.ui.foot.textContent = "Under each copy: ^ marks where his insert landed, then the positions, counted from 0. " +
      "Merged as both meant, his insert starts at position " + hm + " of " + meant(C.night).length + ": " + q(meant(C.night));
    var match = text(s.mine) === text(s.his);
    S.stat.time(s.t);
    S.stat.match(match ? "yes" : "no");
    S.stat.onMine(landed(s.mine, C.night, typed));
    S.stat.onHis(landed(s.his, C.night, typed));
    S.stat.hers(herState(s, C.night, S.step));
    S.stat.lost(S.step < 3 ? "not yet" : String(Math.max(wordsLost(s.mine, C.night), wordsLost(s.his, C.night))));
    S.stat.blocked(String(s.blocked));
    return R;
  }

  function change(api, what) {
    api.state.step = 0;
    api.log(what + " Set back to 20:00.", "");
    draw(api);
  }

  function summary(api, R) {
    var C = api.state.C;
    var s = R.snaps[3];
    var lost = Math.max(wordsLost(s.mine, C.night), wordsLost(s.his, C.night));
    var match = text(s.mine) === text(s.his);
    var ok = match && lost === 0 && text(s.mine) === meant(C.night);
    api.log("Mine: " + q(text(s.mine)) + " His: " + q(text(s.his)) + " Laptops match: " + (match ? "yes" : "no") +
      ". Words lost: " + lost + ".", ok ? "ok" : "bad");
  }

  function advance(api, all) {
    var S = api.state;
    if (S.step >= 3) {
      api.log("The night is over. Change a setting or reset to play it again.", "");
      return;
    }
    var R = run(S.C);
    var to = all ? 3 : S.step + 1;
    for (var k = S.step; k < to; k++) api.log(R.lines[k].text, R.lines[k].tone);
    S.step = to;
    draw(api);
    if (S.step === 3) summary(api, R);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s8e11", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { night: "one", method: "replay", offline: "on", lock: "off" };
      S.step = 0;
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("method", "Merge method", METHODS, "method");
      sel("offline", "My laptop offline on the flight", OFFS, "offline");
      sel("lock", "Chapter lock", LOCKS, "lock");
      sel("night", "Night", NIGHT_OPTS, "night");
      api.control.button("step", "Next step", function () { advance(api, false); });
      api.control.button("play", "Play to the end", function () { advance(api, true); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "time, my time", ""),
        match: api.stat("match", "laptops match", "warn"),
        onMine: api.stat("onmine", "his insert, on my laptop", "bad"),
        onHis: api.stat("onhis", "his insert, on his laptop", ""),
        hers: api.stat("hers", "my edit", ""),
        lost: api.stat("lost", "words lost", "bad"),
        blocked: api.stat("blocked", "edits blocked by the lock", "warn")
      };

      api.info("<strong>How to read it.</strong> Each box is one laptop's copy of chapter 9, paragraph 3. Under the text, ^ marks where Beckett's insert landed, and the numbers are positions, counted in characters from 0. Step through the night: my edit, his edit, then my laptop back online. The stats say whether the laptops match, where his insert landed on each against where he meant, what happened to my edit, how many words were lost, and how many edits the lock blocked.");

      api.log("Tuesday 2 March 2027, 20:00 my time, as on the night: both laptops hold " + q(NIGHTS.one.base) + " Merge: replay positions. My laptop goes offline at 20:15.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      function texts() { var s = t.api.state; var R = run(s.C); var x = R.snaps[s.step]; return [text(x.mine), text(x.his)]; }
      var P1 = "Kaja heard it. The door was locked. She never had the only key.";
      var OK1 = "Kaja heard it. The door was never locked. She had the only key.";

      // 1. Opening state: 20:00, both laptops hold the paragraph, nothing typed.
      var a = texts();
      t.expect(t.stat("time") === "20:00" && t.stat("match") === "yes" && t.stat("onmine") === "not yet" &&
        t.stat("lost") === "not yet" && t.stat("blocked") === 0 &&
        a[0] === "Rain again. Kaja heard it. The door was locked. She had the only key." && has("as on the night: both laptops hold"),
        "Opens at 20:00 with both laptops holding the 69-character paragraph");

      // 2. Step 1: 21:20, offline, my delete of 12 characters at position 0.
      t.click("step");
      a = texts();
      t.expect(has("21:20 My laptop, offline since 20:15: N-412, delete 12 characters at position 0.") &&
        a[0] === "Kaja heard it. The door was locked. She had the only key." && t.stat("match") === "no" && t.stat("hers") === "kept",
        "21:20: my laptop deletes 12 characters at position 0 while offline");

      // 3. Step 2: 21:26, his insert at position 40, before "locked"; it waits for my laptop.
      t.click("step");
      a = texts();
      t.expect(has("21:26 Beckett's laptop, online: B-388, insert \"never \" at position 40. My laptop is offline, so it waits.") &&
        a[1] === "Rain again. Kaja heard it. The door was never locked. She had the only key." && t.stat("onhis") === "where meant",
        "21:26: Beckett inserts \"never \" at position 40, just before \"locked\"");

      // 4. Step 3: 23:42, my laptop replays his insert at position 40 of my shorter copy: 12 late.
      t.click("step");
      a = texts();
      t.expect(a[0] === P1 && a[1] === OK1 && t.stat("match") === "no" && t.stat("onmine") === "12 late" &&
        t.stat("onhis") === "where meant" && t.stat("lost") === 0 && has("My laptop replays B-388 at position 40.") &&
        has("Laptops match: no. Words lost: 0."),
        "As on the night: my copy reads \"She never had\", his reads \"never locked\"; the laptops differ");

      // 5. Online all evening: the same replay is right, because his change was made on my shortened copy.
      t.set("offline", "off");
      t.click("play");
      a = texts();
      t.expect(a[0] === OK1 && a[1] === OK1 && t.stat("match") === "yes" && t.stat("onmine") === "where meant" &&
        has("B-388, insert \"never \" at position 28."),
        "Online: no overlap, he inserts at 28 of the shortened copy and both laptops match");
      t.set("offline", "on");

      // 6. Option 0: last save wins. Mine reaches the server last, so his "never" is lost.
      t.set("method", "lww");
      t.click("play");
      a = texts();
      t.expect(a[0] === "Kaja heard it. The door was locked. She had the only key." && a[1] === a[0] &&
        t.stat("match") === "yes" && t.stat("lost") === 1 && t.stat("onhis") === "lost" &&
        has("The server keeps the paragraph from my laptop, the last to reach it."),
        "Last save wins: both laptops match, and his \"never\" is gone: 1 word lost");

      // 7. Option 3: sort by time typed. Mine (21:20) first, his (21:26) second: both laptops 12 late.
      t.set("method", "sort");
      t.click("play");
      a = texts();
      t.expect(a[0] === P1 && a[1] === P1 && t.stat("match") === "yes" && t.stat("onmine") === "12 late" &&
        t.stat("onhis") === "12 late" && t.stat("lost") === 0,
        "Sort by time typed: both laptops agree on the wrong sentence, never 12 characters late");

      // 8. Operational transformation through the server: his insert shifted from 40 to 28 for my laptop.
      t.set("method", "ot");
      t.click("play");
      a = texts();
      t.expect(a[0] === OK1 && a[1] === OK1 && t.stat("onmine") === "where meant" && t.stat("lost") === 0 &&
        has("It sends B-388 to my laptop shifted from 40 to 28."),
        "Operational transformation: the server shifts his insert from 40 to 28; both laptops match");

      // 9. CRDT with ids: "never " pinned after N7240 lands before "locked" on both laptops.
      t.set("method", "crdt");
      t.click("play");
      a = texts();
      t.expect(a[0] === OK1 && a[1] === OK1 && t.stat("match") === "yes" && t.stat("lost") === 0 &&
        has("B-388 pins \"never \" after N7240.") && has("N-412 hides N7201 to N7212."),
        "CRDT: every character has an id; \"never \" is pinned after N7240 and both laptops match");

      // 10. Option 2: the chapter lock blocks my offline edit; I make it at 23:42.
      t.set("method", "replay");
      t.set("lock", "on");
      t.click("play");
      a = texts();
      t.expect(a[0] === OK1 && a[1] === OK1 && t.stat("blocked") === 1 && t.stat("hers") === "blocked, made at 23:42" &&
        has("I can't take the chapter's lock without the internet, so N-412 is blocked."),
        "Chapter lock: my offline delete is blocked and made at 23:42; both laptops match");
      t.set("lock", "off");

      // 11. 13 April, a longer edit each: replay lands his sentence 14 early; last save wins loses 5 words.
      t.set("night", "two");
      t.click("play");
      a = texts();
      var early = a[0] === "Then silence. Kaja heard it. The door was never locked. She had Someone else had a key. the only key." &&
        t.stat("onmine") === "14 early" && t.stat("match") === "no";
      t.set("method", "lww");
      t.click("play");
      t.expect(early && t.stat("lost") === 5 && t.stat("match") === "yes",
        "13 April: replayed positions put his sentence 14 characters early; last save wins loses his 5 words");

      // 12. 13 April with operational transformation and with the CRDT: 101 characters, as both meant.
      var full = "Then silence. Kaja heard it. The door was never locked. She had the only key. Someone else had a key.";
      t.set("method", "ot");
      t.click("play");
      var b = texts();
      var otOk = b[0] === full && b[1] === full && has("shifted from 63 to 77");
      t.set("method", "crdt");
      t.click("play");
      a = texts();
      t.click("play");
      t.expect(otOk && a[0] === full && a[1] === full && t.stat("lost") === 0 && has("The night is over."),
        "13 April: transformation and the CRDT both give the 101-character paragraph on both laptops");
    }
  });
})();
