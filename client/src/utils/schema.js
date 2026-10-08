import { typeOf } from './json.js';

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const URI = /^(https?|ftp):\/\/\S+$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function detectFormat(value) {
  if (typeof value !== 'string') return null;
  if (UUID.test(value)) return 'uuid';
  if (ISO_DATE_TIME.test(value)) return 'date-time';
  if (ISO_DATE.test(value)) return 'date';
  if (EMAIL.test(value)) return 'email';
  if (URI.test(value)) return 'uri';
  return null;
}

/** Build a schema node from a single value. */
export function inferSchema(value) {
  const type = typeOf(value);

  if (type === 'array') {
    const items = value.slice(0, 200).map(inferSchema);
    return { kind: 'array', length: value.length, items: items.reduce(mergeSchema, null) };
  }
  if (type === 'object') {
    const fields = new Map();
    for (const [key, child] of Object.entries(value)) {
      fields.set(key, { schema: inferSchema(child), count: 1 });
    }
    return { kind: 'object', total: 1, fields };
  }
  if (type === 'number') {
    return {
      kind: 'primitive',
      types: new Set([Number.isInteger(value) ? 'integer' : 'number']),
      sample: value,
    };
  }
  return {
    kind: 'primitive',
    types: new Set([type]),
    sample: value,
    format: detectFormat(value),
  };
}

/** Combine two schemas, e.g. across the items of an array. */
export function mergeSchema(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.kind !== b.kind) {
    const collect = (node) =>
      node.kind === 'primitive' ? [...node.types] : [node.kind === 'array' ? 'array' : 'object'];
    return { kind: 'primitive', types: new Set([...collect(a), ...collect(b)]), sample: a.sample ?? b.sample };
  }
  if (a.kind === 'primitive') {
    return {
      kind: 'primitive',
      types: new Set([...a.types, ...b.types]),
      sample: a.sample ?? b.sample,
      format: a.format ?? b.format,
    };
  }
  if (a.kind === 'array') {
    return { kind: 'array', length: a.length, items: mergeSchema(a.items, b.items) };
  }
  const fields = new Map();
  for (const [key, entry] of a.fields) fields.set(key, { ...entry });
  for (const [key, entry] of b.fields) {
    const existing = fields.get(key);
    if (existing) {
      existing.schema = mergeSchema(existing.schema, entry.schema);
      existing.count += entry.count;
    } else {
      fields.set(key, { ...entry });
    }
  }
  return { kind: 'object', total: a.total + b.total, fields };
}

/** Flat, readable field list: `id  number`. */
export function schemaToRows(schema, prefix = '', depth = 0, rows = []) {
  if (!schema || depth > 12) return rows;
  if (schema.kind === 'object') {
    for (const [key, entry] of schema.fields) {
      const path = prefix ? `${prefix}.${key}` : key;
      rows.push({
        path,
        key,
        depth,
        type: describeType(entry.schema),
        optional: entry.count < schema.total,
      });
      schemaToRows(entry.schema, path, depth + 1, rows);
    }
  } else if (schema.kind === 'array') {
    if (schema.items && (schema.items.kind === 'object' || schema.items.kind === 'array')) {
      schemaToRows(schema.items, prefix ? `${prefix}[]` : '[]', depth, rows);
    }
  }
  return rows;
}

export function describeType(schema) {
  if (!schema) return 'unknown';
  if (schema.kind === 'array') return `array<${describeType(schema.items)}>`;
  if (schema.kind === 'object') return 'object';
  const types = [...schema.types];
  const label = types.length > 1 ? types.join(' | ') : types[0] ?? 'unknown';
  return schema.format ? `${label} (${schema.format})` : label;
}

/* ------------------------------------------------------------------ */
/* Code generation                                                     */
/* ------------------------------------------------------------------ */

const pascal = (value) =>
  String(value)
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ''))
    .replace(/^[a-z]/, (chr) => chr.toUpperCase())
    .replace(/^[0-9]/, (chr) => `N${chr}`) || 'Model';

const snake = (value) =>
  String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase();

const camel = (value) => {
  const p = pascal(value);
  return p.charAt(0).toLowerCase() + p.slice(1);
};

/** A safe identifier, or a quoted key when the name is not an identifier. */
const isIdentifier = (key) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);

/** Unwrap `array<object>` so generators emit the item model. */
function rootObjectSchema(schema) {
  let node = schema;
  let wrappedInArray = false;
  while (node && node.kind === 'array') {
    node = node.items;
    wrappedInArray = true;
  }
  return { node, wrappedInArray };
}

