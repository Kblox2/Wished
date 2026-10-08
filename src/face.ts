type Expression =
  | 'happy' | 'sad' | 'angry' | 'confused' | 'curious' | 'surprised'
  | 'sleepy' | 'tired' | 'bored' | 'excited' | 'thinking' | 'focused'
  | 'worried' | 'nervous' | 'proud' | 'playful' | 'laughing' | 'listening'
  | 'speaking' | 'singing' | 'neutral';

type Viseme = 'rest' | 'open' | 'wide' | 'round' | 'closed';

interface FacePose {
  leftEye: number;
  rightEye: number;
  tilt: number;
  mouth: 'neutral' | 'smile' | 'frown' | 'surprise' | 'laugh' | 'sing';
  intensity: number;
}

const poses: Record<Expression, FacePose> = {
  happy: { leftEye: 0.98, rightEye: 0.98, tilt: 0, mouth: 'smile', intensity: 0.7 },
  sad: { leftEye: 0.7, rightEye: 0.7, tilt: 0, mouth: 'frown', intensity: 0.45 },
  angry: { leftEye: 0.58, rightEye: 0.58, tilt: -0.12, mouth: 'frown', intensity: 0.75 },
  confused: { leftEye: 0.96, rightEye: 0.67, tilt: -0.04, mouth: 'neutral', intensity: 0.55 },
  curious: { leftEye: 1.1, rightEye: 1.1, tilt: 0, mouth: 'neutral', intensity: 0.6 },
  surprised: { leftEye: 1.3, rightEye: 1.3, tilt: 0, mouth: 'surprise', intensity: 0.8 },
  sleepy: { leftEye: 0.3, rightEye: 0.3, tilt: 0, mouth: 'neutral', intensity: 0.25 },
  tired: { leftEye: 0.48, rightEye: 0.48, tilt: 0, mouth: 'neutral', intensity: 0.3 },
  bored: { leftEye: 0.58, rightEye: 0.58, tilt: 0.02, mouth: 'neutral', intensity: 0.2 },
  excited: { leftEye: 1.22, rightEye: 1.22, tilt: 0, mouth: 'smile', intensity: 1 },
  thinking: { leftEye: 0.84, rightEye: 0.84, tilt: 0.06, mouth: 'neutral', intensity: 0.45 },
  focused: { leftEye: 0.67, rightEye: 0.67, tilt: -0.02, mouth: 'neutral', intensity: 0.55 },
  worried: { leftEye: 1, rightEye: 0.9, tilt: 0.04, mouth: 'frown', intensity: 0.6 },
  nervous: { leftEye: 1.12, rightEye: 0.94, tilt: 0, mouth: 'neutral', intensity: 0.6 },
  proud: { leftEye: 0.92, rightEye: 0.92, tilt: -0.025, mouth: 'smile', intensity: 0.7 },
  playful: { leftEye: 0.88, rightEye: 1.08, tilt: 0.04, mouth: 'smile', intensity: 0.8 },
  laughing: { leftEye: 0.38, rightEye: 0.38, tilt: 0, mouth: 'laugh', intensity: 1 },
  listening: { leftEye: 1, rightEye: 1, tilt: 0, mouth: 'neutral', intensity: 0.5 },
  speaking: { leftEye: 0.95, rightEye: 0.95, tilt: 0, mouth: 'neutral', intensity: 0.55 },
  singing: { leftEye: 1.08, rightEye: 1.08, tilt: 0, mouth: 'sing', intensity: 0.9 },
  neutral: { leftEye: 0.88, rightEye: 0.88, tilt: 0, mouth: 'neutral', intensity: 0.35 },
};

const sceneElement = document.getElementById('robotScene');
const canvasElement = document.getElementById('faceCanvas') as HTMLCanvasElement | null;
const contextElement = canvasElement?.getContext('2d');

if (!sceneElement || !canvasElement || !contextElement) {
  throw new Error('The procedural face could not initialize because its canvas is unavailable.');
}

const scene: HTMLElement = sceneElement;
const canvas: HTMLCanvasElement = canvasElement;
const ctx: CanvasRenderingContext2D = contextElement;
let expression = (scene.dataset.expression || 'curious') as Expression;
let viseme: Viseme = 'rest';
let blinkStarted = 0;
let nextBlink = performance.now() + 2600;
let lastFrame = performance.now();
let gazeX = 0;
let gazeY = 0;
let targetGazeX = 0;
let targetGazeY = 0;
let leftEye = poses.curious.leftEye;
let rightEye = poses.curious.rightEye;
let mouthWidth = 1;
let mouthHeight = 0;
let mouthTilt = 0;
let frame = 0;

