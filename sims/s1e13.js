/* sims/s1e13-v1.0.0.js  (published as sims/s1e13.js)
   Case s1e13 "The Black Screen": a pretend Linux terminal in the Starlite's server closet.

   CHANGELOG
   v1.0.0 (2026-10-06) first version: a widget-style fake terminal built inside api.root, with a
     small virtual file system (/home/jo with a sandbox, /home/wren locked at rwx------, /srv/keys with
     the last admin's note, encode.sh at rw-r--r--, guests.db and a locked DO_NOT_OPEN file, and
     /var/log with auth.log and keys.log). Commands: help, pwd, ls (-l, -a), cd, cat, less (Enter,
     b, q), grep (-i, -n), tail (-n, -f), chmod (symbolic and numeric), sudo, rm (-r, -f; only inside
     ~/sandbox, with a warning), whoami, history, clear, echo, ssh. Up and down arrows walk the
     history, Ctrl+C or the Stop button ends tail -f and less, and * and ? wildcards expand like a
     shell's. Live events: the card machine retries room 11's key every 30 seconds until encode.sh is
     executable again, and wren's key logs in at 03:14:07. Quest: read the note, grep the last
     ERROR, fix encode.sh with chmod. Stats: commands run, quest steps done. Pure JavaScript, no
     real system access. selfTest covers pwd, cd and ls, the note, grep, chmod with and without
     sudo, the locked file, tail -f catching the 03:14 login, the card machine recovering, rm inside
     and outside the sandbox, the up arrow and less.

   Notes for anyone copying this file:
   - Widget-style sim with no diagram. setup rebuilds the terminal and the file system on every
     reset. Everything typed is shown with textContent, never innerHTML.
   - Nothing here runs a real command. The "file system" is a plain object tree, and permissions
     are checked with the same owner, group, others rules a Linux machine uses.
   - The clock is real time (speed 1) from 03:13:30 on the night after the story, so the 03:14:07
     login arrives about 37 seconds after the sim starts. Only api.rand() is random.
*/
(function () {
  "use strict";

  var USER = "jo";
  var HOST = "starlite";
  var HOME = ["home", "jo"];
  var SANDBOX = ["home", "jo", "sandbox"];
  var START = hms(3, 13, 30);
  var LOGIN_AT = hms(3, 14, 7);
  var FIRST_RETRY = hms(3, 13, 55);
  var RETRY_EVERY = 30;
  var TODAY = "Oct  7";
  var PAGE = 12;
  var MAX_SCREEN = 400;
  var MAX_HISTORY = 100;

  var NOTE = [
    "To whoever has the night desk after me,",
    "",
    "The card machine at the front desk asks this server for every key.",
    "For each card it runs /srv/keys/encode.sh. If cards come out dead,",
    "look in /var/log/keys.log first.",
    "",
    "1. Look before you delete: pwd, then ls.",
    "2. Never rm -rf anything in /srv/keys. rm deletes, -r means everything",
    "   inside too, -f means don't ask. No undo. No backup.",
    "3. encode.sh has to stay executable, or the front desk can't make keys.",
    "4. To change something you don't own, use sudo: do this as root,",
    "   the boss of the machine. Be careful what you ask the boss for.",
    "5. If someone logs in as me at 3:14, it isn't me.",
    "",
    "- W.",
    ""
  ].join("\n");

  var SCRIPT = [
    "#!/bin/sh",
    "# encode.sh ROOM: writes one room key. The card machine at the desk runs this.",
    "# It must stay executable. - W.",
    "room=\"$1\"",
    "echo \"key for room $room\"",
    ""
  ].join("\n");

  var LOCKED = [
    "Wren again.",
    "If you can read this, you used sudo. The machine just did exactly what",
    "you asked, as root, without a single question. That's the whole danger.",
    "Be gentle with it.",
    "- W.",
    ""
  ].join("\n");

  var WREN_NOTES = [
    "backup-box: copies /srv/keys/guests.db to my place every night at 03:14.",
    "It logs in here with its own key, as me.",
    "TODO: switch it off if I ever leave.",
    ""
  ].join("\n");

  var AUTH_LINES = [
    "Oct  2 03:14:06 starlite sshd[1822]: Accepted publickey for wren from 203.0.113.50 port 50414 ssh2",
    "Oct  2 14:37:52 starlite sshd[1850]: Failed password for root from 198.51.100.77 port 40022 ssh2",
    "Oct  2 22:41:10 starlite sudo:     dale : TTY=tty1 ; PWD=/srv/keys ; USER=root ; COMMAND=/usr/bin/chmod 644 /srv/keys/encode.sh",
    "Oct  3 03:14:07 starlite sshd[1871]: Accepted publickey for wren from 203.0.113.50 port 53302 ssh2",
    "Oct  3 09:12:40 starlite sshd[1880]: Failed password for invalid user admin from 192.0.2.201 port 52211 ssh2",
    "Oct  4 03:14:07 starlite sshd[1907]: Accepted publickey for wren from 203.0.113.50 port 51190 ssh2",
    "Oct  4 17:03:15 starlite sshd[1931]: Failed password for root from 198.51.100.77 port 40871 ssh2",
    "Oct  5 03:14:06 starlite sshd[1988]: Accepted publickey for wren from 203.0.113.50 port 49822 ssh2",
    "Oct  6 02:03:11 starlite login[702]: session opened for user jo on tty1",
    "Oct  6 03:14:07 starlite sshd[2073]: Accepted publickey for wren from 203.0.113.50 port 50417 ssh2",
    "Oct  7 03:02:48 starlite login[731]: session opened for user jo on tty1"
  ];

  var KEYS_LINES = [
    "Oct  2 21:15:02 starlite keyd[611]: INFO encoded key for room 7",
    "Oct  2 22:39:50 starlite keyd[611]: INFO encoded key for room 12",
    "Oct  2 23:05:44 starlite keyd[611]: ERROR cannot run /srv/keys/encode.sh: Permission denied (room 3)",
    "Oct  3 01:12:09 starlite keyd[611]: ERROR cannot run /srv/keys/encode.sh: Permission denied (room 15)",
    "Oct  4 02:40:31 starlite keyd[611]: ERROR cannot run /srv/keys/encode.sh: Permission denied (room 9)",
    "Oct  5 23:51:18 starlite keyd[611]: ERROR cannot run /srv/keys/encode.sh: Permission denied (room 4)",
    "Oct  7 03:12:55 starlite keyd[611]: ERROR cannot run /srv/keys/encode.sh: Permission denied (room 11)",
    "Oct  7 03:13:25 starlite keyd[611]: ERROR cannot run /srv/keys/encode.sh: Permission denied (room 11)"
  ];

  var HELP = [
    "Commands in this pretend terminal:",
    "  pwd                       print the folder you're in",
    "  ls [-l] [-a] [path]       list a folder (-l: permissions, owner, size)",
    "  cd [path]                 move into a folder (cd .. goes up, cd goes home)",
    "  cat file                  print a file",
    "  less file                 read a long file a page at a time (q quits)",
    "  grep [-i] [-n] word file  print only the lines that contain word",
    "  tail [-n N] [-f] file     the last lines of a file (-f keeps watching)",
    "  chmod mode file           change permissions: +x, u+x, g-w, 755, 644",
    "  sudo command              run one command as root",
    "  rm [-r] [-f] path         delete (only inside ~/sandbox in this sim)",
    "  whoami, history, clear, echo, help",
    "Up arrow: your last command. Ctrl+C (or Stop): end tail -f or less.",
    "Folders are shown with a / after the name, like ls -F."
  ].join("\n");

  var QUEST = [
    "Find the last admin's note and read it.",
    "Use grep to read the ERROR lines in /var/log/keys.log.",
    "Fix encode.sh's permission so the front desk can make keys."
  ];

  var HINTS = [
    "<strong>Hint.</strong> The note is in /srv/keys. Try <em>cd /srv/keys</em>, then <em>ls</em>, then <em>cat LAST_NOTE.txt</em>.",
    "<strong>Hint.</strong> grep prints only matching lines. Try <em>grep ERROR /var/log/keys.log</em> and read the last one.",
    "<strong>Hint.</strong> <em>ls -l /srv/keys/encode.sh</em> shows no x. Try <em>chmod +x</em> on it. If you get Operation not permitted, put <em>sudo</em> in front.",
    "<strong>All three done.</strong> Now try <em>tail -f /var/log/auth.log</em> and wait for 03:14:07. Or go and wreck your sandbox: <em>cd ~/sandbox</em>."
  ];

  /* ---------- small helpers ---------- */

  function hms(h, m, s) { return h * 3600 + m * 60 + s; }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function oct(s) { return parseInt(s, 8); }
  function clockText(sec) {
    var s = Math.floor(sec + 1e-6);
    s = ((s % 86400) + 86400) % 86400;
    return pad2(Math.floor(s / 3600)) + ":" + pad2(Math.floor((s % 3600) / 60)) + ":" + pad2(s % 60);
  }
  function stamp(sec) { return TODAY + " " + clockText(sec); }
  function rpad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }
  function lpad(s, n) { s = String(s); while (s.length < n) s = " " + s; return s; }

  /* ---------- the file system ---------- */

  function dir(owner, group, mode, mtime, kids) {
    return { dir: true, owner: owner, group: group, mode: oct(mode), mtime: mtime, kids: kids || {} };
  }
  function file(owner, group, mode, mtime, text) {
    return { dir: false, owner: owner, group: group, mode: oct(mode), mtime: mtime, text: text, lines: null, binary: false };
  }
  function logFile(owner, group, mode, mtime, lines) {
    return { dir: false, owner: owner, group: group, mode: oct(mode), mtime: mtime, text: "", lines: lines.slice(), binary: false };
  }

  function buildFS() {
    var guests = file("root", "root", "600", "Oct  7 03:12", "");
    guests.binary = true;
    return dir("root", "root", "755", "Sep 14  2023", {
      home: dir("root", "root", "755", "Sep 14  2023", {
        jo: dir("jo", "jo", "755", "Sep 29 21:02", {
          ".ssh": dir("jo", "jo", "700", "Sep 29 21:02", {}),
          sandbox: dir("jo", "jo", "755", "Sep 29 21:05", {
            "README.txt": file("jo", "jo", "644", "Sep 29 21:05", "This folder is yours to wreck. rm works here, and only here.\nEverything in it comes back when you press Reset.\n"),
            "old_menu.txt": file("jo", "jo", "644", "Sep 29 21:06", "STARLITE COFFEE CART\ncoffee ....... 1.50\nlemon pie .... 2.75\n"),
            junk: dir("jo", "jo", "755", "Sep 29 21:06", {
              "tmp1.txt": file("jo", "jo", "644", "Sep 29 21:06", "scratch\n"),
              "tmp2.txt": file("jo", "jo", "644", "Sep 29 21:06", "more scratch\n")
            })
          })
        }),
        wren: dir("wren", "wren", "700", "Oct  3  2023", {
          ".ssh": dir("wren", "wren", "700", "Oct  3  2023", {
            authorized_keys: file("wren", "wren", "600", "Oct  3  2023",
              "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI-not-a-real-key-only-for-this-sim wren@backup-box\n")
          }),
          "notes.txt": file("wren", "wren", "600", "Oct  3  2023", WREN_NOTES)
        })
      }),
      srv: dir("root", "root", "755", "Sep 14  2023", {
        keys: dir("root", "root", "755", "Oct  2 22:41", {
          "LAST_NOTE.txt": file("root", "root", "644", "Oct  3  2023", NOTE),
          "encode.sh": file("root", "root", "644", "Oct  2 22:41", SCRIPT),
          "guests.db": guests,
          "DO_NOT_OPEN": file("root", "root", "000", "Oct  3  2023", LOCKED)
        })
      }),
      "var": dir("root", "root", "755", "Sep 14  2023", {
        log: dir("root", "root", "755", "Oct  7 03:13", {
          "auth.log": logFile("root", "root", "644", "Oct  7 03:02", AUTH_LINES),
          "keys.log": logFile("root", "root", "644", "Oct  7 03:13", KEYS_LINES)
        })
      })
    });
  }

  function content(node) {
    if (node.lines) return node.lines.join("\n") + (node.lines.length ? "\n" : "");
    return node.text;
  }
  function textLines(node) {
    var c = content(node);
    if (c.charAt(c.length - 1) === "\n") c = c.slice(0, -1);
    return c === "" ? [] : c.split("\n");
  }
  function sizeOf(node) { return node.dir ? 4096 : node.binary ? 8192 : content(node).length; }

  function groupsOf(user) { return user === "root" ? ["root"] : [user]; }

  // bit: 4 read, 2 write, 1 execute (search, for a folder).
  function can(node, user, bit) {
    if (user === "root") return bit !== 1 || node.dir || (node.mode & 73) !== 0;
    var shift = node.owner === user ? 6 : (groupsOf(user).indexOf(node.group) >= 0 ? 3 : 0);
    return ((node.mode >> shift) & bit) !== 0;
  }

  function modeString(node) {
    var s = node.dir ? "d" : "-";
    [6, 3, 0].forEach(function (sh) {
      var b = (node.mode >> sh) & 7;
      s += (b & 4 ? "r" : "-") + (b & 2 ? "w" : "-") + (b & 1 ? "x" : "-");
    });
    return s;
  }

  function resolve(S, p) {
    p = String(p);
    var home = "/" + HOME.join("/");
    if (p === "~") p = home;
    else if (p.indexOf("~/") === 0) p = home + p.slice(1);
    var parts = p.charAt(0) === "/" ? [] : S.cwd.slice();
    p.split("/").forEach(function (seg) {
      if (!seg || seg === ".") return;
      if (seg === "..") { if (parts.length) parts.pop(); return; }
      parts.push(seg);
    });
    return parts;
  }

  // Walks the tree as `user`, needing x on every folder passed through, like a real machine.
  function lookup(S, p, user) {
    var parts = resolve(S, p);
    var node = S.fs;
    var parent = null;
    for (var i = 0; i < parts.length; i++) {
      if (!node.dir) return { err: "Not a directory", parts: parts };
      if (!can(node, user, 1)) return { err: "Permission denied", parts: parts };
      if (!has(node.kids, parts[i])) return { err: "No such file or directory", parts: parts };
      parent = node;
      node = node.kids[parts[i]];
    }
    return { node: node, parent: parent, parts: parts };
  }

  function pathText(parts) { return "/" + parts.join("/"); }

  function shortPath(parts) {
    var inHome = parts.length >= HOME.length && HOME.every(function (h, i) { return parts[i] === h; });
    if (inHome) return "~" + (parts.length > HOME.length ? "/" + parts.slice(HOME.length).join("/") : "");
    return pathText(parts);
  }

  function inside(parts, base) {
    if (parts.length <= base.length) return false;
    for (var i = 0; i < base.length; i++) if (parts[i] !== base[i]) return false;
    return true;
  }

  function countItems(node) {
    if (!node.dir) return 1;
    var n = 1;
    Object.keys(node.kids).forEach(function (k) { n += countItems(node.kids[k]); });
    return n;
  }

  /* ---------- parsing a command line ---------- */

  function parseWords(line) {
    var out = [], cur = "", quote = "", started = false, quoted = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (quote) {
        if (ch === quote) quote = ""; else cur += ch;
        continue;
      }
      if (ch === "\"" || ch === "'") { quote = ch; started = true; quoted = true; continue; }
      if (ch === " " || ch === "\t") {
        if (started) { out.push({ v: cur, q: quoted }); cur = ""; started = false; quoted = false; }
        continue;
      }
      cur += ch;
      started = true;
    }
    if (started) out.push({ v: cur, q: quoted });
    return out;
  }

  function globRe(p) {
    var s = "^";
    for (var i = 0; i < p.length; i++) {
      var ch = p.charAt(i);
      if (ch === "*") s += ".*";
      else if (ch === "?") s += ".";
      else s += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
    return new RegExp(s + "$");
  }

  // Turns unquoted words with * or ? into the names they match, like a shell does.
  function expand(S, words, user) {
    var out = [];
    words.forEach(function (w) {
      if (w.q || !/[*?]/.test(w.v)) { out.push(w.v); return; }
      var i = w.v.lastIndexOf("/");
      var prefix = i >= 0 ? w.v.slice(0, i + 1) : "";
      var pat = i >= 0 ? w.v.slice(i + 1) : w.v;
      if (/[*?]/.test(prefix) || !pat) { out.push(w.v); return; }
      var at = lookup(S, prefix || ".", user);
      if (!at.node || !at.node.dir || !can(at.node, user, 4)) { out.push(w.v); return; }
      var re = globRe(pat);
      var names = Object.keys(at.node.kids).filter(function (n) {
        return (pat.charAt(0) === "." || n.charAt(0) !== ".") && re.test(n);
      }).sort();
      if (!names.length) { out.push(w.v); return; }
      names.forEach(function (n) { out.push(prefix + n); });
    });
    return out;
  }

  /* ---------- the screen ---------- */

  var LINE_COLORS = { "": "var(--fg)", cmd: "var(--green)", err: "var(--red)", dim: "var(--faint)", warn: "var(--amber)" };

  function print(api, text, kind) {
    var S = api.state;
    var k = kind || "";
    var doc = api.root.ownerDocument;
    String(text).split("\n").forEach(function (line) {
      var d = doc.createElement("div");
      d.setAttribute("style", "color:" + (LINE_COLORS[k] || LINE_COLORS[""]) + ";min-height:1.5em;");
      d.textContent = line;
      S.ui.screen.appendChild(d);
      if (k !== "cmd") S.lastOut.push(line);
    });
    while (S.ui.screen.children.length > MAX_SCREEN) S.ui.screen.removeChild(S.ui.screen.firstChild);
    S.ui.screen.scrollTop = S.ui.screen.scrollHeight;
  }

  function promptText(S) { return USER + "@" + HOST + ":" + shortPath(S.cwd) + "$"; }

  function updatePrompt(api) {
    var S = api.state;
    S.ui.prompt.textContent = S.mode === "follow" ? "(tail -f running)" : S.mode === "less" ? "(less: Enter, b, q)" : promptText(S);
  }

  function updateStats(api) {
    var S = api.state;
    S.stat.commands(S.commands);
    S.stat.quest(S.quest.filter(Boolean).length);
    var doc = api.root.ownerDocument;
    var Q = S.ui.quest;
    while (Q.firstChild) Q.removeChild(Q.firstChild);
    QUEST.forEach(function (q, i) {
      var li = doc.createElement("li");
      li.setAttribute("style", "color:" + (S.quest[i] ? "var(--green)" : "var(--fg)") + ";");
      li.textContent = (S.quest[i] ? "[x] " : "[ ] ") + q;
      Q.appendChild(li);
    });
  }

  function questDone(api, i, msg) {
    var S = api.state;
    if (S.quest[i]) return;
    S.quest[i] = true;
    api.log("Quest step " + (i + 1) + " done: " + msg, "ok");
    updateStats(api);
  }

  /* ---------- logs that grow while you watch ---------- */

  function appendLog(api, node, line) {
    var S = api.state;
    node.lines.push(line);
    node.mtime = TODAY + " " + clockText(api.clock).slice(0, 5);
    if (S.mode === "follow" && S.follow && S.follow.node === node) print(api, line, "");
  }

  function keydTry(api, at) {
    var S = api.state;
    if ((S.enc.mode & 73) !== 0) {
      appendLog(api, S.keysLog, stamp(at) + " starlite keyd[611]: INFO encoded key for room 11");
      S.pending = false;
      api.log("The card machine at the desk beeps green. Room 11's guest finally has a key.", "ok");
    } else {
      appendLog(api, S.keysLog, stamp(at) + " starlite keyd[611]: ERROR cannot run /srv/keys/encode.sh: Permission denied (room 11)");
    }
  }

  /* ---------- the commands ---------- */

  function flagsOf(args, allowed, cmd, api) {
    var flags = {}, rest = [], bad = "";
    args.forEach(function (a) {
      if (a.length > 1 && a.charAt(0) === "-" && a.charAt(1) !== "-" && !bad) {
        a.slice(1).split("").forEach(function (c) {
          if (allowed.indexOf(c) >= 0) flags[c] = true; else if (!bad) bad = c;
        });
      } else {
        rest.push(a);
      }
    });
    if (bad) { print(api, cmd + ": invalid option -- '" + bad + "'", "err"); return null; }
    return { flags: flags, rest: rest };
  }

  function readable(api, cmd, p, user) {
    var S = api.state;
    var at = lookup(S, p, user);
    if (at.err) { print(api, cmd + ": " + p + ": " + at.err, "err"); return null; }
    if (at.node.dir) { print(api, cmd + ": " + p + ": Is a directory", "err"); return null; }
    if (!can(at.node, user, 4)) { print(api, cmd + ": " + p + ": Permission denied", "err"); return null; }
    if (at.node.binary) {
      print(api, "(sim) " + p + " is binary data: names, rooms and key codes. A real cat would print garbage here.", "dim");
      return null;
    }
    return at.node;
  }

  var COMMANDS = {
    help: function (api) { print(api, HELP, ""); },

    pwd: function (api) { print(api, pathText(api.state.cwd) === "/" ? "/" : pathText(api.state.cwd), ""); },

    whoami: function (api, args, user) { print(api, user, ""); },

    echo: function (api, args) { print(api, args.join(" "), ""); },

    clear: function (api) {
      var S = api.state;
      while (S.ui.screen.firstChild) S.ui.screen.removeChild(S.ui.screen.firstChild);
    },

    history: function (api) {
      var S = api.state;
      print(api, S.history.map(function (h, i) { return lpad(i + 1, 4) + "  " + h; }).join("\n"), "");
    },

    ssh: function (api) {
      print(api, "(sim) You're already on the closet server, at its own keyboard, so there's nowhere to ssh to.\nOn a real machine: ssh user@host. The server checks your key against authorized_keys,\nor asks for a password if passwords are allowed.", "dim");
    },

    exit: function (api) { print(api, "(sim) There's nowhere to log out to. The closet door is behind you.", "dim"); },

    ls: function (api, args, user) {
      var S = api.state;
      var f = flagsOf(args, "la", "ls", api);
      if (!f) return;
      var targets = f.rest.length ? f.rest : ["."];
      targets.forEach(function (p, ti) {
        var at = lookup(S, p, user);
        if (at.err) { print(api, "ls: cannot access '" + p + "': " + at.err, "err"); return; }
        var node = at.node;
        var name = at.parts.length ? at.parts[at.parts.length - 1] : "/";
        if (!node.dir) {
          print(api, f.flags.l ? longLine(node, p) : p, "");
          return;
        }
        if (!can(node, user, 4)) { print(api, "ls: cannot open directory '" + p + "': Permission denied", "err"); return; }
        if (targets.length > 1) print(api, (ti ? "\n" : "") + p + ":", "");
        var names = Object.keys(node.kids).filter(function (n) { return f.flags.a || n.charAt(0) !== "."; }).sort();
        if (!names.length) return;
        if (f.flags.l) {
          print(api, names.map(function (n) { return longLine(node.kids[n], n); }).join("\n"), "");
        } else {
          print(api, names.map(function (n) { return n + (node.kids[n].dir ? "/" : ""); }).join("  "), "");
        }
        if (name === "wren" && user === "root") api.log("sudo opened Wren's folder. Nothing stops root.", "warn");
      });
    },

    cd: function (api, args, user) {
      var S = api.state;
      var p = args.length ? args[0] : "~";
      var at = lookup(S, p, user);
      if (at.err) { print(api, "-bash: cd: " + p + ": " + at.err, "err"); return; }
      if (!at.node.dir) { print(api, "-bash: cd: " + p + ": Not a directory", "err"); return; }
      if (!can(at.node, user, 1)) { print(api, "-bash: cd: " + p + ": Permission denied", "err"); return; }
      S.cwd = at.parts;
      updatePrompt(api);
    },

    cat: function (api, args, user) {
      var S = api.state;
      if (!args.length) { print(api, "(sim) Give cat a file name, like: cat LAST_NOTE.txt", "dim"); return; }
      args.forEach(function (p) {
        var node = readable(api, "cat", p, user);
        if (!node) return;
        var lines = textLines(node);
        if (lines.length) print(api, lines.join("\n"), "");
        if (node === S.note) questDone(api, 0, "you read Wren's note.");
        if (node === S.lockedFile) api.log("sudo opened DO_NOT_OPEN. The machine didn't ask why.", "warn");
      });
    },

    less: function (api, args, user) {
      var S = api.state;
      if (!args.length) { print(api, "(sim) Give less a file name, like: less /var/log/auth.log", "dim"); return; }
      var node = readable(api, "less", args[0], user);
      if (!node) return;
      S.mode = "less";
      S.pager = { lines: textLines(node), pos: 0, name: args[0] };
      if (node === S.note) questDone(api, 0, "you read Wren's note.");
      showPage(api);
      updatePrompt(api);
    },

    grep: function (api, args, user) {
      var S = api.state;
      var f = flagsOf(args, "in", "grep", api);
      if (!f) return;
      if (!f.rest.length) { print(api, "usage: grep [-i] [-n] word file", "err"); return; }
      var word = f.rest[0];
      var files = f.rest.slice(1);
      if (!files.length) {
        print(api, "(sim) This terminal can't read from the keyboard. Give grep a file: grep ERROR /var/log/keys.log", "dim");
        return;
      }
      var needle = f.flags.i ? word.toLowerCase() : word;
      var found = 0;
      files.forEach(function (p) {
        var node = readable(api, "grep", p, user);
        if (!node) return;
        var hits = [];
        textLines(node).forEach(function (line, i) {
          var hay = f.flags.i ? line.toLowerCase() : line;
          if (hay.indexOf(needle) >= 0) hits.push((files.length > 1 ? p + ":" : "") + (f.flags.n ? (i + 1) + ":" : "") + line);
        });
        found += hits.length;
        if (hits.length) print(api, hits.join("\n"), "");
        if (node === S.keysLog && hits.some(function (h) { return h.indexOf("ERROR") >= 0; })) {
          questDone(api, 1, "grep found the ERROR lines. The last one is room 11, Permission denied.");
        }
      });
      if (!found) print(api, "(grep found no lines containing \"" + word + "\")", "dim");
    },

    tail: function (api, args, user) {
      var S = api.state;
      var count = 10, follow = false, files = [], bad = "";
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (a === "-f") follow = true;
        else if (a === "-n" && i + 1 < args.length) { count = parseInt(args[i + 1], 10); i++; }
        else if (/^-n\d+$/.test(a)) count = parseInt(a.slice(2), 10);
        else if (/^-\d+$/.test(a)) count = parseInt(a.slice(1), 10);
        else if (a === "-fn" && i + 1 < args.length) { follow = true; count = parseInt(args[i + 1], 10); i++; }
        else if (a.charAt(0) === "-" && a.length > 1) bad = a;
        else files.push(a);
      }
      if (bad) { print(api, "tail: invalid option '" + bad + "'", "err"); return; }
      if (!(count >= 0)) count = 10;
      if (!files.length) { print(api, "(sim) Give tail a file name, like: tail -f /var/log/auth.log", "dim"); return; }
      if (follow && files.length > 1) { print(api, "(sim) In this sim, tail -f follows one file at a time.", "dim"); return; }
      files.forEach(function (p) {
        var node = readable(api, "tail", p, user);
        if (!node) return;
        if (files.length > 1) print(api, "==> " + p + " <==", "");
        var lines = textLines(node);
        if (count > 0 && lines.length) print(api, lines.slice(-count).join("\n"), "");
        if (follow) {
          S.mode = "follow";
          S.follow = { node: node, name: p };
          print(api, "(sim) Following " + p + ". New lines appear here the moment they're written. Ctrl+C or Stop ends it.", "dim");
          updatePrompt(api);
          api.log("tail -f is watching " + p + ".", "");
        }
      });
    },

    chmod: function (api, args, user) {
      var S = api.state;
      if (args.length < 2) { print(api, "usage: chmod mode file (for example: chmod +x encode.sh, or chmod 755 encode.sh)", "err"); return; }
      var mode = args[0];
      var numeric = /^[0-7]{3,4}$/.test(mode);
      var symbolic = /^[ugoa]*[-+=][rwx]*(,[ugoa]*[-+=][rwx]*)*$/.test(mode);
      if (!numeric && !symbolic) {
        if (mode.charAt(0) === "-") print(api, "(sim) chmod options such as -R aren't in this sim. Use chmod mode file.", "dim");
        else print(api, "chmod: invalid mode: '" + mode + "'", "err");
        return;
      }
      args.slice(1).forEach(function (p) {
        var at = lookup(S, p, user);
        if (at.err) { print(api, "chmod: cannot access '" + p + "': " + at.err, "err"); return; }
        var node = at.node;
        if (user !== "root" && node.owner !== user) {
          print(api, "chmod: changing permissions of '" + p + "': Operation not permitted", "err");
          if (node === S.enc) api.log("chmod refused: root owns encode.sh, and Jo isn't root.", "warn");
          return;
        }
        node.mode = numeric ? (oct(mode) & 511) : applySymbolic(node.mode, mode);
        print(api, "(sim) " + p + " is now " + modeString(node) + ".", "dim");
        if (node === S.enc && (node.mode & 73) !== 0) {
          questDone(api, 2, "encode.sh is executable again. The card machine will try room 11 again within 30 seconds.");
        }
      });
    },

    rm: function (api, args, user, sudo) {
      var S = api.state;
      var recursive = false, force = false, targets = [], bad = "";
      args.forEach(function (a) {
        if (a === "--recursive") recursive = true;
        else if (a === "--force") force = true;
        else if (a === "--no-preserve-root") bad = a;
        else if (a.length > 1 && a.charAt(0) === "-" && a.charAt(1) !== "-") {
          a.slice(1).split("").forEach(function (c) {
            if (c === "r" || c === "R") recursive = true;
            else if (c === "f") force = true;
            else if (!bad) bad = "-" + c;
          });
        } else targets.push(a);
      });
      if (bad === "--no-preserve-root") { print(api, "(sim) Not in this terminal. Not anywhere, really.", "warn"); return; }
      if (bad) { print(api, "rm: invalid option -- '" + bad.slice(1) + "'", "err"); return; }
      if (!targets.length) { print(api, "rm: missing operand", "err"); return; }
      var all = targets.map(function (p) { return { p: p, parts: resolve(S, p) }; });
      if (recursive && all.some(function (t) { return t.parts.length === 0; })) {
        print(api, "rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe", "err");
        print(api, "(sim) That one guard is built into GNU rm. It's the only one. Nothing else stops rm -rf.", "dim");
        api.log("rm -rf / was refused by rm's own failsafe, the only guard it has.", "warn");
        return;
      }
      var outside = all.filter(function (t) { return !inside(t.parts, SANDBOX); });
      if (outside.length) {
        print(api, "(sim) rm refused. In this sim, rm only works inside ~/sandbox. On a real machine nothing would have stopped it" +
          (sudo ? ", and with sudo, not even permissions." : ", except permissions, and sudo gets past those."), "warn");
        api.log("rm on " + outside.map(function (t) { return pathText(t.parts); }).join(", ") + " was refused by the sim. A real server would not have refused.", "bad");
        return;
      }
      var removed = 0;
      all.forEach(function (t) {
        var at = lookup(S, t.p, user);
        if (at.err) {
          if (!force) print(api, "rm: cannot remove '" + t.p + "': " + at.err, "err");
          return;
        }
        if (at.node.dir && !recursive) { print(api, "rm: cannot remove '" + t.p + "': Is a directory", "err"); return; }
        if (!can(at.parent, user, 2)) { print(api, "rm: cannot remove '" + t.p + "': Permission denied", "err"); return; }
        removed += countItems(at.node);
        delete at.parent.kids[at.parts[at.parts.length - 1]];
      });
      if (lookup(S, ".", user).err) { S.cwd = SANDBOX.slice(); updatePrompt(api); }
      if (removed) {
        print(api, "(sim) Deleted " + removed + (removed === 1 ? " item" : " items") + ". There's no trash can and no undo. On a real server it would be gone for good.", "warn");
        api.log("rm deleted " + removed + (removed === 1 ? " item" : " items") + " in the sandbox. No undo.", "warn");
      }
    }
  };

  function longLine(node, name) {
    return modeString(node) + " " + (node.dir ? "2" : "1") + " " + rpad(node.owner, 4) + " " + rpad(node.group, 4) + " " +
      lpad(sizeOf(node), 5) + " " + node.mtime + " " + name + (node.dir ? "/" : "");
  }

  function applySymbolic(mode, spec) {
    spec.split(",").forEach(function (clause) {
      var m = /^([ugoa]*)([-+=])([rwx]*)$/.exec(clause);
      if (!m) return;
      var who = m[1] || "a";
      var bits = (m[3].indexOf("r") >= 0 ? 4 : 0) | (m[3].indexOf("w") >= 0 ? 2 : 0) | (m[3].indexOf("x") >= 0 ? 1 : 0);
      var shifts = [];
      if (who.indexOf("a") >= 0 || who.indexOf("u") >= 0) shifts.push(6);
      if (who.indexOf("a") >= 0 || who.indexOf("g") >= 0) shifts.push(3);
      if (who.indexOf("a") >= 0 || who.indexOf("o") >= 0) shifts.push(0);
      shifts.forEach(function (sh) {
        var b = bits << sh;
        if (m[2] === "+") mode |= b;
        else if (m[2] === "-") mode &= ~b;
        else mode = (mode & ~(7 << sh)) | b;
      });
    });
    return mode & 511;
  }

  function showPage(api) {
    var S = api.state;
    var P = S.pager;
    if (!P) return;
    if (P.pos >= P.lines.length && P.lines.length) { print(api, "(END) q to quit", "dim"); return; }
    var end = Math.min(P.lines.length, P.pos + PAGE);
    if (end > P.pos) print(api, P.lines.slice(P.pos, end).join("\n"), "");
    print(api, end >= P.lines.length
      ? "(END) q to quit"
      : "-- " + P.name + ", lines " + (P.pos + 1) + "-" + end + " of " + P.lines.length + ". Enter: more, b: back, q: quit --", "dim");
    P.pos = end;
  }

  function pagerKey(api, k) {
    var S = api.state;
    var key = String(k).trim().toLowerCase();
    if (key === "q") {
      S.mode = "";
      S.pager = null;
      print(api, "(less closed)", "dim");
      updatePrompt(api);
      return;
    }
    if (key === "b") {
      S.pager.pos = Math.max(0, S.pager.pos - 2 * PAGE);
      showPage(api);
      return;
    }
    showPage(api);
  }

  function interrupt(api) {
    var S = api.state;
    if (S.mode === "follow") {
      print(api, "^C", "");
      api.log("Stopped tail -f.", "");
    } else if (S.mode === "less") {
      print(api, "(less closed)", "dim");
    } else {
      print(api, promptText(S) + " ^C", "cmd");
    }
    S.mode = "";
    S.follow = null;
    S.pager = null;
    updatePrompt(api);
  }

  /* ---------- running a line ---------- */

  function submit(api, raw) {
    var S = api.state;
    var line = String(raw === undefined || raw === null ? "" : raw);
    if (S.mode === "less") { pagerKey(api, line); return; }
    if (S.mode === "follow") {
      if (line.trim()) print(api, "(sim) tail -f is still running. Press Ctrl+C or Stop first.", "dim");
      return;
    }
    print(api, promptText(S) + " " + line, "cmd");
    S.lastOut = [];
    var trimmed = line.trim();
    if (!trimmed) return;
    S.history.push(trimmed);
    if (S.history.length > MAX_HISTORY) S.history.shift();
    S.hpos = S.history.length;
    S.commands += 1;
    run(api, trimmed);
    updateStats(api);
  }

  function run(api, line) {
    var S = api.state;
    var words = parseWords(line);
    if (!words.length) return;
    var sudo = false;
    if (words[0].v === "sudo") {
      sudo = true;
      words = words.slice(1);
      if (!words.length) { print(api, "usage: sudo command", "err"); return; }
      var first = words[0].v;
      if (first === "su" || first === "-i" || first === "-s" || first === "bash" || first === "sh") {
        print(api, "(sim) This terminal won't open a root shell. Put sudo in front of each command instead, so each one is logged.", "dim");
        return;
      }
      if (!S.sudoNoted) {
        print(api, "(sim) The real sudo would ask for your own password here, then remember it for a few minutes.", "dim");
        S.sudoNoted = true;
      }
    }
    var cmd = words[0].v;
    var user = sudo ? "root" : USER;
    if (sudo && cmd === "cd") {
      print(api, "sudo: cd: command not found", "err");
      print(api, "(sim) cd is part of the shell itself, not a program, so sudo can't run it.", "dim");
      return;
    }
    if (cmd === "nano" || cmd === "vi" || cmd === "vim") {
      print(api, "(sim) No text editors in this closet. On a real server you'd edit files with nano or vim.", "dim");
      return;
    }
    var key = cmd === "logout" ? "exit" : cmd;
    if (!has(COMMANDS, key)) { print(api, cmd + ": command not found", "err"); return; }
    if (sudo) {
      appendLog(api, S.authLog, stamp(api.clock) + " starlite sudo:       jo : TTY=tty1 ; PWD=" + pathText(S.cwd) +
        " ; USER=root ; COMMAND=/usr/bin/" + words.map(function (w) { return w.v; }).join(" "));
      api.log("sudo ran \"" + words.map(function (w) { return w.v; }).join(" ") + "\" as root, and wrote it to the auth log.", "");
    }
    COMMANDS[key](api, expand(S, words.slice(1), user), user, sudo);
  }

  function historyStep(api, d) {
    var S = api.state;
    var n = S.history.length;
    S.hpos = Math.max(0, Math.min(n, S.hpos + d));
    S.ui.input.value = S.hpos < n ? S.history[S.hpos] : "";
  }

  /* ---------- the widget (plain DOM inside api.root) ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text !== undefined && text !== null) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;");

    var screen = el("div", "font-family:var(--f-ui);font-size:13px;line-height:1.5;background:var(--bg);color:var(--fg);" +
      "border:1px solid var(--line);border-radius:4px;padding:10px 12px;height:300px;overflow-y:auto;" +
      "white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;min-width:0;");
    screen.setAttribute("role", "log");
    screen.setAttribute("aria-live", "polite");
    screen.setAttribute("aria-label", "Terminal output");
    screen.setAttribute("tabindex", "0");

    var form = el("form", "display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0;min-width:0;");
    var prompt = el("label", "font-family:var(--f-ui);font-size:13px;color:var(--green);white-space:nowrap;", "");
    prompt.setAttribute("for", "s1e13-cmd");
    var input = el("input", "flex:1 1 160px;min-width:0;box-sizing:border-box;font-family:var(--f-ui);font-size:13px;color:var(--fg);" +
      "background:var(--surface-2);border:1px solid var(--line);border-radius:4px;padding:7px 8px;");
    input.type = "text";
    input.id = "s1e13-cmd";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("aria-describedby", "s1e13-help");
    var go = el("button", null, "Run");
    go.type = "submit";
    go.className = "btn btn-small btn-primary";
    form.appendChild(prompt);
    form.appendChild(input);
    form.appendChild(go);
    var help = el("p", "margin:0;font-family:var(--f-ui);font-size:11px;color:var(--muted);",
      "Type a command and press Enter. Up and down arrows: history. Ctrl+C or Stop: end tail -f or less.");
    help.id = "s1e13-help";

    var qwrap = el("div", "min-width:0;");
    qwrap.appendChild(el("p", "margin:0 0 4px;color:var(--muted);font-family:var(--f-ui);font-size:11px;letter-spacing:.07em;text-transform:uppercase;", "Quest"));
    var quest = el("ol", "margin:0;padding-left:0;list-style:none;display:grid;gap:4px;font-family:var(--f-ui);font-size:12px;");
    qwrap.appendChild(quest);

    box.appendChild(screen);
    box.appendChild(form);
    box.appendChild(help);
    box.appendChild(qwrap);
    api.root.appendChild(box);
    return { screen: screen, form: form, prompt: prompt, input: input, quest: quest };
  }

  /* ---------- the module ---------- */

  DL.sims.define("s1e13", {
    startClock: START,
    speed: 1,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.fs = buildFS();
      S.cwd = HOME.slice();
      S.history = [];
      S.hpos = 0;
      S.mode = "";
      S.pager = null;
      S.follow = null;
      S.lastOut = [];
      S.commands = 0;
      S.quest = [false, false, false];
      S.sudoNoted = false;
      S.loggedIn = false;
      S.pending = true;
      S.nextRetry = FIRST_RETRY;
      S.pid = 2140 + Math.floor(api.rand() * 60);
      S.port = 49152 + Math.floor(api.rand() * 16000);
      var keys = S.fs.kids.srv.kids.keys.kids;
      S.enc = keys["encode.sh"];
      S.note = keys["LAST_NOTE.txt"];
      S.lockedFile = keys.DO_NOT_OPEN;
      S.authLog = S.fs.kids["var"].kids.log.kids["auth.log"];
      S.keysLog = S.fs.kids["var"].kids.log.kids["keys.log"];

      S.ui = buildWidget(api);
      S.ui.form.addEventListener("submit", function (e) {
        if (e && typeof e.preventDefault === "function") e.preventDefault();
        var v = S.ui.input.value;
        S.ui.input.value = "";
        submit(api, v);
      });
      S.ui.input.addEventListener("keydown", function (e) {
        var key = (e && e.key) || "";
        var code = (e && e.keyCode) || 0;
        var stop = function () { if (typeof e.preventDefault === "function") e.preventDefault(); };
        if (e.ctrlKey && (key === "c" || key === "C" || code === 67)) {
          var inp = S.ui.input;
          if (S.mode === "" && inp.value && inp.selectionStart !== inp.selectionEnd) return;   // let copy work
          stop();
          inp.value = "";
          interrupt(api);
          return;
        }
        if (key === "ArrowUp" || code === 38) { stop(); historyStep(api, -1); return; }
        if (key === "ArrowDown" || code === 40) { stop(); historyStep(api, 1); return; }
        if (S.mode === "less" && !S.ui.input.value && (key === "q" || key === " " || key === "b")) {
          stop();
          pagerKey(api, key === " " ? "" : key);
        }
      });

      S.ctl = {};
      S.ctl.stop = api.control.button("ctrlc", "Stop (Ctrl+C)", function () { interrupt(api); });
      S.ctl.hint = api.control.button("hint", "Hint for the next step", function () {
        var next = S.quest.indexOf(false);
        api.info(HINTS[next < 0 ? 3 : next]);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        commands: api.stat("commands", "commands run", ""),
        quest: api.stat("quest", "quest steps done (of 3)", "ok")
      };

      print(api, "starlite login: jo\nPassword:\nLast login: Tue Oct  6 02:03:11 on tty1", "");
      print(api, "(sim) A pretend terminal. Type help to see the commands.", "dim");
      updatePrompt(api);
      updateStats(api);
      api.info("<strong>A pretend terminal.</strong> Nothing here touches a real machine. Type <em>help</em> for the commands. Your quest is under the terminal, and <em>Hint</em> nudges you toward the next step. rm only works inside ~/sandbox.");
      api.log("03:13:30. Jo sits down at the black screen. Somewhere out front, the guest in room 11 is still waiting for a key.", "");
    },

    step: function (api) {
      var S = api.state;
      if (!S.fs) return;
      while (S.pending && api.clock >= S.nextRetry) {
        keydTry(api, S.nextRetry);
        S.nextRetry += RETRY_EVERY;
      }
      if (!S.loggedIn && api.clock >= LOGIN_AT) {
        S.loggedIn = true;
        appendLog(api, S.authLog, stamp(LOGIN_AT) + " starlite sshd[" + S.pid + "]: Accepted publickey for wren from 203.0.113.50 port " + S.port + " ssh2");
        api.log("03:14:07. The hard drive clicks twice. Something just logged in as wren.", "bad");
      }
    },

    selfTest: async function (t) {
      var S = t.api.state;
      var root = t.api.root;
      var doc = root.ownerDocument;
      var win = doc.defaultView;
      function fire(el, type) {
        var e = doc.createEvent("Event");
        e.initEvent(type, true, true);
        el.dispatchEvent(e);
      }
      function press(el, key) {
        var e = null;
        if (win && typeof win.KeyboardEvent === "function") {
          try { e = new win.KeyboardEvent("keydown", { key: key, bubbles: true, cancelable: true }); } catch (x) { e = null; }
        }
        if (!e) {
          e = doc.createEvent("Event");
          e.initEvent("keydown", true, true);
          try { Object.defineProperty(e, "key", { value: key }); } catch (x) { /* best effort */ }
        }
        el.dispatchEvent(e);
      }
      function type(cmd) { S.ui.input.value = cmd; fire(S.ui.form, "submit"); }
      function out() { return S.lastOut.join("\n"); }
      function n(id) { return Number(t.stat(id)); }

      // 1. Where am I?
      type("pwd");
      t.expect(out() === "/home/jo" && n("commands") === 1, "pwd prints /home/jo, Jo's home folder, and counts one command");

      // 2. cd and ls.
      type("cd /srv/keys");
      type("ls");
      t.expect(out().indexOf("LAST_NOTE.txt") >= 0 && out().indexOf("encode.sh") >= 0 && S.ui.prompt.textContent.indexOf("/srv/keys") >= 0,
        "cd /srv/keys then ls lists the note and encode.sh, and the prompt shows the new folder");

      // 3. The note.
      type("cat LAST_NOTE.txt");
      t.expect(out().indexOf("Never rm -rf") >= 0 && n("quest") === 1, "cat LAST_NOTE.txt prints Wren's note and completes quest step 1");

      // 4. grep the last error.
      type("grep ERROR /var/log/keys.log");
      t.expect(out().indexOf("Permission denied (room 11)") >= 0 && out().indexOf("INFO") < 0 && n("quest") === 2,
        "grep ERROR /var/log/keys.log prints only the ERROR lines, ending with room 11, and completes step 2");

      // 5. chmod is refused for Jo, works with sudo, and ls -l shows the x.
      type("chmod +x encode.sh");
      var refused = out().indexOf("Operation not permitted") >= 0 && n("quest") === 2;
      type("sudo chmod +x encode.sh");
      type("ls -l encode.sh");
      t.expect(refused && out().indexOf("-rwxr-xr-x") === 0 && n("quest") === 3,
        "chmod +x is refused without sudo (root owns the file), works with sudo, and ls -l then shows -rwxr-xr-x");

      // 6. The locked file.
      type("cat DO_NOT_OPEN");
      var denied = out().indexOf("Permission denied") >= 0;
      type("sudo cat DO_NOT_OPEN");
      t.expect(denied && out().indexOf("you used sudo") >= 0, "the locked file says Permission denied to Jo but opens for sudo");

      // 7. tail -f catches the 03:14:07 login live, and Stop ends it.
      type("tail -f /var/log/auth.log");
      var following = S.mode === "follow";
      await t.run(40);
      var screen = S.ui.screen.textContent;
      t.click("ctrlc");
      t.expect(following && screen.indexOf("Oct  7 03:14:07 starlite sshd[") >= 0 && screen.indexOf("Accepted publickey for wren") >= 0 && S.mode === "",
        "tail -f prints wren's 03:14:07 key login the moment it is written, and Stop (Ctrl+C) ends it");

      // 8. The card machine recovers once encode.sh is executable.
      type("tail -n 3 /var/log/keys.log");
      t.expect(out().indexOf("INFO encoded key for room 11") >= 0, "with encode.sh executable again, the card machine's next try encodes room 11's key");

      // 9. rm outside the sandbox is refused; inside, it deletes with a warning.
      type("rm -rf /srv/keys");
      type("ls /srv/keys");
      var kept = out().indexOf("encode.sh") >= 0;
      type("cd ~/sandbox");
      type("rm -r junk");
      var warned = out().indexOf("no undo") >= 0;
      type("ls");
      t.expect(kept && warned && out().indexOf("junk") < 0 && out().indexOf("README.txt") >= 0,
        "rm -rf /srv/keys is refused outside the sandbox, but rm -r junk inside it deletes with a no-undo warning");

      // 10. The up arrow brings back the last command.
      S.ui.input.value = "";
      press(S.ui.input, "ArrowUp");
      t.expect(S.ui.input.value === "ls", "the up arrow brings back the last command");

      // 11. less pages a file and q closes it.
      S.ui.input.value = "";
      type("less /var/log/auth.log");
      var paging = S.mode === "less" && out().indexOf("Enter: more") >= 0;
      type("q");
      t.expect(paging && S.mode === "", "less shows a page with a status line, and q closes it");
    }
  });
})();
