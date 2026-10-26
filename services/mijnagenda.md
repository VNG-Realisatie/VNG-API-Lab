# Service beschrijving — MijnAgenda

| Eigenaar ontwerp | Status `next` in dit lab |
| --- | --- |
| Werkgroep Ontwerp MijnAgenda Service | Werkgroep-ontwerp. Het lab volgt; wijzigingen lopen via de werkgroep. |

Dit document beschrijft de functionele en technische specificaties van de **MijnAgenda** service:
het tonen van agenda-afspraken van een inwoner of ondernemer binnen een MijnOmgeving. Het dient
als servicebeschrijving in lijn met de VNG MijnServices standaarden.

## Status

Deze servicebeschrijving is gebaseerd op het ontwerp van de werkgroep **Ontwerp MijnAgenda
Service** (platform voor dienstverlening / Common Ground). MijnAgenda biedt voorlopig alleen het
**tonen** van afspraken; het maken, aanpassen of annuleren van afspraken wordt mogelijk op een
later moment toegevoegd.

## Links

**MijnAgenda (VNG):**

- API (interactief): [Open MijnAgenda (Scalar)](/?url=/docs/bundled/apis_rest_agenda_next.yaml)
- OpenAPI bron: [apis/rest/agenda/next.yaml](/?file=apis/rest/agenda/next.yaml)

**Referentie — klantinteracties (Open Klant):**

