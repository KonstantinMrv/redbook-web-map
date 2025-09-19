import { STATUS_TITLES } from './config.js';
import { state, el } from './state.js';
import { map, openPopupAt } from './map.js';

/* helpers */
export function normalize(v){
  if (v == null) return '';
  try { return String(v).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,''); }
  catch(e){ return String(v).toLowerCase(); }
}
export function isTruthy(v){
  if (v === null || v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return ['1','y','yes','true','да'].includes(s) || s.startsWith('y') || s.startsWith('д');
}
export function speciesKey(props = {}){
  const la = (props.LATIN_NAME || '').trim();
  const bg = (props.BG_NAME || '').trim();
  return `${la}||${bg}`;
}
export function getFeatureLink(props = {}){
  const cand = props.ARTICLE_URL || props.LINK || props.URL || props.WEB || props.WIKI || props.WIKIPEDIA;
  if (!cand) return null;
  let href = String(cand).trim();
  if (!href) return null;
  if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
  try { new URL(href); return href; } catch { return null; }
}
export function statusToCode(raw){
  if (!raw) return null;
  const s = String(raw).toLowerCase().trim();
  if (/(незастрашен|least concern|^lc\b)/.test(s)) return 'lc';
  if (/(почти застрашен|near threatened|^nt\b)/.test(s)) return 'nt';
  if (/(уязвим|vulnerable|^vu\b)/.test(s)) return 'vu';
  if (/(застрашен|endangered|^en\b)/.test(s)) return 'en';
  if (/(критично|critically endangered|^cr\b)/.test(s)) return 'cr';
  if (/(недостатъчно данни|data deficient|^dd\b)/.test(s)) return 'dd';
  if (/(изчезнал|extinct|^ex\b)/.test(s)) return 'ex';
  return null;
}

export function explodeMultiPoints(fc){
  const out = [];
  for (const f of fc.features) {
    if (!f || !f.geometry) continue;
    if (f.geometry.type === 'MultiPoint') {
      for (const c of f.geometry.coordinates) {
        out.push({ type:'Feature', geometry:{ type:'Point', coordinates:c }, properties:{ ...f.properties } });
      }
    } else if (f.geometry.type === 'Point') {
      out.push(f);
    }
  }
  return out;
}

export function uniqueSorted(values){
  return [...new Set(values.filter(v => v !== null && v !== undefined && String(v).trim() !== ''))]
    .map(String).sort((a,b)=>a.localeCompare(b,'bg',{sensitivity:'base'}));
}
export function fillSelect(sel, values, firstLabel){
  const current = sel.value;
  sel.innerHTML = '';
  const mk = (val, label) => {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = label ?? val; return opt;
  };
  sel.appendChild(mk('', firstLabel || '(всички)'));
  for (const v of values) { if (v !== '') sel.appendChild(mk(v, v)); }
  if ([...sel.options].some(o=>o.value===current)) sel.value = current;
}

export function populateFilterDropdowns(features){
  const vals = { STATUS:[], FAMILY:[], TYPE:[], ORDER:[] };
  for (const f of features) {
    const p = f.properties || {};
    if (p.STATUS!=null) vals.STATUS.push(p.STATUS);
    if (p.FAMILY!=null) vals.FAMILY.push(p.FAMILY);
    if (p.TYPE!=null)   vals.TYPE.push(p.TYPE);
    if (p.ORDER!=null)  vals.ORDER.push(p.ORDER);
  }
  fillSelect(el.ddSTATUS, uniqueSorted(vals.STATUS), 'Природозащитен статус (всички)');
  fillSelect(el.ddFAMILY, uniqueSorted(vals.FAMILY), 'Семейство (всички)');
  fillSelect(el.ddTYPE,   uniqueSorted(vals.TYPE),   'Тип (всички)');
  fillSelect(el.ddORDER,  uniqueSorted(vals.ORDER),  'Разред (всички)');
}

export function applyFiltersAndRender(){
  if (!state.selectedPolygonFeature && (!state.explodedPoints || !state.explodedPoints.length)) return;

  const search = normalize(el.search.value);
  const sel = {
    STATUS: el.ddSTATUS.value,
    FAMILY: el.ddFAMILY.value,
    TYPE: el.ddTYPE.value,
    ORDER: el.ddORDER.value,
    ENDEMIC: el.cbENDEMIC.checked,
    RELICT: el.cbRELICT.checked
  };

  const base = state.explodedPoints || [];
  const filtered = [];
  for (const f of base) {
    const p = f.properties || {};
    const nameBG = normalize(p.BG_NAME);
    const nameLA = normalize(p.LATIN_NAME);

    const anyFilterOn = search || sel.STATUS || sel.FAMILY || sel.TYPE || sel.ORDER || sel.ENDEMIC || sel.RELICT;
    if (!state.selectedPolygonFeature && !anyFilterOn) continue;

    if (search && !(nameBG.includes(search) || nameLA.includes(search))) continue;

    if (sel.STATUS && String(p.STATUS) !== sel.STATUS) continue;
    if (state.activePts !== 'animals') {
      if (sel.FAMILY && String(p.FAMILY) !== sel.FAMILY) continue;
    }
    if (state.activePts === 'animals') {
      if (sel.TYPE  && String(p.TYPE)  !== sel.TYPE)  continue;
      if (sel.ORDER && String(p.ORDER) !== sel.ORDER) continue;
    }
    if (sel.ENDEMIC && !isTruthy(p.ENDEMIC)) continue;
    if (sel.RELICT  && !isTruthy(p.RELICT))  continue;

    filtered.push(f);
  }

  state.filteredPoints = filtered;

  if (!state.selectedPolygonFeature && !(search || sel.STATUS || sel.FAMILY || sel.TYPE || sel.ORDER || sel.ENDEMIC || sel.RELICT)) {
    el.count.textContent = 'Въведете търсене или изберете филтър.';
    el.list.innerHTML = '';
    state.pointMarkerLayer.clearLayers();
    return;
  }

  renderListAndMarkers(filtered);
}

export function boundsForMarkers(markers){
  if (!markers || !markers.length) return null;
  const latLngs = markers.map(m => m.getLatLng());
  return L.latLngBounds(latLngs);
}

export function filterMarkersToSelectedSpecies(){
  state.pointMarkerLayer.clearLayers();
  for (const m of state.currentMarkers) m._icon?.classList.remove('highlight');

  if (!state.selectedSpeciesKey){
    for (const m of state.currentMarkers) state.pointMarkerLayer.addLayer(m);
    const speciesCount = new Set(state.filteredPoints.map(f => speciesKey(f.properties))).size;
    el.count.textContent = `Намерени видове: ${speciesCount} (точки: ${state.filteredPoints.length})`;
    return;
  }
  const group = state.currentMarkersByKey.get(state.selectedSpeciesKey) || [];
  for (const m of group){
    state.pointMarkerLayer.addLayer(m);
    m._icon?.classList.add('highlight');
  }
  el.count.textContent = `Намерени видове: 1 (точки: ${group.length})`;
}

export function renderListAndMarkers(features){
  const totalPoints = features.length;

  el.list.innerHTML = '';
  state.pointMarkerLayer.clearLayers();
  state.currentMarkers = [];
  state.currentMarkersByKey = new Map();

  if (!features.length) {
    el.count.textContent = 'Няма съвпадения.';
    return;
  }

  for (const f of features) {
    const [lng, lat] = f.geometry.coordinates;
    const p = f.properties || {};
    const key = speciesKey(p);

    const marker = L.marker([lat, lng], {
      icon: L.divIcon({ className: 'pt-marker', iconSize: [10,10] }),
      title: (p.BG_NAME || p.LATIN_NAME || 'Point')
    }).addTo(state.pointMarkerLayer);

    marker.on('click', () => {
      const rows = [];
      const linkHref = getFeatureLink(p);
      if (linkHref) rows.push(`<tr><th style="text-align:left; padding-right:8px">Линк</th><td><a href="${linkHref}" target="_blank" rel="noopener">Отвори статия</a></td></tr>`);
      const keysOrder = ['BG_NAME','LATIN_NAME','STATUS','TYPE','ORDER','FAMILY','ENDEMIC','RELICT'];
      for (const k of keysOrder) if (p[k] !== undefined) rows.push(`<tr><th style="text-align:left; padding-right:8px">${k}</th><td>${p[k]}</td></tr>`);
      const html = `<table style="font-size:13px">${rows.join('')}</table>`;
      openPopupAt([lat, lng], html);
    });

    marker._speciesKey = key;
    state.currentMarkers.push(marker);
    if (!state.currentMarkersByKey.has(key)) state.currentMarkersByKey.set(key, []);
    state.currentMarkersByKey.get(key).push(marker);
  }

  const uniqueList = [];
  for (const [key, markers] of state.currentMarkersByKey.entries()) {
    const rep = features.find(ft => speciesKey(ft.properties) === key) || {};
    uniqueList.push({ key, count: markers.length, props: rep.properties || {} });
  }
  uniqueList.sort((a,b)=>{
    const an = (a.props.BG_NAME || a.props.LATIN_NAME || '').toLowerCase();
    const bn = (b.props.BG_NAME || b.props.LATIN_NAME || '').toLowerCase();
    return an.localeCompare(bn,'bg',{sensitivity:'base'});
  });

  for (const item of uniqueList) {
    const p = item.props;
    const row = document.createElement('div'); row.className = 'feature-item';

    const names = document.createElement('div'); names.className = 'feature-names';
    const nameBG = document.createElement('div'); nameBG.className = 'name-bg'; nameBG.textContent = p.BG_NAME || '';
    const nameLA = document.createElement('div'); nameLA.className = 'name-la'; nameLA.textContent = p.LATIN_NAME ? `(${p.LATIN_NAME})` : '';
    names.appendChild(nameBG); names.appendChild(nameLA);

    const meta = document.createElement('div'); meta.className = 'feature-meta';
    const code = statusToCode(p.STATUS);
    if (code){
      const st = document.createElement('span');
      st.className = `chip chip--st ${code}`;
      st.title = STATUS_TITLES[code] || p.STATUS;
      st.textContent = (code === 'cr') ? `⚠️ ${p.STATUS}` : p.STATUS;
      meta.appendChild(st);
    }
    const isAnimals = state.activePts === 'animals';
    if (!isAnimals && p.FAMILY){ const fam = document.createElement('span'); fam.textContent = p.FAMILY; meta.appendChild(fam); }
    if (isAnimals && p.TYPE){ const typ = document.createElement('span'); typ.textContent = p.TYPE; meta.appendChild(typ); }
    if (typeof item.count === 'number'){ const cnt = document.createElement('span'); cnt.className = 'chip chip--count'; cnt.title='Брой точки за вида'; cnt.textContent=item.count; meta.appendChild(cnt); }
    names.appendChild(meta);
    row.appendChild(names);

    const rail = document.createElement('div'); rail.className = 'feature-badges';
    if (isTruthy(p.ENDEMIC)) { const b=document.createElement('span'); b.className='chip chip--endemic'; b.textContent='Ендемит'; b.title='Ендемит — вид, срещащ се само тук'; rail.appendChild(b); }
    if (isTruthy(p.RELICT))  { const b=document.createElement('span'); b.className='chip chip--relict';  b.textContent='Реликт';  b.title='Реликт — древен елемент';     rail.appendChild(b); }
    row.appendChild(rail);

    const linkHref = getFeatureLink(p);
    const btn = document.createElement('button'); btn.className = 'link-btn'; btn.textContent = 'Отвори статия'; btn.disabled = !linkHref;
    btn.title = linkHref ? 'Отваря статия в нов таб' : 'Няма налична статия';
    if (linkHref) btn.addEventListener('click', (ev)=>{ ev.stopPropagation(); window.open(linkHref,'_blank','noopener'); });
    row.appendChild(btn);

    row.onclick = () => {
      state.selectedSpeciesKey = item.key;
      filterMarkersToSelectedSpecies();

      const group = state.currentMarkersByKey.get(item.key) || [];
      if (!group.length) return;
      const bnds = boundsForMarkers(group);
      if (group.length === 1) map.flyTo(group[0].getLatLng(), Math.min(map.getMaxZoom(), 12), { duration: 0.8 });
      else map.flyToBounds(bnds, { padding: [40,40], maxZoom: 12, duration: 0.8 });
    };

    el.list.appendChild(row);
  }

  el.count.textContent = `Намерени видове: ${uniqueList.length} (точки: ${totalPoints})`;
  if (state.selectedSpeciesKey) filterMarkersToSelectedSpecies();
}
