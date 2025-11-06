import {
  ProxyAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Dispatcher,
} from "undici";

let originalDispatcher: Dispatcher | undefined;
let proxyDispatcher: Dispatcher | undefined;

function parseEnableFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function resolveProxyUrl(options?: ProxyConfigOptions): string | undefined {
  if (options?.proxyUrl) {
    return options.proxyUrl;
  }

  return (
    process.env.FETCH_PROXY_URL ??
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy
  );
}

export interface ProxyConfigOptions {
  enable?: boolean;
  proxyUrl?: string;
}

export function configureProxyFromEnv(options?: ProxyConfigOptions): boolean {
  const enable =
    options?.enable ??
    parseEnableFlag(process.env.ENABLE_FETCH_PROXY ?? process.env.enable_fetch_proxy);

  if (!enable) {
    disableProxy();
    return false;
  }

  const proxyUrl = resolveProxyUrl(options);
  if (!proxyUrl) {
    console.warn(
      "[proxy] ENABLE_FETCH_PROXY is true but no proxy URL was provided via FETCH_PROXY_URL/HTTPS_PROXY/HTTP_PROXY",
    );
    disableProxy();
    return false;
  }

  if (!originalDispatcher) {
    originalDispatcher = getGlobalDispatcher();
  }

  proxyDispatcher = new ProxyAgent(proxyUrl);
  setGlobalDispatcher(proxyDispatcher);
  return true;
}

export function disableProxy(): void {
  if (!proxyDispatcher) {
    return;
  }

  setGlobalDispatcher(originalDispatcher ?? getGlobalDispatcher());
  proxyDispatcher = undefined;
}

