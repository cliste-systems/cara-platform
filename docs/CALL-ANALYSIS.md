# Call analysis

The founder dashboard at `/admin/call-analysis` shows seven plain-language answers for each reviewed call. A tick means a good result and an X marks a problem. Select any answer to see why, with a short quote or diagnostic when a problem is recorded. The eighth section briefly notes anything in the raw transcript that Cara could improve. The top summary says what went right or wrong.

1. Did Cara sort out what the caller rang for? **Yes is good.**
2. Was the caller frustrated? **Yes is a problem.**
3. Did Cara ask the caller to repeat themselves a lot? **Yes is a problem.**
4. Did any tool calls fail? **Yes is a problem**, even if a retry recovered.
5. Did Cara repeat the same words or phrases a lot? **Yes is a problem.**
6. Did the caller ask Cara to repeat herself a lot? **Yes is a problem.**
7. Did the caller end the call before Cara solved the issue? **Yes is a problem.**
8. Anything in the raw transcript that could be improved? **One short note.**

The model returns answers and evidence; application code calculates the verdict. One confirmed problem makes the result fail. If the raw-event capture cannot verify matching expected and persisted counts, continuous sequence and both speakers, uncertain answers remain **Unable to verify**. A greeting-only assistant transcript is never treated as a complete call. A transcript cannot establish what audio the caller actually heard; the existing recording remains available on the detail page.

The analysis uses the existing redacted transcript, diagnostics and business context. It does not reconstruct missing speech from prompts, model reasoning, tool outputs or summaries. Quotes for negative answers must match saved evidence. The existing OpenAI request keeps `store: false`, the admin MFA gate, the service-only result table, bounded retries, and the 30-day retention and erasure behavior. The simpler response caps output at 3,500 tokens rather than 10,000.

New reviews use checklist version `2026-09-28.2`. Older saved reviews show **Needs update** and can be rerun individually from their detail page. They are not silently reanalysed in bulk, which would spend API credits. The migration changes only the queue default for new call records.

## Technical health

The detail page pairs conversation checks with deterministic technical checks. Browser demo calls save numeric receiver samples to `admin_call_transport_samples` through the MFA-protected `/api/admin/demo-call/transport` endpoint. Samples cover LiveKit → browser audio; they do not describe a telephone caller's handset. The endpoint compares Origin with the public Host, since Next's internal request URL can contain the `0.0.0.0` listen address. Duplicate samples are ignored. Failed uploads retain their batch for retry and log a safe HTTP status.

Pipeline incidents are refreshed using the exact organization and call/room identifiers, independently of the saved AI review. A successful empty lookup shows zero; a failed or truncated lookup cannot certify incident coverage. Tool errors can be counted from saved events, but zero recorded errors does not imply complete event coverage. Playback-gap checks are omitted until continuity instrumentation exists.

GPT Live response timings use a separate Silero VAD observer on caller PCM and non-silent response PCM at the worker output. The observer never gates or interrupts audio. Values are persisted as `latency.replyMs`, with `latency.replyTiming.source = "caller_vad_to_worker_audio"`, counts, and capture completeness. They measure detected caller speech ending to worker audio output, not the caller device's playback. Greetings, local clips, synthetic padding, overlapping speech and unmatched turns do not produce timing samples. The UI takes the median of measured replies; partial capture remains unverified. Final source timings override an older conversation-review snapshot. Historical calls without acoustic observations cannot be backfilled from transcript timestamps.

Recovered browser log samples carry `recoveredFrom: "next-development-log"` and are shown as partial coverage. Their measured values remain visible, and confirmed breaches still fail, but partial recovery cannot produce a whole-call pass. Missing measurements are never filled with estimates or zeros.
