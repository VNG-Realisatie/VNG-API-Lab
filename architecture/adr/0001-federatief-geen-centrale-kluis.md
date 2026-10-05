# ADR-0001: Federatief — geen centrale kluis

- **Status:** Voorgesteld
- **Datum:** 2026-06-16
- **Context:** Uitwerking van [generieke-api-strategie.md](../generieke-api-strategie.md) voor de keten "burger logt in bij MijnOverheid".

## Context

De strategie zweeft tussen twee modellen: "consumers halen CloudEvents op bij de bron" (federatief) en een generieke, centraal aanvoelende API. Voor de burger-keten moet expliciet gekozen worden waar de data van de burger samenkomt.

## Beslissing

**Data blijft bij de bron (federatief).** Er komt geen nationale datakluis met alle burgerdata. De "één plek voor de burger" wordt opgelost in de **lees-laag** (aggregatie op moment van opvragen), niet in opslag. Een aggregator mag meervoudig bestaan (per MijnOmgeving), is nooit record-of-truth, en persisteert hooguit een korte TTL-cache.

## Alternatieven overwogen

- **Centrale hub/datakluis per burger.** Verworpen: honeypot, single point of failure, governance-vacuüm, en in strijd met Common Ground ("data bij de bron").
- **Volledig peer-to-peer zonder enige aggregator.** Zie [ADR-0005](./0005-dunne-gateway-client-side-aggregatie.md) — aggregatie kan client-side, maar security/CORS dwingen een dunne gateway af.

## Gevolgen

**Positief**
- Geen nationale honeypot; databreach-impact blijft per bron begrensd.
- Sluit aan op Common Ground / Federatief Datastelsel.
- Bron blijft autoritatief; verwijderen propageert schoon (zie [ADR-0002](./0002-levering-snapshot-plus-sse.md)).

**Negatief / risico's**
- Latency hangt aan de traagste relevante bron (gemitigeerd door parallelle fan-out + per-domein status + korte cache).
- Federatie over heterogene bronnen vereist een discovery/verwijsindex en, voor legacy, adapters.
- Een cache blijft een kopie — bewust begrensd (korte TTL, crypto-shred), geen replica-of-record.

## Bouwblokken

Dit besluit is richtinggevend en heeft geen eigen patroon; het werkt door in
[ADR-0005](./0005-dunne-gateway-client-side-aggregatie.md) (lees-laag) en
[ADR-0007](./0007-open-data-publicatie-pull-feed.md) (publicatie van open data).

## Relatie tot de strategie

Maakt de impliciete "bij de bron"-lijn expliciet en kiest die boven het centrale leesmodel.
