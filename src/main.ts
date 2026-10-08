import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

declare global {
  interface Window {
    forma: {
      invoke<T = unknown>(channel: string, payload?: unknown): Promise<T>;
      onAIChunk(callback: (chunk: { requestId: string; text: string }) => void): () => void;
    };
  }
}

type MeshFormat = 'glb' | 'fbx' | 'obj' | 'usdz';
type ModelUrls = Partial<Record<MeshFormat, string>>;
type MeshStatus = {
  status: string;
  progress?: number;
  retryAfterSeconds?: number;
  model_urls?: ModelUrls;
  task_error?: { message?: string };
};
type AIResponse = {
  response: string;
  emotion: string;
  emotionIntensity: number;
  memoryCandidates: string[];
  provider: 'openai' | 'gemini';
  cancelled?: boolean;
};
type AIConfig = {
  hasOpenAIKey: boolean;
  hasGeminiKey: boolean;
  geminiModel: string;
};

const MAX_IMAGE_BYTES = 10_000_000;
const MAX_EXPORT_BYTES = 9_000_000;
const allowedFormats: MeshFormat[] = ['glb', 'fbx', 'obj', 'usdz'];
const imageInput = document.querySelector<HTMLInputElement>('#imageInput')!;
const dropzone = document.querySelector<HTMLElement>('#dropzone')!;
const sourcePreview = document.querySelector<HTMLElement>('#sourcePreview')!;
const sourceImage = document.querySelector<HTMLImageElement>('#sourceImage')!;
const sourceName = document.querySelector<HTMLElement>('#sourceName')!;
const sourceSize = document.querySelector<HTMLElement>('#sourceSize')!;
const generateButton = document.querySelector<HTMLButtonElement>('#generateButton')!;
const generateLabel = document.querySelector<HTMLElement>('#generateLabel')!;
const viewer = document.querySelector<HTMLElement>('#viewer')!;
const canvasMount = document.querySelector<HTMLElement>('#canvasMount')!;
const viewerEmpty = document.querySelector<HTMLElement>('#viewerEmpty')!;
const viewerLoading = document.querySelector<HTMLElement>('#viewerLoading')!;
const viewerError = document.querySelector<HTMLElement>('#viewerError')!;
const modelStatus = document.querySelector<HTMLElement>('#modelStatus')!;
const loadingTitle = document.querySelector<HTMLElement>('#loadingTitle')!;
const loadingCopy = document.querySelector<HTMLElement>('#loadingCopy')!;
const progressBar = document.querySelector<HTMLElement>('#progressBar')!;
const progressPercent = document.querySelector<HTMLElement>('#progressPercent')!;
const toast = document.querySelector<HTMLElement>('#toast')!;
const detailSelect = document.querySelector<HTMLSelectElement>('#detailSelect')!;
const textureSelect = document.querySelector<HTMLSelectElement>('#textureSelect')!;
const hairToggle = document.querySelector<HTMLInputElement>('#hairToggle')!;

let selectedImage: File | null = null;
let imageDataUrl: string | null = null;
let meshyConfigured = false;
let activeTaskId: string | null = null;
let completedTaskId: string | null = null;
let activeRequestId: string | null = null;
let cancelRequested = false;
let taskCanCancel = false;
let modelType: 'character' | 'object' = 'character';
let modelUrls: ModelUrls | null = null;
let modelScene: THREE.Group | null = null;
let hairMeshes: THREE.Object3D[] = [];
let renderer: THREE.WebGLRenderer | null = null;
let controls: OrbitControls | null = null;
let previewScene: THREE.Scene | null = null;
let hairMixer: THREE.AnimationMixer | null = null;
let previousAnimationTime = 0;
let currentModelTitle = 'Untitled model';
let toastTimer = 0;
let resizeObserver: ResizeObserver | null = null;

function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function showToast(message: string, isError = false): void {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 4200);
}

