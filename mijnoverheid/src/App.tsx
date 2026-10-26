import { createContext, Fragment, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Accordion } from "@ark-ui/react/accordion";
import { Select, createListCollection } from "@ark-ui/react/select";
import { Tabs } from "@ark-ui/react/tabs";
import { Chat, ChatThread, ChatComposer, SpeakerToggle, UnavailableNote } from "./Chat";
import { useChat, SUGGESTIONS, type ChatApi } from "./chat/useChat";
import { useStickToBottom } from "./chat/useStickToBottom";
import { useVoice, type VoiceApi } from "./chat/useVoice";

const themes = createListCollection({
  items: [
    { label: "Rijksoverheid", value: "rijk" },
    { label: "Gemeente Utrecht", value: "utrecht" },
    { label: "Gemeente Den Haag", value: "denhaag" },
    { label: "Gemeente Veenendaal (NLDS Basis)", value: "basis" },
  ],
});

function getDefaultApiBase() {
  if (typeof window === "undefined") return "https://vng-interactie-mocks.fly.dev";
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:41837"
    : "https://vng-interactie-mocks.fly.dev";
}

function normalizeApiBase(value: string) {
  return value.trim().replace(/\/$/, "");
}

const API_BASES_STORAGE_KEY = "mijnoverheid-api-bases";

// De API's waarvoor je in de inspector een eigen endpoint kunt instellen.
const apiEndpoints: { key: string; label: string }[] = [
  { key: "taken", label: "MijnTaken" },
  { key: "zaken", label: "MijnZaken" },
  { key: "producten", label: "MijnProducten" },
  { key: "agenda", label: "MijnAgenda" },
  { key: "gesprekken", label: "MijnGesprekken" },
  { key: "openplan-plannen", label: "MijnPlan" },
  { key: "openklant-klantinteracties", label: "MijnGegevens" },
];

// Services die NIET automatisch de discovery-default mogen overnemen: het
// discovery-manifest kiest generiek de 'primaire' versie per service (next,
// anders hoogste semver), maar loadGegevens() hieronder hardcodet bewust de
// 'mijnoverheid-demo'-variant van openklant-klantinteracties (met de
// demo-persona en expand-gedrag die deze app nodig heeft) — niet de
// generieke v0.7.0 die discovery zou kiezen. Automatisch overnemen zou de
// Gegevens-tab stilzwijgend op een andere, incompatibele mock-vorm zetten.
// Handmatig overriden via de API-inspector blijft voor deze service gewoon
// mogelijk; alleen de STANDAARDwaarde negeert discovery hier.
const DISCOVERY_AUTOAPPLY_EXCLUDED = new Set(["openklant-klantinteracties"]);

type DiscoveryStatus = "loading" | "ok" | "unavailable";

