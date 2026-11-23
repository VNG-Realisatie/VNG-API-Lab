# ADR-0008: Webhook als seintje bij de eventstroom

- **Status:** Voorgesteld
- **Datum:** 2026-11-23
- **Context:** Maykin (Open Inwoner) vroeg in het MijnGesprekken-overleg van 23 november om webhooks in plaats van een open SSE-verbinding.

## Context

[ADR-0002](./0002-levering-snapshot-plus-sse.md) levert wijzigingen als snapshot plus een SSE-stroom. Een afnemer moet daarvoor een verbinding open houden. Voor een portal die alleen een webserver draait (zoals Open Inwoner, Django zonder ASGI) betekent dat een apart achtergrondproces dat de stroom volgt. Zo'n portal ontvangt nu al ZGW-notificaties via een webhook en wil dat liever zo houden.

[ADR-0004](./0004-ingest-cloudevents-push.md) en [ADR-0007](./0007-open-data-publicatie-pull-feed.md) wijzen push naar afnemers af: de bron moet dan een lijst met afnemers en retry-logica bijhouden, en een gemist bericht is een gat in de data.

## Beslissing

Een API met `/events` mag daarnaast webhooks aanbieden, als **seintje**, niet als tweede kanaal:

- Een afnemer registreert een abonnement (`POST /abonnementen`) met een callback-URL en een filter. Het filter volgt de autorisatie van `/events`.
- Bij een wijziging POST de bron een kort, ondertekend bericht (Standard Webhooks) met de cursor en verwijzingen, zonder inhoud.
- De afnemer haalt de events zelf op via `GET /events` met `Last-Event-ID`. De cursor is de waarheid: een gemist seintje wordt bij het volgende seintje ingehaald.
- Retry is begrensd (24 uur); daarna pauzeert het abonnement en haalt de afnemer bij herstel alles in via de stroom.

Het herbruikbare bouwblok is [`patterns/webhook`](../../patterns/webhook/next.yaml).

## Alternatieven overwogen

- **Alleen SSE (ADR-0002 ongewijzigd).** Werkt, maar dwingt elke afnemer een langlopend proces af. Remt adoptie bij portals die nu al met webhooks werken.
- **Volledige events via webhook, zonder stroom.** Dan moet de bron elke levering garanderen en bijhouden wat elke afnemer heeft: precies het probleem uit ADR-0004.
- **ZGW Notificaties API.** Bestaat al, maar zonder CloudEvents, zonder cursor en zonder ondertekening; een adapter kan events omzetten, buiten de specificatie.

## Gevolgen

**Positief**
- Afnemers kiezen: open verbinding (SSE), webhook-seintje of pollen, met één eventmodel en één cursor.
- Retry kan simpel blijven, omdat de cursor gaten opvangt.
- Geen inhoud of persoonsgegevens in webhookberichten; autorisatie blijft bij `/events`.

**Negatief / risico's**
- De bron beheert abonnementen, geheimen en een bezorgwachtrij.
- Een extra aanroep per seintje (`GET /events`) voor de afnemer.
- `modus: volledig` is toegestaan voor gemak, maar haalt een deel van de nadelen terug.

## Relatie tot de strategie

Bakent ADR-0004 af zoals ADR-0007 dat doet: push naar afnemers blijft afgewezen als *gegevenskanaal*, maar is toegestaan als *wekker* bij de pull-stroom van ADR-0002.
