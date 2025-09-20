/* ---------------- Helpers: визуален error overlay вместо "бял екран" ---------------- */
(function installGlobalErrorOverlay() {
  const show = (msg) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.6);color:#fff;padding:24px;overflow:auto;';
    wrap.innerHTML = `
      <div style="max-width:800px;margin:0 auto;background:#222;border-radius:10px;padding:16px;border:1px solid #444">
        <h3 style="margin:0 0 8px">Грешка в приложението</h3>
        <pre style="white-space:pre-wrap;font-family:ui-monospace,Consolas,monospace">${msg}</pre>
        <p style="font-size:12px;opacity:.9">Провери конзолата (F12) за повече детайли.</p>
      </div>`;
    document.body.appendChild(wrap);
  };
  window.addEventListener('error', (e) => show(String(e.error?.stack || e.message || e)));
  window.addEventListener('unhandledrejection', (e) => show('Unhandled promise rejection: ' + String(e.reason)));
})();

/* ---------------- Пътища до данни (работи на GitHub Pages и локален сървър) ---------------- */
const ANIMALS_GEOJSON_URL = './data/Animals.geojson';
const PLANTS_FUNGI_GEOJSON_URL = './data/PlantsFungi.geojson';

/* ---------------- Полигонови дефиниции ---------------- */
const POLY_DEFS = {
  morph:        { url: './data/morph_units.geojson',      label: 'Геоморфоложки единици',
    baseStyle:{ color:'#9E6D2E', weight:1.2, fillColor:'#F3E5AB', fillOpacity:.35 },
    selStyle: { color:'#9E6D2E', weight:3,   fillColor:'#FFF4C9', fillOpacity:.55 }, layer:null, loaded:false },
  morph_1:      { url: './data/morph_units_1.geojson',    label: 'Геоморфоложки единици — Ниво 1',
    baseStyle:{ color:'#B8860B', weight:1.3, fillColor:'#F5E6B3', fillOpacity:.40 },
    selStyle: { color:'#8B6508', weight:3,   fillColor:'#FFF1C9', fillOpacity:.60 }, layer:null, loaded:false },
  morph_2:      { url: './data/morph_units_2.geojson',    label: 'Геоморфоложки единици — Ниво 2',
    baseStyle:{ color:'#8C6BB1', weight:1.3, fillColor:'#E6DDF4', fillOpacity:.40 },
    selStyle: { color:'#6E4F8F', weight:3,   fillColor:'#F0E9FB', fillOpacity:.60 }, layer:null, loaded:false },
  morph_3:      { url: './data/morph_units_3.geojson',    label: 'Геоморфоложки единици — Ниво 3',
    baseStyle:{ color:'#2E8B57', weight:1.3, fillColor:'#CFEAD8', fillOpacity:.40 },
    selStyle: { color:'#206B43', weight:3,   fillColor:'#E5F5EC', fillOpacity:.60 }, layer:null, loaded:false },
  land:         { url: './data/landscape_zoning.geojson', label: 'Ландшафтно райониране',
    baseStyle:{ color:'#5A8F68', weight:1.2, fillColor:'#CDE8B8', fillOpacity:.45 },
    selStyle: { color:'#2F6F49', weight:3,   fillColor:'#E9F6D8', fillOpacity:.60 }, layer:null, loaded:false },
  n2k_birds:    { url: './data/N2000_Birds.geojson',      label: 'Natura 2000 — Зони за птици',
    baseStyle:{ color:'#1E88E5', weight:1.2, fillColor:'#BBDEFB', fillOpacity:.35 },
    selStyle: { color:'#1565C0', weight:3,   fillColor:'#E3F2FD', fillOpacity:.55 }, layer:null, loaded:false },
  n2k_habitats: { url: './data/N2000_habitats.geojson',   label: 'Natura 2000 — Зони по местообитания',
    baseStyle:{ color:'#43A047', weight:1.2, fillColor:'#C8E6C9', fillOpacity:.35 },
    selStyle: { color:'#2E7D32', weight:3,   fillColor:'#E8F5E9', fillOpacity:.55 }, layer:null, loaded:false },
  protected_area:{url:'./data/protected_area.geojson',    label: 'Защитени територии по ЗЗТ',
    baseStyle:{ color:'#8E24AA', weight:1.2, fillColor:'#E1BEE7', fillOpacity:.35 },
    selStyle: { color:'#6A1B9A', weight:3,   fillColor:'#F3E5F5', fillOpacity:.55 }, layer:null, loaded:false }
};

