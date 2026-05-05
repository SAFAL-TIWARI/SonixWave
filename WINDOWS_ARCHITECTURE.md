# Windows System-Wide Audio Enhancer Architecture

Because this web-based environment runs in a sandboxed browser, we cannot directly intercept your host machine's low-level Windows audio stream or install system-wide audio drivers.

To fulfill your request for a **commercial-grade Windows desktop application** while utilizing this environment, I have split the deliverables into two parts:

1. **The Frontend & DSP Prototype (Available in this preview)**: A full React-based UI that uses Chrome's `getDisplayMedia` to capture system audio (or microphone), processes it in real-time through Web Audio API (EQ, Gain/Boost, dynamics limiter), and visualizes the results. This gives you exact UI/UX and DSP algorithms you requested.
2. **The Native Windows Implementation Guide (This document)**: The blueprint for converting this into a true system-wide standalone Windows app.

---

## Recommended Native Tech Stack

For a high-performance system-wide audio application, you should use a hybrid architecture:

*   **Frontend UI:** React + Tailwind CSS (The code running in this preview).
*   **Desktop Wrapper & IPC:** [Tauri](https://tauri.app/) (Rust) or [Electron](https://www.electronjs.org/) (Node.js). Tauri is highly recommended for audio apps due to its minimal RAM footprint.
*   **Audio Engine (Backend):** C++ or Rust.
*   **System Audio Interception:** Windows Audio Session API (WASAPI) with loopback capture, or an Audio Processing Object (APO).

## How System-Wide Audio Capture Works on Windows

To boost the whole system, you must sit between the Windows Audio Engine and the physical audio driver. There are three main approaches:

### 1. The APO Approach (Audio Processing Object) - *Industry Standard*
This is how apps like EqualizerAPO or Dolby Atmos work.
*   **Mechanism:** You write an APO DLL in C++ and register it in the Windows Registry to attach to an output endpoint (e.g., your speakers). Windows automatically loads your DLL into `audiodg.exe` and feeds it raw PCM audio before it hits the hardware.
*   **Pros:** True system-wide (affects all programs), zero perceptible latency, completely invisible to other apps.
*   **Cons:** Hard to develop, requires understanding Windows Driver Kit (WDK), and any crash in your DLL will break all Windows audio.

### 2. The Virtual Audio Driver Approach
This is how apps like Voicemeeter work.
*   **Mechanism:** You install a "Virtual Cable" driver. Users set Windows Default Playback to "Virtual Input". Your background app captures WASAPI stream from "Virtual Input", applies your DSP (Boost/EQ/Limiter), and outputs via exclusive WASAPI to the real hardware (e.g., Realtek Speakers).
*   **Pros:** Extremely reliable, easier to build than an APO.
*   **Cons:** Requires users to install a driver and manually change their default Windows audio device.

### 3. Loopback Capture (Record & Play)
*   **Mechanism:** Capture the "Stereo Mix" or use WASAPI Loopback on the default device, process it, and output it.
*   **Note:** This usually creates an echo. To avoid the echo, you still generally need a virtual driver sink.

## Recommended Native File Structure

When you move this React app into Tauri, your project will look like this:

```
my-audio-booster/
âââ src/                 # The React Frontend (Provided in this workspace)
â   âââ App.tsx          # Main UI
â   âââ components/      # Dials, Sliders, Visualizer
âââ src-tauri/           # The Rust Backend
â   âââ Cargo.toml
â   âââ src/
â       âââ main.rs      # Sets up System Tray, IPC, and global hotkeys
â       âââ audio.rs     # Rust WASAPI implementation (cpal/rubato crates)
â       âââ dsp.rs       # The Native Boost/EQ algorithms (transfer from audioEngine.ts)
```

## Bridging the UI to Native Audio

In the provided React code, we use `audioEngine.ts`.
In production with Tauri, you would replace the Web Audio API functions with Tauri IPC calls:

```typescript
// Instead of Web Audio API:
import { invoke } from '@tauri-apps/api/tauri';

export const setMasterGain = async (gainValue: number) => {
    // Send standard IPC command to Rust native backend
    await invoke('set_audio_gain', { value: gainValue });
}
```

## Automatic Protection & Clipping

The code provided in `audioEngine.ts` contains a true Dynamics Compressor.
When boosting audio above 100% (gain > 1.0), digital clipping occurs if the wave hits 0dBFS. A hard limiter (compressor with `ratio = 20+`, `attack = ~1ms`) is mandatory to "squash" the waveform back below 0dBFS gracefully, avoiding speaker damage or screeching static.

You can interact with the Web prototype now to see these DSP principles in action!
