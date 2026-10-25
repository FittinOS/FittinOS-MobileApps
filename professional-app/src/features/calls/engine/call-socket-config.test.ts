import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { needsRefresh, secondsUntilExpiry, socketTargetFromApiUrl } from './call-socket-config.ts';

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const tokenWithExp = (exp: number | undefined) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(exp === undefined ? { sub: 'u' } : { sub: 'u', exp })}.signature`;

describe('socketTargetFromApiUrl', () => {
  it('serves the socket from the API host, under the API prefix', () => {
    assert.deepEqual(socketTargetFromApiUrl('https://fittin-api-abc.a.run.app/api'), {
      url: 'https://fittin-api-abc.a.run.app/calls',
      path: '/api/socket.io',
    });
  });

  it('works for local development and ports', () => {
    assert.deepEqual(socketTargetFromApiUrl('http://localhost:4100/api'), { url: 'http://localhost:4100/calls', path: '/api/socket.io' });
  });

  it('tolerates a trailing slash and a custom prefix', () => {
    assert.deepEqual(socketTargetFromApiUrl('https://api.example.com/v1/'), { url: 'https://api.example.com/calls', path: '/v1/socket.io' });
  });

  it('tolerates no prefix at all', () => {
    assert.deepEqual(socketTargetFromApiUrl('https://api.example.com'), { url: 'https://api.example.com/calls', path: '/socket.io' });
  });
});

describe('secondsUntilExpiry / needsRefresh', () => {
  const NOW = Date.parse('2026-09-24T10:00:00.000Z');
  const inSeconds = (s: number) => Math.floor(NOW / 1000) + s;

  it('reads the remaining lifetime from the token', () => {
    assert.equal(secondsUntilExpiry(tokenWithExp(inSeconds(600)), NOW), 600);
  });

  it('is negative once expired', () => {
    assert.equal(secondsUntilExpiry(tokenWithExp(inSeconds(-5)), NOW), -5);
  });

  it('is null for anything that is not a readable token', () => {
    for (const bad of [null, undefined, '', 'abc', 'a.b', 'a.b.c.d', `x.${b64url({ nope: 1 })}.y`, 'x.!!!.y']) {
      assert.equal(secondsUntilExpiry(bad, NOW), null);
    }
    assert.equal(secondsUntilExpiry(tokenWithExp(undefined), NOW), null);
  });

  it('asks for a refresh when the token is missing, unreadable, expired or about to expire', () => {
    assert.equal(needsRefresh(null, NOW), true);
    assert.equal(needsRefresh('garbage', NOW), true);
    assert.equal(needsRefresh(tokenWithExp(inSeconds(-1)), NOW), true);
    assert.equal(needsRefresh(tokenWithExp(inSeconds(20)), NOW), true);
  });

  it('leaves a token with plenty of life alone, and honours a custom margin', () => {
    assert.equal(needsRefresh(tokenWithExp(inSeconds(600)), NOW), false);
    assert.equal(needsRefresh(tokenWithExp(inSeconds(600)), NOW, 900), true);
  });
});
