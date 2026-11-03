import React, { useState, useEffect } from "react";
import { marked } from "marked";
import yaml from "js-yaml";
import UmlDiagram from "./UmlDiagram";
import ResourceTopBar from "./ResourceTopBar";
import ArazzoView from "./ArazzoView";

function resolveRefLink(currentPath, refPath) {
  if (!refPath) return "#";
  if (refPath.startsWith("#")) return `/?file=${currentPath}`;
  try {
    const url = new URL(refPath, "http://dummy/" + currentPath);
    const resolvedPath = url.pathname.slice(1);
    return `/?file=${resolvedPath}`;
  } catch (e) {
    return "#";
  }
}

function MimMetadataView({ schema }) {
  const meta = schema["x-mim-metadata"];
  const properties = schema.properties || {};
  const defs = schema.$defs || {};

  const allTypes = { ...defs };
  if (schema.title && schema.properties) {
    allTypes[schema.title] = schema;
  }

  return (
    <div className="mim-section">
      <h3>MIM Informatie (Conceptueel Model)</h3>

      {Object.entries(allTypes).map(([typeName, typeDef]) => {
        const typeMeta = typeDef["x-mim-metadata"];
        if (!typeMeta && !typeDef.properties) return null;

        return (
          <div key={typeName} className="mim-card">
            <h4>{typeMeta?.naam || typeDef.title || typeName}</h4>
            {typeMeta && (
              <div className="mim-type-meta">
                {Object.entries(typeMeta).map(
                  ([k, v]) =>
                    k !== "id" &&
                    k !== "naam" &&
                    k !== "stereotype" && (
                      <p key={k}>
                        <strong>{k}:</strong> {v}
                      </p>
                    ),
                )}
              </div>
            )}

            <div className="mim-properties-grid">
              {Object.entries(typeDef.properties || {}).map(([propName, propDef]) => {
                const pMeta =
                  propDef["x-mim-metadata"] || (propDef.items && propDef.items["x-mim-metadata"]);
                if (!pMeta) return null;

                return (
                  <div key={propName} className="mim-prop-item">
                    <div className="mim-prop-header">
                      <strong>{pMeta.naam || propName}</strong>
                      <span className="mim-tech-name">({propName})</span>
                    </div>
                    <div className="mim-prop-details">
                      {Object.entries(pMeta).map(
                        ([k, v]) =>
                          k !== "naam" && (
                            <div key={k} className="mim-prop-tag">
                              <span className="mim-tag-label">{k}:</span> {v}
                            </div>
                          ),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function findResourceEntry(portalData, path) {
  const collections = [
    { kind: "Schema", items: portalData?.schemas || [] },
    { kind: "Patroon", items: portalData?.patterns || [] },
  ];

  for (const collection of collections) {
    const entry = collection.items.find((item) =>
      item.versions.some((version) => version.path === path),
    );
    if (entry) return { ...collection, entry };
  }

  return null;
}

export default function FileView({ path, portalData, navigate }) {
  const [content, setContent] = useState("Laden...");
  const [schema, setSchema] = useState(null);

  useEffect(() => {
    setSchema(null);
    setContent("Laden...");

    fetch("/" + path)
      .then((r) => r.text())
      .then((text) => {
        setContent(text);
        if (path.endsWith(".json")) {
          try {
            setSchema(JSON.parse(text));
          } catch (e) {
            console.error("Schema parse error:", e);
          }
        } else if (path.endsWith(".yaml") || path.endsWith(".yml")) {
          try {
            setSchema(yaml.load(text));
          } catch (e) {
            console.error("YAML parse error:", e);
          }
        }
      })
      .catch((e) => setContent("Fout bij laden bestand: " + e.message));
  }, [path]);

  const url = window.location.origin + "/" + path;
  const fileName = path.split("/").pop();
  const isArazzo = Boolean(schema?.arazzo);
  const title = schema?.title || (isArazzo && schema.info?.title) || fileName.replace(/\.(json|ya?ml)$/, "");

  const isSchema = path.startsWith("schemas/");
  const isPattern = path.startsWith("patterns/");
  const resourceEntry = findResourceEntry(portalData, path);
  const currentVersion = resourceEntry?.entry.versions.find((version) => version.path === path);
  const resourceVersions = (
    resourceEntry?.entry.versions || [{ version: schema?.version || "current", path }]
  ).map((version) => ({
    label: version.version,
    value: version.path,
  }));
  const versionLabel = currentVersion?.version || resourceVersions[0]?.label || "current";
  const resourceKind = resourceEntry?.kind || (isSchema ? "Schema" : isPattern ? "Patroon" : "Bestand");

  const breadcrumbText = isSchema ? "Schema's" : isPattern ? "Patronen" : null;
  const breadcrumbDoc = isSchema ? "docs/schemas.md" : isPattern ? "docs/patterns.md" : null;

  return (
    <div className="api-view">
      {(isSchema || isPattern) && (
        <ResourceTopBar
          kind={resourceKind}
          title={title}
          versionLabel={versionLabel}
          versions={resourceVersions}
          currentValue={path}
          onVersionChange={(value) => navigate(`file=${value}`)}
          actions={
            <a className="api-doc-link" href={`/${path}`} download={fileName}>
              Downloaden
            </a>
          }
        />
      )}
      <div className="view-container">
        {breadcrumbText && (
          <div className="breadcrumb">
            <a
              href={`/?doc=${breadcrumbDoc}`}
              onClick={(e) => {
                e.preventDefault();
                if (navigate) navigate(`doc=${breadcrumbDoc}`);
              }}
              className="breadcrumb-link"
            >
              {breadcrumbText}
            </a>
            <span className="breadcrumb-separator">/</span>
            <span>{title}</span>
          </div>
        )}

        {!isSchema && !isPattern && <h2>{title}</h2>}

        {isArazzo && <ArazzoView doc={schema} path={path} />}

        {schema && !isArazzo && schema.description && (
          <div
            className="schema-description"
            dangerouslySetInnerHTML={{ __html: marked.parse(schema.description) }}
          />
        )}

        {schema && !isArazzo && (
          <>
            <div className="schema-url-box" style={{ marginBottom: "20px" }}>
              <span>
                Ophalen via URL: <code>{url}</code>
              </span>
            </div>

            {/* Parameters for Patterns */}
            {isPattern && schema.parameters && (
              <div className="pattern-section">
                <h3>Parameters</h3>
                <ul className="pattern-list">
                  {Object.entries(schema.parameters).map(([key, param]) => (
                    <li key={key} className="pattern-card">
                      <strong style={{ fontSize: "1.1em" }}>{param.name || key}</strong>
                      <span className="pattern-meta">({param.in})</span>
                      {param.schema && param.schema.type && (
                        <span className="pattern-type-chip">{param.schema.type}</span>
                      )}
                      {param.description && (
                        <div
                          className="pattern-body-text"
                          dangerouslySetInnerHTML={{ __html: marked.parseInline(param.description) }}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* RequestBodies for Patterns */}
          {isPattern && schema.requestBodies && (
            <div className="pattern-section">
              <h3>Request Bodies</h3>
              <ul className="pattern-list">
                {Object.entries(schema.requestBodies).map(([key, body]) => (
                  <li key={key} className="pattern-card">
                    <strong style={{ fontSize: "1.1em" }}>{key}</strong>
                    {body.required && (
                      <span
                        style={{
                          marginLeft: "8px",
                          color: "#e11d48",
                          fontSize: "0.8em",
                          fontWeight: "bold",
                        }}
                      >
                        REQUIRED
                      </span>
                    )}
                    {body.description && (
                      <div
                        className="pattern-body-text"
                        dangerouslySetInnerHTML={{ __html: marked.parseInline(body.description) }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Responses for Patterns */}
          {isPattern && schema.responses && (
            <div className="pattern-section">
              <h3>Responses</h3>
              <ul className="pattern-list">
                {Object.entries(schema.responses).map(([key, response]) => (
                  <li key={key} className="pattern-card">
                    <strong style={{ fontSize: "1.1em" }}>{key}</strong>
                    {(response.description || response.$ref) && (
                      <div
                        className="pattern-body-text"
                        dangerouslySetInnerHTML={{
                          __html: marked.parseInline(
                            response.description ||
                              `Referentie naar [${response.$ref}](${resolveRefLink(path, response.$ref)})`,
                          ),
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* UML Diagram */}
          {isSchema && (
            <>
              <h3>Diagram</h3>
              <div className="diagram-container">
                <UmlDiagram schema={schema} />
              </div>
            </>
          )}
        </>
      )}

      {isArazzo ? (
        <details className="arazzo-raw">
          <summary>Bekijk YAML</summary>
          <p>
            <a href={`/${path}`} download={fileName}>
              Downloaden
            </a>
          </p>
          <pre className="raw-content">{content}</pre>
        </details>
      ) : (
        <>
          <h3>Ruwe Inhoud</h3>
          <pre className="raw-content">{content}</pre>
        </>
      )}
      </div>
    </div>
  );
}
