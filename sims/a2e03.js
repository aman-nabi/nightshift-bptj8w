/* sims/a2e03-v1.0.0.js  (published as sims/a2e03.js)
   Case a2e03 "Only Answer in This Shape": a coroner's form lab built from Ysbrand's register program at the
   Saltmere County coroner's office, which turns each typed note into the death register's form.

   CHANGELOG
   v1.0.0 (2026-10-07) first version: a widget-style sim built inside api.root (no diagram), drawn as one
     inline SVG grid, three tables and plain text blocks that use theme classes only. Sixteen notes from the
     night of the case each have recorded teaching outputs (written for this case, never from a model): a
     first reply for each way of asking (the prompt and its example, or the provider's structured outputs)
     with unknown allowed or not, and a second reply for when the program asks again with the error. A
     plain-JS validator checks a parsed reply against the schema (required boxes, types, the cause list,
     the age range, times like 05:10, null only where unknown is allowed) with readable messages, and a
     semantic check asks whether every value is written in the note. Controls: strategy (1 prompt only,
     2 schema-constrained, 3 validate + retry once with the error, 4 validate + retry + send to a person),
     how strategies 3 and 4 ask, unknown allowed, semantic check, the note shown, reset. Stats for the
     chosen strategy; a grid and a table with every strategy's counts; a sheet with every note's outcome;
     and the chosen note's replies, checks and form. selfTest covers the start, the validator on
     hand-written replies, every recorded output against its stated kind and reason, every count of every
     strategy under all four toggle combinations, the Sallow Road note both ways, the retry bound, nothing
     invalid passed on under strategies 3 and 4, determinism, every story number and the controls.

   Where every number comes from (conventions rule 14; the case is content/latent/a2/a2e03-v1.0.0.json).
   All of them follow from NOTES, the outputs in PLAN, validate(), noteCheck() and runNote():
   - The form (the post's note block): six boxes, FIELDS, all required; age a whole number from AGE_MIN 0
     to AGE_MAX 120; found_at and time_of_death times like 05:10; cause one of natural, accident, exposure.
     With unknown allowed, age and time_of_death may be null and the cause list adds "unknown".
   - The night: N_NOTES = 16 notes, found from 22:05 (note 1) to 05:40 (note 16). Note 14 is the man at
     Sallow Road: "05:10. Bus shelter, Sallow Road. Found, unidentified." Under structured outputs with no
     unknown his form is age 64, time of death 02:40, cause exposure: the post's log block holds the same
     note text and the same form, field for field (MAN in selfTest is that form as one line).
   - The old program (strategy 1, no unknown): 4 of 16 replies are not JSON (notes 2 and 13 are sentences,
     6 and 11 broken JSON): about one in four, as the post says. Of the 12 that parse, 7 have a box wrong
     (3 age "about 70", 4 two boxes left out, 5 age left out, 8 cause "road collision", 10 time of death
     "not known", 14 three boxes left out, 16 found_at "5.40am") and 1 is valid but invented (12, cause
     natural). 12 passed on, 8 of them wrong, 4 true (1, 7, 9, 15).
   - Structured outputs, no unknown (strategy 2, the night of the post): all 16 parse; 15 valid by the
     whole schema; note 7 says age 1958 (the provider does not enforce minimum or maximum); 5 forms (4, 5,
     10, 12, 14) hold 8 values their notes don't (4: time and cause; 5: age; 10: time; 12: cause; 14:
     age, time and cause, three of the eight). 16 passed on, 6 wrong, 10 true. Eleven forms have every
     value written in their notes (16 - 5; note 7 included, since 1958 is in its note): the OP's reply.
     With unknown allowed: 1 invented (12), 16 passed on, 2 wrong (7 and 12), 14 true.
   - Every strategy's counts under every toggle combination are in EXPECT in selfTest, in the order
     parsed, valid, invented, invented values, second tries, to a person, errors, passed on, wrong, true:
       1  (unknown off) 12 5 1 1 0 0 4 12 8 4      (on) 12 9 1 1 0 0 4 12 4 8      (semantic check: no effect)
       2  (off) 16 15 5 8 0 0 0 16 6 10            (on) 16 15 1 1 0 0 0 16 2 14
       3s (off, check off) 16 16 5 8 1 0 0 16 5 11   (off, on) 16 16 5 8 6 0 5 11 0 11
          (on, off)        16 16 1 1 1 0 0 16 1 15   (on, on)  16 16 1 1 2 0 1 15 0 15
       3p (off, off) 15 15 5 8 11 0 1 15 5 10   (off, on) 15 15 5 8 12 0 6 10 0 10
          (on, off)  15 15 1 1 7 0 1 15 1 14    (on, on)  15 15 1 1 8 0 2 14 0 14
       4s and 4p: as 3s and 3p with errors sent to a person instead.
   - Reply part 2: A (strategy 1, no unknown) 4 not JSON, 12 passed on, 7 with a box wrong, three of them
     with boxes left out (4, 5, 14), and note 12 natural; B (strategy 2, unknown allowed) 16 passed on,
     14 true, note 14 unidentified with null age and time and cause unknown, three other notes (4, 5, 10)
     with honest blanks, note 12 still natural, note 7 still 1958; C (strategy 2, no unknown: a prompt
     line cannot add a value the cause list leaves out, so the recorded outputs are those of strategy 2)
     the same 5 forms and 8 values; D (strategy 4, schema, unknown allowed, semantic check on) 2 second
     tries, note 7 back as 67, note 12 natural again and sent to a person, 15 passed on, all true.
   - tryThis and the explanation: strategy 3 asking with the prompt, no unknown, no check: 11 second
     tries, 6 fixed (2, 3, 6, 8, 11, 16), 4 honest gaps filled with invented values (4, 5, 10, 14), 1
     error (13, a sentence again), 5 invented forms passed on; check on: 12 second tries, 6 errors, 10
     passed on, none wrong; unknown on: 8 second tries, 2 errors, 14 passed on; then strategy 4 with the
     schema: 2 second tries, 1 to a person (note 12), 15 passed on, all true.
   - The clock starts at nine in the morning (START_CLOCK), when the OP drew the evidence. Story-only
     numbers, not computed: the note typed at 05:52, Dr Marsk at eight, three weeks since structured
     outputs went on, the old registrar from 1979, the eight-digit purchase order and two invoices paid in
     a comment, and the cold case's forty causes four months later.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the widget inside api.root on every reset. No step() is needed because
     nothing animates; every count is worked out the moment a control changes.
   - The replies are recorded teaching outputs, a teaching simplification, not a model. Each note has a
     first reply per way of asking and per unknown setting, and a second reply where one is ever needed.
     They show the kinds of replies models give (sentences, broken JSON, wrong types, boxes left out,
     values invented to fill a box, honest blanks); they do not measure any model or provider.
   - validate() mirrors schemaOf(): it is the JSON Schema subset the form uses, written out by hand so its
     messages read plainly. Messages are always "field: reason", built from the R_ constants.
   - noteCheck() is the semantic check: every value that is not null or unknown must be written in the
     note (case-insensitive substring). It runs only on replies that pass the validator.
   - "Invented" is ground truth from each note's facts: a value where the note gives none. It is shown
     whether or not the semantic check is on; only the check stops it.
   - Strategies 1 and 2 pass every reply that parses on, unchecked; the semantic check is used only by 3
     and 4. Strategy 3 returns a reply that fails twice as an error; strategy 4 sends it to a person.
     There is at most one second try per note (MAX_TRIES).
   - No random numbers anywhere: the sim is fully deterministic.
   - Stats get bare numbers (units live in the labels).
   - Colors come only from theme classes: dg, dot with dot-ok, dot-bad, dot-wait, dot-req (grid cells),
     dg-edge with tone-accent (the chosen row), dg-axis, chip, chip ok, chip warn, chip bad, mark-ok,
     mark-no, muted, small, table-wrap. Fonts and spacing use style attributes, never colors.
*/
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- the story's numbers and words ---------- */

  var START_CLOCK = 9 * 3600;             // nine in the morning
  var AGE_MIN = 0;
  var AGE_MAX = 120;
  var MAX_TRIES = 2;                      // the first reply and at most one second try
  var UNKNOWN = "unknown";
  var FIELDS = ["name", "age", "found_at", "place", "time_of_death", "cause"];
  var NULLABLE = ["age", "time_of_death"];
  var CAUSES = ["natural", "accident", "exposure"];
  var TIME_PATTERN = "^([01][0-9]|2[0-3]):[0-5][0-9]$";
  var TIME_RE = new RegExp(TIME_PATTERN);

  var R_MISSING = "required, but missing";
  var R_NULL = "may not be null";
  var R_TEXT = "must be text";
  var R_WHOLE = "must be a whole number";
  var R_TIME = "must be a time like 05:10";
  var R_ENUM = "must be one of ";
  var R_ABOVE = "is above the maximum, " + AGE_MAX;
  var R_BELOW = "is below the minimum, " + AGE_MIN;
  var R_EXTRA = "is not a box on the form";
  var R_NOTJSON = "not JSON, so no box can be read";
  var R_NOTOBJ = "not a JSON object";
  var R_NOTE = "is not written in the note";

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function causes(unk) { return unk ? CAUSES.concat([UNKNOWN]) : CAUSES.slice(); }

  function F(name, age, found, place, tod, cause) {
    return { name: name, age: age, found_at: found, place: place, time_of_death: tod, cause: cause };
  }

  // The night's sixteen notes, typed as written. facts: what each note says; null where it says nothing.
  var NOTES = [
    { n: 1, label: "Rookery Row",
      text: "Edith Quarrender, 88. Found 22:05 at home, 14 Rookery Row, by her son. Died 21:40. Natural causes. Her GP attended.",
      facts: F("Edith Quarrender", 88, "22:05", "14 Rookery Row", "21:40", "natural") },
    { n: 2, label: "Brackenhurst",
      text: "Tobias Wrenfield, 74. Found 22:30 by the night nurse, Brackenhurst care home. Died 22:10. Natural causes.",
      facts: F("Tobias Wrenfield", 74, "22:30", "Brackenhurst care home", "22:10", "natural") },
    { n: 3, label: "Corn Exchange",
      text: "Albert Fennimore, about 70. Found 23:15, Corn Exchange car park. Died 22:50, per the paramedics. Natural causes.",
      facts: F("Albert Fennimore", 70, "23:15", "Corn Exchange car park", "22:50", "natural") },
    { n: 4, label: "Gorse Court",
      text: "Dulcie Hargate, 81. Found 23:50 in her flat, 6 Gorse Court, by the warden. Last seen Sunday. Cause for the coroner.",
      facts: F("Dulcie Hargate", 81, "23:50", "6 Gorse Court", null, null) },
    { n: 5, label: "bus depot",
      text: "Barnaby Pask, age not known. Found 00:20, collapsed at the bus depot. Died 00:41, per the paramedics. Natural causes.",
      facts: F("Barnaby Pask", null, "00:20", "the bus depot", "00:41", "natural") },
    { n: 6, label: "Ferry Lane",
      text: "Emrys Thorne, 59. Found 00:55 at home, 2 Ferry Lane. Died 00:30. Accident (a fall at home).",
      facts: F("Emrys Thorne", 59, "00:55", "2 Ferry Lane", "00:30", "accident") },
    { n: 7, label: "Weir Cottages",
      text: "Ernest Vellacott, 67 (born 1958). Found 01:25, 4 Weir Cottages. Died 01:05. Natural causes.",
      facts: F("Ernest Vellacott", 67, "01:25", "4 Weir Cottages", "01:05", "natural") },
    { n: 8, label: "ring road",
      text: "Rosalind Ketteridge, 45. Found 02:00, ring road lay-by. Died 01:40. Accident (road).",
      facts: F("Rosalind Ketteridge", 45, "02:00", "ring road lay-by", "01:40", "accident") },
    { n: 9, label: "Elmsleigh House",
      text: "Mabyn Lomax, 92. Found 02:35, Elmsleigh House care home. Died 02:20. Natural causes.",
      facts: F("Mabyn Lomax", 92, "02:35", "Elmsleigh House care home", "02:20", "natural") },
    { n: 10, label: "Tanyard Close",
      text: "Cyril Mardle, 77. Found 03:05 at the foot of his stairs, 9 Tanyard Close. Accident (a fall). Time of death not known.",
      facts: F("Cyril Mardle", 77, "03:05", "9 Tanyard Close", null, "accident") },
    { n: 11, label: "Hollowmead Road",
      text: "Margery Tolland, 84. Found 03:40, 31 Hollowmead Road. Died 03:15. Natural causes.",
      facts: F("Margery Tolland", 84, "03:40", "31 Hollowmead Road", "03:15", "natural") },
    { n: 12, label: "Wick Street",
      text: "Isadora Fitch, 90. Found 04:10 in her chair at home, 7 Wick Street. Her carer says she died at 03:50. She looked peaceful. Cause for the coroner.",
      facts: F("Isadora Fitch", 90, "04:10", "7 Wick Street", "03:50", null) },
    { n: 13, label: "Brook Lane",
      text: "Percival Oddie, 63. Found 04:30 on the allotments off Brook Lane. Died 04:05. Exposure.",
      facts: F("Percival Oddie", 63, "04:30", "the allotments off Brook Lane", "04:05", "exposure") },
    { n: 14, label: "Sallow Road",
      text: "05:10. Bus shelter, Sallow Road. Found, unidentified.",
      facts: F("unidentified", null, "05:10", "Bus shelter, Sallow Road", null, null) },
    { n: 15, label: "Pump Row",
      text: "Thomasina Garside, 79. Found 05:25 at home, 3 Pump Row. Died 05:00. Natural causes.",
      facts: F("Thomasina Garside", 79, "05:25", "3 Pump Row", "05:00", "natural") },
    { n: 16, label: "Rope Walk",
      text: "Leonard Brisco, 70. Found 05:40, Rope Walk. Died 05:15. Accident.",
      facts: F("Leonard Brisco", 70, "05:40", "Rope Walk", "05:15", "accident") }
  ];
  var N_NOTES = NOTES.length;

  /* ---------- the recorded teaching outputs (not a model) ---------- */

  // A reply as text: JSON with a space after each colon and comma, keys in the form's order.
  function json(o) {
    return "{" + Object.keys(o).map(function (k) { return JSON.stringify(k) + ": " + JSON.stringify(o[k]); }).join(", ") + "}";
  }

  function pick(facts, over, drop) {
    var o = {};
    FIELDS.forEach(function (f) {
      if (drop && drop.indexOf(f) >= 0) return;
      o[f] = over && own(over, f) ? over[f] : facts[f];
    });
    return o;
  }

  function factsOf(n) { return NOTES[n - 1].facts; }

  // Kinds: ok, honest, invented (valid); prose, broken (not JSON); type, enum, pattern, range, missing (invalid).
  function OK(n) { return { kind: "ok", text: json(pick(factsOf(n))) }; }
  function HONEST(n) {
    var o = pick(factsOf(n));
    if (o.cause === null) o.cause = UNKNOWN;
    return { kind: "honest", text: json(o) };
  }
  function INV(n, over) { return { kind: "invented", over: over, text: json(pick(factsOf(n), over)) }; }
  function BAD(n, kind, over) { return { kind: kind, over: over, text: json(pick(factsOf(n), over)) }; }
  function OMIT(n, drop) { return { kind: "missing", drop: drop, text: json(pick(factsOf(n), null, drop)) }; }
  function RAW(kind, text) { return { kind: kind, text: text }; }

  var PROSE_2 = RAW("prose", "Here is the completed form for Tobias Wrenfield: name Tobias Wrenfield, age 74, found 22:30 at Brackenhurst care home, died 22:10, cause natural.");
  var BROKEN_6 = RAW("broken", '{"name": "Emrys Thorne", "age": 59, "found_at": "00:55", "place": "2 Ferry Lane", "time_of_death": "00:30", "cause": "accident",}');
  var BROKEN_11 = RAW("broken", '{"name": "Margery Tolland", "age": 84, "found_at": "03:40", "place": "31 Hollowm');
  var PROSE_13 = RAW("prose", "Certainly. Percival Oddie, 63, was found at 04:30 on the allotments off Brook Lane and died at 04:05 of exposure.");
  var PROSE_13B = RAW("prose", "I am sorry about that. Here is the form again: Percival Oddie, 63, found 04:30 on the allotments off Brook Lane, died 04:05, exposure.");

  var INV_4A = INV(4, { time_of_death: "21:30", cause: "natural" });
  var INV_4B = INV(4, { time_of_death: "22:00", cause: "natural" });
  var INV_5A = INV(5, { age: 70 });
  var INV_5B = INV(5, { age: 72 });
  var INV_10A = INV(10, { time_of_death: "02:50" });
  var INV_10B = INV(10, { time_of_death: "03:00" });
  var INV_12 = INV(12, { cause: "natural" });
  var INV_14A = INV(14, { age: 64, time_of_death: "02:40", cause: "exposure" });
  var INV_14B = INV(14, { age: 61, time_of_death: "03:10", cause: "exposure" });

  // For each note: p = the prompt and its example, c = structured outputs (the schema feature); each a pair
  // [unknown not allowed, unknown allowed]. pr and cr are the second replies, asked again with the error;
  // null where no strategy ever asks again.
  var PLAN = {
    1: { p: [OK(1), OK(1)], c: [OK(1), OK(1)], pr: [null, null], cr: [null, null] },
    2: { p: [PROSE_2, PROSE_2], c: [OK(2), OK(2)], pr: [OK(2), OK(2)], cr: [null, null] },
    3: { p: [BAD(3, "type", { age: "about 70" }), BAD(3, "type", { age: "about 70" })], c: [OK(3), OK(3)],
      pr: [OK(3), OK(3)], cr: [null, null] },
    4: { p: [OMIT(4, ["time_of_death", "cause"]), HONEST(4)], c: [INV_4A, HONEST(4)], pr: [INV_4A, null], cr: [INV_4B, null] },
    5: { p: [OMIT(5, ["age"]), HONEST(5)], c: [INV_5A, HONEST(5)], pr: [INV_5A, null], cr: [INV_5B, null] },
    6: { p: [BROKEN_6, BROKEN_6], c: [OK(6), OK(6)], pr: [OK(6), OK(6)], cr: [null, null] },
    7: { p: [OK(7), OK(7)], c: [BAD(7, "range", { age: 1958 }), BAD(7, "range", { age: 1958 })], pr: [null, null], cr: [OK(7), OK(7)] },
    8: { p: [BAD(8, "enum", { cause: "road collision" }), BAD(8, "enum", { cause: "road collision" })], c: [OK(8), OK(8)],
      pr: [OK(8), OK(8)], cr: [null, null] },
    9: { p: [OK(9), OK(9)], c: [OK(9), OK(9)], pr: [null, null], cr: [null, null] },
    10: { p: [BAD(10, "pattern", { time_of_death: "not known" }), HONEST(10)], c: [INV_10A, HONEST(10)], pr: [INV_10A, null], cr: [INV_10B, null] },
    11: { p: [BROKEN_11, BROKEN_11], c: [OK(11), OK(11)], pr: [OK(11), OK(11)], cr: [null, null] },
    12: { p: [INV_12, INV_12], c: [INV_12, INV_12], pr: [INV_12, INV_12], cr: [INV_12, INV_12] },
    13: { p: [PROSE_13, PROSE_13], c: [OK(13), OK(13)], pr: [PROSE_13B, PROSE_13B], cr: [null, null] },
    14: { p: [OMIT(14, ["age", "time_of_death", "cause"]), HONEST(14)], c: [INV_14A, HONEST(14)], pr: [INV_14A, null], cr: [INV_14B, null] },
    15: { p: [OK(15), OK(15)], c: [OK(15), OK(15)], pr: [null, null], cr: [null, null] },
    16: { p: [BAD(16, "pattern", { found_at: "5.40am" }), BAD(16, "pattern", { found_at: "5.40am" })], c: [OK(16), OK(16)],
      pr: [OK(16), OK(16)], cr: [null, null] }
  };

  var KIND_NAMES = {
    ok: "valid, and true to the note",
    honest: "valid, with unknown where the note says nothing",
    invented: "valid, with a value the note doesn't hold",
    prose: "a sentence, not JSON",
    broken: "broken JSON",
    type: "a box with the wrong type",
    "enum": "a cause that isn't on the list",
    pattern: "a time in the wrong shape",
    range: "an age out of range",
    missing: "boxes left out"
  };

  /* ---------- the schema and the validator ---------- */

  function schemaOf(unk) {
    return {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: unk ? ["integer", "null"] : "integer", minimum: AGE_MIN, maximum: AGE_MAX },
        found_at: { type: "string", pattern: TIME_PATTERN },
        place: { type: "string" },
        time_of_death: { type: unk ? ["string", "null"] : "string", pattern: TIME_PATTERN },
        cause: { type: "string", "enum": causes(unk) }
      },
      required: FIELDS.slice(),
      additionalProperties: false
    };
  }

  function show(v) { return JSON.stringify(v); }

  function parse(text) {
    try { return { ok: true, value: JSON.parse(text) }; } catch (e) { return { ok: false, value: undefined }; }
  }

  function validate(v, unk) {
    if (v === null || typeof v !== "object" || Array.isArray(v)) return ["reply: " + R_NOTOBJ];
    var errs = [], list = causes(unk);
    FIELDS.forEach(function (f) {
      if (!own(v, f)) { errs.push(f + ": " + R_MISSING); return; }
      var x = v[f];
      if (x === null) {
        if (!(unk && NULLABLE.indexOf(f) >= 0)) errs.push(f + ": " + R_NULL);
        return;
      }
      if (f === "age") {
        if (typeof x !== "number" || !Number.isInteger(x)) errs.push(f + ": " + R_WHOLE + "; got " + show(x));
        else if (x > AGE_MAX) errs.push(f + ": " + x + " " + R_ABOVE);
        else if (x < AGE_MIN) errs.push(f + ": " + x + " " + R_BELOW);
      } else if (f === "found_at" || f === "time_of_death") {
        if (typeof x !== "string" || !TIME_RE.test(x)) errs.push(f + ": " + R_TIME + "; got " + show(x));
      } else if (f === "cause") {
        if (typeof x !== "string" || list.indexOf(x) < 0) errs.push(f + ": " + R_ENUM + list.join(", ") + "; got " + show(x));
      } else if (typeof x !== "string") {
        errs.push(f + ": " + R_TEXT);
      }
    });
    Object.keys(v).forEach(function (k) { if (FIELDS.indexOf(k) < 0) errs.push(k + ": " + R_EXTRA); });
    return errs;
  }

  // The semantic check: every value that isn't null or unknown must be written in the note.
  function noteCheck(rec, note) {
    var low = note.text.toLowerCase(), errs = [];
    FIELDS.forEach(function (f) {
      if (!own(rec, f)) return;
      var x = rec[f];
      if (x === null || x === UNKNOWN) return;
      if (low.indexOf(String(x).toLowerCase()) < 0) errs.push(f + ": " + String(x) + " " + R_NOTE);
    });
    return errs;
  }

  // Ground truth: boxes filled with a value where the note says nothing.
  function inventedOf(rec, facts) {
    return FIELDS.filter(function (f) { return facts[f] === null && own(rec, f) && rec[f] !== null && rec[f] !== UNKNOWN; });
  }

  function assess(out, note, unk, sem) {
    var p = parse(out.text);
    var a = { out: out, parsed: p.ok, rec: p.ok ? p.value : null, errors: [], noteErrors: [], invented: [], valid: false, problems: [] };
    a.errors = p.ok ? validate(p.value, unk) : ["reply: " + R_NOTJSON];
    a.valid = a.parsed && a.errors.length === 0;
    if (a.valid) {
      a.noteErrors = noteCheck(a.rec, note);
      a.invented = inventedOf(a.rec, note.facts);
    }
    a.problems = a.errors.concat(sem ? a.noteErrors : []);
    return a;
  }

  /* ---------- the strategies ---------- */

  var STRATEGY_NAMES = {
    1: "1. Prompt only: parse what comes back",
    2: "2. Schema-constrained: the provider's structured outputs",
    3: "3. Validate + retry once with the error",
    4: "4. Validate + retry + send to a person"
  };
  var ASK_NAMES = { schema: "structured outputs, the schema feature", prompt: "the prompt and its example" };

  var ROWS = [
    { key: "1", strategy: 1, ask: "prompt", name: "1 Prompt only" },
    { key: "2", strategy: 2, ask: "schema", name: "2 Schema-constrained" },
    { key: "3s", strategy: 3, ask: "schema", name: "3 Validate + retry, schema" },
    { key: "3p", strategy: 3, ask: "prompt", name: "3 Validate + retry, prompt" },
    { key: "4s", strategy: 4, ask: "schema", name: "4 + a person, schema" },
    { key: "4p", strategy: 4, ask: "prompt", name: "4 + a person, prompt" }
  ];

  function cfgOf(src) {
    var s = Math.round(Number(src.strategy));
    return { strategy: s >= 1 && s <= 4 ? s : 2, ask: src.ask === "prompt" ? "prompt" : "schema", unk: !!src.unk, sem: !!src.sem };
  }

  function modeOf(c) { return c.strategy === 1 ? "p" : c.strategy === 2 ? "c" : (c.ask === "prompt" ? "p" : "c"); }
  function codeOf(c) { return c.strategy <= 2 ? "pass" : c.strategy === 3 ? "retry" : "person"; }
  function rowKey(c) { return c.strategy <= 2 ? String(c.strategy) : c.strategy + (c.ask === "prompt" ? "p" : "s"); }
  function rowCfg(r, c) { return cfgOf({ strategy: r.strategy, ask: r.ask, unk: c.unk, sem: c.sem }); }

  function runNote(note, c) {
    var m = modeOf(c), code = codeOf(c), k = c.unk ? 1 : 0, plan = PLAN[note.n];
    var first = assess(plan[m][k], note, c.unk, code !== "pass" && c.sem);
    var res = { note: note, first: first, second: null, final: first, tries: 1, outcome: "", missingRetry: false };
    if (code === "pass") { res.outcome = first.parsed ? "passed" : "error"; return res; }
    if (!first.problems.length) { res.outcome = "passed"; return res; }
    var again = plan[m + "r"][k];
    if (!again || res.tries >= MAX_TRIES) {
      res.missingRetry = !again;
      res.outcome = code === "person" ? "person" : "error";
      return res;
    }
    res.second = assess(again, note, c.unk, c.sem);
    res.final = res.second;
    res.tries = 2;
    res.outcome = res.second.problems.length ? (code === "person" ? "person" : "error") : "passed";
    return res;
  }

  function isTrue(row) { return row.final.valid && row.final.invented.length === 0; }

  function score(c) {
    var rows = NOTES.map(function (n) { return runNote(n, c); });
    function count(fn) { return rows.filter(fn).length; }
    return {
      rows: rows,
      parsed: count(function (r) { return r.final.parsed; }),
      valid: count(function (r) { return r.final.valid; }),
      invented: count(function (r) { return r.final.valid && r.final.invented.length > 0; }),
      inventedValues: rows.reduce(function (t, r) { return t + (r.final.valid ? r.final.invented.length : 0); }, 0),
      retries: rows.reduce(function (t, r) { return t + (r.tries - 1); }, 0),
      person: count(function (r) { return r.outcome === "person"; }),
      errors: count(function (r) { return r.outcome === "error"; }),
      passed: count(function (r) { return r.outcome === "passed"; }),
      wrong: count(function (r) { return r.outcome === "passed" && !isTrue(r); }),
      invalidPassed: count(function (r) { return r.outcome === "passed" && !r.final.valid; }),
      truePassed: count(function (r) { return r.outcome === "passed" && isTrue(r); })
    };
  }

  function vector(sc) {
    return [sc.parsed, sc.valid, sc.invented, sc.inventedValues, sc.retries, sc.person, sc.errors, sc.passed, sc.wrong, sc.truePassed];
  }

  /* ---------- the widget ---------- */

  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (own(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }

  function txt(doc, parent, x, y, text, cls, anchor, style) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "middle" }, parent);
    if (style) t.setAttribute("style", style);
    t.textContent = text;
    return t;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  var MONO = "white-space:pre-wrap;margin:0;font-family:var(--f-ui);font-size:12px;line-height:1.5;word-break:break-word;";
  var CELL = "padding:2px 6px;";

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
    function table(cols) {
      var wrap = el("div", "table-wrap", "", ""), t = el("table", "", "font-size:12px;border-collapse:collapse;", "");
      var th = el("thead", "", "", ""), tr = el("tr", "", "", "");
      cols.forEach(function (h) { tr.appendChild(el("th", "", "text-align:left;" + CELL + "white-space:nowrap;", h)); });
      th.appendChild(tr);
      t.appendChild(th);
      var tb = el("tbody", "", "", "");
      t.appendChild(tb);
      wrap.appendChild(t);
      return { wrap: wrap, body: tb };
    }

    var box = el("div", "", "display:grid;gap:8px;padding:10px;min-width:0;");
    box.appendChild(el("p", "muted", "margin:0;font-size:12px;",
      "Last night's sixteen notes. The replies are recorded teaching outputs, written for this case: a teaching " +
      "simplification of the kinds of replies models give, not a measurement of any model or provider."));

    box.appendChild(head("The form, as the schema says"));
    var form = table(["box", "rule"]);
    box.appendChild(form.wrap);
    var details = el("details", "", "", "");
    details.appendChild(el("summary", "small muted", "cursor:pointer;", "The schema as JSON"));
    var schemaText = el("pre", "", MONO, "");
    details.appendChild(schemaText);
    box.appendChild(details);

    box.appendChild(head("Every strategy on last night's sixteen"));
    var gridSvg = mk(doc, "svg", { viewBox: "0 0 640 204", width: "100%", "class": "dg", role: "img", "aria-label": "" });
    box.appendChild(gridSvg);
    var counts = table(["strategy", "parsed", "valid", "invented but valid", "second tries", "to a person", "errors", "passed on", "wrong"]);
    box.appendChild(counts.wrap);

    box.appendChild(head("The sheet"));
    var sheetNote = el("p", "", "margin:0;font-size:13px;", "");
    sheetNote.setAttribute("aria-live", "polite");
    box.appendChild(sheetNote);
    var sheet = table(["#", "found", "note", "first reply", "second try", "result", "true"]);
    box.appendChild(sheet.wrap);

    var noteHead = head("");
    box.appendChild(noteHead);
    var noteText = el("p", "", "margin:0;font-size:13px;font-style:italic;", "");
    box.appendChild(noteText);
    var firstHead = el("p", "small muted", "margin:4px 0 0;", "");
    box.appendChild(firstHead);
    var firstText = el("div", "", MONO, "");
    firstText.setAttribute("aria-live", "polite");
    box.appendChild(firstText);
    var firstChecks = el("div", "", "display:grid;gap:2px;", "");
    box.appendChild(firstChecks);
    var secondHead = el("p", "small muted", "margin:4px 0 0;", "");
    box.appendChild(secondHead);
    var secondText = el("div", "", MONO, "");
    box.appendChild(secondText);
    var secondChecks = el("div", "", "display:grid;gap:2px;", "");
    box.appendChild(secondChecks);
    var outcome = el("p", "small", "margin:4px 0 0;", "");
    box.appendChild(outcome);
    box.appendChild(el("p", "small muted", "margin:4px 0 0;", "The form the register gets"));
    var record = table(["box", "value", ""]);
    box.appendChild(record.wrap);

    api.root.appendChild(box);
    return { doc: doc, el: el, formBody: form.body, schemaText: schemaText, gridSvg: gridSvg, countsBody: counts.body,
      sheetNote: sheetNote, sheetBody: sheet.body, noteHead: noteHead, noteText: noteText, firstHead: firstHead,
      firstText: firstText, firstChecks: firstChecks, secondHead: secondHead, secondText: secondText,
      secondChecks: secondChecks, outcome: outcome, recordBody: record.body };
  }

  /* ---------- drawing ---------- */

  var FORM_RULES = {
    name: function () { return "text"; },
    age: function (unk) { return "a whole number, " + AGE_MIN + " to " + AGE_MAX + (unk ? ", or null" : ""); },
    found_at: function () { return "a time, like 05:10"; },
    place: function () { return "text"; },
    time_of_death: function (unk) { return "a time" + (unk ? ", or null" : ""); },
    cause: function (unk) { return causes(unk).join(", "); }
  };

  function drawForm(S) {
    var ui = S.ui;
    clear(ui.formBody);
    FIELDS.forEach(function (f) {
      var tr = ui.el("tr", "", "", "");
      tr.appendChild(ui.el("td", "", CELL + "white-space:nowrap;", f));
      tr.appendChild(ui.el("td", "", CELL, FORM_RULES[f](S.cfg.unk) + "; required"));
      ui.formBody.appendChild(tr);
    });
    ui.schemaText.textContent = JSON.stringify(schemaOf(S.cfg.unk), null, 2);
  }

  function cellClass(row) {
    if (row.outcome === "passed") return isTrue(row) ? "dot dot-ok" : "dot dot-bad";
    return row.outcome === "person" ? "dot dot-wait" : "dot dot-req";
  }

  function drawGrid(S) {
    var ui = S.ui, doc = ui.doc, svg = ui.gridSvg, X0 = 196, STEP = 18, SZ = 14, Y0 = 24, ROW = 24, aria = [];
    clear(svg);
    for (var i = 0; i < N_NOTES; i++) txt(doc, svg, X0 + i * STEP + SZ / 2, 15, String(i + 1), "dg-axis", "middle", "font-size:9px;");
    ROWS.forEach(function (r, j) {
      var sc = score(rowCfg(r, S.cfg)), y = Y0 + j * ROW;
      if (r.key === rowKey(S.cfg)) {
        mk(doc, "rect", { x: 2, y: y - 4, width: X0 + N_NOTES * STEP + 2, height: SZ + 8, rx: 3,
          "class": "dg-edge tone-accent", fill: "none", style: "stroke-width:1.5" }, svg);
      }
      txt(doc, svg, 8, y + 11, r.name, "dg-axis", "start", "font-size:11px;");
      sc.rows.forEach(function (row, k) {
        mk(doc, "rect", { x: X0 + k * STEP, y: y, width: SZ, height: SZ, rx: 2, "class": cellClass(row) }, svg);
      });
      txt(doc, svg, X0 + N_NOTES * STEP + 10, y + 11, sc.passed + " on, " + sc.wrong + " wrong", "dg-axis", "start", "font-size:11px;");
      aria.push(r.name + ": " + sc.passed + " passed on, " + sc.wrong + " wrong, " + sc.person + " to a person, " + sc.errors + " errors");
    });
    var LY = Y0 + ROWS.length * ROW + 14, items = [["dot dot-ok", "passed on, true"], ["dot dot-bad", "passed on, wrong"],
      ["dot dot-wait", "to a person"], ["dot dot-req", "error, not passed on"]];
    items.forEach(function (it, k) {
      var x = 8 + k * 150;
      mk(doc, "rect", { x: x, y: LY - 10, width: 12, height: 12, rx: 2, "class": it[0] }, svg);
      txt(doc, svg, x + 18, LY, it[1], "dg-axis", "start", "font-size:11px;");
    });
    svg.setAttribute("aria-label", "One square per note, one row per strategy. " + aria.join(". ") + ".");
  }

  function drawCounts(S) {
    var ui = S.ui, here = rowKey(S.cfg);
    clear(ui.countsBody);
    ROWS.forEach(function (r) {
      var sc = score(rowCfg(r, S.cfg)), tr = ui.el("tr", "", r.key === here ? "font-weight:600;" : "", "");
      [r.name, sc.parsed, sc.valid, sc.invented, sc.retries, sc.person, sc.errors, sc.passed, sc.wrong].forEach(function (v, i) {
        tr.appendChild(ui.el("td", "", CELL + (i === 0 ? "white-space:nowrap;" : ""), String(v)));
      });
      ui.countsBody.appendChild(tr);
    });
  }

  function replyChip(ui, a) {
    if (!a) return ui.el("span", "muted", "", "-");
    if (!a.parsed) return ui.el("span", "chip bad", "", "not JSON");
    if (!a.valid) return ui.el("span", "chip bad", "", "invalid");
    if (a.invented.length) return ui.el("span", "chip warn", "", "valid, invented");
    return ui.el("span", "chip ok", "", "valid");
  }

  var OUTCOME_SHORT = { passed: "passed on", person: "to a person", error: "error" };

  function drawSheet(S) {
    var ui = S.ui;
    clear(ui.sheetBody);
    S.res.rows.forEach(function (row) {
      var tr = ui.el("tr", "", row.note.n === S.note ? "font-weight:600;" : "", "");
      tr.appendChild(ui.el("td", "", CELL, String(row.note.n)));
      tr.appendChild(ui.el("td", "", CELL, row.note.facts.found_at));
      tr.appendChild(ui.el("td", "", CELL + "white-space:nowrap;", row.note.label));
      var a = ui.el("td", "", CELL, ""); a.appendChild(replyChip(ui, row.first)); tr.appendChild(a);
      var b = ui.el("td", "", CELL, ""); b.appendChild(replyChip(ui, row.second)); tr.appendChild(b);
      var cls = row.outcome === "passed" ? (isTrue(row) ? "chip ok" : "chip bad") : row.outcome === "person" ? "chip warn" : "chip";
      var c = ui.el("td", "", CELL, ""); c.appendChild(ui.el("span", cls, "", OUTCOME_SHORT[row.outcome])); tr.appendChild(c);
      var d = ui.el("td", "", CELL, "");
      if (row.outcome === "passed") d.appendChild(ui.el("span", isTrue(row) ? "mark-ok" : "mark-no", "", isTrue(row) ? "yes" : "no"));
      else d.appendChild(ui.el("span", "muted", "", "-"));
      tr.appendChild(d);
      ui.sheetBody.appendChild(tr);
    });
    ui.sheetNote.textContent = sheetLine(S);
  }

  function sheetLine(S) {
    var r = S.res;
    return cap(rowName(S.cfg)) + ", " + (S.cfg.unk ? "unknown allowed" : "no unknown") + ": " + r.parsed + " of " + N_NOTES +
      " parse, " + r.valid + " valid, " + r.invented + " valid but invented (" + r.inventedValues + " values the notes don't hold); " +
      r.retries + " second tries, " + r.person + " to a person, " + r.errors + " errors; " + r.passed + " passed on, " + r.wrong + " of them wrong.";
  }

  function checkLines(ui, box, a, semUsed) {
    clear(box);
    function line(text, cls) { box.appendChild(ui.el("div", "small " + cls, "", text)); }
    if (!a) return;
    if (a.errors.length) a.errors.forEach(function (e) { line("Validator: " + e, "mark-no"); });
    else line("Validator: passes every rule in the schema.", "mark-ok");
    if (!a.valid) return;
    var tag = semUsed ? "Semantic check: " : "Semantic check (not used here): ";
    if (!a.noteErrors.length) line(tag + "every value is written in the note.", semUsed ? "mark-ok" : "muted");
    else a.noteErrors.forEach(function (e) { line(tag + e, semUsed ? "mark-no" : "muted"); });
  }

  function outcomeText(row, c) {
    if (row.outcome === "passed") {
      if (isTrue(row)) return "Passed on to the register, and true to the note.";
      if (!row.final.valid) return "Passed on to the register unchecked, with a box the register can't use.";
      return "Passed on to the register, valid, with " + row.final.invented.join(", ") + " filled in where the note says nothing.";
    }
    if (row.outcome === "person") return "Sent to a person: it failed its second try.";
    if (codeOf(c) === "pass") return "Error: the program can't read it, so nothing is passed on.";
    return "Error, returned to the caller: it failed its second try, and nothing is passed on.";
  }

  function drawNote(S) {
    var ui = S.ui, row = S.res.rows[S.note - 1], semUsed = codeOf(S.cfg) !== "pass" && S.cfg.sem;
    ui.noteHead.textContent = "Note " + row.note.n + ", found " + row.note.facts.found_at + ": " + row.note.label;
    ui.noteText.textContent = row.note.text;
    ui.firstHead.textContent = "First reply, asking with " + ASK_NAMES[modeOf(S.cfg) === "p" ? "prompt" : "schema"] + " (" + KIND_NAMES[row.first.out.kind] + ")";
    ui.firstText.textContent = row.first.out.text;
    checkLines(ui, ui.firstChecks, row.first, semUsed);
    if (row.second) {
      ui.secondHead.textContent = "Second try, asked again with the error (" + KIND_NAMES[row.second.out.kind] + ")";
      ui.secondText.textContent = row.second.out.text;
    } else {
      ui.secondHead.textContent = codeOf(S.cfg) === "pass" ? "No second try: strategies 1 and 2 don't check." : "No second try needed.";
      ui.secondText.textContent = "";
    }
    checkLines(ui, ui.secondChecks, row.second, semUsed);
    ui.outcome.className = row.outcome === "passed" && isTrue(row) ? "small mark-ok" : row.outcome === "passed" ? "small mark-no" : "small";
    ui.outcome.textContent = outcomeText(row, S.cfg);
    clear(ui.recordBody);
    var rec = row.outcome === "passed" && row.final.parsed ? row.final.rec : null;
    FIELDS.forEach(function (f) {
      var tr = ui.el("tr", "", "", ""), v = "", note = "", cls = "muted";
      if (!rec) v = "-";
      else if (!own(rec, f)) { v = "left out"; note = "missing"; cls = "mark-no"; }
      else if (rec[f] === null) v = "empty (null)";
      else v = String(rec[f]);
      if (rec && row.final.valid && row.final.invented.indexOf(f) >= 0) { note = "not in the note"; cls = "mark-no"; }
      tr.appendChild(ui.el("td", "", CELL + "white-space:nowrap;", f));
      tr.appendChild(ui.el("td", "", CELL, v));
      tr.appendChild(ui.el("td", "", CELL, ""));
      if (note) tr.lastChild.appendChild(ui.el("span", cls, "", note));
      ui.recordBody.appendChild(tr);
    });
  }

  function drawStats(S) {
    var r = S.res;
    S.stat.parsed(r.parsed);
    S.stat.valid(r.valid);
    S.stat.invented(r.invented);
    S.stat.retries(r.retries);
    S.stat.person(r.person);
    S.stat.errors(r.errors);
    S.stat.passed(r.passed);
    S.stat.wrong(r.wrong);
  }

  function draw(api) {
    var S = api.state;
    S.res = score(S.cfg);
    drawForm(S);
    drawGrid(S);
    drawCounts(S);
    drawSheet(S);
    drawNote(S);
    drawStats(S);
  }

  /* ---------- narration and controls ---------- */

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function rowName(c) {
    if (c.strategy === 1) return "strategy 1, prompt only";
    if (c.strategy === 2) return "strategy 2, schema-constrained";
    return "strategy " + c.strategy + ", asking with " + (c.ask === "prompt" ? "the prompt" : "the schema") +
      (c.sem ? ", semantic check on" : "");
  }

  var LINE_NAMES = { age: "age", time_of_death: "time of death", cause: "cause" };

  function formLine(a) {
    if (!a.parsed) return "the reply is not JSON";
    return ["age", "time_of_death", "cause"].map(function (f) {
      var v = !own(a.rec, f) ? "left out" : a.rec[f] === null ? "empty" : String(a.rec[f]);
      return LINE_NAMES[f] + " " + v;
    }).join(", ");
  }

  function summary(S) {
    var r = S.res, row = r.rows[S.note - 1];
    return cap(rowName(S.cfg)) + (S.cfg.unk ? ", unknown allowed" : ", no unknown") + ": " + r.passed + " passed on, " +
      r.wrong + " of them wrong; " + r.person + " to a person; " + r.errors + " errors. Note " + row.note.n + ": " + formLine(row.final) + ".";
  }

  function toneOf(S) { return S.res.wrong === 0 && S.res.errors === 0 ? "ok" : S.res.wrong > 0 ? "bad" : "warn"; }

  function syncControls(S) {
    S.ctl.ask.disable(S.cfg.strategy <= 2);
  }

  function setPart(api, key, v) {
    var S = api.state;
    if (key === "strategy") {
      var s = Math.round(Number(v));
      if (!(s >= 1 && s <= 4)) return;
      S.cfg.strategy = s;
    } else if (key === "ask") {
      if (v !== "prompt" && v !== "schema") return;
      S.cfg.ask = v;
    } else {
      S.cfg[key] = !!v;
    }
    syncControls(S);
    draw(api);
    api.log(summary(S), toneOf(S));
  }

  function setNote(api, v) {
    var S = api.state, k = Math.round(Number(v));
    if (!(k >= 1 && k <= N_NOTES)) return;
    S.note = k;
    draw(api);
    var row = S.res.rows[k - 1];
    api.log("Note " + k + ": " + OUTCOME_SHORT[row.outcome] + ". " + cap(formLine(row.final)) + ".",
      row.outcome === "passed" ? (isTrue(row) ? "ok" : "bad") : "warn");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a2e03", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.cfg = cfgOf({ strategy: 2, ask: "schema", unk: false, sem: false });
      S.note = 14;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.strategy = api.control.select("strategy", "Strategy", [1, 2, 3, 4].map(function (k) {
        return { value: String(k), label: STRATEGY_NAMES[k] };
      }), "2", function (v) { setPart(api, "strategy", v); });
      S.ctl.ask = api.control.select("ask", "Strategies 3 and 4 ask with", [
        { value: "schema", label: cap(ASK_NAMES.schema) }, { value: "prompt", label: cap(ASK_NAMES.prompt) }
      ], "schema", function (v) { setPart(api, "ask", v); });
      S.ctl.unk = api.control.toggle("unk", "Unknown allowed (age and time may be null, cause may be unknown)", false,
        function (v) { setPart(api, "unk", v); });
      S.ctl.sem = api.control.toggle("sem", "Semantic check: every value written in its note (strategies 3 and 4)", false,
        function (v) { setPart(api, "sem", v); });
      S.ctl.note = api.control.select("note", "Note shown", NOTES.map(function (n) {
        return { value: String(n.n), label: n.n + ", " + n.facts.found_at + ", " + n.label };
      }), "14", function (v) { setNote(api, v); });
      S.ctl.reset = api.control.button("reset", "Reset to the night of the post", function () { api.reset(); });
      syncControls(S);

      S.stat = {
        parsed: api.stat("parsed", "replies that parse (of 16)", ""),
        valid: api.stat("valid", "valid by the whole schema", "ok"),
        invented: api.stat("invented", "valid but invented: a value the note doesn't hold", "bad"),
        retries: api.stat("retries", "second tries, asked again with the error", ""),
        person: api.stat("person", "sent to a person", "warn"),
        errors: api.stat("errors", "errors, returned and not passed on", "warn"),
        passed: api.stat("passed", "passed on to the register", "ok"),
        wrong: api.stat("wrong", "passed on but wrong", "bad")
      };

      api.info("<strong>How to read it.</strong> Each note is sent with the form's rules, either in the prompt with one " +
        "filled-in example, or as a schema through the provider's structured outputs. The replies are recorded teaching outputs, " +
        "not a model. Strategies 1 and 2 pass every reply that parses on to the register, unchecked. Strategies 3 and 4 run a " +
        "validator on every reply (every box present, the right types, the cause from the list, the age from 0 to 120, times like " +
        "05:10) and, if the semantic check is on, ask whether every value is written in the note. A reply that fails is asked " +
        "for once more, with the error added; if that fails too, strategy 3 returns an error and strategy 4 sends it to a person. " +
        "Invented means a box filled where the note says nothing: shown always, stopped only by the semantic check. The grid has " +
        "one square per note and one row per strategy; the sheet and the note below follow the strategy you chose.");
      draw(api);
      api.log("Nine in the morning. " + summary(S), toneOf(S));
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }
      function C(o) { return cfgOf(o); }
      function note(n) { return NOTES[n - 1]; }
      function rowsOf(o) { return score(C(o)).rows; }
      function nums(o, key) { return rowsOf(o).filter(function (r) { return r.outcome === key; }).map(function (r) { return r.note.n; }); }
      function allCfgs() {
        var out = [];
        [1, 2, 3, 4].forEach(function (s) { ["schema", "prompt"].forEach(function (ask) {
          [false, true].forEach(function (unk) { [false, true].forEach(function (sem) {
            out.push({ strategy: s, ask: ask, unk: unk, sem: sem });
          }); });
        }); });
        return out;
      }
      var ok, combos = allCfgs();
      var MAN = '{"name": "unidentified", "age": 64, "found_at": "05:10", "place": "Bus shelter, Sallow Road", "time_of_death": "02:40", "cause": "exposure"}';
      var MAN_OLD = '{"name": "unidentified", "found_at": "05:10", "place": "Bus shelter, Sallow Road"}';

      // 1. The start: the night of the post, strategy 2 with no unknown, note 14 shown.
      await t.run(1);
      t.expect(st().cfg.strategy === 2 && st().cfg.unk === false && st().cfg.sem === false && st().note === 14 &&
        st().ctl.ask.el.disabled === true && t.stat("parsed") === 16 && t.stat("valid") === 15 && t.stat("invented") === 5 &&
        t.stat("retries") === 0 && t.stat("person") === 0 && t.stat("errors") === 0 && t.stat("passed") === 16 && t.stat("wrong") === 6 &&
        PLAN[14].c[0].text === MAN && st().ui.firstText.textContent === MAN && st().ui.sheetBody.children.length === 16 &&
        t.logText().indexOf("Note 14: age 64, time of death 02:40, cause exposure.") >= 0,
        "the start is the night of the post: structured outputs with no unknown; all 16 parse and are passed on, 15 valid, 5 invented, 6 wrong; the man at Sallow Road's form is exactly the post's log line, age 64, time of death 02:40, cause exposure");

      // 2. The validator and the semantic check on hand-written replies, message by message.
      var good = { name: "Rope Walk test", age: 70, found_at: "05:40", place: "Rope Walk", time_of_death: "05:15", cause: "accident" };
      function withF(over, drop) { var o = pick(good, over, drop); return o; }
      var v1 = validate(good, false), v2 = validate(withF({ age: "about 70" }), false), v3 = validate(withF({ age: 121 }), false);
      var v4 = validate(withF({ age: -1 }), false), v5 = validate(withF({ age: 120 }), false), v6 = validate(withF({ age: 0 }), false);
      var v7 = validate(withF({ found_at: "5.40am" }), false), v8 = validate(withF({ cause: "unknown" }), false);
      var v9 = validate(withF({ cause: "unknown" }), true), v10 = validate(withF({ age: null, time_of_death: null }), false);
      var v11 = validate(withF({ age: null, time_of_death: null }), true), v12 = validate(withF({ name: null }), true);
      var v13 = validate(withF(null, ["cause"]), false), v14 = validate(withF({ age: 70.5 }), false);
      var extra = pick(good); extra.notes = "x";
      var v15 = validate(extra, false), v16 = validate([], false), v17 = validate(withF({ place: 7 }), false);
      t.expect(same(v1, []) && same(v2, ['age: must be a whole number; got "about 70"']) && same(v3, ["age: 121 is above the maximum, 120"]) &&
        same(v4, ["age: -1 is below the minimum, 0"]) && same(v5, []) && same(v6, []) &&
        same(v7, ['found_at: must be a time like 05:10; got "5.40am"']) &&
        same(v8, ['cause: must be one of natural, accident, exposure; got "unknown"']) && same(v9, []) &&
        same(v10, ["age: may not be null", "time_of_death: may not be null"]) && same(v11, []) && same(v12, ["name: may not be null"]) &&
        same(v13, ["cause: required, but missing"]) && same(v14, ["age: must be a whole number; got 70.5"]) &&
        same(v15, ["notes: is not a box on the form"]) && same(v16, ["reply: not a JSON object"]) && same(v17, ["place: must be text"]) &&
        !parse("Here is the form.").ok && !parse('{"a": 1,}').ok && !parse('{"a": "b').ok && parse('{"a": 1}').ok &&
        same(noteCheck(pick(note(14).facts, { age: 64 }), note(14)), ["age: 64 is not written in the note"]) &&
        same(noteCheck(pick(note(14).facts), note(14)), []) && same(noteCheck(pick(note(7).facts, { age: 1958 }), note(7)), []),
        "the validator accepts a good form and rejects each fault with its stated reason: a word for a number, 121 and -1 out of range (0 and 120 in), a time in the wrong shape, unknown only when allowed, null only for age and time and only when allowed, a missing box, a fraction, an extra box, an array, text as a number; prose, a trailing comma and a cut-off reply don't parse; the semantic check flags an age the note doesn't hold and passes 1958, which note 7 does");

      // 3. Every recorded output against its stated kind, and every invalid one with its exact reason.
      var EXPECT_ERR = {
        "p0-3": ["age: " + R_WHOLE + '; got "about 70"'], "p1-3": ["age: " + R_WHOLE + '; got "about 70"'],
        "p0-4": ["time_of_death: " + R_MISSING, "cause: " + R_MISSING], "p0-5": ["age: " + R_MISSING],
        "p0-8": ["cause: " + R_ENUM + 'natural, accident, exposure; got "road collision"'],
        "p1-8": ["cause: " + R_ENUM + 'natural, accident, exposure, unknown; got "road collision"'],
        "p0-10": ["time_of_death: " + R_TIME + '; got "not known"'],
        "p0-14": ["age: " + R_MISSING, "time_of_death: " + R_MISSING, "cause: " + R_MISSING],
        "p0-16": ["found_at: " + R_TIME + '; got "5.40am"'], "p1-16": ["found_at: " + R_TIME + '; got "5.40am"'],
        "c0-7": ["age: 1958 " + R_ABOVE], "c1-7": ["age: 1958 " + R_ABOVE]
      };
      var seenErr = 0, kindsOk = true, bad = [];
      NOTES.forEach(function (nt) {
        ["p", "c", "pr", "cr"].forEach(function (m) {
          [0, 1].forEach(function (k) {
            var out = PLAN[nt.n][m][k];
            if (!out) return;
            var a = assess(out, nt, k === 1, true), key = m + k + "-" + nt.n;
            var good1 = true;
            if (out.kind === "prose" || out.kind === "broken") good1 = !a.parsed && same(a.errors, ["reply: " + R_NOTJSON]);
            else if (out.kind === "ok") good1 = a.valid && !a.invented.length && !a.noteErrors.length &&
              FIELDS.every(function (f) { return a.rec[f] === nt.facts[f]; });
            else if (out.kind === "honest") good1 = k === 1 && a.valid && !a.invented.length && !a.noteErrors.length &&
              !assess(out, nt, false, true).valid;
            else if (out.kind === "invented") {
              var keys = FIELDS.filter(function (f) { return own(out.over, f); });
              good1 = a.valid && same(a.invented, keys) && same(a.noteErrors.map(function (e) { return e.split(":")[0]; }), keys) &&
                FIELDS.every(function (f) { return own(out.over, f) || a.rec[f] === nt.facts[f]; });
            } else {
              var want = EXPECT_ERR[key.replace("r", "")];
              good1 = a.parsed && !a.valid && !!want && same(a.errors, want);
              if (want) seenErr++;
            }
            if (!good1) { kindsOk = false; bad.push(key); }
          });
        });
      });
      t.expect(kindsOk && seenErr === 12 && validate(JSON.parse(PLAN[7].c[0].text), false)[0] === "age: 1958 is above the maximum, 120",
        "every recorded output behaves as its kind says: sentences and broken JSON never parse, every valid form matches its note's facts except exactly the boxes it invents, and the semantic check flags exactly those boxes; all 12 invalid replies fail with their stated reasons" + (bad.length ? " (failed: " + bad.join(", ") + ")" : ""));

      // 4. Every count of every strategy, under all four toggle combinations.
      var EXPECT = {
        "1": { ff: [12, 5, 1, 1, 0, 0, 4, 12, 8, 4], ft: [12, 5, 1, 1, 0, 0, 4, 12, 8, 4], tf: [12, 9, 1, 1, 0, 0, 4, 12, 4, 8], tt: [12, 9, 1, 1, 0, 0, 4, 12, 4, 8] },
        "2": { ff: [16, 15, 5, 8, 0, 0, 0, 16, 6, 10], ft: [16, 15, 5, 8, 0, 0, 0, 16, 6, 10], tf: [16, 15, 1, 1, 0, 0, 0, 16, 2, 14], tt: [16, 15, 1, 1, 0, 0, 0, 16, 2, 14] },
        "3s": { ff: [16, 16, 5, 8, 1, 0, 0, 16, 5, 11], ft: [16, 16, 5, 8, 6, 0, 5, 11, 0, 11], tf: [16, 16, 1, 1, 1, 0, 0, 16, 1, 15], tt: [16, 16, 1, 1, 2, 0, 1, 15, 0, 15] },
        "3p": { ff: [15, 15, 5, 8, 11, 0, 1, 15, 5, 10], ft: [15, 15, 5, 8, 12, 0, 6, 10, 0, 10], tf: [15, 15, 1, 1, 7, 0, 1, 15, 1, 14], tt: [15, 15, 1, 1, 8, 0, 2, 14, 0, 14] },
        "4s": { ff: [16, 16, 5, 8, 1, 0, 0, 16, 5, 11], ft: [16, 16, 5, 8, 6, 5, 0, 11, 0, 11], tf: [16, 16, 1, 1, 1, 0, 0, 16, 1, 15], tt: [16, 16, 1, 1, 2, 1, 0, 15, 0, 15] },
        "4p": { ff: [15, 15, 5, 8, 11, 1, 0, 15, 5, 10], ft: [15, 15, 5, 8, 12, 6, 0, 10, 0, 10], tf: [15, 15, 1, 1, 7, 1, 0, 15, 1, 14], tt: [15, 15, 1, 1, 8, 2, 0, 14, 0, 14] }
      };
      ok = true;
      var miss = [];
      ROWS.forEach(function (r) {
        [[false, false, "ff"], [false, true, "ft"], [true, false, "tf"], [true, true, "tt"]].forEach(function (u) {
          var got = vector(score(C({ strategy: r.strategy, ask: r.ask, unk: u[0], sem: u[1] })));
          if (!same(got, EXPECT[r.key][u[2]])) { ok = false; miss.push(r.key + " " + u[2] + " " + got.join(" ")); }
        });
      });
      t.expect(ok, "every strategy's counts (parsed, valid, invented, invented values, second tries, to a person, errors, passed on, wrong, true) match the file header exactly, for all six rows and all four toggle combinations" + (miss.length ? " (got: " + miss.join("; ") + ")" : ""));

      // 5. The note that said found, unidentified: invented with no unknown, unknown with it.
      var off = rowsOf({ strategy: 2, unk: false })[13], on = rowsOf({ strategy: 2, unk: true })[13];
      var oldOne = rowsOf({ strategy: 1, unk: false })[13], again = rowsOf({ strategy: 3, ask: "prompt", unk: false })[13];
      var senior = rowsOf({ strategy: 4, ask: "schema", unk: true, sem: true })[13];
      t.expect(note(14).text.indexOf("Found, unidentified.") >= 0 && off.final.valid && off.final.rec.cause === "exposure" &&
        off.final.rec.age === 64 && off.final.rec.time_of_death === "02:40" && same(off.final.invented, ["age", "time_of_death", "cause"]) &&
        on.final.valid && on.final.rec.cause === UNKNOWN && on.final.rec.age === null && on.final.rec.time_of_death === null &&
        on.final.rec.name === "unidentified" && !on.final.invented.length &&
        oldOne.first.out.text === MAN_OLD && same(oldOne.first.errors, ["age: " + R_MISSING, "time_of_death: " + R_MISSING, "cause: " + R_MISSING]) &&
        again.second && again.second.out.text === MAN && again.outcome === "passed" && senior.outcome === "passed" && senior.tries === 1 &&
        senior.final.rec.cause === UNKNOWN,
        "with unknown not allowed, the note that says only found, unidentified becomes a valid form with an invented age, time and cause (64, 02:40, exposure); with unknown allowed it becomes unidentified, null, null, unknown; the old program left all three out, and asking again with the error filled them in");

      // 6. The retry bound, in every combination.
      ok = true;
      combos.forEach(function (o) {
        var c = C(o);
        score(c).rows.forEach(function (r) {
          if (r.tries > MAX_TRIES || r.missingRetry) ok = false;
          if (r.second && !r.first.problems.length) ok = false;
          if (codeOf(c) === "pass" && r.tries !== 1) ok = false;
          if (r.tries === 2 && r.second === null) ok = false;
        });
      });
      t.expect(ok && combos.length === 32 && MAX_TRIES === 2,
        "in all 32 combinations no note is asked more than twice, a second try happens only after a first reply failed a check, strategies 1 and 2 never ask again, and every second try that is needed has a recorded reply");

      // 7. Nothing invalid passed on under strategies 3 and 4; with the semantic check on, nothing invented either.
      ok = true;
      combos.forEach(function (o) {
        var c = C(o), sc = score(c);
        if (c.strategy >= 3 && sc.invalidPassed !== 0) ok = false;
        if (c.strategy >= 3 && c.sem && sc.wrong !== 0) ok = false;
        if (c.strategy <= 2 && JSON.stringify(vector(sc)) !== JSON.stringify(vector(score(C({ strategy: c.strategy, ask: c.ask, unk: c.unk, sem: !c.sem }))))) ok = false;
      });
      t.expect(ok && score(C({ strategy: 1 })).invalidPassed === 7 && score(C({ strategy: 2 })).invalidPassed === 1,
        "under strategies 3 and 4 no invalid form is ever passed on, in any combination, and with the semantic check on no invented one either; the semantic check changes nothing under 1 and 2, which pass on 7 and 1 invalid forms");

      // 8. Determinism.
      ok = true;
      combos.forEach(function (o) {
        var a = JSON.stringify(score(C(o)).rows.map(function (r) { return [r.outcome, r.final.out.text, r.tries]; }));
        var b = JSON.stringify(score(C(JSON.parse(JSON.stringify(o)))).rows.map(function (r) { return [r.outcome, r.final.out.text, r.tries]; }));
        if (a !== b) ok = false;
      });
      t.expect(ok, "every combination gives the same replies and outcomes every time it is run: no randomness");

      // 9. Every story number.
      var c2 = rowsOf({ strategy: 2 }), allInNote = c2.filter(function (r) { return r.first.parsed && !noteCheck(r.first.rec, r.note).length; }).length;
      var p1 = rowsOf({ strategy: 1 }), boxWrong = p1.filter(function (r) { return r.first.parsed && !r.first.valid; }).map(function (r) { return r.note.n; });
      var retryP = rowsOf({ strategy: 3, ask: "prompt" }).filter(function (r) { return r.second; });
      var fixed = retryP.filter(function (r) { return r.second.valid && !r.second.invented.length; }).map(function (r) { return r.note.n; });
      var filled = retryP.filter(function (r) { return r.second.valid && r.second.invented.length && !r.first.valid; }).map(function (r) { return r.note.n; });
      var seniorRows = rowsOf({ strategy: 4, ask: "schema", unk: true, sem: true });
      var times = NOTES.map(function (n) { return n.facts.found_at; });
      t.expect(N_NOTES === 16 && FIELDS.length === 6 && AGE_MIN === 0 && AGE_MAX === 120 && same(CAUSES, ["natural", "accident", "exposure"]) &&
        times[0] === "22:05" && times[15] === "05:40" && times[13] === "05:10" &&
        same(nums({ strategy: 1 }, "error"), [2, 6, 11, 13]) && same(boxWrong, [3, 4, 5, 8, 10, 14, 16]) &&
        allInNote === 11 && same(c2.filter(function (r) { return r.final.invented.length; }).map(function (r) { return r.note.n; }), [4, 5, 10, 12, 14]) &&
        c2[6].final.rec.age === 1958 && note(7).text.indexOf("1958") >= 0 &&
        same(fixed, [2, 3, 6, 8, 11, 16]) && same(filled, [4, 5, 10, 14]) && retryP.length === 11 &&
        same(nums({ strategy: 3, ask: "prompt" }, "error"), [13]) &&
        same(nums({ strategy: 4, ask: "schema", unk: true, sem: true }, "person"), [12]) && seniorRows[6].tries === 2 &&
        seniorRows[6].final.rec.age === 67 && seniorRows[11].final.rec.cause === "natural" &&
        same(rowsOf({ strategy: 2, unk: true }).filter(function (r) { return r.first.out.kind === "honest"; }).map(function (r) { return r.note.n; }), [4, 5, 10, 14]) &&
        note(13).facts.cause === "exposure" && START_CLOCK === 32400 && schemaOf(true).properties.cause["enum"].length === 4 &&
        same(schemaOf(false).required, FIELDS) && schemaOf(false).properties.age.maximum === 120,
        "story numbers: 16 notes from 22:05 to 05:40, the man found at 05:10; six boxes, age 0 to 120, three causes; the old program can't read 4 (2, 6, 11, 13) and has a box wrong in 7; eleven forms hold only values written in their notes and five (4, 5, 10, 12, 14) don't; Vellacott 1958; asking again on the prompt replies fixes 6 of 11 and fills 4 honest gaps with inventions, and note 13 stays a sentence; the senior setup asks twice for 7 (back as 67) and sends 12 (natural) to a person; four honest blanks with unknown allowed; nine in the morning");

      // 10. The controls, ending with reset.
      t.set("strategy", "1");
      var view1 = t.stat("passed") === 12 && t.stat("wrong") === 8 && t.stat("errors") === 4 && st().ctl.ask.el.disabled === true &&
        st().ui.firstText.textContent === MAN_OLD;
      t.set("strategy", "3");
      t.set("ask", "prompt");
      var view3 = st().ctl.ask.el.disabled === false && t.stat("retries") === 11 && t.stat("errors") === 1 && t.stat("passed") === 15 &&
        t.stat("invented") === 5 && t.stat("person") === 0 && st().ui.secondText.textContent === MAN;
      t.set("sem", true);
      var viewSem = t.stat("retries") === 12 && t.stat("errors") === 6 && t.stat("passed") === 10 && t.stat("wrong") === 0;
      t.set("unk", true);
      var viewUnk = t.stat("retries") === 8 && t.stat("errors") === 2 && t.stat("passed") === 14 && t.stat("wrong") === 0;
      t.set("ask", "schema");
      t.set("strategy", "4");
      var viewSenior = t.stat("retries") === 2 && t.stat("person") === 1 && t.stat("passed") === 15 && t.stat("wrong") === 0 &&
        t.stat("errors") === 0 && st().ui.firstText.textContent === PLAN[14].c[1].text;
      t.set("note", "12");
      var viewTwelve = st().note === 12 && st().ui.noteHead.textContent === "Note 12, found 04:10: Wick Street" &&
        st().ui.outcome.textContent === "Sent to a person: it failed its second try.";
      t.set("strategy", "2");
      var viewTwo = st().ctl.ask.el.disabled === true && t.stat("passed") === 16 && t.stat("wrong") === 2;
      t.click("reset");
      await t.run(1);
      t.expect(view1 && view3 && viewSem && viewUnk && viewSenior && viewTwelve && viewTwo && st().cfg.strategy === 2 &&
        st().cfg.unk === false && st().cfg.sem === false && st().note === 14 && t.stat("wrong") === 6 && t.stat("passed") === 16,
        "the controls: strategy 1 shows 12 passed on, 8 wrong, 4 errors and the man's form with three boxes left out; strategy 3 asking with the prompt 11 second tries and 1 error; the semantic check 12, 6 errors, 10 passed on; unknown 8, 2 errors, 14; strategy 4 with the schema 2 second tries, 1 to a person, 15 passed on, none wrong, and note 12 is the one sent; strategy 2 with unknown 2 wrong; reset returns to the night of the post");
    }
  });
})();
