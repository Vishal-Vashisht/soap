
import "./App.css";
import { useEffect, useState } from "react";

const WSDL_URL = "/soap?wsdl";

function localName(element) {
  return element?.localName || element?.nodeName?.split(":").pop() || "";
}

function childrenNamed(element, name) {
  return Array.from(element?.children || []).filter(
    (child) => localName(child) === name
  );
}

function descendants(element, name) {
  return Array.from(element?.getElementsByTagName("*") || []).filter(
    (child) => localName(child) === name
  );
}

function qnameLocal(qname = "") {
  return qname.split(":").pop();
}

function typeName(type = "") {
  const name = qnameLocal(type);

  const types = {
    integer: "integer",
    int: "integer",
    long: "long",
    short: "short",
    byte: "byte",
    nonNegativeInteger: "integer",
    positiveInteger: "integer",
    string: "string",
    token: "string",
    normalizedString: "string",
    decimal: "decimal",
    boolean: "boolean",
    float: "float",
    double: "double",
    dateTime: "dateTime",
    date: "date",
    time: "time",
    anyType: "any",
  };

  return types[name] || name || "unknown";
}

function parseWsdl(xmlText) {
  const xml = new DOMParser().parseFromString(
    xmlText,
    "application/xml"
  );

  if (
    xml.querySelector("parsererror") ||
    localName(xml.documentElement) !== "definitions"
  ) {
    throw new Error("The SOAP service returned invalid WSDL XML.");
  }

  const definitions = xml.documentElement;

  // Index WSDL messages by name.
  const messages = new Map();

  for (const message of descendants(definitions, "message")) {
    const name = message.getAttribute("name");
    if (name) messages.set(name, message);
  }

  // Index schema elements and complex types.
  const schemaElements = new Map();
  const complexTypes = new Map();
  const simpleTypes = new Map();

  for (const schema of descendants(definitions, "schema")) {
    for (const element of childrenNamed(schema, "element")) {
      const name = element.getAttribute("name");
      if (name) schemaElements.set(name, element);
    }

    for (const type of childrenNamed(schema, "complexType")) {
      const name = type.getAttribute("name");
      if (name) complexTypes.set(name, type);
    }

    for (const type of childrenNamed(schema, "simpleType")) {
      const name = type.getAttribute("name");
      if (name) simpleTypes.set(name, type);
    }
  }

  function resolveElementType(element, seen = new Set()) {
    if (!element) return "unknown";

    const directType = element.getAttribute("type");
    if (directType) {
      const name = qnameLocal(directType);

      if (complexTypes.has(name)) return name;
      if (simpleTypes.has(name)) {
        return resolveSimpleType(simpleTypes.get(name), seen);
      }

      return typeName(directType);
    }

    const inlineComplex = childrenNamed(element, "complexType")[0];
    if (inlineComplex) {
      const nested = descendants(inlineComplex, "element");
      if (nested.length) return "object";
    }

    const inlineSimple = childrenNamed(element, "simpleType")[0];
    if (inlineSimple) return resolveSimpleType(inlineSimple, seen);

    return "unknown";
  }

  function resolveSimpleType(simpleType, seen = new Set()) {
    const restriction = descendants(simpleType, "restriction")[0];
    const base = restriction?.getAttribute("base");

    if (!base) return "string";

    const name = qnameLocal(base);

    if (simpleTypes.has(name) && !seen.has(name)) {
      seen.add(name);
      return resolveSimpleType(simpleTypes.get(name), seen);
    }

    return typeName(base);
  }

  function getElementFields(element, seen = new Set()) {
    if (!element) return [];

    const type = element.getAttribute("type");
    const complexType = type
      ? complexTypes.get(qnameLocal(type))
      : childrenNamed(element, "complexType")[0];

    if (!complexType) return [];

    // Include fields inside sequence, all, or choice groups.
    const fieldContainers = descendants(complexType, "sequence")
      .concat(descendants(complexType, "all"))
      .concat(descendants(complexType, "choice"));

    const fieldElements = fieldContainers.flatMap((container) =>
      childrenNamed(container, "element")
    );

    const uniqueFields = new Map();

    for (const field of fieldElements) {
      const name = field.getAttribute("name");
      if (!name) continue;

      let fieldType = resolveElementType(field);

      // Follow references to named schema elements.
      const ref = field.getAttribute("ref");
      if (ref) {
        const referenced = schemaElements.get(qnameLocal(ref));
        if (referenced) {
          fieldType = resolveElementType(referenced);
        }
      }

      const maxOccurs = field.getAttribute("maxOccurs");
      if (maxOccurs === "unbounded" || Number(maxOccurs) > 1) {
        fieldType = `${fieldType}[]`;
      }

      uniqueFields.set(name, {
        name,
        type: fieldType,
        required: field.getAttribute("minOccurs") !== "0",
      });
    }

    return Array.from(uniqueFields.values());
  }

  function resolveMessageFields(messageName) {
    const message = messages.get(qnameLocal(messageName));
    if (!message) return [];

    const fields = [];

    for (const part of childrenNamed(message, "part")) {
      const elementRef = part.getAttribute("element");
      const typeRef = part.getAttribute("type");

      if (elementRef) {
        const element = schemaElements.get(qnameLocal(elementRef));

        if (element) {
          const elementName = element.getAttribute("name") || "";
          const nestedFields = getElementFields(element);

          if (nestedFields.length) {
            fields.push(...nestedFields);
          } else {
            fields.push({
              name: elementName || part.getAttribute("name") || "value",
              type: resolveElementType(element),
              required: true,
            });
          }
        } else {
          fields.push({
            name: qnameLocal(elementRef),
            type: "unknown",
            required: true,
          });
        }
      } else if (typeRef) {
        fields.push({
          name: part.getAttribute("name") || "value",
          type: typeName(typeRef),
          required: true,
        });
      }
    }

    return fields;
  }

  const portTypes = descendants(definitions, "portType");
  const portType = portTypes[0];

  if (!portType) {
    throw new Error("No SOAP portType was found in the WSDL.");
  }

  return childrenNamed(portType, "operation").map((operation) => {
    const name = operation.getAttribute("name") || "unknown";
    const input = childrenNamed(operation, "input")[0];
    const output = childrenNamed(operation, "output")[0];

    const inputMessage = input?.getAttribute("message");
    const outputMessage = output?.getAttribute("message");

    const inputs = inputMessage
      ? resolveMessageFields(inputMessage)
      : [];

    const outputs = outputMessage
      ? resolveMessageFields(outputMessage)
      : [];

    let returnType = "void";

    if (outputs.length === 1) {
      returnType = outputs[0].type;
    } else if (outputs.length > 1) {
      returnType = "object";
    }

    return {
      name,
      inputs,
      returnType,
    };
  });
}