/**
 * Walk the schema and collect every nested object as a named model.
 * Generators then render the collected models in their own syntax.
 */
function collectModels(schema, rootName = 'Root') {
  const models = [];
  const seen = new Map();

  const visit = (node, name) => {
    if (!node) return 'unknown';
    if (node.kind === 'array') {
      const inner = visit(node.items, singularize(name));
      return { array: inner };
    }
    if (node.kind !== 'object') return node;

    const modelName = uniqueName(pascal(name), seen);
    const model = { name: modelName, fields: [] };
    models.push(model);
    for (const [key, entry] of node.fields) {
      model.fields.push({
        name: key,
        optional: entry.count < node.total,
        schema: entry.schema,
        resolved: visit(entry.schema, key),
      });
    }
    return { model: modelName };
  };

  const result = visit(schema, rootName);
  return { models, result };
}

function uniqueName(name, seen) {
  let candidate = name;
  let counter = 2;
  while (seen.has(candidate)) {
    candidate = `${name}${counter}`;
    counter += 1;
  }
  seen.set(candidate, true);
  return candidate;
}

function singularize(name) {
  if (/ies$/i.test(name)) return name.replace(/ies$/i, 'y');
  if (/(s|list)$/i.test(name) && !/ss$/i.test(name)) return name.replace(/(s|list)$/i, '');
  return `${name}Item`;
}

/** Render a resolved type with a per-language mapping. */
function renderType(resolved, schema, lang) {
  if (resolved && resolved.model) return lang.model(resolved.model);
  if (resolved && resolved.array) return lang.array(renderType(resolved.array, schema?.items, lang));
  const types = schema?.kind === 'primitive' ? [...schema.types] : ['unknown'];
  return lang.primitive(types, schema?.format);
}

const LANGS = {
  typescript: {
    model: (name) => name,
    array: (inner) => `${inner}[]`,
    primitive: (types) => {
      const mapped = types.map((type) =>
        ({ integer: 'number', number: 'number', string: 'string', boolean: 'boolean', null: 'null' })[type] ??
        'unknown',
      );
      return [...new Set(mapped)].join(' | ') || 'unknown';
    },
  },
  python: {
    model: (name) => name,
    array: (inner) => `List[${inner}]`,
    primitive: (types) => {
      const mapped = types.map((type) =>
        ({ integer: 'int', number: 'float', string: 'str', boolean: 'bool', null: 'None' })[type] ?? 'Any',
      );
      const unique = [...new Set(mapped)];
      if (unique.length === 1) return unique[0];
      const withoutNone = unique.filter((t) => t !== 'None');
      if (unique.includes('None') && withoutNone.length === 1) return `Optional[${withoutNone[0]}]`;
      return `Union[${unique.join(', ')}]`;
    },
  },
  java: {
    model: (name) => name,
    array: (inner) => `List<${inner}>`,
    primitive: (types) => {
      const mapped = types.map((type) =>
        ({ integer: 'Long', number: 'Double', string: 'String', boolean: 'Boolean', null: 'Object' })[type] ??
        'Object',
      );
      const unique = [...new Set(mapped.filter((t) => t !== 'Object'))];
      return unique.length === 1 ? unique[0] : 'Object';
    },
  },
  csharp: {
    model: (name) => name,
    array: (inner) => `List<${inner}>`,
    primitive: (types) => {
      const mapped = types.map((type) =>
        ({ integer: 'long', number: 'double', string: 'string', boolean: 'bool', null: 'object' })[type] ??
        'object',
      );
      const unique = [...new Set(mapped.filter((t) => t !== 'object'))];
      if (unique.length !== 1) return 'object';
      return types.includes('null') && unique[0] !== 'string' ? `${unique[0]}?` : unique[0];
    },
  },
  php: {
    model: (name) => name,
    array: (inner) => `${inner}[]`,
    primitive: (types) => {
      const mapped = types.map((type) =>
        ({ integer: 'int', number: 'float', string: 'string', boolean: 'bool', null: 'null' })[type] ?? 'mixed',
      );
      return [...new Set(mapped)].join('|') || 'mixed';
    },
  },
};

export function generateTypeScript(schema, rootName = 'Root') {
  const { node, wrappedInArray } = rootObjectSchema(schema);
  if (!node || node.kind !== 'object') {
    return `type ${pascal(rootName)} = ${renderType(null, schema, LANGS.typescript)};`;
  }
  const { models } = collectModels(node, rootName);
  const blocks = models.map((model) => {
    const fields = model.fields
      .map((field) => {
        const name = isIdentifier(field.name) ? field.name : `'${field.name}'`;
        return `  ${name}${field.optional ? '?' : ''}: ${renderType(field.resolved, field.schema, LANGS.typescript)};`;
      })
      .join('\n');
    return `export interface ${model.name} {\n${fields}\n}`;
  });
  if (wrappedInArray) {
    blocks.push(`export type ${pascal(rootName)}Response = ${models[0].name}[];`);
  }
  return blocks.join('\n\n');
}

