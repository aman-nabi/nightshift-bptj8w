/* engine/diagram-v1.0.0.js
   CHANGELOG
   v1.0.0 (2026-10-04) first version */
(function (root) {
  "use strict";
  var DL = root.DL || (root.DL = {});

  /* DL.diagram draws the diagram specs of schema doc section 3 (arch,
     sequence, timeline) as inline SVG, per engine contract section 4.
     Every size and position is computed here without layout APIs (no
     getBBox), so the output is identical in a browser and under jsdom.
     Colors come only from the CSS classes of contract section 7. The only
     paint values written as attributes are "currentColor" (arrowheads) and
     "none" (open paths), and "none" is a paint keyword, not a color. */

  var NS = "http://www.w3.org/2000/svg";
  var FONT = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

  /* Text box model used by textBoxes() and overlaps():
     width  = characters x fontSize x 0.6
     height = fontSize x 1.2, placed from baseline - 0.9em to baseline + 0.3em
     The left edge follows text-anchor (start, middle, end). */
  var CHAR_W = 0.6;
  var LINE_H = 1.2;
  var ASCENT = 0.9;
  var TOL = 0.5;      // intersections thinner than this (px) are not reported
  var END_GAP = 3;    // space between an arrow tip and the box it points at

  var FS = { label: 13, sub: 12, meta: 11, edge: 11, group: 11, note: 11 };
  var LINES = ["label", "sub", "meta"];
  var LINE_CLASS = { label: "dg-label", sub: "dg-sub", meta: "dg-meta" };
  var SHAPES = { box: true, db: true, person: true, cloud: true };
  var ANCHORS = { start: true, middle: true, end: true };
  var TALL = 72;      // text area taller than this spreads node lines evenly

  var uid = 0;
  var registry = typeof WeakMap === "function" ? new WeakMap() : null;

  /* ---------- small helpers ---------- */

  function has(v) { return v !== null && v !== undefined && String(v) !== ""; }
  function str(v) { return v === null || v === undefined ? "" : String(v); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function num(v, d) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return d;
    var n = Number(v);
    return isFinite(n) ? n : d;
  }
  function pf(v, d) { var n = parseFloat(v); return isFinite(n) ? n : d; }
  function fmt(n) { var r = Math.round(n * 100) / 100; return String(r === 0 ? 0 : r); }
  function pt(x, y) { return fmt(x) + "," + fmt(y); }
  function clamp(v, lo, hi) { return hi < lo ? lo : Math.max(lo, Math.min(hi, v)); }
  function chars(s) { return Array.from(str(s)).length; }
  function textW(s, fs) { return chars(s) * fs * CHAR_W; }
  function token(v) { return str(v).toLowerCase().replace(/[^a-z0-9_-]/g, ""); }
  function toneCls(t) { var k = token(t); return k ? "tone-" + k : ""; }
  function joinCls() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(" ");
  }
  function isObj(v) { return !!v && typeof v === "object"; }
  function short(s) { s = str(s); return s.length > 48 ? s.slice(0, 45) + "..." : s; }

  function docOf(container) {
    if (container && container.ownerDocument) return container.ownerDocument;
    if (root.document) return root.document;
    throw new Error("DL.diagram.render needs a DOM document");
  }

  // Creates an SVG element. Attributes that are null, undefined or "" are skipped.
  function mk(doc, tag, attrs, parent) {
    var el = doc.createElementNS(NS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (!own(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === "") continue;
        el.setAttribute(k, typeof v === "number" ? fmt(v) : String(v));
      }
    }
    if (parent) parent.appendChild(el);
    return el;
  }

  // Every <text> gets font-size and text-anchor as attributes, so textBoxes()
  // can read its geometry back without CSS or layout APIs.
  function text(doc, parent, o) {
    var el = mk(doc, "text", {
      "class": o.cls,
      x: o.x,
      y: o.y,
      "font-size": o.fs,
      "font-weight": o.weight,
      "text-anchor": own(ANCHORS, o.anchor) ? o.anchor : "start",
      "data-role": o.role,
      "data-owner": o.owner
    }, parent);
    el.textContent = str(o.text);
    return el;
  }

  // One arrowhead marker per tone, created on first use. The marker element
  // carries the tone class because fill="currentColor" inside a marker takes
  // its color from the marker's ancestors, not from the path that uses it.
  function markerFactory(ctx) {
    var cache = {};
    var base = "dg" + (++uid) + "-arw";
    return function (tone) {
      var t = token(tone);
      if (!own(cache, t)) {
        var id = base + (t ? "-" + t : "");
        var m = mk(ctx.doc, "marker", {
          id: id, "class": toneCls(t), viewBox: "0 0 10 10", refX: 9, refY: 5,
          markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse"
        }, ctx.defs);
        mk(ctx.doc, "path", { d: "M0,0 L10,5 L0,10 z", fill: "currentColor" }, m);
        cache[t] = "url(#" + id + ")";
      }
      return cache[t];
    };
  }

  /* ---------- text boxes and overlaps ---------- */

  // The node a text belongs to: its data-owner, or the nearest g[data-node]
  // ancestor (so text a sim appends inside a node group counts as the node's).
  function ownerOf(el) {
    var o = el.getAttribute("data-owner");
    if (o) return o;
    for (var p = el.parentNode; p && p.getAttribute; p = p.parentNode) {
      var n = p.getAttribute("data-node");
      if (n) return n;
    }
    return "";
  }

  function boxesOf(svg) {
    var list = svg.querySelectorAll("text");
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      var s = el.textContent || "";
      var fs = pf(el.getAttribute("font-size"), 12);
      var w = chars(s) * fs * CHAR_W;
      var h = fs * LINE_H;
      var x = pf(el.getAttribute("x"), 0);
      var y = pf(el.getAttribute("y"), 0);
      var anchor = el.getAttribute("text-anchor") || "start";
      var left = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
      var owner = ownerOf(el);
      var role = el.getAttribute("data-role") || "text";
      out.push({
        el: el, text: s, role: role, owner: owner, anchor: anchor, fontSize: fs,
        x: left, y: y - fs * ASCENT, w: w, h: h,
        desc: (owner ? owner + " " : "") + role + ' "' + short(s) + '"'
      });
    }
    return out;
  }

  function hit(a, b) {
    return a.x + TOL < b.x + b.w && b.x + TOL < a.x + a.w &&
           a.y + TOL < b.y + b.h && b.y + TOL < a.y + a.h;
  }

  function overlapsOf(svg, nodes) {
    var boxes = boxesOf(svg).filter(function (b) { return b.w > 0 && b.text.trim() !== ""; });
    var out = [];
    var i, j;
    for (i = 0; i < boxes.length; i++) {
      for (j = i + 1; j < boxes.length; j++) {
        if (hit(boxes[i], boxes[j])) out.push({ a: boxes[i].desc, b: boxes[j].desc, kind: "text-text" });
      }
    }
    var ids = Object.keys(nodes || {});
    for (i = 0; i < boxes.length; i++) {
      for (j = 0; j < ids.length; j++) {
        if (boxes[i].owner === ids[j]) continue;   // a node's own lines may sit inside its box
        var n = nodes[ids[j]];
        var nb = { x: n.cx - n.w / 2, y: n.cy - n.h / 2, w: n.w, h: n.h };
        if (hit(boxes[i], nb)) out.push({ a: boxes[i].desc, b: 'box of node "' + ids[j] + '"', kind: "text-node" });
      }
    }
    return out;
  }

  /* ---------- arch: shapes and node text ---------- */

  function dbRy(h, w) { return Math.max(4, Math.min(9, h / 8, w / 4)); }

  function defaultSize(ns, shape) {
    if (shape === "person") return { w: 40, h: 48 };
    var n = 0, maxW = 0;
    LINES.forEach(function (k) {
      if (has(ns[k])) { n++; maxW = Math.max(maxW, textW(ns[k], FS[k])); }
    });
    var w = Math.max(90, Math.ceil(maxW + 24));
    var h = n <= 1 ? 44 : n === 2 ? 52 : 62;
    if (shape === "db") h += 14;
    return { w: w, h: h };
  }

  // Draws the shape inside the w x h box centered on (cx, cy). Returns the main element.
  function drawShape(doc, g, shape, cx, cy, w, h) {
    var L = cx - w / 2, T = cy - h / 2, R = cx + w / 2, B = cy + h / 2;
    if (shape === "db") {
      var ry = dbRy(h, w), rx = w / 2;
      var arc = "A" + fmt(rx) + "," + fmt(ry) + " 0 0 0 ";
      var body = mk(doc, "path", {
        d: "M" + pt(L, T + ry) + " L" + pt(L, B - ry) + " " + arc + pt(R, B - ry) +
           " L" + pt(R, T + ry) + " " + arc + pt(L, T + ry) + " Z"
      }, g);
      mk(doc, "ellipse", { cx: cx, cy: T + ry, rx: rx, ry: ry }, g);
      return body;
    }
    if (shape === "person") {
      // Head is an <ellipse> (contract section 7 styles rect, ellipse and path).
      var r = Math.max(3, Math.min(w * 0.28, h * 0.22));
      var top = T + 2 * r + 3;
      var rr = Math.max(0, Math.min(w / 2, (B - top) * 0.8));
      var torso = mk(doc, "path", {
        d: "M" + pt(L, B) + " L" + pt(L, top + rr) + " Q" + pt(L, top) + " " + pt(L + rr, top) +
           " L" + pt(R - rr, top) + " Q" + pt(R, top) + " " + pt(R, top + rr) + " L" + pt(R, B) + " Z"
      }, g);
      mk(doc, "ellipse", { cx: cx, cy: T + r, rx: r, ry: r }, g);
      return torso;
    }
    var rad = shape === "cloud" ? Math.min(h / 2, w / 2, 22) : Math.min(8, h / 2, w / 2);
    return mk(doc, "rect", { x: L, y: T, width: w, height: h, rx: rad }, g);
  }

  function makeLine(doc, node, k, value) {
    return text(doc, node.g, {
      x: node.cx, y: node.cy, text: value, cls: LINE_CLASS[k], fs: FS[k],
      weight: k === "label" ? 600 : null, anchor: "middle", role: k
    });
  }

  /* Places a node's text lines (contract section 4). One line is centered.
     Two lines are centered as a pair (cy-4, cy+13). Three lines sit at
     cy-10, cy+7, cy+23. When the text area is taller than TALL, lines are
     spread evenly. align "left" starts lines at x - w/2 + 12. A db shape
     measures from below its top cap. A person puts its lines under the figure. */
  function layoutLines(node) {
    var present = [];
    var i;
    for (i = 0; i < LINES.length; i++) if (node[LINES[i]]) present.push(LINES[i]);
    var n = present.length;
    if (!n) return;
    var x, anchor, ys = [];
    if (node.shape === "person") {
      x = node.cx;
      anchor = "middle";
      for (i = 0; i < n; i++) ys.push(node.cy + node.h / 2 + 15 + i * 16);
    } else {
      var tcy = node.cy, th = node.h;
      if (node.shape === "db") {
        var ry = dbRy(node.h, node.w);
        tcy += ry / 2;
        th -= ry;
      }
      if (node.align === "left") { x = node.cx - node.w / 2 + 12; anchor = "start"; }
      else { x = node.cx; anchor = "middle"; }
      if (n === 1) ys.push(tcy + FS[present[0]] * 0.35);
      else if (th > TALL) {
        for (i = 0; i < n; i++) ys.push(tcy - th / 2 + (i + 1) * th / (n + 1) + FS[present[i]] * 0.35);
      } else if (n === 2) ys = [tcy - 4, tcy + 13];
      else ys = [tcy - 10, tcy + 7, tcy + 23];
    }
    for (i = 0; i < n; i++) {
      var el = node[present[i]];
      el.setAttribute("x", fmt(x));
      el.setAttribute("y", fmt(ys[i]));
      el.setAttribute("text-anchor", anchor);
    }
  }

  function applyState(node, state) {
    var s = token(state);
    node.state = s;
    node.g.setAttribute("class", s ? "dg-node st-" + s : "dg-node");
  }

  /* ---------- arch: edge geometry ---------- */

  // Where the ray from the node center toward q leaves the node's bounding box.
  // Returns null when q is inside the box (the end then stays at the center).
  function borderPoint(n, q) {
    var dx = q[0] - n.cx, dy = q[1] - n.cy;
    if (dx === 0 && dy === 0) return null;
    var tx = dx !== 0 ? (n.w / 2) / Math.abs(dx) : Infinity;
    var ty = dy !== 0 ? (n.h / 2) / Math.abs(dy) : Infinity;
    var t = Math.min(tx, ty);
    if (t >= 1) return null;
    return [n.cx + dx * t, n.cy + dy * t];
  }

  // pts runs from a's center, through any via points, to b's center.
  // Clips both ends at the box borders and leaves END_GAP before the arrow tip.
  function clipEdge(pts, a, b) {
    var p = pts.map(function (q) { return [q[0], q[1]]; });
    var n = p.length;
    var s = borderPoint(a, p[1]);
    if (s) p[0] = s;
    var e = borderPoint(b, p[n - 2]);
    if (e) {
      var prev = p[n - 2];
      var dx = prev[0] - e[0], dy = prev[1] - e[1];
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        var gap = Math.min(END_GAP, len / 2);
        e = [e[0] + dx / len * gap, e[1] + dy / len * gap];
      }
      p[n - 1] = e;
    }
    return p;
  }

  function pathD(pts) {
    return "M" + pts.map(function (q) { return pt(q[0], q[1]); }).join(" L");
  }

  // The point at fraction f of the polyline's total length.
  function pointAt(pts, f) {
    var segs = [], total = 0, i;
    for (i = 1; i < pts.length; i++) {
      var dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      var l = Math.sqrt(dx * dx + dy * dy);
      segs.push(l);
      total += l;
    }
    if (!(total > 0)) return [pts[0][0], pts[0][1]];
    var target = clamp(f, 0, 1) * total;
    for (i = 0; i < segs.length; i++) {
      if (target <= segs[i] || i === segs.length - 1) {
        var r = segs[i] > 0 ? Math.min(1, target / segs[i]) : 0;
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r];
      }
      target -= segs[i];
    }
    return [pts[0][0], pts[0][1]];
  }

  /* ---------- arch ---------- */

  function renderArch(spec, ctx) {
    var doc = ctx.doc, svg = ctx.svg;
    var W = num(spec.w, 740);
    // Layers, bottom to top: groups, edges and their labels, dots, nodes, notes.
    var gGroups = mk(doc, "g", { "data-layer": "groups" }, svg);
    var gEdges = mk(doc, "g", { "data-layer": "edges" }, svg);
    var dots = mk(doc, "g", { "data-layer": "dots" }, svg);
    var gNodes = mk(doc, "g", { "data-layer": "nodes" }, svg);
    var gNotes = mk(doc, "g", { "data-layer": "notes" }, svg);
    var nodes = {}, edges = {}, names = [], nameOf = {}, links = [];
    var maxY = 0;

    (Array.isArray(spec.groups) ? spec.groups : []).forEach(function (gs) {
      if (!isObj(gs)) return;
      var x = num(gs.x, 0), y = num(gs.y, 0), w = num(gs.w, 0), h = num(gs.h, 0);
      mk(doc, "rect", { "class": "dg-group", x: x, y: y, width: w, height: h, rx: 10 }, gGroups);
      if (has(gs.label)) {
        text(doc, gGroups, {
          x: x + 10, y: y + 17, text: str(gs.label).toUpperCase(), cls: "dg-group-label",
          fs: FS.group, anchor: "start", role: "group label"
        });
      }
      maxY = Math.max(maxY, y + h);
    });

    (Array.isArray(spec.nodes) ? spec.nodes : []).forEach(function (ns, idx) {
      if (!isObj(ns) || !has(ns.id)) { ctx.warnings.push("node " + idx + " skipped: no id"); return; }
      var id = str(ns.id);
      if (own(nodes, id)) ctx.warnings.push('duplicate node id "' + id + '"');
      var shape = own(SHAPES, ns.shape) ? ns.shape : "box";
      var size = defaultSize(ns, shape);
      var w = num(ns.w, size.w), h = num(ns.h, size.h);
      var cx = num(ns.x, 0), cy = num(ns.y, 0);
      var g = mk(doc, "g", { "class": "dg-node", "data-node": id }, gNodes);
      var node = {
        id: id, g: g, shape: shape, shapeEl: drawShape(doc, g, shape, cx, cy, w, h),
        label: null, sub: null, meta: null, cx: cx, cy: cy, w: w, h: h,
        align: ns.align === "left" ? "left" : "", state: ""
      };
      var lineCount = 0;
      LINES.forEach(function (k) {
        if (has(ns[k])) { node[k] = makeLine(doc, node, k, ns[k]); lineCount++; }
      });
      layoutLines(node);
      applyState(node, ns.tone);
      nodes[id] = node;
      nameOf[id] = has(ns.label) ? str(ns.label) : id;
      names.push(nameOf[id]);
      var below = shape === "person" && lineCount ? 15 + 16 * (lineCount - 1) + 4 : 0;
      maxY = Math.max(maxY, cy + h / 2 + below);
    });

    (Array.isArray(spec.edges) ? spec.edges : []).forEach(function (es, idx) {
      if (!isObj(es)) return;
      var a = own(nodes, str(es.from)) ? nodes[str(es.from)] : null;
      var b = own(nodes, str(es.to)) ? nodes[str(es.to)] : null;
      if (!a || !b) {
        ctx.warnings.push("edge " + idx + " skipped: unknown node " + (a ? str(es.to) : str(es.from)));
        return;
      }
      var pts = [[a.cx, a.cy]];
      (Array.isArray(es.via) ? es.via : []).forEach(function (p) {
        if (Array.isArray(p) && p.length >= 2) {
          pts.push([num(p[0], 0), num(p[1], 0)]);
          maxY = Math.max(maxY, num(p[1], 0));
        }
      });
      pts.push([b.cx, b.cy]);
      pts = clipEdge(pts, a, b);
      var key = a.id + ">" + b.id;
      if (own(edges, key)) {
        var k = 2;
        while (own(edges, key + "#" + k)) k++;
        key = key + "#" + k;
      }
      var tone = token(es.tone);
      var dash = es.dash === true ? "5 4" :
        (typeof es.dash === "string" && /^[0-9.,\s]+$/.test(es.dash) ? es.dash : null);
      // fill="none" keeps elbow paths from rendering as filled polygons before CSS loads.
      var path = mk(doc, "path", {
        "class": joinCls("dg-edge", toneCls(tone)), d: pathD(pts), fill: "none",
        "stroke-dasharray": dash, "marker-end": ctx.marker(tone), "data-edge": key
      }, gEdges);
      var labelEl = null;
      if (has(es.label)) {
        var lp = pointAt(pts, num(es.at, 0.5));
        labelEl = text(doc, gEdges, {
          x: lp[0] + num(es.dx, 0), y: lp[1] + num(es.dy, -8), text: es.label,
          cls: joinCls("dg-edge-label", toneCls(tone)), fs: FS.edge,
          anchor: own(ANCHORS, es.anchor) ? es.anchor : "middle", role: "edge label", owner: key
        });
      }
      edges[key] = { path: path, labelEl: labelEl, from: a.id, to: b.id, tone: tone, state: "", points: pts };
      links.push(nameOf[a.id] + " to " + nameOf[b.id] + (has(es.label) ? ": " + str(es.label) : ""));
    });

    (Array.isArray(spec.notes) ? spec.notes : []).forEach(function (n) {
      if (!isObj(n) || !has(n.text)) return;
      var y = num(n.y, 0);
      text(doc, gNotes, {
        x: num(n.x, 0), y: y, text: n.text, cls: joinCls("dg-note", toneCls(n.tone)), fs: FS.note,
        weight: 600, anchor: own(ANCHORS, n.anchor) ? n.anchor : "middle", role: "note"
      });
      maxY = Math.max(maxY, y + 6);
    });

    var H = num(spec.h, 0) > 0 ? num(spec.h, 0) : Math.max(60, Math.ceil(maxY + 20));
    var aria = "Architecture diagram" + (names.length ? " with " + names.join(", ") : "") + "." +
      (links.length ? " " + links.join(". ") + "." : "");
    return { w: W, h: H, nodes: nodes, edges: edges, dots: dots, aria: aria };
  }

  /* ---------- sequence (schema doc section 3.2) ---------- */

  function renderSequence(spec, ctx) {
    var doc = ctx.doc, svg = ctx.svg;
    var lanes = (Array.isArray(spec.lanes) ? spec.lanes : []).map(str);
    var W = num(spec.w, 740);
    var M = 10;
    var spacing = (W - 2 * M) / Math.max(1, lanes.length);
    function laneX(i) { return M + (i + 0.5) * spacing; }
    function laneOf(v) {
      if (typeof v === "number") return v >= 0 && v < lanes.length && Math.floor(v) === v ? v : -1;
      return lanes.indexOf(str(v));
    }
    function isSet(v) { return v !== null && v !== undefined; }

    // Outcomes are stacked at the end; every other step takes one row.
    var flow = [], outcomes = [];
    (Array.isArray(spec.steps) ? spec.steps : []).forEach(function (s) {
      if (!isObj(s)) return;
      if (isSet(s.outcome)) outcomes.push(s); else flow.push(s);
    });

    var HEAD_Y = 12, HEAD_H = 30, FIRST = 50, ROW = 34, NOTE2 = 48;
    var OUT_H = 30, OUT_GAP = 8;
    var rows = [], y = FIRST;
    flow.forEach(function (s) {
      var h = isSet(s.note) && !isSet(s.span) && has(s.sub) ? NOTE2 : ROW;   // a two-line note needs a taller row
      rows.push({ top: y, h: h });
      y += h;
    });
    var flowBottom = y;
    var outTop = flowBottom + 8;
    var H = outcomes.length ? outTop + outcomes.length * (OUT_H + OUT_GAP) - OUT_GAP + 12 : flowBottom + 12;
    H = Math.max(H, num(spec.h, 0));

    var gBack = mk(doc, "g", { "data-layer": "lanes" }, svg);
    var gSpan = mk(doc, "g", { "data-layer": "spans" }, svg);
    var gNote = mk(doc, "g", { "data-layer": "notes" }, svg);
    var gMsg = mk(doc, "g", { "data-layer": "messages" }, svg);
    var gOut = mk(doc, "g", { "data-layer": "outcomes" }, svg);
    var said = [];

    lanes.forEach(function (name, i) {
      var cx = laneX(i);
      var hw = Math.min(spacing - 12, Math.max(90, textW(name, FS.label) + 24));
      mk(doc, "rect", { "class": "dg-lane", x: cx - hw / 2, y: HEAD_Y, width: hw, height: HEAD_H, rx: 5 }, gBack);
      text(doc, gBack, {
        x: cx, y: HEAD_Y + 20, text: name, cls: "dg-label", fs: FS.label, weight: 600,
        anchor: "middle", role: "lane"
      });
      mk(doc, "line", {
        "class": "dg-lifeline", x1: cx, y1: HEAD_Y + HEAD_H, x2: cx, y2: H - 6, "stroke-dasharray": "3 4"
      }, gBack);
    });

    // A span covers the next `rows` steps after its own row.
    var spans = [];
    flow.forEach(function (s, i) {
      if (!isSet(s.span)) return;
      var lane = laneOf(s.span);
      if (lane < 0) { ctx.warnings.push("sequence step " + i + " skipped: unknown lane"); return; }
      var count = Math.max(0, Math.round(num(s.rows, 1)));
      spans.push({ lane: lane, from: i, last: Math.min(flow.length - 1, i + count), s: s });
    });
    function spanned(lane, i) {
      for (var k = 0; k < spans.length; k++) {
        if (spans[k].lane === lane && i > spans[k].from && i <= spans[k].last) return true;
      }
      return false;
    }

    flow.forEach(function (s, i) {
      var r = rows[i];
      var tone = token(s.tone);
      var lane, cx;

      if (isSet(s.span)) {
        lane = laneOf(s.span);
        if (lane < 0) return;
        var sp = null;
        for (var k = 0; k < spans.length; k++) if (spans[k].from === i) sp = spans[k];
        cx = laneX(lane);
        var r1 = rows[sp.last];
        var top = r.top + 12;
        var bottom = sp.last > i ? r1.top + r1.h - 4 : r.top + r.h - 2;
        mk(doc, "rect", {
          "class": joinCls("dg-span", toneCls(tone)), x: cx - 12, y: top, width: 24, height: Math.max(4, bottom - top)
        }, gSpan);
        if (has(s.label)) {
          var fits = cx + 18 + textW(s.label, FS.edge) <= W - 4;
          text(doc, gSpan, {
            x: fits ? cx + 18 : cx - 18, y: r.top + 22, text: s.label,
            cls: joinCls("dg-edge-label", toneCls(tone)), fs: FS.edge,
            anchor: fits ? "start" : "end", role: "span label", owner: lanes[lane]
          });
        }
        said.push(lanes[lane] + ": " + str(s.label));
        return;
      }

      if (isSet(s.note)) {
        lane = laneOf(s.note);
        if (lane < 0) { ctx.warnings.push("sequence step " + i + " skipped: unknown lane"); return; }
        cx = laneX(lane);
        var two = has(s.sub);
        var bw = Math.max(100, Math.max(textW(s.text, FS.sub), two ? textW(s.sub, FS.meta) : 0) + 24);
        var bx = clamp(cx - bw / 2, 4, W - 4 - bw);
        mk(doc, "rect", {
          "class": joinCls("dg-notebox", toneCls(tone)), x: bx, y: r.top + 3, width: bw, height: r.h - 6, rx: 4
        }, gNote);
        var tx = bx + bw / 2;
        if (two) {
          text(doc, gNote, { x: tx, y: r.top + 20, text: s.text, cls: "dg-sub", fs: FS.sub, anchor: "middle", role: "note" });
          text(doc, gNote, {
            x: tx, y: r.top + 36, text: s.sub, cls: joinCls("dg-meta", toneCls(tone)), fs: FS.meta,
            anchor: "middle", role: "note sub"
          });
        } else {
          text(doc, gNote, {
            x: tx, y: r.top + r.h / 2 + FS.sub * 0.35, text: s.text, cls: "dg-sub", fs: FS.sub,
            anchor: "middle", role: "note"
          });
        }
        said.push("Note on " + lanes[lane] + ": " + str(s.text) + (two ? ", " + str(s.sub) : ""));
        return;
      }

      if (!isSet(s.from) || !isSet(s.to)) { ctx.warnings.push("sequence step " + i + " skipped: unknown kind"); return; }
      var a = laneOf(s.from), b = laneOf(s.to);
      if (a < 0 || b < 0) { ctx.warnings.push("sequence step " + i + " skipped: unknown lane"); return; }
      var xa = laneX(a), xb = laneX(b), ya = r.top + 22;
      var d, lx, ly, anchor;
      if (a === b) {
        // A message to itself loops out to the right and back.
        var o = spanned(a, i) ? 13 : 3;
        d = "M" + pt(xa + o, ya - 6) + " H" + fmt(xa + 30) + " V" + fmt(ya + 6) + " H" + fmt(xa + o + 2);
        lx = xa + 36;
        ly = ya + 4;
        anchor = "start";
      } else {
        var dir = b > a ? 1 : -1;
        var x1 = xa + dir * (spanned(a, i) ? 13 : 3);
        var x2 = xb - dir * (spanned(b, i) ? 15 : 4);
        d = "M" + pt(x1, ya) + " H" + fmt(x2);
        var lw = textW(s.label, FS.edge);
        lx = clamp((xa + xb) / 2, 4 + lw / 2, W - 4 - lw / 2);
        ly = ya - 8;
        anchor = "middle";
      }
      mk(doc, "path", {
        "class": joinCls("dg-msg", toneCls(tone)), d: d, fill: "none",
        "stroke-dasharray": s.dash ? "4 3" : null, "marker-end": ctx.marker(tone)
      }, gMsg);
      if (has(s.label)) {
        text(doc, gMsg, {
          x: lx, y: ly, text: s.label, cls: joinCls("dg-edge-label", toneCls(tone)), fs: FS.edge,
          anchor: anchor, role: "message"
        });
      }
      said.push(lanes[a] + " to " + lanes[b] + (has(s.label) ? ": " + str(s.label) : ""));
    });

    // Outcome boxes: one stack under the target lanes, in step order.
    var placed = 0;
    outcomes.forEach(function (o, i) {
      var lane = laneOf(o.outcome);
      if (lane < 0) { ctx.warnings.push("sequence outcome " + i + " skipped: unknown lane"); return; }
      var bw = Math.max(120, textW(o.text, FS.sub) + 24);
      var bx = clamp(laneX(lane) - bw / 2, 4, W - 4 - bw);
      var by = outTop + placed * (OUT_H + OUT_GAP);
      placed++;
      mk(doc, "rect", {
        "class": joinCls("dg-outcome", toneCls(o.tone)), x: bx, y: by, width: bw, height: OUT_H, rx: 4
      }, gOut);
      text(doc, gOut, {
        x: bx + bw / 2, y: by + OUT_H / 2 + FS.sub * 0.35, text: o.text, cls: "dg-sub", fs: FS.sub,
        anchor: "middle", role: "outcome"
      });
      said.push("Outcome at " + lanes[lane] + ": " + str(o.text));
    });

    var aria = "Sequence diagram" + (lanes.length ? " between " + lanes.join(", ") : "") + "." +
      (said.length ? " " + said.join(". ") + "." : "");
    return { w: W, h: H, nodes: {}, edges: {}, dots: null, aria: aria };
  }

  /* ---------- timeline (schema doc section 3.3) ---------- */

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  // "HH:MM:SS" or "MM:SS" start time, or null.
  function parseClock(s) {
    if (typeof s !== "string" || !/^\d{1,2}(:\d{1,2}){1,2}$/.test(s.trim())) return null;
    var parts = s.trim().split(":").map(Number);
    var sec = 0;
    for (var i = 0; i < parts.length; i++) sec = sec * 60 + parts[i];
    return { sec: sec, parts: parts.length };
  }

  function clockText(t, parts) {
    var day = 86400;
    t = ((Math.round(t) % day) + day) % day;
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return parts === 3 ? pad2(h) + ":" + pad2(m) + ":" + pad2(s) : pad2(Math.floor(t / 60) % 60) + ":" + pad2(s);
  }

  function secText(t) { return (Math.round(t * 10) / 10) + "s"; }

  function niceStep(seconds) {
    var c = [1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 900, 1800, 3600];
    for (var i = 0; i < c.length; i++) if (seconds / c[i] <= 8) return c[i];
    return c[c.length - 1];
  }

  function renderTimeline(spec, ctx) {
    var doc = ctx.doc, svg = ctx.svg;
    var rows = (Array.isArray(spec.rows) ? spec.rows : []).filter(isObj);
    var marks = (Array.isArray(spec.markers) ? spec.markers : []).filter(isObj);
    function list(v) { return (Array.isArray(v) ? v : []).filter(function (x) { return Array.isArray(x) && x.length >= 2; }); }

    var seconds = num(spec.seconds, 0);
    if (!(seconds > 0)) {
      rows.forEach(function (r) {
        list(r.segments).concat(list(r.gaps)).forEach(function (s) { seconds = Math.max(seconds, num(s[1], 0)); });
      });
      marks.forEach(function (m) { seconds = Math.max(seconds, num(m.t, 0)); });
      if (!(seconds > 0)) seconds = 60;
    }
    var every = num(spec.ticksEvery, 0);
    if (!(every > 0)) every = niceStep(seconds);
    var W = num(spec.w, 660);
    var clock = parseClock(spec.start);
    function tlabel(t) { return clock ? clockText(clock.sec + t, clock.parts) : secText(t); }

    var ticks = [];
    for (var i = 0; i * every <= seconds + 1e-9 && ticks.length < 200; i++) ticks.push(i * every);
    var axisW = 0, rowW = 0;
    ticks.forEach(function (t) { axisW = Math.max(axisW, textW(tlabel(t), FS.meta)); });
    rows.forEach(function (r) { rowW = Math.max(rowW, textW(r.label, FS.sub)); });

    var x0 = Math.max(60, Math.ceil(rowW + 16), Math.ceil(axisW / 2 + 6));
    var x1 = Math.max(x0 + 10, W - Math.max(40, Math.ceil(axisW / 2 + 6)));
    var pps = (x1 - x0) / seconds;   // px per second
    function X(t) { return x0 + clamp(num(t, 0), 0, seconds) * pps; }

    // Marker labels go on stacked levels at the top so they never collide.
    var placedMarks = marks.map(function (m) {
      var cx = X(m.t), lw = has(m.label) ? textW(m.label, FS.edge) : 0;
      var p = { m: m, tone: has(m.tone) ? m.tone : "warn", cx: cx, lx: cx, anchor: "middle", left: cx - lw / 2, right: cx + lw / 2 };
      if (p.left < 4) { p.anchor = "start"; p.lx = Math.max(4, cx - 6); p.left = p.lx; p.right = p.lx + lw; }
      else if (p.right > W - 4) { p.anchor = "end"; p.lx = Math.min(W - 4, cx + 6); p.left = p.lx - lw; p.right = p.lx; }
      return p;
    }).sort(function (a, b) { return a.cx - b.cx; });
    var levelRight = [];
    placedMarks.forEach(function (p) {
      var lvl = 0;
      while (lvl < levelRight.length && levelRight[lvl] + 8 > p.left) lvl++;
      levelRight[lvl] = p.right;
      p.level = lvl;
    });
    function levelY(l) { return 20 + l * 14; }

    var top = levelRight.length ? levelY(levelRight.length - 1) + 4 : 8;
    var ROW_GAP = 45;
    var rowY0 = top + 34;
    var lastY = rowY0 + Math.max(0, rows.length - 1) * ROW_GAP;
    var axisY = lastY + 22;
    var H = Math.max(axisY + 34, num(spec.h, 0));

    var gMark = mk(doc, "g", { "data-layer": "markers" }, svg);
    var gRows = mk(doc, "g", { "data-layer": "rows" }, svg);
    var gText = mk(doc, "g", { "data-layer": "labels" }, svg);
    var gAxis = mk(doc, "g", { "data-layer": "axis" }, svg);
    var tickW = Math.min(1.6, pps * 0.4);
    var said = ["Timeline from " + tlabel(0) + " to " + tlabel(seconds) + "."];

    placedMarks.forEach(function (p) {
      var tone = toneCls(p.tone);
      mk(doc, "line", {
        "class": joinCls("dg-marker", tone), x1: p.cx, y1: levelY(p.level) + 8, x2: p.cx, y2: axisY,
        "stroke-dasharray": "4 3"
      }, gMark);
      if (has(p.m.label)) {
        text(doc, gText, {
          x: p.lx, y: levelY(p.level), text: p.m.label, cls: joinCls("dg-edge-label", tone), fs: FS.edge,
          anchor: p.anchor, role: "marker label"
        });
      }
    });

    rows.forEach(function (r, ri) {
      var y = rowY0 + ri * ROW_GAP;
      var bits = [];
      list(r.gaps).forEach(function (gp) {
        var a = X(gp[0]), b = X(gp[1]);
        if (b <= a) return;
        mk(doc, "rect", { "class": "dg-gap", x: a, y: y - 15, width: b - a, height: 30 }, gRows);
        mk(doc, "line", { "class": "dg-flat", x1: a, y1: y, x2: b, y2: y }, gRows);
        if (has(gp[2])) {
          text(doc, gText, {
            x: (a + b) / 2, y: y - 19, text: gp[2], cls: joinCls("dg-edge-label", toneCls(has(gp[3]) ? gp[3] : "bad")),
            fs: FS.edge, anchor: "middle", role: "gap label", owner: str(r.label)
          });
        }
        bits.push((has(gp[2]) ? str(gp[2]) : "gap") + " from " + tlabel(num(gp[0], 0)) + " to " + tlabel(num(gp[1], 0)));
      });
      list(r.segments).forEach(function (sg) {
        var s = clamp(num(sg[0], 0), 0, seconds), e = clamp(num(sg[1], 0), 0, seconds);
        if (e <= s) return;
        // One tick per second: dash + gap = px per second, offset so ticks land on whole seconds.
        var frac = s - Math.floor(s);
        mk(doc, "line", {
          "class": joinCls("dg-ticks", toneCls(sg[2])), x1: X(s), y1: y, x2: X(e), y2: y,
          "stroke-width": 16, "stroke-dasharray": fmt(tickW) + " " + fmt(Math.max(0, pps - tickW)),
          "stroke-dashoffset": frac > 1e-9 ? frac * pps : null
        }, gRows);
        bits.push((has(sg[2]) ? str(sg[2]) : "active") + " " + tlabel(s) + " to " + tlabel(e));
      });
      text(doc, gText, {
        x: x0 - 8, y: y + 4, text: r.label, cls: "dg-sub", fs: FS.sub, anchor: "end", role: "row label"
      });
      said.push(str(r.label) + ": " + bits.join("; ") + ".");
    });

    mk(doc, "line", { "class": "dg-axis", x1: x0, y1: axisY, x2: x1, y2: axisY }, gAxis);
    ticks.forEach(function (t) {
      var x = X(t);
      mk(doc, "line", { "class": "dg-axis", x1: x, y1: axisY, x2: x, y2: axisY + 4 }, gAxis);
      text(doc, gAxis, {
        x: x, y: axisY + 20, text: tlabel(t), cls: "dg-meta", fs: FS.meta, anchor: "middle", role: "axis label"
      });
    });

    placedMarks.forEach(function (p) {
      said.push("Marker at " + tlabel(num(p.m.t, 0)) + (has(p.m.label) ? ": " + str(p.m.label) : "") + ".");
    });
    return { w: W, h: H, nodes: {}, edges: {}, dots: null, aria: said.join(" ") };
  }

  /* ---------- render and handle ---------- */

  // Removes diagrams this module drew earlier into the same container.
  function removePrevious(container) {
    var kids = container.childNodes ? Array.prototype.slice.call(container.childNodes) : [];
    kids.forEach(function (el) {
      if (el && el.nodeType === 1 && el.getAttribute && el.getAttribute("data-dg") === "1") container.removeChild(el);
    });
  }

  function makeHandle(svg, type, r, ctx) {
    var nodes = r.nodes || {};
    var edges = r.edges || {};
    return {
      svg: svg,
      type: type,
      w: r.w,
      h: r.h,
      nodes: nodes,
      edges: edges,
      dotsLayer: r.dots || null,
      warnings: ctx.warnings,
      setNodeState: function (id, state) {
        if (!own(nodes, id)) return false;
        applyState(nodes[id], state);
        return true;
      },
      setNodeText: function (id, line, value) {
        if (!own(nodes, id) || LINES.indexOf(line) < 0) return false;
        var n = nodes[id];
        if (value === null || value === undefined) {
          if (n[line]) {
            if (n[line].parentNode) n[line].parentNode.removeChild(n[line]);
            n[line] = null;
            layoutLines(n);
          }
          return true;
        }
        if (n[line]) n[line].textContent = String(value);
        else { n[line] = makeLine(ctx.doc, n, line, value); layoutLines(n); }
        return true;
      },
      setEdgeState: function (key, state) {
        var e = own(edges, key) ? edges[key] : null;
        if (!e && typeof key === "string" && key.indexOf(">") > 0 && key.indexOf("#") < 0) {
          var parts = key.split(">");
          var rev = parts[1] + ">" + parts[0];
          e = own(edges, rev) ? edges[rev] : null;
        }
        if (!e) return false;
        e.state = token(state);
        e.path.setAttribute("class", joinCls("dg-edge", toneCls(e.tone), e.state));
        e.path.setAttribute("marker-end", ctx.marker(e.state === "cut" ? "bad" : e.tone));
        return true;
      },
      point: function (id) {
        return own(nodes, id) ? { x: nodes[id].cx, y: nodes[id].cy } : null;
      },
      textBoxes: function () { return boxesOf(svg); },
      overlaps: function () { return overlapsOf(svg, nodes); }
    };
  }

  /* render(spec, container, opts) draws spec into container (which may be null
     for a detached svg). opts: { append: true } keeps diagrams already drawn
     into the container; { className } adds a class to the svg. */
  function render(spec, container, opts) {
    opts = opts || {};
    if (!isObj(spec)) throw new Error("DL.diagram.render: spec must be an object");
    var type = spec.type;
    var draw = type === "arch" ? renderArch : type === "sequence" ? renderSequence :
      type === "timeline" ? renderTimeline : null;
    if (!draw) throw new Error('DL.diagram.render: unknown diagram type "' + str(type) + '"');
    var doc = docOf(container);
    var svg = mk(doc, "svg", {
      "class": joinCls("dg", opts.className ? str(opts.className) : ""),
      role: "img", "data-type": type, "data-dg": "1", "font-family": FONT
    });
    var ctx = { doc: doc, svg: svg, warnings: [] };
    ctx.defs = mk(doc, "defs", null, svg);
    ctx.marker = markerFactory(ctx);
    var r = draw(spec, ctx);
    // The viewBox is set after layout because heights may be computed.
    svg.setAttribute("viewBox", "0 0 " + fmt(r.w) + " " + fmt(r.h));
    svg.setAttribute("aria-label", has(spec.aria) ? str(spec.aria) : has(opts.aria) ? str(opts.aria) : r.aria);
    if (container) {
      if (!opts.append) removePrevious(container);
      container.appendChild(svg);
    }
    var handle = makeHandle(svg, type, r, ctx);
    if (registry) registry.set(svg, handle);
    return handle;
  }

  DL.diagram = {
    render: render,
    // The handle of an svg drawn by render(), or null. Lets the test runner
    // check diagrams that the case player drew.
    handleOf: function (svg) { return registry && isObj(svg) ? registry.get(svg) || null : null; }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = DL;
})(typeof window !== "undefined" ? window : globalThis);
