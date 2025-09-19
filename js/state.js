export const state = {
  activePoly: 'morph',
  activePts:  'animals',
  selectedPolygonFeature: null,
  selectedPolygonLayer: null,
  explodedPoints: [],
  filteredPoints: [],
  pointMarkerLayer: null,
  currentMarkers: [],
  currentMarkersByKey: new Map(),
  selectedSpeciesKey: null
};

export const el = {
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
  count: document.getElementById('count')
};

// точки (зареждаме в main)
export const layers = { data: {} };
