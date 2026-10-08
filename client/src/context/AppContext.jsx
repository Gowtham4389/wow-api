import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../services/storage.js';
import { fetchProxyInfo, sendRequest } from '../services/apiClient.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { useToast } from './ToastContext.jsx';
import { uid } from '../utils/id.js';
import {
  createRequest,
  createRow,
  endpointOf,
  hasSecrets,
  sanitizeForStorage,
} from '../utils/request.js';
import { applyParamsToUrl, syncParamsFromUrl, validateUrl } from '../utils/url.js';
import { isJsonContentType, parseJson } from '../utils/json.js';

const AppContext = createContext(null);

const HISTORY_LIMIT = 100;

const DEFAULT_SETTINGS = {
  // 'proxy' routes through the backend (full headers, no CORS limits);
  // 'direct' sends from the browser and can reach localhost APIs.
  sendMode: 'proxy',
  saveSecrets: false,
  timeout: 30000,
  largeResponseThreshold: 2 * 1024 * 1024,
  prettyPrintOnLoad: true,
  wrapLines: false,
};

export function AppProvider({ children }) {
  const toast = useToast();

  const [request, setRequestState] = useState(() => createRequest());
  const [response, setResponse] = useState(null);
  const [previousResponse, setPreviousResponse] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [proxyInfo, setProxyInfo] = useState(null);

  const [history, setHistory] = useLocalStorage(STORAGE_KEYS.history, []);
  const [saved, setSaved] = useLocalStorage(STORAGE_KEYS.saved, []);
  const [settings, setSettings] = useLocalStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS);

  const abortRef = useRef(null);

  // Merge in any settings added after the user's stored copy was written.
  const mergedSettings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...settings }), [settings]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProxyInfo(controller.signal)
      .then(setProxyInfo)
      .catch(() => setProxyInfo(null));
    return () => controller.abort();
  }, []);

  /* ---------------- request editing ---------------- */

  const updateRequest = useCallback((patch) => {
    setRequestState((current) => ({
      ...current,
      ...(typeof patch === 'function' ? patch(current) : patch),
    }));
  }, []);

  /** Editing the URL re-parses its query string into the parameter rows. */
  const setUrl = useCallback((url) => {
    setRequestState((current) => ({
      ...current,
      url,
      params: syncParamsFromUrl(url, current.params),
    }));
  }, []);

  /** Editing parameter rows rewrites the query string in the URL. */
  const setParams = useCallback((params) => {
    setRequestState((current) => {
      const next = typeof params === 'function' ? params(current.params) : params;
      return { ...current, params: next, url: applyParamsToUrl(current.url, next) };
    });
  }, []);

  const setHeaders = useCallback((headers) => {
    setRequestState((current) => ({
      ...current,
      headers: typeof headers === 'function' ? headers(current.headers) : headers,
    }));
  }, []);

  const setAuth = useCallback((auth) => {
    setRequestState((current) => ({
      ...current,
      auth: typeof auth === 'function' ? auth(current.auth) : auth,
    }));
  }, []);

  const setBody = useCallback((body) => {
    setRequestState((current) => ({
      ...current,
      body: { ...current.body, ...(typeof body === 'function' ? body(current.body) : body) },
    }));
  }, []);

  const loadRequest = useCallback((next) => {
    setRequestState({ ...createRequest(), ...next, id: next.id ?? uid('req') });
    setResponse(null);
    setError(null);
  }, []);

  const newRequest = useCallback(() => {
    setRequestState(createRequest());
    setResponse(null);
    setError(null);
  }, []);

  const clearResponse = useCallback(() => {
    setResponse(null);
    setError(null);
  }, []);

  /* ---------------- history ---------------- */

  const addToHistory = useCallback(
    (entry) => {
      setHistory((current) => [entry, ...current].slice(0, HISTORY_LIMIT));
    },
    [setHistory],
  );

  const historyActions = useMemo(
    () => ({
      rename: (id, name) =>
        setHistory((current) => current.map((item) => (item.id === id ? { ...item, name } : item))),
      toggleFavorite: (id) =>
        setHistory((current) =>
          current.map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item)),
        ),
      duplicate: (id) =>
        setHistory((current) => {
          const source = current.find((item) => item.id === id);
          if (!source) return current;
          return [{ ...source, id: uid('hist'), at: Date.now(), name: `${source.name ?? ''}`.trim() }, ...current].slice(
            0,
            HISTORY_LIMIT,
          );
        }),
      remove: (id) => setHistory((current) => current.filter((item) => item.id !== id)),
      clear: () => setHistory((current) => current.filter((item) => item.favorite)),
      clearAll: () => setHistory([]),
    }),
    [setHistory],
  );

  /* ---------------- saved requests ---------------- */

  const savedActions = useMemo(
    () => ({
      save: (name, source = request) => {
        const entry = {
          id: uid('saved'),
          name: name?.trim() || `${source.method} ${endpointOf(source.url)}`,
          at: Date.now(),
          request: sanitizeForStorage(source, { keepSecrets: mergedSettings.saveSecrets }),
        };
        setSaved((current) => [entry, ...current]);
        return entry;
      },
      update: (id, patch) =>
        setSaved((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item))),
      rename: (id, name) =>
        setSaved((current) => current.map((item) => (item.id === id ? { ...item, name } : item))),
      duplicate: (id) =>
        setSaved((current) => {
          const source = current.find((item) => item.id === id);
          if (!source) return current;
          return [{ ...source, id: uid('saved'), name: `${source.name} copy`, at: Date.now() }, ...current];
        }),
      remove: (id) => setSaved((current) => current.filter((item) => item.id !== id)),
      clear: () => setSaved([]),
    }),
    [request, mergedSettings.saveSecrets, setSaved],
  );

  /* ---------------- sending ---------------- */

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (overrideRequest) => {
      const target = overrideRequest ?? request;
      const check = validateUrl(target.url);
      if (!check.ok) {
        setError({ message: check.message, code: 'invalid_url' });
        toast.error(check.message);
        return null;
      }
      // Accept `api.example.com` by filling in the protocol.
      if (check.normalized && !overrideRequest) {
        setRequestState((current) => ({ ...current, url: check.url }));
      }
      const outgoingRequest = check.normalized ? { ...target, url: check.url } : target;

      if (target.body?.mode === 'json' && target.body.json?.trim() && !['GET', 'HEAD'].includes(target.method)) {
        const parsed = parseJson(target.body.json);
        if (!parsed.ok) {
          const message = `The JSON body is not valid: ${parsed.error}`;
          setError({ message, code: 'invalid_json' });
          toast.error(message);
          return null;
        }
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSending(true);
      setError(null);

      try {
        const result = await sendRequest(outgoingRequest, {
          mode: mergedSettings.sendMode,
          signal: controller.signal,
          timeout: mergedSettings.timeout,
        });

        setPreviousResponse(response);
        setResponse(result);

        addToHistory({
          id: uid('hist'),
          at: Date.now(),
          name: outgoingRequest.name || '',
          favorite: false,
          request: sanitizeForStorage(outgoingRequest, { keepSecrets: mergedSettings.saveSecrets }),
          summary: {
            method: result.method ?? outgoingRequest.method,
            url: result.requestUrl ?? outgoingRequest.url,
            status: result.status,
            statusText: result.statusText,
            time: result.time,
            size: result.size,
          },
        });

        if (result.truncated) {
          toast.warning('The response was larger than the configured limit and has been truncated.');
        }
        return result;
      } catch (caught) {
        if (caught?.name === 'AbortError') {
          toast.info('Request cancelled.');
          return null;
        }
        const details = { message: caught.message, code: caught.code, hint: caught.hint };
        setError(details);
        toast.error(caught.message, { description: caught.hint });
        return null;
      } finally {
        setSending(false);
        abortRef.current = null;
      }
    },
    [request, response, mergedSettings, addToHistory, toast],
  );

  /* ---------------- derived response data ---------------- */

  const parsedResponse = useMemo(() => {
    if (!response || response.bodyEncoding === 'base64') return { data: undefined, isJson: false };
    const looksJson = isJsonContentType(response.contentType) || /^\s*[[{]/.test(response.body ?? '');
    if (!looksJson) return { data: undefined, isJson: false };
    const parsed = parseJson(response.body);
    return parsed.ok ? { data: parsed.data, isJson: true } : { data: undefined, isJson: false, parseError: parsed.error };
  }, [response]);

  const value = useMemo(
    () => ({
      request,
      setRequest: setRequestState,
      updateRequest,
      setUrl,
      setParams,
      setHeaders,
      setAuth,
      setBody,
      loadRequest,
      newRequest,
      addRow: (list, row = createRow()) => ({ list, row }),
      response,
      previousResponse,
      parsedResponse,
      error,
      sending,
      send,
      cancel,
      clearResponse,
      history,
      historyActions,
      saved,
      savedActions,
      settings: mergedSettings,
      updateSettings: (patch) => setSettings((current) => ({ ...DEFAULT_SETTINGS, ...current, ...patch })),
      proxyInfo,
      requestHasSecrets: hasSecrets(request),
    }),
    [
      request, updateRequest, setUrl, setParams, setHeaders, setAuth, setBody, loadRequest, newRequest,
      response, previousResponse, parsedResponse, error, sending, send, cancel, clearResponse,
      history, historyActions, saved, savedActions, mergedSettings, setSettings, proxyInfo,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside an AppProvider');
  return context;
}
