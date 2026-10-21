import assert from 'node:assert/strict';
import test from 'node:test';
import {smsPlanPricing,smsPricingNotice} from './sms-plan-pricing';
import {PLANS} from './cliste-plans.data';
test('SMS notices use the account plan allowance and existing price',()=>{
 for(const tier of ['starter','pro','business'] as const){const pricing=smsPlanPricing(tier);assert.ok(pricing);assert.equal(pricing.includedSms,PLANS[tier].includedSms);assert.equal(pricing.overageCents,PLANS[tier].smsOverageRateCents);assert.match(smsPricingNotice(pricing),new RegExp(`${PLANS[tier].includedSms} SMS per month`));assert.match(smsPricingNotice(pricing),/€0\.15/);}
});
test('unknown and negotiated plans never invent an allowance or price',()=>{
 for(const tier of [undefined,'unknown','enterprise','toString']){assert.equal(smsPlanPricing(tier),null);assert.doesNotMatch(smsPricingNotice(smsPlanPricing(tier)),/€|\d+ SMS/);}
});
