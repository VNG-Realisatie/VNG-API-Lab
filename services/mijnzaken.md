# Service beschrijving — MijnZaken

| Eigenaar ontwerp | Status `next` in dit lab |
| --- | --- |
| Werkgroep MijnZaken (o.a. Vincent van Beek). Afgesproken richting: subset van ZGW 1.6 | Lab-voorstel (VNG API lab), naast de afgesproken subset. Zie [aansluitprofielen](/?file=aansluitprofielen/README.md). |

Dit document beschrijft de functionele en technische richting van **MijnZaken**: het tonen van
persoonsgebonden zaakinformatie binnen een MijnOmgeving. Het dient als servicebeschrijving in
lijn met de VNG MijnServices standaarden, en is bedoeld voor publicatie op Developer.overheid.nl.

## Status

Verkennend — dit document beschrijft de **huidige stand van zaken** en volgt de GitHub-issue
"MijnZaken API", waarin de scope is afgestemd met de werkgroep (o.a. Vincent van Beek en
@terborg).

**Aanpak:** MijnZaken wordt samengesteld als een **subset van de ZGW API's 1.6** — uitsluitend
de endpoints die nodig zijn voor de flows van burgers in de MijnOmgeving. Het is dus géén
herontwerp van een API, maar een afgebakende selectie uit een bestaande standaard.

## Links

- ZGW API's 1.6 (basis): [GEMMA Zaakgericht werken — standaard](https://vng-realisatie.github.io/gemma-zaken/standaard/)
- Gedeelde foutafhandeling (RFC 7807): [schemas/fout/v0.0.1.json](/?file=schemas/fout/v0.0.1.json)

## Inleiding

Een **zaak** is een lopend proces of dossier van een inwoner of ondernemer bij een organisatie:
een vergunningaanvraag, een bezwaar, een melding. Voor de eindgebruiker draait het om enkele
kernvragen: _welke zaken heb ik lopen, wat is de status, welke documenten horen erbij, en wat is
de volgende stap?_

**ZGW API's 1.6** is de bestaande systeem-standaard voor zaakgericht werken. Die API's zijn
ontworpen voor systeem-tot-systeem-integratie binnen het gemeentelijke landschap — registratie,
koppeling en beheer van zaken. Ze zijn fijnmazig en niet specifiek toegesneden op de
informatiebehoefte van een burgerportaal.

**MijnZaken** neemt ZGW 1.6 als basis en haalt daar een **subset** uit: de endpoints die de
burger-flows in de MijnOmgeving nodig hebben. Door bij ZGW 1.6 te blijven — in plaats van een
nieuwe API te ontwerpen — sluit MijnZaken naadloos aan op de bestaande zaaksystemen en hoeven
leveranciers die ZGW 1.6 al aanbieden niets nieuws te bouwen.

MijnZaken sluit aan op [[mijntaken]]: een taak heeft vaak een zaak als context (`context.urn`,
bijv. `urn:nl:gemeenten:zaak:2026-00042`). MijnZaken levert die zaak-context.

## Uitgangspunten

### Ontwerpaspecten

Drie aspecten zijn leidend bij het afbakenen van de subset (overgenomen uit de issue):

- **Eenvoud van implementatie**. Voorkom dat leveranciers veel logica of boilerplate moeten
  schrijven. Door MijnZaken als subset van ZGW 1.6 te definiëren, hoeven leveranciers die ZGW 1.6
  al aanbieden niets extra's te bouwen — de endpoints bestaan al.
- **Performance / efficiency**. Eindgebruikers moeten snel door de app kunnen navigeren. De
  subset richt zich op de endpoints die de burger-flows efficiënt bedienen; aanbevolen
  gebruikspatronen (welke calls, in welke volgorde) worden gedocumenteerd.
- **Aansluiting bij andere patronen**. Door ZGW 1.6 te volgen sluit MijnZaken aan op de
  bestaande zaaksystemen, tooling en standaarden — hoe meer aansluiting, hoe makkelijker het is
  om erop aan te sluiten.

### Algemene uitgangspunten

- **Subset, geen herontwerp**: MijnZaken is een afbakening van ZGW 1.6. Endpoints behouden hun
  ZGW-vorm; er worden geen nieuwe endpoints ontworpen.
- **Common Ground**: gegevens blijven bij de bron; het portaal is een weergavelaag, geen register.
- **Identiteit buiten scope**: authenticatie/identificatie van de eindgebruiker verloopt via een
  externe IdP (DigiD/eHerkenning).
- **Inkijk-gericht**: MijnZaken richt zich op het _raadplegen_ van zaakinformatie. Mutaties
  (acties binnen een zaak) verlopen via [[mijntaken]] of bij de bron.

## Uitgangspunten voor "pilot / eerste implementaties"

- De **burger-flows bepalen de subset**: alleen ZGW-endpoints die in een gevalideerde flow
  worden gebruikt, vallen binnen scope.
- Het portaal toont minimaal: een zakenoverzicht en een zaakdetail met status en documenten.
- Leveranciers die al ZGW 1.6 aanbieden moeten zonder extra ontwikkelwerk kunnen aansluiten.

## NL Design System

De presentatie en interactie in de MijnOmgeving volgt bij voorkeur de NL Design System richtlijnen.

## Use-cases

De volgende user stories vormen het uitgangspunt. Ze bepalen welke ZGW 1.6-endpoints in de
subset vallen. De stories zijn _voorgesteld_ en worden in de werkgroep aangescherpt.

### 1. Zakenoverzicht raadplegen