function operationDetails(name) {
  const details = {
    add: {
      title: "Add",
      description: "Adds two integers and returns their sum.",
      symbol: "+",
      color: "blue",
    },
    multiply: {
      title: "Multiply",
      description: "Multiplies two integers and returns the result.",
      symbol: "×",
      color: "green",
    },
    get_employees: {
      title: "Get Employees",
      description: "Returns employee records, including names and salaries.",
      symbol: "♙",
      color: "purple",
    },
  };

  return details[name] || {
    title: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: "SOAP operation discovered from WSDL.",
    symbol: "⚙",
    color: "blue",
  };
}

function App() {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOperations() {
      try {
        const response = await fetch(WSDL_URL);

        if (!response.ok) {
          throw new Error(`WSDL request failed: ${response.status}`);
        }

        const xmlText = await response.text();
        const discovered = parseWsdl(xmlText);

        if (!cancelled) {
          setOperations(discovered);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load SOAP operations.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOperations();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <header className="navbar">
        <div className="brand">☁ SOAP Portal</div>
        <span className="tag">Developer API</span>
      </header>

      <main>
        <section className="hero">
          <span className="status">● Service portal</span>

          <h1>Integrate with our SOAP API</h1>

          <p>
            Get the WSDL definition and connect your application
            to our SOAP web service.
          </p>

          <div className="actions">
            <a className="primary" href="/soap?download_wsdl=1">
              ↓ Download WSDL
            </a>
            <a className="secondary" href="/soap?wsdl">
              View WSDL →
            </a>
          </div>
        </section>

        <section className="operations">
          <h2>Available operations</h2>
          <p className="subtitle">
            Operations discovered automatically from the live SOAP WSDL.
          </p>

          {loading && <p>Loading operations...</p>}

          {error && (
            <p role="alert">
              Unable to load operations: {error}
            </p>
          )}

          {!loading && !error && operations.length === 0 && (
            <p>No operations were found in the WSDL.</p>
          )}

          {!loading && !error && operations.length > 0 && (
            <div className="cards">
              {operations.map((operation) => {
                const details = operationDetails(operation.name);

                return (
                  <article className="card" key={operation.name}>
                    <div className={`symbol ${details.color}`}>
                      {details.symbol}
                    </div>

                    <h3>{details.title}</h3>
                    <p>{details.description}</p>

                    <code>
                      {operation.name}(
                      {operation.inputs
                        .map((input) => `${input.name}: ${input.type}`)
                        .join(", ")}
                      ) → {operation.returnType}
                    </code>

                    <section className="arguments">
                      <h4>Function arguments</h4>

                      {operation.inputs.length > 0 ? (
                        <ul className="argument-list">
                          {operation.inputs.map((input) => (
                            <li className="argument" key={input.name}>
                              <span className="argument-name">
                                {input.name}
                                {input.required ? " *" : ""}
                              </span>
                              <span className="argument-type">
                                {input.type}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="no-arguments">
                          This operation has no input arguments, or the WSDL
                          does not expose its input fields.
                        </p>
                      )}
                    </section>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer>SOAP Portal · Powered by React and Spyne</footer>
    </div>
  );
}

export default App;
