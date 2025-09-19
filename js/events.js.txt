import { POLY_DEFS } from '.config.js';
import { state, el, layers } from '.state.js';
import { ensurePolyLayer, fitToActivePolyForBG, map } from '.map.js';
import { explodeMultiPoints, populateFilterDropdowns, applyFiltersAndRender } from '.filters.js';

export function wireControls(){
   смяна на полигонов слой
  document.querySelectorAll('input[name=poly]').forEach(r = {
    r.addEventListener('change', async () = {
      const prev = state.activePoly;
      const next = r.value;

      const prevDef = POLY_DEFS[prev];
      if (prevDef.layer && map.hasLayer(prevDef.layer)) map.removeLayer(prevDef.layer);

      if (state.selectedPolygonLayer) {
        try { state.selectedPolygonLayer.setStyle(POLY_DEFS[prev].baseStyle); } catch(e){}
      }
      state.selectedPolygonLayer = null;
      state.selectedPolygonFeature = null;

      state.activePoly = next;
      const lay = await ensurePolyLayer(next);
      lay.addTo(map);

      state.selectedSpeciesKey = null;
      setGlobalExplodedFromActive();
      populateFilterDropdowns(state.explodedPoints);
      state.filteredPoints = [];
      state.pointMarkerLayer.clearLayers();
      el.list.innerHTML = '';
      el.count.textContent = 'Въведете търсене или изберете филтър.';
    });
  });

   смяна на точков слой
  document.querySelectorAll('input[name=points]').forEach(r = {
    r.addEventListener('change', () = {
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

   търсене (debounce)
  let t;
  el.search.addEventListener('input', () = {
    clearTimeout(t);
    t = setTimeout(() = { state.selectedSpeciesKey = null; applyFiltersAndRender(); }, 300);
  });

  [el.ddSTATUS, el.ddFAMILY, el.ddTYPE, el.ddORDER, el.cbENDEMIC, el.cbRELICT]
    .forEach(ctrl = ctrl.addEventListener('change', () = { state.selectedSpeciesKey = null; applyFiltersAndRender(); }));

  el.btnClearFilters.addEventListener('click', () = {
    el.search.value = '';
    [el.ddSTATUS, el.ddFAMILY, el.ddTYPE, el.ddORDER].forEach(sel = sel.value = '');
    el.cbENDEMIC.checked = false;
    el.cbRELICT.checked  = false;
    state.selectedSpeciesKey = null;
    applyFiltersAndRender();
  });

  el.btnClearSel.addEventListener('click', () = {
    state.selectedSpeciesKey = null;
    clearSelection();
    if (state.selectedPolygonLayer) {
      const def = POLY_DEFS[state.activePoly];
      map.fitBounds(def.layer.getBounds(), { padding [30,30], maxZoom 8 });
    } else {
      fitToActivePolyForBG();
    }
  });

   resize → ре-fit
  let to;
  window.addEventListener('resize', () = {
    clearTimeout(to);
    to = setTimeout(() = fitToActivePolyForBG(), 200);
  });
}

 exposed helpers за main.js
export function setGlobalExplodedFromActive(){
  const fc = layers.data[state.activePts];
  state.explodedPoints = explodeMultiPoints(fc);
}
export function clearSelection(){
  if (state.selectedPolygonLayer) {
    try { state.selectedPolygonLayer.setStyle(POLY_DEFS[state.activePoly].baseStyle); } catch(e){}
  }
  state.selectedPolygonLayer = null;
  state.selectedPolygonFeature = null;

  setGlobalExplodedFromActive();
  populateFilterDropdowns(state.explodedPoints);

  state.filteredPoints = [];
  state.pointMarkerLayer.clearLayers();
  for (const m of state.currentMarkers) { m._icon.classList.remove('highlight'); }
  el.list.innerHTML = '';
  el.count.textContent = 'Въведете търсене или изберете филтър.';
}
export function refreshFilterVisibility(){
  const isAnimals = state.activePts === 'animals';
  el.rowTypeOrder.classList.toggle('hidden', !isAnimals);
}

 click handler за полигон (ползвай го в main)
export function onPolygonClick(feature, layer){
  if (state.selectedPolygonLayer) {
    try { state.selectedPolygonLayer.setStyle(POLY_DEFS[state.activePoly].baseStyle); } catch(e){}
  }
  state.selectedPolygonLayer = layer;
  state.selectedPolygonFeature = feature;
  layer.setStyle(POLY_DEFS[state.activePoly].selStyle);

  const exploded = explodeMultiPoints(layers.data[state.activePts]);
  const inside = [];
  for (const pt of exploded) if (turf.booleanPointInPolygon(pt, feature)) inside.push(pt);
  state.explodedPoints = inside;

  populateFilterDropdowns(inside);
  applyFiltersAndRender();
}
