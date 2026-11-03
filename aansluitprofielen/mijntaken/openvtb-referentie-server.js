// Minimale Open VTB Taken API (alleen de calls uit openvtb.arazzo.yaml), om het
// OpenVTB-aansluitprofiel te kunnen draaien zonder Open VTB. Twee standen:
//
//   AUTORISATIE=applicatie  zoals Open VTB 0.2 nu werkt: één token ziet alle taken, de
//                           burger is alleen een queryfilter (isToegewezenAan). De
//                           autorisatieworkflows falen.
//   AUTORISATIE=burger      het token hoort bij één burger en de bron (of een adapter)
//                           dwingt dat af. Alle workflows slagen.
//
//   AUTORISATIE=burger node aansluitprofielen/mijntaken/openvtb-referentie-server.js
//   (poort via PORT, standaard 4022)

const http = require("http");

const PORT = process.env.PORT || 4022;
const MODUS = process.env.AUTORISATIE || "applicatie";
const BASIS = `http://127.0.0.1:${PORT}`;

const tokens = {
  "token-a": "urn:nld:brp:bsn:111222333",
  "token-b": "urn:nld:brp:bsn:999993653",
};

function taak(isToegewezenAan, uuid, taakSoort, titel, einddatumHandelingsTermijn, zaakUrn, details) {
  return {
    url: `${BASIS}/externetaken/${uuid}`,
    urn: `urn:nld:gemeentevoorbeeld:taak:uuid:${uuid}`,
    uuid,
    titel,
    verwerkerTaakId: null,
    status: "open",
    startdatum: "2026-10-01T09:00:00+02:00",
    handelingsPerspectief: taakSoort === "betaaltaak" ? "betalen" : "informatie_geven",
    einddatumHandelingsTermijn,
    datumHerinnering: null,
    toelichting: "",
    isToegewezenAan,
    isGerelateerdAan: [{ urn: zaakUrn }],
    taakSoort,
    details,
  };
}

const taken = [
  taak(
    tokens["token-a"],
    "3f1c2b4a-7d8e-4f60-9a1b-2c3d4e5f6a7b",
    "urltaak",
    "Kentekenbewijs uploaden",
    "2026-11-01T23:59:59+01:00",
    "urn:nld:gemeentevoorbeeld:zaak:zaaknummer:ZAAK-2024-0001",
    { uitvraagLink: "https://formulieren.example.nl/kenteken-uploaden?taak=3f1c2b4a" },
  ),
  taak(
    tokens["token-b"],
    "8b7a6c5d-4e3f-4a21-9b0c-1d2e3f4a5b6c",
    "betaaltaak",
    "Leges Wmo-melding betalen",
    "2026-11-15T23:59:59+01:00",
    "urn:nld:gemeentevoorbeeld:zaak:zaaknummer:ZAAK-2024-0002",
    {
      bedrag: "35.00",
      valuta: "EUR",
      transactieomschrijving: "Leges ZAAK-2024-0002",
      doelrekening: { naam: "Gemeente Voorbeeld", code: "LEGES", iban: "NL91ABNA0417164300" },
    },
  ),
];

// Filters op URN-velden matchen op een volledig segment van de URN (zie de Open VTB-spec).
const segmentMatch = (urn, waarde) => {
  const delen = waarde.split(":");
  const urnDelen = urn.split(":");
  for (let i = 0; i + delen.length <= urnDelen.length; i++) {
    if (delen.every((d, j) => urnDelen[i + j] === d)) return true;
  }
  return false;
};

function antwoord(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, BASIS);
    const token = (req.headers.authorization || "").replace(/^Token /, "");
    const burgerUitToken = tokens[token];
    if (!burgerUitToken) {
      return antwoord(res, 401, { detail: "Authenticatiegegevens zijn niet opgegeven." });
    }
    // In applicatie-modus mag het token alles zien; in burger-modus alleen de eigen taken.
    const magZien = (t) => MODUS === "applicatie" || t.isToegewezenAan === burgerUitToken;

    if (req.method !== "GET") {
      return antwoord(res, 405, { detail: "Methode niet toegestaan." });
    }

    if (url.pathname === "/externetaken") {
      const p = url.searchParams;
      const resultaten = taken.filter(
        (t) =>
          magZien(t) &&
          (!p.get("isToegewezenAan") || segmentMatch(t.isToegewezenAan, p.get("isToegewezenAan"))) &&
          (!p.get("isGerelateerdAan") || t.isGerelateerdAan.some((g) => segmentMatch(g.urn, p.get("isGerelateerdAan")))) &&
          (!p.get("status") || t.status === p.get("status")),
      );
      return antwoord(res, 200, { count: resultaten.length, next: null, previous: null, results: resultaten });
    }

    const match = url.pathname.match(/^\/externetaken\/([0-9a-f-]{36})$/);
    if (match) {
      const t = taken.find((t) => t.uuid === match[1] && magZien(t));
      if (!t) return antwoord(res, 404, { detail: "Niet gevonden." });
      return antwoord(res, 200, t);
    }

    antwoord(res, 404, { detail: "Niet gevonden." });
  })
  .listen(PORT);
