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
const ctx = viewer.getContext('2d');

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
  if (currentModel) {
    renderModel();
  }
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

function padTo4(value) {
  return (value + 3) & ~3;
}

function projectVertex(vertex, width, height) {
  const cameraDistance = 5.5;
  const scale = 220 / (cameraDistance - vertex.z);
  return {
    x: width * 0.5 + vertex.x * scale,
    y: height * 0.5 - vertex.y * scale,
    z: vertex.z,
  };
}

function renderModel() {
  const width = viewer.clientWidth || 800;
  const height = viewer.clientHeight || 500;
  const dpr = window.devicePixelRatio || 1;
  viewer.width = width * dpr;
  viewer.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#08111f';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(125,211,252,0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i += 1) {
    const y = (height / 10) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  if (!currentModel) {
    return;
  }

  for (const face of currentModel.faces) {
    const a = currentModel.vertices[face[0]];
    const b = currentModel.vertices[face[1]];
    const c = currentModel.vertices[face[2]];

    const pa = projectVertex(a, width, height);
    const pb = projectVertex(b, width, height);
    const pc = projectVertex(c, width, height);

    const avgR = Math.round((a.r + b.r + c.r) / 3);
    const avgG = Math.round((a.g + b.g + c.g) / 3);
    const avgB = Math.round((a.b + b.b + c.b) / 3);

    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.lineTo(pc.x, pc.y);
    ctx.closePath();
    ctx.fillStyle = `rgba(${avgR}, ${avgG}, ${avgB}, 0.88)`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();
  }
}

