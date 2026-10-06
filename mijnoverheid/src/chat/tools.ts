// Function-calling tools voor de assistent. Elke tool bevraagt dezelfde
// mock-API's als de rest van Mijn omgeving (via de geïnjecteerde apiCall, die
// buildUrl + trackedFetch combineert). Zo heeft de AI échte toegang tot de
// lokale data én verschijnen de calls netjes in de API-inspector.

// Voert een API-call uit en geeft de Response terug. Identiek aan wat de app
// zelf doet (inclusief mock-headers en endpoint-overrides).
export type ApiCall = (path: string, init?: RequestInit) => Promise<Response>;

// Dezelfde demo-klant als de pagina's gebruiken.
const KLANT_ID = "a8f3c1d2-7e44-4b1a-9c0f-123456789abc";

export interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
}

// De tool-definities die we aan het model meegeven. Beschrijvingen in het
// Nederlands zodat het model goed snapt wanneer het wat moet ophalen.
export function buildTools(): Tool[] {
  const noArgs = {
    type: "object" as const,
    properties: {},
    required: [] as string[],
  };
  return [
    {
      type: "function",
      function: {
        name: "get_taken",
        description:
          "Haal alle taken van de gebruiker op (open en afgerond), met titel, organisatie, deadline en of er actie nodig is. Gebruik dit voor vragen over wat de gebruiker nog moet doen, deadlines, betalingen of openstaande acties.",
        parameters: noArgs,
      },
    },
    {
      type: "function",
      function: {
        name: "get_zaken",
        description:
          "Haal de lopende en gesloten zaken (aanvragen) van de gebruiker op, met naam, zaaknummer, status en uuid. Gebruik dit voor vragen over de status of voortgang van aanvragen.",
        parameters: noArgs,
      },
    },
    {
      type: "function",
      function: {
        name: "get_zaak_details",
        description:
          "Haal de details van één specifieke zaak op aan de hand van het uuid. Gebruik eerst get_zaken om het juiste uuid te vinden.",
        parameters: {
          type: "object",
          properties: {
            uuid: { type: "string", description: "Het uuid van de zaak uit get_zaken" },
          },
          required: ["uuid"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_producten",
        description:
          "Haal de producten van de gebruiker op (zoals vergunningen, passen, ontheffingen), met naam, type en status.",
        parameters: noArgs,
      },
    },
    {
      type: "function",
      function: {
        name: "get_afspraken",
        description: "Haal de geplande afspraken van de gebruiker op, met onderwerp en tijdstip.",
        parameters: noArgs,
      },
    },
    {
      type: "function",
      function: {
        name: "get_berichten",
        description:
          "Haal de berichten/gesprekken op die de gebruiker van de overheid heeft ontvangen, met onderwerp en datum.",
        parameters: noArgs,
      },
    },
  ];
}

const mockHeaders = {
  Authorization: "Bearer dummy-token",
  "Content-Type": "application/json",
  Prefer: "code=200",
};

async function postJson(apiCall: ApiCall, path: string, body: unknown): Promise<any> {
  const res = await apiCall(path, {
    method: "POST",
    headers: { ...mockHeaders },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getJson(apiCall: ApiCall, path: string): Promise<any> {
  const res = await apiCall(path, { headers: { ...mockHeaders } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Helpt het model met minder tokens: pak een leesbare i18n-string.
const t = (v: any): string => v?.nl || v?.en || (typeof v === "string" ? v : "") || "";

const orgFromContext = (taak: any): string => {
  const url = taak?.context?.canonicalUrl || "";
  const urn = taak?.context?.urn || "";
  const hay = `${url} ${urn}`.toLowerCase();
  if (hay.includes("belastingdienst")) return "Belastingdienst";
  if (hay.includes("toeslagen")) return "Dienst Toeslagen";
  if (hay.includes("svb")) return "Sociale Verzekeringsbank";
  if (hay.includes("cak")) return "CAK";
  if (hay.includes("rdw")) return "RDW";
  if (hay.includes("gemeente")) return "Gemeente";
  return "Overheid";
};

// Voert een tool uit en geeft een compacte, model-vriendelijke samenvatting
// terug (geen rauwe, zware payloads — dat scheelt tokens en hallucinaties).
export async function runTool(
  name: string,
  args: Record<string, any>,
  apiCall: ApiCall,
): Promise<unknown> {
  switch (name) {
    case "get_taken": {
      const data = await getJson(apiCall, "/apis/rest/taken/next/taken?pageSize=100");
      const taken = (data.results || []).map((tk: any) => ({
        titel: t(tk.titel),
        organisatie: orgFromContext(tk),
        deadline: tk.deadline || null,
        actieNodig: tk.actieNodig !== false && tk.status !== "ter-info",
        status: tk.status || "open",
      }));
      return { aantal: taken.length, taken };
    }
    case "get_zaken": {
      const data = await getJson(apiCall, "/apis/rest/zaken/next/zaken?pageSize=100");
      const zaken = (Array.isArray(data?.results) ? data.results : []).map((z: any) => ({
        naam: z.naam,
        zaaknummer: z.zaaknummer || null,
        status: z.status || null,
        huidigeStatus: z.huidigeStatus || null,
        datumAanvraag: z.datumAanvraag || z.datum || null,
        uuid: z.uuid || null,
      }));
      return { aantal: zaken.length, zaken };
    }
    case "get_zaak_details": {
      const uuid = String(args.uuid || "").trim();
      if (!uuid) return { error: "uuid ontbreekt; gebruik eerst get_zaken." };
      const data = await getJson(apiCall, `/apis/rest/zaken/next/zaken/${uuid}`);
      return data;
    }
    case "get_producten": {
      const data = await postJson(apiCall, "/apis/rest/producten/next/producten/zoek", {
        klantId: KLANT_ID,
      });
      const producten = (Array.isArray(data) ? data : []).map((p: any) => ({
        naam: p.naam,
        type: p.producttype?.naam || p.producttype?.code || "Product",
        status: p.status || null,
      }));
      return { aantal: producten.length, producten };
    }
    case "get_afspraken": {
      const data = await postJson(apiCall, "/apis/rest/agenda/next/afspraken/opvragen", {
        identificaties: [{ type: "email", waarde: "jeroen@example.test" }],
      });
      const afspraken = (data.afspraken || []).map((a: any) => ({
        onderwerp: a.onderwerp,
        aanvang: a.geplandAanvangsmoment || null,
        einde: a.geplandEindmoment || null,
      }));
      return { aantal: afspraken.length, afspraken };
    }
    case "get_berichten": {
      const data = await getJson(apiCall, "/apis/rest/gesprekken/next/gesprekken");
      const berichten = (data.results || []).map((g: any) => ({
        onderwerp: g.gespreksonderwerp,
        datum: g.aanvangsmomentGesprek || null,
      }));
      return { aantal: berichten.length, berichten };
    }
    default:
      return { error: `Onbekende tool: ${name}` };
  }
}

// Mensvriendelijke labels voor de "… ophalen"-statuschip in de UI.
export const toolLabels: Record<string, string> = {
  get_taken: "Taken ophalen",
  get_zaken: "Zaken ophalen",
  get_zaak_details: "Zaakdetails ophalen",
  get_producten: "Producten ophalen",
  get_afspraken: "Afspraken ophalen",
  get_berichten: "Berichten ophalen",
};
