# API-feedback (next-versies)

Feedback op de `next`-versies van de Interactie-API's, verzameld door de
NLDS-ARK-demo erop te laten draaien (mock via Prism op de mock-gateway). Per API:
mock-gereedheid, inconsistenties, onnodige complexiteit en geprioriteerde fixes.

> Status: levend document. "✅ toegepast" = fix is in de spec verwerkt;
> de rest is feedback voor de API-eigenaren.

## Rode draden (alle next-API's)

1. **Auth blokkeert elke mock-call.** `security: bearerAuth` op spec-niveau zorgt
   dat Prism zónder `Authorization`-header altijd **401** geeft — óók met
   `Prefer: code=200`. Een frontend-/integratie-dev denkt dan dat de mock stuk is.
   → De demo-client stuurt nu altijd een dummy `Authorization: Bearer …` mee;
   overweeg dit te documenteren ("stuur een willekeurige bearer naar de mock").
2. **Error-responses zijn placeholder-garbage.** Het gedeelde `Fout`-schema
   (`schemas/fout/v0.0.1.json`) heeft geen voorbeelden, dus Prism vult
   `{"type":"../dictionary","code":"string","status":100,…}` in. `status:100`
   klopt nooit met de HTTP-code. → Voeg **per response** een `example` toe met de
   juiste `status` (404 → status 404, 401 → status 401). Een enkel gedeeld
   voorbeeld lost dit niet op (status zou altijd hetzelfde zijn).
3. **`Prefer: dynamic=true` is onbruikbaar.** Door `x-extensible-enum` (geen
   standaard keyword) en vrije string-generatie krijg je lorem-ipsum-statussen,
   datums uit 1911, en zelfs onmogelijke combinaties (fysiek+online tegelijk).
   → Frontend gebruikt **static examples** (`Prefer: code=200`), niet `dynamic`.
4. **RFC-referentie verouderd.** `Fout` noemt **RFC 7807**; actueel is **RFC 9457**
   (inhoudelijk identiek). → Referentie bijwerken.
5. **Paginering ontbreekt of is inconsistent.** taken/producten/agenda hebben geen
   paginering; gesprekken heeft er juist **drie tegelijk** (`count/next/previous`
   + `page/pageSize` + `X-Total-Count`). → Kies één conventie, voeg toe vóór
   productie (achteraf toevoegen breekt clients).
6. **Identifier-conventies lopen door elkaar** binnen één API: `uuid` (formaat als
   veldnaam), `code` (slug), `urn`, en losse opaque strings. → Eén conventie;
   gebruik `id` als veldnaam met `format: uuid`.
7. **NL/EN-mix.** Veldnamen NL, `operationId`'s mengen NL/EN (`zoekContext` vs
   `retrieveTaak`, `zoekProducten` vs `listProducttypen`). → Eén taal voor
   operationId-werkwoorden.
8. **`allOf: [ $ref ]`-wrappers** om één `$ref` (puur om een `description` toe te
   voegen) komen overal voor. In OpenAPI 3.1 mag `$ref` + sibling `description`
   direct → wrappers overbodig.
9. **CORS-blokkade op `Prefer` / `prefer` header.** Voor lokale mock-integratie stuurt de frontend vaak `Prefer: code=200` of `Prefer: dynamic=true` mee om Prism-gedrag te sturen. Als de gateway/mock-server deze headers niet expliciet toestaat in `Access-Control-Allow-Headers`, blokkeert de browser de preflight (OPTIONS) request.
   → Opgelost in de lokale mock-gateway (`scripts/mock-all.js`). **Let op:** de gedéployde mock (`vng-interactie-mocks.fly.dev`) staat `Prefer` nog NIET toe — preflight geeft `Access-Control-Allow-Headers: Content-Type, Authorization, Accept` (geverifieerd). Een browser-app die cross-origin met `Prefer` praat, krijgt daar dus 0 responses. → Voeg `Prefer` toe aan de CORS-config van de deploy.
