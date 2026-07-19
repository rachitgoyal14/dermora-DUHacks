# Task 3: Fix Solace Voice Cracking/Audio Glitch Issue

## Context

`SolacePage.tsx` + `services/gemini.ts` implement a Gemini Live voice-to-voice session for the Solace mental health agent. Audio comes back from Gemini as sequential base64-encoded PCM chunks (24kHz, mono), decoded into `AudioBuffer`s via `decodeAudioData()`, and queued for playback in `processAudioQueue()`. Users are reporting **audio cracking/glitching**, most likely during playback of the AI's voice.

The task description was cut off mid-sentence ("fix the solace voice cracking issue => when user...") — **the agent should ask the human to confirm the exact trigger condition before assuming a fix**, but should proceed with the most likely diagnosis below in parallel since several candidate causes are visible directly in the code.

## Likely Root Causes (in order of probability)

### 1. Gapless playback scheduling bug (most likely)
In `SolacePage.tsx`, `processAudioQueue()` calls `source.start()` with no explicit `when` argument, relying purely on the previous buffer's `onended` callback to trigger the next `source.start()`. This has real-world latency between "buffer finished" and "next buffer scheduled," which produces audible clicks/gaps between chunks — this is the classic cause of "cracking" in queued Web Audio playback.

**Fix:** Use precise sample-accurate scheduling instead of relying on `onended`:
```typescript
const nextStartTimeRef = useRef(0);

const playAudio = (ctx: AudioContext, buffer: AudioBuffer) => {
  const now = ctx.currentTime;
  const startTime = Math.max(now, nextStartTimeRef.current);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(startTime);

  nextStartTimeRef.current = startTime + buffer.duration;

  setStatus('speaking');
  source.onended = () => {
    // Only flip back to 'connected' if this was the last scheduled chunk
    if (nextStartTimeRef.current <= ctx.currentTime + 0.05) {
      setStatus('connected');
    }
  };
};
```
Remove the existing `audioQueueRef` + `isPlayingRef` + `processAudioQueue` recursive-callback approach entirely and replace with this scheduled-start approach — every incoming buffer gets scheduled immediately at `nextStartTimeRef.current`, back-to-back, sample-accurately, regardless of when `onmessage` fires relative to the previous buffer's actual playback completion.

Reset `nextStartTimeRef.current = 0` whenever a new session starts (in `startSession`) and whenever the AI's turn completes with a gap expected (optional — test both with and without resetting on `turnComplete`; resetting could reintroduce gaps if reset too early mid-utterance).

### 2. `ScriptProcessorNode` buffer size mismatch
`inputCtx.createScriptProcessor(4096, 1, 1)` — a 4096-sample buffer at 16kHz is ~256ms per chunk. If the main thread is ever busy (React re-renders, canvas animation `requestAnimationFrame` loop, state updates from `onTranscript`), `onaudioprocess` callbacks can be delayed or dropped, corrupting the **outgoing** mic stream, which the user would perceive as their own voice cutting in and out, or the AI's responses being cut/malformed because it received garbled input.

**Fix:** This is inherent to `ScriptProcessorNode`'s single-threaded, main-thread-blocking design. Two options, pick based on time budget:
- **Quick mitigation:** reduce work happening on the main thread while a session is active — specifically check whether the canvas visualizer's `requestAnimationFrame` loop is doing unnecessary work (it currently runs a pure sine-wave animation unrelated to real audio data — this is wasted CPU cycles that could be starving the audio processor). Consider throttling the canvas redraw rate.
- **Proper fix:** migrate `ScriptProcessorNode` → `AudioWorkletNode`, which runs on a separate audio rendering thread and isn't subject to main-thread jank. This is more work (requires a separate worklet processor module file) — implement this if the quick mitigation doesn't fully resolve the issue. This was already flagged as technical debt independent of this bug.

### 3. Sample rate / AudioContext mismatch
Confirm `inputCtx` is created at exactly `16000` and `outputCtx` at exactly `24000`, matching what Gemini Live expects/sends (per the `mimeType: 'audio/pcm;rate=16000'` on send and the `decodeAudioData(..., 24000, 1)` on receive). If the actual hardware/browser silently coerces the requested sample rate (some browsers do this on certain devices), the PCM data will be interpreted at the wrong rate, causing pitch-shifted, crackly audio. Add a runtime check:
```typescript
console.log('Input ctx actual sample rate:', inputCtx.sampleRate);
console.log('Output ctx actual sample rate:', outputCtx.sampleRate);
```
and confirm these log exactly `16000` and `24000` on the target browser/device. If not, the encode/decode math needs to account for the actual rate rather than the assumed one.

### 4. `MediaRecorder` competing for the same `MediaStream`
The mood-analysis `MediaRecorder` and the raw `ScriptProcessorNode` pipeline both consume the **same** `stream` object simultaneously (`mediaRecorder = new MediaRecorder(stream, ...)` alongside `source = inputCtx.createMediaStreamSource(stream)`). This is generally supported by the Web Audio/MediaRecorder spec but is worth explicitly ruling out as a contention source — test with the `MediaRecorder` temporarily disabled to see if cracking disappears, to isolate whether this is a contributing factor.

## Investigation Steps for the Agent
1. First, ask the human to clarify: does cracking happen (a) at the start of every AI response, (b) mid-response randomly, (c) only after a long session, or (d) specifically in the user's own voice being cut? This determines which fix above is actually the culprit — don't apply all four blindly.
2. Implement fix #1 (scheduled playback) regardless, since it's a clear correctness bug independent of the reported symptom.
3. Add the sample-rate console logs from #3 and report back what they show.
4. If cracking persists after #1, proceed to the `AudioWorkletNode` migration (#2) as the next most likely fix.

## Testing Checklist
- [ ] Start a session, let the AI speak a multi-sentence response uninterrupted — no audible clicks/gaps between chunks
- [ ] Speak while the AI is mid-response (interrupt) — audio transitions cleanly
- [ ] Console-logged sample rates match expected 16000 (input) / 24000 (output)
- [ ] Run a 5+ minute session — confirm no degradation in audio quality over time (rules out memory/buffer accumulation issues)
- [ ] Test on at least two different browsers/devices if possible (audio glitches are often hardware/browser-specific)