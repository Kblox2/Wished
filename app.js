const imageInput = document.getElementById('imageUpload');
const previewImage = document.getElementById('previewImage');
const fileNameLabel = document.getElementById('fileName');
const depthSlider = document.getElementById('depthStrength');
const depthValue = document.getElementById('depthValue');
const generateBtn = document.getElementById('generateBtn');
const clearBtn = document.getElementById('clearBtn');
const exportButtons = document.querySelectorAll('[data-format]');
const statusBox = document.getElementById('status');

const viewer = document.getElementById('viewer');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08111f);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
camera.position.set(0, 0.9, 4.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: viewer });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x08111f, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2.2;
controls.maxDistance = 10;
controls.target.set(0, 0, 0);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(3, 4, 5);
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(8, 18, 0x7dd3fc, 0x334155);
gridHelper.position.y = -1.1;
scene.add(gridHelper);

let currentModel = null;
let currentFileName = 'model';

function setStatus(message, type = 'info') {
  statusBox.textContent = message;
  statusBox.classList.remove('success', 'error');
  if (type === 'success') {
    statusBox.classList.add('success');
  }
  if (type === 'error') {
    statusBox.classList.add('error');
  }
}

function updateDepthDisplay() {
  depthValue.textContent = Number(depthSlider.value).toFixed(1) + 'x';
}

depthSlider.addEventListener('input', updateDepthDisplay);

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read the uploaded image.'));
      img.src = reader.result;
    };

    reader.onerror = () => reject(new Error('Could not access the uploaded image.'));
    reader.readAsDataURL(file);
  });
}

function normalizeModel() {
  if (!currentModel) return;

  const box = new THREE.Box3().setFromObject(currentModel);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z) || 1;

  currentModel.position.sub(center);
  currentModel.position.y -= size.y * 0.5;
  currentModel.scale.setScalar(4 / maxSize);
}

function rebuildScene(model) {
  if (currentModel) {
    scene.remove(currentModel);
    currentModel.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }

  currentModel = model;
  scene.add(currentModel);
  normalizeModel();
}

function generateDepthMeshFromImage(imageEl) {
  const targetSize = 72;
  const aspect = imageEl.width / imageEl.height || 1;
  const width = Math.max(24, Math.min(targetSize, Math.round(targetSize * aspect)));
  const height = Math.max(24, Math.round(targetSize / Math.max(aspect, 0.2)));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(imageEl, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;

  const planeWidth = 3.6;
  const planeHeight = planeWidth / Math.max(aspect, 0.2);
  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, width - 1, height - 1);
  const position = geometry.attributes.position;
  const depthScale = Number(depthSlider.value);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      const vertexIndex = (y * width + x) * 3;
      const z = (1 - luminance) * 1.5 * depthScale;
      position.setZ(vertexIndex, z);
    }
  }

  geometry.computeVertexNormals();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.8,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -0.35;
  mesh.rotation.y = 0.35;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function createBaseScene() {
  const base = new THREE.Group();
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.8, 0.5, 48),
    new THREE.MeshStandardMaterial({ color: 0x172033, metalness: 0.35, roughness: 0.7 })
  );
  pedestal.position.y = -1.1;
  base.add(pedestal);

  return base;
}

async function processUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    setStatus('Please upload a valid image file.', 'error');
    return;
  }

  currentFileName = file.name.replace(/\.[^/.]+$/, '') || 'model';
  fileNameLabel.textContent = file.name;

  try {
    const image = await loadImage(file);
    previewImage.src = image.src;
    previewImage.classList.remove('hidden');

    const model = generateDepthMeshFromImage(image);
    const baseGroup = createBaseScene();
    baseGroup.add(model);
    rebuildScene(baseGroup);

    exportButtons.forEach((button) => button.disabled = false);
    setStatus('3D model generated from your image.', 'success');
  } catch (error) {
    setStatus(error.message || 'The image could not be processed.', 'error');
  }
}

function saveBlob(blob, fileName) {
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 3000);
}

function exportGLTF() {
  if (!currentModel) {
    setStatus('Generate a model before exporting.', 'error');
    return;
  }

  const exportTarget = currentModel.children.find((child) => child.isMesh) || currentModel;
  const exporter = new GLTFExporter();
  exporter.parse(
    exportTarget,
    (result) => {
      const blob = new Blob([result instanceof ArrayBuffer ? result : JSON.stringify(result)], {
        type: result instanceof ArrayBuffer ? 'model/gltf-binary' : 'application/json',
      });
      saveBlob(blob, `${currentFileName}.glb`);
      setStatus('GLB export complete.', 'success');
    },
    (error) => {
      setStatus(error.message || 'GLB export failed.', 'error');
    },
    { binary: true }
  );
}

