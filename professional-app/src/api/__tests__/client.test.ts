import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { createApiClient, type TokenStorage } from '../client';

function memoryStorage(initial: { accessToken: string; refreshToken: string } | null): TokenStorage & { current: typeof initial } {
  const s = {
    current: initial,
    load: async () => s.current,
    save: async (t: { accessToken: string; refreshToken: string }) => {
      s.current = t;
    },
    clear: async () => {
      s.current = null;
    },
  };
  return s;
}

function response(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  return { config, status, statusText: String(status), headers: {}, data };
}

/** Rejects like axios does for non-2xx so the response interceptor sees an AxiosError-shaped value. */
function fail(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  const err = Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, config, response: response(config, status, data) });
  return Promise.reject(err);
}

describe('createApiClient', () => {
  it('attaches the stored access token to protected requests', async () => {
    const storage = memoryStorage({ accessToken: 'A1', refreshToken: 'R1' });
    const client = createApiClient({ baseURL: 'http://api.test/api', storage, refresh: jest.fn() });
    const seen: Array<string | undefined> = [];
    client.http.defaults.adapter = (async (config) => {
      seen.push(config.headers.get('Authorization') as string | undefined);
      return response(config, 200, { data: { ok: true } });
    }) as AxiosAdapter;
    await client.http.get('/professionals/me');
    expect(seen).toEqual(['Bearer A1']);
  });

  it('never sends the token to public auth routes', async () => {
    const storage = memoryStorage({ accessToken: 'A1', refreshToken: 'R1' });
    const client = createApiClient({ baseURL: 'http://api.test/api', storage, refresh: jest.fn() });
    let auth: unknown = 'unset';
    client.http.defaults.adapter = (async (config) => {
      auth = config.headers.get('Authorization');
      return response(config, 200, { data: {} });
    }) as AxiosAdapter;
    await client.http.post('/auth/login', {});
    expect(auth).toBeUndefined();
  });

  it('refreshes once for concurrent 401s, persists the ROTATED refresh token and retries', async () => {
    const storage = memoryStorage({ accessToken: 'OLD', refreshToken: 'R1' });
    const refresh = jest.fn(async (rt: string) => {
      expect(rt).toBe('R1');
      return { accessToken: 'NEW', refreshToken: 'R2' };
    });
    const client = createApiClient({ baseURL: 'http://api.test/api', storage, refresh });
    client.http.defaults.adapter = (async (config) => {
      const auth = config.headers.get('Authorization');
      if (auth === 'Bearer OLD') return fail(config, 401, { code: 'UNAUTHORIZED' });
      return response(config, 200, { data: { url: config.url } });
    }) as AxiosAdapter;

    const results = await Promise.all([client.http.get('/a'), client.http.get('/b'), client.http.get('/c')]);
    expect(results.map((r) => r.data.data.url)).toEqual(['/a', '/b', '/c']);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(storage.current).toEqual({ accessToken: 'NEW', refreshToken: 'R2' });
  });

  it('ends the session (clears storage, notifies) when the refresh itself fails', async () => {
    const storage = memoryStorage({ accessToken: 'OLD', refreshToken: 'REVOKED' });
    const client = createApiClient({
      baseURL: 'http://api.test/api',
      storage,
      refresh: async () => {
        throw new Error('INVALID_REFRESH_TOKEN');
      },
    });
    const expired = jest.fn();
    client.onSessionExpired(expired);
    client.http.defaults.adapter = (async (config) => fail(config, 401, {})) as AxiosAdapter;
    await expect(client.http.get('/professionals/me')).rejects.toThrow('INVALID_REFRESH_TOKEN');
    expect(storage.current).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('does not refresh on a 401 from a public auth route (e.g. wrong password)', async () => {
    const storage = memoryStorage(null);
    const refresh = jest.fn();
    const client = createApiClient({ baseURL: 'http://api.test/api', storage, refresh });
    client.http.defaults.adapter = (async (config) => fail(config, 401, { message: 'Invalid email or password.' })) as AxiosAdapter;
    await expect(client.http.post('/auth/login', {})).rejects.toMatchObject({ response: { status: 401 } });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('getFreshAccessToken refreshes an about-to-expire token', async () => {
    const soon = Math.floor(Date.now() / 1000) + 5;
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const expiring = `${b64({ alg: 'HS256' })}.${b64({ exp: soon })}.sig`;
    const storage = memoryStorage({ accessToken: expiring, refreshToken: 'R1' });
    const client = createApiClient({ baseURL: 'http://api.test/api', storage, refresh: async () => ({ accessToken: 'FRESH', refreshToken: 'R2' }) });
    await expect(client.getFreshAccessToken()).resolves.toBe('FRESH');
  });
});
