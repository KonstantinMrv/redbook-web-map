import { ANIMALS_GEOJSON_URL, PLANTS_FUNGI_GEOJSON_URL, POLY_DEFS } from './config.js';
import { state, layers } from './state.js';
import { map, ensurePolyLayer, fitToActivePolyForBG } from './map.js';
import { wireControls, setGlobalExplodedFromActive, refreshFilterVisibility, onPolygonClick } from './events.js';
import { populateFilterDropdowns, applyFiltersAndRender } from './filters.js';

// зареждане на точки, после полигонов слой, после UI
Promise.all([
  fetch(ANIMALS_GEOJSON_URL).then(r => r.json()),
  fetch(PLANTS_FUNGI_GEOJSON_URL).then(r => r.json())
]).then(async ([animals, plants]) => {
  layers.data.animals = animals;
  layers.data.plants  = plants;

  const layer = await ensurePolyLayer(state.activePoly);
  layer.addTo(map);

  // вържи click/hover към слой след като е на картата (за да имаме достъп до layer refs)
  layer.eachLayer(l => {
    l.on('click', () => onPolygonClick(l.feature, l));
    l.on('mouseover', e => { if (e?.target?._path) e.target._path.classList.add('hovered'); });
    l.on('mouseout',  e => { if (e?.target?._path) e.target._path.classList.remove('hovered'); });
    const nm = (l.feature.properties && (l.feature.properties.NAME || l.feature.properties.Name || l.feature.properties.name)) || '';
    if (nm) l.bindTooltip(nm, { permanent:true, direction:'center', className:'poly-label' });
  });

  setGlobalExplodedFromActive();
  populateFilterDropdowns(state.explodedPoints);
  fitToActivePolyForBG();

  wireControls();
  refreshFilterVisibility();

  // ако искаш да покажеш нещо по подразбиране, извикай applyFiltersAndRender()
  // applyFiltersAndRender();
});
