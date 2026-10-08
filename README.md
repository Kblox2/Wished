# Forma — Image to 3D

Forma is an Electron desktop app for turning a single PNG, JPG, or WEBP reference image into an interactive 3D model using Meshy.

## Run locally

1. Add `MESHY_API_KEY=your-meshy-api-key` to the project `.env` file.
2. Run `npm install`.
3. Run `npm run dev` to start Vite and Electron.
4. Run `npm run build` to type-check and create the production renderer bundle.
5. Run `npm start` to open the production bundle.

The Meshy key is read by Electron's main process and never exposed to the renderer. Uploaded images are sent to Meshy for model generation.

## Create and export

- Upload an image up to 10 MB, select a character or object, and choose the polygon and texture budgets.
- Meshy Smart Topology creates a clean triangle mesh with a 5k–15k face budget and 2K textures. Character requests use an A-pose to improve humanoid auto-rigging compatibility.
- Inspect the generated GLB in the orbitable 3D viewer.
- Export available Meshy formats: GLB, FBX, OBJ, and USDZ. FBX and OBJ can be uploaded to Mixamo for its auto-rigging workflow; the generated model itself is not rigged.
- Optional hair sway is added to GLB exports only, and is available when the generated model has a separately identifiable hair mesh. It is a simple looping mesh animation, not a hair-physics simulation.
- Every saved model is capped at 9,000,000 bytes. Oversized source exports are rejected before saving; lower the polygon or texture setting and regenerate. The size inspector reports the downloaded GLB preview size.

Image-to-3D is a reconstruction from one view, so hidden sides and fine details may differ from the reference. A single image cannot guarantee an exact likeness or Mixamo auto-rigging. Meshy usage may consume credits according to your Meshy plan.

## Implementation

- Three.js provides the interactive GLB preview, orbit controls, and optional GLB animation export.
- Meshy generation and file downloads run in Electron's main process, behind a restricted preload IPC bridge.
- Renderer context isolation, sandboxing, disabled Node integration, blocked popups/navigation, and a restrictive content-security policy are enabled.
