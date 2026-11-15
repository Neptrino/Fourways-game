// Fourways website, the player's guide pages (made by tools/website_guide.py): the language menu, as
// on the home page. A language picked here sticks for the home page too.
(function () {
  var menu = document.querySelector("details.lang");
  if (!menu) return;
  Array.prototype.forEach.call(menu.querySelectorAll("a[data-lang]"), function (a) {
    a.addEventListener("click", function () { try { localStorage.setItem("fw-lang", a.getAttribute("data-lang")); } catch (e) {} });
  });
  document.addEventListener("click", function (e) { if (menu.open && !menu.contains(e.target)) menu.open = false; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.open) { menu.open = false; menu.querySelector("summary").focus(); } });
})();
