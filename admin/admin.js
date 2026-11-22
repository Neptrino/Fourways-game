// Fourways admin: what players sent with F8, and the play statistics of those who said yes
// (docs/FEEDBACK.md). It talks to the Supabase project "fourways-feedback" with its public key;
// row-level security there lets only a confirmed admin account read anything (or set a message's
// status and note). Everything players wrote is shown as text, never as HTML.
(function () {
  "use strict";

  var SUPABASE_URL = "https://zkutygermqqyzouhjmtz.supabase.co";
  // The project's public (anon) key: it reads nothing on its own, see above.
  var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprdXR5Z2VybXFxeXpvdWhqbXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MDQ4ODEsImV4cCI6MjExMDE4MDg4MX0.JITgZKVn6vQvbzhQc-1qND-PYmv_M4ETtoDT2PaEWJY";
  var BUCKET = "feedback";
  var ABOUT = { problem: "Problem", idea: "Idea", other: "Other" };
  var STEPS = { station: "Build a station", vehicle: "Buy a vehicle", delivery: "First delivery", towns: "Passengers between towns",
    train: "Run a train", industry: "Deliver to an industry", profit: "A month in profit", loan: "Pay off the loan" };

  var app = {
    db: null,
    status: "new", about: "", hideDev: true,
    items: [], current: null,
  };
  window.FourwaysAdmin = app;          // handy from the browser's console

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }
  function svg(tag, attrs) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function when(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  function num(n) { return Number(n || 0).toLocaleString(); }
  function money(n) { return (n < 0 ? "-$" : "$") + Math.abs(Number(n || 0)).toLocaleString(); }

  var SECTIONS = ["loading", "signin", "denied", "feedback", "stats"];
  function show(id) { SECTIONS.forEach(function (s) { $(s).hidden = s !== id; }); }

  // ------------------------------------------------------------------ signing in

  // Signing in only: accounts are made in the Supabase dashboard (docs/FEEDBACK.md), not here.
  function showSignin() {
    $("tabs").hidden = true;
    $("who").hidden = true;
    show("signin");
  }

  function say(text, kind) {
    var s = $("signin-status");
    s.textContent = text;
    s.className = "status" + (kind ? " " + kind : "");
  }

  async function submitSignin(ev) {
    ev.preventDefault();
    var email = $("email").value.trim(), password = $("password").value;
    $("signin-go").disabled = true;
    say("Signing in…");
    try {
      var r = await app.db.auth.signInWithPassword({ email: email, password: password });
      if (r.error) return say(r.error.message === "Email not confirmed"
        ? "Confirm the address first: click the link in the email from Supabase." : r.error.message, "bad");
      $("password").value = "";
      say("");
      await enter(r.data.session);
    } finally {
      $("signin-go").disabled = false;
    }
  }

  async function enter(session) {
    $("who-email").textContent = session.user.email;
    $("who").hidden = false;
    show("loading");
    var r = await app.db.rpc("is_admin");
    if (r.error || r.data !== true) {
      show("denied");
      return;
    }
    $("tabs").hidden = false;
    openTab(location.hash === "#stats" ? "stats" : "feedback");
  }

  function openTab(tab) {
    Array.prototype.forEach.call($("tabs").querySelectorAll("button"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.tab === tab));
    });
    history.replaceState(null, "", tab === "stats" ? "#stats" : location.pathname + location.search);
    show(tab);
    if (tab === "stats") loadStats(); else loadFeedback();
  }

  // ------------------------------------------------------------------ feedback

  function filtered(q) {
    if (app.hideDev) q = q.or("version.is.null,version.neq.dev");
    return q;
  }

  async function loadFeedback() {
    var q = app.db.from("feedback").select("id,created_at,about,message,email,version,platform,status")
      .order("created_at", { ascending: false }).limit(300);
    if (app.status) q = q.eq("status", app.status);
    if (app.about) q = q.eq("about", app.about);
    var r = await filtered(q);
    app.items = r.data || [];
    renderList(r.error);
    updateNewCount();
    if (app.current && !app.items.some(function (i) { return i.id === app.current; })) {
      app.current = null;
      $("detail").replaceChildren(el("p", "muted", "Pick a message."));
    }
  }

  async function updateNewCount() {
    var r = await filtered(app.db.from("feedback").select("id", { count: "exact", head: true }).eq("status", "new"));
    var c = $("new-count");
    c.hidden = !r.count;
    c.textContent = r.count || "";
  }

  function renderList(error) {
    var list = $("list");
    list.replaceChildren();
    if (error) { list.appendChild(el("li", "empty", "Couldn't load: " + error.message)); return; }
    if (!app.items.length) { list.appendChild(el("li", "empty", "Nothing here.")); return; }
    app.items.forEach(function (it) {
      var li = el("li", it.status === "new" ? "unread" : "");
      var b = el("button");
      b.type = "button";
      b.setAttribute("aria-current", String(it.id === app.current));
      var meta = el("span", "meta");
      meta.appendChild(el("span", "badge " + it.about, ABOUT[it.about] || it.about));
      meta.appendChild(el("span", "", when(it.created_at)));
      meta.appendChild(el("span", "", it.version || ""));
      if (it.email) meta.appendChild(el("span", "", "✉"));
      b.appendChild(meta);
      b.appendChild(el("span", "first", it.message.split("\n")[0]));
      b.addEventListener("click", function () { openItem(it.id); });
      li.appendChild(b);
      list.appendChild(li);
    });
  }

  async function openItem(id) {
    app.current = id;
    Array.prototype.forEach.call($("list").querySelectorAll("button"), function (b, i) {
      b.setAttribute("aria-current", String(app.items[i] && app.items[i].id === id));
    });
    var box = $("detail");
    box.replaceChildren(el("p", "muted", "Loading…"));
    var r = await app.db.from("feedback").select("*").eq("id", id).single();
    if (r.error) { box.replaceChildren(el("p", "status bad", r.error.message)); return; }
    var f = r.data;
    if (f.status === "new") {                // opening it reads it
      await setStatus(f, "read", true);
    }
    renderDetail(f);
    if (window.matchMedia("(max-width: 860px)").matches) box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function setStatus(f, status, quiet) {
    var r = await app.db.from("feedback").update({ status: status }).eq("id", f.id);
    if (r.error) { alert("Couldn't change it: " + r.error.message); return; }
    f.status = status;
    var it = app.items.find(function (i) { return i.id === f.id; });
    if (it) it.status = status;
    if (!quiet) renderDetail(f);
    renderList();
    updateNewCount();
  }

  async function signed(path, download) {
    var r = await app.db.storage.from(BUCKET).createSignedUrl(path, 600, download ? { download: download } : undefined);
    return r.error ? null : r.data.signedUrl;
  }

  function factList(rows) {
    var dl = el("dl");
    rows.forEach(function (r) {
      if (r[1] === undefined || r[1] === null || r[1] === "") return;
      dl.appendChild(el("dt", "", r[0]));
      dl.appendChild(el("dd", "", r[1]));
    });
    return dl;
  }

  function renderDetail(f) {
    var box = $("detail");
    box.replaceChildren();
    var head = el("div", "head");
    head.appendChild(el("span", "badge " + f.about, ABOUT[f.about] || f.about));
    head.appendChild(el("span", "muted", new Date(f.created_at).toLocaleString()));
    head.appendChild(el("span", "muted", "#" + f.id + " · " + (f.version || "?") + " · " + (f.platform || "?")));
    box.appendChild(head);
    box.appendChild(el("div", "message", f.message));

    var actions = el("div", "actions");
    [["new", "Mark as new"], ["read", "Read"], ["done", "Done"]].forEach(function (s) {
      var b = el("button", f.status === s[0] ? "primary" : "", s[1]);
      b.type = "button";
      b.disabled = f.status === s[0];
      b.addEventListener("click", function () { setStatus(f, s[0]); });
      actions.appendChild(b);
    });
    if (f.email) {
      var mail = el("a", "", "Answer " + f.email);
      mail.href = "mailto:" + encodeURIComponent(f.email) + "?subject=" + encodeURIComponent("Your Fourways feedback");
      actions.appendChild(mail);
    }
    if (f.save_path) {
      var save = el("button", "", "Download the save");
      save.type = "button";
      save.title = "Put it in %APPDATA%\\Godot\\app_userdata\\Fourways\\saves and load it";
      save.addEventListener("click", async function () {
        var url = await signed(f.save_path, "fourways-feedback-" + f.id + ".json");
        if (url) location.href = url; else alert("Couldn't get the file.");
      });
      actions.appendChild(save);
    }
    box.appendChild(actions);

    if (f.screenshot_path) {
      var shot = el("div", "shot");
      box.appendChild(shot);
      signed(f.screenshot_path).then(function (url) {
        if (!url) return;
        var img = el("img");
        img.src = url;
        img.alt = "What the player was looking at";
        img.addEventListener("click", function () { window.open(url, "_blank", "noopener"); });
        shot.appendChild(img);
      });
    }

    var sys = f.system || {};
    var g = f.game || null;
    var facts = el("div", "facts");
    var s1 = el("div");
    s1.appendChild(el("h2", "", "System"));
    s1.appendChild(factList([["OS", [sys.os, sys.os_version].filter(Boolean).join(" ")], ["Screen", sys.screen],
      ["Graphics", sys.gpu], ["RAM", sys.ram_gb ? sys.ram_gb + " GB" : ""], ["CPU cores", sys.cpu_cores],
      ["Language", sys.language], ["Interface size", sys.ui_scale ? Math.round(sys.ui_scale * 100) + "%" : ""],
      ["Mods", sys.mods], ["Godot", sys.godot], ["Statistics id", f.install_id]]));
    facts.appendChild(s1);
    if (g) {
      var s2 = el("div");
      s2.appendChild(el("h2", "", "The game"));
      var steps = Array.isArray(g.steps) ? g.steps : [];
      s2.appendChild(factList([["Date", g.date], ["Map", g.map + (g.seed !== undefined ? " · seed " + g.seed : "")],
        ["Rivals", g.rivals], ["Vehicles", g.vehicles], ["Stations", g.stations], ["Lines", g.lines],
        ["Money", g.money !== undefined ? money(g.money) + " (loan " + money(g.loan) + ")" : ""],
        ["Company value", g.value !== undefined ? money(g.value) : ""],
        ["First steps", steps.length + " of 8" + (steps.length ? ": " + steps.join(", ") : "")],
        ["Achievements", g.achievements], ["Goal", g.goal && g.goal !== "none" ? g.goal + (g.goal_result ? " (" + g.goal_result + ")" : "") : ""],
        ["Speed", g.speed], ["Windows open", Array.isArray(g.windows) ? g.windows.join(", ") : ""],
        ["Mods on", Array.isArray(g.mods) ? g.mods.join(", ") : ""]]));
      facts.appendChild(s2);
    }
    box.appendChild(facts);

    if (f.log_path) {
      var det = el("details");
      det.appendChild(el("summary", "", "The game's log"));
      var pre = el("pre", "log", "Loading…");
      det.appendChild(pre);
      det.addEventListener("toggle", async function () {
        if (!det.open || pre.dataset.loaded) return;
        pre.dataset.loaded = "1";
        var r = await app.db.storage.from(BUCKET).download(f.log_path);
        pre.textContent = r.error ? "Couldn't load it: " + r.error.message : await r.data.text();
      });
      box.appendChild(det);
    }

    var note = el("div", "note");
    var lab = el("label", "muted small", "Your note");
    var ta = el("textarea");
    ta.value = f.note || "";
    lab.appendChild(ta);
    note.appendChild(lab);
    var saveNote = el("button", "", "Save the note");
    saveNote.type = "button";
    saveNote.addEventListener("click", async function () {
      saveNote.disabled = true;
      var r = await app.db.from("feedback").update({ note: ta.value }).eq("id", f.id);
      saveNote.disabled = false;
      saveNote.textContent = r.error ? "Couldn't save: " + r.error.message : "Saved";
      if (!r.error) f.note = ta.value;
      setTimeout(function () { saveNote.textContent = "Save the note"; }, 2000);
    });
    note.appendChild(saveNote);
    box.appendChild(note);
  }

  // ------------------------------------------------------------------ statistics

  async function loadStats() {
    var res = await Promise.all([
      app.db.from("stats_summary").select("*").single(),
      app.db.from("stats_daily").select("*").limit(60),
      app.db.from("stats_first_steps").select("*"),
      app.db.from("stats_systems").select("*").limit(200),
    ]);
    var sum = res[0].data || {};
    var tiles = $("tiles");
    tiles.replaceChildren();
    [["Players this week", sum.players_7d], ["Players this month", sum.players_30d], ["Sessions this month", sum.sessions_30d],
      ["Hours played this month", sum.hours_30d], ["Crashes this month", sum.crashes_30d], ["Players ever", sum.players_ever]]
      .forEach(function (t) {
        var d = el("div", "tile");
        d.appendChild(el("div", "v", num(t[1])));
        d.appendChild(el("div", "k", t[0]));
        tiles.appendChild(d);
      });

    // The last 30 days, quiet days included.
    var byDay = {};
    (res[1].data || []).forEach(function (r) { byDay[r.day] = r; });
    var days = [];
    for (var i = 29; i >= 0; i--) {
      var d = new Date(Date.now() - i * 86400000);
      var key = d.toISOString().slice(0, 10);
      var r = byDay[key] || {};
      days.push({ key: key, label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        players: Number(r.players || 0), hours: Number(r.hours_played || 0), sessions: Number(r.sessions || 0) });
    }
    columns($("chart-players"), "Players per day", "Last 30 days", days.map(function (d) {
      return { label: d.label, value: d.players, tip: d.label + ": " + num(d.players) + " players, " + num(d.sessions) + " sessions" };
    }));
    columns($("chart-hours"), "Hours played per day", "Last 30 days, from runs that closed", days.map(function (d) {
      return { label: d.label, value: d.hours, tip: d.label + ": " + d.hours + " hours" };
    }));
    bars($("chart-steps"), "How far players get", "Players who have done each first step, of all players with statistics on",
      (res[2].data || []).map(function (s) {
        return { label: STEPS[s.step] || s.step, value: Number(s.percent || 0),
          text: Math.round(Number(s.percent || 0)) + "%  ·  " + num(s.players_done),
          tip: (STEPS[s.step] || s.step) + ": " + num(s.players_done) + " players (" + Number(s.percent || 0) + "%)" };
      }));

    var sys = res[3].data || [];
    var versions = {};
    sys.forEach(function (s) { versions[s.version || "?"] = (versions[s.version || "?"] || 0) + Number(s.players); });
    table($("versions"), ["Version", "Players"], Object.keys(versions).sort().reverse().map(function (v) { return [v, num(versions[v])]; }));
    table($("systems"), ["OS", "Graphics", "Version", "Players", "Avg FPS", "Time under 30 FPS", "FPS players"], sys.map(function (s) {
      return [s.os || "?", s.gpu || "?", s.version || "?", num(s.players),
        s.avg_fps == null ? "—" : num(s.avg_fps),
        s.below_30_percent == null ? "—" : num(s.below_30_percent) + "%", num(s.fps_players)];
    }), 3);
  }

  function table(t, head, rows, firstNumeric = head.length - 1) {
    t.replaceChildren();
    var tr = el("tr");
    head.forEach(function (h, i) { tr.appendChild(el("th", i >= firstNumeric ? "n" : "", h)); });
    t.appendChild(tr);
    if (!rows.length) { var e = el("tr"); var td = el("td", "muted", "Nothing yet."); td.colSpan = head.length; e.appendChild(td); t.appendChild(e); }
    rows.forEach(function (r) {
      var row = el("tr");
      r.forEach(function (c, i) { row.appendChild(el("td", i >= firstNumeric ? "n" : "", c)); });
      t.appendChild(row);
    });
  }

  // A tooltip that follows the pointer over a chart's marks.
  function hover(target, text) {
    var tip = $("tip");
    target.addEventListener("pointermove", function (e) {
      tip.textContent = text;
      tip.hidden = false;
      var x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
      tip.style.left = x + "px";
      tip.style.top = (e.clientY - tip.offsetHeight - 10) + "px";
    });
    target.addEventListener("pointerleave", function () { tip.hidden = true; });
  }

  function chartHead(fig, title, sub) {
    fig.replaceChildren();
    var cap = el("figcaption");
    cap.appendChild(el("h2", "", title));
    cap.appendChild(el("p", "muted small", sub));
    fig.appendChild(cap);
  }

  // The same numbers as a table, for reading exact values.
  function tableView(fig, head, rows) {
    var det = el("details");
    det.appendChild(el("summary", "small", "As a table"));
    var t = el("table");
    table(t, head, rows);
    det.appendChild(t);
    fig.appendChild(det);
  }

  // One column per day: a single series, so no legend; the title names it.
  function columns(fig, title, sub, data) {
    chartHead(fig, title, sub);
    var W = 600, H = 220, L = 34, B = 24, T = 8;
    var max = Math.max.apply(null, data.map(function (d) { return d.value; }));
    var top = niceTop(max);
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": title });
    [0, 0.5, 1].forEach(function (f) {
      var y = H - B - (H - B - T) * f;
      s.appendChild(svg("line", { x1: L, x2: W, y1: y, y2: y, class: "grid" }));
      var lab = svg("text", { x: L - 6, y: y + 4, "text-anchor": "end", class: "axis" });
      lab.textContent = fmtTick(top * f);
      s.appendChild(lab);
    });
    var step = (W - L) / data.length, bw = Math.max(2, step - 2);
    data.forEach(function (d, i) {
      var h = top ? (H - B - T) * d.value / top : 0;
      var x = L + i * step + 1;
      if (h > 0) {
        var r = Math.min(4, bw / 2, h);
        // Rounded at the data end, square on the baseline.
        s.appendChild(svg("path", { class: "bar", d: "M" + x + "," + (H - B) + "v" + (-(h - r)) + "q0," + (-r) + " " + r + "," + (-r) +
          "h" + (bw - 2 * r) + "q" + r + ",0 " + r + "," + r + "v" + (h - r) + "z" }));
      }
      var hit = svg("rect", { x: x - 1, y: T, width: step, height: H - B - T, class: "hit" });
      hover(hit, d.tip);
      s.appendChild(hit);
      // A label a week, and today's (the weekly one just before it gives way).
      if ((i % 7 === 0 && data.length - 1 - i >= 4) || i === data.length - 1) {
        var t = svg("text", { x: x + bw / 2, y: H - 6, "text-anchor": "middle", class: "axis" });
        t.textContent = d.label;
        s.appendChild(t);
      }
    });
    fig.appendChild(s);
    if (!max) fig.appendChild(el("p", "muted small", "Nothing yet."));
    tableView(fig, ["Day", title], data.slice().reverse().map(function (d) { return [d.label, String(d.value)]; }));
  }

  // Horizontal bars with their value at the end: the first steps, in the order players meet them.
  function bars(fig, title, sub, data) {
    chartHead(fig, title, sub);
    var W = 900, row = 30, L = 200, R = 120, H = data.length * row + 4;
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": title });
    data.forEach(function (d, i) {
      var y = i * row + 4, w = (W - L - R) * Math.min(100, d.value) / 100;
      var lab = svg("text", { x: L - 10, y: y + 15, "text-anchor": "end", class: "axis" });
      lab.textContent = d.label;
      s.appendChild(lab);
      s.appendChild(svg("rect", { x: L, y: y + 2, width: W - L - R, height: 18, rx: 4, class: "grid", fill: "rgba(255,255,255,.04)" }));
      if (w > 0) s.appendChild(svg("rect", { x: L, y: y + 2, width: Math.max(w, 4), height: 18, rx: 4, class: "bar" }));
      var v = svg("text", { x: L + Math.max(w, 4) + 8, y: y + 15, class: "val" });
      v.textContent = d.text;
      s.appendChild(v);
      var hit = svg("rect", { x: 0, y: y, width: W, height: row, class: "hit" });
      hover(hit, d.tip);
      s.appendChild(hit);
    });
    fig.appendChild(s);
    if (!data.length) fig.appendChild(el("p", "muted small", "Nothing yet."));
    tableView(fig, ["First step", "Players"], data.map(function (d) { return [d.label, d.text]; }));
  }

  function niceTop(v) {
    if (v <= 0) return 0;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var n = [1, 2, 2.5, 5, 10].find(function (k) { return k * p >= v; });
    return n * p;
  }
  function fmtTick(v) { return v >= 1000 ? (v / 1000) + "k" : String(Math.round(v * 10) / 10); }

  // ------------------------------------------------------------------ start

  function wire() {
    $("signin-form").addEventListener("submit", submitSignin);
    $("sign-out").addEventListener("click", function () { app.db.auth.signOut(); });
    $("denied-retry").addEventListener("click", async function () {
      var r = await app.db.auth.refreshSession();
      if (r.data && r.data.session) enter(r.data.session); else showSignin();
    });
    Array.prototype.forEach.call($("tabs").querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () { openTab(b.dataset.tab); });
    });
    Array.prototype.forEach.call($("status-filter").querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () {
        app.status = b.dataset.status;
        Array.prototype.forEach.call($("status-filter").querySelectorAll("button"), function (o) {
          o.setAttribute("aria-pressed", String(o === b));
        });
        loadFeedback();
      });
    });
    $("about-filter").addEventListener("change", function (e) { app.about = e.target.value; loadFeedback(); });
    $("hide-dev").addEventListener("change", function (e) { app.hideDev = e.target.checked; loadFeedback(); });
    $("refresh").addEventListener("click", loadFeedback);
  }

  async function start() {
    wire();
    if (!window.supabase) {
      $("loading").textContent = "Couldn't load the Supabase library (cdn.jsdelivr.net). Check the connection and reload.";
      return;
    }
    app.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    app.db.auth.onAuthStateChange(function (event) { if (event === "SIGNED_OUT") showSignin(); });
    var s = await app.db.auth.getSession();
    if (s.data && s.data.session) await enter(s.data.session); else showSignin();
  }

  app.enter = enter;
  app.loadStats = loadStats;
  app.loadFeedback = loadFeedback;
  start();
})();
