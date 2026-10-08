# API Inspector

A fast, lightweight API developer toolbox. Send HTTP requests to any public API, inspect
everything that came back, and turn the result into code, models and documentation.

Built as two independent modules: a React + Vite frontend and an Express backend that acts
as a hardened request proxy.

```
React frontend  ->  Express backend  ->  External API
```

---

## Features

**Request building**
- All common methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- Query parameters as enable/disable rows, kept in sync with the URL in both directions
- Header editor with autocomplete for common headers
- Authorization: No Auth, Bearer Token, Basic Auth, API Key (header or query parameter)
- Bodies: JSON (with highlighting and validation), raw text, form-data, `x-www-form-urlencoded`
- Import a `curl` command to fill the whole form

**Response inspection**
- Status, status text, time, size, content type, final URL and the full redirect chain
- **Pretty**: collapsible JSON tree, line numbers, per-value copy, virtualized for large payloads
- **Raw**: the body exactly as received
- **Headers**: every response header in a readable table
- **Preview**: JSON, text, images, and HTML inside a fully sandboxed iframe
- **Analysis**: record/object/array counts, depth, null and empty values, detected pagination,
  id, date and URL fields, plus an inferred schema
- Search with match navigation, and download as JSON, TXT or CSV

**Generators**
- Request code: cURL, Fetch, Axios, Node.js, Python Requests, PHP, Java, C#, Go
- Models from the live response: TypeScript, JavaScript, JSON Schema, Zod, Python dataclass,
  Pydantic, PHP, Java, C#
- Markdown API documentation, ready to copy or download

**Workspace**
- Request history and saved requests in `localStorage`, with rename, favourite, duplicate and rerun
- JSON formatter/minifier/validator, JSON ↔ CSV, Base64, URL encoder
- Endpoint benchmarking (5–50 sequential requests) with fastest/slowest/average/median/success rate
- Light, dark and system themes; responsive from mobile to desktop; keyboard shortcuts

---

## Requirements

- Node.js **18.17 or newer** (Node 20.12+ recommended, so the server can read a `.env` file)
- npm 9 or newer

## Installation

```bash
git clone <your-repo-url> api-inspector
cd api-inspector
npm install
```

`npm install` at the root installs both workspaces (`client` and `server`).

## Local development

```bash
npm run dev
```

This starts both processes with prefixed output:

| Service  | URL                     |
|----------|-------------------------|
| Frontend | http://localhost:5273   |
| Backend  | http://localhost:5274   |

Open http://localhost:5273. In development the Vite dev server proxies `/api` to the
backend, so no CORS configuration is needed locally.

Run them separately if you prefer:

```bash
npm run dev:client   # Vite only
npm run dev:server   # Express only (node --watch)
```

## Environment configuration

Both modules ship an `.env.example`. Copy the ones you need; never commit the real files.

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### `server/.env`

| Variable                | Default                 | Purpose |
|-------------------------|-------------------------|---------|
| `PORT`                  | `5274`                  | Port the API listens on |
| `CLIENT_URL`            | `http://localhost:5273` | Comma-separated list of origins allowed to call the API |
| `NODE_ENV`              | `development`           | `production` enables stricter defaults |
| `REQUEST_TIMEOUT`       | `30000`                 | Outbound request timeout in ms (max 120000) |
| `MAX_RESPONSE_SIZE`     | `10485760`              | Largest response body accepted, in bytes |
| `MAX_REQUEST_SIZE`      | `2097152`               | Largest request body accepted, in bytes |
| `MAX_REDIRECTS`         | `5`                     | Redirect hops to follow; each one is re-validated |
| `RATE_LIMIT_WINDOW_MS`  | `60000`                 | Rate limit window |
| `RATE_LIMIT_MAX`        | `120`                   | Proxied requests allowed per client per window |
| `ALLOW_PRIVATE_NETWORK` | `false`                 | Development only. Disables the SSRF guard; **ignored when `NODE_ENV=production`** |
| `SERVE_CLIENT`          | `false`                 | Serve `client/dist` from the API process |

### `client/.env`

| Variable            | Default | Purpose |
|---------------------|---------|---------|
| `VITE_API_BASE_URL` | empty   | Backend base URL. Leave empty to use the dev proxy or a same-origin deployment |
| `VITE_PORT`         | `5273`  | Vite dev server port |
| `VITE_SERVER_URL`   | `http://localhost:5274` | Backend the dev server proxies `/api` to |

Only variables prefixed with `VITE_` reach the browser. Never put a secret in one.

## Production build

```bash
npm run build     # builds the client into client/dist
npm start         # starts the Express server
```

Two supported deployment shapes:

**1. One service.** Set `SERVE_CLIENT=true` and the Express process serves `client/dist`
alongside the API. Same origin, so CORS never applies.

```bash
npm run build
NODE_ENV=production SERVE_CLIENT=true CLIENT_URL=https://inspector.example.com npm start
```

**2. Split services.** Host `client/dist` on any static host (Netlify, Vercel, S3, nginx) and
run the backend separately. Set `VITE_API_BASE_URL` at build time to the backend's public URL,
and `CLIENT_URL` on the backend to the frontend's origin:

```bash
# frontend build
VITE_API_BASE_URL=https://api.inspector.example.com npm run build

# backend
NODE_ENV=production CLIENT_URL=https://inspector.example.com npm start
```

Behind nginx or a load balancer, forward `/api` to the backend and let the proxy set
`X-Forwarded-For`; the server trusts one proxy hop when `NODE_ENV=production`.

## Folder structure