function exportOBJ() {
  if (!currentModel) {
    setStatus('Generate a model before exporting.', 'error');
    return;
  }

  const exportTarget = currentModel.children.find((child) => child.isMesh) || currentModel;
  const exporter = new OBJExporter();
  const output = exporter.parse(exportTarget);
  const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
  saveBlob(blob, `${currentFileName}.obj`);
  setStatus('OBJ export complete.', 'success');
}

function exportFBX() {
  if (!currentModel) {
    setStatus('Generate a model before exporting.', 'error');
    return;
  }

  const exportTarget = currentModel.children.find((child) => child.isMesh) || currentModel;
  const geometry = exportTarget.geometry;
  const position = geometry.attributes.position;
  const vertices = [];
  const faces = [];

  for (let i = 0; i < position.count; i += 1) {
    vertices.push(`${position.getX(i).toFixed(6)},${position.getY(i).toFixed(6)},${position.getZ(i).toFixed(6)}`);
  }

  for (let i = 0; i < position.count; i += 3) {
    faces.push(`${i},${i + 1},${i + 2}`);
  }

  const vertexData = vertices.join('\n    ');
  const faceData = faces.join(',\n    ');

  const fbxText = `; FBX 7.3.0 project file
; Generated by Image-to-3D Studio

FBXHeaderExtension:  {
    FBXHeaderVersion: 1003
    FBXVersion: 7300
    Creator: "Image-to-3D Studio"
}

Definitions:  {
    Version: 100
    Count: 1
    ObjectType: "Model" {
        Count: 1
    }
}

Objects:  {
    Geometry: "Geometry::Mesh", "Mesh" {
        Vertices: * {
            a: ${vertexData}
        }
        PolygonVertexIndex: * {
            a: ${faceData}
        }
        GeometryVersion: 124
        LayerElementNormal: 0 {
            Version: 101
            LayerElement: 0
            Layer: 0
            LayerElementMapping: "layerElementNormal"
            Normal: * {
                a: 0,0,1, 0,0,1, 0,0,1
            }
        }
    }
    Model: "Model::Mesh", "Mesh" {
        Version: 232
        Properties70:  {
            P: "InheritType", "enum", "", "",1
            P: "DefaultAttributeIndex", "int", "Integer", "",0
            P: "Lcl Translation", "Lcl Translation", "", "A",0,0,0
            P: "Lcl Rotation", "Lcl Rotation", "", "A",0,0,0
            P: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
        }
        Shading: T
        Culling: "CullingOff"
    }
}

Connections:  {
    C: "OO", "Geometry::Mesh", "Model::Mesh"
}
`;

  const blob = new Blob([fbxText], { type: 'application/octet-stream' });
  saveBlob(blob, `${currentFileName}.fbx`);
  setStatus('FBX export complete.', 'success');
}

function handleClear() {
  imageInput.value = '';
  previewImage.src = '';
  previewImage.classList.add('hidden');
  fileNameLabel.textContent = 'No file selected';
  exportButtons.forEach((button) => button.disabled = true);

  if (currentModel) {
    scene.remove(currentModel);
    currentModel.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    currentModel = null;
  }

  setStatus('Model cleared. Upload a new image to continue.');
}

imageInput.addEventListener('change', processUpload);
clearBtn.addEventListener('click', handleClear);
generateBtn.addEventListener('click', () => {
  if (!imageInput.files?.[0]) {
    setStatus('Upload an image before generating a 3D model.', 'error');
    return;
  }

  const file = imageInput.files[0];
  const inputEvent = { target: { files: [file] } };
  processUpload(inputEvent);
});

exportButtons.forEach((button) => {
  button.disabled = true;
  button.addEventListener('click', () => {
    const format = button.dataset.format;
    if (format === 'glb') exportGLTF();
    if (format === 'obj') exportOBJ();
    if (format === 'fbx') exportFBX();
  });
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function resizeRenderer() {
  const { clientWidth, clientHeight } = viewer;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resizeRenderer);
resizeRenderer();
updateDepthDisplay();
animate();
setStatus('Upload a photo to generate a 3D surface mesh.');
window.__imageTo3DReady = true;
console.log('Image-to-3D app ready');