Afspraken en contactmomenten sluiten aan op het informatiemodel [klantinteracties](https://vng-realisatie.github.io/klantinteracties/).
In dit lab staat een OpenAPI-referentie voor het bredere klantinteracties-register:

- Klantinteracties API (interactief): [Scalar](/?url=/docs/bundled/apis_rest_openklant-klantinteracties_v0.7.0.yaml)
- OpenAPI bron: [apis/rest/openklant-klantinteracties/v0.7.0.yaml](/?file=apis/rest/openklant-klantinteracties/v0.7.0.yaml)

**Overig:**

- Gedeelde foutafhandeling (RFC 7807): [schemas/fout/v0.0.1.json](/?file=schemas/fout/v0.0.1.json)
- Informatiemodel (ReSpec): [MijnAgenda-Respec](https://vng-realisatie.github.io/MijnAgenda-Respec/)

## Inleiding

Voor sommige producten of diensten van een gemeente is een afspraak met een overheidsorganisatie
nodig. Overheidsorganisaties bieden een webomgeving (via een afsprakensysteem) aan waarmee
inwoners of ondernemers een afspraak kunnen inplannen. Als bij het maken van de afspraak ook een
e-mailadres is ingevuld, wordt een e-mail als bevestiging van de afspraak verstuurd. Naderhand is
via de link in de verstuurde e-mail de afspraak via hetzelfde afsprakensysteem in te zien en aan
te passen.

Om de gemaakte afspraken ook in een MijnOmgeving te kunnen tonen, is samen met verschillende
leveranciers van afsprakensystemen de **MijnAgenda** service ontwikkeld. Inwoners of ondernemers
die via een digitaal authenticatiemiddel (zoals DigiD en eHerkenning) in een MijnOmgeving zijn
ingelogd, kunnen dan hun gemaakte afspraken ook hierin terugzien.

De MijnAgenda service biedt voorlopig alleen de functie voor het tonen van de afspraken. Het
kunnen maken, aanpassen of annuleren van afspraken wordt mogelijk op een later moment toegevoegd.

## Uitgangspunten

- De interacties met MijnAgenda gaan ervan uit dat van een inwoner het identificerend gegeven
  BSN bekend is. Dit wordt normaliter verkregen via inlogmiddelen zoals DigiD, eIDAS 1.0 of
  EUDI Wallet. Voor ondernemers geldt het inlogmiddel eHerkenning.
- Bij de opzet van MijnAgenda wordt het Common Ground principe van "eenmalig vastleggen en
  meervoudig gebruik" gehanteerd. Als bron voor de afspraken wordt het afsprakensysteem gebruikt.
  Er is dus geen sprake van een afzonderlijk afsprakenregister.
- De bronorganisatie (de overheidsorganisatie) kent slechts één afsprakensysteem. Mochten
  meerdere afsprakensystemen in gebruik zijn, dan zal een "converter laag" nodig zijn — een laag
  die de interacties met het afsprakensysteem omzet naar interacties met meerdere
  afspraaksystemen. Dit is een implementatievraagstuk en is buiten scope van deze standaard.
- Voor het maken van een afspraak in het afsprakensysteem logt de inwoner of ondernemer niet in
  via een digitaal authenticatiemiddel zoals DigiD of eHerkenning. Het afsprakensysteem kan geen
  BSN herleiden.
- Er wordt in het afsprakensysteem geen BSN opgeslagen.
- Voor het specificeren van de API's wordt de landelijke standaard gevolgd: API Strategie.
- Er wordt gebruikgemaakt van OAuth 2.0 voor autorisatie in de API's.
- Het afspraaksysteem levert alleen agenda-afspraken die niet geannuleerd zijn.
- Statusinformatie van de agenda-afspraak wordt door het afspraaksysteem niet geleverd.

## Uitgangspunten voor de pilot

Het ontwerp van de MijnAgenda Service heeft de scope zoals verwoord in de uitgangspunten
hierboven. Daarnaast wordt een eerste pilot opgestart waarvoor een kleinere scope wordt gekozen:

- Aanmaken, wijzigen of annuleren van een afspraak gebeurt in het afsprakensysteem.
- Alleen afspraken die betrekking hebben op een inwoner worden getoond in de MijnOmgeving.
  Afspraken m.b.t. ondernemers zijn uit scope van de pilot.
- Het tonen van de afspraken in een KCC-applicatie is uit scope.
- Het opgegeven e-mailadres wordt gebruikt om afspraken aan een inwoner te koppelen nadat de
  inwoner via DigiD bij de MijnOmgeving is ingelogd.
- Het e-mailadres uit de afspraak wordt gecontroleerd tegen het geverifieerde e-mailadres uit het
  Profiel (MijnProfiel). Als dat gelijk is, wordt de afspraak in een MijnOmgeving getoond.

## NL Design System

De presentatie en interactie in de MijnOmgeving volgt de NL Design System richtlijnen.
Documentatie is onder andere te vinden via de
[NL Design System discussies over Mijn-omgevingen](https://github.com/orgs/nl-design-system/discussions/categories/mijn-omgevingen).

## Use-cases

De kern-use-case is het **raadplegen van agenda-afspraken**: een ingelogde inwoner of ondernemer
ziet de bij hem of haar bekende afspraken in de MijnOmgeving en kan de details van een afspraak
opvragen. Twee patronen zijn uitgewerkt in de [Sequentiediagrammen](#sequentiediagrammen):

- **Via de Mijngemeentecomponent** — de inwoner/ondernemer raadpleegt zelf zijn afspraken
  (in scope van de pilot).
- **Via de Relatiebeheercomponent (KCC)** — een KCC-medewerker raadpleegt de afspraken namens de
  inwoner/ondernemer (uit scope van de pilot).

## Architectuur

In dit hoofdstuk wordt de architectuur van de MijnAgenda service beschreven: de capabilities, het
bedrijfsobjectenmodel, de informatiearchitectuur en de sequentiediagrammen.

### Capabilities

Capabilities geven aan wat een organisatie doet in het kader van MijnAgenda — welke vaardigheden
een organisatie moet bezitten. Onderstaande capability is onderdeel van een algemenere capability
("Bieden van interactieve dienstverlening") die ook geldt voor de andere MijnServices (MijnZaken,
MijnTaken, MijnContactmomenten, MijnBerichten, Notificeren).

| Capability | Toelichting |
|---|---|
| **Bieden van interactieve dienstverlening** | Tijdens de dienstverlening heeft een organisatie veelvuldig contact met burgers en bedrijven in allerlei vormen. Overheidsorganisaties kunnen hierbij interactieve dienstverlening bieden, geïnitieerd door de organisatie zelf of naar aanleiding van een verzoek van een burger of bedrijf. |
| **Overzicht en inzage bieden van agenda-afspraken** | De overheidsorganisatie kan een overzicht en inzage bieden in de agenda-afspraken die een burger of bedrijf heeft of heeft gehad bij de overheidsorganisatie. |

### Bedrijfsobjectenmodel

In het bedrijfsobjectenmodel staat de kern **AGENDA-AFSPRAAK** centraal. Aan de bovenkant staan
bedrijfsobjecten die het onderwerp van de agenda-afspraak kunnen zijn; aan de onderkant de
personen die betrokken kunnen zijn.

| Bedrijfsobject | Definitie |
|---|---|
| **ACTOR** | Iets dat of iemand die voor de overheidsorganisatie werkzaamheden uitvoert. |
| **AFSPRAAKLOCATIE** | De specifieke plaats waar een afspraak plaatsvindt: een fysiek bezoekadres, een online afspraak met een URL of een telefonische afspraak. |
| **AGENDA-AFSPRAAK** | Een gepland contactmoment waarop een gesproken interactie plaatsvindt tussen een burger, bedrijf of instelling en een overheidsorganisatie. |
| **GESPREK** | Een digitale dialoog tussen een burger, bedrijf of instelling en (een) overheidsorganisatie(s). |
| **KLANTCONTACT** | Contactmoment tussen een burger, bedrijf of instelling en een overheidsorganisatie dat werkelijk heeft plaatsgevonden. |
| **PARTIJ** | Persoon of organisatie waarmee de overheidsorganisatie een relatie heeft. |
| **PLAN** | Een gestructureerde en vastgelegde beschrijving van doelen, keuzes, activiteiten en middelen. |
| **PRODUCT** | Iets wat wordt voortgebracht en een concrete of herkenbare waarde heeft voor een burger, bedrijf, instelling of andere overheidsorganisatie. |
| **TAAK** | Een welomschreven en afgebakende hoeveelheid werk dat iemand doet of moet doen, horend bij een ZAAK of betrekking hebbend op een PRODUCT. |
| **ZAAK** | Een samenhangende hoeveelheid werk met een welgedefinieerde aanleiding en een welgedefinieerd eindresultaat, waarvan kwaliteit en doorlooptijd bewaakt moeten worden. |

### Bedrijfsobjectenmodel t.b.v. de pilot

Voor de pilot worden alleen de volgende bedrijfsobjecten meegenomen. De onderwerpen waarover de
agenda-afspraak gaat (of waarvoor de agenda-afspraak zelf een onderwerp is) zijn uit scope.

| Bedrijfsobject | Definitie |
|---|---|
| **ACTOR** | Iets dat of iemand die voor de overheidsorganisatie werkzaamheden uitvoert. |
| **AFSPRAAKLOCATIE** | De specifieke plaats waar een afspraak plaatsvindt: een fysiek bezoekadres, een online afspraak met een URL of een telefonische afspraak. |
| **AGENDA-AFSPRAAK** | Een gepland contactmoment waarop een gesproken interactie plaatsvindt tussen een burger, bedrijf of instelling en een overheidsorganisatie. |
| **PARTIJ** | Persoon of organisatie waarmee de overheidsorganisatie een relatie heeft. |

### Informatiearchitectuur

Om de MijnAgenda service te laten werken zijn verschillende componenten nodig. In de GEMMA zijn
deze opgenomen als referentiecomponenten. De Klantregistratiecomponent is nodig om de
geverifieerde e-mailgegevens uit het profiel van een inwoner te halen; die component en API zijn
geen onderdeel van de Afspraken API, maar wel nodig in het patroon en daarom als context
meegenomen.

| Element | ArchiMate-type | Definitie |
|---|---|---|
| **Afsprakenbeheercomponent** | Applicatiecomponent | Component voor het maken van afspraken tussen burgers, bedrijven en ambtenaren. |
| **Agenda-afspraak** | Dataobject | Een gepland contactmoment waarop een gesproken interactie plaatsvindt tussen een burger, bedrijf of instelling en een overheidsorganisatie. |
| **Afspraken API** | Applicatieinterface | De Afspraken API standaardiseert het opvragen van gegevens van agenda-afspraken. |
| **Bedrijf** | Actor | Een organisatie van mensen en middelen met als doel het leveren van producten of diensten. |
| **Burger** | Actor | Iedere inwoner van een land. |
| **DigiD authenticatieservice** | Applicatieservice | Applicatieservice voor het authenticeren van burgers. |
| **eHerkenning authenticatie- en machtigingenservice** | Applicatieservice | Landelijk systeem voor authenticatie van bedrijven inclusief machtigingenregister. |
| **Klanten API** | Applicatieinterface | De Klanten API standaardiseert het creëren, bijwerken, lezen en verwijderen van klantgegevens. |
| **Klantregistratiecomponent** | Applicatiecomponent | Component voor opslag en ontsluiting van klantgegevens. |
| **MijnAgenda** | Applicatieservice | Verzameling van services voor portalen en interactiecomponenten; geeft een overzicht van komende en plaatsgevonden agenda-afspraken en details van een afspraak. |
| **Mijngemeentecomponent** | Applicatiecomponent | Component die via webtechnologie veilig toegang biedt tot persoonlijke informatie en gepersonaliseerde digitale dienstverlening. |
| **Opvragen en tonen afspraken** | Applicatiefunctie | Functie voor het opvragen en tonen van agenda-afspraken. |
| **Profiel** | Dataobject | Persoonsgegevens van een klant die nodig zijn voor de communicatie met de overheidsorganisatie: contactgegevens en kanaalvoorkeuren. |

### Standaarden

MijnAgenda hanteert de volgende standaarden:

- [Nederlandse API Strategie](https://docs.geostandaarden.nl/api/API-Strategie/)
- [NLGov REST API Design Rules 2.1.0](https://gitdocumentatie.logius.nl/publicatie/api/adr/2.1.0/)
- [NL GOV Assurance profile for OAuth 2.0 v1.1.0](https://gitdocumentatie.logius.nl/publicatie/api/oauth/)
- [OpenAPI Specification 3.0](https://www.forumstandaardisatie.nl/open-standaarden/openapi-specification)
- [Digikoppeling Koppelvlakstandaard REST-API 3.0.1](https://gitdocumentatie.logius.nl/publicatie/dk/restapi/3.0.1/) (indien van toepassing)
- [Metamodel Informatiemodellering (MIM)](https://www.geonovum.nl/geo-standaarden/metamodel-informatiemodellering-mim)
- [Federatieve Service Connectiviteit (FSC)](https://fsc-standaard.nl/standaard)

### Sequentiediagrammen

De werking van de MijnAgenda service is in twee sequentiediagrammen uitgewerkt.

#### Raadplegen agenda-afspraken via Mijngemeentecomponent (in scope pilot)

Het raadplegen van de afspraken van een inwoner/ondernemer via de MijnAgenda service via een
Mijngemeentecomponent. De inwoner/ondernemer is via een sterk identificatiemiddel (DigiD of
eHerkenning) geauthenticeerd; het BSN / KvK-nummer is daarmee bekend in de Mijngemeentecomponent.

| # | Stap | Toelichting |
|---|---|---|
| 1 | Raadplegen MijnAgenda | De inwoner/ondernemer selecteert de service MijnAgenda in de Mijngemeentecomponent. |
| 2 | Vraag geverifieerde e-mailadressen | Opvragen van geverifieerde e-mailadressen van de ingelogde inwoner/ondernemer, met BSN of KvK-nummer als zoekargument. |
| 3 | Geverifieerde e-mailadressen | De set geverifieerde e-mailadressen uit het profiel wordt teruggegeven (leeg als er geen zijn). |
| 4 | `POST /afspraken/opvragen` | Opvragen van alle afspraken waarvan het e-mailadres overeenkomt met de geverifieerde e-mailadressen. POST wordt gebruikt zodat identificerende gegevens niet in de URL of logging terechtkomen. Alleen uitgevoerd als de set niet leeg is. |
| 5 | Afspraken | Alle afspraken waarvan het e-mailadres overeenkomt met de geverifieerde e-mailadressen. |
| 6 | Tonen afspraken | Tonen van alle gevonden afspraken. |
| 7 | Raadplegen specifieke afspraak | De inwoner/ondernemer vraagt optioneel de details van een afspraak op. |
| 8 | `GET /afspraken/{id}` | De details van een specifieke afspraak worden opgevraagd met de ID van de afspraak in het afsprakensysteem. |
| 9 | Afspraakdetails | Detailgegevens van de specifieke afspraak. |
| 10 | Tonen afspraakdetails | Tonen van de detailgegevens. |
| 11 | Tonen 'Geen agenda-afspraken gevonden' | Als er geen afspraken zijn gevonden, wordt dit aangegeven. |

#### Raadplegen agenda-afspraken via Relatiebeheercomponent (uit scope pilot)

Het raadplegen van afspraken via een KCC-medewerker. Via de Relatiebeheercomponent
(KCC-applicatie) worden agenda-afspraken opgehaald en getoond aan de inwoner/ondernemer. De
KCC-medewerker stelt eerst de identiteit van de inwoner/ondernemer vast; daarna kan het BSN of
KvK-nummer gebruikt worden om afspraken op te halen.

| # | Stap | Toelichting |
|---|---|---|
| 1 | Vraag naar afspraken | De inwoner/ondernemer vraagt de KCC-medewerker naar zijn agenda-afspraken. |
| 2 | Vraag identificerende gegevens | De KCC-medewerker vraagt naar identificerende gegevens om de identiteit vast te stellen. |
| 3 | Identificerende gegevens | De inwoner/ondernemer verstrekt de identificerende gegevens. |
| 4 | Raadplegen agenda-afspraken | Na vaststelling van de identiteit vraagt de KCC-medewerker de afspraken op via de Relatiebeheercomponent. |
| 5 | Vraag geverifieerde e-mailadressen | Opvragen van geverifieerde e-mailadressen, met BSN of KvK-nummer als zoekargument. |
| 6 | Geverifieerde e-mailadressen | De set geverifieerde e-mailadressen uit het profiel wordt teruggegeven (leeg als er geen zijn). |
| 7 | `POST /afspraken/opvragen` | Opvragen van afspraken waarvan het e-mailadres overeenkomt met de geverifieerde e-mailadressen. Alleen uitgevoerd als de set niet leeg is. |
| 8 | Afspraken | Alle gevonden afspraken. |
| 9–10 | Tonen afspraken | De gevonden afspraken worden getoond; de KCC-medewerker toont ze aan de inwoner/ondernemer. |
| 11 | Raadplegen specifieke afspraak | Optioneel: details van een specifieke afspraak opvragen. |
| 12 | `GET /afspraken/{id}` | De details van een specifieke afspraak worden opgevraagd. |
| 13–15 | Tonen afspraakdetails | De detailgegevens worden getoond aan de inwoner/ondernemer. |
| 16–17 | Tonen 'Geen agenda-afspraken gevonden' | Als er geen afspraken zijn gevonden, wordt dit aangegeven. |
| 18 | 'Mag geen agenda-afspraken opvragen' | Als de identiteit niet is vastgesteld, mogen geen afspraken worden opgevraagd. |

### CloudEvents

Voor dit patroon worden geen CloudEvents verstuurd.

## Informatiemodel

Het informatiemodel is uitgewerkt in Enterprise Architect en als ReSpec gedocumenteerd:

- ReSpec-repository: [VNG-Realisatie/MijnAgenda-Respec](https://github.com/VNG-Realisatie/MijnAgenda-Respec)
- Lees- en klikbaar informatiemodel: [vng-realisatie.github.io/MijnAgenda-Respec](https://vng-realisatie.github.io/MijnAgenda-Respec/)
- Feedback via [issues op de ReSpec-repository](https://github.com/VNG-Realisatie/MijnAgenda-Respec/issues)

Het informatiemodel maakt gebruik van het informatiemodel
[klantinteracties](https://vng-realisatie.github.io/klantinteracties/), een halfproduct.

### Achtergrond keuzes

- Lengte straatnaam bij adres.

## API's

De gegevens van de agenda-afspraken worden direct bij de bron (afsprakenbeheercomponent) via een
gestandaardiseerde **Afspraken API** opgevraagd.

### OAuth 2.0 Client Credentials (system-to-system)

De Afspraken API gebruikt OAuth 2.0 voor:

- **Authenticatie** van het vragende systeem (Mijngemeentecomponent, Relatiebeheercomponent, etc.).
- **Autorisatie**: is dit systeem geautoriseerd om de API te gebruiken?

De Afspraken API wordt aangeroepen door meerdere systemen (system-to-system), niet direct door
eindgebruikers. De authenticatie van de eindgebruiker vindt plaats in het vragende systeem zelf,
niet bij het afsprakenbeheercomponent. De inwoner/ondernemer is al ingelogd bij de
Mijngemeentecomponent; die haalt met een client-credentials grant een systeem-access-token op en
roept daarmee `POST /afspraken/opvragen` aan met `Authorization: Bearer {token}`.

**Voordelen**

- Eenvoudiger: geen gebruiker-specifieke tokens.
- Performance: het token kan gecachet worden door de Mijngemeentecomponent.
- Minder round-trips: geen per-gebruiker token exchange.

**Nadelen**

- Geen gebruiker-context in het token: het afsprakenbeheercomponent moet de Mijngemeentecomponent
  vertrouwen.
- Hoger risico: een gestolen systeem-token geeft toegang tot alle data.
- Audit trail: lastiger te loggen wie wat opvroeg.

**Technische overwegingen**

- Vereist: strikte validatie van de request-inhoud.
- Vereist: een vertrouwensrelatie tussen Mijngemeentecomponent en afsprakenbeheercomponent.
- Aanbevolen: mTLS voor extra systeem-authenticatie.

### Identificatie

Gebruikers worden geïdentificeerd aan de hand van **geverifieerde contactgegevens** (bijvoorbeeld
uit een dienst zoals MijnProfiel): één of meerdere e-mailadressen, in de toekomst uitbreidbaar met
andere identificatietypes. Het afspraaksysteem retourneert alle afspraken die matchen met
minimaal één van de meegegeven identificaties.

**Waarom geen querystring?** Identificatiegegevens worden niet via de querystring verstuurd, maar
via een POST request body:

| Risico querystring | Oplossing POST body |
|---|---|
| Zichtbaar in server access logs | Request body wordt niet gelogd |
| Opgeslagen in browser history | Geen URL-history |
| Zichtbaar in referer headers | Geen lekkage naar externe sites |

**Request-formaat:**

```http
POST /afspraken/opvragen
Content-Type: application/json

{
  "identificaties": [
    { "type": "email", "waarde": "gebruiker@example.nl" },
    { "type": "email", "waarde": "werk@bedrijf.nl" }
  ],
  "van": "2026-01-01T00:00:00+01:00",
  "tot": "2026-12-31T23:59:59+01:00"
}
```

| Parameter | Verplicht | Beschrijving |
|---|---|---|
| `identificaties` | Ja | Array van identificaties om op te zoeken |
| `van` | Nee | Starttijdstip-filter (inclusief) |
| `tot` | Nee | Eindtijdstip-filter (inclusief) |

**Datum/tijd-formaat:** alle datum/tijd-waarden gebruiken het ISO 8601-formaat met
timezone-offset: `YYYY-MM-DDTHH:mm:ss±HH:mm`. De timezone-offset is verplicht om onduidelijkheid
te voorkomen, met name rond zomer-/wintertijdwisselingen.

**Uitbreidbaarheid:** het identificatiesysteem is ontworpen voor uitbreiding. Nieuwe
identificatietypes kunnen worden toegevoegd zonder breaking changes. Huidig ondersteund type:
`email`.

### Afspraaksysteem API

Elk afspraaksysteem implementeert dezelfde gestandaardiseerde API, conform de NL API Strategie
naming conventions:

```
POST /afspraken/opvragen              # Zoek afspraken op basis van identificaties
GET  /afspraken/{afspraakreferentie}  # Haal details van een specifieke afspraak op
```

POST wordt gebruikt in plaats van GET omdat de identificatiegegevens niet via de URL mogen worden
verstuurd (privacy). De NL API Strategie staat dit toe voor complexe zoekopdrachten.

**Twee-staps flow:**

1. **Zoeken**: `POST /afspraken/opvragen` retourneert een lijst van afspraken met basisgegevens,
   inclusief een `afspraakreferentie` per afspraak.
2. **Details ophalen**: `GET /afspraken/{afspraakreferentie}` haalt de volledige details van één
   afspraak op.

De `afspraakreferentie` is een unieke identifier die door het afspraaksysteem wordt toegekend
(een UUID, interne ID of ander uniek kenmerk).

### Datamodel

Het datamodel voor afspraken is nog in ontwikkeling; de exacte velden worden in een latere fase
gedefinieerd.

**Vastgesteld:**

| Veld | Beschrijving |
|---|---|
| `afspraakreferentie` | Unieke identifier voor de afspraak, te gebruiken voor het ophalen van details |

**Verwacht (nog niet definitief):** titel van de afspraak; datum en tijd (begin en eind); locatie
of kanaal (fysiek, telefonisch, video); onderwerp of type dienstverlening; status (gepland,
bevestigd, geannuleerd); mee te nemen naar de afspraak.

## Informatiebeveiliging en privacy

Binnen MijnAgenda worden afspraken van inwoners en ondernemers uitsluitend getoond nadat de
gebruiker zich heeft geauthenticeerd via een sterk identificatiemiddel (zoals DigiD). Daarmee is
de identiteit ondubbelzinnig vastgesteld en is het BSN beschikbaar binnen de keten, uitsluitend
voor het doel waarvoor dit wettelijk is toegestaan. Het BSN wordt niet gebruikt om afspraken op
te vragen bij afspraaksystemen, maar uitsluitend om binnen de Profielservice van MijnProfiel de
bij die identiteit behorende, vooraf geverifieerde digitale contactgegevens te selecteren.

De Profielservice fungeert als bron voor gevalideerde contactinformatie. Alleen e-mailadressen
die aantoonbaar zijn gekoppeld aan de ingelogde persoon worden teruggegeven aan de MijnOmgeving.
De MijnOmgeving gebruikt deze e-mailadressen vervolgens als zoekparameter richting
afspraaksystemen. Afspraken die zijn vastgelegd op basis van e-mailadressen die niet als
geverifieerd zijn geregistreerd in MijnProfiel, worden expliciet niet getoond.

Vanuit AVG-perspectief is van belang dat e-mailadressen niet worden ingezet als primaire
identificator van de persoon, maar als afgeleid attribuut binnen een reeds vastgestelde
identiteitscontext. De verwerking vindt plaats op basis van **dataminimalisatie** (art. 5 lid 1
onder c AVG): er worden geen extra persoonsgegevens opgevraagd of gecombineerd die niet
noodzakelijk zijn voor het tonen van de afspraken.

Het beginsel van **doelbinding** (art. 5 lid 1 onder b AVG) wordt geborgd doordat de
e-mailadressen uitsluitend worden gebruikt voor het doel waarvoor zij binnen MijnProfiel zijn
vastgelegd. Er vindt geen hergebruik plaats voor nieuwe of onverenigbare doeleinden. De
MijnOmgeving creëert geen nieuw zelfstandig register van afspraken, maar fungeert als
weergavelaag. Het maken, wijzigen en annuleren van afspraken blijft volledig belegd bij de
afspraaksystemen zelf.

Ook vanuit **privacy by design en by default** (art. 25 AVG) is de oplossing verdedigbaar.
Afspraken worden niet automatisch aan een persoon gekoppeld op basis van aannames of impliciete
correlatie; alleen afspraken die corresponderen met vooraf geverifieerde contactgegevens worden
zichtbaar. Daardoor toont de MijnOmgeving juist minder afspraken dan theoretisch mogelijk, wat het
risico op onterechte inzage verkleint.

Een afspraak die met een onjuist e-mailadres is gemaakt, is in de huidige situatie al toegankelijk
voor de ontvanger van dat e-mailbericht via directe links vanuit het afspraaksysteem. De
MijnOmgeving introduceert in dat scenario geen additioneel privacy-risico; doordat alleen
afspraken met geverifieerde e-mailadressen worden getoond, wordt juist voorkomen dat dergelijke
afspraken zichtbaar worden.

Wel is onderkend dat een afspraak die wordt gevonden op basis van een geverifieerd e-mailadres,
niet per definitie expliciet aan de persoon is gekoppeld vanuit het bronsysteem. Dit wordt
beschouwd als een aanvaardbaar restrisico, mits duidelijk wordt gedocumenteerd dat MijnAgenda
afspraken toont die *bereikbaar zijn via geverifieerde contactgegevens* van de ingelogde
gebruiker, en niet automatisch alle afspraken die juridisch of administratief aan die persoon
toebehoren. Door deze betekenis expliciet vast te leggen, wordt voldaan aan het
**transparantiebeginsel** (art. 5 lid 1 onder a AVG).

Indien later aanvullende zekerheid gewenst is, kan binnen de MijnOmgeving een expliciete
bevestigingsstap worden toegevoegd waarmee de gebruiker een afspraak actief bevestigt als "van
mij" — zonder dat daarvoor extra persoonsgegevens hoeven te worden verwerkt of opgeslagen.

Samenvattend is de oplossing AVG-conform doordat zij uitgaat van sterke authenticatie, minimale
en doelgebonden gegevensverwerking, expliciete bronverantwoordelijkheid en het voorkomen van
impliciete correlatie.

## Beheer

- **Eigenaarschap**: de bron (het afsprakensysteem) is bronhouder van de afspraken; de
  MijnOmgeving is een weergavelaag. De MijnAgenda-standaard wordt door VNG Realisatie beheerd.
- **Lifecycle**: afspraken worden gemaakt, gewijzigd en geannuleerd in het afsprakensysteem; de
  MijnOmgeving toont uitsluitend niet-geannuleerde afspraken.
- **Informatiebeveiliging en privacy**: zie het hoofdstuk hierboven.
