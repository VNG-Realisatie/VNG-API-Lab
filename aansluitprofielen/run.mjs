#!/usr/bin/env node
// Draait de aansluitprofielen met Redocly Respect en schrijft een rapport.
//
//   node aansluitprofielen/run.mjs                    alle doelen uit doelen.yaml
//   node aansluitprofielen/run.mjs --doel zgw-burger  één of meer doelen (herhaalbaar)
//   node aansluitprofielen/run.mjs --profiel aansluitprofielen/mijnzaken/zgw.arazzo.yaml \
//     --server zaken=https://... --input tokenA=... [--id mijn-zaaksysteem] \
//     [--modus gedrag|strikt] [--bekend 'strikt/*=uitleg']
//
// Per doel en modus draait Respect met --json-output. Elke workflow wordt een check met id
// <doel>/<modus>/<workflowId>. Een falende check die in bekende_fouten staat telt niet mee.
// Exitcode 1 alleen bij een onverwachte fout.

import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const RESULTS = path.join(HIER, "results");
const RAW = path.join(RESULTS, "raw");
const REDOCLY = path.join(ROOT, "node_modules", ".bin", "redocly");

const MODI = {
  gedrag: { SCHEMA_CHECK: "warn", CONTENT_TYPE_CHECK: "warn" },
  strikt: null,
};

function leesArgs(argv) {
  const args = { doelen: [], servers: {}, inputs: {}, bekend: {}, modi: [] };
  const paar = (s, vlag) => {
    const i = s.indexOf("=");
    if (i < 1) throw new Error(`${vlag} verwacht naam=waarde, kreeg "${s}"`);
    return [s.slice(0, i), s.slice(i + 1)];
  };
  for (let i = 0; i < argv.length; i++) {
    const vlag = argv[i];
    const waarde = argv[++i];
    if (waarde === undefined) throw new Error(`${vlag} mist een waarde`);
    if (vlag === "--doel") args.doelen.push(waarde);
    else if (vlag === "--doelen") args.bestand = waarde;
    else if (vlag === "--profiel") args.profiel = waarde;
    else if (vlag === "--id") args.id = waarde;
    else if (vlag === "--modus") args.modi.push(waarde);
    else if (vlag === "--server") { const [k, v] = paar(waarde, vlag); args.servers[k] = v; }
    else if (vlag === "--input") { const [k, v] = paar(waarde, vlag); args.inputs[k] = v; }
    else if (vlag === "--bekend") { const [k, v] = paar(waarde, vlag); args.bekend[k] = v; }
    else throw new Error(`Onbekende optie ${vlag}`);
  }
  for (const m of args.modi) if (!(m in MODI)) throw new Error(`Onbekende modus ${m}`);
  return args;
}

function laadDoelen(args) {
  if (args.profiel) {
    return [{
      id: args.id || path.basename(args.profiel).replace(/\.arazzo\.ya?ml$/, ""),
      profiel: args.profiel,
      servers: args.servers,
      inputs: args.inputs,
      bekende_fouten: args.bekend,
    }];
  }
  const bestand = args.bestand || path.join(HIER, "doelen.yaml");
  const { doelen } = yaml.load(fs.readFileSync(bestand, "utf8"));
  if (!args.doelen.length) return doelen;
  return args.doelen.map((id) => {
    const doel = doelen.find((d) => d.id === id);
    if (!doel) throw new Error(`Doel ${id} staat niet in ${bestand}`);
    return doel;
  });
}

// ${VAR} komt uit de omgeving. Ontbreekt de variabele, dan kan het doel niet draaien.
function vulIn(waarde) {
  return String(waarde).replace(/\$\{(\w+)\}/g, (_, naam) => {
    if (process.env[naam] === undefined) throw new Error(`Omgevingsvariabele ${naam} ontbreekt`);
    return process.env[naam];
  });
}

function wachtOpPoort(poort, ms = 15000) {
  const eind = Date.now() + ms;
  return new Promise((resolve, reject) => {
    const probeer = () => {
      const sock = net.connect(poort, "127.0.0.1");
      sock.once("connect", () => { sock.destroy(); resolve(); });
      sock.once("error", () => {
        sock.destroy();
        if (Date.now() > eind) reject(new Error(`Niets luistert op poort ${poort}`));
        else setTimeout(probeer, 100);
      });
    };
    probeer();
  });
}

