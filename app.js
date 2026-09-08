import { capabilityModules } from "./capabilities.js";

const deck = document.querySelector("#action-deck");
const panel = document.querySelector("#result-panel");
const title = document.querySelector("#result-title");
const kicker = document.querySelector("#result-kicker");
const summary = document.querySelector("#result-summary");
const fields = document.querySelector("#result-fields");
const note = document.querySelector("#result-note");
const liveStatus = document.querySelector("#live-status");

let activeModuleId = null;

function renderDeck() {
  deck.replaceChildren(...capabilityModules.map((module, index) => {
    const available = module.availability === "available";
    const card = document.createElement(available ? "button" : "article");
    card.className = `action-card ${available ? "is-available" : "is-locked"}`;
    if (available) {
      card.type = "button";
      card.addEventListener("click", () => runModule(module, card));
    }
    const moduleIndex = document.createElement("span");
    moduleIndex.className = "module-index";
    moduleIndex.setAttribute("aria-hidden", "true");
    moduleIndex.textContent = `0${index + 1}`;
    const copy = document.createElement("span");
    copy.className = "module-copy";
    const moduleTitle = document.createElement("strong");
    moduleTitle.textContent = module.title;
    const description = document.createElement("span");
    description.textContent = module.description;
    copy.append(moduleTitle, description);
    const state = document.createElement("span");
    state.className = "module-state";
    state.textContent = available ? "Run" : module.availability === "native-required" ? "Needs native" : "Planned";
    card.append(moduleIndex, copy, state);
    return card;
  }));
}

async function runModule(module, trigger) {
  activeModuleId = module.id;
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
  if (!panel.hidden && activeModuleId === "connection.snapshot") {
    const connectionModule = capabilityModules.find(({ id }) => id === activeModuleId);
    connectionModule.run({ navigator }).then(renderResult).catch(() => {});
  }
}

document.querySelector("#close-result").addEventListener("click", () => {
  panel.hidden = true;
  activeModuleId = null;
  document.querySelector(".action-card.is-available")?.focus();
});

window.addEventListener("online", updateLiveStatus);
window.addEventListener("offline", updateLiveStatus);
renderDeck();
updateLiveStatus();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
