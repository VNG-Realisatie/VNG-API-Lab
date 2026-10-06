# Service beschrijving — MijnTaken

| Eigenaar ontwerp | Status `next` in dit lab |
| --- | --- |
| Nog vast te stellen | Lab-voorstel, uitgewerkt door het VNG API lab. |

Dit document beschrijft de functionele en technische specificaties van de **MijnTaken** service.
Het dient als servicebeschrijving en Definition of Done voor implementatie en integratie van
taken binnen een MijnOmgeving, in lijn met de VNG MijnServices standaarden.

## Links

**Toekomstig — MijnTaken (VNG):**

- API (interactief): [Open MijnTaken (Scalar)](/?url=/docs/bundled/apis_rest_taken_next.yaml)
- OpenAPI bron: [apis/rest/taken/next.yaml](/?file=apis/rest/taken/next.yaml)

**Huidige situatie — Open VTB (Maykin):**

Open VTB ontsluit Verzoeken, Taken en Berichten als aparte API's. Binnen MijnTaken is vooral de
Taken-API relevant; Verzoeken en Berichten horen bij aanpalende processen maar staan hier ter referentie
in het lab.

- Taken API (interactief): [Scalar](/?url=/docs/bundled/apis_rest_openvtb-taken_v0.1.0.yaml)
- OpenAPI bron: [apis/rest/openvtb-taken/v0.1.0.yaml](/?file=apis/rest/openvtb-taken/v0.1.0.yaml)
- Verzoeken API (interactief): [Scalar](/?url=/docs/bundled/apis_rest_openvtb-verzoeken_v0.1.0.yaml)
- OpenAPI bron: [apis/rest/openvtb-verzoeken/v0.1.0.yaml](/?file=apis/rest/openvtb-verzoeken/v0.1.0.yaml)
- Berichten API (interactief): [Scalar](/?url=/docs/bundled/apis_rest_openvtb-berichten_v0.1.0.yaml)
- OpenAPI bron: [apis/rest/openvtb-berichten/v0.1.0.yaml](/?file=apis/rest/openvtb-berichten/v0.1.0.yaml)
- Bron: [maykinmedia/open-vtb](https://github.com/maykinmedia/open-vtb)

**Overig:**

- Gedeelde foutafhandeling (RFC 7807): [schemas/fout/v0.0.1.json](/?file=schemas/fout/v0.0.1.json)

## Inleiding

Voor veel gemeentelijke diensten ontstaat gedurende de dienstverlening “werk” voor de inwoner of ondernemer:
het aanleveren van bewijsstukken, het invullen van een formulier, het betalen van leges, of het uitvoeren van
een vervolgstap binnen een lopende context (bijv. een zaak).

**MijnTaken** is een service waarmee een MijnOmgeving taken kan tonen en een gebruiker kan begeleiden bij het
uitvoeren ervan — zonder dat de portaal-laag uitvoeringsdata hoeft op te slaan. Taken worden altijd **uitgevoerd
bij de provider**; het portaal kan, afhankelijk van taaktype, lokaal renderen of doorverwijzen.

In implementaties kan **OpenVTB** van Maykin worden gebruikt als component voor het registreren en
ontsluiten van verzoeken, taken en berichten. OpenVTB is daarmee een relevante referentieimplementatie
en tool in het MijnTaken-landschap, maar het MijnTaken-contract blijft implementatie-onafhankelijk:
andere providers kunnen hetzelfde contract ook aanbieden.

## Uitgangspunten

- **Identiteit buiten scope van dit contract**: authenticatie/identificatie van de eindgebruiker verloopt via een
  externe IdP (bijv. DigiD/eHerkenning); de MijnTaken API beschrijft het **functionele contract** tussen portaal
  en provider.
- **Common Ground**: gegevens blijven bij de bron; het portaal is een weergave- en interactielaag, geen register.
- **Implementatie-onafhankelijk contract**: het contract beschrijft wat een MijnTaken provider levert.
  OpenVTB kan deze providerrol invullen, maar is geen verplichte afhankelijkheid voor het portaal.
- **Data-minimalisatie**: `GET /taken` levert **samenvattingen**; detail wordt pas opgehaald vlak vóór uitvoering
  via `GET /taken/{uuid}`.
- **Registratie bij de bron/provider**: proces- of afhandelcomponenten registreren taken bij de
  provider, bijvoorbeeld in OpenVTB. Het portaal raadpleegt en toont taken, maar beheert de taak niet
  als eigen bron.
- **Extensibility / forward compatibility**: nieuwe velden en statussen mogen worden toegevoegd; clients negeren
  wat ze niet kennen.
- **Context via URN**: taken kunnen gekoppeld zijn aan een context (`context.urn`, optioneel `canonicalUrl`) zodat
  portalen context-navigatie kunnen bieden. De URN is dezelfde als `urn` op de zaak in MijnZaken, dus "taken bij
  deze zaak" is `GET /taken?context={urn}`.
- **Privacy by design**: de burger komt uit het token; in de querystring staan alleen filters (status, context-URN),
  nooit identificerende gegevens zoals BSN of klantId.

## Uitgangspunten voor “pilot / eerste implementaties”

- Portaal toont taken en kan (optioneel) lokale uitvoering aanbieden waar mogelijk.
- Taakuitvoering blijft bij provider; portaal houdt hooguit “returnUrl” (navigatiecontext) bij.
- Providers leveren minimaal een `uitvoering.canonicalUrl` als fallback.
- Eerste implementaties kunnen OpenVTB gebruiken als takenprovider of als broncomponent achter een
  provider-adapter. Daarbij wordt getoetst of taaktype, status, contextkoppeling, verloopdatum en
  uitvoeringsinformatie voldoende zijn voor de MijnOmgeving.

## NL Design System

De presentatie en interactie in de MijnOmgeving volgt bij voorkeur de NL Design System richtlijnen.

## Use-cases

- **Takenoverzicht**: gebruiker opent MijnTaken; portaal haalt context op en toont takenlijst.
- **Taakdetail**: gebruiker kiest een taak; portaal haalt detail op vlak vóór uitvoering.
- **Taak registreren**: een proces- of afhandelcomponent maakt een taak aan bij de provider
  (bijv. OpenVTB), inclusief context, status, verloopdatum en uitvoeringsinformatie.
- **Taak lifecycle beheren**: de provider of het aanmakende proces verwerkt, sluit of laat taken
  verlopen wanneer zij niet langer geldig zijn.
- **Taak uitvoeren**:
  - **Redirect** naar `uitvoering.canonicalUrl` (altijd mogelijk als fallback).
  - **Lokale uitvoering** (indien portaal type herkent en provider `uitvoering.definitie` levert): render + submit
    naar `definitie.endpoint`.

## Capabilities

| Capability                                  | Toelichting                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Bieden van interactieve dienstverlening** | Portaal biedt een gepersonaliseerde ervaring op basis van ingelogde identiteit en context. |
| **Overzicht en inzage bieden van taken**    | Portaal toont open/afgeronde taken met deadline/context en begeleidt uitvoering.           |
| **Registreren en beheren van taken**        | Provider legt taken vast, bewaakt status/verloop en koppelt waar mogelijk aan zaak/product. |
| **Uitvoering bij de provider**              | Provider is bronhouder van uitvoeringslogica en uitvoeringsdata; portaal faciliteert.      |

## Bedrijfsobjectenmodel (conceptueel)

| Bedrijfsobject | Definitie                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| **TAAK**       | Afgebakend stuk werk dat iemand moet/kan doen, vaak gekoppeld aan een context (zaak/product/dossier). |
| **CONTEXT**    | Het onderwerp/anker waarbinnen taken bestaan (bijv. ZAAK, PRODUCT), geïdentificeerd met een URN.      |
| **UITVOERING** | Informatie die bepaalt hoe een taak uitgevoerd wordt (type + canonicalUrl + optionele definitie).     |
| **VERWERKER TAAK ID** | Optionele identifier waarmee de verwerkende applicatie een taak kan relateren aan de eigen administratie. |

## Informatiearchitectuur (hoog niveau)

- **MijnOmgeving (portaal)**: presenteert taken, kiest tussen redirect of lokale uitvoering, beheert return-navigatie.
- **MijnTaken provider**: levert contextresultaat (samenvattingen), taakdetail en uitvoeringsinformatie.
  De provider beheert taakstatus, verloop en verwijzingen naar bronprocessen.
- **OpenVTB (Maykin)**: open-source component voor Verzoeken, Taken en Berichten. Kan worden ingezet
  als takenregister/provider of als broncomponent achter een MijnTaken-adapter.
- **Proces- of afhandelcomponent**: maakt taken aan bij de provider, bijvoorbeeld wanneer een inwoner
  extra informatie moet leveren, een document moet uploaden of een betaling moet doen.
- **Identity provider (IdP)**: levert geverifieerde identiteit aan portaal (buiten scope van dit contract).

## Standaarden

- Nederlandse API Strategie / REST design rules (repo-linting via Spectral)
- OAuth 2.0 / Bearer tokens (deployment-specifiek; contract beschrijft het functionele model)
- OpenAPI specificatie: zie [apis/rest/taken/next.yaml](/?file=apis/rest/taken/next.yaml)
- Foutafhandeling: RFC 7807 via [schemas/fout/v0.0.1.json](/?file=schemas/fout/v0.0.1.json)
- Open VTB (Maykin): [Taken](/?url=/docs/bundled/apis_rest_openvtb-taken_v0.1.0.yaml),
  [Verzoeken](/?url=/docs/bundled/apis_rest_openvtb-verzoeken_v0.1.0.yaml),
  [Berichten](/?url=/docs/bundled/apis_rest_openvtb-berichten_v0.1.0.yaml) — referentie-implementaties
  in dit lab

## API’s & patronen

### Overzicht ophalen

- Endpoint: **`GET /taken`**
- Filters (allemaal optioneel): `context` (URN van zaak, product of dossier), `status`, `page`, `pageSize`
- Geen `klantId`: de provider leidt de burger af uit het token (`patterns/federated-auth`)
- Output: `{count, next, previous, results}` met `TaakSamenvatting`-objecten, dezelfde envelop als MijnZaken

Eerder gebruikte dit contract `POST /context/zoek` met `klantId` en `include` in de body. Dat is vervangen:
met de burger uit het token staat er niets identificerends meer in de request, en het `include`-mechanisme
had maar één type.

### Relatie tot OpenVTB

OpenVTB is een Maykin-component voor het registreren en ontsluiten van Verzoeken, Taken en
Berichten. Binnen MijnTaken kan OpenVTB de rol van takenprovider vervullen, of als onderliggende
bron worden gebruikt door een provider die het MijnTaken-contract aanbiedt.

De MijnTaken API blijft het portaalcontract. Portalen hoeven dus niet te weten of een provider
OpenVTB, een eigen takenregister of een adapter bovenop een procesapplicatie gebruikt. Wel moet
een OpenVTB-gebaseerde implementatie aantonen dat de vereiste velden en gedragingen beschikbaar
zijn: taakstatus, verloopdatum, contextkoppeling, uitvoeringsinformatie, detailopvraag en een
stabiele relatie met de verwerkende applicatie.

### Twee-staps flow (lijst → detail)

1. **Zoek/overzicht**: `GET /taken` (samenvattingen)
2. **Detail vlak vóór uitvoering**: `GET /taken/{uuid}` (volledige taak incl. type-specifieke uitvoeringsvelden)

### Uitvoering: lokaal vs redirect

- Redirectpad: portaal gebruikt `uitvoering.canonicalUrl` en voegt een `returnUrl` toe.
- Lokaal pad: portaal rendert op basis van `uitvoering.type` en `uitvoering.definitie` (indien aanwezig) en submit
  naar `definitie.endpoint`.

### Lifecycle en verantwoordelijkheid

Het portaal is verantwoordelijk voor tonen, navigeren en eventueel lokaal renderen. De provider
of het aanmakende proces is verantwoordelijk voor het registreren, actualiseren, sluiten en laten
verlopen van taken. Taken worden waar mogelijk gekoppeld aan een hoofdobject zoals een zaak of
product, zodat beheer, archivering en opschoning uitvoerbaar blijven.

## BPMN user flows

Overzicht laden (context zoeken)

<div class="bpmn-embed" data-bpmn-title="MijnTaken — Overzicht laden (context zoeken)" data-bpmn-src="/bpmn/mijntaken-overzicht.bpmn"></div>

Taak uitvoeren (detail + lokaal vs redirect)

<div class="bpmn-embed" data-bpmn-title="MijnTaken — Taak uitvoeren (detail + lokaal vs redirect)" data-bpmn-src="/bpmn/mijntaken-uitvoeren.bpmn"></div>

Losse bestanden:

- [mijntaken-overzicht.bpmn](/?file=bpmn/mijntaken-overzicht.bpmn)
- [mijntaken-uitvoeren.bpmn](/?file=bpmn/mijntaken-uitvoeren.bpmn)

## Informatiebeveiliging en privacy (richtinggevend)

- **Doelbinding**: taken worden getoond/uitgevoerd voor dienstverlening; geen hergebruik voor andere doelen.
- **Dataminimalisatie**: lijstrespons bevat samenvattingen; detail alleen bij uitvoering.
- **Logging**: voorkom het loggen van request bodies met identificerende gegevens; log minimaal en doelgericht.
- **Vertrouwensrelatie**: portaal en provider moeten afspraken hebben over autorisatie, audit en misbruikpreventie
  (deployment/implementatieprofiel naast dit contract).
- **Archief en audit**: taken kunnen onderdeel zijn van de communicatie tussen overheid en klant.
  Implementaties moeten bepalen welke taakgegevens archiefwaardig zijn en hoe taakstatussen later
  herleidbaar blijven.

## Beheer

- **Eigenaarschap**: provider is bronhouder van taken en uitvoering; portaal beheert presentatie/UX.
  Bij een OpenVTB-implementatie ligt het technisch beheer van het VTB-register bij de partij die
  OpenVTB exploiteert.
- **Lifecycle**: taken kunnen ontstaan/verdwijnen op basis van bronprocessen. De provider bewaakt
  status, verloopdatum en sluiting; het portaal hoort robuust om te gaan met ontbrekende/nieuwe
  velden (forward compatible).
- **Definition of Done voor implementaties**:
  - Taken kunnen via het MijnTaken-contract als samenvatting en detail worden opgehaald.
  - Elke taak heeft een status, titel, context of andere herleidbare relatie, en uitvoeringsinformatie.
  - Er is een fallback via `uitvoering.canonicalUrl`.
  - De verantwoordelijkheden tussen portaal, provider, OpenVTB of andere broncomponenten zijn
    vastgelegd.
  - Lifecycle, archivering, logging en autorisatie zijn ingericht buiten de portaal-laag.