10. **List-responses hebben vier verschillende envelopes.** Bij het uitlezen van de zoek-/lijst-endpoints retourneert elke API een andere vorm: **producten** en **zaken** geven een kale array; **taken** wrapt in `{ taken: […] }`; **agenda** in `{ afspraken: […] }`; **gesprekken** in een generieke `{ results: […] }`. Een client moet dus per API anders uitpakken. → Kies één envelope-conventie (bv. altijd `{ results: […] }` met paginering-metadata ernaast, zie #5, óf altijd een kale array — maar niet door elkaar).

---

## taken/next (MijnTaken)

**Omgezet naar het gedeelde skelet (5 oktober 2026), ✅ toegepast:**
- `POST /context/zoek` met `klantId` en `include` vervangen door `GET /taken` met filters
  `context` (URN), `status` en paginering, envelop `{count, next, previous, results}`.
- Burger uit het token (`patterns/federated-auth`, scope `taken:lezen`); andermans taak geeft `403`.
- Genest `allOf` in `Taak` opgeheven: `uitvoering.definitie` is een optioneel veld van
  `UitvoeringBeknopt`. (Respect keurde een detailrespons met `definitie` anders af.)
- Detailvoorbeeld toegevoegd dat overeenkomt met het eerste overzichtsvoorbeeld.
- Gedrag getest met `aansluitprofielen/mijntaken/mijntaken-next.arazzo.yaml`, inclusief
  "taken bij zaak" via de URN uit MijnZaken.

Hieronder de oorspronkelijke feedback; de punten over `include`/`ContextResultaat`, `klantId`
en het geneste `allOf` zijn hiermee opgelost.

**Mock-gereedheid:** ✅ happy path werkt — `POST /context/zoek` + `GET /taken/{uuid}`
geven met bearer + `Prefer: code=200` schone, samenhangende taken-data uit de
schema-voorbeelden. Error-responses zijn garbage (rode draad #2).

**Inconsistenties**
- `uuid` is zowel veldnaam als formaat én path-param; `klantId` (opaque string,
  geen `format`), `context.urn` (urn-pattern) → drie id-stijlen.
- `canonicalUrl` betekent in `TaakContext` iets anders dan in `UitvoeringBeknopt`
  (context-link vs uitvoerings-redirect) — zelfde naam, twee semantieken.
- `deadline` (Engels) tussen NL-velden; `definitie.schema` is leeg `{}` (geen vorm).

**Onnodige complexiteit**
- Het `include`/`ContextResultaat`-mechanisme + "POST als query" is overkill zolang
  er één resource-type (`taken`) is; een `GET /taken?klantId=…` had hetzelfde
  gedaan. `ContextResultaat` is een wrapper om één array.
- Genest `allOf`-in-`allOf` in `Taak`/`UitvoeringBeknopt` om één veld toe te voegen.
- Meertalige `titel`/`toelichting`-objecten terwijl `nl` toch verplicht is.

**Fixes (geprioriteerd)**
- **P1** Per-response `example` op 400/401/404 (juiste `status`). — ✅ toegepast
- **P1** Documenteer/relax de bearer-eis voor de mock.
- **P2** Eén identifier-veldnaam (`id`); hernoem één `canonicalUrl`.
- **P3** Heroverweeg `include`/`ContextResultaat` zolang er één type is; voeg
  paginering toe vóór productie.

## producten/next (OpenProduct)

**Mock-gereedheid:** ✅ alle vier endpoints (`/producttypen`, `/producttypen/{code}`,
`POST /producten/zoek`, `/producten/{uuid}`) geven met bearer coherente, geneste
voorbeelddata; externe `Fout`-`$ref` resolveert; 400/422-validatie werkt.

**Inconsistenties**
- **Intern tegenstrijdig voorbeeld:** `producttype.code = parkeervergunning` maar
  `naam = "Containervergunning Dorpsstraat 12"` met parkeer-`dataobject`.
- Twee id-stijlen: producttype op `code` (slug), product op `uuid`.
- `producttype` is in de query een string, in de response een object (zelfde naam).
- Foutdekking ongelijk per endpoint (de een 401, de ander 404, geen 400/422).

**Onnodige complexiteit**
- `allOf: [ $ref ]`-wrapper bij `producttype` (overbodig in 3.1).
- `verbruiksobject(+Schema)` als tweede variabel kanaal naast `dataobject(+Schema)`
  verdubbelt het mechanisme; `prijs`/`frequentie` los i.p.v. in `dataobject`.

**Fixes**
- **P1** Maak het voorbeeldproduct consistent (code ↔ naam ↔ dataobject).
- **P1** `examples` met 2–3 producten + één producttype zónder `verbruiksobject`.
- **P2** Verwijder `allOf`-wrapper; lijn `operationId`'s uit; voeg 400/422 toe aan
  `GET /producten/{uuid}`.
- **P3** Beslis over paginering; heroverweeg `verbruiksobject`/`prijs`-plaatsing.

## agenda/next

**Mock-gereedheid:** ✅ `POST /afspraken/opvragen` + `GET /afspraken/{id}` werken;
validatie (required, enum, minItems, auth) wordt netjes gehandhaafd; datum/tijd in
static examples correct (UTC `Z`). **Maar:** alleen een **`fysiek`-voorbeeld**; de
`online`-tak is niet te previewen.

**Inconsistenties**
- `dynamic=true` geeft fractionele/onmogelijke datums (1911, `.0Z`) en een
  onmogelijke fysiek+online-merge (oneOf lekt).
- `van > tot`-regel niet afdwingbaar in schema → mock geeft 200 (misleidend).
- Voorbeeld-`afspraakIdentificatie` is sprekend (`afspr-2026-001-xyz`) terwijl de
  spec zegt dat het *opaque* is — ondermijnt de eigen regel.
- `instance` in foutvoorbeelden matcht niet met de server-base.
- Tag-casing wijkt af: agenda's enige tag is `afspraken` (lowercase), terwijl de
  andere API's PascalCase-tags gebruiken (`Taken`, `Zaken`, `Producten`,
  `Gesprekken`, `Context`). Raakt docs-navigatie en deep-link-ankers.

**Onnodige complexiteit**
- `oneOf` + discriminator voor fysiek/online die feitelijk in één veld verschillen.
- `Identificatie`-object met een `type`-enum van één waarde (`email`).
- `next` t.o.v. `v0.2.0` = puur tekstuele opschoning, geen contractwijziging.

**Fixes**
- **P1** Voeg een **`online`-voorbeeld** toe aan het detail-endpoint (`examples`
  meervoud), zodat beide UI-takken te bouwen zijn.
- **P2** Maak `afspraakIdentificatie`-voorbeeld echt opaque (uuid); fix `instance`.
- **P3** Overweeg één `AfspraakDetails` met optionele velden i.p.v. oneOf; verwijder
  single-`allOf`-wrappers; voeg `count`/paginering toe.

## gesprekken/next

**Mock-gereedheid:** ✅ alle 11 endpoints geven schema-geldige data; upload-sessie-
`$ref` resolveert. **Maar** veel ontbrekende `example`s → placeholders.

**Inconsistenties**
- **Dubbel/half foutmodel:** inline `Fout` (`application/json`, alle velden
  `required`) naast het gedeelde `schemas/fout/v0.0.1.json` (`problem+json`, optioneel)
  via het upload-pattern. 401/403 geven een **400-body** (`status:400`).
- `count: 0` terwijl `results` gevuld is (ontbrekend `example`).
- `next`/`previous`/`url` zonder `example` → `"http://example.com"`-placeholders.
- Padnaam `/gelezenGespreksbijdragen` is camelCase (rest lowercase);
  `tekstGespreksBijdrage` heeft een interne hoofdletter-B.
- **Drie paginerings-mechanismen** tegelijk (`count/next/previous` + `page/pageSize`
  + `X-Total-Count`). Voorbeeld-`url`'s wijzen naar `/api/v1/…` (bestaat niet op de mock).

**Onnodige complexiteit**
- Vier losse `aanleiding*`-uri-velden i.p.v. `aanleiding` + `aanleidingType`.
- `uuid` + `url` dubbel op elke resource.
- Drie lagen rond "wie doet mee" (Gespreksdeelnemer/Gespreksdeelname/Actor).

**Fixes**
- **P1** `example`s op `count` (1), `next`/`previous` (null) en alle `url`-velden.
- **P2** Eén foutmodel (`$ref` naar gedeelde `Fout`), `application/problem+json`,
  en per status (401/403/404) een eigen voorbeeld met kloppende `status`.
- **P3** Kies één paginering-conventie; normaliseer padnaam/veldnaam; overweeg
  `aanleiding`+`aanleidingType`.

## zaken/next (MijnZaken)

**Verbeterslag (5 oktober 2026), ✅ toegepast:**
- `klantId` verwijderd. De burger komt uit het token (`patterns/federated-auth`, scope
  `zaken:lezen`); andermans zaak geeft `403`.
- `POST /zaken/zoek` vervangen door `GET /zaken` met `status`-filter en paginering
  (`count/next/previous/results`, `page`/`pageSize`), zoals `gesprekken`.
- Presentatie uit de API: `deadlineText` wordt `deadline` (date-time), document `grootte`
  ("2000 kB") wordt `bestandsgrootte` (bytes), `type` ("pdf") wordt `formaat` (MIME-type).
- Documenten hebben een `uuid` en `downloadUrl`; `bron` is een enum (`burger`, `organisatie`).
- `status` is `open`/`gesloten`; de inhoudelijke stap staat in `huidigeStatus`, ook in het
  overzicht.
- Voorbeelden kloppen onderling: overzicht en detail van dezelfde zaak hebben dezelfde
  `datumAanvraag` (was 2024-10-17 tegen 2022-10-17).
- Gedrag wordt getest met `aansluitprofielen/mijnzaken/mijnzaken-next.arazzo.yaml`.

**Nog open**
- Veldnaam `uuid` in plaats van `id` (rode draad #6), net als in de andere next-API's.
- Documenten en contactmomenten zitten embedded in `ZaakDetail`; bij grote dossiers zijn
  aparte sub-resources beter.

---

## Aanbevolen volgorde van itereren

1. ✅ taken/next error-voorbeelden (flagship — de demo gebruikt dit eerst).
2. ✅ gesprekken: ontbrekende `example`s (`count`/`url`/`next`) + foutmodel.
3. ✅ agenda: `online`-voorbeeld.
4. ✅ producten: consistent voorbeeldproduct.
5. ✅ Cross-cutting: RFC-referentie 7807 → 9457; bearer-eis documenteren/omzeilen in frontend.
6. ✅ zaken: `zaken/next` mock API en detail timeline view toegevoegd.
