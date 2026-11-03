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
| MijnTaken | [`mijntaken/openvtb.arazzo.yaml`](mijntaken/openvtb.arazzo.yaml) | Takenregister met de Open VTB Taken API (0.2.0, `apis/rest/openvtb-taken/v0.2.0.yaml`) |
| MijnTaken | [`mijntaken/objecten.arazzo.yaml`](mijntaken/objecten.arazzo.yaml) | Objecten API (Open Object 2.8, `apis/rest/openobject-objecten/v2.8.0.yaml`) met taken als objecten, zoals Open Inwoner en GZAC ze gebruiken |

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

## Draaien

```bash
pnpm test:aansluitprofielen
```

Dit draait [`run.mjs`](run.mjs): de runner start de referentieservers, wacht tot ze luisteren
en draait elk doel uit [`doelen.yaml`](doelen.yaml) met Redocly Respect (CLI 2.57.0, als
devDependency vastgezet). Het rapport komt in [`results/rapport.md`](results/rapport.md) en
`results/rapport.json`, de ruwe Respect-uitvoer in `results/raw/` (niet in git). De exitcode
is alleen 1 bij een onverwachte fout. CI draait hetzelfde en zet het rapport in de
samenvatting van de run en als artifact.

Een doel is een profiel tegen een bron, met de servers en inputs die daarbij horen, en
eventueel een referentieserver die de runner zelf start. Geheimen staan als `${ENV_VAR}` in
`doelen.yaml` en komen uit de omgeving; ze staan nooit in git. `--doel zgw-burger` draait
één doel.

### Gedrag en strikt

Elk doel draait in twee modi. Een check heet `<doel>/<modus>/<workflowId>`.

- **gedrag**: de succescriteria van het profiel zijn hard (afhankelijke calls, consistentie,
  autorisatie per burger), schema- en content-typechecks tegen de OpenAPI-spec zijn
  waarschuwingen (`--severity '{"SCHEMA_CHECK":"warn","CONTENT_TYPE_CHECK":"warn"}'`). Dit
  zegt of de bron zich goed gedraagt voor een MijnOmgeving.
- **strikt**: standaard Respect. Elke response moet ook precies kloppen met de spec. Dit zegt
  of bron en spec bij elkaar passen.

Een doel kan voor gedrag extra checks op waarschuwing zetten met `gedrag_severity`. Open VTB
en Objecten doen dat met `STATUS_CODE_CHECK`, omdat hun specs geen `401`/`403`/`404`
documenteren.

### Bekende fouten

Sommige fouten zijn bekend en uitgelegd, zoals dat ZGW 1.x per applicatie autoriseert en niet
per burger. Die staan per doel onder `bekende_fouten`: een check-id of patroon met `*`, met
uitleg. Een bekende fout staat in het rapport, maar laat de run niet falen. Slaagt een check
met een bekende-foutregel, dan meldt het rapport dat de regel weg kan.

### Een eigen implementatie testen

Een bron die getest wordt, heeft twee testburgers nodig (A en B), elk met minstens één zaak of
taak, en voor elk een token. Geef ze mee zonder `doelen.yaml` te wijzigen:

```bash
node aansluitprofielen/run.mjs --profiel aansluitprofielen/mijnzaken/zgw.arazzo.yaml \
  --id mijn-zaaksysteem \
  --server zaken=https://jouw-zaaksysteem.example.nl/api/v1 \
  --input tokenA=$TOKEN_A --input bsnA=... \
  --input tokenB=$TOKEN_B --input bsnB=...
```

Optioneel: `--modus gedrag` of `--modus strikt` voor één modus, en `--bekend 'strikt/*=uitleg'`
voor een eigen bekende fout. Een eigen `doelen.yaml` kan met `--doelen pad/naar/doelen.yaml`.
Eén workflow los draaien kan met Respect zelf:
`pnpm exec redocly respect <profiel> -w overzicht-naar-detail ...`.

## Resultaten (26 oktober 2026)

Tegen de referentieservers, uit [`results/rapport.md`](results/rapport.md):

