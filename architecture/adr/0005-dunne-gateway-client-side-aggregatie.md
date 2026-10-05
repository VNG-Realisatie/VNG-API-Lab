# ADR-0005: Dunne token/CORS-gateway + client-side aggregatie

- **Status:** Voorgesteld
- **Datum:** 2026-06-16
- **Context:** Hoe de burger "alles op één plek" ziet zonder slimme/centrale BFF.

## Context

"Eén overzicht" suggereert een Backend-for-Frontend die alle bronnen aggregeert. Maar aggregatie (mergen) is pure client-logica en heeft geen server nodig. De vraag is welke functies écht serverside moeten.

## Beslissing

Het **samenvoegen gebeurt client-side**. Serverside blijft alleen een **dunne, transparante gateway** met twee taken:

1. **Token-handling** — OAuth-tokens buiten de browser houden (cookie tussen browser↔gateway), token-exchange per bron als confidential client. Conform de OAuth-best-practice voor browser-apps; voorkomt dat één XSS alle overheidstokens steelt.
2. **CORS / bron-facing proxy** — zodat niet elke overheid elke MijnOmgeving-origin in CORS hoeft toe te laten.

Géén business-logica, géén merge, géén persistente opslag in de gateway. Pseudoniem-vertaling (BSN→bron) hoort ook hier of in een stelseldienst — niet in de browser.

## Alternatieven overwogen

- **Slimme aggregerende BFF.** Verworpen als default: trust-concentratie en stateful; niet nodig voor aggregatie.
- **Puur client-side (geen server).** Maximaal privacy (niemand ziet ooit het geaggregeerde geheel), maar tokens-in-browser (XSS-risico), N losse SSE-connecties, geen adapters/cache, en elke bron moet CORS + directe browser-traffic aankunnen. Verdedigbaar bij weinig, coöperatieve bronnen.
- **Persoonlijke agent / wallet (Solid-pod, EU Digital Identity Wallet).** De zuiverste decentrale variant: de burger aggregeert via een eigen component. Noordster; eigen adoptietraject.

## Gevolgen

**Positief**
- Behoudt de decentrale elegantie; geen slimme/centrale BFF.
- Tokens veilig buiten de browser; CORS opgelost op één plek.

**Negatief / risico's**
- De gateway concentreert nog steeds toegang (zij het zonder merge/opslag) → ABAC óók bij de bron, verwerkingslogging, meerdere gateways i.p.v. één nationale.
- Pure-client blijft alleen haalbaar bij beperkte, CORS-coöperatieve bronnen.

## Bouwblok

[`patterns/federated-auth`](../../patterns/federated-auth/next.yaml) legt de
OAuth2-bouwstenen vast waarmee een API rechtstreeks door een publieke client kan
worden aangeroepen — de contractkant van dit besluit.

## Relatie tot de strategie

Vult een laag in die de strategie niet behandelde (hoe komt het samen voor de burger), consistent met OIDC-NLGOV en ABAC.
