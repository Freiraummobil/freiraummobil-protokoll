// Kleiner Proxy vor der OpenTripMap-API: versteckt den API-Key (der sonst im
// öffentlichen Quelltext der statischen Reiseplaner-Seite sichtbar wäre) und
// reicht nur die für den Reiseplaner nötigen, bereits zusammengefassten Felder
// weiter. CORS ist auf die Origin(s) aus ALLOWED_ORIGIN beschränkt.
//
// Aufruf: GET /sights?lat=..&lon=..&radius=<km>&limit=<n>&categories=natur,kultur,...

const OTM_BASE = 'https://api.opentripmap.com/0.1/en/places';

// Bildet unsere App-Kategorien auf OpenTripMap-"kinds" ab.
const KIND_MAP = {
  natur: 'natural,water',
  aussicht: 'view_points',
  kultur: 'cultural,historic,architecture',
  strand: 'beaches',
  staedte: 'interesting_places',
  aktivitaet: 'amusements,sport'
};

export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get('Origin') || '';
    const allowedOrigins = (env.ALLOWED_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);
    const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : (allowedOrigins[0] || '');
    const cors = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, cors);

    if (!env.OPENTRIPMAP_KEY) {
      return json({ error: 'Server misconfigured: OPENTRIPMAP_KEY secret is not set' }, 500, cors);
    }

    const url = new URL(request.url);
    const lat = parseFloat(url.searchParams.get('lat'));
    const lon = parseFloat(url.searchParams.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return json({ error: 'lat/lon required' }, 400, cors);
    }
    const radiusKm = Math.min(Math.max(parseFloat(url.searchParams.get('radius')) || 15, 1), 50);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit'), 10) || 6, 1), 10);
    const catsParam = (url.searchParams.get('categories') || '').split(',').map(c => c.trim()).filter(Boolean);
    const kinds = catsParam.length
      ? catsParam.map(c => KIND_MAP[c]).filter(Boolean).join(',')
      : Object.values(KIND_MAP).join(',');

    try {
      const radiusUrl = `${OTM_BASE}/radius?radius=${Math.round(radiusKm * 1000)}&lon=${lon}&lat=${lat}` +
        `&kinds=${encodeURIComponent(kinds)}&rate=2&format=json&limit=${limit}&apikey=${env.OPENTRIPMAP_KEY}`;
      const radiusRes = await fetch(radiusUrl);
      if (!radiusRes.ok) return json({ error: 'OpenTripMap radius search failed (HTTP ' + radiusRes.status + ')' }, 502, cors);
      const places = await radiusRes.json();
      if (!Array.isArray(places)) return json({ results: [] }, 200, cors);

      const details = await Promise.all(places.slice(0, limit).map(async p => {
        try {
          const detRes = await fetch(`${OTM_BASE}/xid/${p.xid}?apikey=${env.OPENTRIPMAP_KEY}`);
          if (!detRes.ok) return null;
          const d = await detRes.json();
          const extract = (d.wikipedia_extracts && d.wikipedia_extracts.text)
            ? d.wikipedia_extracts.text.split(/(?<=[.!?])\s/).slice(0, 2).join(' ')
            : ((d.info && d.info.descr) || null);
          const point = d.point || p.point || {};
          return {
            name: d.name || p.name,
            lat: point.lat,
            lon: point.lon,
            distKm: typeof p.dist === 'number' ? p.dist / 1000 : null,
            category: ((d.kinds || p.kinds || '').split(',')[0] || 'sehenswuerdigkeit').replace(/_/g, ' '),
            description: extract,
            link: d.wikipedia || d.otm || null
          };
        } catch (e) {
          return null;
        }
      }));

      return json({ results: details.filter(r => r && Number.isFinite(r.lat) && Number.isFinite(r.lon) && r.name) }, 200, cors);
    } catch (e) {
      return json({ error: 'Upstream error: ' + (e && e.message) }, 502, cors);
    }
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
  });
}
