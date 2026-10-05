# ADR-0004: Ingest — CloudEvents-push, idempotent & ondertekend

- **Status:** Voorgesteld
- **Datum:** 2026-06-16
- **Context:** Hoe leveranciers data leveren; uitwerking van het sync-probleem uit [generieke-api-strategie.md](../generieke-api-strategie.md).

## Context

De strategie signaleert dat de huidige REST-API's geen betrouwbare sync hebben: per object een POST, met retry-verantwoordelijkheid bij de producer, die moet bijhouden wat mislukt is en wat elke consumer al heeft. Dat is foutgevoelig en remt adoptie.

## Beslissing

Leveranciers leveren door **CloudEvents te POSTen met een JSON-Schema-payload als `data`**:

- `id` = idempotency-sleutel (retry is veilig; ontvanger de-dupliceert).
- `source` = provenance (wie beweert dit); `subject` = resource-URI; `type` = created/updated/deleted.
- `betrokkene` = ABAC-attribuut (wie mag lezen).
- Ondertekend (JWS/cert) over mTLS. Aan producerzijde: **outbox + retry-worker**.

Dit kan naar een **self-hosted** lees-API óf naar een **per-domein register** ([ADR-0006](./0006-per-domein-registers.md)). In beide gevallen levert de bron **één keer, aan één endpoint, at-least-once + idempotent** — geen lijst van consumers bijhouden. Dat lost het kernprobleem uit de strategie op.

## Alternatieven overwogen

- **Producer serveert alle consumers rechtstreeks (pure pull).** Werkt voor grote partijen, maar legt de retry/consistentie-last bij elke producer.
- **Geen envelop, kale resource-POST.** Verliest idempotency/provenance/ordening; CloudEvents geeft die gratis.

## Gevolgen

**Positief**
- Eén idempotent sync-punt per bron; "gaten in data" en retry-hel verdwijnen.
- Provenance + ondertekening maken betrouwbaar verwijderen mogelijk (alleen de bewerende bron mag tombstonen).
- CloudEvents op de juiste laag (ingest-envelop), gekoppeld aan JSON-Schema-semantiek.

**Negatief / risico's**
- Kleine leveranciers moeten alsnog outbox + retry bouwen (minder dan een query-API, niet nul).
- Vereist een PKI/ondertekening-afsprakenstelsel.

## Bouwblok

De CloudEvents-envelop staat in [`schemas/events`](../../schemas/events/v0.0.1.json),
inclusief `sequence`/`sequencetype` en `dataref` (verwijzing in plaats van inline
inhoud).

**Reikwijdte:** dit besluit geldt voor gegevens met een autorisatievraag.
Voor publicatie van open data is het afgebakend door
[ADR-0007](./0007-open-data-publicatie-pull-feed.md).

## Relatie tot de strategie

Lost het expliciet benoemde sync-/dataverlies-probleem op, en geeft CloudEvents een concrete, verdedigbare rol (ingest i.p.v. publiek leescontract).
