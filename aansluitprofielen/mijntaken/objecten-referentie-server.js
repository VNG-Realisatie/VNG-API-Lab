// Minimale Objecten API (alleen de calls uit objecten.arazzo.yaml), om het
// Objecten-aansluitprofiel te kunnen draaien zonder Open Object. Taken zijn objecten van het
// objecttype "taak" (Dimpact-schema, zoals Open Inwoner het als UrlTaak leest). Twee standen:
//
//   AUTORISATIE=applicatie  zoals Open Object nu werkt: één token ziet alle objecten, de
//                           burger is alleen een filter op data (data_attr). De
//                           autorisatieworkflows falen.
//   AUTORISATIE=burger      het token hoort bij één burger en de bron (of een adapter)
//                           dwingt dat af. Alle workflows slagen.
//
//   AUTORISATIE=burger node aansluitprofielen/mijntaken/objecten-referentie-server.js
//   (poort via PORT, standaard 4023)

const http = require("http");

const PORT = process.env.PORT || 4023;
const MODUS = process.env.AUTORISATIE || "applicatie";
const BASIS = `http://127.0.0.1:${PORT}`;
const TAAK_TYPE = "http://objecttypen.example.nl/api/v2/objecttypes/7a2b1c3d-0000-4000-8000-00000000aaaa";

const tokens = {
  "token-a": "111222333",
  "token-b": "999993653",
};

function taak(bsn, uuid, titel, verloopdatum, zaakUuid, url) {
  return {
    url: `${BASIS}/objects/${uuid}`,
    uuid,
    type: TAAK_TYPE,
    record: {
      index: 1,
      typeVersion: 1,
      data: {
        titel,
        status: "open",
        soort: "url",
        verwerkerTaakId: "0b9f1c2e-3d4a-4b5c-8d6e-7f8a9b0c1d2e",
        eigenaar: "gzac",
        verloopdatum,
        koppeling: { registratie: "zaak", value: zaakUuid },
        identificatie: { type: "bsn", value: bsn },
        url: { uri: url },
      },
      geometry: null,
      references: [],
      startAt: "2026-10-01",
      endAt: null,
      registrationAt: "2026-10-01",
      correctionFor: null,
      correctedBy: null,
    },
  };
}

const taken = [
  taak("111222333", "4c3b2a19-8e7d-4f6c-9b5a-1a2b3c4d5e6f", "Kentekenbewijs uploaden", "2026-11-01T23:59:59+01:00",
    "550e8400-e29b-41d4-a716-446655440000", "https://formulieren.example.nl/kenteken-uploaden?taak=4c3b2a19"),
  taak("999993653", "d1e2f3a4-b5c6-4d7e-8f90-a1b2c3d4e5f6", "Aanvullende gegevens Wmo-melding", "2026-11-15T23:59:59+01:00",
    "9a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d", "https://formulieren.example.nl/wmo-aanvulling?taak=d1e2f3a4"),
];

// data_attr=pad__exact__waarde, bijvoorbeeld identificatie__value__exact__111222333
function voldoetAan(object, dataAttr) {
  const m = dataAttr.match(/^(.+)__exact__(.*)$/);
  if (!m) return true;
  const waarde = m[1].split("__").reduce((o, k) => (o == null ? undefined : o[k]), object.record.data);
  return String(waarde) === m[2];
}

function antwoord(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Content-Crs": "EPSG:4326" });
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, BASIS);
    const token = (req.headers.authorization || "").replace(/^Token /, "");
    const bsnUitToken = tokens[token];
    if (!bsnUitToken) {
      return antwoord(res, 403, { detail: "Authenticatiegegevens zijn niet opgegeven." });
    }
    const magZien = (o) => MODUS === "applicatie" || o.record.data.identificatie.value === bsnUitToken;

    if (req.method !== "GET") {
      return antwoord(res, 405, { detail: "Methode niet toegestaan." });
    }

    if (url.pathname === "/objects") {
      const type = url.searchParams.get("type");
      const filters = url.searchParams.getAll("data_attr");
      const resultaten = taken.filter(
        (o) => magZien(o) && (!type || o.type === type) && filters.every((f) => voldoetAan(o, f)),
      );
      return antwoord(res, 200, { count: resultaten.length, next: null, previous: null, results: resultaten });
    }

    const match = url.pathname.match(/^\/objects\/([0-9a-f-]{36})$/);
    if (match) {
      const o = taken.find((o) => o.uuid === match[1] && magZien(o));
      if (!o) return antwoord(res, 404, { detail: "Niet gevonden." });
      return antwoord(res, 200, o);
    }

    antwoord(res, 404, { detail: "Niet gevonden." });
  })
  .listen(PORT);
