# Architectural Decision Records

Een ADR legt één architectuurkeuze vast: wat is besloten, waarom, welke
alternatieven zijn verworpen en wat de gevolgen zijn. Eén bestand per
beslissing, genummerd, en achteraf niet meer inhoudelijk gewijzigd — een nieuw
inzicht wordt een nieuwe ADR die de oude vervangt (status `Vervangen door
ADR-XXXX`).

Het punt is dat de *redenering* bewaard blijft. Zonder ADR weet over twee jaar
niemand meer waarom er geen centrale kluis is, en komt dat voorstel gewoon
opnieuw langs — of erger, iemand breekt de keuze zonder te weten wat eraan hing.
Het blok "Alternatieven overwogen" is daarom het waardevolste deel: daar staat
wat er níet is gekozen en waarom, en dat is precies wat je nodig hebt als de
context verandert.

## Overzicht

De ADR's hangen samen in [`referentie-architectuur.md`](../referentie-architectuur.md),
dat ze per laag aanhaalt. Deze tabel geeft de andere ingang: van beslissing naar
het herbruikbare bouwblok dat eruit volgt.

| ADR | Beslissing | Status | Bouwblok |
| --- | --- | --- | --- |
| [0001](./0001-federatief-geen-centrale-kluis.md) | Federatief — geen centrale kluis | Voorgesteld | — (richtinggevend; werkt door in 0005 en 0007) |
| [0002](./0002-levering-snapshot-plus-sse.md) | Levering: snapshot + resumable SSE | Voorgesteld | [`patterns/sync-feed`](../../patterns/sync-feed/next.yaml) (snapshot- en cursorbouwstenen) |
| [0003](./0003-begrensde-query-grammatica.md) | Begrensde query-grammatica i.p.v. ElasticSearch-DSL | Voorgesteld | [`patterns/sync-feed`](../../patterns/sync-feed/next.yaml) (de cursor-paginering die deze ADR voorschrijft) |
| [0004](./0004-ingest-cloudevents-push.md) | Ingest: CloudEvents-push, idempotent & ondertekend | Voorgesteld | [`schemas/events`](../../schemas/events/v0.0.1.json) |
| [0005](./0005-dunne-gateway-client-side-aggregatie.md) | Dunne token/CORS-gateway + client-side aggregatie | Voorgesteld | [`patterns/federated-auth`](../../patterns/federated-auth/next.yaml) |
| [0006](./0006-per-domein-registers.md) | Per-domein registers & governance | Voorgesteld | [`apis/rest/discovery`](../../apis/rest/discovery/next.yaml) (verwijsindex) |
| [0007](./0007-open-data-publicatie-pull-feed.md) | Open data: publicatie via pull-feed (bakent 0004 af) | Voorgesteld | [`patterns/sync-feed`](../../patterns/sync-feed/next.yaml) |

Patronen zonder ADR — er ligt geen architectuurbesluit aan ten grondslag, ze
zijn overgenomen uit bestaande conventies:

| Patroon | Herkomst | Let op |
| --- | --- | --- |
| [`patterns/pagination`](../../patterns/pagination/0.0.1.yaml) | ZGW-conventie (`page`/`pageSize`/`count`) | ADR-0003 schrijft cursor-paginering voor; voor endpoints waar een afnemer een kopie bijhoudt geldt [`patterns/sync-feed`](../../patterns/sync-feed/next.yaml) |
| [`patterns/error-responses`](../../patterns/error-responses/v0.0.1.yaml) | Landelijke API-strategie | Verwijst nog naar RFC 7807; actueel is RFC 9457 (zie [`apis/FEEDBACK.md`](../../apis/FEEDBACK.md), rode draad 4) |
| [`patterns/file-upload`](../../patterns/file-upload/next.yaml) | Two-step pre-signed upload, praktijkpatroon | — |

## Conventie: ADR ↔ patroon

Een ADR beschrijft het **waarom**, een patroon het herbruikbare **hoe**. Ze
horen naar elkaar te verwijzen, zodat je vanaf een OpenAPI-fragment de
onderbouwing terugvindt en vanaf een besluit het bouwblok.

- Een patroon dat uit een ADR volgt, opent met een commentaarregel
  `# Implementeert: ADR-XXXX (…)`.
- Een patroon zonder ADR benoemt zijn herkomst in één regel, zodat "geen ADR"
  een keuze is en geen omissie.
- Deze index is de autoritatieve afbeelding tussen beide. Reeds uitgebrachte
  patroonversies (`vX.Y.Z.yaml`) worden er niet meer voor aangepast; nieuwe
  verwijzingen landen in `next.yaml` of hier.

## Een nieuwe ADR schrijven

Nummer oplopend, bestandsnaam `NNNN-korte-titel.md`, en dit stramien:

```markdown
# ADR-NNNN: Titel

- **Status:** Voorgesteld | Geaccepteerd | Vervangen door ADR-XXXX
- **Datum:** JJJJ-MM-DD
- **Context:** één regel — waar komt deze vraag vandaan

## Context
Wat speelt er, welke vraag moet beantwoord worden, welke krachten spelen mee.

## Beslissing
Wat is gekozen. Actief geformuleerd, zonder slagen om de arm.

## Alternatieven overwogen
Per alternatief: wat het was en waarom het is afgevallen.

## Gevolgen
**Positief** — wat dit oplevert.
**Negatief / risico's** — eerlijk, inclusief wat je ervoor inlevert.

## Relatie tot de strategie
Hoe dit zich verhoudt tot de referentiearchitectuur en aangrenzende ADR's.
```

Volgt er een herbruikbaar bouwblok uit? Voeg dat als patroon toe onder
`patterns/`, verwijs heen en weer, en zet de regel in de tabel hierboven.
Zie [`CONTRIBUTING.md`](../../CONTRIBUTING.md) voor het bredere proces.
