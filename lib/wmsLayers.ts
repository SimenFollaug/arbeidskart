// Configuration for the public Norwegian WMS services shown on the map.
// Layer names were taken from each service's GetCapabilities document.

export interface WmsSubLayer {
  layers: string;
  /** Stroke color (hex). Applied via WMS SLD + CSS fallback on tiles. */
  strokeColor?: string;
  strokeWidth?: number;
  /** CSS class on tile pane when WMS ignores custom styling. */
  className?: string;
}

export interface WmsLayerConfig {
  id: string;
  name: string;
  /** Heading the layer is grouped under in the layer control. */
  group: string;
  description: string;
  attribution: string;
  url: string;
  /** Layers used for rendering tiles. */
  layers: string;
  /** Optional per-sublayer styling (e.g. strømnett spenningstyper). */
  subLayers?: WmsSubLayer[];
  /** Layers queried on map click via GetFeatureInfo (subset of `layers`). */
  queryLayers: string;
  /** Layer used to build a GetLegendGraphic image. */
  legendLayer: string;
  /** Whether the layer is queryable for feature info. */
  queryable: boolean;
  /** WMS styles param (ArcGIS requires `default` or empty). */
  wmsStyles?: string;
  /** GetFeatureInfo format (varies by tjeneste). */
  wmsInfoFormat?: string;
  /** ArcGIS REST fallback when WMS GetFeatureInfo is empty. */
  restQuery?: {
    base: string;
    layerIds: number[];
    outFields: string;
  };
  /** Kort hint i lagmenyen (f.eks. zoom-krav). */
  layerHint?: string;
  format: string;
  /** Shown enabled by default. */
  defaultEnabled: boolean;
}

/** WMS SLD for line layers (used when tjenesten støtter SLD_BODY). */
export function buildLineSld(
  layerName: string,
  color: string,
  width = 2.5,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld">
  <NamedLayer>
    <Name>${layerName}</Name>
    <UserStyle>
      <FeatureTypeStyle>
        <Rule>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">${color}</CssParameter>
              <CssParameter name="stroke-width">${width}</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;
}

// Group headings, in the order they appear in the layer control.
export const WMS_GROUPS = [
  "Naturvernområder",
  "Naturtyper og naturmangfold",
  "Skog",
  "Kulturminner",
  "Naturfare",
  "Eiendom",
  "Strømnett",
] as const;

const NVE_NETT_WMS =
  "https://kart.nve.no/enterprise/services/Nettanlegg4/MapServer/WMSServer";
const NVE_NETT_REST =
  "https://kart.nve.no/enterprise/rest/services/Nettanlegg4/MapServer";

