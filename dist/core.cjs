'use strict';

// DocCrunch - Document ingestion engine

// src/core/registry.ts
var registry = /* @__PURE__ */ new Map();
function registerParser(type, parser) {
  registry.set(type, parser);
}
function getParser(type) {
  return registry.get(type);
}
function getRegisteredTypes() {
  return Array.from(registry.keys());
}
function clearRegistry() {
  registry.clear();
}

// src/core/detect.ts
var checks = [
  {
    type: "merchant-statement",
    test: (content) => {
      const upper = content.toUpperCase();
      return upper.includes("ELAVON") || upper.includes("MERCHANT STATEMENT") || upper.includes("MERCHANT SERVICES") || upper.includes("ACQUIRER") || // Elavon-style: has card scheme + interchange + settlement language
      upper.includes("INTERCHANGE") && upper.includes("SETTLEMENT") && (upper.includes("VISA") || upper.includes("MASTERCARD"));
    }
  },
  {
    type: "bank-csv",
    test: (content) => {
      const headerLine = content.split("\n").find((l) => l.trim().length > 0);
      if (!headerLine) return false;
      const headers = headerLine.toLowerCase().split(/[,\t]/).map((h) => h.trim());
      const hasDate = headers.some((h) => h === "date" || h === "transaction date");
      const hasDescription = headers.some(
        (h) => h === "description" || h === "details" || h === "narrative"
      );
      const hasAmount = headers.some((h) => h === "amount" || h === "value") || headers.some((h) => h === "debit") && headers.some((h) => h === "credit");
      return hasDate && hasDescription && hasAmount;
    }
  },
  {
    type: "esb-meter",
    test: (content) => {
      const headerLine = content.split("\n").find((l) => l.trim().length > 0);
      if (!headerLine) return false;
      const headers = headerLine.toLowerCase().split(/[,\t]/).map((h) => h.trim());
      const hasTimestamp = headers.some((h) => h === "timestamp" || h === "reading_time" || h === "date_time");
      const hasImport = headers.some((h) => h === "import_kwh" || h === "import" || h === "kwh_import");
      const hasMprn = headers.some((h) => h === "mprn");
      return hasTimestamp && (hasImport || hasMprn);
    }
  }
];
function detectType(content) {
  for (const type of getRegisteredTypes()) {
    const parser = getParser(type);
    if (parser?.detect(content)) {
      return type;
    }
  }
  const tried = [];
  for (const check of checks) {
    tried.push(check.type);
    if (check.test(content)) {
      return check.type;
    }
  }
  throw new Error(
    `Could not detect document type. Checks tried: ${tried.join(", ")}. Provide a --type flag or register a custom parser.`
  );
}

// src/core/envelope.ts
function wrapEnvelope(type, source, payload, parserVersion, confidence = "high") {
  const meta = {
    type,
    source,
    parsedAt: (/* @__PURE__ */ new Date()).toISOString(),
    confidence,
    parserVersion
  };
  return { meta, payload };
}
function wrapError(type, source, parserVersion, error) {
  return {
    meta: {
      type,
      source,
      parsedAt: (/* @__PURE__ */ new Date()).toISOString(),
      confidence: "low",
      parserVersion
    },
    payload: {},
    error
  };
}

// src/core/types.ts
var DOCUMENT_TYPES = [
  "merchant-statement",
  "bank-csv",
  "esb-meter"
];

exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
exports.clearRegistry = clearRegistry;
exports.detectType = detectType;
exports.getParser = getParser;
exports.getRegisteredTypes = getRegisteredTypes;
exports.registerParser = registerParser;
exports.wrapEnvelope = wrapEnvelope;
exports.wrapError = wrapError;
