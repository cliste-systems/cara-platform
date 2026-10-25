import assert from "node:assert/strict";
import test from "node:test";
import { voiceServiceError } from "./voice-service-error";

test("voice preview errors do not echo provider payloads, internal endpoints or credentials", () => {
  const payload = "Provider rejected synthetic-secret at https://private.invalid/config";
  for (const failure of [new Error(payload), payload, { message: payload }, null]) {
    assert.deepEqual(voiceServiceError(failure), {
      error: "Voice preview is temporarily unavailable. Please try again shortly.", status: 502,
    });
  }
  assert.equal(voiceServiceError(new Error("LiveKit is not configured (LIVEKIT_API_KEY)." )).status, 503);
});
