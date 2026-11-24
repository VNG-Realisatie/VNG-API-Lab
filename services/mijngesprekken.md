# Service beschrijving — MijnGesprekken

| Repository | Status `next` in dit lab |
| --- | --- |
| [Interactie-APIs](https://github.com/VNG-Realisatie/Interactie-APIs/tree/main/apis/rest/gesprekken) | Lab-voorstel. Let op: de API is registerachtig (volledige CRUD, geen filter op burger) en daarmee nog geen burgergerichte MijnService. |

Dit document beschrijft de use-cases, uitgangspunten en integratie-afspraken voor **MijnGesprekken**.

## Links

- API (interactief): [Open MijnGesprekken (Scalar)](/?url=/docs/bundled/apis_rest_gesprekken_next.yaml)
- OpenAPI bron: [apis/rest/gesprekken/next.yaml](/?file=apis/rest/gesprekken/next.yaml)
- Versies: [0.2.1](/?file=apis/rest/gesprekken/v0.2.1.yaml) (VNG-standaard), [0.3.0](/?file=apis/rest/gesprekken/v0.3.0.yaml) (model Visma Roxit, Johannes Battjes, 2026-09-30) en `next` = 0.4.0 in ontwikkeling, gebouwd op 0.3.0.

## Use-cases (voorbeeld)

- Gesprekken en bijdragen registreren en raadplegen.
- Een document (informatieobjecttype "Gespreksbijlage") uit de Documenten API als bijlage aan een bijdrage hangen.

## Contract / schema

Let op: deze API gebruikt een eigen `Fout` schema onder `components/schemas` (niet het gedeelde RFC7807 schema).

