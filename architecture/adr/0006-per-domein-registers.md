# ADR-0006: Per-domein registers & governance

- **Status:** Voorgesteld
- **Datum:** 2026-06-16
- **Context:** Wie beheert de registers waar bronnen naartoe pushen ([ADR-0004](./0004-ingest-cloudevents-push.md))?

## Context

Niet elke leverancier kan een queryable + SSE-capabele lees-API draaien. Sommige bronnen pushen daarom naar een register dat dat contract namens hen aanbiedt. De vraag is wie dat register beheert — en hoe je voorkomt dat dit een nieuwe centrale eigenaar of honeypot wordt.

## Beslissing

**De operator volgt de bestaande bron-autoriteit; bouw geen nieuwe register-eigenaar; centraliseer alleen waar de wet de bron al centraliseert.** Twee rollen worden gescheiden:

- **Verantwoordelijke (bronhouder)** = de wettelijk verwerkingsverantwoordelijke (gemeente, Belastingdienst, waterschap, RvIG, Waarderingskamer). Volgt het mandaat.
- **Operator (verwerker)** = wie het draait: meestal de **zaaksysteem-/vakapplicatie-leverancier** (namens de gemeente), een **bestaande landelijke voorziening** (LV WOZ, BRP/Haal Centraal), of een **samenwerkingsverband/GR** (belastingsamenwerkingen zoals SVHW, Cocensus, BghU, GBLT).

Registers zijn **per domein gesharded**, nooit één nationale alle-burgerdata-pool. Multi-bron domeinen (bv. "verplichtingen") worden **niet** centraal gepoold maar **op leestijd geaggregeerd** ([ADR-0001](./0001-federatief-geen-centrale-kluis.md)).

**VNG/Logius beheert het afsprakenstelsel + de verwijsindex/discovery (metadata, geen inhoud) — niet de data.** Dit sluit aan op het Federatief Datastelsel.

## Alternatieven overwogen

- **Eén nationaal register/kluis.** Verworpen: honeypot, governance-vacuüm.
- **VNG/Logius beheert de data.** Verworpen: trust-concentratie; hun rol is standaard + wegwijzer.
- **Elke gemeente bouwt zelf.** Onrealistisch; ingevuld via vendor of GR/coöperatie, met verantwoordelijkheid bij de gemeente.

## Gevolgen

**Positief**
- Hergebruikt bestaande autoriteiten en voorzieningen; minimaal nieuw te bouwen.
- Honeypot blijft per domein begrensd en verdeeld.

**Negatief / risico's**
- **Vendor lock-in** bij zaaksysteem-leveranciers als operator — antigif: uniform contract + dataportabiliteit + certificering + aanbestedings-eisen (GIBIT). Blijft een bestuurlijke lever.
- Per-domein trust-concentratie en SLA/aansprakelijkheid blijven governance-vragen.
- Financiering/duurzaamheid van de gedeelde componenten (discovery, conformance) is een bestuurlijk besluit.

## Bouwblok

De verwijsindex uit dit besluit is uitgewerkt in
[`apis/rest/discovery`](../../apis/rest/discovery/next.yaml): een manifest met per
service `baseUrl` en `specUrl`, zonder inhoud.

## Relatie tot de strategie

Voegt de governance-laag toe die de strategie niet behandelde, en houdt vast aan "data bij de bron".
