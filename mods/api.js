"use strict";

const controls = document.querySelector(".mod-api-controls");
const search = document.querySelector("#mod-api-search");
const classSelect = document.querySelector("#mod-api-class");
const empty = document.querySelector("#mod-api-empty");
const count = document.querySelector("#mod-api-count");
const number = new Intl.NumberFormat(document.documentElement.lang);
const groups = Array.from(document.querySelectorAll(".mod-api-group"), group => ({
  group,
  rows: Array.from(group.querySelectorAll(".mod-api-entry"), row => ({
    row,
    text: row.textContent.toLowerCase()
  }))
}));

function filter() {
  const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let found = 0;
  for (const { group, rows } of groups) {
    const matchesClass = !classSelect.value || group.dataset.class === classSelect.value;
    let groupMatches = false;
    for (const { row, text } of rows) {
      const show = matchesClass && terms.every(term => text.includes(term));
      row.hidden = !show;
      if (show) {
        groupMatches = true;
        found++;
      }
    }
    group.hidden = !groupMatches;
  }
  empty.hidden = found > 0;
  count.textContent = number.format(found);
}

function revealLink() {
  const target = document.getElementById(location.hash.slice(1));
  if (!target?.matches(".mod-api-entry")) return;
  if (target.closest("[hidden]")) {
    search.value = "";
    classSelect.value = "";
    filter();
  }
  target.firstElementChild.open = true;
  target.scrollIntoView();
}

window.addEventListener("hashchange", revealLink);
controls.hidden = false;
search.addEventListener("input", filter);
classSelect.addEventListener("change", filter);
filter();
revealLink();