/* ---------------- Глобално състояние ---------------- */
let map = null;
const state = {
  activePolyMain: 'land',
  activePoly:     'land',
  activePts:      'animals',
  selectedPolygonFeature: null,
  selectedPolygonLayer: null,
  explodedPoints: [],
  filteredPoints: [],
  pointMarkerLayer: null,
  currentMarkers: [],
  currentMarkersByKey: new Map(),
  selectedSpeciesKey: null
};

/* ---------------- Елементи на UI ---------------- */
const el = {
  search: document.getElementById('searchBox'),
  ddSTATUS: document.getElementById('ddSTATUS'),
  ddFAMILY: document.getElementById('ddFAMILY'),
  ddTYPE: document.getElementById('ddTYPE'),
  ddORDER: document.getElementById('ddORDER'),
  cbENDEMIC: document.getElementById('cbENDEMIC'),
  cbRELICT: document.getElementById('cbRELICT'),
  rowTypeOrder: document.getElementById('rowTypeOrder'),
  btnClearFilters: document.getElementById('btnClearFilters'),
  btnClearSel: document.getElementById('btnClearSel'),
  list: document.getElementById('list'),
  count: document.getElementById('count'),
  zonesLine: document.getElementById('zonesLine'),
  ddZones: document.getElementById('ddZones'),
  morphLine: document.getElementById('morphLine'),
  ddMorph: document.getElementById('ddMorph'),
  sidebar: document.getElementById('sidebar'),
  btnToggleSidebar: document.getElementById('btnToggleSidebar')
};

/* ---------------- Защити при изнасяне: чакай Leaflet + DOM ---------------- */
async function waitForLeaflet(maxWaitMs = 5000) {
  const start = performance.now();
  while (!window.L) {
    await new Promise(r => setTimeout(r, 20));
    if (performance.now() - start > maxWaitMs) throw new Error('Leaflet (window.L) не е наличен.');
  }
}
function ensureDomElement(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Липсва DOM елемент: #${id}`);
  return node;
}

/* ---------------- Данни за точки ---------------- */
const layers = { data: {} };