export function generateJsExample(data) {
  const sample = Array.isArray(data) ? data[0] : data;
  return `// Example object shaped like the response\nconst example = ${JSON.stringify(sample, null, 2)};`;
}

export function generateJsonSchema(schema, rootName = 'Root') {
  const build = (node) => {
    if (!node) return {};
    if (node.kind === 'array') return { type: 'array', items: build(node.items) };
    if (node.kind === 'object') {
      const properties = {};
      const required = [];
      for (const [key, entry] of node.fields) {
        properties[key] = build(entry.schema);
        if (entry.count >= node.total) required.push(key);
      }
      return { type: 'object', properties, ...(required.length ? { required } : {}) };
    }
    const types = [...node.types].map((type) => (type === 'integer' ? 'integer' : type));
    return {
      type: types.length === 1 ? types[0] : types,
      ...(node.format ? { format: node.format } : {}),
    };
  };
  return JSON.stringify(
    { $schema: 'https://json-schema.org/draft/2020-12/schema', title: pascal(rootName), ...build(schema) },
    null,
    2,
  );
}

export function generateZod(schema, rootName = 'Root') {
  const build = (node, indent = 0) => {
    const pad = '  '.repeat(indent + 1);
    if (!node) return 'z.unknown()';
    if (node.kind === 'array') return `z.array(${build(node.items, indent)})`;
    if (node.kind === 'object') {
      const lines = [...node.fields].map(([key, entry]) => {
        const name = isIdentifier(key) ? key : `'${key}'`;
        return `${pad}${name}: ${build(entry.schema, indent + 1)}${entry.count < node.total ? '.optional()' : ''},`;
      });
      return `z.object({\n${lines.join('\n')}\n${'  '.repeat(indent)}})`;
    }
    const types = [...node.types];
    const map = (type) =>
      ({ integer: 'z.number().int()', number: 'z.number()', string: 'z.string()', boolean: 'z.boolean()', null: 'z.null()' })[type] ??
      'z.unknown()';
    const nonNull = types.filter((type) => type !== 'null');
    let base = nonNull.length <= 1 ? map(nonNull[0] ?? 'null') : `z.union([${nonNull.map(map).join(', ')}])`;
    if (nonNull.length && nonNull.every((t) => t === 'string') && node.format === 'date-time') {
      base = 'z.string().datetime()';
    } else if (nonNull.length === 1 && nonNull[0] === 'string' && node.format === 'email') {
      base = 'z.string().email()';
    } else if (nonNull.length === 1 && nonNull[0] === 'string' && node.format === 'uri') {
      base = 'z.string().url()';
    } else if (nonNull.length === 1 && nonNull[0] === 'string' && node.format === 'uuid') {
      base = 'z.string().uuid()';
    }
    return types.includes('null') && nonNull.length ? `${base}.nullable()` : base;
  };
  return `import { z } from 'zod';\n\nexport const ${camel(rootName)}Schema = ${build(schema)};\n\nexport type ${pascal(rootName)} = z.infer<typeof ${camel(rootName)}Schema>;`;
}

export function generatePythonDataclass(schema, rootName = 'Root') {
  const { node } = rootObjectSchema(schema);
  if (!node || node.kind !== 'object') return '# The response is not an object, no dataclass generated.';
  const { models } = collectModels(node, rootName);
  const blocks = models
    .slice()
    .reverse() // define nested models before they are referenced
    .map((model) => {
      const fields = model.fields.map((field) => {
        const type = renderType(field.resolved, field.schema, LANGS.python);
        const name = snake(field.name);
        return field.optional
          ? `    ${name}: Optional[${type}] = None`
          : `    ${name}: ${type}`;
      });
      // Fields with defaults must come last in a dataclass.
      const required = fields.filter((line) => !line.includes(' = '));
      const optional = fields.filter((line) => line.includes(' = '));
      return `@dataclass\nclass ${model.name}:\n${[...required, ...optional].join('\n') || '    pass'}`;
    });
  return `from dataclasses import dataclass\nfrom typing import Any, List, Optional, Union\n\n\n${blocks.join('\n\n\n')}`;
}

