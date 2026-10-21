import assert from 'node:assert/strict';
import test from 'node:test';
import {adminReturnPath} from './admin-return-path';
test('preserves the customer setup preview and admin query',()=>{
 const path='/admin/customers/d36f6d1d-c2df-42d4-9394-a4b618facfe4/setup-preview';
 assert.equal(adminReturnPath(path),path);
 assert.equal(adminReturnPath('/admin/customers?tab=all'),'/admin/customers?tab=all');
});
test('rejects external destinations, lookalike paths and MFA loops',()=>{
 for(const value of ['https://evil.example','//evil.example','/administer','/admin/mfa','/admin/mfa/?next=/admin/mfa','/admin/login','/admin/../../authenticate','/admin\\evil',null])assert.equal(adminReturnPath(value),'/admin');
});
