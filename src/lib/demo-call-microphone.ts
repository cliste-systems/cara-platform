import {
  createLocalAudioTrack,
  type LocalAudioTrack,
  type Room,
  Track,
} from "livekit-client";

let preflightMicStream: MediaStream | null = null;

/** Request mic permission on the Start button click (user gesture). */
export async function ensureMicrophoneAccess(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support microphone access.");
  }

  preflightMicStream?.getTracks().forEach((track) => track.stop());
  preflightMicStream = null;

  const constraints: MediaStreamConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };

  try {
    preflightMicStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7662/ingest/95496c05-1739-4e32-b7be-319b56b1c5b5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0f50f3'},body:JSON.stringify({sessionId:'0f50f3',runId:'mic',hypothesisId:'A',location:'demo-call-microphone.ts:ensureMicrophoneAccess',message:'getUserMedia_failed',data:{name:err instanceof DOMException?err.name:err instanceof Error?err.name:'unknown',msg:err instanceof Error?err.message.slice(0,160):String(err)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const busy =
      (err instanceof DOMException && err.name === "NotReadableError") ||
      (err instanceof Error && /could not start audio source/i.test(err.message));
    if (!busy) throw err;
    await new Promise((resolve) => setTimeout(resolve, 350));
    preflightMicStream = await navigator.mediaDevices.getUserMedia(constraints);
  }
  // #region agent log
  fetch('http://127.0.0.1:7662/ingest/95496c05-1739-4e32-b7be-319b56b1c5b5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0f50f3'},body:JSON.stringify({sessionId:'0f50f3',runId:'mic',hypothesisId:'A',location:'demo-call-microphone.ts:ensureMicrophoneAccess',message:'getUserMedia_ok',data:{tracks:preflightMicStream.getAudioTracks().length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
}

export function releasePreflightMicrophone(): void {
  preflightMicStream?.getTracks().forEach((track) => track.stop());
  preflightMicStream = null;
}

function existingMicrophoneTrack(room: Room): LocalAudioTrack | null {
  const publication = room.localParticipant.getTrackPublication(
    Track.Source.Microphone,
  );
  const track = publication?.track;
  return track?.kind === Track.Kind.Audio ? (track as LocalAudioTrack) : null;
}

export async function publishDemoCallMicrophone(
  room: Room,
): Promise<LocalAudioTrack> {
  releasePreflightMicrophone();

  const existing = existingMicrophoneTrack(room);
  if (existing && room.localParticipant.isMicrophoneEnabled) {
    return existing;
  }

  await room.localParticipant.setMicrophoneEnabled(false);

  const track = await createLocalAudioTrack({
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  });

  await room.localParticipant.publishTrack(track, {
    source: Track.Source.Microphone,
  });
  await room.localParticipant.setMicrophoneEnabled(true);

  return track;
}

export async function unpublishDemoCallMicrophone(room: Room): Promise<void> {
  const publication = room.localParticipant.getTrackPublication(
    Track.Source.Microphone,
  );
  if (publication?.track) {
    await room.localParticipant.unpublishTrack(publication.track, true);
  }
  await room.localParticipant.setMicrophoneEnabled(false);
}
