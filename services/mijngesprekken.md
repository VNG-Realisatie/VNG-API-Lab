# Service beschrijving — MijnGesprekken

Dit document beschrijft de use-cases, uitgangspunten en integratie-afspraken voor **MijnGesprekken**.

## Links

- API (interactief): [Open MijnGesprekken (Scalar)](/?url=/docs/bundled/apis_rest_gesprekken_next.yaml)
- OpenAPI bron: [apis/rest/gesprekken/next.yaml](/?file=apis/rest/gesprekken/next.yaml)

## Use-cases (voorbeeld)

- Gesprekken en bijdragen registreren en raadplegen.
- Een document (informatieobjecttype "Gespreksbijlage") uit de Documenten API als bijlage aan een bijdrage hangen.

## Contract / schema

Let op: deze API gebruikt een eigen `Fout` schema onder `components/schemas` (niet het gedeelde RFC7807 schema).

