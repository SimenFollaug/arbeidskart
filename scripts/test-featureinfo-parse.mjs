import {
  parseFeatureInfoResponse,
  featureTitle,
  pickDisplayFields,
} from "../lib/featureInfoParse.ts";

const vernHtml = `<h5>FeatureInfoCollection</h5><table><tbody><tr><th>navn</th><th>verneform</th></tr><tr><td>Blåfjell</td><td>Naturreservat</td></tr></tbody></table>`;
const esriXml = `<?xml version="1.0"?><FeatureInfoResponse><FIELDS navn="Blåfjell" verneform="naturreservat" verneplan="Skogvern"/></FeatureInfoResponse>`;
const kultur = `<h3>Storgata 28</h3><table><tr><td><b>objekttype</b></td><td>Lokalitet</td></tr><tr><td><b>lokalitetsart</b></td><td>Bygårdsanlegg</td></tr></table>`;
const gml = `<msGMLOutput><teig_feature><kommunenavn>Oslo</kommunenavn><matrikkelnummertekst>1/1</matrikkelnummertekst></teig_feature></msGMLOutput>`;

for (const [name, text] of [
  ["vern", vernHtml],
  ["esri", esriXml],
  ["kultur", kultur],
  ["gml", gml],
]) {
  const f = parseFeatureInfoResponse(text);
  console.log(
    name,
    "ok=",
    f.length > 0,
    "props=",
    JSON.stringify(f[0] ?? {}),
    "title=",
    featureTitle(f[0] ?? {}),
  );
}