```
client/
  index.html
  vite.config.js
  src/
    components/
      common/      Icon, Modal, Tabs, Tooltip, CopyButton, Toasts, CodeEditor
      layout/      Sidebar, TopBar
      request/     RequestBar, MethodSelector, ParamsEditor, HeadersEditor,
                   AuthorizationEditor, BodyEditor, KeyValueEditor, RequestTabs
      response/    ResponseViewer, StatusBar, JsonViewer, RawViewer,
                   ResponseHeaders, ResponsePreview, ResponseAnalysis
      panels/      HistoryPanel, SavedPanel, CollectionsPanel
      modals/      CodeGeneratorModal, ImportCurlModal, SaveRequestModal,
                   PerformanceModal, ShortcutsModal
    context/       AppContext (request/response/history state), ToastContext
    hooks/         useLocalStorage, useTheme, useHotkeys, useMediaQuery
    pages/         InspectorPage, ToolsPage, SettingsPage
    services/      apiClient (send/benchmark), storage (localStorage wrapper)
    styles/        SCSS partials: tokens, base, controls, layout, request,
                   response, panels, modals, tools, responsive
    utils/         request, url, auth, json, analyze, schema, codegen, curl,
                   csv, docs, compare, download, format, id

server/
  src/
    config/        env loading and validated configuration
    controllers/   proxyController
    middleware/    rateLimit, validateProxyRequest, errorHandler
    routes/        /api/health, /api/proxy, /api/proxy/info
    services/      httpClient (redirects, timeouts, size caps, decompression)
    utils/         ssrf, ip, headers, errors
```

### API

| Method | Route              | Description |
|--------|--------------------|-------------|
| `GET`  | `/api/health`      | Liveness check |
| `GET`  | `/api/proxy/info`  | Limits the client uses for accurate warnings |
| `POST` | `/api/proxy`       | Performs one outbound request |

`POST /api/proxy` body: `{ method, url, headers, body, bodyEncoding, timeout }`.
It responds with status, headers, body, size, timing, final URL and the redirect chain.

## Security considerations

The proxy accepts a URL from the browser, so it is treated as hostile input throughout.

**SSRF protection.** Requests are refused to loopback, private IPv4 (`10/8`, `172.16/12`,
`192.168/16`), CGNAT, link-local (including the cloud metadata address `169.254.169.254`),
multicast and reserved ranges, private and link-local IPv6, IPv4-mapped/NAT64/6to4 addresses
that embed a private IPv4, and internal hostnames (`localhost`, `*.internal`, `*.local`,
`*.svc`, single-label hosts, and known metadata names).

**DNS rebinding.** Hostnames are resolved before the request; the request is refused if *any*
resolved address is private, and the socket is then pinned to an address that was validated,
so the name cannot resolve elsewhere between the check and the connection.

**Redirects.** Every hop runs through the same validation, so a public URL cannot redirect into
a private network. `Authorization` and `Cookie` are dropped when a redirect crosses origins.

**Header handling.** Incoming headers are never blindly forwarded. Hop-by-hop headers
(`Connection`, `TE`, `Upgrade`, …), `Host`/`Content-Length`, and `X-Forwarded-*` are stripped,
header names and values are validated so CRLF injection is impossible, and the header count and
value length are capped.

**Resource limits.** Per-request timeout, maximum request and response size (enforced *after*
decompression, so a compression bomb cannot expand past the cap), maximum redirect count, and a
fixed-window rate limiter per client IP.

**Error handling.** Only curated messages reach the client. Stack traces and internal details
are logged server-side and never returned. Proxy log lines record the origin and path only, so
API keys in query strings are not written to logs.

**CORS.** Only origins listed in `CLIENT_URL` are allowed. Unknown origins get no
`Access-Control-Allow-Origin` header.

**Credentials in the browser.** Tokens and passwords are kept in memory for the session and are
**not** written to `localStorage` by default; history and saved requests keep the configuration
but strip the secret values. Users can opt in under Settings → *Save credentials*, which states
plainly that anyone with access to the browser profile can then read them.

**HTML previews** render in an iframe with an empty `sandbox` attribute: no scripts, no forms,
no same-origin access.

Two things worth knowing before you deploy publicly: the proxy will fetch any public URL on
behalf of anyone who can reach it, so put it behind authentication or a stricter rate limit if
it is exposed to the internet; and `ALLOW_PRIVATE_NETWORK=true` must never be set outside local
development (the server ignores it under `NODE_ENV=production` as a second line of defence).

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Enter` | Send the request |
| `Ctrl/Cmd + S` | Save the request |
| `Ctrl/Cmd + G` | Generate request code |
| `Ctrl/Cmd + K` | Focus the URL field |
| `Ctrl/Cmd + I` | Import a cURL command |
| `Ctrl/Cmd + B` | Toggle the sidebar |
| `Ctrl/Cmd + J` | Toggle light/dark |
| `Escape` | Close a dialog, or cancel a running request |

## Notes on the architecture

State lives in two React contexts (`AppContext` for the request/response/history, `ToastContext`
for notifications) with `localStorage` persistence behind a small service. Nothing in the
components talks to `localStorage` or `fetch` directly, so swapping in a different state manager
or a cloud sync backend later is a change in `services/` and `context/`, not across the UI.

Sending is built on one function, `buildOutgoingRequest`, which resolves auth, parameters,
headers and body into the exact request that goes out. Every code generator reads the same
function, so a generated snippet always matches what the app actually sent.

Groundwork already in place for later phases: `utils/compare.js` implements response diffing
(added, removed, changed and type-changed fields) ready for a comparison panel;
`utils/docs.js` separates the document model from its renderer, so HTML or PDF export only needs
a new renderer; and the saved-request store is shaped for collections and `{{baseUrl}}` variables.

## Licence

MIT
