// Пътища за точкови слоеве
export const ANIMALS_GEOJSON_URL = 'data/Animals.geojson';
export const PLANTS_FUNGI_GEOJSON_URL = 'data/PlantsFungi.geojson';

// Полигонови слоеве (lazy-loaded)
export const POLY_DEFS = {
  morph: {
    url: 'data/morph_units.geojson',
    label: 'Геоморфоложки структури',
    baseStyle: { color:'#B08D57', weight:1,   fillColor:'#F3E5AB', fillOpacity:.65 },
    selStyle:  { color:'#B08D57', weight:4,   fillColor:'#FFF4C9', fillOpacity:.8 },
    layer: null, loaded: false
  },
  land: {
    url: 'data/landscape_zoning.geojson',
    label: 'Ландшафтно райониране',
    baseStyle: { color:'#5A8F68', weight:1,   fillColor:'#CDE8B8', fillOpacity:.65 },
    selStyle:  { color:'#5A8F68', weight:4,   fillColor:'#E9F6D8', fillOpacity:.8 },
    layer: null, loaded: false
  },
  n2k_birds: {
    url: 'data/N2000_Birds.geojson',
    label: 'Natura 2000 — Зони за птици',
    baseStyle: { color:'#1E88E5', weight:1.2, fillColor:'#BBDEFB', fillOpacity:.35 },
    selStyle:  { color:'#1565C0', weight:3,   fillColor:'#E3F2FD', fillOpacity:.55 },
    layer: null, loaded: false
  },
  n2k_habitats: {
    url: 'data/N2000_habitatss.geojson',
    label: 'Natura 2000 — Зони по местообитания',
    baseStyle: { color:'#43A047', weight:1.2, fillColor:'#C8E6C9', fillOpacity:.35 },
    selStyle:  { color:'#2E7D32', weight:3,   fillColor:'#E8F5E9', fillOpacity:.55 },
    layer: null, loaded: false
  },
  protected_area: {
    url: 'data/protected_area.geojson',
    label: 'Защитени територии',
    baseStyle: { color:'#8E24AA', weight:1.2, fillColor:'#E1BEE7', fillOpacity:.35 },
    selStyle:  { color:'#6A1B9A', weight:3,   fillColor:'#F3E5F5', fillOpacity:.55 },
    layer: null, loaded: false
  }
};

// Статуси
export const STATUS_TITLES = {
  lc:'LC — Незастрашен',
  nt:'NT — Почти застрашен',
  vu:'VU — Уязвим',
  en:'EN — Застрашен',
  cr:'CR — Критично застрашен',
  dd:'DD — Недостатъчно данни',
  ex:'EX — Изчезнал'
};
