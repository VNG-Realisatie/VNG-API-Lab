// Minimale stateful referentie-implementatie van MijnZaken (apis/rest/zaken/next.yaml).
// Bedoeld om te laten zien dat de conformancetest kan slagen, en hoe: de burger komt uit het
// token, niet uit de request. Geen echte auth: tokens zijn vaste teststrings.
//
//   node aansluitprofielen/mijnzaken/referentie-server.js   (poort via PORT, standaard 4020)

const http = require("http");

const PORT = process.env.PORT || 4020;

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
    status: "open",
    huidigeStatus: "In behandeling",
    datumAanvraag: "2024-10-17",
  },
  {
    klantId: "klant-b",
    uuid: "9a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d",
    zaaknummer: "22019283841",
    naam: "Wmo-melding",
    status: "open",
    huidigeStatus: "Ontvangen",
    datumAanvraag: "2024-09-29",
  },
];

const samenvatting = ({ klantId, ...z }) => z;
const detail = (z) => ({
  ...samenvatting(z),
  statushistorie: [{ nummer: 1, titel: z.huidigeStatus, status: "lopend" }],
  documenten: [
    {
      uuid: "c1a0e2b4-1111-4a1a-8a1a-000000000002",
      naam: "Ontvangstbevestiging",
      formaat: "application/pdf",
      bestandsgrootte: 118784,
      datum: z.datumAanvraag,
      bron: "organisatie",
      downloadUrl: `http://127.0.0.1:${PORT}/documenten/c1a0e2b4-1111-4a1a-8a1a-000000000002/download`,
    },
  ],
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

    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === "GET" && url.pathname === "/zaken") {
      // Alleen zaken van de burger uit het token. Er bestaat geen klantId-parameter.
      const status = url.searchParams.get("status");
      const page = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 20);
      if (!(page >= 1) || !(pageSize >= 1 && pageSize <= 100) || (status && !["open", "gesloten"].includes(status))) {
        return fout(res, 400, "ONGELDIGE_AANVRAAG", "Ongeldige aanvraag", "Ongeldige queryparameter.", url.pathname);
      }
      const alle = zaken.filter((z) => z.klantId === klantId && (!status || z.status === status));
      const results = alle.slice((page - 1) * pageSize, page * pageSize).map(samenvatting);
      return json(res, { count: alle.length, next: null, previous: null, results });
    }

    const match = req.method === "GET" && url.pathname.match(/^\/zaken\/([0-9a-f-]{36})$/);
    if (match) {
      const zaak = zaken.find((z) => z.uuid === match[1]);
      if (!zaak) {
        return fout(res, 404, "ZAAK_NIET_GEVONDEN", "Zaak niet gevonden", "Er bestaat geen zaak met dit uuid.", url.pathname);
      }
      if (zaak.klantId !== klantId) {
        return fout(res, 403, "NIET_GEMACHTIGD", "Niet gemachtigd voor deze zaak", "U bent geen betrokkene bij deze zaak.", url.pathname);
      }
      return json(res, detail(zaak));
    }

    fout(res, 404, "NIET_GEVONDEN", "Niet gevonden", "Onbekend pad.", req.url);
  })
  .listen(PORT);