function buildSurfaceModel(imageElement) {
  const sampleSize = 44;
  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const drawContext = canvas.getContext('2d');
  drawContext.drawImage(imageElement, 0, 0, sampleSize, sampleSize);
  const pixels = drawContext.getImageData(0, 0, sampleSize, sampleSize).data;

  const vertices = [];
  const faces = [];
  const depthScale = Number(depthSlider.value) * 2.3;

  for (let row = 0; row < sampleSize; row += 1) {
    for (let col = 0; col < sampleSize; col += 1) {
      const offset = (row * sampleSize + col) * 4;
      const r = pixels[offset];
      const g = pixels[offset + 1];
      const b = pixels[offset + 2];
      const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      const x = ((col / (sampleSize - 1)) - 0.5) * 5.6;
      const y = ((row / (sampleSize - 1)) - 0.5) * 5.6;
      const z = (1 - luminance) * depthScale;
      vertices.push({ x, y, z, r, g, b });
    }
  }

  for (let row = 0; row < sampleSize - 1; row += 1) {
    for (let col = 0; col < sampleSize - 1; col += 1) {
      const a = row * sampleSize + col;
      const b = a + 1;
      const c = a + sampleSize;
      const d = c + 1;
      faces.push([a, b, d]);
      faces.push([a, d, c]);
    }
  }

  return { vertices, faces };
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
    currentModel = buildSurfaceModel(image);
    renderModel();
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

function exportOBJ() {
  if (!currentModel) {
    setStatus('Generate a model before exporting.', 'error');
    return;
  }

  let obj = '# Generated by Image-to-3D Studio\n';
  for (const vertex of currentModel.vertices) {
    obj += `v ${vertex.x.toFixed(6)} ${vertex.y.toFixed(6)} ${vertex.z.toFixed(6)}\n`;
  }
  for (const face of currentModel.faces) {
    obj += `f ${face[0] + 1} ${face[1] + 1} ${face[2] + 1}\n`;
  }

  saveBlob(new Blob([obj], { type: 'text/plain;charset=utf-8' }), `${currentFileName}.obj`);
  setStatus('OBJ export complete.', 'success');
}

function exportFBX() {
  if (!currentModel) {
    setStatus('Generate a model before exporting.', 'error');
    return;
  }

  const vertices = currentModel.vertices.map((v) => `${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`).join(',\n    ');
  const polygonIndices = currentModel.faces.flat().map((value, index) => {
    if (index % 3 === 2) {
      return `${value},-${value + 1}`;
    }
    return String(value);
  }).join(',\n    ');

  const fbxText = `; FBX 7.3.0 project file\n; Generated by Image-to-3D Studio\n\nFBXHeaderExtension:  {\n    FBXHeaderVersion: 1003\n    FBXVersion: 7300\n    Creator: "Image-to-3D Studio"\n}\n\nDefinitions:  {\n    Version: 100\n    Count: 1\n    ObjectType: "Model" {\n        Count: 1\n    }\n}\n\nObjects:  {\n    Geometry: "Geometry::Mesh", "Mesh" {\n        Vertices: * {\n            a: ${vertices}\n        }\n        PolygonVertexIndex: * {\n            a: ${polygonIndices}\n        }\n        LayerElementNormal: 0 {\n            Version: 101\n            LayerElement: 0\n            Layer: 0\n            LayerElementMapping: "layerElementNormal"\n            Normal: * {\n                a: 0,0,1\n            }\n        }\n    }\n    Model: "Model::Surface", "Mesh" {\n        Version: 232\n        Shading: T\n        Culling: "CullingOff"\n    }\n}\n\nConnections:  {\n    C: "OO", "Geometry::Mesh", "Model::Surface"\n}\n`;

  saveBlob(new Blob([fbxText], { type: 'application/octet-stream' }), `${currentFileName}.fbx`);
  setStatus('FBX export complete.', 'success');
}

function exportGLB() {
  if (!currentModel) {
    setStatus('Generate a model before exporting.', 'error');
    return;
  }

  const positions = [];
  const indices = [];

  for (const vertex of currentModel.vertices) {
    positions.push(vertex.x, vertex.y, vertex.z);
  }

  for (const face of currentModel.faces) {
    indices.push(face[0], face[1], face[2]);
  }

  const positionBytes = new Float32Array(positions).buffer;
  const indexBytes = new Uint16Array(indices).buffer;
  const positionLength = positionBytes.byteLength;
  const indexLength = indexBytes.byteLength;
  const binBytes = new Uint8Array(positionLength + indexLength);
  const positionView = new Uint8Array(positionBytes);
  const indexView = new Uint8Array(indexBytes);
  binBytes.set(positionView, 0);
  binBytes.set(indexView, positionLength);

  const jsonObject = {
    asset: { version: '2.0', generator: 'Image-to-3D Studio' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0 },
        indices: 1,
        mode: 4,
      }],
    }],
    buffers: [{ byteLength: binBytes.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionLength, target: 34962 },
      { buffer: 0, byteOffset: positionLength, byteLength: indexLength, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: positions.length / 3,
        min: [Math.min(...positions.filter((_, i) => i % 3 === 0)), Math.min(...positions.filter((_, i) => i % 3 === 1)), Math.min(...positions.filter((_, i) => i % 3 === 2))],
        max: [Math.max(...positions.filter((_, i) => i % 3 === 0)), Math.max(...positions.filter((_, i) => i % 3 === 1)), Math.max(...positions.filter((_, i) => i % 3 === 2))],
        type: 'VEC3',
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: indices.length,
        type: 'SCALAR',
      },
    ],
  };

  const jsonString = JSON.stringify(jsonObject);
  const jsonText = new TextEncoder().encode(jsonString);
  const paddedJsonLength = padTo4(jsonText.length);
  const paddedBinLength = padTo4(binBytes.length);
  const totalLength = 12 + 8 + paddedJsonLength + 8 + paddedBinLength;
  const output = new ArrayBuffer(totalLength);
  const view = new DataView(output);

  view.setUint32(0, 0x46546c67, false);
  view.setUint32(4, 2, false);
  view.setUint32(8, totalLength, false);

  let offset = 12;
  view.setUint32(offset, paddedJsonLength, false);
  offset += 4;
  view.setUint32(offset, 0x4e534f50, false);
  offset += 4;

  const jsonChunk = new Uint8Array(output, offset, paddedJsonLength);
  jsonChunk.set(jsonText);
  offset += paddedJsonLength;

  view.setUint32(offset, paddedBinLength, false);
  offset += 4;
  view.setUint32(offset, 0x004e4942, false);
  offset += 4;

  const binChunk = new Uint8Array(output, offset, paddedBinLength);
  binChunk.set(binBytes);

  saveBlob(new Blob([output], { type: 'model/gltf-binary' }), `${currentFileName}.glb`);
  setStatus('GLB export complete.', 'success');
}

imageInput.addEventListener('change', processUpload);
clearBtn.addEventListener('click', () => {
  imageInput.value = '';
  previewImage.src = '';
  previewImage.classList.add('hidden');
  fileNameLabel.textContent = 'No file selected';
  currentModel = null;
  exportButtons.forEach((button) => button.disabled = true);
  renderModel();
  setStatus('Model cleared. Upload a new image to continue.');
});

generateBtn.addEventListener('click', () => {
  if (!imageInput.files?.[0]) {
    setStatus('Upload an image before generating a 3D model.', 'error');
    return;
  }
  const file = imageInput.files[0];
  processUpload({ target: { files: [file] } });
});

exportButtons.forEach((button) => {
  button.disabled = true;
  button.addEventListener('click', () => {
    const format = button.dataset.format;
    if (format === 'glb') exportGLB();
    if (format === 'obj') exportOBJ();
    if (format === 'fbx') exportFBX();
  });
});

window.addEventListener('resize', renderModel);
updateDepthDisplay();
renderModel();
setStatus('Upload a photo to generate a 3D surface mesh.');
window.__imageTo3DReady = true;
window.ImageTo3DExports = { exportGLB, exportOBJ, exportFBX };