function roundedRect(x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawEye(x: number, y: number, radius: number, openness: number, pupilX: number, pupilY: number): void {
  const open = Math.max(0.04, openness);
  const eyeHeight = radius * open;

  ctx.save();
  ctx.shadowColor = 'rgba(53, 69, 205, .78)';
  ctx.shadowBlur = radius * 0.17;
  ctx.fillStyle = 'rgba(54, 48, 183, .88)';
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.13, y + radius * 0.2, radius * 1.02, eyeHeight * 1.03, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'rgba(119, 223, 190, .34)';
  ctx.shadowBlur = radius * 0.28;
  ctx.fillStyle = '#8dc4a9';
  ctx.beginPath();
  ctx.ellipse(x, y, radius, eyeHeight, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (open > 0.48) {
    ctx.fillStyle = 'rgba(42, 88, 89, .48)';
    ctx.beginPath();
    ctx.ellipse(x + pupilX * radius * 0.42, y + pupilY * radius * 0.34, radius * 0.21, eyeHeight * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(236, 255, 246, .92)';
    ctx.beginPath();
    ctx.arc(x + pupilX * radius * 0.42 - radius * 0.06, y + pupilY * radius * 0.34 - radius * 0.06, radius * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }

  const lid = Math.max(0, 1 - open);
  if (lid > 0.08) {
    ctx.fillStyle = '#111116';
    ctx.beginPath();
    ctx.ellipse(x, y - eyeHeight * 1.42, radius * 1.08, radius * lid * 0.76, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMouth(x: number, y: number, width: number, height: number, shape: FacePose['mouth']): void {
  const activeViseme = scene.dataset.speaking === 'true' && viseme !== 'rest';
  let openWidth = width * mouthWidth;
  let openHeight = height * mouthHeight;
  if (activeViseme) {
    if (viseme === 'open') { openWidth *= 1.18; openHeight = height * 0.72; }
    if (viseme === 'wide') { openWidth *= 1.28; openHeight = height * 0.34; }
    if (viseme === 'round') { openWidth *= 0.62; openHeight = height * 0.78; }
    if (viseme === 'closed') { openWidth *= 0.82; openHeight = height * 0.12; }
  }

  if (!activeViseme && shape === 'neutral') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.055);
    ctx.strokeStyle = '#57c5ec';
    ctx.lineWidth = Math.max(4, height * 0.11);
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(42, 168, 240, .35)';
    ctx.shadowBlur = height * 0.3;
    ctx.beginPath();
    ctx.moveTo(-width * 0.65, 0);
    ctx.quadraticCurveTo(0, height * 0.07, width * 0.65, -height * 0.04);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (activeViseme || shape === 'surprise' || shape === 'laugh' || shape === 'sing') {
    const mouthW = shape === 'surprise' ? width * 0.54 : shape === 'laugh' ? width * 1.1 : shape === 'sing' ? width * 0.45 : openWidth;
    const mouthH = shape === 'surprise' ? height * 0.78 : shape === 'laugh' ? height * 0.62 : shape === 'sing' ? height * 0.7 : openHeight;
    ctx.fillStyle = '#10141b';
    ctx.strokeStyle = '#54bde2';
    ctx.lineWidth = Math.max(3, height * 0.08);
    ctx.shadowColor = 'rgba(60, 174, 226, .24)';
    ctx.shadowBlur = height * 0.24;
    ctx.beginPath();
    ctx.ellipse(x, y, mouthW, Math.max(2, mouthH), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (shape === 'laugh' || viseme === 'wide') {
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(176, 232, 220, .78)';
      roundedRect(x - mouthW * 0.56, y - mouthH * 0.58, mouthW * 1.12, Math.max(2, mouthH * 0.22), mouthH * 0.11);
      ctx.fill();
    }
    return;
  }

  const smile = shape === 'smile';
  const frown = shape === 'frown';
  const startY = frown ? -height * 0.08 : height * 0.08;
  const controlY = smile ? height * 0.64 : frown ? -height * 0.62 : height * 0.04;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(mouthTilt);
  ctx.strokeStyle = '#57c5ec';
  ctx.lineWidth = Math.max(4, height * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-width, startY);
  ctx.quadraticCurveTo(0, controlY, width, startY);
  ctx.stroke();
  ctx.restore();
}

function draw(now: number): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) {
    frame = requestAnimationFrame(draw);
    return;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pose = poses[expression] || poses.neutral;
  const modelIntensity = Number(scene.dataset.intensity);
  const expressiveScale = 0.72 + (Number.isFinite(modelIntensity) ? Math.max(0, Math.min(1, modelIntensity)) : 0.5) * 0.28;
  const elapsed = Math.min(64, now - lastFrame);
  lastFrame = now;
  if (now >= nextBlink && !blinkStarted) blinkStarted = now;
  const blinkProgress = blinkStarted ? (now - blinkStarted) / 150 : -1;
  const blinkAmount = blinkProgress >= 0 && blinkProgress <= 1
    ? Math.sin(blinkProgress * Math.PI)
    : 0;
  if (blinkStarted && blinkProgress > 1) {
    blinkStarted = 0;
    nextBlink = now + 2400 + Math.random() * 3600;
  }

  const ease = 1 - Math.exp(-elapsed / 115);
  leftEye += (Math.max(0.04, pose.leftEye * expressiveScale * (1 - blinkAmount)) - leftEye) * ease;
  rightEye += (Math.max(0.04, pose.rightEye * expressiveScale * (1 - blinkAmount)) - rightEye) * ease;
  gazeX += (targetGazeX - gazeX) * ease;
  gazeY += (targetGazeY - gazeY) * ease;
  mouthTilt += ((pose.mouth === 'neutral' ? -0.055 : pose.mouth === 'frown' ? 0.04 : 0) - mouthTilt) * ease;

  const faceWidth = Math.min(width * 0.94, height * 2.45);
  const faceHeight = Math.min(faceWidth / 2.12, height * 0.82);
  const faceX = (width - faceWidth) / 2;
  const faceY = (height - faceHeight) * 0.46;
  const centerX = width / 2;
  const centerY = faceY + faceHeight / 2;

  const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, faceWidth * 0.77);
  glow.addColorStop(0, 'rgba(229, 188, 150, .3)');
  glow.addColorStop(1, 'rgba(229, 188, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.shadowColor = 'rgba(45, 30, 29, .27)';
  ctx.shadowBlur = faceHeight * 0.16;
  ctx.shadowOffsetY = faceHeight * 0.065;
  const shell = ctx.createLinearGradient(faceX, faceY, faceX + faceWidth, faceY + faceHeight);
  shell.addColorStop(0, '#29251f');
  shell.addColorStop(0.5, '#1c1b19');
  shell.addColorStop(1, '#24211c');
  roundedRect(faceX, faceY, faceWidth, faceHeight, faceHeight * 0.19);
  ctx.fillStyle = shell;
  ctx.fill();
  ctx.restore();
  roundedRect(faceX + 1, faceY + 1, faceWidth - 2, faceHeight - 2, faceHeight * 0.19);
  ctx.strokeStyle = 'rgba(255, 231, 208, .48)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const eyeRadius = faceWidth * 0.105;
  const eyeY = centerY - faceHeight * 0.12;
  const eyeOffset = faceWidth * 0.165;
  drawEye(centerX - eyeOffset, eyeY, eyeRadius, leftEye, gazeX - pose.tilt * 0.5, gazeY);
  drawEye(centerX + eyeOffset, eyeY, eyeRadius, rightEye, gazeX + pose.tilt * 0.5, gazeY);

  const mouthY = centerY + faceHeight * 0.29;
  const mouthLineWidth = faceWidth * 0.086;
  const mouthLineHeight = faceHeight * 0.18;
  drawMouth(centerX, mouthY, mouthLineWidth * pose.intensity * expressiveScale + faceWidth * 0.018, mouthLineHeight, pose.mouth);

  frame = requestAnimationFrame(draw);
}

scene.addEventListener('pointermove', (event: PointerEvent) => {
  const rect = scene.getBoundingClientRect();
  targetGazeX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
  targetGazeY = Math.max(-0.6, Math.min(0.6, ((event.clientY - rect.top) / rect.height - 0.5) * 1.2));
});
scene.addEventListener('pointerleave', () => {
  targetGazeX = 0;
  targetGazeY = 0;
});
scene.addEventListener('kairo:viseme', (event) => {
  const selected = (event as CustomEvent<Viseme>).detail;
  viseme = ['rest', 'open', 'wide', 'round', 'closed'].includes(selected) ? selected : 'rest';
});

new MutationObserver(() => {
  const requested = scene.dataset.expression as Expression;
  expression = Object.hasOwn(poses, requested) ? requested : 'neutral';
  if (expression === 'speaking') viseme = 'rest';
}).observe(scene, { attributes: true, attributeFilter: ['data-expression'] });

frame = requestAnimationFrame(draw);

window.addEventListener('pagehide', () => cancelAnimationFrame(frame), { once: true });