async function startServers(doelen) {
  const perPoort = new Map();
  for (const { id, start } of doelen) {
    if (!start) continue;
    const sleutel = JSON.stringify([start.commando, start.env || {}]);
    const bestaand = perPoort.get(start.poort);
    if (bestaand && bestaand.sleutel !== sleutel) {
      throw new Error(`Doel ${id} wil poort ${start.poort}, die al een andere server heeft`);
    }
    if (!bestaand) perPoort.set(start.poort, { sleutel, start });
  }
  const procs = [];
  for (const [poort, { start }] of perPoort) {
    const [cmd, ...rest] = start.commando.trim().split(/\s+/);
    const env = { ...process.env, PORT: String(poort) };
    for (const [k, v] of Object.entries(start.env || {})) env[k] = vulIn(v);
    procs.push(spawn(cmd, rest, { cwd: ROOT, env, stdio: ["ignore", "ignore", "inherit"] }));
  }
  const stop = () => procs.forEach((p) => p.kill());
  try {
    await Promise.all([...perPoort.keys()].map((p) => wachtOpPoort(p)));
  } catch (e) {
    stop();
    throw e;
  }
  return stop;
}

function draaiRespect(doel, modus, uitvoer) {
  const args = ["respect", doel.profiel, "--json-output", uitvoer];
  for (const [k, v] of Object.entries(doel.servers || {})) args.push("--server", `${k}=${vulIn(v)}`);
  for (const [k, v] of Object.entries(doel.inputs || {})) args.push("--input", `${k}=${vulIn(v)}`);
  const severity = modus === "gedrag" ? { ...MODI.gedrag, ...(doel.gedrag_severity || {}) } : null;
  if (severity) args.push("--severity", JSON.stringify(severity));
  return new Promise((resolve) => {
    const proc = spawn(REDOCLY, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    proc.stdout.on("data", (d) => (log += d));
    proc.stderr.on("data", (d) => (log += d));
    proc.on("close", (code) => resolve({ code, log }));
  });
}

function patroonNaarRegex(patroon) {
  const escaped = patroon.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${escaped.join(".*")}$`);
}

function zoekBekend(doel, checkId) {
  const kort = checkId.slice(doel.id.length + 1);
  for (const [patroon, uitleg] of Object.entries(doel.bekende_fouten || {})) {
    const re = patroonNaarRegex(patroon);
    if (re.test(checkId) || re.test(kort)) return { patroon, uitleg };
  }
  return null;
}

// Eerste harde fout uit een workflow, als korte reden voor het rapport.
function reden(workflow) {
  for (const stap of workflow.executedSteps || []) {
    const fout = (stap.checks || []).find((c) => !c.passed && c.severity === "error");
    if (fout) {
      const regels = (fout.message || "").split("\n").map((r) => r.trim()).filter(Boolean);
      const status = stap.response?.statusCode;
      const tekst = regels.length ? regels.slice(0, 4).join(" ") : `mislukt bij statuscode ${status}`;
      return `${stap.stepId}: ${fout.name}: ${tekst}`;
    }
    if (stap.status === "error") return `${stap.stepId}: stap mislukt`;
  }
  return workflow.globalTimeoutError ? "time-out" : "workflow mislukt";
}

function maakCheck(doel, modus, workflowId, status, redenTekst) {
  const id = `${doel.id}/${modus}/${workflowId}`;
  const bekend = zoekBekend(doel, id);
  const check = { id, doel: doel.id, modus, workflow: workflowId, status };
  if (status === "fail") check.reden = redenTekst;
  if (bekend) check.bekend = { patroon: bekend.patroon, uitleg: bekend.uitleg };
  return check;
}

async function draaiDoel(doel, modus) {
  const uitvoer = path.join(RAW, `${doel.id}-${modus}.json`);
  fs.rmSync(uitvoer, { force: true });
  let resultaat;
  try {
    resultaat = await draaiRespect(doel, modus, uitvoer);
  } catch (e) {
    return [maakCheck(doel, modus, "*", "fail", e.message)];
  }
  fs.writeFileSync(path.join(RAW, `${doel.id}-${modus}.log`), resultaat.log);
  if (!fs.existsSync(uitvoer)) {
    const laatste = resultaat.log.trim().split("\n").slice(-3).join(" ");
    return [maakCheck(doel, modus, "*", "fail", `Respect gaf geen uitvoer (exit ${resultaat.code}): ${laatste}`)];
  }
  const json = JSON.parse(fs.readFileSync(uitvoer, "utf8"));
  const workflows = Object.values(json.files).flatMap((f) => f.executedWorkflows || []);
  return workflows.map((w) =>
    maakCheck(doel, modus, w.workflowId, w.status === "error" ? "fail" : "pass", reden(w)),
  );
}

function tel(checks) {
  const t = { totaal: checks.length, pass: 0, fail: 0, bekend: 0, onverwacht: 0 };
  for (const c of checks) {
    if (c.status === "pass") t.pass++;
    else {
      t.fail++;
      if (c.bekend) t.bekend++;
      else t.onverwacht++;
    }
  }
  return t;
}

function schrijfMarkdown(rapport) {
  const s = rapport.samenvatting;
  const r = [];
  r.push("# Aansluitprofielen: rapport", "");
  r.push(`Gedraaid op ${rapport.datum} met Redocly CLI ${rapport.respect}.`, "");
  r.push(`**${s.pass} van ${s.totaal} checks geslaagd**, ${s.bekend} bekende fouten, ${s.onverwacht} onverwacht.`, "");
  r.push("| Doel | Profiel | Gedrag | Strikt |", "|---|---|---|---|");
  for (const d of rapport.doelen) {
    const cel = (m) => {
      const t = d.modi[m];
      if (!t) return "";
      const extra = [t.bekend && `${t.bekend} bekend`, t.onverwacht && `**${t.onverwacht} onverwacht**`].filter(Boolean);
      return `${t.pass} van ${t.totaal}${extra.length ? ` (${extra.join(", ")})` : ""}`;
    };
    r.push(`| ${d.id} | \`${d.profiel}\` | ${cel("gedrag")} | ${cel("strikt")} |`);
  }
  const fouten = rapport.checks.filter((c) => c.status === "fail");
  const onverwacht = fouten.filter((c) => !c.bekend);
  const bekend = fouten.filter((c) => c.bekend);
  if (onverwacht.length) {
    r.push("", "## Onverwachte fouten", "", "| Check | Reden |", "|---|---|");
    for (const c of onverwacht) r.push(`| \`${c.id}\` | ${c.reden.replace(/\|/g, "\\|")} |`);
  }
  if (bekend.length) {
    r.push("", "## Bekende fouten", "", "| Check | Uitleg | Reden |", "|---|---|---|");
    for (const c of bekend) r.push(`| \`${c.id}\` | ${c.bekend.uitleg} | ${c.reden.replace(/\|/g, "\\|")} |`);
  }
  const verlopen = rapport.checks.filter((c) => c.status === "pass" && c.bekend);
  if (verlopen.length) {
    r.push("", "## Bekende fouten die niet meer optreden", "");
    r.push("Deze checks slagen, terwijl er een bekende-foutregel voor staat. Haal de regel weg als dat zo blijft.", "");
    for (const c of verlopen) r.push(`- \`${c.id}\` (regel \`${c.bekend.patroon}\`)`);
  }
  return r.join("\n") + "\n";
}

