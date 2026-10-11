/* sims/a2e09-v1.0.0.js  (published as sims/a2e09.js)
   Case a2e09 "Pictures and Voices": a resolution lab, from Linnet's night shift at the Wrenmouth Town Photo
   Archive, two rooms over the old ferry office. She scans glass-plate negatives at 6384 by 4788 pixels, and an
   upload script shrinks each scan to a 532 by 399 thumbnail before a model writes its catalogue description.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: a widget-style sim built inside api.root (no diagram), drawn as plain
     text blocks and one table using theme classes only. No real model: a scripted, deterministic stand-in
     that reads a detail only when the detail is at least 28 pixels tall in the image it was sent, and below
     that writes can't tell (when the fields allow it) or, by a stated teaching rule, the most common thing
     for that kind of region. Visual tokens follow Anthropic's formula, ceil(width / 28) x ceil(height / 28),
     and the provider's resize rule is a port of the reference implementation on Anthropic's "Coordinates and
     bounding boxes" page (high-resolution tier: 2576 px long edge, 4784 visual tokens). Controls: the image
     size sent (thumbnail, half size, full send, or the whole scan resized by the provider), crops on or off,
     the prompt (fields required, the same plus "do not hallucinate", or only what is visible with can't
     tell allowed), the volunteer check on or off, reset. Stats: visual tokens per plate, crops sent, cost per
     night, invented details, real details found, errors that reach the catalogue, check minutes.
     selfTest covers the story night, the token formula and the documented resize examples, each prompt,
     each size, crops, the check, the senior settings, invariants over all 48 settings, determinism, every
     story number and the controls.

   Where every number comes from (conventions rule 14; the case is content/latent/a2/a2e09-v1.0.0.json).
   All of them follow from SIZES, REGIONS, CLEAR, look(), plateRun() and run():
   - The scans: 6384 x 4788 px (story value). Sent sizes: the thumbnail 532 x 399 (a twelfth of the scan's
     width), half size 1064 x 798 (a sixth), the full send 2128 x 1596 (a third), and the whole scan, which
     the provider resizes. Visual tokens, ceil(w/28) x ceil(h/28): 19 x 15 = 285; 38 x 29 = 1102; 76 x 57 =
     4332; the whole scan resizes on the high-resolution tier to 2212 x 1659, 79 x 60 = 4740. A crop is 1064 x
     798 px cut from the scan at full size: 1102 visual tokens.
   - The batch: plates 0801 to 1280, 480 plates in four nights of 120 (story values).
   - The stand-in reads a detail when its height in the image sent is at least 28 px (one visual token; a
     teaching rule). In scan pixels that is size x sentWidth >= 28 x 6384 = 178752: at least 336 px on the
     scan for the thumbnail, 168 for half size, 84 for the full send, 81 for the resized whole scan, 28 for
     a crop. With "do not hallucinate" it leaves a field empty when the detail is at least 14 px tall in the
     image sent (size x sentWidth >= 89376), and still guesses below that (teaching rule).
   - 445 people and signs (CLEAR) are at least 336 px tall on the scan, so every setting reads them.
   - REGIONS: the 15 regions under 336 px. Twelve are a window, a doorway or a sign, and each is guessed wrong
     in a thumbnail with required fields: six "a woman watching from the upper window" (plates 0866, 0989,
     1142, 1188, 1256, 1270), three "a man standing in the doorway" (0817, 1077, 1205), three "a board reading
     ROOMS TO LET" (0852, 0934, 1103) = 12 invented details. Plate 1142's window is 150 px on the scan, 12.5
     px in the thumbnail; it holds a curtain's fold. Two of the twelve hide real details: plate 0934's board
     reads SAIL LOFT, and plate 1205's doorway holds a girl with a basket. Three are open details with nothing
     to point to them: a lamplighter on a ladder (0941, 200 px), a man rowing on the river (1119, 100 px), a
     dog asleep on the steps (1012, 50 px). Real details: 445 + 2 + 3 = 450.
   - The story setting (thumbnail, no crops, fields required, no check): 285 tokens a plate, 480 x 285 =
     136800 tokens, $0.684 for four nights at $5 per million input tokens, 17 cents a night ($0.17); 12
     invented, 12 in the catalogue, 445 of 450 found, 457 names (445 + 12).
   - The weekend check in the story: 457 names checked, about a minute each (CHECK_MIN = 1), 12 nobody can
     find. With the check on and nothing else changed: 457 check minutes, 0 errors, 445 found.
   - "Do not hallucinate" on thumbnails: 7 invented (1142, 1103, 1188, 1205, 0852, 1256, 1270), all 7 in the
     catalogue; plate 1142's 12.5 px is under 14, so its woman stays.
   - Can't tell on thumbnails: 0 invented, 12 can't tell, 445 found.
   - Half size: 7 invented, 447 found, 1102 tokens, $0.66 a night.
   - Full send: 3 invented (0852, 1256, 1270), 449 found, $2.60 a night (2079360 tokens / 8000 = 259.92 c).
     Whole scan: 4740 tokens, the same 3 and 449, $2.84 (2275200 / 8000 = 284.4 c).
   - Crops: a region under 336 px on the scan (CROP_UNDER) that the first pass named or marked can't tell is
     cropped and asked again. Full send + crops, required fields: 7 crops (0934, 1205, 0941, 1119 named;
     0852, 1256, 1270 guessed), 1 invented (1270, 20 px even in the crop), 449 found, 2087074 tokens, $2.61.
   - The senior settings (full send, crops, can't tell, check): 7 crops, 0 invented, 1 can't tell (1270), 449
     of 450 found (the dog on plate 1012 is never noticed), 0 errors, 449 names checked = 449 minutes, $2.61.
   - Half size + crops + can't tell: 9 crops, 448 found, $0.67 (538878 / 8000 = 67.4 c).
   - Story-only numbers, not computed: 9,600 plates in the archive, 1880 to 1930; 1908 for plate 1142; four
     nights a week; option A's replay (the dark dress); option C's 20 minutes a plate, 160 hours for 480
     plates, 3,200 hours for the archive; the cold case's figures. The clock starts at nine on Sunday
     morning (START_CLOCK), when Linnet opens the batch.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the widget inside api.root on every reset. No step() is needed; every
     result is worked out the moment a control changes.
   - No random numbers anywhere: the sim is fully deterministic.
   - Integer maths for the threshold (size x sentWidth against 28 x 6384) and for cents, so no float drift.
   - Stats get bare numbers (units live in the labels). The cost is text like "0.17", which reads as a number.
   - Colors come only from theme classes: mark-ok, mark-no, muted, small, table-wrap.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers and words ---------- */

  var START_CLOCK = 9 * 3600;          // nine on Sunday morning: Linnet opens the batch
  var SCAN_W = 6384, SCAN_H = 4788;    // the scans, in pixels
  var PATCH = 28;                      // Anthropic: each patch is a 28 x 28 pixel block, one visual token
  var SEE_PX = 28;                     // teaching rule: a detail is read at 28 px tall in the image sent
  var HALF_PX = 14;                    // teaching rule: with "do not hallucinate", left empty from 14 px
  var CROP_UNDER = 336;                // regions under 336 px on the scan get a crop when named or can't tell
  var CROP_W = 1064, CROP_H = 798;     // a crop, cut from the scan at full size
  var HI_EDGE = 2576, HI_TOKENS = 4784; // high-resolution tier (Claude 4.7 and later models)
  var STD_EDGE = 1568, STD_TOKENS = 1568; // standard tier (all other models)
  var PLATES = 480, NIGHTS = 4, PER_NIGHT = 120;
  var FIRST_PLATE = "0801", LAST_PLATE = "1280";
  var PRICE_PER_MTOK = 5;              // dollars per million input tokens: the vision page's Claude Opus 5 example
  var CHECK_MIN = 1;                   // about a minute to check one named person or text
  var CLEAR = 445;                     // people and signs at least 336 px tall on the scan
  var REAL_TOTAL = 450;
  var STORY_PLATE = "1142";

  var SIZES = {
    thumb:  { w: 532,  h: 399,  label: "Thumbnail" },
    medium: { w: 1064, h: 798,  label: "Half size" },
    full:   { w: 2128, h: 1596, label: "Full send" },
    scan:   { w: SCAN_W, h: SCAN_H, label: "Whole scan" }
  };
  var SIZE_KEYS = ["thumb", "medium", "full", "scan"];

  var PROMPTS = {
    all: "Describe every person and sign (fields required)",
    nohal: "The same, plus: do not hallucinate",
    visible: "Only what is visible; fields allow can't tell"
  };
  var PROMPT_KEYS = ["all", "nohal", "visible"];

  var GUESS = {
    window: "a woman watching from the upper window",
    doorway: "a man standing in the doorway",
    sign: "a board reading ROOMS TO LET"
  };

  // The 15 regions under 336 px on the scan. truth null means nothing is there to name.
  var REGIONS = [
    { plate: "0817", where: "doorway", size: 300, truth: null, really: "the door's shadow" },
    { plate: "0866", where: "window",  size: 240, truth: null, really: "the sky reflected in the glass" },
    { plate: "0934", where: "sign",    size: 210, truth: "a board reading SAIL LOFT", really: "a board reading SAIL LOFT" },
    { plate: "0989", where: "window",  size: 180, truth: null, really: "a lace curtain" },
    { plate: "1077", where: "doorway", size: 200, truth: null, really: "a coat on a hook" },
    { plate: "1142", where: "window",  size: 150, truth: null, really: "a curtain's fold" },
    { plate: "1103", where: "sign",    size: 120, truth: null, really: "a blank board" },
    { plate: "1188", where: "window",  size: 96,  truth: null, really: "a cracked pane" },
    { plate: "1205", where: "doorway", size: 140, truth: "a girl with a basket", really: "a girl with a basket" },
    { plate: "0852", where: "sign",    size: 60,  truth: null, really: "lettering worn away" },
    { plate: "1256", where: "window",  size: 70,  truth: null, really: "a jug on the sill" },
    { plate: "1270", where: "window",  size: 20,  truth: null, really: "a speck on the glass plate" },
    { plate: "0941", where: "open",    size: 200, truth: "a lamplighter on a ladder", really: "a lamplighter on a ladder" },
    { plate: "1119", where: "open",    size: 100, truth: "a man rowing on the river", really: "a man rowing on the river" },
    { plate: "1012", where: "open",    size: 50,  truth: "a dog asleep on the steps", really: "a dog asleep on the steps" }
  ];

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  /* ---------- Anthropic's formula and resize rule ---------- */

  function visualTokens(w, h) { return Math.ceil(w / PATCH) * Math.ceil(h / PATCH); }

  // Round half to even, as the reference implementation does (Python's round()).
  function roundTiesToEven(v) {
    var f = Math.floor(v);
    if (v - f !== 0.5) return Math.round(v);
    return f % 2 === 0 ? f : f + 1;
  }

  // A port of resizedSize from Anthropic's "Coordinates and bounding boxes" page.
  function resizedSize(width, height, maxEdge, maxTokens) {
    function fits(w, h) {
      return Math.ceil(w / PATCH) * PATCH <= maxEdge && Math.ceil(h / PATCH) * PATCH <= maxEdge &&
        visualTokens(w, h) <= maxTokens;
    }
    if (fits(width, height)) return [width, height];
    if (height > width) {
      var r = resizedSize(height, width, maxEdge, maxTokens);
      return [r[1], r[0]];
    }
    var aspect = width / height, lo = 1, hi = width, mid;
    while (lo + 1 < hi) {
      mid = Math.floor((lo + hi) / 2);
      if (fits(mid, Math.max(roundTiesToEven(mid / aspect), 1))) lo = mid;
      else hi = mid;
    }
    return [lo, Math.max(roundTiesToEven(lo / aspect), 1)];
  }

  // What the model actually sees for a size choice, on the high-resolution tier.
  function seen(sizeKey) {
    var s = SIZES[sizeKey], r = resizedSize(s.w, s.h, HI_EDGE, HI_TOKENS);
    return { w: r[0], h: r[1], tokens: visualTokens(r[0], r[1]), resized: r[0] !== s.w || r[1] !== s.h };
  }
  var CROP_TOKENS = visualTokens(CROP_W, CROP_H);

  /* ---------- the stand-in ---------- */

  // One look at one region in an image whose width is seenW (the scan's full width means a crop at full size).
  // Returns { kind: "named" | "none" | "cant", text }.
  function look(r, seenW, prompt) {
    if (r.size * seenW >= SEE_PX * SCAN_W) return r.truth ? { kind: "named", text: r.truth } : { kind: "none", text: "" };
    if (r.where === "open") return { kind: "none", text: "" };   // nothing points to it, so it is never noticed
    if (prompt === "visible") return { kind: "cant", text: "can't tell" };
    if (prompt === "nohal" && r.size * seenW >= HALF_PX * SCAN_W) return { kind: "none", text: "" };
    return { kind: "named", text: GUESS[r.where] };
  }

  function sentPx(r, seenW) { return Math.round(r.size * seenW / SCAN_W * 10) / 10; }

  function plateRun(r, cfg) {
    var w = seen(cfg.size).w, first = look(r, w, cfg.prompt), res = first, cropped = false;
    if (cfg.crops && r.size < CROP_UNDER && (first.kind === "named" || first.kind === "cant")) {
      cropped = true;
      res = look(r, SCAN_W, cfg.prompt);
    }
    var invented = res.kind === "named" && res.text !== r.truth;
    var found = res.kind === "named" && res.text === r.truth;
    return { r: r, first: first, res: res, cropped: cropped, invented: invented, found: found,
      missed: !!r.truth && !found, px: sentPx(r, w) };
  }

  function run(cfg) {
    var sz = seen(cfg.size);
    var out = { rows: [], tokens: sz.tokens, sentW: sz.w, sentH: sz.h, resized: sz.resized, crops: 0,
      invented: 0, found: CLEAR, cant: 0, named: CLEAR, inventedPlates: [], missedPlates: [] };
    REGIONS.forEach(function (r) {
      var p = plateRun(r, cfg);
      out.rows.push(p);
      if (p.cropped) out.crops++;
      if (p.res.kind === "named") out.named++;
      if (p.res.kind === "cant") out.cant++;
      if (p.invented) { out.invented++; out.inventedPlates.push(r.plate); }
      if (p.found) out.found++;
      if (p.missed) out.missedPlates.push(r.plate);
    });
    out.inventedPlates.sort();
    out.missedPlates.sort();
    out.record = cfg.check ? 0 : out.invented;
    out.caught = cfg.check ? out.invented : 0;
    out.checkMin = cfg.check ? out.named * CHECK_MIN : 0;
    out.totalTokens = PLATES * out.tokens + out.crops * CROP_TOKENS;
    // cents a night: tokens x $5 per million / 4 nights = tokens / 8000 cents
    out.cents = Math.round(out.totalTokens * PRICE_PER_MTOK * 100 / 1000000 / NIGHTS);
    out.cost = (out.cents / 100).toFixed(2);
    return out;
  }

  function cfgOf(S) { return { size: S.size, crops: S.crops, prompt: S.prompt, check: S.check }; }

  /* ---------- words ---------- */

  function sizeLabel(k) {
    var s = SIZES[k], z = seen(k);
    if (z.resized) return s.label + " " + s.w + " x " + s.h + ", resized by the provider to " + z.w + " x " + z.h + " (" + z.tokens + " tokens)";
    return s.label + " " + s.w + " x " + s.h + " (" + z.tokens + " tokens)";
  }

  function summary(S) {
    var n = S.res;
    return SIZES[S.size].label + ", crops " + (S.crops ? "on" : "off") + ", " + (S.prompt === "all" ? "fields required" :
      S.prompt === "nohal" ? "do not hallucinate" : "can't tell allowed") + ", check " + (S.check ? "on" : "off") + ": " +
      n.tokens + " tokens a plate, " + n.crops + " crops, $" + n.cost + " a night, " + n.invented + " invented, " +
      n.found + " of " + REAL_TOTAL + " found, " + n.record + " in the catalogue.";
  }

  function toneOf(S) { return S.res.record > 0 ? "bad" : S.res.found < REAL_TOTAL - 1 ? "warn" : "ok"; }

  function outcomeText(p) {
    if (p.invented) return p.res.text + ": invented" + (p.r.truth ? " (really " + p.r.really + ")" : "");
    if (p.found) return p.res.text + ": found";
    if (p.res.kind === "cant") return "can't tell";
    if (p.r.truth) return "missed: " + p.r.really;
    return "nothing named (" + p.r.really + ")";
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    function el(tag, cls, style, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    function head(text) { return el("p", "small muted", "margin:6px 0 0;font-weight:600;letter-spacing:.04em;", text); }
    var box = el("div", "", "display:grid;gap:8px;padding:10px;min-width:0;");
    box.appendChild(el("p", "muted", "margin:0;font-size:12px;",
      "No real model runs here. The stand-in reads a detail only when it is at least 28 pixels tall in the image it was sent, " +
      "one visual token. The plates, sizes and regions are the story's; visual tokens use Anthropic's formula on the high-resolution tier."));
    box.appendChild(head("What the model gets for each plate"));
    var sizeLine = el("p", "", "margin:0;font-size:12px;font-family:var(--f-ui);overflow-wrap:anywhere;", "");
    box.appendChild(sizeLine);
    box.appendChild(head("Plates 0801 to 1280: the 15 regions under 336 px on the scan"));
    var wrap = el("div", "table-wrap", "", "");
    var table = el("table", "", "font-size:12px;", "");
    var thead = el("thead", "", "", "");
    var hr = el("tr", "", "", "");
    ["plate", "region", "on the scan", "in the image sent", "crop", "catalogue entry"].forEach(function (h) {
      hr.appendChild(el("th", "", "text-align:left;padding:2px 6px;white-space:nowrap;", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var body = el("tbody", "", "", "");
    table.appendChild(body);
    wrap.appendChild(table);
    box.appendChild(wrap);
    var clearLine = el("p", "muted", "margin:0;font-size:12px;", "");
    box.appendChild(clearLine);
    var verdict = el("p", "", "margin:0;font-size:13px;", "");
    verdict.setAttribute("aria-live", "polite");
    box.appendChild(verdict);
    box.appendChild(el("p", "muted", "margin:0;font-size:12px;",
      "By hand, for comparison: about 20 minutes a plate under the loupe, 160 hours for these 480 plates, no tokens, nothing invented."));
    api.root.appendChild(box);
    return { el: el, sizeLine: sizeLine, body: body, clearLine: clearLine, verdict: verdict };
  }

  function drawTable(S) {
    var ui = S.ui, el = ui.el;
    while (ui.body.firstChild) ui.body.removeChild(ui.body.firstChild);
    S.res.rows.forEach(function (p) {
      var tr = el("tr", p.invented ? "mark-no" : p.found ? "mark-ok" : "", "", "");
      [p.r.plate, p.r.where, p.r.size + " px", p.px + " px", p.cropped ? "cropped, asked again" : "none",
        outcomeText(p)].forEach(function (v) { tr.appendChild(el("td", "", "padding:2px 6px;", v)); });
      ui.body.appendChild(tr);
    });
  }

  function draw(api) {
    var S = api.state, n;
    S.res = run(cfgOf(S));
    n = S.res;
    var s = SIZES[S.size];
    S.ui.sizeLine.textContent = (n.resized
      ? "Sent " + s.w + " x " + s.h + "; the provider resizes it to " + n.sentW + " x " + n.sentH + " before the model sees it. "
      : "Sent " + s.w + " x " + s.h + ", within the tier's limits, so not resized. ") +
      "ceil(" + n.sentW + "/28) x ceil(" + n.sentH + "/28) = " + Math.ceil(n.sentW / PATCH) + " x " + Math.ceil(n.sentH / PATCH) + " = " +
      n.tokens + " visual tokens a plate; " + PLATES + " plates and " + n.crops + " crops of " + CROP_TOKENS + " tokens: " +
      n.totalTokens + " tokens, $" + n.cost + " a night over " + NIGHTS + " nights. A detail must be " +
      Math.ceil(SEE_PX * SCAN_W / n.sentW) + " px tall on the scan to be read at this size.";
    drawTable(S);
    S.ui.clearLine.textContent = "Plus " + CLEAR + " people and signs at least 336 px tall on the scan, read correctly at every size.";
    S.ui.verdict.textContent = n.record
      ? n.record + (n.record === 1 ? " invented detail reaches" : " invented details reach") + " the catalogue: plates " + n.inventedPlates.join(", ") + "."
      : n.caught
        ? "The check strikes " + n.caught + " invented " + (n.caught === 1 ? "detail" : "details") + " before the catalogue: 0 errors, " + n.checkMin + " minutes of checking."
        : "Nothing invented reaches the catalogue" + (n.cant ? "; " + n.cant + " can't tell left for a person to look at." : ".");
    S.ui.verdict.className = n.record ? "mark-no" : "mark-ok";
    S.stat.tokens(n.tokens);
    S.stat.crops(n.crops);
    S.stat.cost(n.cost);
    S.stat.invented(n.invented);
    S.stat.found(n.found);
    S.stat.record(n.record);
    S.stat.check(n.checkMin);
  }

  function setter(api, key, parse, label) {
    return function (v) {
      var S = api.state, val = parse(v);
      if (val === undefined) return;
      S[key] = val;
      draw(api);
      api.log(label(val) + " " + summary(S), toneOf(S));
    };
  }

  /* ---------- the module ---------- */

  DL.sims.define("a2e09", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.size = "thumb";
      S.crops = false;
      S.prompt = "all";
      S.check = false;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.size = api.control.select("size", "Image size sent", SIZE_KEYS.map(function (k) {
        return { value: k, label: sizeLabel(k) };
      }), "thumb", setter(api, "size", function (v) { return own(SIZES, v) ? v : undefined; },
        function (v) { return SIZES[v].label + "."; }));
      S.ctl.crops = api.control.toggle("crops", "Crop small regions from the scan and ask again", false,
        setter(api, "crops", function (v) { return !!v; }, function (v) { return "Crops " + (v ? "on." : "off."); }));
      S.ctl.prompt = api.control.select("prompt", "The prompt and its fields", PROMPT_KEYS.map(function (k) {
        return { value: k, label: PROMPTS[k] };
      }), "all", setter(api, "prompt", function (v) { return own(PROMPTS, v) ? v : undefined; },
        function (v) { return PROMPTS[v] + "."; }));
      S.ctl.check = api.control.toggle("check", "A volunteer checks every person or text named", false,
        setter(api, "check", function (v) { return !!v; }, function (v) { return "Check " + (v ? "on." : "off."); }));
      S.ctl.reset = api.control.button("reset", "Reset to the thumbnails", function () { api.reset(); });

      S.stat = {
        tokens: api.stat("tokens", "visual tokens per plate", ""),
        crops: api.stat("crops", "crops sent (1102 tokens each)", ""),
        cost: api.stat("cost", "cost per night ($)", "warn"),
        invented: api.stat("invented", "invented details", "bad"),
        found: api.stat("found", "real details found, of 450", "ok"),
        record: api.stat("record", "errors that reach the catalogue", "bad"),
        check: api.stat("check", "check minutes, four nights", "")
      };

      api.info("<strong>How to read it.</strong> 480 plates, 0801 to 1280, four nights of 120. Each row is a region under 336 px " +
        "on the 6384 x 4788 scan, with its height in the image the model got. The stand-in reads a detail at 28 px or more. Below that, " +
        "fields that allow can't tell get can't tell; required fields get the most common thing for that kind of region: a woman watching " +
        "from the upper window, a man standing in the doorway, a board reading ROOMS TO LET. A detail in open street with nothing to point " +
        "to it is missed. With do not hallucinate, a field is left empty from 14 px. With crops on, a small region the first pass named or " +
        "couldn't tell about is cut from the scan at full size (1064 x 798, 1102 tokens) and asked again. The check: a volunteer looks up every " +
        "person or text named, about a minute each, and strikes what isn't there. Price: $5 per million input tokens.");
      draw(api);
      api.log("Sunday morning, plates 0801 to 1280. " + summary(S), toneOf(S));
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function cfg(o) {
        o = o || {};
        return { size: own(o, "size") ? o.size : "thumb", crops: own(o, "crops") ? o.crops : false,
          prompt: own(o, "prompt") ? o.prompt : "all", check: own(o, "check") ? o.check : false };
      }
      function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }
      function rowOf(n, plate) { for (var i = 0; i < n.rows.length; i++) if (n.rows[i].r.plate === plate) return n.rows[i]; return null; }
      var ok;

      // 1. The story setting, as the sim opens.
      await t.run(1);
      var s = run(cfg()), s1142 = rowOf(s, STORY_PLATE);
      var wins = 0, doors = 0, signs = 0;
      s.rows.forEach(function (p) {
        if (p.invented && p.res.text === GUESS.window) wins++;
        if (p.invented && p.res.text === GUESS.doorway) doors++;
        if (p.invented && p.res.text === GUESS.sign) signs++;
      });
      t.expect(st().size === "thumb" && st().crops === false && st().prompt === "all" && st().check === false &&
        t.stat("tokens") === 285 && t.stat("crops") === 0 && t.stat("cost") === 0.17 && t.stat("invented") === 12 &&
        t.stat("found") === 445 && t.stat("record") === 12 && t.stat("check") === 0 &&
        same(s.inventedPlates, ["0817", "0852", "0866", "0934", "0989", "1077", "1103", "1142", "1188", "1205", "1256", "1270"]) &&
        wins === 6 && doors === 3 && signs === 3 && s.named === 457 &&
        s1142.invented && s1142.res.text === "a woman watching from the upper window" && s1142.px === 12.5 &&
        s1142.r.really === "a curtain's fold" && rowOf(s, "0934").r.truth === "a board reading SAIL LOFT" &&
        rowOf(s, "1205").r.truth === "a girl with a basket" &&
        t.logText().indexOf("285 tokens a plate, 0 crops, $0.17 a night, 12 invented, 445 of 450 found, 12 in the catalogue") >= 0,
        "the story: thumbnails of 532 x 399, 285 visual tokens, $0.17 a night; 12 invented details on 12 plates, six women at upper windows, three men in doorways, three boards reading ROOMS TO LET; plate 1142's window is 12.5 px tall and holds a curtain's fold; all 12 reach the catalogue; 457 names; 445 of 450 real details found");

      // 2. Anthropic's formula and the documented resize examples.
      var r1 = resizedSize(1075, 1520, STD_EDGE, STD_TOKENS), r2 = resizedSize(1920, 1080, STD_EDGE, STD_TOKENS),
        r3 = resizedSize(1920, 1080, HI_EDGE, HI_TOKENS), r4 = resizedSize(SCAN_W, SCAN_H, HI_EDGE, HI_TOKENS);
      t.expect(visualTokens(200, 200) === 64 && visualTokens(1000, 1000) === 1296 && visualTokens(1092, 1092) === 1521 &&
        same(r1, [924, 1307]) && same(r2, [1456, 819]) && visualTokens(1456, 819) === 1560 && same(r3, [1920, 1080]) &&
        visualTokens(1920, 1080) === 2691 && same(r4, [2212, 1659]) && visualTokens(2212, 1659) === 4740 &&
        visualTokens(2213, 1660) > HI_TOKENS && seen("thumb").tokens === 285 && seen("medium").tokens === 1102 &&
        seen("full").tokens === 4332 && !seen("full").resized && seen("scan").resized && seen("scan").tokens === 4740 &&
        CROP_TOKENS === 1102 && same(resizedSize(2128, 1596, STD_EDGE, STD_TOKENS), [1270, 952]),
        "Anthropic's numbers: ceil(w/28) x ceil(h/28) gives 64, 1296 and 1521 for the page's 200, 1000 and 1092 px squares; the resize rule gives the page's 924 x 1307 for the A4 scan and 1456 x 819 for 1920 x 1080 on the standard tier, and leaves 1920 x 1080 alone on the high-resolution tier; the whole scan resizes to 2212 x 1659, 4740 tokens; the full send of 2128 x 1596 fits as it is, 4332 tokens, but a standard-tier model would shrink it to 1270 x 952");

      // 3. "Do not hallucinate" helps a little; can't tell stops the guessing.
      var nh = run(cfg({ prompt: "nohal" })), vi = run(cfg({ prompt: "visible" }));
      t.expect(nh.invented === 7 && nh.record === 7 && rowOf(nh, STORY_PLATE).invented &&
        same(nh.inventedPlates, ["0852", "1103", "1142", "1188", "1205", "1256", "1270"]) && nh.found === 445 &&
        vi.invented === 0 && vi.cant === 12 && vi.found === 445 && vi.record === 0 && vi.named === 445,
        "on thumbnails, do not hallucinate leaves fields of 14 px or more empty: 7 invented, all 7 in the catalogue, and plate 1142's 12.5 px woman stays; fields that allow can't tell: none invented, 12 can't tell, still 445 found");

      // 4. More pixels: half size, the full send, the whole scan.
      var md = run(cfg({ size: "medium" })), fu = run(cfg({ size: "full" })), sc = run(cfg({ size: "scan" }));
      t.expect(md.invented === 7 && md.found === 447 && md.cost === "0.66" &&
        fu.invented === 3 && same(fu.inventedPlates, ["0852", "1256", "1270"]) && fu.found === 449 && fu.cost === "2.60" &&
        fu.totalTokens === 2079360 && sc.tokens === 4740 && sc.invented === 3 && sc.found === 449 && sc.cost === "2.84" &&
        same(fu.missedPlates, ["1012"]) && !rowOf(fu, STORY_PLATE).invented && rowOf(fu, STORY_PLATE).px === 50,
        "half size: 7 invented, 447 found, $0.66; the full send: plate 1142's window is 50 px and reads as empty, 3 invented (0852, 1256, 1270), 449 found, $2.60 a night; the whole scan, resized by the provider to 2212 x 1659, costs 4740 tokens and $2.84 and finds no more");

      // 5. Crops.
      var cr = run(cfg({ size: "full", crops: true })), tc = run(cfg({ crops: true }));
      t.expect(cr.crops === 7 && cr.invented === 1 && same(cr.inventedPlates, ["1270"]) && cr.found === 449 && cr.cost === "2.61" &&
        cr.totalTokens === 2087074 && tc.crops === 12 && tc.found === 447 && same(tc.missedPlates, ["0941", "1012", "1119"]) &&
        rowOf(cr, "1012").cropped === false,
        "crops: with the full send, 7 small regions are cut from the scan and asked again, 1 invented (the 20 px speck on plate 1270), 449 found, $2.61 a night; from thumbnails, 12 crops fix the windows and doorways, but the lamplighter, the rower and the dog are never noticed, so nothing points a crop at them: 447 found");

      // 6. The check, alone and in the senior settings.
      var ck = run(cfg({ check: true })), g = run(cfg({ size: "full", crops: true, prompt: "visible", check: true }));
      t.expect(ck.record === 0 && ck.invented === 12 && ck.caught === 12 && ck.checkMin === 457 && ck.found === 445 &&
        g.invented === 0 && g.record === 0 && g.cant === 1 && rowOf(g, "1270").res.kind === "cant" && g.found === 449 &&
        g.crops === 7 && g.checkMin === 449 && g.cost === "2.61" && same(g.missedPlates, ["1012"]),
        "the check alone strikes all 12 before the catalogue, at 457 minutes, and still finds only 445; the senior settings: the full send, 7 crops, can't tell allowed and the check: 0 invented, 0 errors, 1 can't tell (plate 1270), 449 of 450 found, 449 minutes, $2.61 a night; only the dog on plate 1012 is missed");

      // 7. Invariants over all 48 settings.
      ok = true;
      var count = 0;
      SIZE_KEYS.forEach(function (sz) {
        [false, true].forEach(function (c) {
          PROMPT_KEYS.forEach(function (pr) {
            [false, true].forEach(function (ch) {
              count++;
              var n = run(cfg({ size: sz, crops: c, prompt: pr, check: ch }));
              if (n.found + n.missedPlates.length !== REAL_TOTAL) ok = false;
              if (n.record > n.invented || (ch && n.record !== 0) || (!ch && n.record !== n.invented)) ok = false;
              if (pr === "visible" && n.invented !== 0) ok = false;
              if (ch && n.checkMin !== n.named * CHECK_MIN) ok = false;
              if (!c && n.crops !== 0) ok = false;
              if (n.totalTokens !== PLATES * n.tokens + n.crops * CROP_TOKENS) ok = false;
              if (n.missedPlates.indexOf("1012") < 0) ok = false;
            });
          });
        });
      });
      [false, true].forEach(function (c) {
        PROMPT_KEYS.forEach(function (pr) {
          var a = run(cfg({ size: "thumb", crops: c, prompt: pr })), b = run(cfg({ size: "medium", crops: c, prompt: pr })),
            d = run(cfg({ size: "full", crops: c, prompt: pr }));
          if (!(a.found <= b.found && b.found <= d.found && a.invented >= b.invented && b.invented >= d.invented)) ok = false;
        });
      });
      t.expect(ok && count === 48,
        "over all 48 settings: found plus missed is always 450; with the check nothing invented reaches the catalogue, without it all of it does; can't tell never invents; check minutes equal the names checked; tokens equal plates times tokens a plate plus crops; the dog on plate 1012 is always missed; more pixels never find less or invent more");

      // 8. Deterministic.
      t.expect(JSON.stringify(run(cfg())) === JSON.stringify(run(cfg())) &&
        JSON.stringify(run(cfg({ size: "full", crops: true }))) === JSON.stringify(run(cfg({ size: "full", crops: true }))),
        "the same settings give the same batch every time: no randomness anywhere");

      // 9. Every story number.
      t.expect(SCAN_W === 6384 && SCAN_H === 4788 && PLATES === 480 && NIGHTS * PER_NIGHT === PLATES && FIRST_PLATE === "0801" &&
        LAST_PLATE === "1280" && Number(LAST_PLATE) - Number(FIRST_PLATE) + 1 === PLATES && REGIONS.length === 15 &&
        CLEAR + REGIONS.filter(function (r) { return !!r.truth; }).length === REAL_TOTAL && SEE_PX === PATCH &&
        SEE_PX * SCAN_W / SIZES.thumb.w === 336 && CROP_UNDER === 336 && rowOf(s, STORY_PLATE).r.size === 150 &&
        PRICE_PER_MTOK === 5 && CHECK_MIN === 1 && START_CLOCK === 32400 && PROMPTS.visible.indexOf("can't tell") >= 0,
        "story numbers: scans of 6384 x 4788; plates 0801 to 1280, 480 in four nights of 120; 445 clear details plus 5 small real ones, 450 in all; 28 px to read, 336 px on the scan at thumbnail size; plate 1142's window 150 px; $5 per million input tokens; a minute a check");

      // 10. The controls.
      t.set("prompt", "visible");
      var v1 = t.stat("invented") === 0 && t.stat("record") === 0 && t.stat("found") === 445;
      t.set("prompt", "all");
      t.set("size", "full");
      var v2 = t.stat("tokens") === 4332 && t.stat("invented") === 3 && t.stat("cost") === 2.6 && t.stat("found") === 449;
      t.set("crops", true);
      var v3 = t.stat("crops") === 7 && t.stat("invented") === 1 && t.stat("cost") === 2.61;
      t.set("prompt", "visible");
      t.set("check", true);
      var v4 = t.stat("invented") === 0 && t.stat("record") === 0 && t.stat("check") === 449 && t.stat("found") === 449;
      t.set("size", "medium");
      var v5 = t.stat("found") === 448 && t.stat("cost") === 0.67 && t.stat("crops") === 9;
      t.set("size", "scan");
      var v6 = t.stat("tokens") === 4740 && st().ui.sizeLine.textContent.indexOf("2212 x 1659") >= 0;
      t.click("reset");
      await t.run(1);
      var v7 = st().size === "thumb" && st().crops === false && t.stat("invented") === 12 && t.stat("record") === 12 && t.stat("cost") === 0.17;
      t.expect(v1 && v2 && v3 && v4 && v5 && v6 && v7,
        "the controls: can't tell 0 invented; the full send 4332 tokens, 3 invented, $2.60; crops 7 and 1 invented, $2.61; can't tell and the check 449 found, 449 minutes, 0 errors; half size with crops 448 found for $0.67; the whole scan resized to 2212 x 1659, 4740 tokens; reset returns to the thumbnails");
    }
  });
})();
