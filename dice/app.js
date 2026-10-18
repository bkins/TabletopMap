'use strict';
const $ = selector => document.querySelector(selector);
let sides = 20;
let mode = 'normal';
let history = [];
let isRolling = false;
let use3D = false;
let lastResult = null;
const diceScope = new URLSearchParams(location.search).get('scope') || 'standalone';
const safeScope = /^[a-zA-Z0-9-]{1,80}$/.test(diceScope) ? diceScope : 'standalone';
const styleKey = 'tabletop-dice-3d-' + safeScope;
try { use3D = localStorage.getItem(styleKey) === 'true'; } catch {}
const storageKey = 'tabletop-roll-history-v1-' + safeScope;
const shapes = {
  4: '<path d="M15 2 28 27H2Z M15 2 15 20 2 27 M15 20 28 27"/>',
  6: '<path d="m15 2 12 7v14l-12 7L3 23V9Z M3 9l12 7 12-7 M15 16v14"/>',
  8: '<path d="m15 1 13 15-13 15L2 16Z M2 16h26 M15 1v30"/>',
  10: '<path d="m15 1 13 12-5 13-8 5-8-5-5-13Z M15 1 8 17l7 14 7-14Z M2 13l6 4 M22 17l6-4"/>',
  12: '<path d="m9 2 12 0 9 11-5 14-10 5L5 27 0 13Z M10 9h10l4 10-9 7-9-7Z M9 2l1 7 M21 2l-1 7 M30 13l-6 6 M25 27l-10-1 M5 27l10-1 M0 13l6 6"/>',
  20: '<path d="m15 1 14 8v15l-14 8L1 24V9Z M15 1 7 12h16Z M7 12l8 14 8-14 M1 9l6 3-6 12 14 2 14-2-6-12 6-3 M15 26v6"/>',
  100: '<path d="m15 1 13 12-5 13-8 5-8-5-5-13Z M15 1 8 17l7 14 7-14Z M2 13l6 4 M22 17l6-4"/>'
};
Object.entries(shapes).forEach(([value, shape]) => {
  const button = document.createElement('button');
  button.className = 'die-button' + (Number(value) === sides ? ' active' : '');
  button.dataset.sides = value;
  button.setAttribute('aria-pressed', Number(value) === sides);
  button.innerHTML = `<svg viewBox="-2 -1 34 35" aria-hidden="true">${shape}</svg><span>d${value}</span>`;
  button.addEventListener('click', () => { sides = Number(value); updateBuilder(); });
  $('#dice-picker').append(button);
});
function updateBuilder() {
  const count = Number($('#quantity').value);
  const modifier = Number($('#modifier').value);
  if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(modifier) || Math.abs(modifier) > 10000) {
    $('#error').textContent = 'Choose 1–100 dice and a whole-number modifier between −10,000 and +10,000.';
    $('#error').hidden = false;
    $('#roll').disabled = true;
    return;
  }
  $('#error').hidden = true;
  $('#roll').disabled = false;
  $('#expression').value = `${count}d${sides}${modifier ? ` ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}` : ''}`;
  document.querySelectorAll('.die-button').forEach(b => { b.classList.toggle('active', Number(b.dataset.sides) === sides); b.setAttribute('aria-pressed', Number(b.dataset.sides) === sides); });
  syncMode();
}
function syncMode() {
  let eligible = false;
  try { const dice = ArcanaDice.parse($('#expression').value).filter(t => t.sides); eligible = dice.length === 1 && dice[0].sides === 20 && dice[0].count === 1 && dice[0].sign === 1; } catch {}
  if (!eligible) mode = 'normal';
  document.querySelectorAll('[data-mode]').forEach(b => { b.disabled = b.dataset.mode !== 'normal' && !eligible; b.classList.toggle('active', b.dataset.mode === mode); b.setAttribute('aria-pressed', b.dataset.mode === mode); });
}
$('#quantity').addEventListener('input', updateBuilder);
$('#modifier').addEventListener('input', updateBuilder);
$('#expression').addEventListener('input', () => { $('#roll').disabled = false; $('#error').hidden = true; $('#expression').removeAttribute('aria-invalid'); syncMode(); });
$('#decrease').addEventListener('click', () => { $('#quantity').value = Math.max(1, (Number($('#quantity').value) || 1) - 1); updateBuilder(); });
$('#increase').addEventListener('click', () => { $('#quantity').value = Math.min(100, (Number($('#quantity').value) || 1) + 1); updateBuilder(); });
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; syncMode(); }));
$('#example').addEventListener('click', () => { $('#expression').value = '2d6 + 1d8 + 3'; syncMode(); $('#expression').focus(); });
function describe(result) {
  return result.groups.map(g => g.sides ? `${g.sign < 0 ? '−' : ''}d${g.sides}: ${g.values.join(', ')}${g.kept !== null ? ` → ${g.values[g.kept]} kept` : ''}` : `${g.sign > 0 ? '+' : '−'}${g.modifier}`).join(' · ');
}
function createVisualDie(sides, value) {
  const die = document.createElement('span');
  die.className = 'visual-die';
  if (use3D) {
    const solid = Arcana3D.create(sides, value);
    die.classList.add('three-dimensional');
    die.append(solid.canvas);
    die.solid = solid;
    die.setAttribute('aria-label', `${value} on d${sides}`);
    const type = document.createElement('span'); type.className = 'die-type'; die.append(type);
  } else {
    die.innerHTML = `<svg viewBox="-2 -1 34 35" aria-hidden="true">${shapes[sides] || shapes[20]}</svg><span class="die-face"></span><span class="die-type"></span>`;
    die.querySelector('.die-face').textContent = value;
  }
  die.querySelector('.die-type').textContent = `d${sides}`;
  return die;
}
async function animateRoll(result) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const outcome = $('#outcome');
  outcome.classList.remove('rolling');
  outcome.replaceChildren();
  const kicker = document.createElement('span');
  kicker.className = 'result-kicker'; kicker.textContent = 'THE DICE ARE IN MOTION';
  const tray = document.createElement('div'); tray.className = 'dice-tray'; tray.setAttribute('aria-hidden', 'true');
  const dice = result.groups.filter(g => g.sides).flatMap(g => g.values.map(value => ({ sides: g.sides, value })));
  const visible = dice.slice(0, 12).map((item, index) => {
    const die = createVisualDie(item.sides, '✦');
    if (!use3D) die.classList.add('tumbling');
    die.style.setProperty('--delay', `${index * -0.07}s`);
    die.style.setProperty('--direction', index % 2 ? '-1' : '1');
    tray.append(die);
    return { die, index, ...item };
  });
  const note = document.createElement('p'); note.className = 'detail';
  note.textContent = dice.length > 12 ? `Rolling ${dice.length} dice · showing 12 in motion` : 'A little suspense before destiny lands…';
  outcome.append(kicker, tray, note);
  $('#result-expression').textContent = result.expression;
  let ticks = 0;
  const interval = window.setInterval(() => {
    ticks++;
    visible.forEach(({ die, sides }) => { if (!die.solid) die.querySelector('.die-face').textContent = 1 + ((ticks * 7 + sides) % sides); });
  }, 80);
  let frame;
  const start = performance.now();
  function drawFrame(now) {
    const elapsed = (now - start) / 1000;
    visible.forEach(({ die, index, sides }) => {
      if (!die.solid) return;
      const phase = elapsed * 8 + index * .7;
      die.solid.draw([phase, phase * .8, phase * .35], 1 + ((ticks * 7 + index) % sides), Math.abs(Math.sin(elapsed * 9 + index)) * 16);
    });
    frame = requestAnimationFrame(drawFrame);
  }
  if (use3D) frame = requestAnimationFrame(drawFrame);
  try { await new Promise(resolve => window.setTimeout(resolve, 1100)); }
  finally { window.clearInterval(interval); if (frame) cancelAnimationFrame(frame); }
}
function showResult(result) {
  lastResult = result;
  const outcome = $('#outcome'); outcome.replaceChildren();
  const kicker = document.createElement('span'); kicker.className = 'result-kicker'; kicker.textContent = result.mode === 'normal' ? 'YOUR ROLL TOTAL' : `WITH ${result.mode.toUpperCase()}`; outcome.append(kicker);
  const total = document.createElement('div'); total.className = 'total'; total.textContent = result.total; outcome.append(total);
  const breakdown = document.createElement('div'); breakdown.className = 'breakdown';
  result.groups.forEach(g => {
    if (g.sides) g.values.forEach((value, index) => { const chip = createVisualDie(g.sides, `${g.sign < 0 ? '−' : ''}${value}`); chip.classList.add('landed'); if (g.kept !== null && g.kept !== index) chip.classList.add('discarded'); chip.title = `d${g.sides}${g.kept !== null ? g.kept === index ? ' · kept' : ' · discarded' : ''}`; breakdown.append(chip); });
    else { const chip = document.createElement('span'); chip.className = 'modifier-value'; chip.textContent = `${g.sign > 0 ? '+' : '−'} ${g.modifier}`; breakdown.append(chip); }
  });
  outcome.append(breakdown);
  const detail = document.createElement('p'); detail.className = 'detail'; detail.textContent = describe(result); outcome.append(detail);
  if (result.natural === 20 || result.natural === 1) { const special = document.createElement('p'); special.className = 'special'; special.textContent = result.natural === 20 ? '✦ NATURAL 20 · A moment of glory.' : 'NATURAL 1 · The plot thickens.'; outcome.append(special); }
  $('#result-expression').textContent = result.expression;
  outcome.classList.remove('rolling'); void outcome.offsetWidth; outcome.classList.add('rolling');
}
function saveHistory() { try { localStorage.setItem(storageKey, JSON.stringify(history)); } catch {} }
function renderHistory() {
  $('#history-count').textContent = `${history.length} roll${history.length === 1 ? '' : 's'}`;
  $('#clear-history').disabled = !history.length;
  const list = $('#history-list'); list.replaceChildren();
  if (!history.length) { list.innerHTML = '<div class="history-empty"><span>↺</span><p>A fresh chapter. Your rolls will appear here.</p></div>'; return; }
  history.forEach(result => {
    const row = document.createElement('div'); row.className = 'history-row';
    const time = document.createElement('span'); time.className = 'history-time'; time.textContent = new Date(result.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const content = document.createElement('div'); const expression = document.createElement('div'); expression.className = 'history-expression'; expression.textContent = result.expression + (result.mode !== 'normal' ? ` · ${result.mode}` : '');
    const detail = document.createElement('div'); detail.className = 'history-detail'; detail.textContent = describe(result); content.append(expression, detail);
    const total = document.createElement('span'); total.className = 'history-total'; total.textContent = result.total; row.append(time, content, total); list.append(row);
  });
}
async function doRoll() {
  if (isRolling || $('#roll').disabled) return;
  let controls;
  try {
    let result;
    const shared=$('#share-roll').checked&&window.parent!==window;
    if(!shared)result = ArcanaDice.roll($('#expression').value, mode);
    $('#error').hidden = true; $('#expression').removeAttribute('aria-invalid');
    isRolling = true;
    controls = [...document.querySelectorAll('.roller button, .roller input')].map(element => ({ element, disabled: element.disabled }));
    controls.forEach(({ element }) => { element.disabled = true; });
    $('#outcome').setAttribute('aria-busy', 'true');
    $('#roll').setAttribute('aria-label', 'Rolling dice');
    if(shared)result=await requestSharedRoll($('#expression').value,mode);
    await animateRoll(result);
    showResult(result); history.unshift({ ...result, time: Date.now() }); history = history.slice(0, 30); saveHistory(); renderHistory();
  } catch (error) { $('#error').textContent = error.message; $('#error').hidden = false; $('#expression').setAttribute('aria-invalid', 'true'); }
  finally {
    if (controls) controls.forEach(({ element, disabled }) => { element.disabled = disabled; });
    isRolling = false;
    $('#outcome').removeAttribute('aria-busy');
    $('#roll').removeAttribute('aria-label');
  }
}
$('#roll').addEventListener('click', doRoll);
$('#dice-3d').checked = use3D;
$('#dice-3d').addEventListener('change', () => {
  use3D = $('#dice-3d').checked;
  try { localStorage.setItem(styleKey, String(use3D)); } catch {}
  if (lastResult) showResult(lastResult);
});
document.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.repeat && !event.target.closest('button,a')) { event.preventDefault(); doRoll(); } });
$('#clear-history').addEventListener('click', () => { history = []; saveHistory(); renderHistory(); });
try { const saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(saved)) history = saved.filter(r => typeof r.expression === 'string' && r.expression.length <= 200 && Number.isFinite(r.total) && Number.isFinite(r.time) && ['normal','advantage','disadvantage'].includes(r.mode) && Array.isArray(r.groups) && r.groups.every(g => g && (g.sides ? Array.isArray(g.values) && g.values.length <= 100 && g.values.every(Number.isFinite) : Number.isFinite(g.modifier)))).slice(0, 30); } catch {}
syncMode(); renderHistory();
$('#share-roll').closest('label').hidden=window.parent===window;
let shareRequestNumber=0;
function requestSharedRoll(expression,mode){const id=String(Date.now())+"-"+(++shareRequestNumber);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{window.removeEventListener('message',receive);reject(Error('Shared roll status is uncertain. Check the table before rolling again.'));},10000);function receive(e){if(e.origin!==location.origin||e.source!==window.parent||e.data?.type!=='shared-roll-result'||e.data.id!==id)return;clearTimeout(timer);window.removeEventListener('message',receive);e.data.error?reject(Error(e.data.error)):resolve(e.data.result);}window.addEventListener('message',receive);window.parent.postMessage({type:'shared-roll-request',id,expression,mode},location.origin);});}
