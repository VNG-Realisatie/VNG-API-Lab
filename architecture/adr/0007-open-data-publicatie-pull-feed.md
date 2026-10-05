# ADR-0007: Open data — publicatie via pull-feed (afbakening van ADR-0004)

- **Status:** Voorgesteld
- **Datum:** 2026-07-30
- **Context:** [ADR-0004](./0004-ingest-cloudevents-push.md) schrijft voor dat bronnen data aanleveren door CloudEvents te POSTen. Dat besluit is genomen voor de burger-keten. De vraag is of het ook geldt wanneer de gegevens openbaar zijn en er geen burger aan hangt.

## Context

ADR-0004 lost een reëel probleem op: een producer die aan n consumers moet leveren, moet per consument bijhouden wat is aangekomen en wat opnieuw moet — retry-hel en gaten in data. Eén idempotent aanleverpunt haalt die last weg.

Die redenering hangt aan drie aannames die bij open data geen van drieën gelden:

1. **Er is een autorisatievraag.** ADR-0004 draagt `betrokkene` mee als ABAC-attribuut en vereist ondertekening (JWS) over mTLS, omdat de ontvanger moet kunnen bepalen wie wat mag zien. Bij openbare gegevens — Woo-publicaties, raadsinformatie, besluiten — is er niets af te schermen.
2. **De producer draagt afleverlast.** Bij push is dat waar. Bij pull niet: een bron die een feed serveert, houdt geen consumentenlijst bij, kent geen mislukte afleveringen en heeft dus geen outbox of retry-worker nodig. Het alternatief "pure pull" wordt in ADR-0004 afgewezen omdat het "de retry/consistentie-last bij elke producer legt" — voor een pull-feed is het omgekeerde waar.
3. **Het aantal afnemers is bekend en begrensd.** Bij open data is dat per definitie niet zo: journalisten, onderzoekers, andere overheden, commerciële partijen. Elke consument vooraf laten registreren of via een centraal punt laten lopen, is precies wat je bij open data niet wil.

Daar komt een ervaringsfeit bij. De aanlever-route voor Woo-publicaties is één keer gestrand: het [BIT-advies over PLOOI](https://www.adviescollegeicttoetsing.nl/site/binaries/site-content/collections/documents/2022/11/28/bit-advies-plooi/BIT-advies+Platform+Open+OverheidsInformatie.pdf) (28-11-2022) concludeerde dat de gekozen oplossing leunde op een standaard die overheden moeilijk kunnen volgen, en dat een herontwerp nodig was met **minimale aansluitlast** voor overheidsorganisaties. Een bron die één feed publiceert heeft die last één keer; een bron die per landelijke voorziening een aanleverintegratie bouwt, telkens opnieuw.

## Beslissing

**Voor openbare gegevens publiceert de bron een pull-feed; afnemers halen op en aggregeren zelf.** ADR-0004 (CloudEvents-push) blijft gelden voor gegevens met een autorisatievraag — burgergebonden data met ABAC — en niet voor publicatie van open data.

Concreet:

- De bron biedt een **snapshot + cursor-feed** aan volgens [`patterns/sync-feed`](../../patterns/sync-feed/next.yaml).
- De bron levert **niet aan** bij een centrale voorziening. Een landelijke voorziening die een totaalbeeld wil, is een afnemer als alle andere.
- **Aggregatie is een expliciete rol**: een afnemer mag meerdere feeds samenvoegen en het resultaat als weer een feed volgens hetzelfde patroon publiceren. Zo hoeft niemand langs honderden bronnen, zonder dat er een verplichte tussenpartij ontstaat.
- **Vindbaarheid loopt via discovery, niet via aanlevering**: een feed registreert zich in het manifest uit [`apis/rest/discovery`](../../apis/rest/discovery/next.yaml), en een landelijk register houdt feedlocaties bij — metadata, geen inhoud. Dat is de rol die [ADR-0006](./0006-per-domein-registers.md) al aan VNG/Logius toekent.

## Alternatieven overwogen

- **ADR-0004 ongewijzigd toepassen op open data.** Verworpen: voegt een aanleverintegratie, een PKI-afsprakenstelsel en een centrale schakel toe aan een keten die geen van drieën nodig heeft, en maakt de dekking van élke hergebruiker afhankelijk van die schakel.
- **Beide toestaan, bron kiest.** Aantrekkelijk, maar dan moet elke afnemer beide paden ondersteunen en is het per bron onduidelijk waar de waarheid vandaan komt. Eén route per gegevenssoort is goedkoper voor de hele keten.
- **Push naar afnemers via webhooks.** Verworpen om dezelfde reden als in ADR-0004: de producer moet dan alsnog een consumentenlijst en retry-logica bijhouden — bij een onbekend en groeiend aantal open-data-afnemers is dat het slechtste van beide werelden.

## Gevolgen

**Positief**

- Aansluitlast bij de bron is eenmalig en onafhankelijk van het aantal afnemers.
- Geen schakel waarop de hele keten kan stilvallen; een storing blijft lokaal.
- Sluit aan op [ADR-0001](./0001-federatief-geen-centrale-kluis.md) (data bij de bron) en op de rolverdeling uit [ADR-0006](./0006-per-domein-registers.md).
- Een geleidelijke overgang is mogelijk: een aggregator gebruikt per organisatie een feed zodra die bestaat, en tot die tijd de bestaande route. Er is geen moment waarop de hele keten tegelijk om moet.

**Negatief / risico's**

- Een bron die zijn feed slecht beschikbaar houdt, is voor iedereen slecht beschikbaar; er is geen centrale voorziening die dat opvangt. Mitigatie: aggregatoren zijn er, en `laatstBijgewerkt` in het servicedocument maakt achterstand zichtbaar in plaats van stil.
- Zonder discovery is een federatie van feeds onvindbaar. Dit besluit leunt dus op het discovery-manifest; zonder register is de praktische bruikbaarheid beperkt tot wie de bron al kent.
- Pollen is niet realtime. Voor open data is dat zelden bezwaarlijk; is het dat wel, dan kan een bron optioneel een stream aanbieden ([ADR-0002](./0002-levering-snapshot-plus-sse.md)) bovenop — nooit in plaats van — de feed.
- De grens "openbaar vs. autorisatievraag" moet per gegevenssoort worden getrokken. Bij twijfel geldt ADR-0004.

## Relatie tot de strategie

Bakent ADR-0004 af in plaats van het te vervangen: push voor gegevens met een autorisatievraag, pull voor publicatie van open data. Daarmee wordt "data bij de bron" ([ADR-0001](./0001-federatief-geen-centrale-kluis.md)) ook waar voor de openbaarmakingsketen, en krijgt een landelijke voorziening dezelfde rol als in [ADR-0006](./0006-per-domein-registers.md): afsprakenstelsel en wegwijzer, niet de data.
