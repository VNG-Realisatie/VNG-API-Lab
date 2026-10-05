# Service beschrijving — MijnGesprekken

| Eigenaar ontwerp | Status `next` in dit lab |
| --- | --- |
| Nog vast te stellen. Het informatiemodel (Gesprek, Gespreksbijdrage, enz.) komt mogelijk uit een werkgroep | Lab-voorstel. Let op: de API is registerachtig (volledige CRUD, geen filter op burger) en daarmee nog geen burgergerichte MijnService. |

Dit document beschrijft de use-cases, uitgangspunten en integratie-afspraken voor **MijnGesprekken**.

## Links

- API (interactief): [Open MijnGesprekken (Scalar)](/?url=/docs/bundled/apis_rest_gesprekken_next.yaml)
- OpenAPI bron: [apis/rest/gesprekken/next.yaml](/?file=apis/rest/gesprekken/next.yaml)

## Use-cases (voorbeeld)

- Gesprekken en bijdragen registreren en raadplegen.
- (Experimenteel) upload-sessie starten voor een bijlage bij een gesprek.

## Contract / schema

Let op: deze API gebruikt een eigen `Fout` schema onder `components/schemas` (niet het gedeelde RFC7807 schema).

