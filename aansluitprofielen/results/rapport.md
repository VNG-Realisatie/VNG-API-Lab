# Aansluitprofielen: rapport

Gedraaid op 2026-10-26 met Redocly CLI 2.57.0.

**50 van 66 checks geslaagd**, 16 bekende fouten, 0 onverwacht.

| Doel | Profiel | Gedrag | Strikt |
|---|---|---|---|
| mijnzaken-next | `aansluitprofielen/mijnzaken/mijnzaken-next.arazzo.yaml` | 5 van 5 | 5 van 5 |
| mijntaken-next | `aansluitprofielen/mijntaken/mijntaken-next.arazzo.yaml` | 6 van 6 | 6 van 6 |
| zgw-burger | `aansluitprofielen/mijnzaken/zgw.arazzo.yaml` | 5 van 5 | 5 van 5 |
| zgw-applicatie | `aansluitprofielen/mijnzaken/zgw.arazzo.yaml` | 3 van 5 (2 bekend) | 3 van 5 (2 bekend) |
| openvtb-burger | `aansluitprofielen/mijntaken/openvtb.arazzo.yaml` | 6 van 6 | 0 van 6 (6 bekend) |
| objecten-burger | `aansluitprofielen/mijntaken/objecten.arazzo.yaml` | 6 van 6 | 0 van 6 (6 bekend) |

## Bekende fouten

| Check | Uitleg | Reden |
|---|---|---|
| `zgw-applicatie/gedrag/burger-a-haalt-zaak-van-burger-b` | ZGW 1.x autoriseert per applicatie, niet per burger | a-haalt-zaak-van-b: success criteria check: Checking simple criteria: {"condition":"$statusCode == 403 \|\| $statusCode == 404"} |
| `zgw-applicatie/gedrag/burger-a-zoekt-op-bsn-van-burger-b` | ZGW 1.x autoriseert per applicatie, niet per burger | a-zoekt-op-bsn-van-b: success criteria check: Checking simple criteria: {"condition":"$statusCode == 403 \|\| $response.body#/count == 0"} |
| `zgw-applicatie/strikt/burger-a-haalt-zaak-van-burger-b` | ZGW 1.x autoriseert per applicatie, niet per burger | a-haalt-zaak-van-b: success criteria check: Checking simple criteria: {"condition":"$statusCode == 403 \|\| $statusCode == 404"} |
| `zgw-applicatie/strikt/burger-a-zoekt-op-bsn-van-burger-b` | ZGW 1.x autoriseert per applicatie, niet per burger | a-zoekt-op-bsn-van-b: success criteria check: Checking simple criteria: {"condition":"$statusCode == 403 \|\| $response.body#/count == 0"} |
| `openvtb-burger/strikt/overzicht-naar-detail` | De Open VTB-spec documenteert geen 401/403/404 en de discriminator op taakSoort is niet valide voor Ajv | zoek-taken: schema check: Ajv error: discriminator: "properties/taakSoort" must have "const" or "enum" |
| `openvtb-burger/strikt/taken-bij-zaak` | De Open VTB-spec documenteert geen 401/403/404 en de discriminator op taakSoort is niet valide voor Ajv | zoek-taken-bij-zaak: schema check: Ajv error: discriminator: "properties/taakSoort" must have "const" or "enum" |
| `openvtb-burger/strikt/zonder-token` | De Open VTB-spec documenteert geen 401/403/404 en de discriminator op taakSoort is niet valide voor Ajv | zoek-zonder-token: status code check: mislukt bij statuscode 401 |
| `openvtb-burger/strikt/onbekende-taak` | De Open VTB-spec documenteert geen 401/403/404 en de discriminator op taakSoort is niet valide voor Ajv | haal-onbekende-taak: status code check: mislukt bij statuscode 404 |
| `openvtb-burger/strikt/burger-a-haalt-taak-van-burger-b` | De Open VTB-spec documenteert geen 401/403/404 en de discriminator op taakSoort is niet valide voor Ajv | b-zoekt-eigen-taken: schema check: Ajv error: discriminator: "properties/taakSoort" must have "const" or "enum" |
| `openvtb-burger/strikt/burger-a-zoekt-op-burger-b` | De Open VTB-spec documenteert geen 401/403/404 en de discriminator op taakSoort is niet valide voor Ajv | a-zoekt-op-burger-b: schema check: Ajv error: discriminator: "properties/taakSoort" must have "const" or "enum" |
| `objecten-burger/strikt/overzicht-naar-detail` | De Objecten-spec documenteert geen 403/404 en is niet valide voor Ajv (nullable zonder type) | zoek-taken: schema check: Ajv error: "nullable" cannot be used without "type" |
| `objecten-burger/strikt/taken-bij-zaak` | De Objecten-spec documenteert geen 403/404 en is niet valide voor Ajv (nullable zonder type) | zoek-taken-bij-zaak: schema check: Ajv error: "nullable" cannot be used without "type" |
| `objecten-burger/strikt/zonder-token` | De Objecten-spec documenteert geen 403/404 en is niet valide voor Ajv (nullable zonder type) | zoek-zonder-token: status code check: mislukt bij statuscode 403 |
| `objecten-burger/strikt/onbekende-taak` | De Objecten-spec documenteert geen 403/404 en is niet valide voor Ajv (nullable zonder type) | haal-onbekende-taak: status code check: mislukt bij statuscode 404 |
| `objecten-burger/strikt/burger-a-haalt-taak-van-burger-b` | De Objecten-spec documenteert geen 403/404 en is niet valide voor Ajv (nullable zonder type) | b-zoekt-eigen-taken: schema check: Ajv error: "nullable" cannot be used without "type" |
| `objecten-burger/strikt/burger-a-zoekt-op-bsn-van-burger-b` | De Objecten-spec documenteert geen 403/404 en is niet valide voor Ajv (nullable zonder type) | a-zoekt-op-bsn-van-b: schema check: Ajv error: "nullable" cannot be used without "type" |
