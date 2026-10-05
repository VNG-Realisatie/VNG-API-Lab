// Minimale stateful referentie-implementatie van MijnZaken (apis/rest/zaken/next.yaml).
// Bedoeld om te laten zien dat de conformancetest kan slagen, en hoe: de burger komt uit het
// token, niet uit de request. Geen echte auth: tokens zijn vaste teststrings.
//
//   node aansluitprofielen/mijnzaken/referentie-server.js   (poort via PORT, standaard 4020)

const http = require("http");

const burgers = {
  "token-a": "klant-a",
  "token-b": "klant-b",
};

const zaken = [
  {
    klantId: "klant-a",
    uuid: "550e8400-e29b-41d4-a716-446655440000",
    zaaknummer: "11234899818",
    naam: "Aanvraag subsidie geluidisolatie",
    status: "Open",
    datumAanvraag: "2024-10-17",
  },
  {
    klantId: "klant-b",
    uuid: "9a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d",
    zaaknummer: "22019283841",
    naam: "Wmo-melding",
    status: "Open",
    datumAanvraag: "2024-09-29",
  },
];

const samenvatting = ({ klantId, ...z }) => z;
const detail = (z) => ({
  ...samenvatting(z),
  statushistorie: [{ nummer: 1, titel: "Aanvraag ontvangen", status: "voltooid" }],
  documenten: [],
  contactmomenten: [],
});

function fout(res, status, code, title, detail, instance) {
  res.writeHead(status, { "Content-Type": "application/problem+json", "API-Version": "next" });
  res.end(JSON.stringify({ type: "about:blank", code, title, status, detail, instance }));
}

function json(res, body) {
  res.writeHead(200, { "Content-Type": "application/json", "API-Version": "next" });
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const klantId = burgers[token];
    if (!klantId) {
      return fout(res, 401, "NIET_GEAUTHENTICEERD", "Authenticatie vereist", "Geen geldige toegangstoken meegestuurd.", req.url);
    }

    if (req.method === "POST" && req.url === "/zaken/zoek") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        let query;
        try {
          query = JSON.parse(raw);
        } catch {
          query = {};
        }
        if (!query.klantId) {
          return fout(res, 400, "ONGELDIGE_AANVRAAG", "Ongeldige aanvraag", "Veld 'klantId' is verplicht.", req.url);
        }
        // Alleen zaken van de burger uit het token, ongeacht welk klantId er gevraagd wordt.
        json(res, zaken.filter((z) => z.klantId === klantId && z.klantId === query.klantId).map(samenvatting));
      });
      return;
    }

    const match = req.method === "GET" && req.url.match(/^\/zaken\/([0-9a-f-]{36})$/);
    if (match) {
      const zaak = zaken.find((z) => z.uuid === match[1] && z.klantId === klantId);
      if (!zaak) {
        return fout(res, 404, "ZAAK_NIET_GEVONDEN", "Zaak niet gevonden", "Er bestaat geen zaak met dit uuid.", req.url);
      }
      return json(res, detail(zaak));
    }

    fout(res, 404, "NIET_GEVONDEN", "Niet gevonden", "Onbekend pad.", req.url);
  })
  .listen(process.env.PORT || 4020);
