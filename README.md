# Arbeidskart

En web-app for feltarbeidere som viser sensitive og regulerte kartlag i Norge,
og lar innloggede brukere markere og dele kommentarer direkte i kartet – for å
unngå feil og arbeid i beskyttede områder.

## Funksjoner

- Innlogging og registrering (e-post + passord, eller innloggingslenke).
- Kart med Kartverkets topografiske bakgrunn (og gråtone).
- Fire togglebare offentlige WMS-temalag med justerbar synlighet og
  tegnforklaring:
  - **Verneområder** – Miljødirektoratet
  - **Kulturminner** – Riksantikvaren (Askeladden)
  - **Eiendomsgrenser (gnr/bnr)** – Kartverket / matrikkelen
  - **Strømnett** – NVE
- Klikk i kartet for å lese underliggende data (f.eks. gårds- og bruksnummer
  eller verneområde) via WMS GetFeatureInfo.
- Legg kommentarer som punkt i kartet med tittel, beskrivelse, kategori og
  status. Kommentarer deles med alle innloggede og oppdateres i sanntid.
- Sidepanel med søk og filtrering på kategori og status.

## Teknologi

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript)
- [Supabase](https://supabase.com) – Auth, PostgreSQL/PostGIS, Realtime, Storage
- [Leaflet](https://leafletjs.com) + [react-leaflet](https://react-leaflet.js.org)
- Tailwind CSS

## Komme i gang

### 1. Installer avhengigheter

```bash
npm install
```

### 2. Sett opp Supabase

1. Opprett et gratis prosjekt på [supabase.com](https://supabase.com/dashboard).
2. Åpne **SQL Editor** og kjør hele innholdet i
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   Dette aktiverer PostGIS og oppretter tabeller, RLS-policyer, en
   storage-bucket og realtime.
3. Gå til **Project Settings → API** og kopier `Project URL` og
   `anon public`-nøkkelen.

### 3. Miljøvariabler

Kopier `.env.example` til `.env.local` og fyll inn verdiene:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://din-prosjekt-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=din-anon-public-key
```

### 4. Kjør appen

```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000), registrer en bruker og
logg inn.

> Tips: Hvis du vil slippe e-postbekreftelse under utvikling, skru av
> «Confirm email» under **Authentication → Providers → Email** i Supabase.

## Datakilder

Alle temalag hentes fra åpne, offentlige WMS-tjenester. Layer-navn er hentet fra
hver tjenestes `GetCapabilities`. Se [`lib/wmsLayers.ts`](lib/wmsLayers.ts).

| Lag | Tjeneste |
| --- | --- |
| Bakgrunn | `cache.kartverket.no` (WMTS, Web Mercator) |
| Verneområder | `kart.miljodirektoratet.no/.../vern/MapServer/WMSServer` |
| Kulturminner | `kart.ra.no/wms/kulturminner2` |
| Eiendom (gnr/bnr) | `wms.geonorge.no/skwms1/wms.matrikkelkart` |
| Strømnett | `kart.nve.no/enterprise/services/Nettanlegg4/MapServer/WMSServer` |

GetFeatureInfo-kall går via en intern proxy
([`app/api/featureinfo/route.ts`](app/api/featureinfo/route.ts)) for å unngå
CORS-problemer.

## Prosjektstruktur

```
app/
  (auth)/login/        Innlogging og registrering
  auth/                Callback og utlogging
  api/featureinfo/     WMS GetFeatureInfo-proxy
  map/                 Hovedkartside (server component)
components/            Kart, lagvelger, sidepanel, dialog m.m.
lib/                   Supabase-klienter, WMS-konfig, typer, kategorier
supabase/migrations/   SQL-skjema med PostGIS og RLS
```

## Videre arbeid (utenfor MVP)

- Offline-støtte (PWA) for feltbruk uten dekning.
- Team-/prosjektscoping av kommentarer.
- Opplasting av bilder til kommentarer (storage-bucket er allerede klar).
- gnr/bnr-oppslag via Kartverkets Matrikkel-API for full eiendomsinfo.
