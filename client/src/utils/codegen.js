import { buildOutgoingRequest } from './request.js';
import { isJsonContentType } from './json.js';

/* Escaping helpers per target language. */
const shellQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
const jsString = (value) => JSON.stringify(String(value));
const pyString = (value) => JSON.stringify(String(value));
const phpString = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const javaString = (value) =>
  `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;

const headerEntries = (headers) => Object.entries(headers ?? {});
const indentBlock = (text, indent) =>
  String(text)
    .split('\n')
    .map((line, index) => (index === 0 ? line : `${indent}${line}`))
    .join('\n');

/** Pretty-print a JSON body so generated snippets stay readable. */
function bodyForDisplay(body, headers) {
  if (!body) return null;
  const contentType = headerEntries(headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1] ?? '';
  if (isJsonContentType(contentType)) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  return body;
}

function curl({ method, url, headers, body }) {
  const lines = [`curl --request ${method} \\`, `  --url ${shellQuote(url)}`];
  for (const [name, value] of headerEntries(headers)) {
    lines[lines.length - 1] += ' \\';
    lines.push(`  --header ${shellQuote(`${name}: ${value}`)}`);
  }
  if (body) {
    lines[lines.length - 1] += ' \\';
    lines.push(`  --data ${shellQuote(body)}`);
  }
  return lines.join('\n');
}

function fetchJs({ method, url, headers, body }, display) {
  const options = [`  method: ${jsString(method)}`];
  if (headerEntries(headers).length) {
    const entries = headerEntries(headers)
      .map(([name, value]) => `    ${jsString(name)}: ${jsString(value)},`)
      .join('\n');
    options.push(`  headers: {\n${entries}\n  }`);
  }
  if (body) options.push(`  body: ${jsString(display)}`);

  return `const response = await fetch(${jsString(url)}, {
${options.join(',\n')}
});

