# Elio — your little companion

Elio is a responsive, browser-based companion prototype. Its animated face is the focus; conversation, opt-in camera sensing, voice controls, and memory settings sit around it. The app runs without a server backend, package install, or external AI account.

## Run locally

Open `index.html` in a modern browser, or serve this folder from `localhost` (for example, `python -m http.server 8000`) and visit `http://localhost:8000`. Camera access requires HTTPS or `localhost`. The page uses plain browser scripts and has no build step.

## Current foundation

- **Character and expressions:** an original Elio personality, playful local reply logic, mood, internal energy, curiosity, evolving preferences, quiet-minded goals, and animated curious, happy, excited, surprised, confused, worried, annoyed, sleepy, thinking, listening, speaking, and neutral faces.
- **Modules:** `settings.js` owns user preferences; `memory.js` keeps short- and long-term memory; `personality.js` holds developing preferences and state; `brain.js` decides replies through a replaceable provider; `expressions.js` maps states to the face; `permissions.js` gates browser media requests; `voice.js` and `vision.js` adapt browser I/O; `behavior.js` schedules restrained check-ins; and `elio.js` wires these into the UI.
- **AI provider seam:** `ElioBrain.createProvider({ memory })` exposes `think()` and `observe()` for replacing the current local rules with a hosted or on-device model later. The current provider is deliberately a lightweight rules-based prototype, not a generative AI.
- **Memory:** short-term conversation context stays in page memory; long-term name, likes, notes, and conversation count use this browser's local storage. Settings let you inspect or remove individual memories, clear all memory, or turn long-term memory off.
- **Voice provider seam:** `ElioVoice.createBrowserProvider(...)` wraps browser speech recognition and synthesis. Starting to talk cancels Elio's current speech; microphone access is only requested after tapping the talk button. Voice quality and recognition support depend on the browser and installed voices, and can be replaced through this interface.
- **Vision provider seam:** `ElioVision.createBrowserProvider(...)` requests a camera stream only after the camera button is tapped. It samples a small preview about every 1.5 seconds, using the experimental local face detector when available or coarse local motion sensing otherwise. The stream has no audio track and is stopped when the camera is turned off or the page is left.
- **Behavior:** optional check-ins happen only while the page is visible and focused, after a quiet minute and a half, at most three times per page session. Elio settles down after extended inactivity. Turn check-ins off in Settings to keep Elio quiet.
- **Actions and permissions:** the current companion has no arbitrary device-control tools. Camera activation and microphone recognition are explicit user actions; speech output and local memory are the only other actions available to the prototype.

## Privacy and limitations

This prototype does not connect to a cloud AI or upload camera frames or saved memories. Camera access is opt-in and can be stopped at any time. Browser speech recognition may use the browser vendor's own service and is subject to its privacy policy. Speech output is the browser's installed voice, not a custom voice model.

The browser must remain open for Elio to react or initiate a check-in. This is not yet a native mobile app, a background service, or a persistent autonomous agent. Replies are local patterns and do not have the knowledge or reasoning of a language model. Camera face detection availability varies by browser; the fallback detects motion, not identity or scene meaning.