function setBusy(busy: boolean): void {
  generateButton.disabled = busy || !meshyConfigured || !selectedImage || !imageDataUrl;
  generateLabel.textContent = busy ? 'Generating…' : 'Generate 3D model';
  document.querySelector<HTMLButtonElement>('#removeImage')!.disabled = busy;
  imageInput.disabled = busy;
  detailSelect.disabled = busy;
  textureSelect.disabled = busy;
  document.querySelectorAll<HTMLButtonElement>('[data-model-type]').forEach((button) => {
    button.disabled = busy;
  });
  hairToggle.disabled = busy || hairMeshes.length === 0;
}

function setModelStatus(label: string, active = false): void {
  const indicatorClass = active ? 'status-dot' : 'status-dot muted';
  modelStatus.innerHTML = `<span class="${indicatorClass}"></span> ${label}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read the selected image.'));
        return;
      }
      resolve(reader.result);
    });
    reader.addEventListener('error', () => reject(new Error('Could not read the selected image.')));
    reader.readAsDataURL(file);
  });
}

async function getMeshyImageData(file: File): Promise<string> {
  if (file.type !== 'image/webp') return readFileAsDataUrl(file);
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the WEBP image for Meshy.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.92);
}

async function selectImage(file: File): Promise<void> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    showToast('Choose a PNG, JPG, or WEBP image.', true);
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    showToast('Images must be 10 MB or smaller.', true);
    return;
  }
  try {
    const dataUrl = await getMeshyImageData(file);
    if (dataUrl.length > 14_000_000) {
      throw new Error('The prepared image is too large for Meshy. Choose a smaller image.');
    }
    selectedImage = file;
    imageDataUrl = dataUrl;
    sourceImage.src = dataUrl;
    sourceName.textContent = file.name;
    sourceSize.textContent = formatBytes(file.size);
    document.querySelector<HTMLElement>('#uploadTitle')!.textContent = 'Image selected';
    document.querySelector<HTMLElement>('#uploadSubtitle')!.textContent = 'Choose another image';
    dropzone.hidden = true;
    sourcePreview.hidden = false;
    setBusy(false);
    document.querySelector<HTMLElement>('#footerMessage')!.textContent = 'Reference image ready to generate';
    document.querySelector<HTMLElement>('#modelTitle')!.textContent = file.name.replace(/\.[^.]+$/, '').slice(0, 35);
    showToast('Image ready. Adjust the settings and generate your model.');
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Could not read the selected image.', true);
  }
}

function clearImage(): void {
  selectedImage = null;
  imageDataUrl = null;
  imageInput.value = '';
  sourceImage.removeAttribute('src');
  sourcePreview.hidden = true;
  dropzone.hidden = false;
  document.querySelector<HTMLElement>('#uploadTitle')!.textContent = 'Drop an image here';
  document.querySelector<HTMLElement>('#uploadSubtitle')!.innerHTML = 'or <span>browse files</span>';
  setBusy(false);
}

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0];
  if (file) void selectImage(file);
});

document.querySelector<HTMLButtonElement>('#removeImage')!.addEventListener('click', clearImage);
dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    imageInput.click();
  }
});
for (const eventName of ['dragenter', 'dragover']) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add('dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragging');
  });
}
dropzone.addEventListener('drop', (event) => {
  const file = (event as DragEvent).dataTransfer?.files[0];
  if (file) void selectImage(file);
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-model-type]')) {
  button.addEventListener('click', () => {
    const selectedType = button.dataset.modelType;
    if (selectedType !== 'character' && selectedType !== 'object') return;
    modelType = selectedType;
    for (const segment of document.querySelectorAll<HTMLButtonElement>('[data-model-type]')) {
      const active = segment === button;
      segment.classList.toggle('active', active);
      segment.setAttribute('aria-pressed', String(active));
    }
  });
}

detailSelect.addEventListener('change', () => {
  document.querySelector<HTMLElement>('#propertyPolycount')!.textContent =
    Number(detailSelect.value).toLocaleString();
});
textureSelect.addEventListener('change', () => {
  document.querySelector<HTMLElement>('#propertyTexture')!.textContent = `${textureSelect.value.toUpperCase()} texture`;
});

function updateProgress(progress: number, description?: string): void {
  const bounded = Math.max(0, Math.min(100, Math.round(progress)));
  progressBar.style.width = `${bounded}%`;
  progressPercent.textContent = `${bounded}%`;
  if (description) loadingCopy.textContent = description;
}

function showError(title: string, message: string): void {
  viewerLoading.hidden = true;
  viewerEmpty.hidden = true;
  viewerError.hidden = false;
  document.querySelector<HTMLElement>('#errorTitle')!.textContent = title;
  document.querySelector<HTMLElement>('#errorMessage')!.textContent = message;
  setModelStatus('GENERATION FAILED');
  document.querySelector<HTMLElement>('#footerMessage')!.textContent = 'Generation did not complete';
}

function showLoadedModel(): void {
  viewerEmpty.hidden = true;
  viewerError.hidden = true;
  viewerLoading.hidden = true;
  document.querySelector<HTMLElement>('#viewerHint')!.hidden = false;
  document.querySelector<HTMLElement>('#viewerCoordinates')!.hidden = false;
  document.querySelector<HTMLButtonElement>('#resetView')!.disabled = false;
  setModelStatus('MODEL READY', true);
  document.querySelector<HTMLElement>('#footerMessage')!.textContent = 'Model ready · drag to orbit, scroll to zoom';
  document.querySelector<HTMLElement>('#propertyModel')!.textContent = 'Generated';
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-export-format]')) {
    const format = allowedFormats.find((candidate) => candidate === button.dataset.exportFormat);
    button.disabled = !format || !modelUrls?.[format];
  }
}

function initializeRenderer(): void {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D model. Use the mouse to rotate and zoom.');
  canvasMount.append(renderer.domElement);

  const scene = new THREE.Scene();
  previewScene = scene;
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(3.4, 2.35, 4.6);
  scene.add(new THREE.HemisphereLight(0xffe7d3, 0x282839, 2.25));
  const keyLight = new THREE.DirectionalLight(0xffd4b6, 3.3);
  keyLight.position.set(4, 5, 4);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xbac7ff, 1.7);
  fillLight.position.set(-4, 1.5, -3);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xe8a58b, 2.2);
  rimLight.position.set(1, 3, -5);
  scene.add(rimLight);
  scene.add(new THREE.GridHelper(8, 32, 0x59535a, 0x35343b));

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.target.set(0, 0.2, 0);

  const resize = (): void => {
    if (!renderer) return;
    const width = canvasMount.clientWidth;
    const height = canvasMount.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewer);
  resize();

  const animate = (): void => {
    if (!renderer) return;
    const currentTime = performance.now() / 1000;
    hairMixer?.update(previousAnimationTime ? currentTime - previousAnimationTime : 0);
    previousAnimationTime = currentTime;
    controls?.update();
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(animate);
}

function getThreeScene(): THREE.Scene {
  initializeRenderer();
  if (!previewScene) throw new Error('The 3D preview could not be initialized.');
  return previewScene;
}

function fitModel(root: THREE.Group): void {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const largestAxis = Math.max(size.x, size.y, size.z);
  if (largestAxis > 0) root.scale.setScalar(2.8 / largestAxis);
  root.position.sub(center.multiplyScalar(root.scale.x));
  root.position.y -= new THREE.Box3().setFromObject(root).min.y;
  const scene = getThreeScene();
  if (modelScene) {
    scene.remove(modelScene);
    disposeModel(modelScene);
  }
  modelScene = root;
  scene.add(root);
  hairMixer = null;
  hairMeshes = [];
  root.traverse((node) => {
    if (/hair|ponytail|braid|pigtail|bangs|fringe|tress/i.test(node.name)) hairMeshes.push(node);
  });
  document.querySelector<HTMLElement>('#propertyRigging')!.textContent =
    root.getObjectByProperty('type', 'SkinnedMesh') ? 'Skinned mesh' : 'Not rigged';
  if (hairMeshes.length) {
    hairToggle.disabled = false;
    document.querySelector<HTMLElement>('#hairNote')!.textContent =
      `${hairMeshes.length} hair mesh${hairMeshes.length === 1 ? '' : 'es'} detected for optional GLB sway.`;
    if (hairToggle.checked) {
      const clip = createHairAnimation();
      if (clip) {
        hairMixer = new THREE.AnimationMixer(root);
        hairMixer.clipAction(clip).play();
      }
    }
  } else {
    hairToggle.checked = false;
    hairToggle.disabled = true;
    document.querySelector<HTMLElement>('#hairNote')!.textContent =
      'No separate hair mesh was detected. Hair sway is unavailable for this model.';
  }
  showLoadedModel();
}

function disposeModel(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

function parseGlb(data: Uint8Array): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(data.slice().buffer, '', (gltf) => resolve(gltf.scene), reject);
  });
}

async function pollTask(taskId: string, requestId: string): Promise<MeshStatus> {
  for (;;) {
    if (cancelRequested) throw new DOMException('Generation canceled.', 'AbortError');
    const result = await window.forma.invoke<MeshStatus>('mesh:status', { taskId, requestId });
    if (cancelRequested) throw new DOMException('Generation canceled.', 'AbortError');
    const status = result.status.toUpperCase();
    taskCanCancel = status === 'PENDING';
    const cancelButton = document.querySelector<HTMLButtonElement>('#cancelGeneration')!;
    cancelButton.disabled = !taskCanCancel;
    cancelButton.textContent = taskCanCancel ? 'Cancel queued task' : 'Generation in progress';
    updateProgress(result.progress ?? 0, status === 'PENDING' ? 'Waiting for the 3D engine…' : 'Reconstructing shape and texture…');
    if (status === 'SUCCEEDED') return result;
    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(result.task_error?.message || `Meshy ${status.toLowerCase()} the task.`);
    }
    await new Promise((resolve) => window.setTimeout(resolve, (result.retryAfterSeconds || 5) * 1000));
  }
}

async function generateModel(): Promise<void> {
  if (!selectedImage || !imageDataUrl) return;
  viewerError.hidden = true;
  viewerEmpty.hidden = true;
  viewerLoading.hidden = false;
  loadingTitle.textContent = 'Building your model';
  document.querySelector<HTMLElement>('#footerMessage')!.textContent = 'Sending image securely to Meshy';
  setModelStatus('GENERATING', true);
  setBusy(true);
  cancelRequested = false;
  taskCanCancel = false;
  hairToggle.checked = false;
  hairMixer = null;
  if (modelScene) {
    previewScene?.remove(modelScene);
    disposeModel(modelScene);
  }
  modelScene = null;
  hairMeshes = [];
  modelUrls = null;
  completedTaskId = null;
  document.querySelector<HTMLElement>('#propertyFileSize')!.textContent = '—';
  document.querySelector<HTMLElement>('#sizeBar')!.style.width = '0';
  document.querySelector<HTMLElement>('#sizeHint')!.textContent =
    'Models over 9 MB are blocked from downloading.';
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-export-format]')) {
    button.disabled = true;
  }
  const cancelButton = document.querySelector<HTMLButtonElement>('#cancelGeneration')!;
  cancelButton.disabled = true;
  cancelButton.textContent = 'Submitting image…';
  updateProgress(0, 'Preparing your image for Meshy…');
  activeRequestId = crypto.randomUUID();
  try {
    const image = imageDataUrl;
    const created = await window.forma.invoke<{ result: string }>('mesh:create', {
      requestId: activeRequestId,
      imageData: image,
      targetPolycount: Number(detailSelect.value),
      textureResolution: textureSelect.value,
      modelType,
    });
    if (!created.result) throw new Error('Meshy did not return a task identifier.');
    activeTaskId = created.result;
    loadingTitle.textContent = 'Sculpting your model';
    loadingCopy.textContent = 'Meshy is generating geometry and materials. This can take a few minutes.';
    const result = await pollTask(created.result, activeRequestId);
    if (!result.model_urls?.glb) throw new Error('The completed task did not include a GLB preview.');
    modelUrls = result.model_urls;
    completedTaskId = created.result;
    currentModelTitle = selectedImage.name.replace(/\.[^.]+$/, '').slice(0, 35) || 'Forma model';
    document.querySelector<HTMLElement>('#modelTitle')!.textContent = currentModelTitle;
    const model = await window.forma.invoke<{ data: Uint8Array; size: number }>('mesh:model', {
      taskId: created.result,
      requestId: activeRequestId,
      format: 'glb',
    });
    const root = await parseGlb(model.data);
    fitModel(root);
    const sizeText = formatBytes(model.size);
    document.querySelector<HTMLElement>('#propertyFileSize')!.textContent = sizeText;
    const percentage = Math.min(100, (model.size / MAX_EXPORT_BYTES) * 100);
    const sizeBar = document.querySelector<HTMLElement>('#sizeBar')!;
    sizeBar.style.width = `${percentage}%`;
    sizeBar.style.background = model.size > MAX_EXPORT_BYTES ? '#df8b7c' : '#9fc7ac';
    document.querySelector<HTMLElement>('#sizeHint')!.textContent =
      model.size > MAX_EXPORT_BYTES
        ? 'GLB exceeds 9 MB. Try a lower detail or texture setting before exporting.'
        : 'GLB preview is within the 9 MB download limit.';
    showToast('Your 3D model is ready to inspect and export.');
  } catch (error) {
    if (cancelRequested || (error instanceof DOMException && error.name === 'AbortError')) {
      viewerLoading.hidden = true;
      viewerEmpty.hidden = false;
      setModelStatus('GENERATION CANCELED');
      document.querySelector<HTMLElement>('#footerMessage')!.textContent = 'Generation canceled';
    } else {
      showError('Could not generate this model', error instanceof Error ? error.message : 'An unexpected error occurred.');
    }
  } finally {
    activeTaskId = null;
    activeRequestId = null;
    taskCanCancel = false;
    setBusy(false);
  }
}

generateButton.addEventListener('click', () => void generateModel());
document.querySelector<HTMLButtonElement>('#retryButton')!.addEventListener('click', () => void generateModel());
document.querySelector<HTMLButtonElement>('#cancelGeneration')!.addEventListener('click', async () => {
  if (!activeRequestId || !activeTaskId || !taskCanCancel) return;
  const button = document.querySelector<HTMLButtonElement>('#cancelGeneration')!;
  button.disabled = true;
  try {
    const result = await window.forma.invoke<{ canceled: boolean }>('mesh:cancel', {
      requestId: activeRequestId,
      taskId: activeTaskId,
    });
    if (result.canceled) {
      cancelRequested = true;
      showToast('Queued generation canceled.');
    } else {
      taskCanCancel = false;
      button.textContent = 'Generation in progress';
      showToast('Meshy has started processing, so this generation cannot be canceled. It will continue.');
    }
  } catch (error) {
    button.disabled = false;
    showToast(error instanceof Error ? error.message : 'Could not cancel the task.', true);
  }
});

function createHairAnimation(): THREE.AnimationClip | null {
  const tracks: THREE.QuaternionKeyframeTrack[] = [];
  for (const mesh of hairMeshes) {
    if (!mesh.name) continue;
    const base = mesh.quaternion.clone();
    const swing = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.11);
    const forward = base.clone().multiply(swing);
    const backward = base.clone().multiply(swing.clone().invert());
    tracks.push(new THREE.QuaternionKeyframeTrack(
      `${mesh.name}.quaternion`,
      [0, 1, 2],
      [...forward.toArray(), ...base.toArray(), ...backward.toArray()],
    ));
  }
  return tracks.length ? new THREE.AnimationClip('HairSway', 2, tracks) : null;
}

async function exportHairAnimatedGlb(): Promise<Uint8Array> {
  if (!modelScene) throw new Error('There is no model to export.');
  const exporter = new GLTFExporter();
  const sceneCopy = modelScene.clone(true);
  const animation = createHairAnimation();
  const exported = await exporter.parseAsync(sceneCopy, {
    binary: true,
    animations: animation ? [animation] : [],
  });
  if (!(exported instanceof ArrayBuffer)) throw new Error('GLB animation export did not produce a binary model.');
  return new Uint8Array(exported);
}

async function saveExport(format: MeshFormat, button: HTMLButtonElement): Promise<void> {
  if (!completedTaskId || !modelUrls?.[format]) return;
  button.disabled = true;
  const original = button.querySelector<HTMLElement>('.format-copy strong')?.textContent || format.toUpperCase();
  const label = button.querySelector<HTMLElement>('.format-copy strong');
  if (label) label.textContent = 'Saving…';
  try {
    let result: { canceled: boolean; size?: number };
    if (format === 'glb' && hairToggle.checked && hairMeshes.length) {
      const data = await exportHairAnimatedGlb();
      if (data.byteLength > MAX_EXPORT_BYTES) {
        throw new Error('The animated GLB exceeds the 9 MB limit. Turn off hair sway or choose a lighter model setting.');
      }
      result = await window.forma.invoke<{ canceled: boolean; size?: number }>('mesh:save-buffer', {
        format,
        name: currentModelTitle,
        data,
      });
    } else {
      result = await window.forma.invoke<{ canceled: boolean; size?: number }>('mesh:save', {
        taskId: completedTaskId,
        format,
        name: currentModelTitle,
      });
    }
    if (result.canceled) return;
    if (typeof result.size === 'number') showToast(`${format.toUpperCase()} saved · ${formatBytes(result.size)}`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Could not export this model.', true);
  } finally {
    if (label) label.textContent = original;
    button.disabled = !modelUrls?.[format];
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-export-format]')) {
  button.addEventListener('click', () => {
    const format = allowedFormats.find((candidate) => candidate === button.dataset.exportFormat);
    if (format) void saveExport(format, button);
  });
}

document.querySelector<HTMLButtonElement>('#resetView')!.addEventListener('click', () => {
  controls?.reset();
});
document.querySelector<HTMLButtonElement>('#fullscreenButton')!.addEventListener('click', () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void viewer.requestFullscreen();
});

document.querySelectorAll<HTMLButtonElement>('[data-window-action]').forEach((button) => {
  button.addEventListener('click', () => {
    void window.forma.invoke('window-action', button.dataset.windowAction);
  });
});

hairToggle.addEventListener('change', () => {
  if (hairToggle.checked) {
    document.querySelector<HTMLElement>('#hairNote')!.textContent =
      'A subtle loop will be embedded in the GLB file. Other formats remain static.';
    const clip = createHairAnimation();
    if (clip && modelScene) {
      hairMixer = new THREE.AnimationMixer(modelScene);
      hairMixer.clipAction(clip).play();
    }
  } else if (hairMeshes.length) {
    hairMixer?.stopAllAction();
    hairMixer = null;
    document.querySelector<HTMLElement>('#hairNote')!.textContent =
      `${hairMeshes.length} hair mesh${hairMeshes.length === 1 ? '' : 'es'} detected for optional GLB sway.`;
  }
});

try {
  const config = await window.forma.invoke<{ hasMeshyApiKey: boolean }>('system-config');
  if (!config.hasMeshyApiKey) {
    document.querySelector<HTMLElement>('#providerHint')!.textContent =
      'Add MESHY_API_KEY to .env and restart the app to enable generation.';
    setBusy(false);
    showToast('Meshy is not configured. Add MESHY_API_KEY to the project .env file.', true);
  } else {
    meshyConfigured = true;
    document.querySelector<HTMLElement>('#providerHint')!.textContent =
      'Powered by Meshy · Images are sent to Meshy; generation uses your Meshy credits.';
    setBusy(false);
  }
} catch (error) {
  showToast(error instanceof Error ? error.message : 'Could not read app configuration.', true);
}

window.addEventListener('beforeunload', () => {
  resizeObserver?.disconnect();
  if (modelScene) disposeModel(modelScene);
  renderer?.dispose();
  controls?.dispose();
  window.clearTimeout(toastTimer);
});
