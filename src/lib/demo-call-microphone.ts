import { type LocalAudioTrack, type Room, Track } from "livekit-client";

type MicrophoneDevice = Pick<MediaDeviceInfo, "deviceId" | "kind" | "label">;

let preflightMicStream: MediaStream | null = null;
let selectedDeviceId: string | undefined;

const isDefaultAlias = (device: MicrophoneDevice) =>
  device.deviceId === "default" || device.deviceId === "communications";
const isPhoneMicrophone = (device: Pick<MicrophoneDevice, "label">) =>
  /iphone|ipad|continuity/i.test(device.label);

/** Prefer the physical built-in input, never a default alias pointing at an iPhone. */
export function selectDemoCallMicrophone(
  devices: readonly MicrophoneDevice[],
  preferredDeviceId?: string,
): MicrophoneDevice | undefined {
  const microphones = devices.filter(
    (device) => device.kind === "audioinput" && device.deviceId && !isDefaultAlias(device),
  );
  if (preferredDeviceId) {
    const selected = microphones.find((device) => device.deviceId === preferredDeviceId);
    if (!selected) {
      throw new Error("The selected microphone is no longer available. Choose another microphone and try again.");
    }
    return selected;
  }
  const local = microphones.filter((device) => device.label && !isPhoneMicrophone(device));
  const builtIn = local.find((device) => /macbook|built[ -]?in|internal/i.test(device.label));
  if (builtIn) return builtIn;
  if (local.length) return local[0];
  if (devices.some((device) => device.kind === "audioinput" && isPhoneMicrophone(device))) {
    throw new Error("Only an iPhone or Continuity microphone is available. Select your MacBook microphone in the browser's microphone settings, or choose a microphone below.");
  }
  // Before first permission, browsers may hide both device IDs and labels.
  return undefined;
}

export async function listDemoCallMicrophones(): Promise<MicrophoneDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  return (await navigator.mediaDevices.enumerateDevices()).filter(
    (device) => device.kind === "audioinput" && device.deviceId && !isDefaultAlias(device),
  );
}

async function openMicrophone(deviceId?: string): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    const busy =
      (error instanceof DOMException && error.name === "NotReadableError") ||
      (error instanceof Error && /could not start audio source/i.test(error.message));
    if (!busy) throw error;
    await new Promise((resolve) => setTimeout(resolve, 350));
    // Retry the same physical device; never fall back to the system default.
    return navigator.mediaDevices.getUserMedia(constraints);
  }
}

/** Request permission on Start, then retain this exact track for LiveKit publication. */
export async function ensureMicrophoneAccess(preferredDeviceId?: string): Promise<string> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support microphone access.");
  }
  releasePreflightMicrophone();
  try {
    const initial = selectDemoCallMicrophone(await listDemoCallMicrophones(), preferredDeviceId);
    preflightMicStream = await openMicrophone(initial?.deviceId);
    const desired = selectDemoCallMicrophone(await listDemoCallMicrophones(), preferredDeviceId);
    let track = preflightMicStream.getAudioTracks()[0];
    if (desired && track?.getSettings().deviceId !== desired.deviceId) {
      releasePreflightMicrophone();
      preflightMicStream = await openMicrophone(desired.deviceId);
      track = preflightMicStream.getAudioTracks()[0];
    }
    if (!track) throw new Error("No microphone track was available.");
    if (!preferredDeviceId && isPhoneMicrophone(track)) {
      throw new Error("The browser selected an iPhone microphone. Choose your MacBook microphone below or in the browser's microphone settings.");
    }
    selectedDeviceId = track.getSettings().deviceId || desired?.deviceId || initial?.deviceId;
    return track.label || desired?.label || initial?.label || "Microphone";
  } catch (error) {
    releasePreflightMicrophone();
    throw error;
  }
}

export function releasePreflightMicrophone(): void {
  preflightMicStream?.getTracks().forEach((track) => track.stop());
  preflightMicStream = null;
}

function existingMicrophoneTrack(room: Room): LocalAudioTrack | null {
  const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
  const track = publication?.track;
  return track?.kind === Track.Kind.Audio ? (track as LocalAudioTrack) : null;
}

export async function publishDemoCallMicrophone(room: Room): Promise<LocalAudioTrack> {
  const existing = existingMicrophoneTrack(room);
  if (existing && room.localParticipant.isMicrophoneEnabled) {
    releasePreflightMicrophone();
    return existing;
  }
  if (existing) await unpublishDemoCallMicrophone(room);
  if (!preflightMicStream?.getAudioTracks().some((track) => track.readyState === "live")) {
    // Republish must use the same physical input selected during preflight.
    await ensureMicrophoneAccess(selectedDeviceId);
  }
  const stream = preflightMicStream!;
  preflightMicStream = null;
  const mediaTrack = stream.getAudioTracks()[0];
  try {
    const publication = await room.localParticipant.publishTrack(mediaTrack, {
      source: Track.Source.Microphone,
    });
    const track = publication.track;
    if (!track || track.kind !== Track.Kind.Audio) {
      throw new Error("Microphone publication did not create an audio track.");
    }
    return track as LocalAudioTrack;
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
}

export async function unpublishDemoCallMicrophone(room: Room): Promise<void> {
  const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
  if (publication?.track) await room.localParticipant.unpublishTrack(publication.track, true);
  await room.localParticipant.setMicrophoneEnabled(false);
}
