# Sights-Proxy (Cloudflare Worker)

Kleiner Proxy vor der [OpenTripMap](https://opentripmap.io/product) API,
damit der API-Key nicht im öffentlichen Quelltext von `reiseplaner.html`
sichtbar ist. Der Reiseplaner ruft ausschließlich diesen Worker auf, nie
OpenTripMap direkt.

## Einmaliges Setup

1. **OpenTripMap-Account & API-Key**
   - Auf https://opentripmap.io/product registrieren (kostenlos, keine
     Kreditkarte nötig)
   - API-Key aus dem Dashboard kopieren (kostenloser Tarif: 5000
     Anfragen/Tag)

2. **Cloudflare-Account**
   - Falls noch nicht vorhanden: https://dash.cloudflare.com/sign-up
     (kostenlos)

3. **Worker mit diesem Repo verbinden (Git-Integration)**
   - Cloudflare-Dashboard → *Workers & Pages* → *Create* → *Workers* →
     *Import a repository*
   - Dieses GitHub-Repo auswählen, als **Root directory** `worker`
     angeben
   - Build-Einstellungen kann Cloudflare anhand von `wrangler.toml`
     automatisch erkennen

4. **API-Key als Secret setzen** (niemals in `wrangler.toml` oder Git!)
   - Im Cloudflare-Dashboard: der Worker → *Settings* →
     *Variables and Secrets* → *Add* → Type **Secret**, Name
     `OPENTRIPMAP_KEY`, Wert = der OpenTripMap-API-Key
   - Alternativ per CLI von deinem Rechner aus (im Ordner `worker/`):
     ```
     npx wrangler login
     npx wrangler secret put OPENTRIPMAP_KEY
     ```

5. **Deploy**
   - Bei Git-Integration: passiert automatisch bei jedem Push auf `main`
   - Manuell: `npx wrangler deploy` im Ordner `worker/`

Nach dem Deploy zeigt Cloudflare die Worker-URL an, z.B.
`https://reiseplaner-sights-proxy.<dein-subdomain>.workers.dev`.
Diese URL muss noch in `reiseplaner.html` bei der Konstante
`OPENTRIPMAP_PROXY_URL` eingetragen werden.

## Lokal testen

```
cd worker
npx wrangler dev
```