if (!response.ok) {
  throw new Error(\`Request failed: \${response.status} \${response.statusText}\`);
}

const data = await response.json();
console.log(data);`;
}

function axios({ method, url, headers, body }, display) {
  const options = [`  method: ${jsString(method.toLowerCase())}`, `  url: ${jsString(url)}`];
  if (headerEntries(headers).length) {
    const entries = headerEntries(headers)
      .map(([name, value]) => `    ${jsString(name)}: ${jsString(value)},`)
      .join('\n');
    options.push(`  headers: {\n${entries}\n  }`);
  }
  if (body) {
    const contentType = headerEntries(headers).find(([n]) => n.toLowerCase() === 'content-type')?.[1] ?? '';
    options.push(isJsonContentType(contentType) ? `  data: ${indentBlock(display, '  ')}` : `  data: ${jsString(display)}`);
  }
  return `import axios from 'axios';

const { data } = await axios({
${options.join(',\n')}
});

console.log(data);`;
}

function nodeHttp({ method, url, headers, body }, display) {
  const parsed = safeUrl(url);
  const transport = parsed.protocol === 'https:' ? 'https' : 'http';
  const headerLines = headerEntries(headers)
    .map(([name, value]) => `    ${jsString(name)}: ${jsString(value)},`)
    .join('\n');

  return `import ${transport} from 'node:${transport}';

const options = {
  hostname: ${jsString(parsed.hostname)},${parsed.port ? `\n  port: ${parsed.port},` : ''}
  path: ${jsString(`${parsed.pathname}${parsed.search}`)},
  method: ${jsString(method)},
  headers: {
${headerLines}
  },
};

const req = ${transport}.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log(res.statusCode, res.headers['content-type']);
    console.log(body);
  });
});

req.on('error', (error) => console.error(error));
${body ? `req.write(${jsString(display)});\n` : ''}req.end();`;
}

function python({ method, url, headers, body }, display) {
  const contentType = headerEntries(headers).find(([n]) => n.toLowerCase() === 'content-type')?.[1] ?? '';
  const headerLines = headerEntries(headers)
    .map(([name, value]) => `    ${pyString(name)}: ${pyString(value)},`)
    .join('\n');

  const args = [`    ${pyString(url)}`];
  if (headerLines) args.push(`    headers=headers`);
  if (body) args.push(isJsonContentType(contentType) ? `    json=payload` : `    data=payload`);
  args.push('    timeout=30');

  const payload = body
    ? isJsonContentType(contentType)
      ? `payload = ${toPythonLiteral(display)}\n\n`
      : `payload = ${pyString(display)}\n\n`
    : '';

  return `import requests

${headerLines ? `headers = {\n${headerLines}\n}\n\n` : ''}${payload}response = requests.${method.toLowerCase()}(
${args.join(',\n')},
)

response.raise_for_status()
print(response.status_code, response.elapsed.total_seconds())
print(response.json())`;
}

/** Convert a JSON body into a Python literal (true/false/null differ). */
function toPythonLiteral(text) {
  try {
    const value = JSON.parse(text);
    const render = (node, indent = 0) => {
      const pad = '    '.repeat(indent + 1);
      const closePad = '    '.repeat(indent);
      if (node === null) return 'None';
      if (typeof node === 'boolean') return node ? 'True' : 'False';
      if (typeof node === 'number') return String(node);
      if (typeof node === 'string') return pyString(node);
      if (Array.isArray(node)) {
        if (!node.length) return '[]';
        return `[\n${node.map((item) => `${pad}${render(item, indent + 1)},`).join('\n')}\n${closePad}]`;
      }
      const entries = Object.entries(node);
      if (!entries.length) return '{}';
      return `{\n${entries.map(([key, val]) => `${pad}${pyString(key)}: ${render(val, indent + 1)},`).join('\n')}\n${closePad}}`;
    };
    return render(value);
  } catch {
    return pyString(text);
  }
}

function php({ method, url, headers, body }, display) {
  const headerLines = headerEntries(headers)
    .map(([name, value]) => `        ${phpString(`${name}: ${value}`)},`)
    .join('\n');

  return `<?php

$curl = curl_init();

curl_setopt_array($curl, [
    CURLOPT_URL => ${phpString(url)},
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CUSTOMREQUEST => ${phpString(method)},${
      headerLines ? `\n    CURLOPT_HTTPHEADER => [\n${headerLines}\n    ],` : ''
    }${body ? `\n    CURLOPT_POSTFIELDS => ${phpString(display)},` : ''}
]);

$response = curl_exec($curl);
$status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
$error = curl_error($curl);
curl_close($curl);

if ($error) {
    throw new RuntimeException('Request failed: ' . $error);
}

echo $status . PHP_EOL;
print_r(json_decode($response, true));`;
}

function java({ method, url, headers, body }, display) {
  const headerLines = headerEntries(headers)
    .map(([name, value]) => `            .header(${javaString(name)}, ${javaString(value)})`)
    .join('\n');
  const bodyPublisher = body
    ? `HttpRequest.BodyPublishers.ofString(${javaString(display)})`
    : 'HttpRequest.BodyPublishers.noBody()';

  return `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class ApiExample {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(${javaString(url)}))
${headerLines ? `${headerLines}\n` : ''}            .method(${javaString(method)}, ${bodyPublisher})
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.statusCode());
        System.out.println(response.body());
    }
}`;
}

function csharp({ method, url, headers, body }, display) {
  const contentType = headerEntries(headers).find(([n]) => n.toLowerCase() === 'content-type')?.[1] ?? 'application/json';
  const headerLines = headerEntries(headers)
    .filter(([name]) => name.toLowerCase() !== 'content-type')
    .map(([name, value]) => `request.Headers.TryAddWithoutValidation(${javaString(name)}, ${javaString(value)});`)
    .join('\n');

  return `using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

class ApiExample
{
    static async Task Main()
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        using var request = new HttpRequestMessage(new HttpMethod(${javaString(method)}), ${javaString(url)});
${headerLines ? `        ${headerLines.split('\n').join('\n        ')}\n` : ''}${
    body
      ? `        request.Content = new StringContent(${javaString(display)}, Encoding.UTF8, ${javaString(contentType.split(';')[0])});\n`
      : ''
  }
        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Console.WriteLine((int)response.StatusCode);
        Console.WriteLine(body);
    }
}`;
}

function go({ method, url, headers, body }, display) {
  const headerLines = headerEntries(headers)
    .map(([name, value]) => `\treq.Header.Set(${javaString(name)}, ${javaString(value)})`)
    .join('\n');

  return `package main

import (
\t"fmt"
\t"io"
\t"net/http"${body ? '\n\t"strings"' : ''}
\t"time"
)

func main() {
${body ? `\tpayload := strings.NewReader(${javaString(display)})\n\n` : ''}\treq, err := http.NewRequest(${javaString(method)}, ${javaString(url)}, ${body ? 'payload' : 'nil'})
\tif err != nil {
\t\tpanic(err)
\t}

${headerLines ? `${headerLines}\n\n` : ''}\tclient := &http.Client{Timeout: 30 * time.Second}
\tres, err := client.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer res.Body.Close()

\tbody, err := io.ReadAll(res.Body)
\tif err != nil {
\t\tpanic(err)
\t}

\tfmt.Println(res.Status)
\tfmt.Println(string(body))
}`;
}

export const REQUEST_GENERATORS = [
  { id: 'curl', label: 'cURL', language: 'bash', run: curl },
  { id: 'fetch', label: 'JavaScript Fetch', language: 'javascript', run: fetchJs },
  { id: 'axios', label: 'Axios', language: 'javascript', run: axios },
  { id: 'node', label: 'Node.js', language: 'javascript', run: nodeHttp },
  { id: 'python', label: 'Python Requests', language: 'python', run: python },
  { id: 'php', label: 'PHP', language: 'php', run: php },
  { id: 'java', label: 'Java', language: 'java', run: java },
  { id: 'csharp', label: 'C#', language: 'csharp', run: csharp },
  { id: 'go', label: 'Go', language: 'go', run: go },
];

function safeUrl(url) {
  try {
    return new URL(url);
  } catch {
    return { protocol: 'https:', hostname: 'example.com', pathname: '/', search: '', port: '' };
  }
}

/** Generate a snippet for one target from the current editor state. */
export function generateRequestCode(request, targetId) {
  const target = REQUEST_GENERATORS.find((item) => item.id === targetId) ?? REQUEST_GENERATORS[0];
  const outgoing = buildOutgoingRequest(request);
  const display = bodyForDisplay(outgoing.body, outgoing.headers);
  return target.run(outgoing, display);
}