| Doel | Bron | Gedrag | Strikt |
|---|---|---|---|
| mijnzaken-next | [`referentie-server.js`](referentie-server.js) | 5 van 5 | 5 van 5 |
| mijntaken-next | `referentie-server.js` (serveert zaken en taken) | 6 van 6 | 6 van 6 |
| zgw-burger | [`zgw-referentie-server.js`](mijnzaken/zgw-referentie-server.js), `AUTORISATIE=burger` | 5 van 5 | 5 van 5 |
| zgw-applicatie | `zgw-referentie-server.js`, `AUTORISATIE=applicatie` (zoals ZGW 1.x nu werkt) | 3 van 5 (2 bekend) | 3 van 5 (2 bekend) |
| openvtb-burger | [`openvtb-referentie-server.js`](mijntaken/openvtb-referentie-server.js), `AUTORISATIE=burger` | 6 van 6 | 0 van 6 (6 bekend) |
| objecten-burger | [`objecten-referentie-server.js`](mijntaken/objecten-referentie-server.js), `AUTORISATIE=burger` | 6 van 6 | 0 van 6 (6 bekend) |

De bekende fouten: bij zgw-applicatie falen beide autorisatieworkflows (een applicatietoken
ziet alle zaken), bij openvtb en objecten faalt strikt op de specs zelf (zie hieronder).
Eerder handmatig gemeten: de Prism-mock (`pnpm mock`) haalt 2 van 5 (mijnzaken-next) en 3 van
6 (mijntaken-next), want een statische mock kan geen 404 of autorisatie per burger. De
openvtb- en objecten-referentieservers met `AUTORISATIE=applicatie` halen 4 van 6.

De ZGW-spec zelf is niet met Prism te mocken (Prism geeft een 500 op `/zaken`), vandaar de
kleine referentieserver.

[DemoStack](https://github.com/joepio/demostack) draait dezelfde profielen op dezelfde manier
tegen een echte Open Zaak, en haalt daar 3 van 5 op gedrag: de twee autorisatieworkflows
falen, als bekende fout.

## Wat de profielen blootleggen

1. **ZGW 1.x haalt de autorisatieworkflows niet.** Het BSN is een queryfilter, geen claim uit
   het token. Een aansluitprofiel op ZGW moet dus kiezen: de bron gaat burger-gebonden tokens
   afdwingen, of er zit een adapter tussen die dat doet. Zie
   `architecture/federated-auth-strategie.md`.
2. **Open VTB 0.2 heeft hetzelfde gat als ZGW.** De burger is het queryfilter
   `isToegewezenAan` (een URN met BSN, dus in de URL), geen claim uit het token.
3. **Open VTB levert niet voor elke taaksoort een link om de taak uit te voeren.** Een
   `urltaak` heeft `uitvraagLink`, maar een `betaaltaak` en een `formuliertaak` niet. MijnTaken
   eist `uitvoering.canonicalUrl` als fallback; die moet een adapter dus zelf maken.
4. **De Open VTB-spec beschrijft minder dan de software doet.** De spec documenteert alleen
   `200` (geen `401`, `403`, `404`), en de discriminator op `taakSoort` is niet valide voor
   JSON Schema-validators (Ajv: "must have const or enum"). In gedrag staan schema- en
   statuscodechecks daarom op waarschuwing en wordt het gedrag hard getest; strikt faalt als
   bekende fout. Beide punten
   zijn feedback voor Maykin, de import in `apis/rest/openvtb-taken/` blijft as-is.
5. **De Objecten API heeft hetzelfde gat, en Open Inwoner vult het in het portaal.** Het BSN
   is een filter op de inhoud van het object. Open Inwoner (commit `5f4b021`) haalt alle
   taakobjecten op en filtert daarna zelf op BSN; het portaal ziet dus taken van andere
   burgers, en alleen de eerste pagina. Ook de Objecten-spec documenteert geen `403`/`404` en
   is niet valide voor Ajv (`nullable` zonder `type`); het doel draait daarom met dezelfde
   instelling als Open VTB.
6. **MijnZaken next is hierop aangepast.** Geen `klantId` meer: de burger komt uit het token,
   andermans zaak geeft `403` volgens `patterns/federated-auth`.