Een burger opent de MijnOmgeving en wil zien welke zaken hij heeft lopen. Het portaal toont een
overzicht met per zaak een titel, het zaaktype, de actuele status en de datum van de laatste
wijziging.

### 2. Zaakstatus en voortgang inzien

Een burger kiest een zaak en wil weten hoe ver die is: de actuele status, de doorlopen stappen
en — indien beschikbaar — de verwachte doorlooptijd of volgende stap.

### 3. Zaakdocumenten inzien

Een burger wil de documenten bij een zaak raadplegen: ingediende stukken, ontvangen brieven en
besluiten.

## Capabilities

| Capability | Toelichting |
|---|---|
| **Zakenoverzicht bieden** | Portaal toont de lopende en afgeronde zaken van de ingelogde gebruiker. |
| **Inzage in status en voortgang** | Portaal toont de actuele status, doorlopen stappen en (indien bekend) de volgende stap. |
| **Inzage in zaakdocumenten** | Portaal toont de documenten die bij een zaak horen. |
| **Context bieden voor taken** | Een zaak vormt de context waarbinnen taken ([[mijntaken]]) worden getoond en uitgevoerd. |

## Bedrijfsobjectenmodel (conceptueel)

De bedrijfsobjecten sluiten aan op de ZGW-begrippen.

| Bedrijfsobject | Definitie |
|---|---|
| **ZAAK** | Een lopend proces of dossier van een inwoner/ondernemer bij een organisatie. |
| **ZAAKTYPE** | De definitie van een soort zaak (doorlooptijd, fasen, verwachte documenten). |
| **STATUS** | De actuele fase van een zaak binnen het zaaktype. |
| **ZAAKINFORMATIEOBJECT** | Een document dat bij een zaak hoort (ingediend stuk, brief, besluit). |
| **RESULTAAT** | De uitkomst van een afgeronde zaak. |

## Informatiearchitectuur (hoog niveau)

- **MijnOmgeving (portaal)**: presenteert zaken, status en documenten aan de eindgebruiker.
- **MijnZaken**: de afgebakende subset van ZGW 1.6-endpoints die de MijnOmgeving consumeert.
- **ZGW-bron (zaaksysteem)**: het systeem waar zaken worden geregistreerd en beheerd, ontsloten
  via de ZGW API's 1.6.
- **Identity provider (IdP)**: levert geverifieerde identiteit aan het portaal (buiten scope van
  dit contract).

## Standaarden

- [ZGW API's 1.6](https://vng-realisatie.github.io/gemma-zaken/standaard/) — de systeem-standaard
  voor zaakgericht werken; MijnZaken is een subset hiervan
- Nederlandse API Strategie / REST API Design Rules (repo-linting via Spectral)
- OAuth 2.0 / Bearer tokens (deployment-specifiek)
- Foutafhandeling: RFC 7807 via [schemas/fout/v0.0.1.json](/?file=schemas/fout/v0.0.1.json)
- Afstemming met [[mijntaken]] — een zaak als context-URN

## API's & patronen

### MijnZaken als subset van ZGW 1.6

MijnZaken definieert **geen nieuwe endpoints**. Het is een selectie uit de ZGW API's 1.6 — de
endpoints en velden die de burger-flows nodig hebben. De geselecteerde endpoints behouden hun
ZGW-vorm, zodat een leverancier die ZGW 1.6 al implementeert direct aansluit.

### De selectie volgt de burger-flows

De use-cases bepalen welke ZGW-endpoints in de subset vallen, bijvoorbeeld: de zaken van een
klant ophalen, een zaakdetail opvragen, de status raadplegen, de zaakinformatieobjecten
(documenten) tonen, en het zaaktype ophalen voor labels en doorlooptijd.

### Aansluiting op MijnTaken

Een zaak vormt de context van een taak. MijnZaken levert de zaak-context die [[mijntaken]]
gebruikt; waar mogelijk worden dezelfde identifiers (URN) en patronen gehanteerd.

## Informatiebeveiliging en privacy (richtinggevend)

- **Doelbinding**: zaakinformatie wordt getoond voor dienstverlening aan de gebruiker zelf; geen
  hergebruik voor andere doelen.
- **Dataminimalisatie**: het overzicht bevat samenvattingen; detailgegevens volgen pas bij het
  openen van één zaak.
- **Geen identificerende gegevens in URL's**: het filteren op een klant gebeurt zonder
  identificerende gegevens in querystrings of access logs.
- **Logging**: voorkom het loggen van request bodies met identificerende gegevens; log minimaal
  en doelgericht.

## Beheer

- **Eigenaarschap**: de bron (zaaksysteem) is bronhouder van zaken; het portaal beheert
  presentatie en UX. De MijnZaken-subset wordt door VNG Realisatie beheerd, in afstemming met
  de ZGW-standaard.
- **Lifecycle**: zaken ontstaan, doorlopen statussen en worden afgerond op basis van
  bronprocessen; het portaal hoort robuust om te gaan met ontbrekende of nieuwe velden.

## Openstaande punten

- Welke ZGW 1.6-endpoints en -velden vallen precies in de subset? Dit volgt uit de gevalideerde
  burger-flows.
- Worden de ZGW-endpoints 1-op-1 doorgegeven, of is lichte compositie nodig om de performance-
  en eenvoud-doelen te halen?
- Hoe wordt op de klant gefilterd (BSN/eHerkenning) binnen ZGW 1.6?
- Hoe verhoudt het zakenoverzicht zich tot het context-model van [[mijntaken]]?
- Hoe wordt de verwachte doorlooptijd / volgende stap bepaald — uit het zaaktype, of per zaak?
