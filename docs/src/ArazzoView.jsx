import React, { useEffect, useState } from "react";
import { marked } from "marked";

/** Pad relatief aan de map van het Arazzo-bestand oplossen. */
function resolvePath(base, rel) {
  const parts = base.split("/").slice(0, -1);
  for (const seg of rel.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

/** Link naar de spec in de portal (gebundelde OpenAPI in Scalar), of naar buiten. */
function sourceHref(source, path) {
  if (/^https?:\/\//.test(source.url)) return source.url;
  const specPath = resolvePath(path, source.url);
  return `/?url=/docs/bundled/${specPath.replace(/\//g, "_")}`;
}

/** Splitst tekst in gewone stukken en runtime-expressies ($inputs.x, $steps.y.outputs.z, ...). */
function Expr({ text }) {
  const str = String(text);
  const parts = str.split(/(\$[a-zA-Z]+(?:[.#/][\w\-./#]*)?)/g);
  return (
    <code className="arazzo-expr">
      {parts.map((p, i) =>
        p.startsWith("$") ? (
          <span key={i} className="arazzo-runtime">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </code>
  );
}

/** Beschrijft waar een waarde vandaan komt, als die uit een eerdere stap of input komt. */
function dataFlow(value) {
  const str = String(value);
  const step = str.match(/\$steps\.([\w-]+)\.outputs\.([\w-]+)/);
  if (step) return `${step[2]} uit stap ${step[1]}`;
  const input = str.match(/\$inputs\.([\w-]+)/);
  if (input) return `input ${input[1]}`;
  return null;
}

function operationLabel(step) {
  const op = step.operationId || step.operationPath || step.workflowId || "";
  const m = op.match(/^\$sourceDescriptions\.([\w-]+)\.(.+)$/);
  return m ? { source: m[1], op: m[2] } : { source: null, op };
}

const STATUS_LABEL = { pass: "geslaagd", fail: "gefaald", bekend: "bekend" };

function ResultBadges({ results }) {
  if (!results?.length) return null;
  return (
    <div className="arazzo-results">
      {results.map((r) => {
        const status = r.status === "fail" && r.bekend ? "bekend" : r.status;
        return (
          <span
            key={r.id}
            className={`arazzo-badge arazzo-badge-${status}`}
            title={r.bekend?.uitleg || r.reden || ""}
          >
            {r.doel} · {r.modus}: {STATUS_LABEL[status] || status}
          </span>
        );
      })}
    </div>
  );
}

function Step({ step, index, sources, path }) {
  const { source, op } = operationLabel(step);
  const src = sources.find((s) => s.name === source);
  return (
    <li className="arazzo-step">
      <div className="arazzo-step-num">{index + 1}</div>
      <div className="arazzo-step-body">
        <div className="arazzo-step-head">
          <strong>{step.stepId}</strong>
          <span className="arazzo-op">
            {src ? (
              <a href={sourceHref(src, path)} className="arazzo-chip">
                {source}
              </a>
            ) : (
              source && <span className="arazzo-chip">{source}</span>
            )}
            <code>{op}</code>
          </span>
        </div>
        {step.description && <p className="arazzo-muted">{step.description}</p>}

        {step.parameters?.length > 0 && (
          <div className="arazzo-block">
            <div className="arazzo-label">Parameters</div>
            <ul className="arazzo-params">
              {step.parameters.map((p, i) =>
                p.reference ? (
                  <li key={i}>
                    <Expr text={p.reference} />
                  </li>
                ) : (
                  <li key={i}>
                    <span className="arazzo-in">{p.in}</span> <code>{p.name}</code> ={" "}
                    <Expr text={p.value} />
                    {dataFlow(p.value) && <span className="arazzo-flow">← {dataFlow(p.value)}</span>}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}

        {step.requestBody && (
          <div className="arazzo-block">
            <div className="arazzo-label">Request body</div>
            <pre className="arazzo-pre">{JSON.stringify(step.requestBody.payload ?? step.requestBody, null, 2)}</pre>
          </div>
        )}

        {step.successCriteria?.length > 0 && (
          <div className="arazzo-block">
            <div className="arazzo-label">Moet gelden</div>
            <ul className="arazzo-checks">
              {step.successCriteria.map((c, i) => (
                <li key={i}>
                  <span className="arazzo-check">✓</span> <Expr text={c.condition} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {step.outputs && Object.keys(step.outputs).length > 0 && (
          <div className="arazzo-block">
            <div className="arazzo-label">Outputs</div>
            <ul className="arazzo-params">
              {Object.entries(step.outputs).map(([k, v]) => (
                <li key={k}>
                  <code>{k}</code> = <Expr text={v} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {["onSuccess", "onFailure"].map(
          (key) =>
            step[key]?.length > 0 && (
              <div className="arazzo-block" key={key}>
                <div className="arazzo-label">{key === "onSuccess" ? "Bij succes" : "Bij falen"}</div>
                <ul className="arazzo-params">
                  {step[key].map((a, i) => (
                    <li key={i}>
                      <code>{a.type}</code>
                      {a.stepId && <> naar stap <code>{a.stepId}</code></>}
                      {a.workflowId && <> naar workflow <code>{a.workflowId}</code></>}
                      {a.name && <span className="arazzo-muted"> ({a.name})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ),
        )}
      </div>
    </li>
  );
}

function Inputs({ inputs }) {
  const props = inputs?.properties;
  if (!props || Object.keys(props).length === 0) return null;
  const required = new Set(inputs.required || []);
  return (
    <div className="arazzo-block">
      <div className="arazzo-label">Inputs</div>
      <ul className="arazzo-params">
        {Object.entries(props).map(([name, def]) => (
          <li key={name}>
            <code>{name}</code>
            {required.has(name) && <span className="arazzo-req">verplicht</span>}
            {def?.description && <span className="arazzo-muted"> {def.description}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ArazzoView({ doc, path }) {
  const [rapport, setRapport] = useState(null);

  useEffect(() => {
    if (!path.startsWith("aansluitprofielen/")) return;
    fetch("/aansluitprofielen/results/rapport.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setRapport)
      .catch(() => setRapport(null));
  }, [path]);

  const sources = doc.sourceDescriptions || [];
  const doelen = new Set((rapport?.doelen || []).filter((d) => d.profiel === path).map((d) => d.id));
  const resultsFor = (workflowId) =>
    (rapport?.checks || []).filter((c) => doelen.has(c.doel) && c.workflow === workflowId);

  return (
    <div className="arazzo-view">
      <div className="arazzo-meta">
        <span className="arazzo-chip arazzo-chip-muted">Arazzo {doc.arazzo}</span>
        {doc.info?.version && <span className="arazzo-chip arazzo-chip-muted">versie {doc.info.version}</span>}
        {rapport && doelen.size > 0 && (
          <span className="arazzo-chip arazzo-chip-muted">
            laatste run {rapport.datum} ({[...doelen].join(", ")})
          </span>
        )}
      </div>

      {doc.info?.description && (
        <div className="schema-description" dangerouslySetInnerHTML={{ __html: marked.parse(doc.info.description) }} />
      )}

      {sources.length > 0 && (
        <div className="arazzo-block">
          <div className="arazzo-label">Bronnen</div>
          <div className="arazzo-sources">
            {sources.map((s) => (
              <a key={s.name} href={sourceHref(s, path)} className="arazzo-chip">
                {s.name} <span className="arazzo-muted">{s.type}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <h3>Workflows ({doc.workflows?.length || 0})</h3>
      {(doc.workflows || []).map((wf) => (
        <section key={wf.workflowId} id={wf.workflowId} className="arazzo-workflow">
          <div className="arazzo-wf-head">
            <h4>{wf.summary || wf.workflowId}</h4>
            <code className="arazzo-wf-id">{wf.workflowId}</code>
          </div>
          <ResultBadges results={resultsFor(wf.workflowId)} />
          {wf.description && (
            <div className="arazzo-muted" dangerouslySetInnerHTML={{ __html: marked.parse(wf.description) }} />
          )}
          <Inputs inputs={wf.inputs} />
          <ol className="arazzo-steps">
            {(wf.steps || []).map((step, i) => (
              <Step key={step.stepId || i} step={step} index={i} sources={sources} path={path} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
