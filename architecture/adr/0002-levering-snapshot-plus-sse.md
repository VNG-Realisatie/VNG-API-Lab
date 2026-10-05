# ADR-0002: Levering — snapshot + SSE-events (i.p.v. event sourcing)

- **Status:** Voorgesteld
- **Datum:** 2026-06-16
- **Context:** Uitwerking van het "Event endpoint" uit [generieke-api-strategie.md](../generieke-api-strategie.md).

## Context

De strategie stelt event sourcing met CloudEvents voor als hét leveringsmechanisme. Event sourcing als publiek, inter-organisatie-contract heeft echter zware kosten: immutable events maken schema-evolutie bruter dan API-versionering, en een append-only log botst frontaal met het AVG-recht op verwijdering (een delete-event verwijdert de al gerepliceerde PII niet).

## Beslissing

Lezen gebeurt via **snapshot + resumable SSE-`/events`**:

- **Snapshot**: `POST /zoek` of `/context` levert de begintoestand (cachebaar).
- **Tail**: één SSE-`/events`-stream levert daarna de deltas; **`Last-Event-ID` ís de cursor** (catch-up bij reconnect). Dedup op event-id.
- **Chat** is hiermee geen uitzondering meer: een gespreksbijdrage is gewoon een event met een `type` op dezelfde stream.

Event sourcing verdwijnt als publiek contract; CloudEvents verhuist naar de **ingest**-laag ([ADR-0004](./0004-ingest-cloudevents-push.md)). Verwijderen werkt via een tombstone-event + crypto-shred bij de bron/het register; omdat de aggregator geen record-of-truth bewaart, propageert het schoon.

## Alternatieven overwogen

- **Publiek event-sourced log.** Verworpen: AVG-verwijdering, schema-evolutie, replay-complexiteit.
- **Polling-only (`feed?since=cursor`).** Werkt, maar te traag/duur voor realtime (chat). SSE met `Last-Event-ID` verenigt polling-catch-up en realtime in één primitief.
- **WebSocket overal.** Zwaarder en bidirectioneel; niet nodig — schrijven is een aparte command-POST.

## Gevolgen

**Positief**
- Eén leveringsmodel voor delta-sync én realtime; chat wordt een non-special-case.
- "1 request, alle live updates" als heel het leesmodel.
- Betrouwbaar verwijderen wordt mogelijk (tombstone + shred).

**Negatief / risico's**
- Long-lived SSE-connecties schalen anders dan request/response (streaming-infra nodig).
- Auth mid-stream (tokenverloop) vereist her-auth zonder de stream te droppen.
- Een gemultiplexte multi-bron-stream heeft alleen *arrival order*, geen globale totale ordening.
- Cold start vereist een snapshot; een pure tail mist historie.

## Bouwblok

[`patterns/sync-feed`](../../patterns/sync-feed/next.yaml) levert de snapshot- en
cursorbouwstenen uit dit besluit als herbruikbare OpenAPI-fragmenten. Dat patroon
adresseert ook het AVG-bezwaar uit dit besluit: het kent een expliciete
`redact`-operatie, waarmee een log redigeerbaar wordt en gaten in de reeks
benoemd worden in plaats van stil te blijven. Zie ook
[ADR-0007](./0007-open-data-publicatie-pull-feed.md), dat voor open data de
pull-feed als primaire route kiest en de stream optioneel maakt.

## Relatie tot de strategie

Behoudt het idee van events/CloudEvents, maar verschuift het van "event sourcing als leescontract" naar "snapshot + SSE voor lezen, CloudEvents voor ingest".
