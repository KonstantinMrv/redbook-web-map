import { POLY_DEFS } from './config.js';
import { state } from './state.js';

// карта
export const map = L.map('map', { zoomControl: true }).setView([42.75, 25.3], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, attribution: '&copy; OpenStreetMap' }).addTo(map);
state.pointMarkerLayer = L.layerGroup().addTo(map);

// lazy loader за полигонов слой
export async function ensurePolyLayer(key){
  const def = POLY_DEFS[key];
  if (!def) return null;
  if (def.loaded && def.layer) return def.layer;

  const gj = await fetch(def.url).then(r=>r.json());
  def.layer = L.geoJSON(gj, {
    style: def.baseStyle,
    onEachFeature: (f, l) => {
      l.on({
        mouseover: e => { if (e?.target?._path) e.target._path.classList.add('hovered'); },
        mouseout:  e => { if (e?.target?._path) e.target._path.classList.remove('hovered'); }
      });
    }
  });
  def.loaded = true;
  return def.layer;
}

// начално побиране към активния слой
export function fitToActivePolyForBG(){
  try{
    const def = POLY_DEFS[state.activePoly];
    if (!def?.layer) return;
    const bounds = def.layer.getBounds();
    if (!bounds || !bounds.isValid()) return;

    map.invalidateSize();
    const sidebar = document.getElementById('sidebar');
    const mapEl = document.getElementById('map');
    const sidebarW = sidebar ? sidebar.getBoundingClientRect().width : 0;
    const mapW = mapEl ? mapEl.clientWidth : window.innerWidth;
    const rightPad = Math.min(Math.round(sidebarW), Math.round(mapW * 0.45));

    map.fitBounds(bounds, {
      paddingTopLeft: [30, 30],
      paddingBottomRight: [30 + rightPad, 30],
      maxZoom: 8
    });
  }catch(e){ console.warn('fit error', e); }
}

export function openPopupAt(latlng, html){
  L.popup().setLatLng(latlng).setContent(html).openOn(map);
}
