import test from 'node:test';
import assert from 'node:assert/strict';
import { reset, nextIp, peekNextIp } from '../services/vpn-service/src/ip.js';

test('rejects partial numeric octets without changing allocation state', () => {
  reset('10.0.0.10');
  for (const value of ['10.0.0.12junk', '10.0.0.1e2', '10.0.0.+2', '10.0.0. 2']) {
    assert.throws(() => reset(value), /Invalid IP address/, value);
    assert.equal(peekNextIp(), '10.0.0.10');
  }
});

test('valid IPv4 addresses allocate sequentially across octet boundaries', () => {
  reset('10.0.0.255');
  assert.equal(nextIp(), '10.0.0.255');
  assert.equal(nextIp(), '10.0.1.0');
});
