# Service beschrijving — MijnProducten

| Eigenaar ontwerp | Status `next` in dit lab |
| --- | --- |
| Nog vast te stellen | Lab-voorstel, uitgewerkt door het VNG API lab. |

Dit document beschrijft de functionele en technische specificaties van de **MijnProducten** service.
Het dient als servicebeschrijving voor implementatie en integratie van producten binnen een
MijnOmgeving, in lijn met de VNG MijnServices standaarden.

## Status

Verkennend — een eerste werkversie van het contract staat in deze repo als `next`.

## Links

**Toekomstig — MijnProducten (VNG):**

- API (interactief): [Open MijnProducten (Scalar)](/?url=/docs/bundled/apis_rest_producten_next.yaml)
- OpenAPI bron: [apis/rest/producten/next.yaml](/?file=apis/rest/producten/next.yaml)

**Huidige situatie — Open Product (Maykin):**

- Producten API (interactief): [Scalar](/?url=/docs/bundled/apis_rest_openproduct-producten_v1.6.0.yaml)
- OpenAPI bron: [apis/rest/openproduct-producten/v1.6.0.yaml](/?file=apis/rest/openproduct-producten/v1.6.0.yaml)
- Producttypen API (interactief): [Scalar](/?url=/docs/bundled/apis_rest_openproduct-producttypen_v1.6.0.yaml)
- OpenAPI bron: [apis/rest/openproduct-producttypen/v1.6.0.yaml](/?file=apis/rest/openproduct-producttypen/v1.6.0.yaml)
- Bron: [maykinmedia/open-product](https://github.com/maykinmedia/open-product)

**Overig:**

- Gedeelde foutafhandeling (RFC 7807): [schemas/fout/v0.0.1.json](/?file=schemas/fout/v0.0.1.json)

## Inleiding

Gedurende de gemeentelijke dienstverlening ontstaan voor een inwoner of ondernemer **producten**:
een parkeervergunning, een containervergunning, een bezoekersregeling. Een product is iets dat
iemand "heeft" — met een looptijd, een status en producttype-specifieke kenmerken.

**MijnProducten** is een service waarmee een MijnOmgeving de producten van een gebruiker kan tonen.
Het is een **inkijk-contract**: het portaal raadpleegt producten, het muteert ze niet. Aanvragen,
verlengen en verbruiken (bijv. een strip afschrijven van een bezoekersregeling) gebeuren bij de bron
en vallen buiten dit contract.

## Uitgangspunten

- **Inkijk-contract**: MijnProducten beschrijft het _raadplegen_ van producten. Mutaties gebeuren
  bij de bron.
- **Common Ground**: gegevens blijven bij de bron; het portaal is een weergavelaag, geen register.
- **Identiteit buiten scope**: authenticatie/identificatie van de eindgebruiker verloopt via een
  externe IdP (DigiD/eHerkenning); dit contract beschrijft het functionele model tussen portaal
  en provider.
- **Vaste kern, variabele schil**: elk product heeft een vaste kern (`naam`, `startDatum`,
  `eindDatum`, `status`) plus een variabel `dataobject` waarvan de structuur per producttype
  verschilt en wordt beschreven door een JSON Schema.
- **Data-minimalisatie**: `POST /producten/zoek` levert **samenvattingen**; het variabele deel
  wordt pas opgehaald via `GET /producten/{uuid}`.
- **Aansluiting op Open Product**: begrippen en veldnamen sluiten aan op
  [Open Product](https://github.com/maykinmedia/open-product) (`producttype`, `dataobject`,
  `verbruiksobject`, `uniformeProductNaam`, statuswaarden).
- **Privacy by design**: filtercriteria staan in de request body (geen identificerende gegevens
  in querystring/URL-logs).

## Uitgangspunten voor "pilot / eerste implementaties"

- Portaal toont producten en hun looptijd; type-specifieke kenmerken worden getoond op basis van
  het opgehaalde producttype.
- Aanvragen en verbruiken blijven bij de bron; het portaal kan hooguit doorverwijzen.
- Providers leveren minimaal de vaste kern per product; het `dataobject` mag leeg zijn als er
  (nog) geen producttype-schema is.

## NL Design System

De presentatie en interactie in de MijnOmgeving volgt bij voorkeur de NL Design System richtlijnen.

## Use-cases

Drie user stories vormen het uitgangspunt voor MijnProducten. Per story staat de user flow als
BPMN-diagram.

### 1. Vergunning aanvragen

Een burger wil een parkeervergunning aanvragen vanuit de MijnOmgeving. Het portaal toont welke
producttypen beschikbaar zijn en begeleidt de gebruiker; de daadwerkelijke aanvraag wordt
uitgevoerd bij de bron (buiten dit contract). Het aangevraagde product verschijnt daarna in het
overzicht — bijvoorbeeld met status `in_aanvraag`.

<div class="bpmn-embed" data-bpmn-title="MijnProducten — Vergunning aanvragen" data-bpmn-src="/bpmn/mijnproducten-aanvragen.bpmn"></div>

### 2. Looptijd van een vergunning inzien

Een burger wil weten wanneer de vergunning voor een container verloopt. Het portaal toont een
overzicht van producten op basis van de vaste kern (`naam`, `startDatum`, `eindDatum`, `status`)
en haalt bij selectie het detail op — inclusief de type-specifieke velden uit het `dataobject`.

<div class="bpmn-embed" data-bpmn-title="MijnProducten — Vergunning inzien (verloopdatum)" data-bpmn-src="/bpmn/mijnproducten-inzien.bpmn"></div>

### 3. Bezoekersregeling gebruiken (verbruiksobject)

Een burger wil _op de bezoekersregeling_ van de parkeervergunning. Dit is een **verbruiksobject** —
vergelijkbaar met een strippenkaart: een tegoed dat per gebruik wordt afgeschreven. Het portaal
toont het saldo en de eenheid; het daadwerkelijke afschrijven (een bezoeker aanmelden) gebeurt
bij de bron.

<div class="bpmn-embed" data-bpmn-title="MijnProducten — Bezoekersregeling (verbruiksobject)" data-bpmn-src="/bpmn/mijnproducten-verbruiken.bpmn"></div>

Losse BPMN-bestanden:

- [mijnproducten-aanvragen.bpmn](/?file=bpmn/mijnproducten-aanvragen.bpmn)
- [mijnproducten-inzien.bpmn](/?file=bpmn/mijnproducten-inzien.bpmn)
- [mijnproducten-verbruiken.bpmn](/?file=bpmn/mijnproducten-verbruiken.bpmn)

## Capabilities

| Capability                                   | Toelichting                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Inzage bieden in producten**               | Portaal toont de producten van de ingelogde gebruiker met looptijd en status.      |
| **Uniforme weergave over producttypen heen** | De vaste kern maakt een producttype-onafhankelijk overzicht mogelijk.              |
| **Type-specifieke weergave**                 | Het ProductType (JSON Schema) levert labels en typen voor de variabele attributen. |
| **Verbruiksinzicht**                         | Verbruiksobjecten (saldo, eenheid) worden getoond, bijv. een bezoekersregeling.    |

## Bedrijfsobjectenmodel (conceptueel)

| Bedrijfsobject      | Definitie                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **PRODUCT**         | Een concreet product van een inwoner/ondernemer (bijv. een parkeervergunning), met een vaste kern en producttype-specifieke attributen.   |
| **PRODUCTTYPE**     | De definitie/sjabloon van een categorie producten; levert het JSON Schema voor de variabele attributen (`dataobject`, `verbruiksobject`). |
| **VERBRUIKSOBJECT** | Een tegoed-achtig object bij een product (strippenkaart-model), bijv. een bezoekersregeling met saldo.                                    |

## Informatiearchitectuur (hoog niveau)

- **MijnOmgeving (portaal)**: toont producten, haalt producttypen op om de variabele attributen te
  labelen en weer te geven.
- **MijnProducten provider**: levert producttypen, producten (samenvatting en detail) en
  verbruiksobjecten. Implementeert het uniforme contract.
- **Bron / registratiesysteem**: het systeem waar producten worden beheerd (bijv. Open Product).
  MijnProducten is hierop de inkijklaag.
- **Identity provider (IdP)**: levert geverifieerde identiteit aan het portaal (buiten scope van
  dit contract).

## Standaarden

- Nederlandse API Strategie / REST API Design Rules (repo-linting via Spectral)
- OAuth 2.0 / Bearer tokens (deployment-specifiek; het contract beschrijft het functionele model)
- OpenAPI 3.1: zie [apis/rest/producten/next.yaml](/?file=apis/rest/producten/next.yaml)
- Foutafhandeling: RFC 7807 via [schemas/fout/v0.0.1.json](/?file=schemas/fout/v0.0.1.json)
- JSON Schema (draft 2020-12) voor producttype-definities
- [Open Product](https://github.com/maykinmedia/open-product) — afstemming van begrippen en veldnamen;
  API's in dit lab: [producten v1.6.0](/?url=/docs/bundled/apis_rest_openproduct-producten_v1.6.0.yaml),
  [producttypen v1.6.0](/?url=/docs/bundled/apis_rest_openproduct-producttypen_v1.6.0.yaml)
- [UPL — Uniforme Productnamenlijst](https://standaarden.overheid.nl/upl) — via `uniformeProductNaam`
- [Logius — Samenwerkende Catalogi](https://www.logius.nl/onze-dienstverlening/interactie/samenwerkende-catalogi)
  en de [Omgevingswet PDC](https://samenwerken.pleio.nl/groups/view/814f7141-86c7-4fad-963d-497f5551f489/omgevingswet-ztc-en-pdc) — mogelijke bronnen voor producttype-catalogi

## API's & patronen

### POST als query (privacy + ergonomie)

Het portaal gebruikt **`POST /producten/zoek`** als "query" zodat filtercriteria (waaronder
`klantId`) in de body zitten. Dit voorkomt het lekken van identificerende gegevens via URL's,
querystrings, browserhistory en access logs.

### Vaste kern, variabele schil

Elk product heeft een vaste kern (`naam`, `startDatum`, `eindDatum`, `status`) die het portaal
producttype-onafhankelijk kan tonen. Het variabele deel — `dataobject` en `verbruiksobject` — is
een JSON-object waarvan de structuur per producttype verschilt en wordt beschreven door een
**JSON Schema** op het producttype (`dataobjectSchema`, `verbruiksobjectSchema`).

### Twee-staps flow (lijst → detail)

1. **Overzicht**: `POST /producten/zoek` (samenvattingen — alleen de vaste kern)
2. **Detail**: `GET /producten/{uuid}` (volledig product incl. `dataobject` en `verbruiksobject`)

Het producttype wordt apart opgehaald via `GET /producttypen/{code}` voor de labels en typen van
de variabele attributen.

## Informatiebeveiliging en privacy (richtinggevend)

- **Doelbinding**: producten worden getoond voor dienstverlening aan de gebruiker; geen hergebruik
  voor andere doelen.
- **Dataminimalisatie**: de lijstrespons bevat samenvattingen; het variabele detail volgt pas bij
  het inzien van één product.
- **Geen identificerende gegevens in URL's**: het opvragen van producten van een klant gaat via
  `POST /producten/zoek` met `klantId` in de body.
- **Logging**: voorkom het loggen van request bodies met identificerende gegevens; log minimaal
  en doelgericht.

## Beheer

- **Eigenaarschap**: de bron/provider is bronhouder van producten en producttypen; het portaal
  beheert presentatie en UX.
- **Lifecycle**: producten ontstaan, worden actief en verlopen op basis van bronprocessen; het
  portaal hoort robuust om te gaan met ontbrekende of nieuwe velden (forward compatible).

## Openstaande punten

- Waar leeft het canonieke ProductType-register (catalogus)? Per gemeente of landelijk gedeeld?
- Hoe verhoudt MijnProducten zich precies tot Open Product — een dunne inkijklaag bovenop, of een
  profiel ervan?
- Aanvragen en verbruiken vallen nu buiten scope. Komt er een redirect-patroon (zoals
  `uitvoering.canonicalUrl` bij [[mijntaken]]) zodat het portaal naar de bron kan doorverwijzen?
