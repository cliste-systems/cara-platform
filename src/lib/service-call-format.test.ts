import test from 'node:test';
import assert from 'node:assert/strict';
import {formatServiceCallDate,formatServiceCallTime} from './service-call-format';
test('formats numeric dates and the requested time suffix in Dublin time',()=>{
 assert.equal(formatServiceCallDate('2026-10-26T13:15:00Z'),'26/10/26');
 assert.equal(formatServiceCallDate('2026-10-26'),'26/10/26');
 assert.equal(formatServiceCallTime('2026-10-26T13:15:00Z'),'13:15pm');
 assert.equal(formatServiceCallTime('2026-10-26T09:05:00Z'),'09:05am');
 assert.equal(formatServiceCallTime('2026-07-01T23:15:00Z'),'00:15am');
 assert.equal(formatServiceCallDate('2026-07-01T23:15:00Z'),'02/07/26');
});
