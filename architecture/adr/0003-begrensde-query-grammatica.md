# ADR-0003: Begrensde query-grammatica (i.p.v. ElasticSearch-DSL)

- **Status:** Voorgesteld
- **Datum:** 2026-06-16
- **Context:** Uitwerking van het "Query endpoint" uit [generieke-api-strategie.md](../generieke-api-strategie.md).

## Context

De strategie stelt één "ElasticSearch-compatible" query-endpoint voor met krachtige, vrije zoekmogelijkheden. Een publiek, arbitrair query-endpoint als overheidsstandaard heeft echter drie problemen: het koppelt aan een specifieke vendor-DSL (Elastic, met beladen licentiegeschiedenis), het is de moeilijkste autorisatie-casus die bestaat (ABAC over willekeurige queries, inclusief aggregaties), en het is een availability- (DoS) en data-exfiltratie-surface.

## Beslissing

Elke resource biedt `POST /zoek` met een **begrensde, gedeelde query-grammatica**: veld-`eq`/`in`/`range`, `sort`, full-text `q`, en cursor-paginering. Geen arbitraire DSL. Begrensd = beveiligbaar, ABAC-baar (`betrokkene = burger` query-time), en implementeerbaar door een junior leveranciersteam.

Domein-specifieke views (WOZ, Parkeren, Belasting) zijn **query-templates** bovenop deze grammatica — geen extra werk voor leveranciers, geen nieuwe API's.

## Alternatieven overwogen

- **Arbitraire ElasticSearch-DSL.** Verworpen: vendor-koppeling, onhoudbare autz, DoS/exfiltratie.
- **GraphQL.** Sterk alternatief (getypeerd, veldselectie = `include`); reëel te overwegen, maar per-veld-autz en query-cost/DoS blijven lastig en het is een grotere conceptuele sprong voor leveranciers. Bewaard als optie.
- **Per-model bespoke filters (status quo).** Verworpen: inconsistent, grote specs, gaten in zoekmogelijkheden.

## Gevolgen

**Positief**
- Beveiligbaar en ABAC-baar; lage implementatiedrempel.
- Eén zoekpatroon over alle resources; domein-views zonder leverancierswerk.

**Negatief / risico's**
- Dekt niet elke exotische zoekvraag — bewust geaccepteerd; gecontroleerd uitbreidbaar.
- Full-text over de hele dataset blijft een aandachtspunt voor privacy/ABAC.

## Bouwblok

De cursor-paginering die dit besluit voorschrijft staat als herbruikbaar
fragment in [`patterns/sync-feed`](../../patterns/sync-feed/next.yaml). Let op dat
[`patterns/pagination`](../../patterns/pagination/0.0.1.yaml) nog `page`/`pageSize`
gebruikt en dus niet aan dit besluit voldoet.

## Relatie tot de strategie

Behoudt het generieke query-idee en de domein-templates, maar begrenst de grammatica i.p.v. een vrije Elastic-DSL te standaardiseren.
