

# SonixWave

SonixWave is a browser-based audio enhancement and visualizer app. It lets you capture system audio or a microphone, apply EQ presets and effects, and monitor clipping in a clean, reactive interface.

## Features

- System audio capture with microphone fallback
- 5-band equalizer with presets
- Master boost, bypass, and limiter feedback
- Audio effects: distortion, chorus, delay, and reverb
- Reactive visualizer and animated background controls

## Requirements

- Node.js 18 or newer
- A Chromium-based browser for best system audio capture support
- Optional: `GEMINI_API_KEY` in `.env.local` if your local setup uses it

## Setup

1. Install dependencies: `npm install`
2. Start the development server: `npm run dev`
3. Open the app in your browser at the local Vite URL shown in the terminal

## Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the app for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Type-check the project
- `npm run clean` - Remove the `dist` folder

## Notes

- When prompted, allow screen or tab sharing and enable system audio if you want to process desktop sound.
- If capture is denied, the app falls back to microphone input for testing.