export function generatePydantic(schema, rootName = 'Root') {
  const { node } = rootObjectSchema(schema);
  if (!node || node.kind !== 'object') return '# The response is not an object, no model generated.';
  const { models } = collectModels(node, rootName);
  const blocks = models
    .slice()
    .reverse()
    .map((model) => {
      const fields = model.fields.map((field) => {
        const type = renderType(field.resolved, field.schema, LANGS.python);
        const name = snake(field.name);
        const alias = name !== field.name ? ` = Field(${field.optional ? 'None' : '...'}, alias="${field.name}")` : field.optional ? ' = None' : '';
        return `    ${name}: ${field.optional && !name.includes('Optional') ? `Optional[${type}]` : type}${alias}`;
      });
      return `class ${model.name}(BaseModel):\n${fields.join('\n') || '    pass'}`;
    });
  return `from typing import Any, List, Optional, Union\n\nfrom pydantic import BaseModel, Field\n\n\n${blocks.join('\n\n\n')}`;
}

export function generatePhp(schema, rootName = 'Root') {
  const { node } = rootObjectSchema(schema);
  if (!node || node.kind !== 'object') return '<?php\n// The response is not an object.';
  const { models } = collectModels(node, rootName);
  const blocks = models.map((model) => {
    const props = model.fields.map((field) => {
      const type = renderType(field.resolved, field.schema, LANGS.php);
      return `    /** @var ${type} */\n    public $${camel(field.name)};`;
    });
    return `class ${model.name}\n{\n${props.join('\n\n')}\n}`;
  });
  return `<?php\n\ndeclare(strict_types=1);\n\n${blocks.join('\n\n')}`;
}

export function generateJava(schema, rootName = 'Root') {
  const { node } = rootObjectSchema(schema);
  if (!node || node.kind !== 'object') return '// The response is not an object.';
  const { models } = collectModels(node, rootName);
  const blocks = models.map((model) => {
    const fields = model.fields.map((field) => {
      const type = renderType(field.resolved, field.schema, LANGS.java);
      return `    private ${type} ${camel(field.name)};`;
    });
    const accessors = model.fields.map((field) => {
      const type = renderType(field.resolved, field.schema, LANGS.java);
      const name = pascal(field.name);
      return `    public ${type} get${name}() { return ${camel(field.name)}; }\n    public void set${name}(${type} value) { this.${camel(field.name)} = value; }`;
    });
    return `public class ${model.name} {\n${fields.join('\n')}\n\n${accessors.join('\n\n')}\n}`;
  });
  return `import java.util.List;\n\n${blocks.join('\n\n')}`;
}

export function generateCSharp(schema, rootName = 'Root') {
  const { node } = rootObjectSchema(schema);
  if (!node || node.kind !== 'object') return '// The response is not an object.';
  const { models } = collectModels(node, rootName);
  const blocks = models.map((model) => {
    const props = model.fields.map((field) => {
      const type = renderType(field.resolved, field.schema, LANGS.csharp);
      const name = pascal(field.name);
      const attribute = name !== field.name ? `        [JsonPropertyName("${field.name}")]\n` : '';
      return `${attribute}        public ${type} ${name} { get; set; }`;
    });
    return `    public class ${model.name}\n    {\n${props.join('\n\n')}\n    }`;
  });
  return `using System.Collections.Generic;\nusing System.Text.Json.Serialization;\n\nnamespace ApiModels\n{\n${blocks.join('\n\n')}\n}`;
}

/** Generators exposed to the UI. */
export const MODEL_GENERATORS = [
  { id: 'typescript', label: 'TypeScript Interface', language: 'typescript', run: (s, data, name) => generateTypeScript(s, name) },
  { id: 'javascript', label: 'JavaScript object', language: 'javascript', run: (s, data) => generateJsExample(data) },
  { id: 'jsonschema', label: 'JSON Schema', language: 'json', run: (s, data, name) => generateJsonSchema(s, name) },
  { id: 'zod', label: 'Zod Schema', language: 'typescript', run: (s, data, name) => generateZod(s, name) },
  { id: 'dataclass', label: 'Python Dataclass', language: 'python', run: (s, data, name) => generatePythonDataclass(s, name) },
  { id: 'pydantic', label: 'Pydantic Model', language: 'python', run: (s, data, name) => generatePydantic(s, name) },
  { id: 'php', label: 'PHP class', language: 'php', run: (s, data, name) => generatePhp(s, name) },
  { id: 'java', label: 'Java class', language: 'java', run: (s, data, name) => generateJava(s, name) },
  { id: 'csharp', label: 'C# class', language: 'csharp', run: (s, data, name) => generateCSharp(s, name) },
];
