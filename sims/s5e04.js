/* sims/s5e04-v1.0.0.js  (published as sims/s5e04.js)
   Case s5e04 "Shapes and Contracts": a class-tree lab for Thimbleby Puppet Works, a puppet workshop
   whose care software (Python) has a class Puppet with a wash() method, and three kinds beneath it:
   Marionette, GloveFigure and ShadowPuppet. At 02:00 the night batch calls wash() for every puppet
   due a clean. wash() adds "wash, warm water, 10 min" to tomorrow's printed care sheet and writes
   "<name> washed" to the maintenance log. Nobody washes anything at night: the batch only writes.
   Widget-style sim: it draws the code, the care sheet and the maintenance log inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: five designs (inheritance as built, an empty override in
     ShadowPuppet, a type check in the batch, wash() raising an error in ShadowPuppet, composed care
     steps); a new puppet kind to test each design (none, the crane: a paper marionette, the swan:
     a washable silk shadow puppet). Next puppet, Run to 02:10, Reset. Stats: puppets reached, care
     sheet lines, false lines, puppets given care that suits them, puppets left without care and
     nothing said, the batch. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - The night batch takes the puppets in name order, one a second from 02:00:01, and calls each
     one's care. Times are sim clock seconds; 02:00:00 is 7200.
   - As built: every puppet inherits Puppet.wash(): a sheet line "wash, warm water, 10 min" and a
     log line "<name> washed".
   - Empty override: ShadowPuppet.wash() does nothing (pass): no sheet line, no log line.
   - Type check: the batch skips anything that is a ShadowPuppet (isinstance), writing
     "<name> skipped (ShadowPuppet)" to the log; no sheet line.
   - Raise: ShadowPuppet.wash() raises NotImplementedError; nothing catches it, so the batch stops
     there. The log gets "<name> ERROR, night batch stopped".
   - Composed: Puppet has no wash(). Each puppet is made with a list of care steps: Wash for cloth
     and silk, DryBrush for paper ("dry brush, soft bristles", log "<name> dry-brushed").
   - A false line: a "washed" line for a paper puppet. Care that suits: Wash for cloth or silk,
     DryBrush for paper. Silent: a puppet left without care with nothing in the log about it.

   Where every number comes from (conventions rule 14; the case is content/s5/s5e04-v1.0.0.json).
   - The puppets, in name order: baker (GloveFigure, cloth), fiddler (Marionette, cloth), goose
     (GloveFigure, cloth), heron, lantern-bearer, moon (ShadowPuppet, paper), pedlar (GloveFigure,
     cloth), ploughman, queen, wolf (Marionette, cloth). 10 puppets: 4 marionettes, 3 glove
     figures, 3 shadow puppets. Heron is 4th: 02:00:04; lantern-bearer 02:00:05; moon 02:00:06.
   - New kinds: crane, class PaperMarionette(Marionette), paper, 2nd in name order; swan, class
     SilkShadow(ShadowPuppet), washable silk, 10th (between queen and wolf).
   - As built: 10 sheet lines, 10 "washed" lines, 3 false (heron, lantern-bearer, moon), care that
     suits 7 of 10. Crane: 11 lines, 4 false, 7 of 11. Swan: 11 lines, 3 false, 8 of 11.
   - Empty override: 7 lines, 0 false, 7 of 10, 3 silent. Crane: 8 lines, 1 false (crane), 7 of 11,
     3 silent. Swan: 7 lines, 0 false, 7 of 11, 4 silent.
   - Type check: 7 lines, 0 false, 7 of 10, 0 silent (3 skip lines). Crane: 8 lines, 1 false.
     Swan: 7 lines, 7 of 11 (the swan is skipped too).
   - Raise: baker, fiddler, goose washed; stopped at the heron (4 of 10 reached): 3 lines, 0 false,
     3 of 10. Crane: baker, crane, fiddler, goose, then the heron: 4 lines, 1 false, 3 of 11.
   - Composed: 10 lines (7 wash, 3 dry brush), 0 false, 10 of 10. Crane 11 of 11, swan 11 of 11.
*/
(function () {
  "use strict";

  var T0 = 7200; // 02:00:00
  var BASE = [
    { name: "baker", cls: "GloveFigure", stuff: "cloth" },
    { name: "fiddler", cls: "Marionette", stuff: "cloth" },
    { name: "goose", cls: "GloveFigure", stuff: "cloth" },
    { name: "heron", cls: "ShadowPuppet", stuff: "paper" },
    { name: "lantern-bearer", cls: "ShadowPuppet", stuff: "paper" },
    { name: "moon", cls: "ShadowPuppet", stuff: "paper" },
    { name: "pedlar", cls: "GloveFigure", stuff: "cloth" },
    { name: "ploughman", cls: "Marionette", stuff: "cloth" },
    { name: "queen", cls: "Marionette", stuff: "cloth" },
    { name: "wolf", cls: "Marionette", stuff: "cloth" }
  ];
  var KINDS = {
    crane: { name: "crane", cls: "PaperMarionette", parent: "Marionette", stuff: "paper" },
    swan: { name: "swan", cls: "SilkShadow", parent: "ShadowPuppet", stuff: "silk" }
  };
  var DESIGNS = [
    { value: "built", label: "Inheritance, as built" },
    { value: "override", label: "Empty override in ShadowPuppet" },
    { value: "typecheck", label: "Type check in the batch" },
    { value: "raise", label: "wash() raises in ShadowPuppet" },
    { value: "composed", label: "Composed care steps" }
  ];
  var NEWKINDS = [
    { value: "none", label: "None" },
    { value: "crane", label: "The crane: a paper Marionette" },
    { value: "swan", label: "The swan: a washable silk ShadowPuppet" }
  ];
  var WASH = "wash, warm water, 10 min";
  var BRUSH = "dry brush, soft bristles";

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(s) { return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s % 3600 / 60)) + ":" + pad(s % 60); }
  function and(list) {
    if (list.length < 2) return list.join("");
    return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
  }
  function labelOf(list, v) {
    for (var i = 0; i < list.length; i++) if (list[i].value === v) return list[i].label;
    return v;
  }

  /* ---------- the model ---------- */

  function puppets(C) {
    var out = BASE.slice();
    if (KINDS[C.kind]) out.push(KINDS[C.kind]);
    out.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    return out;
  }
  function isShadow(p) { return p.cls === "ShadowPuppet" || p.parent === "ShadowPuppet"; }
  function washable(p) { return p.stuff !== "paper"; }

  // One pure function: settings in, the whole night out.
  function simulate(C) {
    var list = puppets(C);
    var ev = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var e = { t: T0 + i + 1, p: p, act: "wash" };
      if (C.design === "override" && isShadow(p)) e.act = "nothing";
      else if (C.design === "typecheck" && isShadow(p)) e.act = "skip";
      else if (C.design === "raise" && isShadow(p)) e.act = "raise";
      else if (C.design === "composed" && !washable(p)) e.act = "brush";
      e.sheet = e.act === "wash" ? WASH : (e.act === "brush" ? BRUSH : null);
      e.mlog = e.act === "wash" ? "washed" : e.act === "brush" ? "dry-brushed" : e.act === "skip" ? "skipped (ShadowPuppet)" :
        e.act === "raise" ? "ERROR, night batch stopped" : null;
      e.falseLine = e.act === "wash" && !washable(p);
      e.suits = (e.act === "wash" && washable(p)) || (e.act === "brush" && !washable(p));
      e.silent = e.act === "nothing";
      ev.push(e);
      if (e.act === "raise") break;
    }
    return { list: list, ev: ev, stopped: ev.length && ev[ev.length - 1].act === "raise" ? ev[ev.length - 1].p.name : null };
  }

  function summary(S) {
    var M = S.M;
    var N = M.list.length;
    var done = M.ev.slice(0, S.k);
    var sheet = 0, falses = 0, suits = 0, silent = 0;
    done.forEach(function (e) {
      if (e.sheet) sheet += 1;
      if (e.falseLine) falses += 1;
      if (e.suits) suits += 1;
      if (e.silent) silent += 1;
    });
    var batch = "not started";
    if (S.k > 0) batch = "running";
    if (S.k === M.ev.length) batch = M.stopped ? "stopped at the " + M.stopped : "finished";
    return { done: S.k + " of " + N, sheet: sheet, falses: falses, suits: suits + " of " + N, silent: silent, batch: batch };
  }

  function lineFor(e) {
    var n = e.p.name;
    if (e.act === "wash") {
      return e.falseLine ? { text: n + " washed. Care sheet: " + WASH + ". FALSE: the " + n + " is paper, and nobody has touched it.", tone: "bad" }
        : { text: n + " washed. Care sheet: " + WASH + ".", tone: "" };
    }
    if (e.act === "brush") return { text: n + " dry-brushed. Care sheet: " + BRUSH + ".", tone: "ok" };
    if (e.act === "skip") return { text: n + " skipped by the type check: no care tonight, and the log says so.", tone: "warn" };
    if (e.act === "nothing") return { text: n + ": wash() did nothing. No line on the sheet, nothing in the log.", tone: "warn" };
    return { text: n + ": wash() raised NotImplementedError. Nothing caught it, so the night batch stopped.", tone: "bad" };
  }

  /* ---------- the code each design runs ---------- */

  function code(C) {
    var L = [];
    if (C.design === "composed") {
      L.push("class Wash:", "    def run(self, p): ...   # \"" + WASH + "\"",
        "class DryBrush:", "    def run(self, p): ...   # \"" + BRUSH + "\"",
        "heron = ShadowPuppet(\"heron\", care=[DryBrush()])",
        "goose = GloveFigure(\"goose\", care=[Wash()])");
      if (C.kind === "crane") L.push("crane = PaperMarionette(\"crane\", care=[DryBrush()])");
      if (C.kind === "swan") L.push("swan = SilkShadow(\"swan\", care=[Wash()])");
      L.push("for p in puppets:", "    for step in p.care: step.run(p)");
      return L.join("\n");
    }
    L.push("class Puppet:", "    def wash(self):   # sheet: \"" + WASH + "\"; log: washed",
      "class Marionette(Puppet): ...", "class GloveFigure(Puppet): ...");
    if (C.design === "override") L.push("class ShadowPuppet(Puppet):", "    def wash(self): pass");
    else if (C.design === "raise") L.push("class ShadowPuppet(Puppet):", "    def wash(self): raise NotImplementedError(\"paper\")");
    else L.push("class ShadowPuppet(Puppet): ...     # paper");
    if (C.kind === "crane") L.push("class PaperMarionette(Marionette): ...   # paper");
    if (C.kind === "swan") L.push("class SilkShadow(ShadowPuppet): ...   # silk, washable");
    if (C.design === "typecheck") L.push("for p in puppets:", "    if isinstance(p, ShadowPuppet): continue", "    p.wash()");
    else L.push("for p in puppets: p.wash()          # night batch, 02:00");
    return L.join("\n");
  }

  /* ---------- the widget ---------- */

  function build(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var wrap = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;");
    var head = el("p", "margin:0;");
    var codeEl = el("pre", "margin:0;padding:8px;overflow-x:auto;border:1px solid currentColor;border-radius:4px;font-size:11px;");
    var cols = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;min-width:0;");
    var sheetBox = el("div", "min-width:0;");
    sheetBox.appendChild(el("strong", "", "Tomorrow's care sheet (printed for 07:30)"));
    var sheetList = el("ol", "margin:4px 0 0 18px;padding:0;");
    sheetBox.appendChild(sheetList);
    var logBox = el("div", "min-width:0;");
    logBox.appendChild(el("strong", "", "Maintenance log"));
    var logList = el("ul", "margin:4px 0 0 0;padding:0;list-style:none;font-family:monospace;font-size:11px;");
    logBox.appendChild(logList);
    cols.appendChild(sheetBox);
    cols.appendChild(logBox);
    wrap.appendChild(head);
    wrap.appendChild(codeEl);
    wrap.appendChild(cols);
    api.root.appendChild(wrap);
    return { el: el, head: head, code: codeEl, sheet: sheetList, log: logList };
  }

  function show(api) {
    var S = api.state;
    var ui = S.ui;
    var sm = summary(S);
    ui.head.textContent = "Design: " + labelOf(DESIGNS, S.C.design).toLowerCase() + ". New kind: " +
      labelOf(NEWKINDS, S.C.kind).toLowerCase() + ". " + S.M.list.length + " puppets due a clean, in name order.";
    ui.code.textContent = code(S.C);
    while (ui.sheet.firstChild) ui.sheet.removeChild(ui.sheet.firstChild);
    while (ui.log.firstChild) ui.log.removeChild(ui.log.firstChild);
    S.M.ev.slice(0, S.k).forEach(function (e) {
      if (e.sheet) ui.sheet.appendChild(ui.el("li", "", e.p.name + ": " + e.sheet + (e.falseLine ? "   (paper!)" : "")));
      if (e.mlog) {
        ui.log.appendChild(ui.el("li", e.falseLine ? "font-weight:700;" : "",
          hms(e.t) + "  " + e.p.name + "  " + e.mlog + (e.falseLine ? "   <- false" : "")));
      }
    });
    S.stat.done(sm.done);
    S.stat.sheet(sm.sheet);
    S.stat.falses(sm.falses);
    S.stat.suits(sm.suits);
    S.stat.silent(sm.silent);
    S.stat.batch(sm.batch);
  }

  function nextPuppet(api) {
    var S = api.state;
    if (S.k >= S.M.ev.length) return false;
    var e = S.M.ev[S.k];
    api.clock = e.t;
    var ln = lineFor(e);
    api.log(ln.text, ln.tone);
    S.k += 1;
    if (S.k === S.M.ev.length && S.M.stopped) {
      var left = S.M.list.length - S.k;
      api.log("The batch stopped at the " + S.M.stopped + ". " + left + " puppets after it got no care tonight.", "bad");
    }
    show(api);
    return true;
  }

  function toTen(api) {
    var S = api.state;
    while (nextPuppet(api)) { /* every puppet in turn */ }
    if (S.ended) return;
    S.ended = true;
    var sm = summary(S);
    var bad = S.M.ev.filter(function (e) { return e.falseLine; }).map(function (e) { return "the " + e.p.name; });
    api.clock = T0 + 600;
    var txt = "02:10. Batch " + sm.batch + ": " + sm.sheet + " lines on the care sheet, " + sm.falses + " false";
    if (bad.length) txt += ". The glass case: " + and(bad) + " hang dry, and the log says " + (bad.length === 1 ? "it was" : "they were") + " washed.";
    else txt += ". No paper puppet is down for warm water.";
    txt += " Care that suits: " + sm.suits + ".";
    api.log(txt, bad.length ? "bad" : (sm.silent || S.M.stopped ? "warn" : "ok"));
    show(api);
  }

  function rewind(api, what) {
    var S = api.state;
    S.M = simulate(S.C);
    S.k = 0;
    S.ended = false;
    api.clock = T0;
    api.log(what + " Rewound to 02:00:00.", "");
    show(api);
  }

  DL.sims.define("s5e04", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      api.clock = T0;
      S.C = { design: "built", kind: "none" };
      S.k = 0;
      S.ended = false;
      S.ui = build(api);
      S.M = simulate(S.C);
      api.control.select("design", "How puppet care is coded", DESIGNS, "built", function (v) {
        S.C.design = String(v);
        rewind(api, "Design: " + labelOf(DESIGNS, S.C.design).toLowerCase() + ".");
      });
      api.control.select("kind", "Add a new puppet kind", NEWKINDS, "none", function (v) {
        S.C.kind = String(v);
        rewind(api, S.C.kind === "none" ? "No new puppet kind." : labelOf(NEWKINDS, S.C.kind) + ", joins the list.");
      });
      api.control.button("next", "Next puppet", function () { nextPuppet(api); });
      api.control.button("run", "Run to 02:10", function () { toTen(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        done: api.stat("done", "puppets the batch reached", ""),
        sheet: api.stat("sheet", "lines on tomorrow's care sheet", ""),
        falses: api.stat("false", "false \"washed\" lines (paper)", "bad"),
        suits: api.stat("suits", "puppets given care that suits them", "ok"),
        silent: api.stat("silent", "left without care, nothing said", "warn"),
        batch: api.stat("batch", "night batch", "")
      };
      api.info("<strong>How to read it.</strong> The code at the top is the design in use. At 02:00 the night batch takes the puppets in name order and runs each one's care. Each step adds a line to tomorrow's printed care sheet and writes a line to the maintenance log. Nobody washes anything at night: the lines are only promises. A false line says a paper puppet was washed.");
      api.log("02:00:00, before the night batch. 10 puppets due a clean; the heron, the lantern-bearer and the moon are paper.", "");
      show(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      // Whole-log check: each string checked is unique to the run that makes it (the log keeps 14 lines).
      function has(s) { return mark >= 0 && t.logText().indexOf(s) >= 0; }
      function run(design, kind) {
        t.set("design", design);
        t.set("kind", kind);
        t.click("run");
      }

      // 1. Opens at 02:00:00, before the batch has run.
      t.expect(t.stat("done") === "0 of 10" && t.stat("sheet") === 0 && t.stat("false") === 0 && t.stat("batch") === "not started" &&
        t.logText().indexOf("02:00:00, before the night batch.") >= 0,
        "Opens at 02:00:00 with nothing run: 0 of 10 reached, an empty care sheet");

      // 2. The fourth puppet is the heron: the first false line.
      begin();
      t.click("next"); t.click("next"); t.click("next"); t.click("next");
      t.expect(has("heron washed. Care sheet: wash, warm water, 10 min. FALSE: the heron is paper") &&
        t.stat("done") === "4 of 10" && t.stat("false") === 1 && t.stat("sheet") === 4,
        "02:00:04: the heron is washed on paper only, the first false line");

      // 3. As built, the whole night: three false lines at 02:10.
      begin();
      t.click("run");
      t.expect(t.stat("sheet") === 10 && t.stat("false") === 3 && t.stat("suits") === "7 of 10" && t.stat("silent") === 0 &&
        t.stat("batch") === "finished" &&
        has("02:10. Batch finished: 10 lines on the care sheet, 3 false. The glass case: the heron, the lantern-bearer and the moon hang dry, and the log says they were washed."),
        "As built: 10 lines, 3 false (heron, lantern-bearer, moon), care that suits 7 of 10");

      // 4. As built with the crane: a fourth false line.
      run("built", "crane");
      t.expect(t.stat("sheet") === 11 && t.stat("false") === 4 && t.stat("suits") === "7 of 11",
        "As built plus the crane: 11 lines, 4 false");

      // 5. Empty override: no false lines tonight, but three puppets silently get nothing.
      run("override", "none");
      t.expect(t.stat("sheet") === 7 && t.stat("false") === 0 && t.stat("suits") === "7 of 10" && t.stat("silent") === 3,
        "Empty override: 7 lines, 0 false, 3 paper puppets left without care and nothing said");

      // 6. Empty override with each new kind.
      run("override", "crane");
      var oc = t.stat("false") === 1 && t.stat("sheet") === 8 && t.stat("silent") === 3;
      run("override", "swan");
      t.expect(oc && t.stat("false") === 0 && t.stat("silent") === 4 && t.stat("suits") === "7 of 11",
        "Empty override: the crane is washed on paper (1 false); the washable swan silently gets nothing (4 silent)");

      // 7. Type check: honest skips tonight; the crane slips past, the swan is skipped.
      begin();
      run("typecheck", "none");
      var tn = t.stat("sheet") === 7 && t.stat("false") === 0 && t.stat("silent") === 0 && has("heron skipped by the type check");
      run("typecheck", "crane");
      var tc = t.stat("false") === 1 && t.stat("sheet") === 8;
      run("typecheck", "swan");
      t.expect(tn && tc && t.stat("suits") === "7 of 11" && t.stat("false") === 0,
        "Type check: 7 lines and 3 logged skips; the crane is washed (1 false); the swan is skipped (7 of 11)");

      // 8. Raise: the batch stops at the heron.
      begin();
      run("raise", "none");
      t.expect(t.stat("sheet") === 3 && t.stat("false") === 0 && t.stat("batch") === "stopped at the heron" &&
        t.stat("done") === "4 of 10" && t.stat("suits") === "3 of 10" &&
        has("The batch stopped at the heron. 6 puppets after it got no care tonight."),
        "Raise: baker, fiddler and goose washed, then the batch stops at the heron: 3 of 10 cared for");

      // 9. Raise with the crane: washed before the batch even reaches the heron.
      run("raise", "crane");
      t.expect(t.stat("sheet") === 4 && t.stat("false") === 1 && t.stat("done") === "5 of 11",
        "Raise plus the crane: the crane is washed second, before the stop: 1 false line");

      // 10. Composed care steps: every puppet gets what suits it, new kinds included.
      begin();
      run("composed", "none");
      var cn = t.stat("sheet") === 10 && t.stat("false") === 0 && t.stat("suits") === "10 of 10" && t.stat("silent") === 0 &&
        has("heron dry-brushed. Care sheet: dry brush, soft bristles.");
      run("composed", "crane");
      var cc = t.stat("suits") === "11 of 11" && t.stat("false") === 0;
      run("composed", "swan");
      t.expect(cn && cc && t.stat("suits") === "11 of 11" && t.stat("sheet") === 11,
        "Composed: 10 of 10 tonight, 11 of 11 with the crane or the swan, 0 false");

      // 11. Changing a setting rewinds to 02:00:00.
      t.set("design", "built");
      t.expect(t.stat("done") === "0 of 11" && t.stat("sheet") === 0 && t.stat("batch") === "not started",
        "Changing a setting rewinds to 02:00:00");
    }
  });
})();
