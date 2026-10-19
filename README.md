# VNG API lab

| Eigenaar | Ingevuld door |
| --- | --- |
| Project Omnichannel - MijnServices / Team Dienstverlening | Joep Meindertsma |

Deze repository bevat de API-standaarden, gedeelde schemas en patronen van het VNG API lab.

Bekijk op [vng-api-lab.netlify.app](https://vng-api-lab.netlify.app).
Issues / suggesties / verbeteringen op [Github Issues](https://github.com/VNG-Realisatie/Interactie-APIs/issues).

## MijnOverheid demo

Doorklikbare demo van een MijnOverheid-omgeving met taken, zaken, berichten, producten en agenda — gekoppeld aan de mock-API's in dit lab. Inclusief huisstijl-switcher (Rijk, Utrecht, Den Haag, NLDS Basis) en API-inspector.

- **Online:** [vng-api-lab.netlify.app/mijnoverheid/](https://vng-api-lab.netlify.app/mijnoverheid/)
- **Lokaal:** na `pnpm dev` op `http://127.0.0.1:31837/mijnoverheid/` (poort via `VITE_PORT`)
- **Broncode:** [`mijnoverheid/`](mijnoverheid/)

## Status: Pre-alfa

Dit project is nog in ontwikkeling, de API's en schema's vertegenwoordigen nog geen officiële standaarden.

## Wat doet deze repository

- **API Specificaties**. Dit beschrijft hoe APIs werken, welke endpoints er zijn, en wat voor soort antwoorden ze geven. De APIs zijn beschreven in OpenAPI spec of AsyncAPI spec.
- **Technische Documentatie (ReSpec)**. Van elke API wordt automatisch een mensgerichte ReSpec specificatie gegenereerd (Single Source of Truth).
- **JSON Schemas**. Dit beschrijft hoe de datamodellen er uit zien. Deze kunnen worden hergebruikt tussen API specificaties.
- **Patterns**. Dit zijn manieren waarop APIs zijn ontworpen
- **Versiebeheer**. Van alle schemas, APIs en patterns worden versies bijgehouden.
- **MijnOverheid demo**. Doorklikbare portaal-demo (`mijnoverheid/`) die de MijnServices-API's tegen de mocks toont.

## Structuur

- `apis/`: API-definities.
  - `rest/`: OpenAPI (OAS) specificaties voor RESTful services.
  - `events/`: AsyncAPI specificaties voor event-driven architecturen.
- `schemas/`: Gedeelde JSON-schemas voor data-objecten, onafhankelijk versied.
  - `[object]/[semver].json`: Expliciete versiebeheer (bijv. `adres/0.0.1.json`).
- `patterns/`: Herbruikbare API-fragmenten (bijv. paginering).

### Twee soorten API's

| Soort | Herkenbaar aan | Wat het is | Mag het lab wijzigen? |
|---|---|---|---|
| **Mijn-API's** | Titel `Mijn...` (MijnZaken, MijnTaken, MijnProducten, MijnAgenda, MijnGesprekken); map `apis/rest/{zaken,taken,...}` | Nieuwe generatie: het contract tussen een MijnOmgeving en een bron. Hier mogen we ambitieus zijn. | Ja, in `next`. Benoemde versies nooit. Een werkgroep-ontwerp (zie `services/*.md`) alleen in overleg. |
| **Bestaande registers** | Map met pakketnaam ervoor (`zgw-`, `openvtb-`, `openproduct-`, `openklant-`, `openplan-`) | De huidige situatie: API's van bestaande componenten, as-is geïmporteerd. | Nee. Nieuwe versie van de bron = nieuw bestand. |

Een aansluitprofiel (`aansluitprofielen/`) verbindt de twee: het laat zien hoe een bestaand register
een Mijn-API invult, en wat er dan nog ontbreekt.
- `docs/`: Governance, Design Principes en Architectural Decision Records (ADRs).
  - `respec/`: Automatisch gegenereerde ReSpec HTML specificaties en PDF versies hiervan.
- `mijnoverheid/`: MijnOverheid demo-app (React, NLDS-ARK).
- `archive/`: Gearchiveerde versies (zie [Sunsetting Policy](docs/governance/sunsetting.md)).

## Governance & Bijdragen

Wij maken gebruik van een gestructureerd governance-model met specifieke rollen:

- **Communitymanager**: Intake en stakeholdermanagement.
- **PO Proces/Generiek**: Functionele bewakers.
- **Tech Lead**: Technische standaarden en platformregie.

Zie [CONTRIBUTING.md](CONTRIBUTING.md) voor meer details over het proces van businesswens naar API-schema.

## Lokale Ontwikkeling

Om de API-specificaties lokaal te bekijken of te testen:

1. **Installatie**:

   ```bash
   pnpm install
   ```

2. **Alles-in-één development** (Portal + Mock Servers + ReSpec):

   ```bash
   pnpm run dev
   ```

    Dit start automatisch:
- Het **API lab portaal** op `http://127.0.0.1:${VITE_PORT}` (default: 31837)
- De **MijnOverheid demo** op `http://127.0.0.1:${VITE_PORT}/mijnoverheid/`
- De **Mock Servers (Gateway)** op `http://127.0.0.1:${MOCK_GATEWAY_PORT}` (default: 41837)
    - De **ReSpec Generatie** (HTML en PDF bestanden landen in `docs/respec/`)

3. **ReSpec handmatig genereren**:
   Als je alleen de ReSpec (HTML & PDF) bestanden wilt updaten:

   ```bash
   pnpm run respec
   ```

4. **Linter uitvoeren** (Optioneel):
   Controleer of je wijzigingen voldoen aan de Nederlandse API-strategie:

   ```bash
   pnpm run lint
   ```

De officiële API-specificaties zijn te bekijken via het [VNG API lab portaal](https://vng-realisatie.github.io/Interactie-APIs/).

## Hosting

- **Portal (statische site)**: [vng-api-lab.netlify.app](https://vng-api-lab.netlify.app) via Netlify (automatische deploys vanaf `main`).
- **Mock Servers**: `vng-interactie-mocks.fly.dev` via Fly.io. De Scalar "Try it"-knoppen in het portal wijzen naar deze publieke mocks; lokaal wordt `http://127.0.0.1:${VITE_MOCK_GATEWAY_PORT}` gebruikt (default: 41837).

### Mocks deployen naar Fly.io

De mock-gateway (`scripts/mock-all.js`) draait in een container op basis van de `Dockerfile` en `fly.toml` in deze repo.

Deploys zijn geautomatiseerd via GitHub Actions: elke push naar `main` triggert `.github/workflows/fly-deploy.yml` (vereist het secret `FLY_API_TOKEN`).

Handmatig deployen kan ook:

```bash
# eenmalig
brew install flyctl
fly auth login

# deployen
fly deploy
```

De Fly-machine draait permanent (`min_machines_running = 1`, ~$5/mo) zodat Scalar's "Try it" zonder cold-start werkt. Met auto-stop wordt Fly's proxy-timeout (~8s) korter dan de Prism cold-start (~10s+).
