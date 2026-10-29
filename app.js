import { capabilityModules } from './capabilities.js';
const $ = selector => document.querySelector(selector);
const tools = capabilityModules.filter(tool => tool.availability === 'available');
let activeModuleId = 'subnet.calculate';
let category = 'All tools';
let controller;
let generation = 0;
let lastResult;
const drafts = new Map();
const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
const selected = () => tools.find(t => t.id === activeModuleId);

function renderDeck() {
  const search = $('#tool-search').value.trim().toLowerCase();
  const visible = tools.filter(tool => (category === 'All tools' || tool.category === category) && `${tool.title} ${tool.description} ${tool.category}`.toLowerCase().includes(search));
  $('#action-deck').replaceChildren(...visible.map(tool => {
    const card = node('button', undefined, 'action-card');
    card.type = 'button'; card.setAttribute('aria-pressed', String(tool.id === activeModuleId));
    card.append(node('span', tool.category, 'card-category'), node('strong', tool.title), node('span', tool.description, 'card-description'), node('span', tool.activity === 'active' ? 'Online check ↗' : 'On this device', 'card-mode'));
    card.addEventListener('click', () => selectTool(tool, true));
    return card;
  }));
  $('#empty-search').hidden = visible.length > 0;
  $('#categories').replaceChildren(...['All tools', 'My Network', 'Test Something', 'Calculate'].map(name => {
    const button = node('button', name); button.type = 'button'; button.setAttribute('aria-pressed', String(category === name));
    button.addEventListener('click', () => { category = name; renderDeck(); });
    return button;
  }));
}
function saveDraft() {
  drafts.set(activeModuleId, Object.fromEntries(new FormData($('#tool-form'))));
}
function stopRun() { generation++; controller?.abort(); controller = undefined; $('#run-tool').disabled = false; $('#cancel-tool').hidden = true; $('#tool-form').removeAttribute('aria-busy'); }
function selectTool(tool, focus = false) {
  saveDraft(); stopRun(); activeModuleId = tool.id; lastResult = undefined;
  $('#tool-category').textContent = tool.category;
  $('#tool-badge').textContent = tool.activity === 'active' ? 'User-initiated online check' : 'On-device / offline';
  $('#tool-title').textContent = tool.title; $('#tool-description').textContent = tool.description;
  $('#disclosure').textContent = tool.disclosure;
  $('#tool-inputs').replaceChildren(...(tool.inputs || []).map(spec => {
    const label = node('label', spec.label);
    let input;
    if (spec.options) {
      input = node('select');
      spec.options.forEach((value, index) => { const option = node('option', spec.labels?.[index] || value); option.value = value; input.append(option); });
    } else { input = node('input'); input.type = 'text'; input.required = true; input.placeholder = spec.placeholder; input.value = spec.value || ''; input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('autocapitalize', 'none'); }
    input.name = spec.name;
    if (drafts.get(tool.id)?.[spec.name] !== undefined) input.value = drafts.get(tool.id)[spec.name];
    label.append(input); return label;
  }));
  $('#run-tool').textContent = tool.id === 'subnet.calculate' ? 'Calculate subnet' : tool.id === 'connection.snapshot' ? 'Read browser signals' : 'Run check';
  $('#result-panel').hidden = true; $('#result-placeholder').hidden = false;
  renderDeck();
  if (focus) { $('#workspace').focus({ preventScroll: true }); $('#workspace').scrollIntoView({ behavior: 'auto', block: 'nearest' }); }
}
function renderResult(result) {
  lastResult = result;
  $('#result-panel').hidden = false; $('#result-placeholder').hidden = true;
  $('#result-panel').dataset.status = result.status;
  $('#result-kicker').textContent = result.status === 'success' ? 'Result' : 'Check could not complete';
  $('#result-title').textContent = result.title;
  $('#result-summary').textContent = result.summary;
  $('#result-note').textContent = [result.note, result.checkedAt ? `Checked ${new Date(result.checkedAt).toLocaleString()}.` : ''].filter(Boolean).join(' ');
  $('#result-fields').replaceChildren(...(result.fields || []).map(field => {
    const row = node('div', undefined, 'result-row'); const term = node('dt', field.label); const def = node('dd');
    def.append(node('strong', field.value), node('span', field.kind === 'derived' ? 'Calculated' : field.kind, 'provenance'), node('small', field.detail)); row.append(term, def); return row;
  }));
  $('#raw-details').hidden = !result.raw; $('#raw-details').open = false;
  $('#raw-result').textContent = result.raw ? JSON.stringify(result.raw, null, 2) : '';
  $('#copy-result').disabled = false; $('#copy-feedback').textContent = ''; $('#copy-fallback').hidden = true;
}
$('#tool-form').addEventListener('submit', async event => {
  event.preventDefault(); stopRun(); const token = generation; const tool = selected();
  controller = new AbortController(); saveDraft();
  $('#run-tool').disabled = true; $('#cancel-tool').hidden = tool.activity !== 'active'; $('#tool-form').setAttribute('aria-busy', 'true');
  $('#result-panel').hidden = false; $('#result-placeholder').hidden = true; $('#result-summary').textContent = 'Working…'; $('#result-title').textContent = tool.title; $('#result-fields').replaceChildren(); $('#result-note').textContent = ''; $('#result-kicker').textContent = 'Running'; $('#raw-details').hidden = true; $('#copy-result').disabled = true; $('#copy-feedback').textContent = ''; $('#copy-fallback').hidden = true;
  try {
    const result = await tool.run({ navigator, input: drafts.get(tool.id), signal: controller.signal });
    if (token === generation) renderResult(result);
  } catch (error) {
    if (token === generation) renderResult({ status: 'error', title: tool.title, summary: error.message || 'The check could not complete.', fields: [], note: 'Your input has been kept. Correct it or retry the check.' });
  } finally { if (token === generation) { $('#run-tool').disabled = false; $('#cancel-tool').hidden = true; $('#tool-form').removeAttribute('aria-busy'); } }
});
$('#cancel-tool').addEventListener('click', () => { stopRun(); renderResult({ status: 'error', title: selected().title, summary: 'Check cancelled.', fields: [], note: 'Your input has been kept.' }); });
$('#copy-result').addEventListener('click', async () => {
  if (!lastResult) return;
  const text = [lastResult.title, lastResult.summary, ...(lastResult.fields || []).map(f => `${f.label}: ${f.value} [${f.kind}]${f.detail ? ` — ${f.detail}` : ''}`), lastResult.note || '', lastResult.checkedAt || ''].join('\n');
  try { await navigator.clipboard.writeText(text); $('#copy-feedback').textContent = 'Result copied.'; }
  catch { $('#copy-fallback').value = text; $('#copy-fallback').hidden = false; $('#copy-fallback').focus(); $('#copy-fallback').select(); $('#copy-feedback').textContent = 'Clipboard unavailable. Select and copy the text below.'; }
});
function updateLiveStatus() {
  $('#live-status').textContent = navigator.onLine ? 'Browser online' : 'Browser offline';
  if (activeModuleId === "connection.snapshot" && lastResult) renderResult({ ...lastResult, summary: 'Network state changed. Read browser signals again to refresh.', fields: [], checkedAt: undefined });
  else if (selected().activity === 'active' && lastResult) { $('#result-note').textContent = `${lastResult.note || ''} Network state changed. Run the check again for a fresh observation.`; }
}
$('#tool-search').addEventListener('input', renderDeck);
window.addEventListener('online', updateLiveStatus); window.addEventListener('offline', updateLiveStatus);
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
connection?.addEventListener('change', updateLiveStatus);
selectTool(selected()); updateLiveStatus();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
