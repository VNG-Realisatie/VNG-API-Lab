// Minimale stateful referentie-implementatie van MijnZaken en MijnTaken
// (apis/rest/zaken/next.yaml en apis/rest/taken/next.yaml), op één server.
// Bedoeld om te laten zien dat de aansluitprofielen kunnen slagen, en hoe: de burger komt uit
// het token, niet uit de request, en taken verwijzen via de URN naar hun zaak.
// Geen echte auth: tokens zijn vaste teststrings.
//
//   node aansluitprofielen/mijnzaken/referentie-server.js   (poort via PORT, standaard 4020)

const http = require("http");

const PORT = process.env.PORT || 4020;
const BASIS = `http://127.0.0.1:${PORT}`;

const burgers = {
  "token-a": "klant-a",
  "token-b": "klant-b",
};

const zaken = [
  {
    klantId: "klant-a",
    uuid: "550e8400-e29b-41d4-a716-446655440000",
    urn: "urn:nl:gemeenten:zaak:11234899818",
    zaaknummer: "11234899818",
    naam: "Aanvraag subsidie geluidisolatie",
    status: "open",
    huidigeStatus: "In behandeling",
    datumAanvraag: "2024-10-17",
  },
  {
    klantId: "klant-b",
    uuid: "9a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d",
    urn: "urn:nl:gemeenten:zaak:22019283841",
    zaaknummer: "22019283841",
    naam: "Wmo-melding",
    status: "open",
    huidigeStatus: "Ontvangen",
    datumAanvraag: "2024-09-29",
  },
];

const taken = [
  {
    klantId: "klant-a",
    uuid: "7d1e2f3a-4b5c-4d6e-8f70-112233445566",
    titel: { nl: "Geef informatie voor uw aanvraag subsidie geluidsisolatie" },
    status: "open",
    deadline: "2026-10-07T23:59:59+02:00",
    context: { urn: "urn:nl:gemeenten:zaak:11234899818" },
    uitvoering: { type: "formulier", canonicalUrl: `${BASIS}/taken/7d1e2f3a/uitvoeren` },
  },
  {
    klantId: "klant-a",
    uuid: "6fa870d4-a212-4f18-912c-3b9542a12999",
    titel: { nl: "Aanslag waterschapsbelasting betalen" },
    status: "open",
    context: { urn: "urn:nl:waterschappen:belasting:2026-waterschap" },
    uitvoering: { type: "betaling", canonicalUrl: `${BASIS}/betalen/6fa870d4` },
  },
  {
    klantId: "klant-b",
    uuid: "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5",
    titel: { nl: "Indicatiegesprek inplannen" },
    status: "open",
    context: { urn: "urn:nl:gemeenten:zaak:22019283841" },
    uitvoering: { type: "formulier", canonicalUrl: `${BASIS}/taken/1c2d3e4f/uitvoeren` },
  },
];

const zonderKlant = ({ klantId, ...r }) => r;

const zaakDetail = (z) => ({
  ...zonderKlant(z),
  statushistorie: [{ nummer: 1, titel: z.huidigeStatus, status: "lopend" }],
  documenten: [
    {
      uuid: "c1a0e2b4-1111-4a1a-8a1a-000000000002",
      naam: "Ontvangstbevestiging",
      formaat: "application/pdf",
      bestandsgrootte: 118784,
      datum: z.datumAanvraag,
      bron: "organisatie",
      downloadUrl: `${BASIS}/documenten/c1a0e2b4-1111-4a1a-8a1a-000000000002/download`,
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

function pagina(res, url, alle) {
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("pageSize") || 20);
  if (!(page >= 1) || !(pageSize >= 1 && pageSize <= 100)) {
    return fout(res, 400, "ONGELDIGE_AANVRAAG", "Ongeldige aanvraag", "Ongeldige paginering.", url.pathname);
  }
  const results = alle.slice((page - 1) * pageSize, page * pageSize).map(zonderKlant);
  return json(res, { count: alle.length, next: null, previous: null, results });
}

// Eén record ophalen: 404 als het niet bestaat, 403 als het van een andere burger is.
function detail(res, url, lijst, klantId, naam, weergave) {
  const id = url.pathname.split("/").pop();
  const record = lijst.find((r) => r.uuid === id);
  if (!record) {
    const code = `${naam.toUpperCase()}_NIET_GEVONDEN`;
    return fout(res, 404, code, `${naam} niet gevonden`, `Er bestaat geen ${naam.toLowerCase()} met dit uuid.`, url.pathname);
  }
  if (record.klantId !== klantId) {
    return fout(res, 403, "NIET_GEMACHTIGD", `Niet gemachtigd voor deze ${naam.toLowerCase()}`, "Dit record hoort niet bij u.", url.pathname);
  }
  return json(res, weergave(record));
}

const UUID = "[0-9a-f-]{36}";

http
  .createServer((req, res) => {
    const url = new URL(req.url, BASIS);
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const klantId = burgers[token];
    if (!klantId) {
      return fout(res, 401, "NIET_GEAUTHENTICEERD", "Authenticatie vereist", "Geen geldige toegangstoken meegestuurd.", url.pathname);
    }
    if (req.method !== "GET") {
      return fout(res, 405, "METHODE_NIET_TOEGESTAAN", "Methode niet toegestaan", "Alleen GET.", url.pathname);
    }

    // Alleen records van de burger uit het token. Er bestaat geen klantId-parameter.
    if (url.pathname === "/zaken") {
      const status = url.searchParams.get("status");
      if (status && !["open", "gesloten"].includes(status)) {
        return fout(res, 400, "ONGELDIGE_AANVRAAG", "Ongeldige aanvraag", "Ongeldige status.", url.pathname);
      }
      return pagina(res, url, zaken.filter((z) => z.klantId === klantId && (!status || z.status === status)));
    }
    if (new RegExp(`^/zaken/${UUID}$`).test(url.pathname)) {
      return detail(res, url, zaken, klantId, "Zaak", zaakDetail);
    }

    if (url.pathname === "/taken") {
      const context = url.searchParams.get("context");
      const status = url.searchParams.get("status");
      if (context && !context.startsWith("urn:")) {
        return fout(res, 400, "ONGELDIGE_AANVRAAG", "Ongeldige aanvraag", "Parameter 'context' moet een URN zijn.", url.pathname);
      }
      return pagina(
        res,
        url,
        taken.filter(
          (t) =>
            t.klantId === klantId &&
            (!context || t.context.urn === context) &&
            (!status || t.status === status),
        ),
      );
    }
    if (new RegExp(`^/taken/${UUID}$`).test(url.pathname)) {
      return detail(res, url, taken, klantId, "Taak", zonderKlant);
    }

    fout(res, 404, "NIET_GEVONDEN", "Niet gevonden", "Onbekend pad.", url.pathname);
  })
  .listen(PORT);