async function fetchDiscoveredBases(): Promise<Record<string, string>> {
  const res = await fetch(`${getDefaultApiBase()}/.well-known/federated-resources`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const manifest = await res.json();
  const map: Record<string, string> = {};
  for (const r of manifest.resources || []) {
    if (r && typeof r.service === "string" && typeof r.baseUrl === "string") {
      map[r.service] = r.baseUrl;
    }
  }
  return map;
}

function readStoredApiBases(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(API_BASES_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// Haalt de API-naam uit een pad als /apis/rest/{api}/...
function apiFromPath(path: string): string {
  const m = path.match(/\/apis\/rest\/([^/?#]+)/);
  return m ? m[1] : "";
}

// Het standaard-endpoint voor een API (t/m versie); dient als placeholder en
// als basis wanneer er geen eigen endpoint is ingesteld.
function defaultApiEndpoint(api: string): string {
  return `${getDefaultApiBase()}/apis/rest/${api}/next`;
}

// Leidt uit een call (/apis/rest/{api}/{versie}/{operatie}) de docs-URL af naar
// de juiste OpenAPI-spec in het API lab, inclusief Scalar-deeplink naar de
// specifieke operatie: #tag/{tag}/{METHODE}/{operatiepad}. De tag is bij deze
// API's gelijk aan het eerste pad-segment (Scalar slugificeert naar lowercase).
// De docs-app draait op de root (/) terwijl MijnOverheid op /mijnoverheid/ staat,
// dus een absoluut pad werkt in dev én prod.
function docsUrlForCall(method: string, pathOrUrl: string): string | null {
  const match = pathOrUrl.match(/\/apis\/rest\/([^/?#]+)\/([^/?#]+)(\/[^?#]*)?/);
  if (!match) return null;
  const [, api, version, restRaw] = match;
  const base = `/?url=/docs/bundled/apis_rest_${api}_${version}.yaml`;

  const rest = (restRaw || "").replace(/^\/+|\/+$/g, "");
  if (!rest) return base;

  // Concrete UUID's terugvertalen naar de path-parameter zodat het anker matcht.
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const opPath = rest
    .split("/")
    .map((seg) => (uuidRe.test(seg) ? "{uuid}" : seg))
    .join("/");
  const tag = opPath.split("/")[0].toLowerCase();
  return `${base}#tag/${tag}/${method.toUpperCase()}/${opPath}`;
}

function formatLogUrl(fullUrl: string, base: string) {
  const baseNorm = normalizeApiBase(base);
  if (fullUrl.startsWith(baseNorm)) return fullUrl.slice(baseNorm.length) || "/";
  try {
    const u = new URL(fullUrl);
    return `${u.pathname}${u.search}`;
  } catch {
    return fullUrl;
  }
}

const defaultMockHeaders = {
  Authorization: "Bearer dummy-token",
  "Content-Type": "application/json",
  Prefer: "code=200",
};

const customRequestDefaults = {
  method: "GET",
  path: "/apis/rest/taken/next/taken?status=open",
  body: "",
};

type PageKey =
  | "home"
  | "chat"
  | "assistent"
  | "dossier"
  | "taken"
  | "berichten"
  | "zaken"
  | "producten"
  | "belastingzaken"
  | "woz"
  | "parkeren"
  | "erfpacht"
  | "vakantieverhuur"
  | "agenda"
  | "plan"
  | "gegevens"
  | "brief"
  | "zaak-detail";

type NavItem = {
  label: string;
  icon: string;
  key: PageKey;
  badge?: number;
  dividerBefore?: boolean;
};
const nav: NavItem[] = [
  // MijnServices bovenaan.
  { label: "Home", icon: "icon-grid", key: "home" },
  { label: "Assistent", icon: "icon-chat", key: "assistent" },
  { label: "Mijn taken", icon: "icon-checks", key: "taken" },
  { label: "Mijn berichten", icon: "icon-mail", key: "berichten", badge: 9 },
  { label: "Mijn zaken", icon: "icon-folder", key: "zaken" },
  { label: "Mijn agenda", icon: "icon-calendar", key: "agenda" },
  { label: "Mijn plan", icon: "icon-plan", key: "plan" },
  { label: "Mijn producten", icon: "icon-card", key: "producten" },
  // Thematische producten/diensten onderaan, visueel gescheiden.
  { label: "Parkeren", icon: "icon-parking", key: "parkeren", dividerBefore: true },
  { label: "Erfpacht", icon: "icon-building", key: "erfpacht" },
  { label: "Vakantieverhuur", icon: "icon-bed", key: "vakantieverhuur" },
  { label: "Belastingzaken", icon: "icon-euro", key: "belastingzaken" },
  { label: "Nabestaandendossier", icon: "icon-clipboard", key: "dossier" },
  { label: "WOZ", icon: "icon-home", key: "woz" },
  { label: "Mijn gegevens", icon: "icon-user", key: "gegevens" },
];
const labels: Record<string, string> = {
  ...Object.fromEntries(nav.map((n) => [n.key, n.label])),
  brief: "Contactpersoon doorgeven aan de Belastingdienst",
  "zaak-detail": "Zaak detail",
  assistent: "Assistent",
  chat: "Gesprek",
};

// Volledige takenlijst voor de Mijn taken-pagina, met categorie + status.
type TaakCat = "belangrijkste" | "ingevuld" | "geenactie";
type Taak = {
  titel: string;
  org: string;
  deadline?: string;
  ai?: boolean;
  terInfo?: boolean;
  automatisch?: boolean;
  cat: TaakCat;
  raw?: any;
};
const takenFilters: { key: "alle" | TaakCat; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "belangrijkste", label: "Belangrijkste" },
  { key: "ingevuld", label: "Ingevuld door AI" },
  { key: "geenactie", label: "Geen actie nodig" },
];

const documenten = [
  {
    titel: "Akte van overlijden",
    org: "Gemeente",
    tekst: "Het officiële uittreksel uit de registers van de burgerlijke stand.",
  },
  {
    titel: "Verklaring van erfrecht",
    org: "Notaris",
    tekst: "Toont wie de erfgenamen zijn en wie de nalatenschap mag afhandelen.",
  },
  {
    titel: "Overzicht mogelijke rechten",
    org: "SVB",
    tekst: "Mogelijk recht op Anw-uitkering of nabestaandenpensioen.",
  },
];

const briefMeta = [
  ["Afzender", "Belastingdienst"],
  ["Soort brief", "Actiebrief"],
  ["Ontvangen", "1 juni 2026"],
  ["Aanhef", "Aan de erven van"],
  ["Gericht aan", "De erven van de overledene"],
  ["Bezorgd op", "Zorgcentrum De Wilg 1, 3511 AB Utrecht — verzorgingstehuis"],
  ["Uiterlijk reageren", "vóór 2 juli 2026"],
  ["Leidt tot zaak", "Contactpersoon doorgeven aan Belastingdienst"],
  ["Kenmerk", "BD.ERVENBRIEF"],
];

type ThemeData = {
  title: string;
  tasks: [string, string][];
  actions: string[];
  itemsTitle: string;
  itemsHead: [string, string, string];
  items: [string, string, string][];
};
const themeData: Record<string, ThemeData> = {
  woz: {
    title: "WOZ",
    tasks: [["Geef meer informatie over uw WOZ-bezwaar", "vóór 2 juni 2026"]],
    actions: [
      "WOZ-waarde bekijken",
      "Bezwaar maken tegen WOZ-waarde",
      "Taxatieverslag downloaden",
      "Adresgegevens controleren",
    ],
    itemsTitle: "WOZ-objecten",
    itemsHead: ["Object", "Beschikking", "Waarde"],
    items: [
      ["Keukenlaan 133", "WOZ-waarde 2024", "€ 438.000"],
      ["Garagebox Valeriusplein", "WOZ-waarde 2024", "€ 34.000"],
      ["Keukenlaan 133", "WOZ-waarde 2023", "€ 412.000"],
      ["Keukenlaan 133", "WOZ-waarde 2022", "€ 389.000"],
    ],
  },
  parkeren: {
    title: "Parkeren",
    tasks: [
      ["Betaal uw parkeerbon van € 74,90 voor parkeren bij Valeriusplein", "vóór 1 maart 2026"],
    ],
    actions: [
      "Parkeervergunning aanvragen",
      "Kenteken wijzigen",
      "Parkeerbon betalen",
      "Mantelzorgvergunning aanvragen",
    ],
    itemsTitle: "Parkeerproducten",
    itemsHead: ["Product", "Kenmerk", "Status"],
    items: [
      ["Parkeervergunning bewoners", "34-FJT-23", "Actief"],
      ["Parkeerbon", "34-FJT-23", "Nog te betalen"],
      ["Mantelzorgvergunning", "Keukenlaan 133", "Verleend"],
      ["Bezoekersregeling", "Zone Centrum", "Actief"],
    ],
  },
  erfpacht: {
    title: "Erfpacht",
    tasks: [
      [
        "Betaal uw erfpachtfactuur van € 27,52 voor Keukenhoflaan 133 (juli–december 2025)",
        "vóór 12 december 2025",
      ],
    ],
    actions: [
      "Erfpachtcanon bekijken",
      "Afkoop canon aanvragen",
      "Erfpachtcontract downloaden",
      "Adres erfpachtobject wijzigen",
    ],
    itemsTitle: "Erfpachtcontracten",
    itemsHead: ["Object", "Onderdeel", "Status"],
    items: [
      ["Keukenlaan 133", "Contract 2023", "1 taak open"],
      ["Keukenlaan 133", "Factuur juli–december", "Nog te betalen"],
      ["Keukenlaan 133", "Afkoopberekening", "In behandeling"],
      ["Keukenlaan 133", "Canon overzicht", "Beschikbaar"],
    ],
  },
  vakantieverhuur: {
    title: "Vakantieverhuur",
    tasks: [],
    actions: [
      "Vakantieverhuur melden",
      "Nachtteller bekijken",
      "Melding wijzigen",
      "Voorwaarden vakantieverhuur bekijken",
    ],
    itemsTitle: "Meldingen vakantieverhuur",
    itemsHead: ["Object", "Onderdeel", "Status"],
    items: [
      ["Dierenselaan 88", "Melding 2024", "Afgehandeld"],
      ["Dierenselaan 88", "Nachtteller", "18 nachten gebruikt"],
      ["Dierenselaan 88", "Voorwaarden", "Beschikbaar"],
      ["Dierenselaan 88", "Correspondentie", "2 berichten"],
    ],
  },
};

const taxTasks: [string, string][] = [
  ["Betaal uw gemeentelijke belasting van € 6.982,30", "vóór 1 maart 2026"],
  ["Betaal uw rioolrecht grootafvoer van € 211,30 (aanslagnummer 2212002751)", "vóór 1 april 2026"],
  ["Geef meer informatie over uw bezwaar tegen afvalstoffenheffing 2026", "vóór 2 juni 2026"],
];
const taxActions = [
  "Bezwaar maken tegen een aanslag",
  "Meerdere documenten in één keer downloaden",
  "Belasting gespreid betalen met automatische incasso",
  "Betalingsregeling aanvragen",
];

// Helper functions for mapping mock API data
const getOrgName = (taak: any) => {
  if (taak.context?.canonicalUrl) {
    try {
      const url = new URL(taak.context.canonicalUrl);
      if (url.hostname.includes("belastingdienst")) return "Belastingdienst";
      if (url.hostname.includes("toeslagen")) return "Dienst Toeslagen";
      if (url.hostname.includes("svb")) return "Sociale Verzekeringsbank";
      if (url.hostname.includes("cak")) return "CAK";
      if (url.hostname.includes("rdw")) return "RDW";
      if (url.hostname.includes("gemeente")) return "Gemeente";
    } catch (e) {}
  }
  if (taak.context?.urn) {
    if (taak.context.urn.includes("gemeente")) return "Gemeente";
    if (taak.context.urn.includes("belastingdienst")) return "Belastingdienst";
  }
  return "Gemeente";
};

const formatDeadline = (isoString?: string) => {
  if (!isoString) return undefined;
  try {
    const date = new Date(isoString);
    const months = [
      "januari",
      "februari",
      "maart",
      "april",
      "mei",
      "juni",
      "juli",
      "augustus",
      "september",
      "oktober",
      "november",
      "december",
    ];
    return `vóór ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  } catch (e) {
    return isoString;
  }
};

const formatZaakStatus = (status?: string) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1) : "";

const formatBestandstype = (mime?: string) =>
  (mime?.split("/").pop() || "bestand").toUpperCase();

const formatBestandsgrootte = (bytes?: number) => {
  if (typeof bytes !== "number") return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
};

const formatAfspraakWhen = (startStr: string, endStr?: string) => {
  try {
    const start = new Date(startStr);
    const days = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
    const months = [
      "januari",
      "februari",
      "maart",
      "april",
      "mei",
      "juni",
      "juli",
      "augustus",
      "september",
      "oktober",
      "november",
      "december",
    ];
    const dayName = days[start.getDay()];
    const monthName = months[start.getMonth()];
    const time = start.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
    return `${dayName} ${start.getDate()} ${monthName} ${start.getFullYear()}, ${time} uur`;
  } catch (e) {
    return startStr;
  }
};

const formatConversationDate = (isoString?: string) => {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const months = [
      "januari",
      "februari",
      "maart",
      "april",
      "mei",
      "juni",
      "juli",
      "augustus",
      "september",
      "oktober",
      "november",
      "december",
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  } catch (e) {
    return isoString || "";
  }
};
type FaqItem = { q: string; a: string };

// Algemene FAQ; terugval voor pagina's zonder eigen vragen (bijv. Home, brief).
const defaultFaqs: FaqItem[] = [
  {
    q: "Wat kan ik doen in Mijn omgeving?",
    a: "In Mijn omgeving regelt u uw zaken met de overheid op één plek: u ziet uw taken, lopende zaken, berichten, producten en afspraken, en u kunt rekeningen betalen of de status van een aanvraag volgen.",
  },
  {
    q: "Werkt Mijn omgeving ook op mijn telefoon?",
    a: "Ja. Mijn omgeving past zich aan uw scherm aan, zodat u alles ook op uw telefoon of tablet kunt bekijken en regelen.",
  },
  {
    q: "Bij wie kan ik terecht voor hulp?",
    a: "Bel 1400 (maandag tot en met vrijdag van 8.00 tot 20.00 uur) of stel uw vraag via vragen@mijn.overheid.nl.",
  },
];

// Per pagina passende veelgestelde vragen.
const faqsByPage: Partial<Record<PageKey, FaqItem[]>> = {
  dossier: [
    {
      q: "Moet ik alles meteen regelen?",
      a: "Nee. Veel zaken regelt de overheid automatisch. Pak eerst de taken met een deadline op; de rest heeft de tijd.",
    },
    {
      q: "Hoe weet ik wat er al automatisch is geregeld?",
      a: "In uw Nabestaandendossier ziet u per onderwerp of er nog actie nodig is of dat het al automatisch is geregeld. Taken met het label “Geen actie nodig” zijn alleen ter informatie.",
    },
    {
      q: "Waarom staan sommige brieven op naam van de overledene of ‘de erven’?",
      a: "Organisaties weten nog niet altijd wie de contactpersoon is. Geeft u dit door, dan komt de post voortaan op uw naam.",
    },
  ],
  taken: [
    {
      q: "Wat betekenen de labels bij een taak?",
      a: "“Ingevuld door AI” betekent dat een concept automatisch is voorbereid — controleer het voordat u verstuurt. “Ter info” of “Geen actie nodig” betekent dat u niets hoeft te doen.",
    },
    {
      q: "Wat gebeurt er als ik een taak niet op tijd doe?",
      a: "Bij taken met een deadline kunt u een herinnering krijgen en, afhankelijk van het onderwerp, een aanmaning of boete. Lukt het niet op tijd, neem dan contact op met de betrokken organisatie.",
    },
    {
      q: "Wie heeft een taak voor mij klaargezet?",
      a: "Bij elke taak staat de organisatie die de taak heeft aangevraagd en, waar mogelijk, een link om het direct bij die organisatie te regelen.",
    },
  ],
  berichten: [
    {
      q: "Ik heb een vraag over de inhoud van een bericht.",
      a: "Mijn omgeving kan u niet helpen bij de inhoud van de berichten die u ontvangt. Neem contact op met de organisatie waarvan u het bericht heeft ontvangen. De contactgegevens staan in de brief die als bijlage bij het bericht zit.",
    },
    {
      q: "Hoe lang blijven mijn berichten bewaard?",
      a: "Uw berichten blijven beschikbaar zolang de afzender ze bewaart. Wilt u een bericht langer bewaren, sla de bijlage dan op op uw eigen apparaat.",
    },
    {
      q: "Krijg ik een melding bij een nieuw bericht?",
      a: "Ja, als u dat heeft ingesteld onder Mijn gegevens → Meldingen ontvangt u een e-mail zodra er een nieuw bericht is.",
    },
  ],
  zaken: [
    {
      q: "Wat betekent de status van een zaak?",
      a: "De status laat zien hoe ver uw aanvraag is: van “Ontvangen” via “In behandeling” tot “Afgehandeld”. Bij een open zaak ziet u wat de volgende stap is.",
    },
    {
      q: "Waarom zie ik soms een openstaande taak bij een zaak?",
      a: "Soms heeft de organisatie nog informatie van u nodig om verder te kunnen. Die vraag verschijnt dan als taak bij de betreffende zaak.",
    },
    {
      q: "Kan ik documenten bij mijn zaak downloaden?",
      a: "Ja. Op de detailpagina van een zaak vindt u de bijbehorende documenten en kunt u ze downloaden.",
    },
  ],
  producten: [
    {
      q: "Wat is een product?",
      a: "Een product is iets dat u van de overheid heeft gekregen of aangevraagd, zoals een vergunning, ontheffing of pas.",
    },
    {
      q: "Hoe lang is mijn product geldig?",
      a: "Dat verschilt per product. Op de detailpagina ziet u de begin- en einddatum en de status, bijvoorbeeld “Actief” of “Verlopen”.",
    },
    {
      q: "Kan ik een product wijzigen of opzeggen?",
      a: "Voor veel producten kunt u online een wijziging of opzegging aanvragen. Lukt dat niet, neem dan contact op met de organisatie die het product heeft verstrekt.",
    },
  ],
  belastingzaken: [
    {
      q: "Hoe kan ik mijn aanslag betalen?",
      a: "U kunt uw aanslag in één keer betalen of een betalingsregeling of automatische incasso aanvragen via de acties op deze pagina.",
    },
    {
      q: "Hoe maak ik bezwaar tegen een aanslag?",
      a: "Maak bezwaar binnen zes weken na de datum op de aanslag. Gebruik de actie “Bezwaar maken tegen een aanslag” en geef aan waarom u het er niet mee eens bent.",
    },
    {
      q: "Ik kan mijn belasting niet in één keer betalen. Wat nu?",
      a: "Vraag een betalingsregeling aan, dan betaalt u in termijnen. U vindt dit bij de acties op deze pagina.",
    },
  ],
  woz: [
    {
      q: "Wat is de WOZ-waarde?",
      a: "De WOZ-waarde is de geschatte waarde van uw woning of object die de gemeente jaarlijks vaststelt. De waarde wordt onder meer gebruikt voor gemeentelijke belastingen.",
    },
    {
      q: "Ik ben het niet eens met mijn WOZ-waarde. Wat kan ik doen?",
      a: "Bekijk eerst het taxatieverslag. Bent u het er niet mee eens, maak dan binnen zes weken na de beschikking bezwaar via “Bezwaar maken tegen WOZ-waarde”.",
    },
    {
      q: "Waar vind ik het taxatieverslag?",
      a: "Het taxatieverslag kunt u op deze pagina downloaden. Daarin staat hoe de gemeente de waarde heeft bepaald.",
    },
  ],
  parkeren: [
    {
      q: "Hoe vraag ik een parkeervergunning aan?",
      a: "Gebruik de actie “Parkeervergunning aanvragen”. U heeft uw kenteken en adresgegevens nodig.",
    },
    {
      q: "Hoe wijzig ik het kenteken op mijn vergunning?",
      a: "Met de actie “Kenteken wijzigen” past u het kenteken aan dat aan uw vergunning is gekoppeld.",
    },
    {
      q: "Kan ik een vergunning voor bezoek of mantelzorg aanvragen?",
      a: "Ja, u kunt een bezoekersregeling of mantelzorgvergunning aanvragen via de acties op deze pagina.",
    },
  ],
  erfpacht: [
    {
      q: "Wat is erfpacht?",
      a: "Bij erfpacht gebruikt u grond van de gemeente en betaalt u daarvoor een vergoeding (de canon). De grond blijft eigendom van de gemeente.",
    },
    {
      q: "Kan ik de canon afkopen?",
      a: "Ja. Met “Afkoop canon aanvragen” vraagt u een berekening aan om de toekomstige canon in één keer af te kopen.",
    },
    {
      q: "Wanneer moet ik de erfpachtcanon betalen?",
      a: "De betaaltermijn staat op uw factuur. Openstaande facturen ziet u terug bij uw taken en op deze pagina.",
    },
  ],
  vakantieverhuur: [
    {
      q: "Moet ik vakantieverhuur melden?",
      a: "Ja. Verhuurt u uw woning tijdelijk aan toeristen, dan bent u verplicht dit per keer te melden via “Vakantieverhuur melden”.",
    },
    {
      q: "Hoeveel nachten mag ik mijn woning verhuren?",
      a: "Het maximum verschilt per gemeente. Uw resterende nachten ziet u in de nachtteller op deze pagina.",
    },
    {
      q: "Wat gebeurt er als ik me niet aan de regels houd?",
      a: "Bij overtreding kan de gemeente een boete opleggen. Bekijk de voorwaarden om te zien wat is toegestaan.",
    },
  ],
  agenda: [
    {
      q: "Hoe wijzig of annuleer ik een afspraak?",
      a: "Bij een afspraak die u zelf mag wijzigen, gebruikt u “Wijzigen of annuleren”. Soms moet u hiervoor contact opnemen met de organisatie.",
    },
    {
      q: "Kan ik een afspraak in mijn eigen agenda zetten?",
      a: "Ja. Met “Zet in eigen agenda” voegt u de afspraak toe aan uw persoonlijke agenda-app.",
    },
    {
      q: "Krijg ik een herinnering voor een afspraak?",
      a: "Als u sms- of e-mailmeldingen heeft ingesteld onder Mijn gegevens, krijgt u vooraf een herinnering.",
    },
  ],
  plan: [
    {
      q: "Wat is Mijn plan?",
      a: "Mijn plan brengt uw doelen, taken, afspraken en contactpersonen samen, zodat u overzicht houdt over wat er speelt en wie u kan helpen.",
    },
    {
      q: "Wie is mijn contactpersoon?",
      a: "Uw consulent staat vermeld onder Contactpersonen. U kunt hen bellen met vragen over uw situatie of ondersteuning.",
    },
  ],
  gegevens: [
    {
      q: "Hoe wijzig ik mijn gegevens?",
      a: "Achter elk onderdeel staat een link “Wijzigen”. Persoonsgegevens zoals uw naam wijzigt u via de Basisregistratie Personen (BRP) bij uw gemeente.",
    },
    {
      q: "Waarom kan ik mijn naam of geboortedatum niet zelf aanpassen?",
      a: "Deze gegevens komen uit de Basisregistratie Personen. Klopt er iets niet, neem dan contact op met uw gemeente.",
    },
    {
      q: "Hoe stel ik in waarover ik meldingen krijg?",
      a: "Onder Meldingen stelt u in of u e-mail of sms wilt ontvangen over nieuwe berichten, afspraken en herinneringen.",
    },
  ],
};

// Merkidentiteit per huisstijl: logo (lint = staand Rijkslint, mark = gemeentewapen) + naam.
type Brand = { name: string; lint?: string; mark?: string };
const brands: Record<string, Brand> = {
  rijk: { name: "MijnOverheid", lint: "rijksoverheid-lint.svg" },
  utrecht: { name: "Gemeente Utrecht", mark: "logos/utrecht.svg" },
  denhaag: { name: "Den Haag", mark: "logos/denhaag.svg" },
  basis: { name: "Gemeente Veenendaal" },
};

function Icon({ id, className = "icon" }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}

function useHashRoute(): [PageKey, (p: PageKey) => void] {
  const read = (): PageKey => {
    const h = window.location.hash.replace(/^#\/?/, "") as PageKey;
    return h in labels ? h : "home";
  };
  const [page, setPage] = useState<PageKey>(read);
  useEffect(() => {
    const onHash = () => setPage(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (p: PageKey) => {
    window.location.hash = `/${p}`;
    window.scrollTo(0, 0);
  };
  return [page, go];
}

function navLink(go: (p: PageKey) => void, p: PageKey) {
  return (e: { preventDefault: () => void }) => {
    e.preventDefault();
    go(p);
  };
}

// Async-status van data uit een API-call. We tonen bewust géén hardcoded
// fallback: bij 'loading' een laadindicator, bij 'error' een foutmelding met
// opnieuw-knop, en alleen bij 'ready' de echte (mogelijk lege) data.
type Loadable<T> = { status: "loading" | "ready" | "error"; data: T; error?: string };

// Toont laad-/foutstatus en rendert children pas als de data binnen is.
function DataBoundary({
  state,
  naam,
  onRetry,
  children,
}: {
  state: Loadable<unknown>;
  naam: string;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (state.status === "loading") {
    return (
      <div className="data-status data-status--loading" role="status" aria-live="polite">
        <span className="data-spinner" aria-hidden="true" />
        <span>{naam} worden geladen…</span>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="data-status data-status--error" role="alert">
        <span className="data-status__icon" aria-hidden="true">
          ⚠
        </span>
        <div className="data-status__body">
          <strong>{naam} konden niet worden geladen</strong>
          {state.error && <span className="data-status__detail">{state.error}</span>}
        </div>
        <button type="button" className="button-primary" onClick={onRetry}>
          Opnieuw proberen
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

// Subtiele markering voor pagina's die (nog) niet aan een API hangen: de
// getoonde gegevens zijn voorbeelddata. Alleen zichtbaar als de API-inspector
// openstaat — dan is de markering relevant voor wie de koppelingen bekijkt.
const InspectorOpenContext = createContext(false);

function DemoBadge() {
  const inspectorOpen = useContext(InspectorOpenContext);
  if (!inspectorOpen) return null;
  return (
    <span
      className="demo-badge"
      title="Deze gegevens komen nog niet uit een API — dit is voorbeelddata"
    >
      <span aria-hidden="true">ⓘ</span> Voorbeelddata
    </span>
  );
}

function HomePage({
  go,
  taken,
  cases,
  onTaakClick,
  onRetryTaken,
  onRetryZaken,
  chat,
  voice,
}: {
  go: (p: PageKey) => void;
  taken: Loadable<{ open: Taak[]; done: Taak[] }>;
  cases: Loadable<any[]>;
  onTaakClick: (t: Taak) => void;
  onRetryTaken: () => void;
  onRetryZaken: () => void;
  chat: ChatApi;
  voice: VoiceApi;
}) {
  const takenOpen = taken.data.open;
  const openZaken = cases.data.filter(
    (z) => z.status === "Open" || z.status?.toLowerCase() === "open",
  );

  // Een gesprek starten vanaf Home is een echte navigatie naar /chat, zodat de
  // back-knop terugkeert naar deze overzichtspagina.
  const startChat = () => go("chat");

  return (
    <>
      <h1>Hallo Jeroen van Drouwen</h1>
      <p className="intro">
        In ‘Mijn omgeving’ kunt u zelf uw persoonlijke zaken regelen wanneer het u uitkomt. Stel
        hieronder uw vraag, of bekijk uw taken en zaken.
      </p>

      <section className="home-hero" aria-label="Vraag de assistent">
        <div className="home-hero__head">
          <span className="home-hero__icon" aria-hidden="true">
            <Icon id="icon-chat" />
          </span>
          <div>
            <h2 className="home-hero__title">Vraag de AI-assistent</h2>
            <p className="home-hero__sub">
              Eén aanspreekpunt voor uw gemeente en het Rijk — over uw taken, zaken, berichten en
              afspraken.
            </p>
          </div>
        </div>
        <ChatComposer
          chat={chat}
          variant="hero"
          placeholder="Waarmee kan ik u helpen?"
          rotatingPlaceholders={SUGGESTIONS}
          afterSend={startChat}
          forceNew
          voice={voice}
        />
      </section>

      <section className="section">
        <h2>Mijn taken</h2>
        {taken.status === "ready" && (
          <a className="section__link" href="#/taken" onClick={navLink(go, "taken")}>
            Bekijk alle taken ({takenOpen.length}) <Icon id="icon-arrow" />
          </a>
        )}
        <DataBoundary state={taken} naam="Taken" onRetry={onRetryTaken}>
          <div className="panel taken-panel">
            {takenOpen.length ? (
              takenOpen
                .slice(0, 4)
                .map((t) => <TaakPanelRow key={t.titel} taak={t} onClick={() => onTaakClick(t)} />)
            ) : (
              <p className="panel-empty">Er zijn geen openstaande taken.</p>
            )}
          </div>
        </DataBoundary>
      </section>

      <section className="section">
        <h2>Mijn lopende zaken</h2>
        {cases.status === "ready" && (
          <a className="section__link" href="#/zaken" onClick={navLink(go, "zaken")}>
            Bekijk alle zaken ({cases.data.length}) <Icon id="icon-arrow" />
          </a>
        )}
        <DataBoundary state={cases} naam="Zaken" onRetry={onRetryZaken}>
          {openZaken.length ? (
            <div className="cards">
              {openZaken.slice(0, 3).map((z) => (
                <a
                  className="card"
                  href="#/zaken"
                  key={z.uuid || z.naam}
                  onClick={navLink(go, "zaken")}
                >
                  <span className="card__title">{z.naam}</span>
                  <span className="card__id">
                    {z.zaaknummer || z.status} <Icon id="icon-arrow" />
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="panel-empty">Er zijn geen lopende zaken.</p>
          )}
        </DataBoundary>
      </section>
    </>
  );
}

function TaakPanelRow({
  taak,
  onClick,
  done,
}: {
  taak: Taak;
  onClick?: () => void;
  done?: boolean;
}) {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };
  return (
    <a className="task" href="#/brief" onClick={handleClick}>
      <span className="task__main">
        <span className="task__title">
          {taak.titel}
          {done && (
            <span className="task__pill task__pill--done">
              <Icon id="icon-check" className="icon task__pill-icon" /> Afgerond
            </span>
          )}
          {taak.ai && <span className="task__pill">Ingevuld door AI</span>}
        </span>
        <span className="task__org">{taak.org}</span>
      </span>
      {taak.terInfo ? (
        <span className="task__info">Ter info</span>
      ) : (
        <span className="task__deadline">{taak.deadline}</span>
      )}
      <span className="task__arrow">
        <Icon id="icon-arrow" />
      </span>
    </a>
  );
}

function TabCount({ children }: { children: number }) {
  return <span className="tab-count">{children}</span>;
}

function TakenPage({
  taken,
  onTaakClick,
  onRetry,
}: {
  taken: Loadable<{ open: Taak[]; done: Taak[] }>;
  onTaakClick: (t: Taak) => void;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState("");
  const takenOpen = taken.data.open;
  const takenDone = taken.data.done;

  const matches = (t: Taak) =>
    query.trim() === "" || `${t.titel} ${t.org}`.toLowerCase().includes(query.toLowerCase());
  const openFiltered = takenOpen.filter(matches);
  const doneFiltered = takenDone.filter(matches);

  const renderSearchBar = () => (
    <div className="zaken-toolbar">
      <input
        type="search"
        placeholder="Zoek in taken…"
        aria-label="Zoek in taken"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button className="button-primary" type="button">
        Zoeken
      </button>
    </div>
  );

  return (
    <>
      <h1>Mijn taken</h1>
      <p className="page-sub">Alle taken en brieven uit uw nabestaandendossier.</p>

      <DataBoundary state={taken} naam="Taken" onRetry={onRetry}>
        <Tabs.Root defaultValue="open" className="tabs">
          <Tabs.List className="tabs__list">
            <Tabs.Trigger value="open">
              Open taken <TabCount>{takenOpen.length}</TabCount>
            </Tabs.Trigger>
            <Tabs.Trigger value="afgerond">
              Afgerond <TabCount>{takenDone.length}</TabCount>
            </Tabs.Trigger>
            <Tabs.Indicator className="tabs__indicator" />
          </Tabs.List>

          <Tabs.Content value="open">
            {renderSearchBar()}

            <div className="panel taken-panel">
              {openFiltered.length ? (
                openFiltered.map((t) => (
                  <TaakPanelRow key={t.titel} taak={t} onClick={() => onTaakClick(t)} />
                ))
              ) : (
                <p className="panel-empty">Geen taken gevonden.</p>
              )}
            </div>
          </Tabs.Content>

          <Tabs.Content value="afgerond">
            {renderSearchBar()}

            <div className="panel taken-panel">
              {doneFiltered.length ? (
                doneFiltered.map((t) => (
                  <TaakPanelRow key={t.titel} taak={t} done onClick={() => onTaakClick(t)} />
                ))
              ) : (
                <p className="panel-empty">Geen afgeronde taken gevonden.</p>
              )}
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </DataBoundary>
    </>
  );
}

const parseDeadlineDate = (t: Taak): Date | null => {
  if (t.raw?.deadline) {
    const d = new Date(t.raw.deadline);
    if (!isNaN(d.getTime())) return d;
  }
  if (t.deadline) {
    const match = t.deadline.match(/vóór\s+(\d+)\s+([a-z]+)\s+(\d{4})/i);
    if (match) {
      const day = parseInt(match[1], 10);
      const monthStr = match[2].toLowerCase();
      const year = parseInt(match[3], 10);
      const months = [
        "januari",
        "februari",
        "maart",
        "april",
        "mei",
        "juni",
        "juli",
        "augustus",
        "september",
        "oktober",
        "november",
        "december",
      ];
      const monthIdx = months.indexOf(monthStr);
      if (monthIdx !== -1) {
        return new Date(year, monthIdx, day);
      }
    }
  }
  return null;
};

const getDaysUntil = (date: Date): number => {
  const diffTime = date.getTime() - Date.now();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getDagenTekst = (days: number): string => {
  if (days < 0) return `${-days} ${-days === -1 ? "dag" : "dagen"} te laat`;
  if (days === 0) return "vandaag";
  return `over ${days} ${days === 1 ? "dag" : "dagen"}`;
};

const getUrgencyLevel = (days: number | null): "urgent" | "soon" | "later" => {
  if (days === null) return "later";
  if (days <= 14) return "urgent";
  if (days <= 60) return "soon";
  return "later";
};

function DossierPage({
  taken,
  onTaakClick,
  onRetry,
}: {
  taken: Loadable<{ open: Taak[]; done: Taak[] }>;
  onTaakClick: (t: Taak) => void;
  onRetry: () => void;
}) {
  const [timelineOpen, setTimelineOpen] = useState(true);

  if (taken.status !== "ready") {
    return (
      <article className="stacked-page plannen-page">
        <section className="plannen-intro">
          <h1>Nabestaandendossier</h1>
        </section>
        <DataBoundary state={taken} naam="Taken" onRetry={onRetry}>
          {null}
        </DataBoundary>
      </article>
    );
  }

  const takenOpen = taken.data.open;
  const takenDone = taken.data.done;

  // 1. Calculate progress metrics
  const actionOpen = takenOpen.filter((t) => !t.terInfo && !t.automatisch && t.cat !== "geenactie");
  const actionDone = takenDone.filter((t) => !t.terInfo && !t.automatisch);

  const totalActions = actionOpen.length + actionDone.length;
  const doneActions = actionDone.length;
  const percent = totalActions ? Math.round((doneActions / totalActions) * 100) : 0;

  const autoCount = [
    ...takenOpen.filter((t) => t.automatisch),
    ...takenDone.filter((t) => t.automatisch),
  ].length;

  // 2. Featured task: open actionable task with shortest deadline
  const tasksWithDates = actionOpen
    .map((t) => ({ task: t, date: parseDeadlineDate(t) }))
    .filter((item) => item.date !== null)
    .sort((a, b) => a.date!.getTime() - b.date!.getTime());

  const featured = tasksWithDates[0] || null;
  let featuredKop = "";
  let featuredDetail = "";
  if (featured) {
    const days = getDaysUntil(featured.date!);
    const org = featured.task.org;
    if (days < 0) {
      featuredKop = "1 taak is verlopen — pak deze met voorrang op";
    } else if (days <= 7) {
      featuredKop = "1 taak moet u deze week oppakken";
    } else if (days <= 14) {
      featuredKop = "1 taak verloopt binnen twee weken";
    } else {
      featuredKop = "1 taak vraagt als eerste uw aandacht";
    }
    const daysText = getDagenTekst(days);
    featuredDetail = `${featured.task.titel} (${org}, ${featured.task.deadline} — ${daysText}).`;
  }

  // 3. Preview lists
  const belangrijkste = takenOpen.filter(
    (t) => t.cat === "belangrijkste" && !t.ai && !t.terInfo && !t.automatisch,
  );
  const ingevuld = takenOpen.filter((t) => t.cat === "ingevuld" || t.ai);
  const geenActie = [
    ...takenOpen.filter((t) => t.cat === "geenactie" || t.terInfo || t.automatisch),
    ...takenDone,
  ];

  const renderPreviewRow = (t: Taak) => {
    const isDone = takenDone.some((done) => done.titel === t.titel);

    // badge logic
    let badge = null;
    if (isDone) {
      badge = <span className="plan-status is-done">✓ Afgerond</span>;
    } else if (t.automatisch) {
      badge = <span className="plan-status is-auto">✓ Geregeld</span>;
    } else if (t.terInfo) {
      badge = <span className="plan-status is-info">Ter info</span>;
    } else if (t.deadline) {
      const date = parseDeadlineDate(t);
      if (date) {
        const days = getDaysUntil(date);
        if (days < 0) {
          badge = <span className="urgent-badge">Te laat</span>;
        } else if (days <= 14) {
          badge = (
            <span className="urgent-badge">
              Nog {days} {days === 1 ? "dag" : "dagen"}
            </span>
          );
        } else {
          badge = <span className="task-due">{t.deadline}</span>;
        }
      } else {
        badge = <span className="task-due">{t.deadline}</span>;
      }
    }

    return (
      <a
        key={t.titel}
        className="plan-preview-row"
        href="#/brief"
        onClick={(e) => {
          e.preventDefault();
          onTaakClick(t);
        }}
      >
        <span className="plan-preview-row-main">
          <span className="plan-preview-row-title">
            {t.titel}
            {t.ai && <span className="taak-label">Ingevuld door AI</span>}
          </span>
          <small className="plan-preview-row-org">{t.org}</small>
        </span>
        {badge}
        <span className="arrow" aria-hidden="true">
          →
        </span>
      </a>
    );
  };

  const renderPreviewBox = (title: string, tasks: Taak[]) => {
    return (
      <section className="plan-preview" key={title}>
        <div className="plan-preview-head">
          <h3 className="plan-preview-title">
            {title} <span className="plannen-section-count">{tasks.length}</span>
          </h3>
          <a className="plan-preview-all" href="#/taken">
            Bekijk alle taken <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="plan-preview-list">
          {tasks.length ? (
            tasks.slice(0, 3).map(renderPreviewRow)
          ) : (
            <p className="empty-line">Geen taken.</p>
          )}
        </div>
      </section>
    );
  };

  // 4. Timeline
  const timelineItems = actionOpen
    .map((t) => ({ task: t, date: parseDeadlineDate(t) }))
    .filter((item) => item.date !== null)
    .sort((a, b) => a.date!.getTime() - b.date!.getTime());

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let lastKey = "";
  const timelineElements = [];

  for (const item of timelineItems) {
    const d = item.date!;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const days = getDaysUntil(d);
    const urgency = getUrgencyLevel(days);

    if (key !== lastKey) {
      lastKey = key;
      const maand = d.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
      const isCurrentMonth = d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      timelineElements.push(
        <p key={`month-${key}`} className="plan-tl-month">
          {isCurrentMonth ? `Deze maand · ${maand}` : maand}
        </p>,
      );
    }

    const org = item.task.org;
    const isUrgent = urgency === "urgent";
    const shortDate = d.toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
    const daysText = getDagenTekst(days);

    timelineElements.push(
      <a
        key={`item-${item.task.titel}`}
        className={`plan-tl-item plan-tl-${urgency}`}
        href="#/brief"
        onClick={(e) => {
          e.preventDefault();
          onTaakClick(item.task);
        }}
      >
        <span className="plan-tl-dot" aria-hidden="true" />
        <strong>{item.task.titel}</strong>
        <small>
          {org} · vóór {shortDate} ·{" "}
          <span className={isUrgent ? "plan-tl-days-urgent" : ""}>{daysText}</span>
        </small>
      </a>,
    );
  }

  // 5. Documents / Accordion
  const infoBerichten = takenOpen.filter((t) => t.terInfo || t.cat === "geenactie");

  const condoleanceBody = infoBerichten.length ? (
    <div className="plan-doc-links">
      {infoBerichten.map((t) => (
        <a
          key={t.titel}
          href="#/brief"
          onClick={(e) => {
            e.preventDefault();
            onTaakClick(t);
          }}
        >
          <span>{t.titel}</span>
          <small>{t.org}</small>
        </a>
      ))}
    </div>
  ) : (
    <p>Er zijn op dit moment geen informatieve berichten.</p>
  );

  const documentenItems = [
    {
      icon: "icon-mail",
      titel: "Condoleanceberichten van organisaties",
      sub: "Berichten die geen actie vragen, ter informatie",
      body: condoleanceBody,
    },
    {
      icon: "icon-folder",
      titel: "Akte van overlijden en verklaring van erfrecht",
      sub: "Officiële documenten om te bewaren en te delen",
      body: (
        <>
          <p>
            De <strong>akte van overlijden</strong> krijgt u van de gemeente waar Cees is overleden.
            U heeft deze nodig om het overlijden door te geven aan banken, verzekeraars en
            pensioenfondsen.
          </p>
          <p>
            Een <strong>verklaring van erfrecht</strong> vraagt u aan bij een notaris. Daarmee toont
            u aan dat u de erfgenaam bent en mag u bankzaken regelen namens de nalatenschap.
          </p>
        </>
      ),
    },
    {
      icon: "icon-euro",
      titel: "Waar heb ik mogelijk recht op?",
      sub: "Nabestaandenuitkering (Anw), pensioen, toeslagen",
      body: (
        <ul className="plan-doc-list">
          <li>
            <strong>Anw-nabestaandenuitkering (SVB)</strong> — als u aan de voorwaarden voldoet,
            bijvoorbeeld een kind onder de 18 of arbeidsongeschiktheid.
          </li>
          <li>
            <strong>Nabestaandenpensioen</strong> — via het pensioenfonds of de verzekeraar van
            Cees.
          </li>
          <li>
            <strong>Toeslagen</strong> — uw recht op zorg- of huurtoeslag kan veranderen nu uw
            situatie wijzigt.
          </li>
        </ul>
      ),
    },
    {
      icon: "icon-clipboard",
      titel: "Veelgestelde vragen",
      sub: "Antwoorden op veelvoorkomende vragen na een overlijden",
      body: (
        <div className="plan-doc-faq">
          <p>
            <strong>Moet ik alles meteen regelen?</strong>
            <br />
            Nee. Veel zaken regelt de overheid automatisch. Pak eerst de taken met een deadline op;
            de rest heeft de tijd.
          </p>
          <p>
            <strong>Waarom staan sommige brieven op naam van Cees of ‘de erven’?</strong>
            <br />
            Organisaties weten nog niet altijd wie de contactpersoon is. Geeft u dit door, dan komt
            de post op uw naam.
          </p>
        </div>
      ),
    },
  ];

  return (
    <article className="stacked-page plannen-page">
      <section className="plannen-intro">
        <h1>Nabestaandendossier</h1>
        <p className="page-subtitle">
          Na het overlijden van uw partner Cees moet er veel worden geregeld. Wij hebben de brieven
          van de overheid voor u gebundeld zodat u ziet wat er{" "}
          <strong>al automatisch is geregeld</strong> en wat er nog <strong>uw aandacht</strong>{" "}
          vraagt.
        </p>
      </section>

      {featured && (
        <a
          className="plan-featured"
          href="#/brief"
          onClick={(e) => {
            e.preventDefault();
            onTaakClick(featured.task);
          }}
        >
          <span className="plan-featured-icon" aria-hidden="true">
            ⚠
          </span>
          <span className="plan-featured-body">
            <strong>{featuredKop}</strong>
            <span>{featuredDetail}</span>
          </span>
          <span className="arrow" aria-hidden="true">
            →
          </span>
        </a>
      )}

      <section className="plannen-progress" aria-label="Voortgang">
        <div className="plannen-progress-head">
          <strong>
            {doneActions} van {totalActions} acties afgerond
          </strong>
          <span>{percent}%</span>
        </div>
        <div className="plannen-progress-bar">
          <span style={{ width: `${percent}%` }} />
        </div>
        {autoCount > 0 && (
          <p className="plannen-progress-note">
            ✓ {autoCount} {autoCount === 1 ? "zaak is" : "zaken zijn"} al automatisch voor u
            geregeld door de overheid
          </p>
        )}
      </section>

      <div className="plan-preview-grid">
        {renderPreviewBox("Belangrijkste taken", belangrijkste)}
        {renderPreviewBox("Ingevulde taken", ingevuld)}
        {renderPreviewBox("Geen actie nodig", geenActie)}
      </div>

      {timelineItems.length > 0 && (
        <details
          className="plan-timeline"
          open={timelineOpen}
          onToggle={(e) => setTimelineOpen(e.currentTarget.open)}
        >
          <summary className="plan-timeline-head">
            <span className="plan-block-title">Wat komt er nog aan</span>
            <span className="plan-timeline-chevron" aria-hidden="true">
              ⌃
            </span>
          </summary>
          <a className="button plan-timeline-full" href="#/taken" style={{ marginTop: 0 }}>
            Volledig overzicht <span aria-hidden="true">→</span>
          </a>
          <div className="plan-timeline-body">
            <div className="plan-tl-legend">
              <span>
                <i className="plan-tl-dot plan-tl-urgent" /> Urgent
              </span>
              <span>
                <i className="plan-tl-dot plan-tl-soon" /> Belangrijk, tijd genoeg
              </span>
              <span>
                <i className="plan-tl-dot plan-tl-later" /> Geen haast
              </span>
            </div>
            <div className="plan-tl-track">{timelineElements}</div>
          </div>
        </details>
      )}

      <section className="plan-docs">
        <h2 className="plan-block-title">Belangrijke documenten</h2>
        <p className="plan-block-sub">Informatie en stukken rondom het overlijden van Cees.</p>

        <Accordion.Root collapsible className="plan-doc-accordion">
          {documentenItems.map((d) => (
            <Accordion.Item key={d.titel} value={d.titel} className="plan-doc">
              <Accordion.ItemTrigger className="plan-doc-head">
                <Icon id={d.icon} className="icon plan-doc-icon" />
                <span className="plan-doc-text">
                  <strong>{d.titel}</strong>
                  <small>{d.sub}</small>
                </span>
                <Accordion.ItemIndicator className="plan-doc-chevron">›</Accordion.ItemIndicator>
              </Accordion.ItemTrigger>
              <Accordion.ItemContent className="plan-doc-body">{d.body}</Accordion.ItemContent>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </section>
    </article>
  );
}

function BerichtenPage({
  go,
  conversations,
  onRetry,
}: {
  go: (p: PageKey) => void;
  conversations: Loadable<any[]>;
  onRetry: () => void;
}) {
  const berichten = conversations.data;
  return (
    <>
      <h1>Mijn berichten</h1>
      <p className="page-sub">
        Post van de overheid na het overlijden van uw partner Cees, gebundeld vanuit uw
        Nabestaandendossier.
      </p>
      <DataBoundary state={conversations} naam="Berichten" onRetry={onRetry}>
        <div className="panel berichten">
          {berichten.length ? (
            berichten.map((b) => (
              <a className="task" href="#/brief" key={b.titel} onClick={navLink(go, "brief")}>
                <span className="task__main">
                  <span className="task__title">
                    {b.ongelezen && <span className="bericht__dot" aria-label="Ongelezen" />}
                    {b.titel}
                  </span>
                  <span className="task__org">{b.org}</span>
                </span>
                <span className="task__deadline">{b.datum}</span>
                <span className="task__arrow">
                  <Icon id="icon-arrow" />
                </span>
              </a>
            ))
          ) : (
            <p className="panel-empty">U heeft geen berichten.</p>
          )}
        </div>
      </DataBoundary>
    </>
  );
}

function ZakenPage({
  cases: casesState,
  onCaseClick,
  onRetry,
}: {
  cases: Loadable<any[]>;
  onCaseClick: (uuid: string) => void;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState("");
  const cases = casesState.data;

  const matches = (z: any) =>
    query.trim() === "" || `${z.naam} ${z.zaaknummer}`.toLowerCase().includes(query.toLowerCase());

  const openCases = cases.filter((z) => z.status === "Open" || z.status?.toLowerCase() === "open");
  const closedCases = cases.filter(
    (z) => z.status === "Gesloten" || z.status?.toLowerCase() === "gesloten",
  );

  const openFiltered = openCases.filter(matches);
  const closedFiltered = closedCases.filter(matches);

  const renderCaseRow = (z: any) => {
    const isOpen = z.status?.toLowerCase() === "open";
    return (
      <a
        className="task"
        href={`#/zaken/${z.uuid}`}
        key={z.uuid || z.naam}
        onClick={(e) => {
          e.preventDefault();
          onCaseClick(z.uuid);
        }}
      >
        <span className="task__main">
          <span className="task__title">{z.naam}</span>
        </span>
        <span className="task__meta">
          <span className="task__deadline">{z.datumAanvraag || z.datum}</span>
          <span
            className={`status-badge ${isOpen ? "status-badge--open" : "status-badge--closed"}`}
          >
            {z.status}
          </span>
        </span>
        <span className="task__arrow">
          <Icon id="icon-arrow" />
        </span>
      </a>
    );
  };

  return (
    <>
      <h1>Mijn zaken</h1>
      <p className="page-sub">
        Volg de status en geschiedenis van uw lopende en gesloten aanvragen.
      </p>

      <DataBoundary state={casesState} naam="Zaken" onRetry={onRetry}>
        <Tabs.Root defaultValue="open" className="tabs">
          <Tabs.List className="tabs__list">
            <Tabs.Trigger value="open">
              Lopende zaken <TabCount>{openCases.length}</TabCount>
            </Tabs.Trigger>
            <Tabs.Trigger value="gesloten">
              Gesloten <TabCount>{closedCases.length}</TabCount>
            </Tabs.Trigger>
            <Tabs.Indicator className="tabs__indicator" />
          </Tabs.List>

          <Tabs.Content value="open">
            <div className="zaken-toolbar">
              <input
                type="search"
                placeholder="Zoek in zaken…"
                aria-label="Zoek in zaken"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button className="button-primary" type="button">
                Zoeken
              </button>
            </div>

            <div className="panel zaken">
              {openFiltered.length ? (
                openFiltered.map(renderCaseRow)
              ) : (
                <p className="panel-empty">Geen lopende zaken gevonden.</p>
              )}
            </div>
          </Tabs.Content>

          <Tabs.Content value="gesloten">
            <div className="zaken-toolbar">
              <input
                type="search"
                placeholder="Zoek in zaken…"
                aria-label="Zoek in zaken"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button className="button-primary" type="button">
                Zoeken
              </button>
            </div>

            <div className="panel zaken">
              {closedFiltered.length ? (
                closedFiltered.map(renderCaseRow)
              ) : (
                <p className="panel-empty">Geen gesloten zaken gevonden.</p>
              )}
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </DataBoundary>
    </>
  );
}

function ZaakDetailPage({
  selectedCase,
  go,
  onRetry,
}: {
  selectedCase: Loadable<any> | null;
  go: (p: PageKey) => void;
  onRetry: () => void;
}) {
  if (!selectedCase) return <p>Geen zaak geselecteerd.</p>;
  if (selectedCase.status !== "ready") {
    return (
      <>
        <a className="back-link" href="#/zaken" onClick={navLink(go, "zaken")}>
          <Icon id="icon-arrow" /> Terug naar overzicht
        </a>
        <DataBoundary state={selectedCase} naam="Zaak" onRetry={onRetry}>
          {null}
        </DataBoundary>
      </>
    );
  }
  const zaak = selectedCase.data;

  return (
    <>
      <a className="back-link" href="#/zaken" onClick={navLink(go, "zaken")}>
        <Icon id="icon-arrow" /> Terug naar overzicht
      </a>

      <h1>{zaak.naam}</h1>

      {zaak.openstaandeTaken?.map((taak: any) => (
        <div key={taak.uuid} className="alert--warning zaak-alert" role="note">
          <div>
            <strong className="zaak-alert__title">{taak.titel?.nl}</strong>
            {taak.deadline && (
              <span className="zaak-alert__deadline">⚠ {formatDeadline(taak.deadline)}</span>
            )}
          </div>
          <a className="button-primary" href={taak.uitvoering?.canonicalUrl}>
            Uitvoeren
          </a>
        </div>
      ))}

      {/* Status Timeline */}
      <section className="section">
        <h2>Statusverloop</h2>
        <ol className="status-timeline">
          {zaak.statushistorie?.map((step: any) => {
            const isCompleted = step.status === "voltooid";
            const isCurrent = step.status === "lopend";
            const stepClass = isCompleted
              ? "status-step status-step--done"
              : isCurrent
                ? "status-step status-step--current"
                : "status-step";

            return (
              <li key={step.nummer} className={stepClass}>
                <span className="status-step__line" aria-hidden="true" />
                <span className="status-step__marker">{isCompleted ? "✓" : step.nummer}</span>
                <div className="status-step__body">
                  <strong className="status-step__title">{step.titel}</strong>
                  {step.toelichting?.map((desc: string, dIdx: number) => (
                    <p key={dIdx} className="status-step__desc">
                      {desc}
                    </p>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Case Details */}
      <section className="section">
        <h2>Details</h2>
        <dl className="datalist">
          <dt>Datum aanvraag</dt>
          <dd>
            {new Date(zaak.datumAanvraag).toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </dd>
          <dt>Zaaknummer</dt>
          <dd className="dd-mono">{zaak.zaaknummer}</dd>
          <dt>Status</dt>
          <dd>{zaak.huidigeStatus || formatZaakStatus(zaak.status)}</dd>
        </dl>
      </section>

      {/* Case Documents */}
      <section className="section">
        <h2>Documenten</h2>
        <div className="panel zaak-rows">
          {zaak.documenten?.map((doc: any, idx: number) => (
            <div key={idx} className="zaak-doc">
              <div className="zaak-doc__name">
                <Icon id="icon-clipboard" />
                <span>{doc.naam}</span>
                <span className="zaak-doc__type">
                  ({formatBestandstype(doc.formaat)}, {formatBestandsgrootte(doc.bestandsgrootte)})
                </span>
              </div>
              <span>
                {new Date(doc.datum).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="zaak-doc__bron">
                {doc.bron === "burger" ? "Door u geüpload" : "Van de gemeente"}
              </span>
              <a className="zaak-doc__download" href={doc.downloadUrl}>
                Download
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Timeline */}
      <section className="section">
        <h2>Eerdere contactmomenten</h2>
        <div className="panel zaak-rows">
          {zaak.contactmomenten?.map((contact: any, idx: number) => (
            <div key={idx} className="zaak-contact">
              <span className="zaak-contact__date">
                {new Date(contact.datum).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span>
                <span className="zaak-contact__channel">{contact.kanaal}</span>
              </span>
              <span>{contact.tekst}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

const KLANT_PARTIJ_UUID = "a8f3c1d2-7e44-4b1a-9c0f-123456789abc";

type GegevensData = {
  email?: string;
  telefoon?: string;
  naam?: string;
  bsn?: string;
  woonadres?: string;
  postadres?: string;
};

function formatPartijAdres(adres?: {
  straatnaam?: string;
  huisnummer?: number;
  huisnummertoevoeging?: string;
  postcode?: string;
  stad?: string;
  adresregel1?: string;
  adresregel2?: string;
  adresregel3?: string;
}): string | undefined {
  if (!adres) return undefined;
  if (adres.straatnaam) {
    const nr = [adres.huisnummer, adres.huisnummertoevoeging].filter(Boolean).join("");
    const plaats = [adres.postcode, adres.stad].filter(Boolean).join(" ");
    return [ `${adres.straatnaam} ${nr}`.trim(), plaats ].filter(Boolean).join(", ");
  }
  const regels = [adres.adresregel1, adres.adresregel2, adres.adresregel3].filter(Boolean);
  return regels.length ? regels.join(", ") : undefined;
}

function maskBsn(objectId?: string): string | undefined {
  if (!objectId) return undefined;
  const digits = objectId.replace(/\D/g, "");
  if (digits.length < 3) return undefined;
  return `••••••${digits.slice(-3)}`;
}

function mapPartijToGegevens(partij: Record<string, any>): GegevensData {
  const digitale: any[] =
    partij._expand?.digitale_adressen ??
    (Array.isArray(partij.digitaleAdressen) &&
    partij.digitaleAdressen[0]?.adres
      ? partij.digitaleAdressen
      : []);

  const emailEntry = digitale.find((d) => d.soortDigitaalAdres === "email");
  const phoneEntry = digitale.find((d) => d.soortDigitaalAdres === "telefoonnummer");

  const contact = partij.partijIdentificatie?.contactnaam;
  const naam =
    partij.volledigeNaam ||
    [contact?.voornaam, contact?.voorvoegselAchternaam, contact?.achternaam]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim() ||
    undefined;

  const bsnEntry = (partij.partijIdentificatoren ?? []).find(
    (pi: any) => pi.partijIdentificator?.codeSoortObjectId === "bsn",
  );

  const woonadres = formatPartijAdres(partij.bezoekadres);
  const postRaw = formatPartijAdres(partij.correspondentieadres);
  const postadres =
    postRaw && woonadres && postRaw === woonadres ? "Gelijk aan woonadres" : postRaw;

  const telefoonRaw = phoneEntry?.adres;
  const telefoon =
    telefoonRaw && /^0\d{9}$/.test(telefoonRaw)
      ? `${telefoonRaw.slice(0, 2)} ${telefoonRaw.slice(2)}`
      : telefoonRaw;

  return {
    email: emailEntry?.adres,
    telefoon,
    naam,
    bsn: maskBsn(bsnEntry?.partijIdentificator?.objectId),
    woonadres,
    postadres,
  };
}

function GegevensPage({
  gegevens,
  onRetry,
}: {
  gegevens: Loadable<GegevensData>;
  onRetry: () => void;
}) {
  const g = gegevens.data;
  const dash = (v?: string) => v || "—";

  return (
    <>
      <h1>Mijn gegevens</h1>
      <p className="page-sub">
        Contact- en adresgegevens uit het klantinteractieregister (Open Klant).
      </p>

      <DataBoundary state={gegevens} naam="Gegevens" onRetry={onRetry}>
        <>
          <div className="datasection" id="contactgegevens">
            <div className="datasection__head">
              <h2>Contactgegevens</h2>
              <a href="#">Wijzigen</a>
            </div>
            <dl className="datalist">
              <dt>E-mailadres</dt>
              <dd>{dash(g.email)}</dd>
              <dt>Telefoonnummer</dt>
              <dd>{dash(g.telefoon)}</dd>
            </dl>
          </div>

          <div className="datasection" id="persoonsgegevens">
            <div className="datasection__head">
              <h2>Persoonsgegevens</h2>
              <a href="#">Wijzigen</a>
            </div>
            <dl className="datalist">
              <dt>Naam</dt>
              <dd>{dash(g.naam)}</dd>
              <dt>Burgerservicenummer</dt>
              <dd>{dash(g.bsn)}</dd>
            </dl>
            <h3 style={{ marginTop: 20 }}>Zie ook</h3>
            <ul>
              <li>
                <a href="#">Bekijk hoe de gemeente met persoonsgegevens omgaat</a>
              </li>
            </ul>
          </div>

          <div className="datasection" id="adresgegevens">
            <div className="datasection__head">
              <h2>Adresgegevens</h2>
              <a href="#">Wijzigen</a>
            </div>
            <dl className="datalist">
              <dt>Woonadres</dt>
              <dd>{dash(g.woonadres)}</dd>
              <dt>Postadres</dt>
              <dd>{dash(g.postadres)}</dd>
            </dl>
          </div>
        </>
      </DataBoundary>

      <div className="datasection" id="meldingen">
        <div className="datasection__head">
          <h2>
            Meldingen <DemoBadge />
          </h2>
          <a href="#">Wijzigen</a>
        </div>
        <dl className="datalist">
          <dt>E-mail over nieuwe berichten</dt>
          <dd>Aan</dd>
          <dt>Sms over afspraken</dt>
          <dd>Uit</dd>
          <dt>Herinneringen voor taken</dt>
          <dd>Aan</dd>
        </dl>
      </div>
    </>
  );
}

function BriefPage({ go, selectedTask }: { go: (p: PageKey) => void; selectedTask: any }) {
  const task = selectedTask || {
    titel: "Contactpersoon doorgeven aan de Belastingdienst",
    org: "Belastingdienst",
    deadline: "vóór 2 juli 2026",
    raw: {
      uuid: "bd-ervenbrief",
      context: {
        urn: "urn:nl:belastingdienst:dossier:123456",
        canonicalUrl: "#",
      },
      uitvoering: {
        canonicalUrl: "https://www.belastingdienst.nl",
        type: "formulier",
      },
    },
  };

  const title = task.titel;
  const orgName = task.org;
  const deadlineText = task.deadline || "Geen deadline";

  const briefMetaList = [
    ["Afzender", orgName],
    ["Soort brief", task.raw?.uitvoering?.type || "Actiebrief"],
    ["Ontvangen", "1 juni 2026"],
    ["Gericht aan", "De erven van de overledene"],
    ["Uiterlijk reageren", deadlineText],
    ["Kenmerk", task.raw?.uuid || "BD.ERVENBRIEF"],
  ];

  return (
    <>
      <a className="back-link" href="#/taken" onClick={navLink(go, "taken")}>
        <Icon id="icon-arrow" /> Terug naar taken
      </a>
      <h1>{title}</h1>
      <p className="brief-sub">
        Brief van {orgName} · {deadlineText}
      </p>

      {task.ai && (
        <div className="alert--warning" role="note">
          <span className="alert__icon" aria-hidden="true">
            ⚠
          </span>
          <div>
            Deze brief is automatisch verwerkt door AI. Controleer de gegevens voordat u deze
            verstuurt.
          </div>
        </div>
      )}

      <section className="section" style={{ marginTop: 0 }}>
        <h2>Wat wordt er gevraagd?</h2>
        <p>{task.raw?.toelichting?.nl || task.titel}</p>
        {task.raw?.uitvoering?.canonicalUrl && (
          <a
            className="button-primary"
            href={task.raw.uitvoering.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Regel dit bij {orgName}
          </a>
        )}
      </section>

      <section className="section">
        <h2>Over deze brief</h2>
        <dl className="datalist" style={{ gridTemplateColumns: "minmax(180px, 240px) 1fr" }}>
          {briefMetaList.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt style={{ fontWeight: 700, color: "var(--color-text)" }}>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

function LinkRow({ titel, meta, href = "#" }: { titel: string; meta?: string; href?: string }) {
  return (
    <a className="task" href={href}>
      <span className="task__title">{titel}</span>
      <span className="task__deadline">{meta ?? ""}</span>
      <span className="task__arrow">
        <Icon id="icon-arrow" />
      </span>
    </a>
  );
}

function ItemsTable({
  head,
  rows,
}: {
  head: [string, string, string];
  rows: [string, string, string][];
}) {
  return (
    <div className="panel zaken">
      <div className="table-row table-head">
        {head.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      {rows.map((r) => (
        <div className="table-row" key={r.join("-")}>
          <span>{r[0]}</span>
          <span>{r[1]}</span>
          <span>{r[2]}</span>
        </div>
      ))}
    </div>
  );
}

function ThemePage({ data }: { data: ThemeData }) {
  return (
    <>
      <h1>
        {data.title} <DemoBadge />
      </h1>
      <section className="section">
        <h2>Wat moet ik regelen</h2>
        {data.tasks.length ? (
          <div className="panel taken-panel">
            {data.tasks.map(([t, due]) => (
              <LinkRow key={t} titel={t} meta={due} href="#/taken" />
            ))}
          </div>
        ) : (
          <p className="intro">Er zijn geen openstaande taken.</p>
        )}
      </section>
      <section className="section">
        <h2>Wat kan ik regelen</h2>
        <div className="panel taken-panel">
          {data.actions.map((a) => (
            <LinkRow key={a} titel={a} />
          ))}
        </div>
      </section>
      <section className="section">
        <h2>{data.itemsTitle}</h2>
        <ItemsTable head={data.itemsHead} rows={data.items} />
      </section>
    </>
  );
}

function ProductenPage({ products, onRetry }: { products: Loadable<any[]>; onRetry: () => void }) {
  const producten = products.data;
  return (
    <>
      <h1>Mijn producten</h1>
      <p className="page-sub">Producten en vergunningen die u van de overheid heeft gekregen.</p>
      <DataBoundary state={products} naam="Producten" onRetry={onRetry}>
        <div className="panel berichten">
          {producten.length ? (
            producten.map((p) => (
              <a className="task" href="#" key={p.titel}>
                <span className="task__main">
                  <span className="task__title">{p.titel}</span>
                  <span className="task__org">{p.sub}</span>
                </span>
                <span className="task__deadline">{p.groep}</span>
                <span className="task__arrow">
                  <Icon id="icon-arrow" />
                </span>
              </a>
            ))
          ) : (
            <p className="panel-empty">U heeft geen producten.</p>
          )}
        </div>
      </DataBoundary>
    </>
  );
}

function BelastingzakenPage() {
  return (
    <>
      <h1>
        Belastingzaken <DemoBadge />
      </h1>
      <section className="section">
        <h2>Mijn taken</h2>
        <div className="panel taken-panel">
          {taxTasks.map(([t, due]) => (
            <LinkRow key={t} titel={t} meta={due} href="#/taken" />
          ))}
        </div>
      </section>
      <section className="section">
        <h2>Wat kan ik regelen</h2>
        <div className="panel taken-panel">
          {taxActions.map((a) => (
            <LinkRow key={a} titel={a} />
          ))}
        </div>
      </section>
      <section className="section">
        <h2>Aanslagen</h2>
        <ItemsTable
          head={["Aanslag", "Jaar", "Bedrag"]}
          rows={[
            ["Gemeentelijke belastingen", "2026", "€ 6.982,30"],
            ["Rioolrecht grootafvoer", "2026", "€ 211,30"],
            ["Afvalstoffenheffing", "2026", "€ 348,00"],
            ["WOZ-beschikking", "2026", "€ 438.000"],
          ]}
        />
      </section>
    </>
  );
}

function AgendaPage({
  appointments,
  onRetry,
}: {
  appointments: Loadable<any[]>;
  onRetry: () => void;
}) {
  const afspraken = appointments.data;
  return (
    <>
      <h1>Mijn agenda</h1>
      <p className="page-sub">Afspraken met de gemeente op één plek.</p>
      <section className="section" style={{ marginTop: 8 }}>
        <h2>Afspraken</h2>
        <DataBoundary state={appointments} naam="Afspraken" onRetry={onRetry}>
          <div className="panel">
            {afspraken.length ? (
              afspraken.map((a) => (
                <div
                  className="table-row"
                  key={a.titel}
                  style={{ gridTemplateColumns: "1fr auto" }}
                >
                  <span className="task__main">
                    <span className="task__title" style={{ color: "var(--color-text)" }}>
                      {a.titel}
                    </span>
                    <span className="task__org">{a.wanneer}</span>
                  </span>
                  <a href="#">{a.actie} →</a>
                </div>
              ))
            ) : (
              <p className="panel-empty">U heeft geen afspraken.</p>
            )}
          </div>
        </DataBoundary>
      </section>
    </>
  );
}

function PlanPage({
  plan,
  onRetry,
}: {
  plan: Loadable<{ plan: any; doelen: any[] }>;
  onRetry: () => void;
}) {
  const doelen = plan.data.doelen;
  const statusLabel = (s?: string) =>
    s === "afgerond" ? "Afgerond" : s === "geannuleerd" ? "Geannuleerd" : "Actief";
  return (
    <>
      <h1>Mijn plan</h1>
      <p className="page-sub">Uw plan met doelen, opgehaald uit het Open Plan-register.</p>
      <DataBoundary state={plan} naam="Plan" onRetry={onRetry}>
        {plan.data.plan && (
          <section className="section" style={{ marginTop: 8 }}>
            <h2>{plan.data.plan.titel || "Mijn plan"}</h2>
            {plan.data.plan.notitie && <p className="page-sub">{plan.data.plan.notitie}</p>}
          </section>
        )}
        <section className="section" style={{ marginTop: 8 }}>
          <h2>Mijn doelen</h2>
          <div className="cards">
            {doelen.length ? (
              doelen.map((d: any) => (
                <div className="card" key={d.uuid || d.titel} style={{ cursor: "default" }}>
                  <span className="card__title">{d.titel}</span>
                  <span className="card__id">{statusLabel(d.status)}</span>
                </div>
              ))
            ) : (
              <p className="panel-empty">U heeft nog geen doelen.</p>
            )}
          </div>
        </section>
        <section className="section">
          <h2>Contactpersonen</h2>
          <dl className="datalist">
            <dt>Consulent</dt>
            <dd>R. de Vries</dd>
            <dt>Telefoon</dt>
            <dd>14 000</dd>
          </dl>
        </section>
      </DataBoundary>
    </>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="intro">
        Deze pagina is in deze demo nog niet uitgewerkt. De navigatie en huisstijl werken al.
      </p>
    </>
  );
}

function Faq({ page }: { page: PageKey }) {
  const items = faqsByPage[page] ?? defaultFaqs;
  return (
    <section className="faq">
      <h2>Veelgestelde vragen</h2>
      <Accordion.Root collapsible className="faq-list">
        {items.map((f) => (
          <Accordion.Item key={f.q} value={f.q}>
            <Accordion.ItemTrigger>
              <Accordion.ItemIndicator>›</Accordion.ItemIndicator>
              {f.q}
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>{f.a}</Accordion.ItemContent>
          </Accordion.Item>
        ))}
      </Accordion.Root>
      <a className="faq-all" href="#">
        Bekijk alle veelgestelde vragen <Icon id="icon-arrow" />
      </a>
    </section>
  );
}

const GITHUB_REPO = "https://github.com/VNG-Realisatie/VNG-API-Lab";

function Footer({ brand }: { brand: Brand }) {
  return (
    <footer className="site-footer">
      <div className="site-footer__notice">
        <strong>Demo-applicatie.</strong> Deze MijnOverheid-omgeving is een voorbeeld binnen het{" "}
        <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
          VNG API lab
        </a>
        . De getoonde gegevens zijn fictief.
      </div>
      <div className="site-footer__inner">
        <a className="site-footer__brand" href="#/home">
          {brand.mark ? (
            <img className="site-footer__mark" src={brand.mark} alt="" aria-hidden="true" />
          ) : brand.lint ? (
            <img src={brand.lint} alt="" aria-hidden="true" />
          ) : null}
          {brand.name}
        </a>
        <section>
          <h2>Over deze demo</h2>
          <a
            href={`${GITHUB_REPO}/tree/main/mijnoverheid`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Broncode op GitHub
          </a>
          <a
            href={`${GITHUB_REPO}/issues?q=is%3Aissue+label%3AMijnOverheid`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Vragen &amp; issues
          </a>
          <a
            href={`${GITHUB_REPO}/issues/new?labels=MijnOverheid`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Nieuwe vraag of issue melden
          </a>
        </section>
        <section>
          <h2>Contact</h2>
          <p>
            Bel{" "}
            <a href="tel:1400" style={{ display: "inline" }}>
              1400
            </a>{" "}
            maandag tot en met vrijdag van 8.00 tot 20.00 of stel uw vraag via{" "}
            <a href="mailto:vragen@mijn.overheid.nl" style={{ display: "inline" }}>
              vragen@mijn.overheid.nl
            </a>
          </p>
        </section>
        <nav aria-label="Juridisch">
          <a href="#">Bescherming persoonsgegevens</a>
          <a href="#">Gebruikersvoorwaarden</a>
          <a href="#">Proclaimer</a>
          <a href="#">Toegankelijkheidsverklaring</a>
        </nav>
      </div>
    </footer>
  );
}

// Gerichte chat-weergave op de /chat-route. Alleen de chat; de navigatie blijft
// in de shell. Bereikbaar door een gesprek te starten vanaf Home (echte
// navigatie, dus de back-knop gaat terug naar het overzicht).
function ChatPage({
  chat,
  voice,
  go,
}: {
  chat: ChatApi;
  voice: VoiceApi;
  go: (p: PageKey) => void;
}) {
  const userCount = chat.convo.reduce((n, m) => (m.role === "user" ? n + 1 : n), 0);
  useStickToBottom({
    windowScroll: true,
    active: true,
    signal: `${chat.activeId ?? "new"}:${userCount}`,
  });
  return (
    <div className="home-chat home-chat--active">
      <div className="home-chat__head">
        <h1>Assistent</h1>
        <div className="home-chat__head-actions">
          <SpeakerToggle voice={voice} className="home-chat__icon-btn" />
          <a
            className="home-chat__new"
            href="#/assistent"
            onClick={(e) => {
              e.preventDefault();
              go("assistent");
            }}
          >
            Alle gesprekken
          </a>
          <button type="button" className="home-chat__new" onClick={chat.reset}>
            Nieuw gesprek
          </button>
        </div>
      </div>
      {chat.unavailable ? <UnavailableNote /> : <ChatThread chat={chat} />}
      <div className="home-chat__composer">
        <ChatComposer
          chat={chat}
          variant="hero"
          placeholder="Stel een vervolgvraag…"
          autoFocus
          voice={voice}
          enableSpacePtt
        />
      </div>
    </div>
  );
}

// Overzicht van alle bewaarde gesprekken met de assistent. Bereikbaar vanuit de
// zijbalk ("Assistent"). Een gesprek openen zet het actief en gaat naar /chat.
function AssistentPage({ chat, go }: { chat: ChatApi; go: (p: PageKey) => void }) {
  const threads = [...chat.threads].sort((a, b) => b.updatedAt - a.updatedAt);

  const lastText = (msgs: { role: string; content: string }[]) => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if ((m.role === "assistant" || m.role === "user") && m.content.trim()) return m.content.trim();
    }
    return "";
  };
  const fmtDate = (ms: number) => {
    try {
      return new Date(ms).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const startNew = () => {
    chat.reset();
    go("chat");
  };

  return (
    <>
      <div className="assistent-head">
        <div>
          <h1>Assistent</h1>
          <p className="page-sub">
            Uw gesprekken met de assistent over uw zaken bij de gemeente en het Rijk.
          </p>
        </div>
        <button type="button" className="button-primary assistent-new" onClick={startNew}>
          <Icon id="icon-chat" /> Nieuw gesprek
        </button>
      </div>

      {threads.length ? (
        <div className="panel gesprek-lijst">
          {threads.map((t) => {
            const vragen = t.messages.filter((m) => m.role === "user").length;
            return (
              <div key={t.id} className="gesprek-rij">
                <a
                  className="gesprek-rij__main"
                  href="#/chat"
                  onClick={(e) => {
                    e.preventDefault();
                    chat.openThread(t.id);
                    go("chat");
                  }}
                >
                  <span className="gesprek-rij__icon">
                    <Icon id="icon-chat" />
                  </span>
                  <span className="gesprek-rij__body">
                    <span className="gesprek-rij__title">{t.title}</span>
                    <span className="gesprek-rij__snippet">{lastText(t.messages)}</span>
                    <span className="gesprek-rij__meta">
                      {fmtDate(t.updatedAt)} · {vragen} {vragen === 1 ? "vraag" : "vragen"}
                    </span>
                  </span>
                  <span className="task__arrow">
                    <Icon id="icon-arrow" />
                  </span>
                </a>
                <button
                  type="button"
                  className="gesprek-rij__del"
                  aria-label={`Verwijder gesprek: ${t.title}`}
                  title="Verwijderen"
                  onClick={() => chat.deleteThread(t.id)}
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel gesprek-leeg">
          <span className="gesprek-leeg__icon" aria-hidden="true">
            <Icon id="icon-chat" />
          </span>
          <p>U heeft nog geen gesprekken. Stel uw eerste vraag aan de assistent.</p>
          <button type="button" className="button-primary" onClick={startNew}>
            Nieuw gesprek starten
          </button>
        </div>
      )}
    </>
  );
}

export function App() {
  const [theme, setTheme] = useState("rijk");
  const [page, go] = useHashRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  // Wegklikbare demo-banner; keuze onthouden zodat hij niet terugkomt.
  const [bannerOpen, setBannerOpen] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("mijnoverheid-demo-banner") !== "dismissed",
  );
  const dismissBanner = () => {
    setBannerOpen(false);
    try {
      localStorage.setItem("mijnoverheid-demo-banner", "dismissed");
    } catch {
      /* opslag geblokkeerd — niet kritiek */
    }
  };
  // Voorkom scrollen van de achtergrond zolang het fullscreen-menu open is.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Sluit het menu bij navigeren naar een andere pagina.
  useEffect(() => {
    setMenuOpen(false);
  }, [page]);

  const [taken, setTaken] = useState<Loadable<{ open: Taak[]; done: Taak[] }>>({
    status: "loading",
    data: { open: [], done: [] },
  });
  const [products, setProducts] = useState<Loadable<any[]>>({ status: "loading", data: [] });
  const [plan, setPlan] = useState<Loadable<{ plan: any; doelen: any[] }>>({
    status: "loading",
    data: { plan: null, doelen: [] },
  });
  const [gegevens, setGegevens] = useState<Loadable<GegevensData>>({ status: "loading", data: {} });
  const [appointments, setAppointments] = useState<Loadable<any[]>>({
    status: "loading",
    data: [],
  });
  const [conversations, setConversations] = useState<Loadable<any[]>>({
    status: "loading",
    data: [],
  });
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  const [cases, setCases] = useState<Loadable<any[]>>({ status: "loading", data: [] });
  const [selectedCase, setSelectedCase] = useState<Loadable<any> | null>(null);

  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [showInspector, setShowInspector] = useState(false);
  const [showEndpoints, setShowEndpoints] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(0);
  // Per-API endpoint-overrides: applied (apiBases) + bewerkbare concepten (drafts).
  const [apiBases, setApiBases] = useState<Record<string, string>>(readStoredApiBases);
  const [apiBaseDrafts, setApiBaseDrafts] = useState<Record<string, string>>(readStoredApiBases);
  // Standaard-endpoints ontdekt via GET /.well-known/federated-resources op
  // de huidige default-basis (mocks lokaal, fly.dev in productie). Vervangt
  // de vroeger hardcoded per-API standaardpaden; handmatige overrides
  // (apiBases hierboven) blijven altijd voorrang houden.
  const [discoveredBases, setDiscoveredBases] = useState<Record<string, string>>({});
  const [discoveryStatus, setDiscoveryStatus] = useState<DiscoveryStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    fetchDiscoveredBases()
      .then((map) => {
        if (!cancelled) {
          setDiscoveredBases(map);
          setDiscoveryStatus("ok");
        }
      })
      .catch(() => {
        // Bijv. op fly.dev: die mocks hebben dit endpoint (nog) niet. Val
        // stil terug op de oude hardcoded standaardpaden.
        if (!cancelled) setDiscoveryStatus("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [customMethod, setCustomMethod] = useState(customRequestDefaults.method);
  const [customPath, setCustomPath] = useState(customRequestDefaults.path);
  const [customBody, setCustomBody] = useState(customRequestDefaults.body);
  const [customSending, setCustomSending] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  function applyTheme(value: string) {
    setTheme(value);
    document.documentElement.dataset.theme = value;
  }

  const trackedFetch = useCallback(async (url: string, options?: RequestInit) => {
    const method = options?.method || "GET";
    const id = Math.random().toString(36).substring(7);
    const shortUrl = formatLogUrl(url, getDefaultApiBase());
    const newLog = {
      id,
      url: shortUrl,
      fullUrl: url,
      method,
      timestamp: new Date().toLocaleTimeString(),
      pending: true,
      status: undefined,
      statusText: undefined,
    };
    // Nieuwste bovenaan, zodat een verstuurd verzoek direct zichtbaar is.
    setApiLogs((prev) => [newLog, ...prev]);
    try {
      const res = await fetch(url, options);
      setApiLogs((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, pending: false, status: res.status, statusText: res.statusText }
            : item,
        ),
      );
      return res;
    } catch (err: any) {
      setApiLogs((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, pending: false, statusText: err.message || "Error" } : item,
        ),
      );
      throw err;
    }
  }, []);

  // Bouwt de volledige URL voor een call. Volgorde: (1) handmatige override
  // uit de API-inspector, (2) de via discovery ontdekte standaard-basis voor
  // deze service (tenzij uitgesloten, zie DISCOVERY_AUTOAPPLY_EXCLUDED), (3)
  // de oude hardcoded standaard-basis. In geval (1)/(2) vervangt de
  // gevonden basis het standaarddeel t/m de versie (…/apis/rest/{api}/{versie}).
  const buildUrl = useCallback(
    (pathOrUrl: string) => {
      const trimmed = pathOrUrl.trim();
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
      const api = apiFromPath(path);
      const override = normalizeApiBase(apiBases[api] || "");
      const discovered = DISCOVERY_AUTOAPPLY_EXCLUDED.has(api) ? "" : discoveredBases[api] || "";
      const effectiveBase = override || discovered;
      if (effectiveBase) {
        const prefix = path.match(/^\/apis\/rest\/[^/]+\/[^/]+/)?.[0] ?? "";
        return `${effectiveBase}${path.slice(prefix.length)}`;
      }
      return `${getDefaultApiBase()}${path}`;
    },
    [apiBases, discoveredBases],
  );

  // Eén helper voor de chat-assistent: bouwt de URL (incl. endpoint-overrides)
  // en logt de call in de API-inspector, net als de pagina's zelf. Zo bevraagt
  // de AI exact dezelfde lokale API's.
  const chatApiCall = useCallback(
    (path: string, init?: RequestInit) => trackedFetch(buildUrl(path), init),
    [buildUrl, trackedFetch],
  );

  // Eén gedeelde chat-instantie voor zowel de homepagina als het zwevende widget.
  const chat = useChat(chatApiCall);
  // Spraak: mic-invoer (ASR) + gesproken antwoorden (TTS) via MiMo.
  const voice = useVoice();

  // Spreek een antwoord uit zodra het af is (busy: true→false) als de gebruiker
  // gesproken antwoorden heeft aangezet.
  const prevBusy = useRef(false);
  const convoRef = useRef(chat.convo);
  convoRef.current = chat.convo;
  const speakRef = useRef(voice.speakReplies);
  speakRef.current = voice.speakReplies;
  const speakTextRef = useRef(voice.speakText);
  speakTextRef.current = voice.speakText;
  useEffect(() => {
    const was = prevBusy.current;
    prevBusy.current = chat.busy;
    if (was && !chat.busy && speakRef.current) {
      const last = [...convoRef.current]
        .reverse()
        .find((m) => m.role === "assistant" && m.content.trim());
      if (last) speakTextRef.current(last.content);
    }
  }, [chat.busy]);

  function applyApiBases() {
    const next: Record<string, string> = {};
    for (const { key } of apiEndpoints) {
      const normalized = normalizeApiBase(apiBaseDrafts[key] || "");
      if (normalized) next[key] = normalized;
    }
    setApiBases(next);
    setApiBaseDrafts(next);
    localStorage.setItem(API_BASES_STORAGE_KEY, JSON.stringify(next));
  }

  async function sendCustomRequest() {
    setCustomError(null);
    const url = buildUrl(customPath);
    const options: RequestInit = {
      method: customMethod,
      headers: { ...defaultMockHeaders },
    };

    if (customMethod !== "GET" && customMethod !== "DELETE") {
      if (!customBody.trim()) {
        setCustomError("Body is verplicht voor dit verzoek.");
        return;
      }
      try {
        JSON.parse(customBody);
      } catch {
        setCustomError("Ongeldige JSON in body.");
        return;
      }
      options.body = customBody;
    }

    setCustomSending(true);
    try {
      await trackedFetch(url, options);
    } catch {
      // Fout staat al in het log-overzicht.
    } finally {
      setCustomSending(false);
    }
  }

  // Per-API loaders. Elk laadt onafhankelijk en zet zijn eigen status zodat één
  // falende API de rest niet blokkeert en de fout zichtbaar wordt in de UI.
  // Een !ok-response of netwerkfout leidt tot status 'error' — géén fallback
  // naar verzonnen data.
  const jsonOrThrow = async (res: Response) => {
    if (!res.ok)
      throw new Error(`Verzoek mislukte (HTTP ${res.status} ${res.statusText || ""})`.trim());
    return res.json();
  };
  const errText = (err: any) =>
    err?.message ? String(err.message) : "Onbekende fout bij het ophalen van gegevens.";

  const loadTaken = useCallback(async () => {
    setTaken((s) => ({ ...s, status: "loading", error: undefined }));
    try {
      // De burger komt uit het token; er gaat geen klantId mee.
      const res = await trackedFetch(buildUrl(`/apis/rest/taken/next/taken?pageSize=100`), {
        headers: { ...defaultMockHeaders },
      });
      const data = await jsonOrThrow(res);
      const mapped: Taak[] = (data.results || []).map((t: any) => {
        const isActionable = t.actieNodig !== false && t.status !== "ter-info";
        const isAi =
          t.uitvoering?.type === "formulier" || (t.labels && t.labels.includes("ingevuld"));
        return {
          titel: t.titel?.nl || t.titel?.en || "Taak",
          org: getOrgName(t),
          deadline: formatDeadline(t.deadline),
          ai: isAi,
          terInfo: !isActionable,
          automatisch: t.automatisch || false,
          cat: isActionable ? (isAi ? "ingevuld" : "belangrijkste") : "geenactie",
          raw: t,
        };
      });
      setTaken({
        status: "ready",
        data: {
          open: mapped.filter((t) => t.cat !== "geenactie"),
          done: mapped.filter((t) => t.cat === "geenactie"),
        },
      });
    } catch (err) {
      setTaken({ status: "error", data: { open: [], done: [] }, error: errText(err) });
    }
  }, [buildUrl, trackedFetch]);

  const loadProducten = useCallback(async () => {
    setProducts((s) => ({ ...s, status: "loading", error: undefined }));
    try {
      const res = await trackedFetch(buildUrl(`/apis/rest/producten/next/producten/zoek`), {
        method: "POST",
        headers: { ...defaultMockHeaders },
        body: JSON.stringify({ klantId: "a8f3c1d2-7e44-4b1a-9c0f-123456789abc" }),
      });
      const data = await jsonOrThrow(res);
      const mapped = (data || []).map((p: any) => ({
        titel: p.naam,
        sub: p.producttype?.naam || p.producttype?.code || "Product",
        groep: p.status || "actief",
        raw: p,
      }));
      setProducts({ status: "ready", data: mapped });
    } catch (err) {
      setProducts({ status: "error", data: [], error: errText(err) });
    }
  }, [buildUrl, trackedFetch]);

  // MijnPlan: doelen + plan uit het Open Plan-register (mock). Twee lijst-calls
  // (plan + doel) parallel; de eerste plan-resource is het actieve plan.
  const loadPlan = useCallback(async () => {
    setPlan((s) => ({ ...s, status: "loading", error: undefined }));
    try {
      const [planRes, doelRes] = await Promise.all([
        trackedFetch(buildUrl(`/apis/rest/openplan-plannen/next/plan`), {
          headers: { ...defaultMockHeaders },
        }),
        trackedFetch(buildUrl(`/apis/rest/openplan-plannen/next/doel`), {
          headers: { ...defaultMockHeaders },
        }),
      ]);
      const planData = await jsonOrThrow(planRes);
      const doelData = await jsonOrThrow(doelRes);
      setPlan({
        status: "ready",
        data: {
          plan: (planData?.results || [])[0] || null,
          doelen: doelData?.results || [],
        },
      });
    } catch (err) {
      setPlan({ status: "error", data: { plan: null, doelen: [] }, error: errText(err) });
    }
  }, [buildUrl, trackedFetch]);

  const loadAgenda = useCallback(async () => {
    setAppointments((s) => ({ ...s, status: "loading", error: undefined }));
    try {
      const res = await trackedFetch(buildUrl(`/apis/rest/agenda/next/afspraken/opvragen`), {
        method: "POST",
        headers: { ...defaultMockHeaders },
        body: JSON.stringify({
          identificaties: [{ type: "email", waarde: "jeroen@example.test" }],
        }),
      });
      const data = await jsonOrThrow(res);
      const mapped = (data.afspraken || []).map((a: any) => ({
        titel: a.onderwerp,
        wanneer: formatAfspraakWhen(a.geplandAanvangsmoment, a.geplandEindmoment),
        actie: "Zet in eigen agenda",
        raw: a,
      }));
      setAppointments({ status: "ready", data: mapped });
    } catch (err) {
      setAppointments({ status: "error", data: [], error: errText(err) });
    }
  }, [buildUrl, trackedFetch]);

  const loadGesprekken = useCallback(async () => {
    setConversations((s) => ({ ...s, status: "loading", error: undefined }));
    try {
      const res = await trackedFetch(buildUrl(`/apis/rest/gesprekken/next/gesprekken`), {
        method: "GET",
        headers: { ...defaultMockHeaders },
      });
      const data = await jsonOrThrow(res);
      const mapped = (data.results || []).map((g: any, idx: number) => ({
        org: "Gemeente",
        titel: g.gespreksonderwerp,
        datum: formatConversationDate(g.aanvangsmomentGesprek),
        ongelezen: idx === 0,
        raw: g,
      }));
      setConversations({ status: "ready", data: mapped });
    } catch (err) {
      setConversations({ status: "error", data: [], error: errText(err) });
    }
  }, [buildUrl, trackedFetch]);

  const loadZaken = useCallback(async () => {
    setCases((s) => ({ ...s, status: "loading", error: undefined }));
    try {
      // De burger komt uit het token; er gaat geen klantId mee.
      const res = await trackedFetch(buildUrl(`/apis/rest/zaken/next/zaken?pageSize=100`), {
        headers: { ...defaultMockHeaders },
      });
      const data = await jsonOrThrow(res);
      setCases({ status: "ready", data: Array.isArray(data?.results) ? data.results : [] });
    } catch (err) {
      setCases({ status: "error", data: [], error: errText(err) });
    }
  }, [buildUrl, trackedFetch]);

  const loadGegevens = useCallback(async () => {
    setGegevens((s) => ({ ...s, status: "loading", error: undefined }));
    try {
      const expand = encodeURIComponent("digitaleAdressen");
      const res = await trackedFetch(
        buildUrl(
          `/apis/rest/openklant-klantinteracties/mijnoverheid-demo/partijen/${KLANT_PARTIJ_UUID}?expand=${expand}`,
        ),
        {
          method: "GET",
          headers: { ...defaultMockHeaders, Authorization: "Token demo-token" },
        },
      );
      const data = await jsonOrThrow(res);
      setGegevens({ status: "ready", data: mapPartijToGegevens(data) });
    } catch (err) {
      setGegevens({ status: "error", data: {}, error: errText(err) });
    }
  }, [buildUrl, trackedFetch]);

  useEffect(() => {
    loadTaken();
    loadProducten();
    loadAgenda();
    loadGesprekken();
    loadZaken();
    loadGegevens();
    loadPlan();
  }, [loadTaken, loadProducten, loadAgenda, loadGesprekken, loadZaken, loadGegevens, loadPlan]);

  const handleTaakClick = (t: Taak) => {
    setSelectedTask(t);
    go("brief");
  };

  const [lastCaseUuid, setLastCaseUuid] = useState<string | null>(null);

  const loadCaseDetail = useCallback(
    async (uuid: string) => {
      setLastCaseUuid(uuid);
      setSelectedCase({ status: "loading", data: null });
      try {
        const res = await trackedFetch(buildUrl(`/apis/rest/zaken/next/zaken/${uuid}`), {
          headers: { ...defaultMockHeaders },
        });
        if (!res.ok)
          throw new Error(`Verzoek mislukte (HTTP ${res.status} ${res.statusText || ""})`.trim());
        const data = await res.json();
        // Openstaande taken bij deze zaak komen uit MijnTaken, gekoppeld via de URN van de zaak.
        let openstaandeTaken: any[] = [];
        if (data.urn) {
          try {
            const takenRes = await trackedFetch(
              buildUrl(
                `/apis/rest/taken/next/taken?status=open&context=${encodeURIComponent(data.urn)}`,
              ),
              { headers: { ...defaultMockHeaders } },
            );
            if (takenRes.ok) {
              const taken = await takenRes.json();
              // Filter ook zelf: de mock negeert queryparameters.
              openstaandeTaken = (taken.results || []).filter(
                (t: any) => t.context?.urn === data.urn && t.status === "open",
              );
            }
          } catch {
            // Taken zijn aanvullend; de zaak blijft zichtbaar als MijnTaken niet antwoordt.
          }
        }
        setSelectedCase({ status: "ready", data: { ...data, openstaandeTaken } });
      } catch (err: any) {
        setSelectedCase({ status: "error", data: null, error: err?.message || "Onbekende fout." });
      }
    },
    [buildUrl, trackedFetch],
  );

  const handleCaseClick = (uuid: string) => {
    loadCaseDetail(uuid);
    go("zaak-detail");
  };

  // Esc sluit de zoek-overlay.
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  const openSearch = () => {
    setMenuOpen(false);
    setSearchOpen(true);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };
  const runSearchResult = (run: () => void) => {
    run();
    closeSearch();
  };

  // App-brede zoekindex over alle geladen data (één bron: de App-state).
  const searchQ = searchQuery.trim().toLowerCase();
  const searchResults = searchQ
    ? [
        ...nav.map((n) => ({
          group: "Pagina",
          title: n.label,
          sub: "",
          run: () => go(n.key),
        })),
        ...[...taken.data.open, ...taken.data.done].map((t) => ({
          group: "Taken",
          title: t.titel,
          sub: t.org,
          run: () => handleTaakClick(t),
        })),
        ...cases.data.map((z) => ({
          group: "Zaken",
          title: z.naam,
          sub: z.zaaknummer || z.status || "",
          run: () => (z.uuid ? handleCaseClick(z.uuid) : go("zaken")),
        })),
        ...conversations.data.map((c) => ({
          group: "Berichten",
          title: c.titel,
          sub: c.org,
          run: () => go("berichten"),
        })),
        ...products.data.map((p) => ({
          group: "Producten",
          title: p.titel,
          sub: p.sub,
          run: () => go("producten"),
        })),
        ...appointments.data.map((a) => ({
          group: "Afspraken",
          title: a.titel,
          sub: a.wanneer,
          run: () => go("agenda"),
        })),
      ].filter((r) => `${r.title} ${r.sub ?? ""} ${r.group}`.toLowerCase().includes(searchQ))
    : [];

  const built = [
    "home",
    "chat",
    "assistent",
    "dossier",
    "taken",
    "berichten",
    "zaken",
    "gegevens",
    "brief",
    "zaak-detail",
    "producten",
    "belastingzaken",
    "agenda",
    "plan",
    ...Object.keys(themeData),
  ];

  const brand = brands[theme] ?? brands.rijk;

  // Op de /chat-route staat de chat centraal: FAQ en footer verbergen we, de
  // navigatie (masthead, breadcrumb, sidebar) blijft altijd staan.
  const homeChatActive = page === "chat";

  return (
    <>
      {bannerOpen && (
        <div className="demo-banner" role="note">
          <span className="demo-banner__text">
            <strong>Demo van VNG Realisatie.</strong> Deze applicatie onderzoekt hoe we digitale
            overheidsdienstverlening kunnen vormgeven. De getoonde data is fictief.
          </span>
          <button
            type="button"
            className="demo-banner__close"
            onClick={dismissBanner}
            aria-label="Melding sluiten"
          >
            &times;
          </button>
        </div>
      )}
      <header className="masthead">
        {brand.lint && (
          <span className="masthead__lint" aria-hidden="true">
            <img src={brand.lint} alt="" />
          </span>
        )}
        <div className="masthead__inner">
          <button
            type="button"
            className="masthead__menu-btn"
            aria-label="Menu openen"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen(true)}
          >
            <span className="masthead__menu-bars" aria-hidden="true" />
            Menu
          </button>
          <a className="masthead__brand" href="#/home" onClick={navLink(go, "home")}>
            {brand.mark && <img className="masthead__mark" src={brand.mark} alt="" />}
            {brand.name}
          </a>
          <div className="masthead__links">
            <button type="button" className="masthead__search" onClick={openSearch}>
              <Icon id="icon-search" />
              <span>Zoeken</span>
            </button>
            <a className="masthead__user" href="#/gegevens" onClick={navLink(go, "gegevens")}>
              <Icon id="icon-user" />
              Jeroen van Drouwen
            </a>
            <a href="/">Uitloggen</a>
          </div>
        </div>
      </header>
      <div className="accent-line" />

      <nav className="breadcrumb" aria-label="Kruimelpad">
        <a href="#/home" onClick={navLink(go, "home")}>
          Home
        </a>
        {page !== "home" && (
          <>
            {" › "}
            <span aria-current="page">{labels[page]}</span>
          </>
        )}
      </nav>

      <div className="layout">
        <aside
          id="mobile-menu"
          className={`sidenav${menuOpen ? " is-open" : ""}`}
          aria-label="Mijn omgeving"
        >
          <div className="sidenav__mobile-head">
            <span className="sidenav__mobile-title">Menu</span>
            <button
              type="button"
              className="sidenav__close"
              onClick={() => setMenuOpen(false)}
              aria-label="Menu sluiten"
            >
              &times;
            </button>
          </div>
          <button type="button" className="sidenav__search" onClick={openSearch}>
            <Icon id="icon-search" />
            <span>Zoeken</span>
          </button>
          <ul>
            {nav.map((n) => {
              let badgeCount = n.badge;
              if (n.key === "taken") {
                badgeCount = taken.data.open.filter(
                  (t) => t.cat === "belangrijkste" || t.cat === "ingevuld",
                ).length;
              } else if (n.key === "berichten") {
                badgeCount = conversations.data.filter((c) => c.ongelezen).length;
              } else if (n.key === "zaken") {
                badgeCount = cases.data.filter(
                  (c) => c.status === "Open" || c.status?.toLowerCase() === "open",
                ).length;
              } else if (n.key === "agenda") {
                badgeCount = appointments.data.length;
              }
              // "Mijn " alleen in de sidebar weglaten (en eerste letter hoofdletteren);
              // breadcrumb/labels blijven heel.
              const sidebarLabel = n.label
                .replace(/^Mijn\s+/, "")
                .replace(/^\w/, (c) => c.toUpperCase());

              return (
                <Fragment key={n.key}>
                  {n.dividerBefore && <li className="sidenav__divider" aria-hidden="true" />}
                  <li>
                    <a
                      href={`#/${n.key}`}
                      aria-current={page === n.key ? "page" : undefined}
                      className={page === n.key ? "is-current" : ""}
                      onClick={(e) => {
                        e.preventDefault();
                        go(n.key);
                        setMenuOpen(false);
                      }}
                    >
                      <Icon id={n.icon} />
                      <span>{sidebarLabel}</span>
                      {!!badgeCount && <span className="sidenav__badge">{badgeCount}</span>}
                    </a>
                  </li>
                </Fragment>
              );
            })}
          </ul>
          <div className="sidenav__mobile-foot">
            <a
              className="sidenav__user"
              href="#/gegevens"
              onClick={(e) => {
                e.preventDefault();
                go("gegevens");
                setMenuOpen(false);
              }}
            >
              <Icon id="icon-user" />
              <span>Jeroen van Drouwen</span>
            </a>
            <a href="/">Uitloggen</a>
          </div>
        </aside>

        <main className="shell" id="main">
          <InspectorOpenContext.Provider value={showInspector}>
            {page === "home" && (
              <HomePage
                go={go}
                taken={taken}
                cases={cases}
                onTaakClick={handleTaakClick}
                onRetryTaken={loadTaken}
                onRetryZaken={loadZaken}
                chat={chat}
                voice={voice}
              />
            )}
            {page === "chat" && <ChatPage chat={chat} voice={voice} go={go} />}
            {page === "assistent" && <AssistentPage chat={chat} go={go} />}
            {page === "dossier" && (
              <DossierPage taken={taken} onTaakClick={handleTaakClick} onRetry={loadTaken} />
            )}
            {page === "taken" && (
              <TakenPage taken={taken} onTaakClick={handleTaakClick} onRetry={loadTaken} />
            )}
            {page === "berichten" && (
              <BerichtenPage go={go} conversations={conversations} onRetry={loadGesprekken} />
            )}
            {page === "zaken" && (
              <ZakenPage cases={cases} onCaseClick={handleCaseClick} onRetry={loadZaken} />
            )}
            {page === "zaak-detail" && (
              <ZaakDetailPage
                selectedCase={selectedCase}
                go={go}
                onRetry={() => lastCaseUuid && loadCaseDetail(lastCaseUuid)}
              />
            )}
            {page === "gegevens" && <GegevensPage gegevens={gegevens} onRetry={loadGegevens} />}
            {page === "brief" && <BriefPage go={go} selectedTask={selectedTask} />}
            {page === "producten" && <ProductenPage products={products} onRetry={loadProducten} />}
            {page === "belastingzaken" && <BelastingzakenPage />}
            {page === "agenda" && <AgendaPage appointments={appointments} onRetry={loadAgenda} />}
            {page === "plan" && <PlanPage plan={plan} onRetry={loadPlan} />}
            {page in themeData && <ThemePage data={themeData[page]} />}
            {!built.includes(page) && <Placeholder title={labels[page]} />}
          </InspectorOpenContext.Provider>

          {!homeChatActive && <Faq page={page} />}
        </main>
      </div>

      {!homeChatActive && <Footer brand={brand} />}

      <Chat chat={chat} voice={voice} hideLauncher={page === "home" || page === "chat"} />

      {searchOpen && (
        <div className="search-overlay" onClick={closeSearch}>
          <div
            className="search-box"
            role="dialog"
            aria-label="Zoeken"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="search-box__head">
              <Icon id="icon-search" />
              <input
                className="search-box__input"
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSearchActive((i) => Math.min(i + 1, searchResults.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSearchActive((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    const r = searchResults[searchActive];
                    if (r) runSearchResult(r.run);
                  }
                }}
                placeholder="Zoek in taken, zaken, berichten, producten…"
                aria-label="Zoekterm"
              />
              <button
                type="button"
                className="search-box__close"
                onClick={closeSearch}
                aria-label="Sluiten"
              >
                &times;
              </button>
            </div>
            <div className="search-box__results">
              {searchQ === "" ? (
                <p className="search-box__hint">
                  Typ om te zoeken in al uw taken, zaken, berichten, producten en afspraken.
                </p>
              ) : searchResults.length === 0 ? (
                <p className="search-box__hint">Geen resultaten voor “{searchQuery}”.</p>
              ) : (
                searchResults.map((r, i) => (
                  <button
                    type="button"
                    className={`search-result${i === searchActive ? " is-active" : ""}`}
                    key={`${r.group}-${r.title}-${i}`}
                    aria-selected={i === searchActive}
                    ref={(el) => {
                      if (i === searchActive && el) el.scrollIntoView({ block: "nearest" });
                    }}
                    onMouseEnter={() => setSearchActive(i)}
                    onClick={() => runSearchResult(r.run)}
                  >
                    <span className="search-result__main">
                      <span className="search-result__title">{r.title}</span>
                      {r.sub && <span className="search-result__sub">{r.sub}</span>}
                    </span>
                    <span className="search-result__group">{r.group}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="demo-toolbar">
        {showInspector && (
          <div className="api-inspector">
            <div className="api-inspector__header">
              <h4 className="api-inspector__title">
                <span className="api-inspector__title-icon" aria-hidden="true">
                  ⚡
                </span>
                API Inspector
              </h4>
              <div className="api-inspector__actions">
                <button
                  type="button"
                  className={`api-inspector__icon-btn${showEndpoints ? " is-active" : ""}`}
                  onClick={() => setShowEndpoints((v) => !v)}
                  aria-label="Endpoints instellen"
                  aria-pressed={showEndpoints}
                  title="Endpoint per API instellen"
                >
                  <Icon id="icon-settings" />
                </button>
                <button
                  type="button"
                  className="api-inspector__action"
                  onClick={() => setApiLogs([])}
                >
                  Wissen
                </button>
                <button
                  type="button"
                  className="api-inspector__close"
                  onClick={() => setShowInspector(false)}
                  aria-label="Sluiten"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="api-inspector__panel">
              {showEndpoints && (
                <div className="api-inspector__section">
                  <span className="api-inspector__label">Endpoint per API</span>
                  <div className="api-inspector__endpoints">
                    {apiEndpoints.map(({ key, label }) => (
                      <div className="api-inspector__endpoint" key={key}>
                        <span className="api-inspector__endpoint-name">{label}</span>
                        <input
                          className="api-inspector__input"
                          type="url"
                          value={apiBaseDrafts[key] || ""}
                          onChange={(e) =>
                            setApiBaseDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          placeholder={
                            !DISCOVERY_AUTOAPPLY_EXCLUDED.has(key) && discoveredBases[key]
                              ? discoveredBases[key]
                              : defaultApiEndpoint(key)
                          }
                          aria-label={`Endpoint voor ${label}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="api-inspector__row">
                    <button type="button" className="api-inspector__button" onClick={applyApiBases}>
                      Toepassen
                    </button>
                  </div>
                  <p className="api-inspector__hint">
                    Laat leeg voor het standaard-endpoint. Een eigen endpoint geldt alleen voor die
                    API.
                  </p>
                </div>
              )}

              <div className="api-inspector__section">
                <span className="api-inspector__label">Handmatig verzoek</span>
                <div className="api-inspector__row api-inspector__row--method">
                  <select
                    className="api-inspector__select"
                    value={customMethod}
                    onChange={(e) => setCustomMethod(e.target.value)}
                    aria-label="HTTP-methode"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PATCH">PATCH</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                  <input
                    className="api-inspector__input"
                    type="text"
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    placeholder="/apis/rest/taken/next/taken?status=open"
                    aria-label="Pad of URL"
                  />
                </div>
                {customMethod !== "GET" && customMethod !== "DELETE" && (
                  <textarea
                    className="api-inspector__textarea"
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    rows={5}
                    spellCheck={false}
                    aria-label="Request body (JSON)"
                  />
                )}
                {customError && <p className="api-inspector__error">{customError}</p>}
                <button
                  type="button"
                  className="api-inspector__button api-inspector__button--primary"
                  onClick={sendCustomRequest}
                  disabled={customSending}
                >
                  {customSending ? "Versturen…" : "Versturen"}
                </button>
              </div>

              <div className="api-inspector__section">
                <span className="api-inspector__label">Verzoeken</span>
                <div className="api-inspector__list">
                  {apiLogs.length === 0 ? (
                    <div className="api-inspector__empty">Geen API verzoeken geregistreerd.</div>
                  ) : (
                    apiLogs.map((log) => {
                      const isSuccess = log.status && log.status >= 200 && log.status < 300;
                      const isError = log.status && log.status >= 400;
                      const statusClass = log.pending
                        ? "api-inspector__status--pending"
                        : isSuccess
                          ? "api-inspector__status--success"
                          : isError
                            ? "api-inspector__status--error"
                            : "api-inspector__status--pending";

                      const docsUrl = docsUrlForCall(log.method, log.fullUrl || log.url);

                      return (
                        <div key={log.id} className="api-inspector__item">
                          <div className="api-inspector__item-head">
                            <span
                              className={`api-inspector__method api-inspector__method--${log.method === "POST" ? "post" : log.method === "GET" ? "get" : "other"}`}
                            >
                              {log.method}
                            </span>
                            <span className={`api-inspector__status ${statusClass}`}>
                              {log.pending ? "Plaatsen..." : log.status || log.statusText}
                            </span>
                          </div>
                          <div className="api-inspector__url">{log.url}</div>
                          <div className="api-inspector__meta">
                            <span>{log.timestamp}</span>
                            {docsUrl && (
                              <a
                                className="api-inspector__docs-link"
                                href={docsUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Open de API-documentatie voor deze call"
                              >
                                API-docs ↗
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="api-inspector__footer">
              Standaard: {getDefaultApiBase()}
              {discoveryStatus === "loading" && " · discovery-manifest laden…"}
              {discoveryStatus === "ok" &&
                ` · ${Object.keys(discoveredBases).length} endpoints ontdekt via /.well-known/federated-resources`}
              {discoveryStatus === "unavailable" &&
                " · geen discovery-manifest gevonden, standaardpaden gebruikt"}
            </div>
          </div>
        )}

        <div className="demo-toolbar__bar">
          <a
            href="/"
            className="demo-toolbar__brand"
            title="Terug naar API lab"
            aria-label="Terug naar API lab"
          >
            <img
              className="demo-toolbar__logo"
              src="vng-logo.svg"
              alt="VNG"
              width="96"
              height="50"
            />
          </a>
          <span className="demo-toolbar__divider" aria-hidden="true" />
          <a
            href="/"
            className="demo-toolbar__btn demo-toolbar__btn--back"
            title="Terug naar API lab"
            aria-label="Terug naar API lab"
          >
            <Icon id="icon-arrow-left" />
            <span className="demo-toolbar__btn-text">API lab</span>
          </a>
          <button
            type="button"
            className={`demo-toolbar__btn demo-toolbar__btn--api${showInspector ? " is-open" : ""}`}
            onClick={() => setShowInspector(!showInspector)}
            title="API requests"
            aria-label="API requests"
            aria-expanded={showInspector}
          >
            &lt;/&gt;
            {apiLogs.length > 0 && <span className="demo-toolbar__badge">{apiLogs.length}</span>}
          </button>
          <button
            type="button"
            className="demo-toolbar__btn"
            onClick={() => {
              const items = themes.items;
              const currentIndex = items.findIndex((item) => item.value === theme);
              const nextIndex = (currentIndex + 1) % items.length;
              applyTheme(items[nextIndex].value);
            }}
            title="Volgende huisstijl"
            aria-label="Volgende huisstijl"
          >
            <Icon id="icon-palette" />
          </button>
        </div>
      </div>
    </>
  );
}