/* ---------------- Lazy loader за полигони ---------------- */
async function ensurePolyLayer(key){
  const def = POLY_DEFS[key];
  if (!def) return null;
  if (def.loaded && def.layer) return def.layer;

  try{
    const resp = await fetch(def.url, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} за ${def.url}`);
    const gj = await resp.json();

    def.layer = L.geoJSON(gj, {
      style: () => (def.baseStyle || { color:'#444', weight:1, fillColor:'#ddd', fillOpacity:.35 }),
      onEachFeature: (f, l) => {
        const p = f.properties || {};
        const nm = p.NAME || p.Name || p.name || p.TITLE || p.Label || p.label || '';
        if (nm) l.bindTooltip(String(nm), { permanent:true, direction:'center', className:'poly-label' });

        l.on('mouseover', e => { if (e?.target?.setStyle) e.target.setStyle({ weight: (def.selStyle?.weight ?? 3) }); });
        l.on('mouseout',  e => { if (e?.target?.setStyle) e.target.setStyle(def.baseStyle); });
        l.on('click',     () => onPolygonClick(f, l));
      }
    });
    def.layer.on('add', () => { if (state.pointMarkerLayer) def.layer.bringToBack(); });
    def.loaded = true;
    return def.layer;
  }catch(err){
    console.error('Грешка при зареждане на слой', key, err);
    def.layer = L.geoJSON({ type:'FeatureCollection', features:[] });
    def.loaded = true;
    return def.layer;
  }
}

/* ---------------- Еднократен начален fit към България ---------------- */
function initialFitOnceToBulgaria() {
  const def = POLY_DEFS['land'];
  if (!def?.layer) return;

  let bounds = def.layer.getBounds();
  if (!bounds || !bounds.isValid()) return;

  try { bounds = bounds.pad(0.01); } catch(_) {}
  const sidebarW = el.sidebar ? Math.round(el.sidebar.getBoundingClientRect().width) : 0;
  const padTL = [10, 10];
  const padBR = [10 + sidebarW + 5, 10];

  map.invalidateSize();
  map.fitBounds(bounds, { paddingTopLeft: padTL, paddingBottomRight: padBR });
}

/* ---------------- Разни помощни ---------------- */
function explodeMultiPoints(fc) {
  const out = [];
  if (!fc || !fc.features) return out;
  for (const f of fc.features) {
    if (!f || !f.geometry) continue;
    if (f.geometry.type === 'MultiPoint') {
      for (const c of f.geometry.coordinates) {
        out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { ...f.properties } });
      }
    } else if (f.geometry.type === 'Point') {
      out.push(f);
    }
  }
  return out;
}
function setGlobalExplodedFromActive() {
  const fc = layers.data[state.activePts];
  state.explodedPoints = explodeMultiPoints(fc);
}
function uniqueSorted(values) {
  return [...new Set(values.filter(v => v !== null && v !== undefined && String(v).trim() !== ''))]
    .map(String).sort((a,b)=>a.localeCompare(b,'bg',{sensitivity:'base'}));
}
function fillSelect(sel, values, firstLabel) {
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
function populateFilterDropdowns(features) {
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
function normalize(v) {
  if (v == null) return '';
  try { return String(v).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,''); }
  catch(e) { return String(v).toLowerCase(); }
}
function isTruthy(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return ['1','y','yes','true','да'].includes(s) || s.startsWith('y') || s.startsWith('д');
}
function speciesKey(props = {}) {
  const la = (props.LATIN_NAME || '').trim();
  const bg = (props.BG_NAME || '').trim();
  return `${la}||${bg}`;
}
function getFeatureLink(props = {}) {
  const cand = props.ARTICLE_URL || props.LINK || props.URL || props.WEB || props.WIKI || props.WIKIPEDIA;
  if (!cand) return null;
  let href = String(cand).trim();
  if (!href) return null;
  if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
  try { new URL(href); return href; } catch { return null; }
}
const STATUS_TITLES = {
  lc:'LC — Незастрашен', nt:'NT — Почти застрашен', vu:'VU — Уязвим',
  en:'EN — Застрашен', cr:'CR — Критично застрашен',
  dd:'DD — Недостатъчно данни', ex:'EX — Изчезнал'
};
function statusToCode(raw){
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
function boundsForMarkers(markers){
  if (!markers || !markers.length) return null;
  return L.latLngBounds(markers.map(m => m.getLatLng()));
}

/* ---------------- Рендеринг и филтри ---------------- */
function filterMarkersToSelectedSpecies(){
  state.pointMarkerLayer.clearLayers();
  for (const m of state.currentMarkers) m._icon?.classList.remove('highlight');

  if (!state.selectedSpeciesKey){
    for (const m of state.currentMarkers) state.pointMarkerLayer.addLayer(m);
    const speciesCount = new Set(state.filteredPoints.map(f => speciesKey(f.properties))).size;
    el.count.textContent = `Намерени видове: ${speciesCount} (общ брой нахождения: ${state.filteredPoints.length})`;
    return;
  }
  const group = state.currentMarkersByKey.get(state.selectedSpeciesKey) || [];
  for (const m of group){ state.pointMarkerLayer.addLayer(m); m._icon?.classList.add('highlight'); }
  el.count.textContent = `Намерени видове: 1 (общ брой нахождения: ${group.length})`;
}
function applyFiltersAndRender() {
  if (!state.selectedPolygonFeature && (!state.explodedPoints || !state.explodedPoints.length)) {
    setGlobalExplodedFromActive();
    populateFilterDropdowns(state.explodedPoints);
  }

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
function renderListAndMarkers(features) {
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

    marker.on('click', () => openPopupAt([lat, lng], p));
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

    const row = document.createElement('div');
    row.className = 'feature-item';

    const names = document.createElement('div');
    names.className = 'feature-names';

    const nameBG = document.createElement('div');
    nameBG.className = 'name-bg';
    nameBG.textContent = p.BG_NAME || '';

    const nameLA = document.createElement('div');
    nameLA.className = 'name-la';
    nameLA.textContent = p.LATIN_NAME ? `(${p.LATIN_NAME})` : '';

    names.appendChild(nameBG);
    names.appendChild(nameLA);

    const meta = document.createElement('div');
    meta.className = 'feature-meta';

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
    if (isAnimals && p.TYPE){   const typ = document.createElement('span'); typ.textContent = p.TYPE;   meta.appendChild(typ); }

    if (typeof item.count === 'number'){
      const cnt = document.createElement('span');
      cnt.className = 'chip chip--count';
      cnt.title = 'Брой нахождения за вида';
      cnt.textContent = item.count;
      meta.appendChild(cnt);
    }

    names.appendChild(meta);
    row.appendChild(names);

    const rail = document.createElement('div');
    rail.className = 'feature-badges';
    if (isTruthy(p.ENDEMIC)) { const b = document.createElement('span'); b.className = 'chip chip--endemic'; b.textContent = 'Ендемит'; b.title='Ендемит — вид, срещащ се само тук'; rail.appendChild(b); }
    if (isTruthy(p.RELICT))  { const b = document.createElement('span'); b.className = 'chip chip--relict';  b.textContent = 'Реликт';  b.title='Реликт — древен елемент от флора/фауна'; rail.appendChild(b); }
    row.appendChild(rail);

    const linkHref = getFeatureLink(p);
    const btn = document.createElement('button');
    btn.className = 'link-btn';
    btn.textContent = 'Отвори статия';
    btn.disabled = !linkHref;
    if (linkHref) {
      btn.title = 'Отваря статия в нов таб';
      btn.addEventListener('click', (ev) => { ev.stopPropagation(); window.open(linkHref, '_blank', 'noopener'); });
    } else { btn.title = 'Няма налична статия'; }
    row.appendChild(btn);

    row.onclick = () => {
      state.selectedSpeciesKey = item.key;
      filterMarkersToSelectedSpecies();
      const group = state.currentMarkersByKey.get(item.key) || [];
      if (!group.length) return;
      const bnds = boundsForMarkers(group);
      if (group.length === 1) { map.flyTo(group[0].getLatLng(), Math.min(map.getMaxZoom(), 12), { duration: 0.8 }); }
      else { map.flyToBounds(bnds, { padding: [40,40], maxZoom: 12, duration: 0.8 }); }
    };

    el.list.appendChild(row);
  }

  el.count.textContent = `Намерени видове: ${uniqueList.length} (общ брой нахождения: ${totalPoints})`;
  if (state.selectedSpeciesKey) filterMarkersToSelectedSpecies();
}
function openPopupAt(latlng, props) {
  const rows = [];
  const link = getFeatureLink(props);
  if (link) rows.push(`<tr><th style="text-align:left; padding-right:8px">Линк</th><td><a href="${escapeHTML(link)}" target="_blank" rel="noopener">Отвори статия</a></td></tr>`);
  const keysOrder = ['BG_NAME','LATIN_NAME','STATUS','TYPE','ORDER','FAMILY','ENDEMIC','RELICT'];
  for (const k of keysOrder) if (props[k] !== undefined) rows.push(`<tr><th style="text-align:left; padding-right:8px">${escapeHTML(k)}</th><td>${escapeHTML(props[k])}</td></tr>`);
  for (const k of Object.keys(props)) if (!keysOrder.includes(k)) rows.push(`<tr><th style="text-align:left; padding-right:8px">${escapeHTML(k)}</th><td>${escapeHTML(props[k])}</td></tr>`);
  L.popup().setLatLng(latlng).setContent(`<table style="font-size:13px">${rows.join('')}</table>`).openOn(map);
}

/* ---------------- Контроли / събития ---------------- */
function wireControls() {
  el.btnToggleSidebar?.addEventListener('click', () => {
    el.sidebar.classList.toggle('compact');
    // Пази padding при resize
    setTimeout(()=> map.invalidateSize(), 50);
  });

  document.querySelectorAll('input[name="polyMain"]').forEach(r => {
    r.addEventListener('change', async () => {
      const prevKey = state.activePoly;
      const prevDef = POLY_DEFS[prevKey];
      if (prevDef?.layer && map.hasLayer(prevDef.layer)) map.removeLayer(prevDef.layer);
      if (state.selectedPolygonLayer) {
        try { state.selectedPolygonLayer.setStyle(POLY_DEFS[prevKey].baseStyle); } catch(e){}
      }
      state.selectedPolygonLayer = null;
      state.selectedPolygonFeature = null;

      state.activePolyMain = r.value;

      const useZones  = (state.activePolyMain === 'zones');
      const useMorphs = (state.activePolyMain === 'morph');
      el.zonesLine.classList.toggle('hidden', !useZones);
      el.morphLine.classList.toggle('hidden', !useMorphs);

      state.activePoly = useZones  ? el.ddZones.value
                       : useMorphs ? el.ddMorph.value
                       : state.activePolyMain;

      const lay = await ensurePolyLayer(state.activePoly);
      lay.addTo(map);

      state.selectedSpeciesKey = null;
      setGlobalExplodedFromActive();
      populateFilterDropdowns(state.explodedPoints);
      state.filteredPoints = [];
      state.pointMarkerLayer.clearLayers();
      el.list.innerHTML = '';
      el.count.textContent = 'Въведете търсене или изберете територия.';
    });
  });

  el.ddZones?.addEventListener('change', async () => {
    if (state.activePolyMain !== 'zones') return;

    const prevKey = state.activePoly;
    const prevDef = POLY_DEFS[prevKey];
    if (prevDef?.layer && map.hasLayer(prevDef.layer)) map.removeLayer(prevDef.layer);
    if (state.selectedPolygonLayer) {
      try { state.selectedPolygonLayer.setStyle(POLY_DEFS[prevKey].baseStyle); } catch(e){}
    }
    state.selectedPolygonLayer = null;
    state.selectedPolygonFeature = null;

    state.activePoly = el.ddZones.value;
    const lay = await ensurePolyLayer(state.activePoly);
    lay.addTo(map);

    state.selectedSpeciesKey = null;
    setGlobalExplodedFromActive();
    populateFilterDropdowns(state.explodedPoints);
    state.filteredPoints = [];
    state.pointMarkerLayer.clearLayers();
    el.list.innerHTML = '';
    el.count.textContent = 'Въведете търсене или изберете територия.';
  });

  el.ddMorph?.addEventListener('change', async () => {
    if (state.activePolyMain !== 'morph') return;

    const prevKey = state.activePoly;
    const prevDef = POLY_DEFS[prevKey];
    if (prevDef?.layer && map.hasLayer(prevDef.layer)) map.removeLayer(prevDef.layer);
    if (state.selectedPolygonLayer) {
      try { state.selectedPolygonLayer.setStyle(POLY_DEFS[prevKey].baseStyle); } catch(e){}
    }
    state.selectedPolygonLayer = null;
    state.selectedPolygonFeature = null;

    state.activePoly = el.ddMorph.value;
    const lay = await ensurePolyLayer(state.activePoly);
    lay.addTo(map);

    state.selectedSpeciesKey = null;
    setGlobalExplodedFromActive();
    populateFilterDropdowns(state.explodedPoints);
    state.filteredPoints = [];
    state.pointMarkerLayer.clearLayers();
    el.list.innerHTML = '';
    el.count.textContent = 'Въведете търсене или изберете територия.';
  });

  document.querySelectorAll('input[name="points"]').forEach(r => {
    r.addEventListener('change', () => {
      state.activePts = r.value;
      state.selectedSpeciesKey = null;
      refreshFilterVisibility();

      if (state.selectedPolygonFeature) {
        onPolygonClick(state.selectedPolygonFeature, state.selectedPolygonLayer);
      } else {
        setGlobalExplodedFromActive();
        populateFilterDropdowns(state.explodedPoints);
        applyFiltersAndRender();
      }
    });
  });

  let t;
  el.search?.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.selectedSpeciesKey = null; applyFiltersAndRender(); }, 300);
  });

  [el.ddSTATUS, el.ddFAMILY, el.ddTYPE, el.ddORDER, el.cbENDEMIC, el.cbRELICT]
    .forEach(ctrl => { ctrl?.addEventListener('change', () => { state.selectedSpeciesKey = null; applyFiltersAndRender(); }); });

  el.btnClearFilters?.addEventListener('click', () => {
    if (el.search) el.search.value = '';
    [el.ddSTATUS, el.ddFAMILY, el.ddTYPE, el.ddORDER].forEach(sel => { if (sel) sel.value = ''; });
    if (el.cbENDEMIC) el.cbENDEMIC.checked = false;
    if (el.cbRELICT)  el.cbRELICT.checked  = false;
    state.selectedSpeciesKey = null;
    applyFiltersAndRender();
  });

  el.btnClearSel?.addEventListener('click', () => {
    state.selectedSpeciesKey = null;
    clearSelection();
  });
}
function clearSelection() {
  if (state.selectedPolygonLayer) {
    try { state.selectedPolygonLayer.setStyle(POLY_DEFS[state.activePoly].baseStyle); } catch(e){}
  }
  state.selectedPolygonLayer = null;
  state.selectedPolygonFeature = null;
  setGlobalExplodedFromActive();
  populateFilterDropdowns(state.explodedPoints);
  state.filteredPoints = [];
  state.pointMarkerLayer.clearLayers();
  for (const m of state.currentMarkers) { m._icon?.classList.remove('highlight'); }
  el.list.innerHTML = '';
  el.count.textContent = 'Въведете търсене или изберете територия.';
}
function refreshFilterVisibility() {
  const isAnimals = state.activePts === 'animals';
  el.rowTypeOrder?.classList.toggle('hidden', !isAnimals);
}
function escapeHTML(v) {
  if (v===null || v===undefined) return '';
  return String(v)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

/* ---------------- Клик по полигон ---------------- */
function onPolygonClick(feature, layer) {
  if (state.selectedPolygonLayer) {
    try { state.selectedPolygonLayer.setStyle(POLY_DEFS[state.activePoly].baseStyle); } catch(e){}
  }
  state.selectedPolygonLayer = layer;
  state.selectedPolygonFeature = feature;
  try { layer.setStyle(POLY_DEFS[state.activePoly].selStyle); } catch(e){}

  const exploded = explodeMultiPoints(layers.data[state.activePts]);
  const inside = [];
  for (const pt of exploded) if (turf.booleanPointInPolygon(pt, feature)) inside.push(pt);
  state.explodedPoints = inside;

  populateFilterDropdowns(inside);
  applyFiltersAndRender();
}

/* ---------------- Bootstrap (деферени скриптове => DOM e готов) ---------------- */
(async function bootstrap(){
  // гаранция: Leaflet е зареден (външният <script defer> е преди нас)
  await waitForLeaflet();

  // гаранция: #map съществува
  ensureDomElement('map');

  map = L.map('map', { zoomControl: true }).setView([42.75, 25.3], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  state.pointMarkerLayer = L.layerGroup().addTo(map);

  // зареждане на данните (работи само през HTTP(S), а не file://)
  const [animals, plants] = await Promise.all([
    fetch(ANIMALS_GEOJSON_URL, { cache: 'no-cache' }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} за ${ANIMALS_GEOJSON_URL}`); return r.json();
    }),
    fetch(PLANTS_FUNGI_GEOJSON_URL, { cache: 'no-cache' }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} за ${PLANTS_FUNGI_GEOJSON_URL}`); return r.json();
    })
  ]);

  layers.data.animals = animals;
  layers.data.plants  = plants;

  // стартов полигонов слой (land)
  const layer = await ensurePolyLayer(state.activePoly);
  layer.addTo(map);

  // Еднократен начален изглед към България
  initialFitOnceToBulgaria();

  wireControls();
  refreshFilterVisibility();
})();
