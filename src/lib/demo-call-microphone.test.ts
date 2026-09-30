import assert from "node:assert/strict";
import { describe, it, type TestContext } from "node:test";
import type { Room } from "livekit-client";
import {
  ensureMicrophoneAccess,
  publishDemoCallMicrophone,
  releasePreflightMicrophone,
  selectDemoCallMicrophone,
  unpublishDemoCallMicrophone,
} from "./demo-call-microphone";

const device = (deviceId: string, label: string) => ({ deviceId, label, kind: "audioinput" as const });
const mac = device("mac-physical", "MacBook Pro Microphone");
const phone = device("phone-physical", "Brendan's iPhone Microphone");
const usb = device("usb-physical", "USB Headset");
const available = [device("default", "Default - Brendan's iPhone Microphone"), phone, usb, mac];

function browser(t: TestContext, options: { devices?: typeof available; hiddenInitially?: boolean; fail?: Error } = {}) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const state = { devices: options.devices ?? available, requests: [] as MediaStreamConstraints[], stopped: [] as string[], tracks: [] as MediaStreamTrack[] };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    mediaDevices: {
      enumerateDevices: async () => options.hiddenInitially && !state.requests.length
        ? [device("", "")]
        : state.devices,
      getUserMedia: async (constraints: MediaStreamConstraints) => {
        state.requests.push(constraints);
        if (options.fail) throw options.fail;
        const requested = (constraints.audio as MediaTrackConstraints).deviceId as { exact?: string } | undefined;
        const selected = state.devices.find((entry) => entry.deviceId === requested?.exact) ?? phone;
        const track = {
          kind: "audio", label: selected.label, readyState: "live",
          getSettings: () => ({ deviceId: selected.deviceId }),
          stop() { this.readyState = "ended"; state.stopped.push(selected.deviceId); },
        } as MediaStreamTrack;
        state.tracks.push(track);
        return { getTracks: () => [track], getAudioTracks: () => [track] } as MediaStream;
      },
    },
  } });
  t.after(() => {
    releasePreflightMicrophone();
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else Reflect.deleteProperty(globalThis, "navigator");
  });
  return state;
}

function roomStub(failPublish = false) {
  const published: MediaStreamTrack[] = [];
  let current: MediaStreamTrack | undefined;
  const participant = {
    getTrackPublication: () => current ? { track: current } : undefined,
    get isMicrophoneEnabled() { return !!current; },
    publishTrack: async (track: MediaStreamTrack) => {
      if (failPublish) throw new Error("Publication failed");
      published.push(track); current = track; return { track };
    },
    unpublishTrack: async (track: MediaStreamTrack) => { track.stop(); current = undefined; },
    setMicrophoneEnabled: async () => {},
  };
  return { room: { localParticipant: participant } as unknown as Room, published };
}

const requestedId = (request: MediaStreamConstraints) =>
  ((request.audio as MediaTrackConstraints).deviceId as { exact?: string } | undefined)?.exact;

describe("demo call microphone selection", () => {
  it("prefers the physical MacBook mic even when the default is an iPhone", () => {
    assert.equal(selectDemoCallMicrophone(available)?.deviceId, mac.deviceId);
    assert.equal(selectDemoCallMicrophone([phone, device("built-in", "Built-in Microphone")])?.deviceId, "built-in");
  });

  it("uses a non-phone headset when no built-in input exists", () => {
    assert.equal(selectDemoCallMicrophone([phone, usb])?.deviceId, usb.deviceId);
    assert.throws(() => selectDemoCallMicrophone([phone]), /Only an iPhone/);
  });

  it("honours an explicit device and never silently replaces an unavailable selection", () => {
    assert.equal(selectDemoCallMicrophone(available, usb.deviceId)?.deviceId, usb.deviceId);
    assert.equal(selectDemoCallMicrophone(available, phone.deviceId)?.deviceId, phone.deviceId);
    assert.throws(() => selectDemoCallMicrophone(available, "removed-device"), /no longer available/);
  });

  it("opens the exact MacBook input and publishes that same track without reopening the default", async (t) => {
    const state = browser(t);
    const { room, published } = roomStub();
    assert.equal(await ensureMicrophoneAccess(), mac.label);
    await publishDemoCallMicrophone(room);
    assert.equal(state.requests.length, 1);
    assert.equal(requestedId(state.requests[0]!), mac.deviceId);
    assert.equal(published[0], state.tracks[0]);
    assert.deepEqual(state.stopped, []);
    await unpublishDemoCallMicrophone(room);
    assert.deepEqual(state.stopped, [mac.deviceId]);
  });

  it("switches away from a hidden default iPhone once permission reveals device labels", async (t) => {
    const state = browser(t, { hiddenInitially: true });
    assert.equal(await ensureMicrophoneAccess(), mac.label);
    assert.deepEqual(state.requests.map(requestedId), [undefined, mac.deviceId]);
    assert.deepEqual(state.stopped, [phone.deviceId]);
  });

  it("keeps the physical microphone on republish, including an explicitly chosen headset", async (t) => {
    const state = browser(t);
    const { room } = roomStub();
    await ensureMicrophoneAccess(usb.deviceId);
    await publishDemoCallMicrophone(room);
    await unpublishDemoCallMicrophone(room);
    await publishDemoCallMicrophone(room);
    assert.deepEqual(state.requests.map(requestedId), [usb.deviceId, usb.deviceId]);
    await unpublishDemoCallMicrophone(room);
  });

  it("stops a permission stream when refreshed device discovery cannot find a local input", async (t) => {
    const state = browser(t, { hiddenInitially: true, devices: [phone] });
    await assert.rejects(ensureMicrophoneAccess(), /Only an iPhone/);
    assert.deepEqual(state.stopped, [phone.deviceId]);
  });

  it("does not fall back to the iPhone when the chosen device disappears before republish", async (t) => {
    const state = browser(t);
    const { room } = roomStub();
    await ensureMicrophoneAccess();
    await publishDemoCallMicrophone(room);
    await unpublishDemoCallMicrophone(room);
    state.devices = [phone];
    await assert.rejects(publishDemoCallMicrophone(room), /no longer available/);
    assert.equal(state.requests.length, 1);
  });

  it("stops the captured microphone if LiveKit publication fails", async (t) => {
    const state = browser(t);
    await ensureMicrophoneAccess();
    await assert.rejects(publishDemoCallMicrophone(roomStub(true).room), /Publication failed/);
    assert.deepEqual(state.stopped, [mac.deviceId]);
  });

  it("does not retry permission denial against a different microphone", async (t) => {
    const state = browser(t, { fail: new DOMException("Denied", "NotAllowedError") });
    await assert.rejects(ensureMicrophoneAccess(), { name: "NotAllowedError" });
    assert.deepEqual(state.requests.map(requestedId), [mac.deviceId]);
  });
});
