# Aansluitprofielen

Een **aansluitprofiel** legt vast hoe een bron op een MijnService aansluit: welke calls een
MijnOmgeving doet, in welke volgorde, welke velden waar landen, en welk gedrag de bron moet
laten zien (zoals autorisatie per burger). Elk profiel is een
[Arazzo](https://spec.openapis.org/arazzo/latest.html)-bestand en dus meteen een uitvoerbare
conformancetest.

Per MijnService zijn er meerdere profielen: één per soort bron. Ze testen dezelfde burgerflows.

| Service | Profiel | Bron |
|---|---|---|
| MijnZaken | [`mijnzaken/mijnzaken-next.arazzo.yaml`](mijnzaken/mijnzaken-next.arazzo.yaml) | Bron die de MijnZaken API (`apis/rest/zaken/next.yaml`) aanbiedt |
| MijnZaken | [`mijnzaken/zgw.arazzo.yaml`](mijnzaken/zgw.arazzo.yaml) | Zaaksysteem met de ZGW Zaken API (1.5.1, gemma-zaken `current_version`) |
| MijnTaken | [`mijntaken/mijntaken-next.arazzo.yaml`](mijntaken/mijntaken-next.arazzo.yaml) | Provider die de MijnTaken API (`apis/rest/taken/next.yaml`) aanbiedt |

## Waarom niet alleen Schemathesis

Schemathesis en Spectral controleren of losse responses de juiste vorm hebben. Een
aansluitprofiel controleert of de bron zich als geheel goed gedraagt:

- **Afhankelijke calls.** Het uuid uit het overzicht moet in het detail werken.
- **Consistentie.** Overzicht en detail tonen dezelfde zaaknummer, naam, status en datum.
- **Autorisatie per burger.** Burger A ziet geen zaken van burger B, ook niet met B's uuid
  of klantId/BSN. Dit is alleen stateful te testen.

Respect controleert bij elke stap ook statuscode, content-type en schema tegen de OpenAPI-spec.

## Workflows

Elk profiel heeft dezelfde basis (hieronder voor MijnZaken). MijnTaken heeft dezelfde set voor
taken, plus `taken-bij-zaak`: de URN van een zaak uit MijnZaken is het filter voor
`GET /taken?context=`, en de taken moeten naar die zaak verwijzen.

| Workflow | Wat het test |
|---|---|
| `overzicht-naar-detail` | Zaken zoeken, eerste zaak openen, gegevens moeten overeenkomen |
| `zonder-token` | Zonder token geen data |
| `onbekende-zaak` | Niet-bestaand uuid geeft 404 |
| `burger-a-haalt-zaak-van-burger-b` | Token van A + uuid van B's zaak geeft 403 (next) of 403/404 (ZGW) |
| `overzicht-bevat-alleen-eigen-zaken` (next) | Het overzicht van A bevat de zaak van B niet |
| `burger-a-zoekt-op-bsn-van-burger-b` (ZGW) | Token van A + BSN van B geeft niets terug |

## Testdata

Een bron die getest wordt, moet twee testburgers hebben (A en B), elk met minstens één zaak,
en voor elk een token. Die gaan als inputs mee:

```bash
npx @redocly/cli@2.57.0 respect aansluitprofielen/mijnzaken/zgw.arazzo.yaml \
  --server zaken=https://jouw-zaaksysteem.example.nl/api/v1 \
  --input tokenA=... --input bsnA=... \
  --input tokenB=... --input bsnB=...
```

Eén workflow draaien kan met `-w overzicht-naar-detail`.

## Resultaten (5 oktober 2026)

| Profiel | Tegen | Resultaat |
|---|---|---|
| mijnzaken-next | Prism-mock (`pnpm mock`) | 2 van 5. Een statische mock kan geen 404 of autorisatie per burger |
| mijnzaken-next | [`referentie-server.js`](referentie-server.js) | 5 van 5 |
| mijntaken-next | Prism-mock | 3 van 6. Geen 404 of autorisatie per burger |
| mijntaken-next | `referentie-server.js` (serveert zaken en taken) | 6 van 6 |
| zgw | [`zgw-referentie-server.js`](mijnzaken/zgw-referentie-server.js), `AUTORISATIE=applicatie` (zoals ZGW 1.x nu werkt) | 3 van 5. Beide autorisatieworkflows falen: een applicatietoken ziet alle zaken |
| zgw | `zgw-referentie-server.js`, `AUTORISATIE=burger` | 5 van 5 |

De ZGW-spec zelf is niet met Prism te mocken (Prism geeft een 500 op `/zaken`), vandaar de
kleine referentieserver.

## Wat de profielen blootleggen

1. **ZGW 1.x haalt de autorisatieworkflows niet.** Het BSN is een queryfilter, geen claim uit
   het token. Een aansluitprofiel op ZGW moet dus kiezen: de bron gaat burger-gebonden tokens
   afdwingen, of er zit een adapter tussen die dat doet. Zie
   `architecture/federated-auth-strategie.md`.
2. **MijnZaken next is hierop aangepast.** Geen `klantId` meer: de burger komt uit het token,
   andermans zaak geeft `403` volgens `patterns/federated-auth`.

## Lokaal draaien

```bash
pnpm test:aansluitprofielen
```

Start de referentieservers en draait alle profielen. Draait ook in CI.