async function main() {
  const args = leesArgs(process.argv.slice(2));
  const doelen = laadDoelen(args);
  const modi = args.modi.length ? args.modi : Object.keys(MODI);
  fs.mkdirSync(RAW, { recursive: true });

  const stop = await startServers(doelen);
  const checks = [];
  try {
    for (const doel of doelen) {
      for (const modus of modi) {
        const resultaat = await draaiDoel(doel, modus);
        const t = tel(resultaat);
        console.log(`${doel.id}/${modus}: ${t.pass} van ${t.totaal}` +
          (t.bekend ? `, ${t.bekend} bekend` : "") + (t.onverwacht ? `, ${t.onverwacht} ONVERWACHT` : ""));
        checks.push(...resultaat);
      }
    }
  } finally {
    stop();
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules", "@redocly", "cli", "package.json"), "utf8"));
  const rapport = {
    datum: new Date().toISOString().slice(0, 10),
    respect: pkg.version,
    samenvatting: tel(checks),
    doelen: doelen.map((d) => ({
      id: d.id,
      profiel: d.profiel,
      modi: Object.fromEntries(modi.map((m) => [m, tel(checks.filter((c) => c.doel === d.id && c.modus === m))])),
    })),
    checks,
  };
  fs.writeFileSync(path.join(RESULTS, "rapport.json"), JSON.stringify(rapport, null, 2) + "\n");
  fs.writeFileSync(path.join(RESULTS, "rapport.md"), schrijfMarkdown(rapport));

  const s = rapport.samenvatting;
  console.log(`\n${s.pass} van ${s.totaal} geslaagd, ${s.bekend} bekend, ${s.onverwacht} onverwacht.`);
  console.log(`Rapport: ${path.relative(process.cwd(), path.join(RESULTS, "rapport.md"))}`);
  process.exit(s.onverwacht ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
