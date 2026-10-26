// Minimale ZGW Zaken API (alleen de calls uit zgw.arazzo.yaml), om het ZGW-aansluitprofiel
// te kunnen draaien zonder Open Zaak. Twee standen:
//
//   AUTORISATIE=applicatie  zoals ZGW 1.x nu werkt: één token ziet alle zaken, het BSN is
//                           alleen een queryfilter. De autorisatieworkflows falen.
//   AUTORISATIE=burger      het token hoort bij één burger en de bron dwingt dat af.
//                           Alle workflows slagen.
//
//   AUTORISATIE=burger node aansluitprofielen/mijnzaken/zgw-referentie-server.js
//   (poort via PORT, standaard 4021)

const http = require("http");

const PORT = process.env.PORT || 4021;
const MODUS = process.env.AUTORISATIE || "applicatie";
const BASIS = `http://127.0.0.1:${PORT}`;

const tokens = {
  "token-a": "111222333",
  "token-b": "999993653",
};

function zaak(bsn, uuid, identificatie, omschrijving, registratiedatum) {
  const url = `${BASIS}/zaken/${uuid}`;
  return {
    bsn,
    url,
    uuid,
    identificatie,
    omschrijving,
    registratiedatum,
    bronorganisatie: "000000000",
    verantwoordelijkeOrganisatie: "000000000",
    zaaktype: "https://catalogi.example.nl/api/v1/zaaktypen/1b2c3d4e-0000-4000-8000-000000000001",
    startdatum: registratiedatum,
    einddatum: null,
    status: null,
    resultaat: null,
    betalingsindicatieWeergave: "",
    deelzaken: [],
    eigenschappen: [],
    rollen: [],
    zaakinformatieobjecten: [],
    zaakobjecten: [],
  };
}

const zaken = [
  zaak("111222333", "550e8400-e29b-41d4-a716-446655440000", "ZAAK-2024-0001", "Aanvraag subsidie geluidisolatie", "2024-10-17"),
  zaak("999993653", "9a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d", "ZAAK-2024-0002", "Wmo-melding", "2024-09-29"),
];

const publiek = ({ bsn, ...z }) => z;

function antwoord(res, status, body) {
  res.writeHead(status, {
    "Content-Type": status >= 400 ? "application/problem+json" : "application/json",
    "Content-Crs": "EPSG:4326",
    "API-version": "1.5.1",
  });
  res.end(JSON.stringify(body));
}

function fout(res, status, code, title, instance) {
  antwoord(res, status, { type: "about:blank", code, title, status, detail: title, instance });
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, BASIS);
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const bsnUitToken = tokens[token];
    if (!bsnUitToken) {
      return fout(res, 401, "not_authenticated", "Authenticatiegegevens zijn niet opgegeven.", url.pathname);
    }
    // In applicatie-modus mag het token alles zien; in burger-modus alleen de eigen zaken.
    const magZien = (z) => MODUS === "applicatie" || z.bsn === bsnUitToken;

    if (req.method !== "GET") {
      return fout(res, 405, "method_not_allowed", "Methode niet toegestaan.", url.pathname);
    }

    if (url.pathname === "/zaken") {
      const bsn = url.searchParams.get("rol__betrokkeneIdentificatie__natuurlijkPersoon__inpBsn");
      const resultaten = zaken.filter((z) => (!bsn || z.bsn === bsn) && magZien(z)).map(publiek);
      return antwoord(res, 200, { count: resultaten.length, next: null, previous: null, results: resultaten });
    }

    const match = url.pathname.match(/^\/zaken\/([0-9a-f-]{36})$/);
    if (match) {
      const z = zaken.find((z) => z.uuid === match[1] && magZien(z));
      if (!z) return fout(res, 404, "not_found", "Niet gevonden.", url.pathname);
      return antwoord(res, 200, publiek(z));
    }

    if (url.pathname === "/statussen") {
      return antwoord(res, 200, { count: 0, next: null, previous: null, results: [] });
    }

    if (url.pathname === "/zaakinformatieobjecten") {
      return antwoord(res, 200, []);
    }

    fout(res, 404, "not_found", "Niet gevonden.", url.pathname);
  })
  .listen(PORT);
