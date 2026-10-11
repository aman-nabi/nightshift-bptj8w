/* sims/s4e05-v1.0.0.js  (published as sims/s4e05.js)
   Case s4e05 "Letters in a Dead Language": an encoding lab for Dunholt Abbey's catalogue. The
   cataloguing app (the writer) encodes three catalogue entries as real Protocol Buffers wire bytes
   (or as JSON) and puts them on the Kafka topic catalogue-entries; the reading-room screen (the
   reader) decodes them with its own copy of the schema and prints a line for visitors. The learner
   picks the writer's schema, the reader's schema, the format, the registry's compatibility type,
   and whether a breaking-change check runs before the registry. Widget-style sim: it draws its own
   panels inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: writer schemas old / release 2 (folio_count reuses 4) / fresh
     number (4 reserved, folio_count = 6); reader schemas the same three; Protocol Buffers or JSON;
     registry NONE or BACKWARD (the default); breaking-change check (buf, WIRE rules) on or off.
     Stats: what the screen shows for the psalter, books with a wrong number, books with a blank,
     psalter message bytes, all three messages' bytes, the writer actually publishing, the
     registry's verdict, the check's verdict. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - Protocol Buffers encoding, as protobuf.dev's encoding guide describes it: each field is a tag,
     a varint of (field_number << 3) | wire_type, then the value. int32 is wire type 0 (VARINT):
     7 payload bits per byte, low group first, top bit set on every byte but the last. string is
     wire type 2 (LEN): a varint length, then the bytes. Fields are written in field-number order.
   - Decoding: read each tag; if the reader's schema has that number with a matching wire type, the
     value goes into that field's name; otherwise it is an unknown field and is skipped. A field
     with no bytes keeps proto3's default: 0 for numbers, "" for strings.
   - JSON: an object keyed by the writer's field names, in the same order; the reader takes only
     the names it knows. Sizes are character counts (all ASCII, so bytes).
   - The screen's line: with the old schema, "<title>, <language>, written in the year <year>", or
     "year unknown" when year is 0. With either new schema, "<title>, <language>, <dated or
     undated>, <folios> folios", or "folios unknown" when folio_count is 0.
   - A wrong number: a year or folio count shown that is not the book's own. A blank: unknown.
   - Releases. Writer "release 2" means two releases: release 1 (spring) deleted year = 4 without
     reserving 4 and added dated = 5; release 2 (Monday) added folio_count = 4. Writer "fresh"
     means release 1 also reserved 4 and "year", and release 2 gave folio_count 6.
   - Registry BACKWARD, as Confluent documents it: new consumers can read old data; removing fields
     and adding optional fields are listed as backward compatible; each schema is checked against
     the last one. So it accepts both releases on either line. NONE: checks are disabled.
   - Breaking-change check: buf's rule FIELD_NO_DELETE_UNLESS_NUMBER_RESERVED (WIRE category)
     refuses release 1 on the "release 2" line, so neither release ships and the app keeps writing
     the old schema. On the fresh line both releases pass.

   Where every number comes from (conventions rule 14; the case is content/s4/s4e05-v1.0.0.json):
   - The books (story): MS 41 Psalter, Latin, about 1340, 212 folios; MS 7 Book of Hours, Latin,
     about 1460, 154 folios; MS 19 Herbal, English, about 1420, 96 folios.
   - Psalter, release 2 writer, 35 bytes:
     0A 05 4D 53 20 34 31 | 12 07 50 73 61 6C 74 65 72 | 1A 05 4C 61 74 69 6E | 20 D4 01 |
     2A 07 63 2E 20 31 33 34 30. 0x20 = (4 << 3) | 0. D4 01 = 0x54 + 1 x 128 = 212.
     The old screen reads 212 as the year: "Psalter, Latin, written in the year 212". 1340 - 212 =
     1,128 years, the post's "eleven centuries". Book of Hours: 9A 01 = 154; Herbal: 60 = 96.
   - Psalter, old writer, 26 bytes, ending 20 BC 0A (1340). Old reader with the release 2 schema:
     "Psalter, Latin, undated, 1,340 folios".
   - Fresh writer, psalter 35 bytes, ending 30 D4 01 (field 6). Old screen: "year unknown".
   - Sizes, psalter / all three: Protocol Buffers old 26 / 84, new 35 / 110; JSON old 70 / 216,
     new 94 / 287.
*/
(function () {
  "use strict";

  /* ---------- the story's data ---------- */

  var BOOKS = [
    { shelfmark: "MS 41", title: "Psalter", language: "Latin", year: 1340, dated: "c. 1340", folio_count: 212 },
    { shelfmark: "MS 7", title: "Book of Hours", language: "Latin", year: 1460, dated: "c. 1460", folio_count: 154 },
    { shelfmark: "MS 19", title: "Herbal", language: "English", year: 1420, dated: "c. 1420", folio_count: 96 }
  ];

  // Each schema: fields [number, name, type], type "s" string (wire type 2) or "i" int32 (wire type 0).
  var SCHEMAS = {
    old: {
      label: "old: int32 year = 4",
      fields: [[1, "shelfmark", "s"], [2, "title", "s"], [3, "language", "s"], [4, "year", "i"]],
      reserved: [],
      proto: ["syntax = \"proto3\";", "message Entry {", "  string shelfmark = 1;", "  string title = 2;",
        "  string language = 3;", "  int32 year = 4;", "}"]
    },
    reused: {
      label: "release 2: folio_count = 4 (reused)",
      fields: [[1, "shelfmark", "s"], [2, "title", "s"], [3, "language", "s"], [4, "folio_count", "i"], [5, "dated", "s"]],
      reserved: [],
      proto: ["syntax = \"proto3\";", "message Entry {", "  string shelfmark = 1;", "  string title = 2;",
        "  string language = 3;", "  optional int32 folio_count = 4;", "  optional string dated = 5;", "}"]
    },
    fresh: {
      label: "fresh: 4 reserved, folio_count = 6",
      fields: [[1, "shelfmark", "s"], [2, "title", "s"], [3, "language", "s"], [5, "dated", "s"], [6, "folio_count", "i"]],
      reserved: [4],
      proto: ["syntax = \"proto3\";", "message Entry {", "  reserved 4;", "  reserved \"year\";", "  string shelfmark = 1;",
        "  string title = 2;", "  string language = 3;", "  optional string dated = 5;", "  optional int32 folio_count = 6;", "}"]
    }
  };
  var ORDER = ["old", "reused", "fresh"];

  var RELEASES = {
    reused: [
      { n: 1, when: "spring", what: "year = 4 deleted, 4 not reserved; dated = 5 added", deletesUnreserved: true },
      { n: 2, when: "Monday", what: "optional int32 folio_count = 4 added", deletesUnreserved: false }
    ],
    fresh: [
      { n: 1, when: "spring", what: "year = 4 deleted, 4 and \"year\" reserved; dated = 5 added", deletesUnreserved: false },
      { n: 2, when: "Monday", what: "optional int32 folio_count = 6 added", deletesUnreserved: false }
    ]
  };

  /* ---------- encoding ---------- */

  function varint(n) {
    var out = [];
    while (n > 127) { out.push((n & 127) | 128); n = Math.floor(n / 128); }
    out.push(n);
    return out;
  }
  function ascii(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }
  function hex(b) { var h = b.toString(16).toUpperCase(); return h.length < 2 ? "0" + h : h; }
  function hexAll(arr) { return arr.map(hex).join(" "); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  // Returns { bytes: [...], parts: [{ num, wt, bytes, value }] }.
  function encodeProto(sch, book) {
    var bytes = [];
    var parts = [];
    sch.fields.forEach(function (f) {
      var v = book[f[1]];
      var p;
      if (f[2] === "s") p = [(f[0] << 3) | 2].concat(varint(v.length), ascii(v));
      else p = [(f[0] << 3) | 0].concat(varint(v));
      parts.push({ num: f[0], wt: f[2] === "s" ? 2 : 0, bytes: p, value: v });
      bytes = bytes.concat(p);
    });
    return { bytes: bytes, parts: parts };
  }

  function readVarint(bytes, pos) {
    var n = 0;
    var mul = 1;
    var b;
    do {
      b = bytes[pos];
      pos += 1;
      n += (b & 127) * mul;
      mul *= 128;
    } while (b & 128);
    return { n: n, pos: pos };
  }

  function fieldByNumber(sch, num) {
    for (var i = 0; i < sch.fields.length; i++) if (sch.fields[i][0] === num) return sch.fields[i];
    return null;
  }

  // Decodes wire bytes with the reader's schema. Returns { obj, notes: [...] }.
  function decodeProto(sch, bytes) {
    var obj = defaults(sch);
    var notes = [];
    var pos = 0;
    while (pos < bytes.length) {
      var t = readVarint(bytes, pos);
      pos = t.pos;
      var num = Math.floor(t.n / 8);
      var wt = t.n % 8;
      var val;
      if (wt === 0) {
        var r = readVarint(bytes, pos);
        pos = r.pos;
        val = r.n;
      } else {
        var len = readVarint(bytes, pos);
        pos = len.pos;
        val = String.fromCharCode.apply(null, bytes.slice(pos, pos + len.n));
        pos += len.n;
      }
      var f = fieldByNumber(sch, num);
      if (f && (f[2] === "s" ? 2 : 0) === wt) {
        obj[f[1]] = val;
        notes.push({ num: num, wt: wt, val: val, as: f[1] });
      } else {
        notes.push({ num: num, wt: wt, val: val, as: null, reserved: sch.reserved.indexOf(num) >= 0 });
      }
    }
    return { obj: obj, notes: notes };
  }

  function defaults(sch) {
    var o = {};
    sch.fields.forEach(function (f) { o[f[1]] = f[2] === "s" ? "" : 0; });
    return o;
  }

  function encodeJson(sch, book) {
    var o = {};
    sch.fields.forEach(function (f) { o[f[1]] = book[f[1]]; });
    return JSON.stringify(o);
  }
  function decodeJson(sch, text) {
    var src = JSON.parse(text);
    var o = defaults(sch);
    sch.fields.forEach(function (f) {
      if (Object.prototype.hasOwnProperty.call(src, f[1]) && typeof src[f[1]] === (f[2] === "s" ? "string" : "number")) o[f[1]] = src[f[1]];
    });
    return o;
  }

  /* ---------- the screen ---------- */

  function screenLine(readerKey, o) {
    if (readerKey === "old") {
      return o.title + ", " + o.language + ", " + (o.year ? "written in the year " + o.year : "year unknown");
    }
    return o.title + ", " + o.language + ", " + (o.dated || "undated") + ", " +
      (o.folio_count ? fmt(o.folio_count) + " folios" : "folios unknown");
  }
  function judge(readerKey, o, book) {
    var v = readerKey === "old" ? o.year : o.folio_count;
    var truth = readerKey === "old" ? book.year : book.folio_count;
    if (!v) return "blank";
    return v === truth ? "right" : "wrong";
  }

  /* ---------- gates ---------- */

  function gates(C) {
    var out = { effective: C.writer, registry: "nothing to check", check: C.check ? "nothing to check" : "off", lines: [] };
    if (C.writer === "old") {
      out.lines.push("Old schema only: no release to check.");
      return out;
    }
    var rel = RELEASES[C.writer];
    var regOk = 0;
    var refused = null;
    for (var i = 0; i < rel.length; i++) {
      var r = rel[i];
      if (C.check && r.deletesUnreserved) {
        refused = r;
        out.lines.push("Release " + r.n + " (" + r.when + "): " + r.what + ". Breaking-change check: REFUSED, FIELD_NO_DELETE_UNLESS_NUMBER_RESERVED (field 4 \"year\" deleted, number 4 not reserved). Never reaches the registry.");
        break;
      }
      var reg = C.registry === "BACKWARD"
        ? (i === 0 ? "accepted (removing a field is listed as backward compatible)" : "accepted (adding an optional field is listed as backward compatible)")
        : "not checked (NONE)";
      if (C.registry === "BACKWARD") regOk += 1;
      out.lines.push("Release " + r.n + " (" + r.when + "): " + r.what + "." + (C.check ? " Breaking-change check: passed." : "") + " Registry: " + reg + ".");
    }
    if (refused) {
      out.effective = "old";
      out.check = "refused release 1";
      out.registry = C.registry === "BACKWARD" ? "release 1 never reached it" : "not checked";
      out.lines.push("Neither release ships, so the app keeps writing the old schema.");
    } else {
      if (C.check) out.check = "passed 2 of 2";
      out.registry = C.registry === "BACKWARD" ? "accepted " + regOk + " of 2" : "not checked";
      if (C.writer === "fresh") out.lines.push("protoc refuses any later field numbered 4: it is reserved.");
    }
    return out;
  }

  /* ---------- run ---------- */

  function compute(C) {
    var g = gates(C);
    var wsch = SCHEMAS[g.effective];
    var rsch = SCHEMAS[C.reader];
    var rows = BOOKS.map(function (b) {
      var row = { book: b };
      if (C.format === "protobuf") {
        var e = encodeProto(wsch, b);
        var d = decodeProto(rsch, e.bytes);
        row.size = e.bytes.length;
        row.wire = hexAll(e.bytes);
        row.parts = e.parts;
        row.notes = d.notes;
        row.obj = d.obj;
      } else {
        var j = encodeJson(wsch, b);
        row.size = j.length;
        row.wire = j;
        row.obj = decodeJson(rsch, j);
      }
      row.line = screenLine(C.reader, row.obj);
      row.verdict = judge(C.reader, row.obj, b);
      return row;
    });
    var wrong = 0;
    var blank = 0;
    var total = 0;
    rows.forEach(function (r) {
      if (r.verdict === "wrong") wrong += 1;
      if (r.verdict === "blank") blank += 1;
      total += r.size;
    });
    return { g: g, rows: rows, wrong: wrong, blank: blank, total: total };
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
    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;font-size:12px;");
    var head = el("p", "margin:0;");
    box.appendChild(head);
    var schemas = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;min-width:0;");
    var wPre = el("pre", "margin:0;padding:6px;overflow-x:auto;border:1px solid currentColor;border-radius:4px;");
    var rPre = el("pre", "margin:0;padding:6px;overflow-x:auto;border:1px solid currentColor;border-radius:4px;");
    schemas.appendChild(wPre);
    schemas.appendChild(rPre);
    box.appendChild(schemas);
    var wire = el("div", "display:grid;gap:8px;min-width:0;");
    box.appendChild(wire);
    var gatesBox = el("ul", "margin:0;padding-left:18px;");
    box.appendChild(gatesBox);
    api.root.appendChild(box);
    return { el: el, head: head, wPre: wPre, rPre: rPre, wire: wire, gates: gatesBox };
  }

  function describeNote(n) {
    var what = "field " + n.num + ", wire type " + n.wt + (n.wt === 0 ? " (varint) = " + n.val : " (length-prefixed) = \"" + n.val + "\"");
    if (n.as) return what + " → " + n.as;
    return what + " → unknown to the reader, skipped" + (n.reserved ? " (4 is reserved here)" : "");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = S.R;
    var ui = S.ui;
    var el = ui.el;
    ui.head.textContent = "Writer publishing: " + SCHEMAS[R.g.effective].label + ". Screen's schema: " + SCHEMAS[C.reader].label +
      ". Format: " + (C.format === "protobuf" ? "Protocol Buffers" : "JSON") + ". Registry: " + C.registry +
      ". Breaking-change check: " + (C.check ? "on" : "off") + ".";
    ui.wPre.textContent = "// writer (cataloguing app)\n" + SCHEMAS[R.g.effective].proto.join("\n");
    ui.rPre.textContent = "// reader (reading-room screen)\n" + SCHEMAS[C.reader].proto.join("\n");
    clear(ui.wire);
    R.rows.forEach(function (r) {
      var card = el("div", "border:1px solid currentColor;border-radius:4px;padding:6px;min-width:0;");
      card.appendChild(el("div", "font-weight:600;", r.book.shelfmark + ": " + r.size + " bytes on the wire"));
      card.appendChild(el("code", "display:block;word-break:break-all;margin:4px 0;", r.wire));
      if (r.notes) {
        var ul = el("ul", "margin:0;padding-left:18px;");
        r.parts.forEach(function (p, k) {
          ul.appendChild(el("li", "", hexAll(p.bytes.slice(0, 3)) + (p.bytes.length > 3 ? " ..." : "") + ": " + describeNote(r.notes[k])));
        });
        card.appendChild(ul);
      }
      card.appendChild(el("div", "margin-top:4px;", "Screen: " + r.line + (r.verdict === "wrong" ? "  (WRONG)" : r.verdict === "blank" ? "  (blank)" : "")));
      ui.wire.appendChild(card);
    });
    clear(ui.gates);
    R.g.lines.forEach(function (l) { ui.gates.appendChild(el("li", "", l)); });

    S.stat.shown(R.rows[0].line);
    S.stat.wrong(R.wrong);
    S.stat.blank(R.blank);
    S.stat.bytes(R.rows[0].size);
    S.stat.total(R.total);
    S.stat.writer(R.g.effective === "old" ? "old" : R.g.effective === "reused" ? "release 2, 4 reused" : "fresh number 6");
    S.stat.registry(R.g.registry);
    S.stat.check(R.g.check);
  }

  function apply(api, what) {
    var S = api.state;
    S.R = compute(S.C);
    var R = S.R;
    var s = what + " Screen: " + R.rows.map(function (r) { return r.book.shelfmark + " " + r.line; }).join("; ") +
      ". Wrong numbers: " + R.wrong + ", blanks: " + R.blank + ". Psalter " + R.rows[0].size + " bytes, all three " + R.total + ".";
    if (R.g.check === "refused release 1") s += " Check refused release 1 (FIELD_NO_DELETE_UNLESS_NUMBER_RESERVED); the app keeps the old schema.";
    api.log(s, R.wrong ? "bad" : R.blank ? "warn" : "ok");
    draw(api);
  }

  function opts(list) { return list.map(function (k) { return { value: k, label: SCHEMAS[k].label }; }); }

  /* ---------- the module ---------- */

  DL.sims.define("s4e05", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { writer: "old", reader: "old", format: "protobuf", registry: "BACKWARD", check: false };
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.writer = api.control.select("writer", "Writer's schema (cataloguing app)", opts(ORDER), "old", function (v) {
        if (!SCHEMAS[v]) return;
        S.C.writer = String(v);
        apply(api, "Writer: " + SCHEMAS[S.C.writer].label + ".");
      });
      S.ctl.reader = api.control.select("reader", "Reader's schema (reading-room screen)", opts(ORDER), "old", function (v) {
        if (!SCHEMAS[v]) return;
        S.C.reader = String(v);
        apply(api, "Screen: " + SCHEMAS[S.C.reader].label + ".");
      });
      S.ctl.format = api.control.select("format", "Format on the topic", [
        { value: "protobuf", label: "Protocol Buffers (numbers on the wire)" },
        { value: "json", label: "JSON (names on the wire)" }
      ], "protobuf", function (v) {
        S.C.format = String(v) === "json" ? "json" : "protobuf";
        apply(api, "Format: " + (S.C.format === "json" ? "JSON." : "Protocol Buffers."));
      });
      S.ctl.registry = api.control.select("registry", "Registry compatibility type", [
        { value: "NONE", label: "NONE (checks off)" },
        { value: "BACKWARD", label: "BACKWARD (the default)" }
      ], "BACKWARD", function (v) {
        S.C.registry = String(v) === "NONE" ? "NONE" : "BACKWARD";
        apply(api, "Registry compatibility type: " + S.C.registry + ".");
      });
      S.ctl.check = api.control.toggle("check", "Breaking-change check before the registry (buf, WIRE rules)", false, function (on) {
        S.C.check = !!on;
        apply(api, "Breaking-change check: " + (on ? "on." : "off."));
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        shown: api.stat("shown", "the screen shows for MS 41", ""),
        wrong: api.stat("wrong", "books with a wrong number", "bad"),
        blank: api.stat("blank", "books with a blank", "warn"),
        bytes: api.stat("bytes", "psalter message, bytes", ""),
        total: api.stat("total", "all three messages, bytes", ""),
        writer: api.stat("writer", "schema the app publishes", ""),
        registry: api.stat("registry", "registry verdict", ""),
        check: api.stat("check", "breaking-change check", "")
      };

      api.info("<strong>How to read it.</strong> Each card is one catalogue entry as it travels on catalogue-entries: the bytes in hexadecimal, then each field's tag (field number and wire type), what the screen's schema calls that number, and the line visitors see. Change the writer's and the reader's schema separately: they are two programs, released at different times. The list at the bottom shows which gate looked at each release and what it said.");

      S.R = compute(S.C);
      api.log("Before spring: app and screen both on the old schema. Screen: " + S.R.rows.map(function (r) { return r.book.shelfmark + " " + r.line; }).join("; ") + ".", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      var PSALTER_R2 = "0A 05 4D 53 20 34 31 12 07 50 73 61 6C 74 65 72 1A 05 4C 61 74 69 6E 20 D4 01 2A 07 63 2E 20 31 33 34 30";

      // 1. Opening: before spring, both on the old schema; the year travels as 20 BC 0A.
      t.expect(t.stat("shown") === "Psalter, Latin, written in the year 1340" && t.stat("wrong") === 0 && t.stat("blank") === 0 &&
        t.stat("bytes") === 26 && t.stat("total") === 84 && t.stat("writer") === "old" &&
        t.api.state.R.rows[0].wire.slice(-8) === "20 BC 0A",
        "Opens before spring: old writer, old screen, the psalter written in 1340, 26 bytes ending 20 BC 0A");

      // 2. The night: release 2 on the writer, old screen. 212 from the real bytes.
      begin();
      t.set("writer", "reused");
      t.expect(t.stat("shown") === "Psalter, Latin, written in the year 212" && t.stat("wrong") === 3 &&
        has("MS 7 Book of Hours, Latin, written in the year 154; MS 19 Herbal, English, written in the year 96."),
        "Release 2 read by the old screen: written in the year 212, 154 and 96, three wrong years");

      // 3. The exact bytes on the wire.
      t.expect(t.api.state.R.rows[0].wire === PSALTER_R2 && t.stat("bytes") === 35 && t.stat("total") === 110 &&
        t.api.state.R.rows[0].notes[3].num === 4 && t.api.state.R.rows[0].notes[3].as === "year" && t.api.state.R.rows[0].notes[4].as === null,
        "Psalter's 35 bytes, with 20 D4 01: field 4, varint 212, which the old schema calls year; field 5 skipped");

      // 4. The registry with BACKWARD accepted both releases.
      t.expect(t.stat("registry") === "accepted 2 of 2" && t.stat("check") === "off",
        "Registry on BACKWARD accepts release 1 (removing a field) and release 2 (adding an optional field)");

      // 5. Option 0: JSON. No wrong year, a blank on every book, and bigger messages.
      t.set("format", "json");
      t.expect(t.stat("shown") === "Psalter, Latin, year unknown" && t.stat("wrong") === 0 && t.stat("blank") === 3 &&
        t.stat("bytes") === 94 && t.stat("total") === 287,
        "JSON: the old screen finds no \"year\" and shows year unknown on all three; psalter 94 bytes, all three 287");
      t.set("format", "protobuf");

      // 6. Option 1: release together, then the screen replays an entry written before spring.
      t.set("writer", "old");
      t.set("reader", "reused");
      t.expect(t.stat("shown") === "Psalter, Latin, undated, 1,340 folios" && t.stat("wrong") === 3,
        "New screen reading an old entry: 1340 in field 4 shows as 1,340 folios");

      // 7. Option 2: both on release 2 (a new topic carries only new entries).
      t.set("writer", "reused");
      t.expect(t.stat("shown") === "Psalter, Latin, c. 1340, 212 folios" && t.stat("wrong") === 0 && t.stat("blank") === 0,
        "Writer and screen both on release 2: c. 1340, 212 folios");

      // 8. The breaking-change check refuses release 1, so tag 4 is never reused.
      t.set("reader", "old");
      begin();
      t.set("check", true);
      t.expect(t.stat("check") === "refused release 1" && t.stat("writer") === "old" &&
        t.stat("shown") === "Psalter, Latin, written in the year 1340" &&
        has("FIELD_NO_DELETE_UNLESS_NUMBER_RESERVED"),
        "Check on: release 1 deletes field 4 without reserving it and is refused; the app keeps writing the old schema");

      // 9. Option 3: fresh number. The old screen shows a blank, never a wrong year.
      t.set("writer", "fresh");
      t.expect(t.stat("check") === "passed 2 of 2" && t.stat("registry") === "accepted 2 of 2" &&
        t.stat("shown") === "Psalter, Latin, year unknown" && t.stat("wrong") === 0 && t.stat("blank") === 3 &&
        t.stat("bytes") === 35 && t.api.state.R.rows[0].wire.slice(-8) === "30 D4 01",
        "Fresh number: both releases pass; field 6 (30 D4 01) is unknown to the old screen, which shows year unknown");

      // 10. The screen moves to the fresh schema; an old entry's field 4 is skipped.
      t.set("reader", "fresh");
      var a = t.stat("shown");
      t.set("writer", "old");
      t.set("check", false);
      var b = t.stat("shown");
      t.expect(a === "Psalter, Latin, c. 1340, 212 folios" && b === "Psalter, Latin, undated, folios unknown" && t.stat("wrong") === 0,
        "Fresh screen: 212 folios from new entries; an old entry's field 4 is skipped, folios unknown, never 1,340");

      // 11. Registry NONE: nothing checked.
      t.set("writer", "reused");
      t.set("registry", "NONE");
      t.expect(t.stat("registry") === "not checked" && t.stat("check") === "off",
        "Compatibility type NONE: the registry checks nothing");
    }
  });
})();