export const WMS_LAYERS: WmsLayerConfig[] = [
  {
    id: "verneomrader",
    name: "Naturvernområder",
    group: "Naturvernområder",
    description:
      "Naturvernområder (nasjonalparker, naturreservater, skogvern m.m.) fra Miljødirektoratet.",
    attribution: "Miljødirektoratet",
    url: "https://kart.miljodirektoratet.no/arcgis/services/vern/MapServer/WMSServer",
    layers: "naturvern_omrade",
    queryLayers: "naturvern_omrade",
    legendLayer: "naturvern_omrade",
    queryable: true,
    wmsStyles: "default",
    restQuery: {
      base: "https://kart.miljodirektoratet.no/arcgis/rest/services/vern/MapServer",
      layerIds: [0],
      outFields:
        "navn,offisieltNavn,verneform,verneplan,vernedato,kommune,faktaark,forvaltningsmyndighet",
    },
    format: "image/png",
    defaultEnabled: true,
  },
  {
    id: "utvalgte_naturtyper",
    name: "Utvalgte naturtyper",
    group: "Naturtyper og naturmangfold",
    description:
      "Forekomster av utvalgte naturtyper (slåttemark, hule eiker, kystlynghei m.m.) etter naturmangfoldloven. Huk av laget her og zoom inn – forekomstene er spredt og tegnes som fargede flater. Fra Miljødirektoratet.",
    attribution: "Miljødirektoratet",
    url: "https://kart.miljodirektoratet.no/arcgis/services/naturtyper_utvalgte2/MapServer/WMSServer",
    layers: "naturtype_utvalgt_omr",
    queryLayers: "naturtype_utvalgt_omr",
    legendLayer: "naturtype_utvalgt_omr",
    queryable: true,
    wmsStyles: "default",
    restQuery: {
      base:
        "https://kart.miljodirektoratet.no/arcgis/rest/services/naturtyper_utvalgte2/MapServer",
      layerIds: [0],
      outFields: "UtvalgtNaturtype,UtvalgtNaturtypeKode,Kommune,Faktaark",
    },
    format: "image/png",
    defaultEnabled: false,
  },
  {
    id: "fredete_arter",
    name: "Fredete arter (inkl. planter)",
    group: "Naturtyper og naturmangfold",
    description:
      "Punkt- og områdeforekomster for arter som er fredet etter egen forskrift, inkludert fredede planter. Fra Miljødirektoratet/Artsdatabanken.",
    attribution: "Miljødirektoratet / Artsdatabanken",
    url: "https://arcgis002.miljodirektoratet.no/arcgis/services/artnasjonal3/MapServer/WMSServer",
    layers: "fredete_arter_omr,fredete_arter_pkt",
    queryLayers: "fredete_arter_pkt,fredete_arter_omr",
    legendLayer: "fredete_arter_pkt",
    queryable: true,
    wmsStyles: "default",
    format: "image/png",
    defaultEnabled: false,
  },
  {
    id: "hogstklasser",
    name: "Hogstklasser",
    group: "Skog",
    description:
      "Hogstklasser fra skogbruksplanlegging (SBP). Viser skogareal inndelt etter hogstmodenhet. Zoom inn (ca. 1:100 000 eller nærmere) for best visning. Fra NIBIO.",
    attribution: "NIBIO",
    url: "https://wms.nibio.no/cgi-bin/skogbruksplan?",
    layers: "hogstklasser",
    queryLayers: "hogstklasser",
    legendLayer: "hogstklasser",
    queryable: true,
    wmsStyles: "default",
    format: "image/png",
    defaultEnabled: false,
  },
  {
    id: "mis",
    name: "Miljøregistrering i skog (MiS)",
    group: "Skog",
    description:
      "Livsmiljøer og nøkkelbiotoper fra skogbruksplanlegging (MiS-figurer). Zoom inn (ca. 1:50 000–1:100 000) for best visning. Fra NIBIO.",
    attribution: "NIBIO",
    url: "https://wms.nibio.no/cgi-bin/mis?",
    layers: "Livsmiljo_flate,Livsmiljo_linje,Livsmiljo_punkt,Nokkelbiotop",
    queryLayers: "Livsmiljo_flate,Livsmiljo_linje,Livsmiljo_punkt,Nokkelbiotop",
    legendLayer: "Livsmiljo_flate",
    queryable: true,
    wmsStyles: "default",
    wmsInfoFormat: "application/vnd.ogc.gml",
    layerHint: "Zoom inn (ca. 1:50 000) for å se registreringene",
    format: "image/png",
    defaultEnabled: false,
  },
  {
    id: "kulturminner",
    name: "Kulturminner – lokaliteter, enkeltminner og sikringssoner",
    group: "Kulturminner",
    description:
      "Lokaliteter, enkeltminner og sikringssoner fra Riksantikvarens database Askeladden.",
    attribution: "Riksantikvaren",
    url: "https://kart.ra.no/wms/kulturminner2",
    layers:
      "Sikringssoner,Lokaliteter,Enkeltminner,Lokalitetsikoner,Enkeltminneikoner",
    queryLayers:
      "Sikringssoner,Lokaliteter,Enkeltminner,Lokalitetsikoner,Enkeltminneikoner",
    legendLayer: "Lokalitetsikoner",
    queryable: true,
    format: "image/png",
    defaultEnabled: true,
  },
  {
    id: "kvikkleire",
    name: "Kvikkleiresoner",
    group: "Naturfare",
    description:
      "Kartlagte kvikkleiresoner (aktsomhetsområder) med risiko- og faregradsklasser. Fra NVE.",
    attribution: "NVE",
    url: "https://kart.nve.no/enterprise/services/SkredKvikkleire2/MapServer/WMSServer",
    layers: "KvikkleireKartlagtOmrade,KvikkleireRisiko",
    queryLayers: "KvikkleireRisiko,KvikkleireFaregrad,KvikkleireKartlagtOmrade",
    legendLayer: "KvikkleireRisiko",
    queryable: true,
    wmsStyles: "default",
    format: "image/png",
    defaultEnabled: false,
  },
  {
    id: "skredfaresoner",
    name: "Skredfaresoner (bratt terreng)",
    group: "Naturfare",
    description:
      "Samlet skredfare og jord-/flomskred i bratt terreng (≥1/100, ≥1/1000, ≥1/5000). Erosjonsfare langs vassdrag ligger i «Flom- og erosjonsfare». Fra NVE.",
    attribution: "NVE",
    url: "https://kart.nve.no/enterprise/services/Skredfaresoner3/MapServer/WMSServer",
    layers: "Skredfaresone_100,Skredfaresone_1000,Skredfaresone_5000",
    queryLayers: "Skredfaresone_100,Skredfaresone_1000,Skredfaresone_5000",
    legendLayer: "Skredfaresone_100",
    queryable: true,
    wmsStyles: "default",
    restQuery: {
      base: "https://kart.nve.no/enterprise/rest/services/Skredfaresoner3/MapServer",
      layerIds: [6, 7, 8, 10, 11, 12],
      outFields: "skredtype,skredsannsynlighet,objekttype,rapportnummer",
    },
    format: "image/png",
    defaultEnabled: false,
  },
  {
    id: "flom_erosjon",
    name: "Flom- og erosjonsfare",
    group: "Naturfare",
    description:
      "NVEs aktsomhetskart for flom og erosjon langs vassdrag. Grov indikasjon for planlegging – erstatter ikke detaljert flomsonekart.",
    attribution: "NVE",
    url: "https://kart.nve.no/enterprise/services/Flomaktsomhet/MapServer/WMSServer",
    layers: "Flom_aktsomhetsomrade",
    queryLayers: "Flom_aktsomhetsomrade",
    legendLayer: "Flom_aktsomhetsomrade",
    queryable: true,
    wmsStyles: "default",
    restQuery: {
      base: "https://kart.nve.no/enterprise/rest/services/Flomaktsomhet/MapServer",
      layerIds: [1],
      outFields: "objekttype,vassomr,opphav",
    },
    layerHint: "Zoom inn til ca. 1:160 000 eller nærmere",
    format: "image/png",
    defaultEnabled: false,
  },
  {
    id: "eiendom",
    name: "Eiendomsgrenser (gnr/bnr)",
    group: "Eiendom",
    description:
      "Teiger, eiendomsgrenser og matrikkelnummer (gårds- og bruksnummer) fra Kartverkets matrikkel.",
    attribution: "Kartverket",
    url: "https://wms.geonorge.no/skwms1/wms.matrikkelkart",
    layers: "teig,eiendomsgrense,grensepunkt",
    queryLayers: "teig",
    legendLayer: "teig",
    queryable: true,
    wmsInfoFormat: "application/vnd.ogc.gml",
    format: "image/png",
    defaultEnabled: true,
  },
  {
    id: "stromnett_overforing",
    name: "Transmisjons- og regionalnett",
    group: "Strømnett",
    description:
      "Transmisjonsnett (rødt) og regionalnett fra NVE. Gjelder høyere spenningsnivå.",
    attribution: "NVE",
    url: NVE_NETT_WMS,
    layers: "Transmisjonsnett_luftledning43179,Regionalnett_luftledning46171",
    subLayers: [
      {
        layers: "Transmisjonsnett_luftledning43179",
        strokeColor: "#dc2626",
        strokeWidth: 3,
        className: "strom-wms-red",
      },
      { layers: "Regionalnett_luftledning46171" },
    ],
    queryLayers:
      "Transmisjonsnett_luftledning43179,Regionalnett_luftledning46171",
    legendLayer: "Transmisjonsnett_luftledning43179",
    queryable: true,
    wmsStyles: "default",
    format: "image/png",
    defaultEnabled: false,
  },
  {
    id: "stromnett_hsp",
    name: "Høyspent distribusjonsnett",
    group: "Strømnett",
    description:
      "Luft- og jordledninger i høyspent distribusjonsnett. NVE publiserer ikke lavspent (0,4 kV) i offentlig kartdata.",
    attribution: "NVE",
    url: NVE_NETT_WMS,
    layers: "Distribusjonsnett",
    subLayers: [
      {
        layers: "Distribusjonsnett",
        strokeColor: "#9333ea",
        strokeWidth: 2.5,
        className: "strom-wms-purple",
      },
    ],
    queryLayers: "Distribusjonsnett",
    legendLayer: "Distribusjonsnett",
    queryable: true,
    wmsStyles: "default",
    restQuery: {
      base: NVE_NETT_REST,
      layerIds: [2],
      outFields: "navn,eier,objekttype,spenning_kv,sosiNettnivaa,nveNettnivaa",
    },
    layerHint: "Zoom inn til ca. 1:10 000 for å se linjene",
    format: "image/png",
    defaultEnabled: false,
  },
  {
    id: "stromnett_sjokabler",
    name: "Sjøkabler",
    group: "Strømnett",
    description: "Sjøkabler i kraftsystemet fra NVE.",
    attribution: "NVE",
    url: NVE_NETT_WMS,
    layers: "Sjokabler",
    queryLayers: "Sjokabler",
    legendLayer: "Sjokabler",
    queryable: true,
    wmsStyles: "default",
    format: "image/png",
    defaultEnabled: false,
  },
  {
    id: "stromnett_anlegg",
    name: "Transformatorstasjoner og master",
    group: "Strømnett",
    description: "Transformatorstasjoner og luftledningsmaster/stolper fra NVE.",
    attribution: "NVE",
    url: NVE_NETT_WMS,
    layers: "Transformatorstasjoner,Master_og_stolper29882",
    queryLayers: "Transformatorstasjoner,Master_og_stolper29882",
    legendLayer: "Transformatorstasjoner",
    queryable: true,
    wmsStyles: "default",
    restQuery: {
      base: NVE_NETT_REST,
      layerIds: [5, 4],
      outFields: "navn,eier,objekttype,spenning_kv",
    },
    layerHint: "Master og stolper vises ved zoom ca. 1:10 000+",
    format: "image/png",
    defaultEnabled: false,
  },
];

