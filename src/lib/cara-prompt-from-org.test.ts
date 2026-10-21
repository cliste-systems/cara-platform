import "../../scripts/mock-server-only.ts";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCaraSetupPromptInputFromOrg } from "./cara-prompt-from-org";
import { defaultWeekSchedule, serializeBusinessHours } from "./business-hours";

describe("cara-prompt-from-org", () => {
  it("prefers structured schedule over legacy opening hours text", () => {
    const schedule = defaultWeekSchedule();
    schedule.thursday = { open: true, start: "08:00", end: "18:00" };
    const input = buildCaraSetupPromptInputFromOrg({
      agent_opening_hours: "Mon–Sat 8am–9pm",
      business_hours: serializeBusinessHours(schedule),
    });
    assert.match(input.openingHours ?? "", /6pm/i);
    assert.doesNotMatch(input.openingHours ?? "", /9pm/i);
  });
});

it('loads saved outside-hours policy into compiled Cara instructions', async()=>{
 const {compileCaraPromptWithMeta}=await import('./compile-cara-prompt');
 const policy={version:2 as const,availability:'urgent_only' as const,sms:'urgent' as const,phone:'+353871234567'};
 const input=buildCaraSetupPromptInputFromOrg({name:'Example',business_hours:serializeBusinessHours(defaultWeekSchedule(),{bankHolidays:{configured:true,open:false,start:'10:00',end:'14:00'},outsideHours:policy})});
 assert.deepEqual(input.outsideHours,policy);
 const result=compileCaraPromptWithMeta(input);
 assert.match(JSON.stringify(result),/accepts urgent enquiries only/);
 assert.match(JSON.stringify(result),/Closed on bank and public holidays/);
 assert.match(JSON.stringify(result),/Never promise attendance/);
 assert.doesNotMatch(JSON.stringify(result),/353871234567/);
});
