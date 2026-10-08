import { describeAuth } from './auth.js';
import { buildOutgoingRequest, endpointOf } from './request.js';
import { isJsonContentType } from './json.js';
import { formatBytes, formatDuration } from './format.js';
import { inferSchema, schemaToRows } from './schema.js';

/**
 * Documentation is produced in two steps: a structured model, then a renderer.
 * Markdown ships in Phase 1; an HTML or PDF renderer only has to consume the
 * same model.
 */
export function buildDocModel({ request, response, parsedBody, description = '' }) {
  const outgoing = buildOutgoingRequest(request);
  const sections = {
    title: request.name?.trim() || `${request.method} ${endpointOf(outgoing.url)}`,
    endpoint: stripQuery(outgoing.url),
    method: request.method,
    description,
    queryParams: request.params
      .filter((row) => row.enabled && row.key.trim())
      .map((row) => ({ name: row.key, example: row.value, description: row.description ?? '' })),
    headers: request.headers
      .filter((row) => row.enabled && row.key.trim())
      .map((row) => ({ name: row.key, example: maskSensitive(row.key, row.value), description: row.description ?? '' })),
    auth: describeAuth(request.auth),
    body: buildBodySection(request, outgoing),
    response: response
      ? {
          status: response.status,
          statusText: response.statusText,
          time: response.time,
          size: response.size,
          contentType: response.contentType,
          headers: response.headers ?? {},
          example: exampleBody(response, parsedBody),
          schema: parsedBody !== undefined ? schemaToRows(inferSchema(parsedBody)) : [],
        }
      : null,
  };
  return sections;
}

function stripQuery(url) {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}

function maskSensitive(name, value) {
  return /^(authorization|cookie|x-api-key|api-key|x-auth-token|x-access-token)$/i.test(name.trim())
    ? '<redacted>'
    : value;
}

function buildBodySection(request, outgoing) {
  if (!outgoing.body) return null;
  const contentType =
    Object.entries(outgoing.headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1] ?? 'text/plain';
  let example = outgoing.body;
  if (isJsonContentType(contentType)) {
    try {
      example = JSON.stringify(JSON.parse(outgoing.body), null, 2);
    } catch {
      /* keep the raw text */
    }
  }
  return { mode: request.body.mode, contentType, example };
}

function exampleBody(response, parsedBody) {
  if (parsedBody !== undefined) {
    const text = JSON.stringify(parsedBody, null, 2);
    return text.length > 8000 ? `${text.slice(0, 8000)}\n... truncated` : text;
  }
  const body = response.body ?? '';
  return body.length > 4000 ? `${body.slice(0, 4000)}\n... truncated` : body;
}

const table = (headers, rows) => {
  if (!rows.length) return '_None_\n';
  const head = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map((cell) => String(cell ?? '').replace(/\|/g, '\\|') || '—').join(' | ')} |`);
  return [head, divider, ...body].join('\n');
};

/** Render the documentation model as Markdown. */
export function renderMarkdown(model) {
  const lines = [`# ${model.title}`, ''];

  if (model.description) lines.push(model.description, '');

  lines.push('## Endpoint', '', '```http', `${model.method} ${model.endpoint}`, '```', '');

  lines.push('## Query parameters', '');
  lines.push(
    table(
      ['Name', 'Example', 'Description'],
      model.queryParams.map((param) => [`\`${param.name}\``, param.example, param.description]),
    ),
    '',
  );

  lines.push('## Headers', '');
  lines.push(
    table(
      ['Name', 'Example', 'Description'],
      model.headers.map((header) => [`\`${header.name}\``, header.example, header.description]),
    ),
    '',
  );

  lines.push('## Authorization', '', model.auth, '');

  lines.push('## Request body', '');
  if (model.body) {
    lines.push(`Content type: \`${model.body.contentType}\``, '');
    lines.push('```' + (isJsonContentType(model.body.contentType) ? 'json' : ''), model.body.example, '```', '');
  } else {
    lines.push('_No request body._', '');
  }

  if (model.response) {
    lines.push('## Response', '');
    lines.push(
      table(
        ['Field', 'Value'],
        [
          ['Status', `${model.response.status} ${model.response.statusText}`],
          ['Time', formatDuration(model.response.time)],
          ['Size', formatBytes(model.response.size)],
          ['Content-Type', model.response.contentType || '—'],
        ],
      ),
      '',
    );

    lines.push('### Response headers', '');
    lines.push(
      table(
        ['Header', 'Value'],
        Object.entries(model.response.headers).map(([name, value]) => [`\`${name}\``, value]),
      ),
      '',
    );

    lines.push('### Example response', '');
    lines.push('```' + (isJsonContentType(model.response.contentType) ? 'json' : ''), model.response.example, '```', '');

    if (model.response.schema.length) {
      lines.push('### Detected schema', '');
      lines.push(
        table(
          ['Field', 'Type', 'Required'],
          model.response.schema.map((row) => [`\`${row.path}\``, row.type, row.optional ? 'No' : 'Yes']),
        ),
        '',
      );
    }
  }

  lines.push('---', '', `_Generated with API Inspector on ${new Date().toLocaleString()}._`);
  return lines.join('\n');
}

/** Renderers registry: HTML and PDF can be added without touching callers. */
export const DOC_RENDERERS = {
  markdown: { label: 'Markdown', extension: 'md', mimeType: 'text/markdown;charset=utf-8', render: renderMarkdown },
};

export function generateDocumentation(input, format = 'markdown') {
  const model = buildDocModel(input);
  const renderer = DOC_RENDERERS[format] ?? DOC_RENDERERS.markdown;
  return { model, text: renderer.render(model), renderer };
}