export const WMS_LAYER_MAP: Record<string, WmsLayerConfig> = Object.fromEntries(
  WMS_LAYERS.map((l) => [l.id, l]),
);

// Layers grouped by heading, preserving WMS_GROUPS order.
export const WMS_LAYERS_BY_GROUP: { group: string; layers: WmsLayerConfig[] }[] =
  WMS_GROUPS.map((group) => ({
    group,
    layers: WMS_LAYERS.filter((l) => l.group === group),
  })).filter((g) => g.layers.length > 0);

export const KARTVERKET_ATTRIBUTION = "© Kartverket";

export interface BackgroundLayer {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
}

// Background base maps (Web Mercator XYZ tiles).
export const BACKGROUND_LAYERS: BackgroundLayer[] = [
  {
    id: "topo",
    name: "Topografisk",
    url: "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png",
    attribution: KARTVERKET_ATTRIBUTION,
  },
  {
    id: "topograatone",
    name: "Gråtone",
    url: "https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png",
    attribution: KARTVERKET_ATTRIBUTION,
  },
  {
    id: "flyfoto",
    name: "Flyfoto",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, Maxar, Earthstar Geographics m.fl.",
    maxZoom: 19,
  },
];

/** ArcGIS WMS needs one style per layer when several are requested together. */
export function resolveWmsStyles(
  styles: string | undefined,
  layersParam: string,
): string {
  if (styles == null || styles === "") return "";
  const count = layersParam.split(",").filter(Boolean).length;
  if (count <= 1) return styles;
  const parts = styles.split(",");
  if (parts.length >= count) return styles;
  return Array(count).fill(parts[0] ?? styles).join(",");
}

export function legendUrl(layer: WmsLayerConfig): string {
  const params = new URLSearchParams({
    service: "WMS",
    request: "GetLegendGraphic",
    format: "image/png",
    layer: layer.legendLayer,
    version: "1.3.0",
  });
  return `${layer.url}?${params.toString()}`;
}
