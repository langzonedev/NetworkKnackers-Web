import { capabilityModules } from "./capabilities.js";

const deck = document.querySelector("#action-deck");
const panel = document.querySelector("#result-panel");
const title = document.querySelector("#result-title");
const kicker = document.querySelector("#result-kicker");
const summary = document.querySelector("#result-summary");
const fields = document.querySelector("#result-fields");
const note = document.querySelector("#result-note");
const liveStatus = document.querySelector("#live-status");

const escapeText = (value) => String(value ?? "");

function renderDeck() {
  deck.replaceChildren(...capabilityModules.map((module, index) => {
    const available = module.availability === "available";
    const card = document.createElement(available ? "button" : "article");
    card.className = `action-card ${available ? "is-available" : "is-locked"}`;
    if (available) {
      card.type = "button";
      card.addEventListener("click", () => runModule(module, card));
    }
    card.innerHTML = `
      <span class="module-index" aria-hidden="true">0${index + 1}</span>
      <span class="module-copy">
        <strong>${escapeText(module.title)}</strong>
        <span>${escapeText(module.description)}</span>
      </span>
      <span class="module-state">${available ? "Run" : module.availability === "native-required" ? "Needs native" : "Planned"}</span>`;
    return card;
  }));
}

async function runModule(module, trigger) {
  trigger.disabled = true;
  trigger.classList.add("is-running");
  trigger.querySelector(".module-state").textContent = "Checking…";
  panel.hidden = false;
  kicker.textContent = "Browser check";
  title.textContent = module.title;
  summary.textContent = "Reading available browser signals…";
  fields.replaceChildren();
  note.textContent = "";
  panel.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });

  try {
    const result = await module.run({ navigator });
    renderResult(result);
  } catch {
    renderResult({
      status: "error",
      title: module.title,
      summary: "The browser check could not be completed.",
      fields: [],
      note: "Nothing was changed. Try again after checking the browser connection."
    });
  } finally {
    trigger.disabled = false;
    trigger.classList.remove("is-running");
    trigger.querySelector(".module-state").textContent = "Run";
  }
}

function renderResult(result) {
  panel.dataset.status = result.status;
  kicker.textContent = result.status === "success" ? "Result" : result.status;
  title.textContent = result.title;
  summary.textContent = result.summary;
  note.textContent = result.note || "";
  fields.replaceChildren(...(result.fields || []).map((field) => {
    const row = document.createElement("div");
    row.className = `result-row is-${field.kind}`;
    const term = document.createElement("dt");
    term.textContent = field.label;
    const definition = document.createElement("dd");
    const value = document.createElement("strong");
    value.textContent = field.value;
    const detail = document.createElement("span");
    detail.textContent = field.detail;
    definition.append(value, detail);
    row.append(term, definition);
    return row;
  }));
}

function updateLiveStatus() {
  const online = navigator.onLine;
  liveStatus.textContent = online ? "Browser online" : "Browser offline";
  liveStatus.classList.toggle("is-offline", !online);
}

document.querySelector("#close-result").addEventListener("click", () => {
  panel.hidden = true;
  document.querySelector(".action-card.is-available")?.focus();
});

window.addEventListener("online", updateLiveStatus);
window.addEventListener("offline", updateLiveStatus);
renderDeck();
updateLiveStatus();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
