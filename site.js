// Fourways website: the hero clip, the time-and-weather switcher, scroll effects, the picture viewer,
// and download links that point straight at the files of the latest release. Without JavaScript (or if
// GitHub can't be reached) every download link still goes to the latest release's page.
(function () {
  "use strict";

  var RELEASE_REPO = "Neptrino/Fourways-game";
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  // Pages in other languages live a folder down (es/, fr/...) and say so in <html data-root="../">.
  var ROOT = document.documentElement.getAttribute("data-root") || "";
  var T = {};
  try { T = JSON.parse(document.getElementById("i18n").textContent); } catch (e) { /* English defaults below */ }
  function t(key, fallback, arg) { return String(T[key] || fallback).replace("%s", arg); }

  // --- Language: the English page sends a first-time visitor on to their own language; picking
  // one from the menu sticks. -----------------------------------------------------------------------
  var LANGS = ["en", "es", "ca", "fr", "de", "it", "pt"];
  var store = null;
  try { store = window.localStorage; } catch (e) { /* private mode: no memory */ }
  each(document.querySelectorAll(".lang a[data-lang]"), function (a) {
    a.addEventListener("click", function () { try { store.setItem("fw-lang", a.getAttribute("data-lang")); } catch (e) {} });
  });
  var menu = document.querySelector("details.lang");
  if (menu) {
    document.addEventListener("click", function (e) { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.open) { menu.open = false; menu.querySelector("summary").focus(); } });
  }
  if (!ROOT) {
    var chosen = null;
    try { chosen = store.getItem("fw-lang"); } catch (e) {}
    if (!chosen) {
      var wanted = (navigator.languages || [navigator.language || ""]).map(function (l) { return String(l).slice(0, 2).toLowerCase(); });
      for (var w = 0; w < wanted.length; w++) {
        if (wanted[w] === "en") break;
        if (LANGS.indexOf(wanted[w]) > 0) { location.replace(wanted[w] + "/" + location.search + location.hash); return; }
      }
    }
  }

  // --- Navigation turns solid once the hero is scrolled past ------------------------------------
  var nav = document.getElementById("nav");
  var onScroll = function () { nav.classList.toggle("solid", window.scrollY > 40); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // --- Hero depth: the picture lags behind the scroll and leans away from the mouse, the words
  // drift up and fade as they leave. -------------------------------------------------------------
  var heroMedia = document.getElementById("hero-media");
  var heroIn = document.querySelector(".hero-in");
  if (heroMedia && !calm) {
    var ticking = false;
    var paint = function () {
      ticking = false;
      var y = window.scrollY, h = window.innerHeight;
      if (y > h * 1.2) return;
      heroMedia.style.setProperty("--sy", (y * 0.35).toFixed(1) + "px");
      if (heroIn) {
        heroIn.style.transform = "translate3d(0," + (-y * 0.12).toFixed(1) + "px,0)";
        heroIn.style.opacity = Math.max(0, 1 - y / (h * 0.75)).toFixed(3);
      }
    };
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
    if (window.matchMedia("(pointer: fine)").matches) {
      document.querySelector(".hero").addEventListener("pointermove", function (e) {
        var dx = e.clientX / window.innerWidth - 0.5, dy = e.clientY / window.innerHeight - 0.5;
        heroMedia.style.setProperty("--mx", (-dx * 18).toFixed(1) + "px");
        heroMedia.style.setProperty("--my", (-dy * 12).toFixed(1) + "px");
      });
    }
  }

  // --- Trailer: load the full video only after the visitor chooses to play. ----------------------
  var trailer = document.querySelector(".trailer-launch[data-trailer]");
  if (trailer) {
    trailer.addEventListener("click", function (event) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      var video = document.createElement("video");
      video.setAttribute("aria-label", trailer.getAttribute("aria-label"));
      video.src = trailer.href;
      video.poster = trailer.querySelector("img").src;
      video.controls = true;
      video.playsInline = true;
      video.preload = "none";
      video.tabIndex = 0;
      var captions = document.createElement("track");
      captions.kind = "captions";
      captions.srclang = "en";
      captions.label = "English";
      captions.src = ROOT + "video/gameplay-trailer.vtt";
      video.appendChild(captions);
      trailer.parentNode.replaceChild(video, trailer);
      video.focus();
      var playing = video.play();
      if (playing && playing.catch) playing.catch(function () {});
      // Umami's automatic link tracking navigates after sending, so track this player manually.
      if (window.umami && typeof window.umami.track === "function") {
        var tracked = window.umami.track("watch-trailer");
        if (tracked && tracked.catch) tracked.catch(function () {});
      }
    });
  }

  // --- Clips ----------------------------------------------------------------------------------
  // Every clip loads only when it scrolls into view and pauses out of it. With reduced motion they
  // don't play by themselves: the pause buttons start them, and feature clips get controls.
  var saveData = navigator.connection && navigator.connection.saveData;
  var small = window.matchMedia("(max-width: 720px)").matches;
  var lazy = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        if (!v.src) v.src = v.getAttribute(small && v.getAttribute("data-src-sm") ? "data-src-sm" : "data-src");
        if (!calm && !v.userPaused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      } else if (!v.paused) {
        v.pause();
      }
    });
  }, { threshold: 0.25 }) : null;

  function toggleFor(video, btn) {
    if (!btn) return;
    btn.hidden = false;
    var sync = function () {
      btn.classList.toggle("paused", video.paused);
      btn.setAttribute("aria-label", video.paused ? t("play", "Play the video") : t("pause", "Pause the video"));
    };
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    btn.addEventListener("click", function () {
      if (!video.src) video.src = video.getAttribute(small && video.getAttribute("data-src-sm") ? "data-src-sm" : "data-src");
      if (video.paused) { video.userPaused = false; video.play(); } else { video.userPaused = true; video.pause(); }
    });
    sync();
  }

  each(document.querySelectorAll("video.clip"), function (v) {
    if (calm) v.controls = true;
    if (lazy && !saveData) lazy.observe(v);
  });

  // --- How it plays: four clips, one after the other ---------------------------------------------
  var how = document.getElementById("howto-video");
  var steps = Array.prototype.slice.call(document.querySelectorAll(".player-steps button"));
  var stepAt = 0;
  function playStep(i, go) {
    stepAt = i;
    steps.forEach(function (b, k) {
      b.setAttribute("aria-selected", k === i ? "true" : "false");
      b.tabIndex = k === i ? 0 : -1;
      b.style.setProperty("--p", 0);
    });
    var clip = steps[i].getAttribute("data-clip");
    how.poster = ROOT + "img/play-" + clip + ".webp";
    how.src = ROOT + "video/play-" + clip + ".mp4";
    if (go) { var p = how.play(); if (p && p.catch) p.catch(function () {}); }
  }
  if (how && steps.length) {
    steps.forEach(function (b, i) {
      b.addEventListener("click", function () { how.userPaused = false; playStep(i, true); });
      b.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = (i + d + steps.length) % steps.length;
        playStep(n, !how.paused);
        steps[n].focus();
      });
    });
    how.addEventListener("timeupdate", function () {
      if (how.duration) steps[stepAt].style.setProperty("--p", how.currentTime / how.duration);
    });
    how.addEventListener("ended", function () { playStep((stepAt + 1) % steps.length, true); });
    toggleFor(how, document.getElementById("howto-toggle"));
    how.setAttribute("data-src", ROOT + "video/play-connect.mp4");
    if (lazy && !saveData) lazy.observe(how);
  }

  // --- Scroll reveal ----------------------------------------------------------------------------
  var reveal = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !calm) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    each(reveal, function (el) { io.observe(el); });
  } else {
    each(reveal, function (el) { el.classList.add("in"); });
  }

  // --- Time and weather switcher: plays through by itself until someone picks a moment ---------
  var switcher = document.querySelector(".switcher");
  var stage = document.getElementById("stage");
  var label = document.getElementById("switch-label");
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".switch-tabs button"));
  var shown = {};
  var AUTO_MS = 4500;
  var timer = null;
  var current = 0;

  function pick(i, focus) {
    current = i;
    var btn = tabs[i];
    var key = btn.getAttribute("data-key");
    tabs.forEach(function (b) {
      var on = b === btn;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    if (focus) btn.focus();
    var img = shown[key];
    if (!img) {
      img = stage.querySelector('img[data-key="' + key + '"]');
      if (!img) {
        if (btn.hasAttribute("data-video")) {
          img = document.createElement("video");
          img.muted = true;
          img.loop = true;
          img.playsInline = true;
          img.setAttribute("aria-label", btn.getAttribute("data-alt"));
          img.poster = ROOT + "img/world-" + key + ".webp";
          img.src = ROOT + btn.getAttribute("data-video");
          img.complete = true;
        } else {
          img = new Image();
          img.width = 1600;
          img.height = 900;
          img.alt = btn.getAttribute("data-alt");
          img.src = ROOT + "img/world-" + key + ".webp";
        }
        img.setAttribute("data-key", key);
        stage.insertBefore(img, label);
      }
      shown[key] = img;
    }
    var show = function () {
      each(stage.querySelectorAll("img, video"), function (i2) {
        i2.classList.toggle("on", i2 === img);
        if (i2.tagName === "VIDEO") {
          if (i2 === img && !calm) { i2.currentTime = 0; var p = i2.play(); if (p && p.catch) p.catch(function () {}); }
          else i2.pause();
        }
      });
      label.textContent = btn.textContent;
      label.classList.remove("pop");
      void label.offsetWidth;
      label.classList.add("pop");
    };
    if (img.complete) show(); else img.addEventListener("load", show, { once: true });
  }

  // A moment that's a clip stays up longer than a picture.
  function holdFor(i) { return tabs[i].hasAttribute("data-video") ? 6500 : AUTO_MS; }

  function stopAuto() {
    clearTimeout(timer);
    timer = null;
    switcher.classList.remove("auto");
  }

  tabs.forEach(function (btn, i) {
    btn.tabIndex = i === 0 ? 0 : -1;
    btn.addEventListener("click", function () { stopAuto(); pick(i, false); });
    btn.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      stopAuto();
      pick((i + d + tabs.length) % tabs.length, true);
    });
  });

  // Fetch the other moments once the page has settled, so switching is instant; start the
  // slideshow when the switcher comes into view.
  window.addEventListener("load", function () {
    setTimeout(function () {
      tabs.forEach(function (b) {
        var k = b.getAttribute("data-key");
        if (k !== "day" && !b.hasAttribute("data-video")) new Image().src = ROOT + "img/world-" + k + ".webp";
      });
    }, 1200);
  });
  if (!calm && "IntersectionObserver" in window) {
    switcher.style.setProperty("--auto", AUTO_MS + "ms");
    var started = false;
    new IntersectionObserver(function (entries, obs) {
      if (!entries[0].isIntersecting || started) return;
      started = true;
      obs.disconnect();
      switcher.classList.add("auto");
      pick(0, false);
      var next = function () {
        timer = setTimeout(function () {
          if (!document.hidden) {
            var n = (current + 1) % tabs.length;
            switcher.style.setProperty("--auto", holdFor(n) + "ms");
            pick(n, false);
          }
          next();
        }, holdFor(current));
      };
      next();
    }, { threshold: 0.45 }).observe(stage);
  }

  // --- Fleet: one strip of vehicles per kind --------------------------------------------------
  var fleetTabs = Array.prototype.slice.call(document.querySelectorAll(".fleet-tabs button"));
  function openFleet(btn, focus) {
    fleetTabs.forEach(function (b) {
      var on = b === btn;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(b.getAttribute("aria-controls"));
      if (panel) { panel.hidden = !on; if (on) panel.scrollLeft = 0; }
    });
    if (focus) btn.focus();
  }
  fleetTabs.forEach(function (btn, i) {
    btn.tabIndex = btn.getAttribute("aria-selected") === "true" ? 0 : -1;
    btn.addEventListener("click", function () { openFleet(btn, false); });
    btn.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      openFleet(fleetTabs[(i + d + fleetTabs.length) % fleetTabs.length], true);
    });
  });

  // --- Picture viewer ---------------------------------------------------------------------------
  var box = document.getElementById("lightbox");
  if (box && typeof box.showModal === "function") {
    var big = box.querySelector("img");
    each(document.querySelectorAll(".zoom"), function (z) {
      z.addEventListener("click", function () {
        var img = z.querySelector("img");
        big.src = img.currentSrc || img.src;
        big.alt = img.alt;
        box.showModal();
      });
    });
    box.addEventListener("click", function () { box.close(); });
  } else {
    each(document.querySelectorAll(".zoom"), function (z) { z.style.cursor = "default"; });
  }

  // --- Downloads --------------------------------------------------------------------------------
  var ua = navigator.userAgent || "";
  var isMac = /Macintosh|Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua);
  var isWin = /Windows/.test(ua);
  var preferred = isMac ? "mac" : isWin ? "win" : null;
  if (preferred) document.getElementById("dl-" + preferred).classList.add("preferred");

  function mb(bytes) { return Math.round(bytes / 1048576) + " MB"; }

  fetch("https://api.github.com/repos/" + RELEASE_REPO + "/releases/latest", { headers: { Accept: "application/vnd.github+json" } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (rel) {
      var version = String(rel.tag_name || "").replace(/^v/, "");
      var files = {};
      (rel.assets || []).forEach(function (a) {
        if (/windows-setup\.exe$/i.test(a.name)) files.win = a;
        else if (/macos\.zip$/i.test(a.name)) files.mac = a;
      });
      if (version) {
        each(document.querySelectorAll("[data-version]"), function (el) { el.textContent = version; });
        document.querySelector(".hero [data-version-line]").textContent = preferred === "mac" ? t("versionMac", "Version %s for Mac", version)
          : preferred === "win" ? t("versionWin", "Version %s for Windows", version) : t("version", "Version %s", version);
        document.querySelector(".download [data-version-line]").textContent = t("version", "Version %s", version);
        document.querySelector("[data-chip]").textContent = t("versionOut", "Version %s is out", version);
      }
      if (files.win) {
        document.getElementById("dl-win").href = files.win.browser_download_url;
        document.querySelector('[data-meta="win"]').textContent = t("installer", "Installer · %s", mb(files.win.size));
      }
      if (files.mac) {
        document.getElementById("dl-mac").href = files.mac.browser_download_url;
        document.querySelector('[data-meta="mac"]').textContent = t("macApp", "Intel and Apple Silicon · %s", mb(files.mac.size));
      }
      if (preferred && files[preferred]) document.getElementById("cta-main").href = files[preferred].browser_download_url;

      var notes = String(rel.body || "").split(/\r?\n/).map(function (l) { return l.replace(/^[-*]\s*/, "").trim(); }).filter(Boolean);
      if (notes.length) {
        var list = document.getElementById("news-list");
        notes.slice(0, 8).forEach(function (n) {
          var li = document.createElement("li");
          li.textContent = n;
          list.appendChild(li);
        });
        document.getElementById("news").hidden = false;
      }
    })
    .catch(function () { /* keep the links to the release page */ });
})();
