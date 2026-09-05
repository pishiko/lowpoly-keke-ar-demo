import * as THREE from 'three';
import { GLTFLoader } from './node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { PlushMotion } from './app/motion.js';
import { PlushAudio } from './app/audio.js';
import { createControls } from './app/controls.js';
import { CameraFeed } from './app/camera.js';
import { lastPhoto } from './app/photos.js';
import { mountIcons } from './app/icons.js';

const $ = (selector) => document.querySelector(selector);
const app = $('#app'), sceneElement = $('#scene'), overlay = $('#overlay');
mountIcons();
const audio = new PlushAudio(), motion = new PlushMotion(), feed = new CameraFeed($('#camera-feed'));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let renderer, mode = 'studio', ready = false, busy = false, modeEpoch = 0;
let toastTimer, speechTimer, lastTime = null, walkSpeed = 0;
let session = null, hitSource = null, placed = false, lastPose = null;
let userSize = 1, yaw = 0, targetYaw = 0, photoBlob = null, photoURL = null;
let installPrompt = null;

function toast(message, duration = 5000) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, duration);
}
function speak(text) {
  clearTimeout(speechTimer); $('#speech').textContent = text; $('#speech').classList.add('visible');
  speechTimer = setTimeout(() => $('#speech').classList.remove('visible'), 1800);
}

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
} catch {
  $('#loading').textContent = '3D表示を開始できませんでした。WebGL対応ブラウザで開いてください。';
  throw new Error('WebGL renderer unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.setClearColor(0xeff0e7, 0);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local');
renderer.domElement.setAttribute('aria-hidden', 'true');
sceneElement.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(39, 1, 0.01, 200);
function resetCamera() {
  camera.position.set(0, 2.2, -5.2);
  camera.quaternion.identity(); camera.lookAt(0, 0.85, 0);
  camera.updateMatrixWorld();
}
resetCamera();
scene.add(new THREE.HemisphereLight(0xfffcf0, 0xa2ab93, 2.8));
const sun = new THREE.DirectionalLight(0xfff4e5, 2.6); sun.position.set(-3, 5, -4); scene.add(sun);
const fill = new THREE.DirectionalLight(0xd8e9ff, 1.3); fill.position.set(4, 2, 1); scene.add(fill);

const stage = new THREE.Group(); scene.add(stage);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0xeff0e7 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.04; stage.add(floor);
const grid = new THREE.GridHelper(200, 250, 0xd5dbc9, 0xdde2d4);
grid.material.transparent = true; grid.material.opacity = 0.5; grid.position.y = -0.035; stage.add(grid);
const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.43, 1.45, 0.045, 96), new THREE.MeshStandardMaterial({ color: 0xe1e7d3, roughness: 1 }));
platform.position.y = -0.027; stage.add(platform);
const ring = new THREE.Mesh(new THREE.RingGeometry(1.53, 1.538, 96), new THREE.MeshBasicMaterial({ color: 0xbecbaa, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.position.y = -0.008; stage.add(ring);

const character = new THREE.Group(), heading = new THREE.Group(), body = new THREE.Group();
character.add(heading); heading.add(body); scene.add(character);
const home = new THREE.Vector3();
// A procedural contact shadow also works on the camera feed without hiding the video.
const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
const shadowContext = shadowCanvas.getContext('2d');
const gradient = shadowContext.createRadialGradient(64, 64, 3, 64, 64, 64);
gradient.addColorStop(0, 'rgba(46, 53, 30, .29)'); gradient.addColorStop(0.4, 'rgba(46, 53, 30, .16)'); gradient.addColorStop(1, 'rgba(46, 53, 30, 0)');
shadowContext.fillStyle = gradient; shadowContext.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; character.add(shadow);

const reticle = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.09, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd7ef9b, side: THREE.DoubleSide }));
reticle.visible = false; reticle.matrixAutoUpdate = false; scene.add(reticle);
const right = new THREE.Vector3(), forward = new THREE.Vector3(), velocity = new THREE.Vector3(), projected = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const raycaster = new THREE.Raycaster();

function resize() {
  if (renderer.xr.isPresenting) return;
  const width = sceneElement.clientWidth, height = sceneElement.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  // Keep the plush comfortably between the header and controls in portrait.
  camera.fov = width < 700 ? 49 : 39;
  camera.setViewOffset(width, height, 0, height * (width < 700 ? 0.025 : 0.065), width, height);
  camera.updateProjectionMatrix();
}
resize(); window.addEventListener('resize', resize);

function playAction(name) {
  if (!ready || (mode === 'ar' && !placed)) return;
  audio.unlock();
  if (motion.play(name)) {
    const words = { squish: 'ぷに、ぷにっ。', jump: 'ぴょーん！', fall: 'ころん。', getup: 'よいしょ。', spin: 'くるる〜' };
    speak(words[motion.action]);
  } else if (motion.lying && name !== 'squish') toast('「おきる」で起こしてあげてね。', 2200);
}
const controls = createControls({ joystick: $('#joystick'), knob: $('#joystick-knob'), onAction: playAction, onInteract: () => audio.unlock() });
overlay.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
for (const button of document.querySelectorAll('[data-action]')) button.addEventListener('click', () => playAction(button.dataset.action));
$('#sound').addEventListener('click', () => {
  audio.setEnabled(!audio.enabled); $('#sound').setAttribute('aria-pressed', String(audio.enabled)); $('#sound-label').textContent = audio.enabled ? '音 ON' : '音 OFF';
  try { localStorage.setItem('keke-sound', String(audio.enabled)); } catch { /* Private browsing may disable storage. */ }
});
try { if (localStorage.getItem('keke-sound') === 'false') $('#sound').click(); } catch { /* Optional preference. */ }
$('#size').addEventListener('input', (event) => { userSize = Number(event.target.value) / 100; $('#size-value').textContent = `${event.target.value}%`; });

function recall() {
  if (!ready) return;
  controls.release(); motion.reset(); yaw = targetYaw = 0;
  if (mode === 'ar') {
    placed = false; character.visible = false; $('#placement').hidden = false; $('#place').disabled = true;
    $('#placement-hint').textContent = '置きたい床にスマホを向けてください';
  } else { character.position.copy(home); speak('ただいま。'); }
  audio.unlock(); audio.play('recall'); $('#offscreen').hidden = true;
}
$('#recall').addEventListener('click', recall); $('#offscreen').addEventListener('click', recall);
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (mode === 'ar' || !ready) return;
  const rect = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
  if (raycaster.intersectObject(body, true).length) playAction('squish');
});

function syncMode() {
  app.dataset.mode = mode; stage.visible = mode === 'studio';
  scene.background = mode === 'studio' ? new THREE.Color(0xeff0e7) : null;
  for (const name of ['studio', 'camera', 'ar']) $(`#${name}-mode`).setAttribute('aria-pressed', String(mode === name));
  $('#mode-label').textContent = { studio: 'STUDIO / おためし', camera: 'CAMERA / カメラ合成', ar: 'AR / 床に置く' }[mode];
  $('#shutter').disabled = !ready || mode === 'ar' || busy;
  $('#flip-camera').disabled = mode !== 'camera' || busy;
  $('#capture-label').textContent = mode === 'ar' ? '端末のスクショで撮影' : '写真を撮る';
  $('#camera-mode').disabled = busy; $('#ar-mode').disabled = busy;
  $('#placement').hidden = mode !== 'ar' || placed;
  if (mode !== 'ar') { character.visible = ready; reticle.visible = false; }
}
async function studioMode() {
  ++modeEpoch; feed.stop(); busy = false;
  if (session) { try { await session.end(); } catch { /* Session may already be ending. */ } }
  mode = 'studio'; home.set(0, 0, 0); character.position.copy(home); motion.reset(); yaw = targetYaw = 0;
  resetCamera(); resize(); syncMode();
}
async function cameraMode(facing) {
  if (busy) return;
  if (session) {
    try { await session.end(); } catch { toast('ARを終了できませんでした。もう一度お試しください。'); return; }
  }
  const epoch = ++modeEpoch; busy = true; syncMode();
  try {
    const started = await feed.start(facing);
    if (epoch !== modeEpoch || !started) return;
    mode = 'camera'; home.set(0, 0, 0); character.position.copy(home); motion.reset(); yaw = targetYaw = 0;
    resetCamera(); resize();
    feed.stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (mode === 'camera') { studioMode(); toast('カメラが停止しました。「カメラ」から再開できます。'); }
    }, { once: true });
    toast('景色の中でケケを動かして、シャッターで撮影。');
  } catch (error) {
    if (epoch === modeEpoch) { mode = 'studio'; toast(error.message, 8000); }
  } finally { if (epoch === modeEpoch) { busy = false; syncMode(); } }
}
$('#studio-mode').addEventListener('click', studioMode);
$('#camera-mode').addEventListener('click', () => cameraMode());
$('#flip-camera').addEventListener('click', () => cameraMode(feed.facing === 'user' ? 'environment' : 'user'));

async function enterAR() {
  if (busy || session || !ready) return;
  if (!window.isSecureContext) { toast('床に置くARを使うには、HTTPSで開いてください。'); return; }
  if (!navigator.xr) { toast('この端末では床に置くARを利用できません。「カメラ」で合成撮影できます。', 6500); return; }
  const epoch = ++modeEpoch; busy = true; feed.stop(); syncMode();
  let requested;
  try {
    // Keep requestSession directly in the user gesture; require the overlay for the controller.
    requested = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test', 'dom-overlay'], domOverlay: { root: overlay } });
    if (epoch !== modeEpoch) { await requested.end(); return; }
    session = requested;
    requested.addEventListener('end', () => {
      hitSource?.cancel(); hitSource = null; session = null; placed = false; lastPose = null;
      mode = 'studio'; busy = false; home.set(0, 0, 0); character.position.copy(home); motion.reset(); yaw = targetYaw = 0;
      camera.clearViewOffset(); resetCamera(); syncMode(); requestAnimationFrame(resize);
    }, { once: true });
    camera.clearViewOffset(); camera.position.set(0, 0, 0); camera.quaternion.identity(); camera.updateMatrixWorld();
    await renderer.xr.setSession(requested);
    const viewerSpace = await requested.requestReferenceSpace('viewer');
    const source = await requested.requestHitTestSource({ space: viewerSpace });
    if (session !== requested || epoch !== modeEpoch) { source?.cancel(); return; }
    hitSource = source; mode = 'ar'; placed = false; character.visible = false; controls.release();
    toast('床に輪が出たら「ここに置く」。撮影は端末のスクリーンショットで。', 7000);
  } catch (error) {
    if (requested) { try { await requested.end(); } catch { /* Already ended. */ } }
    if (epoch === modeEpoch) {
      mode = 'studio'; resetCamera(); resize();
      toast(error.name === 'NotAllowedError' ? 'ARの開始が許可されませんでした。ブラウザの権限を確認してください。' : 'この端末では床に置くARを開始できません。「カメラ」で合成撮影できます。', 7000);
    }
  } finally { if (epoch === modeEpoch) { busy = false; syncMode(); } }
}
$('#ar-mode').addEventListener('click', enterAR);
overlay.addEventListener('beforexrselect', (event) => { if (event.target.closest('button,input,dialog,#joystick,a')) event.preventDefault(); });
$('#place').addEventListener('click', () => {
  if (!lastPose || !reticle.visible || mode !== 'ar') return;
  home.setFromMatrixPosition(reticle.matrix); character.position.copy(home); placed = true; character.visible = true;
  motion.reset();
  const xrCamera = renderer.xr.getCamera();
  targetYaw = yaw = Math.atan2(home.x - xrCamera.position.x, home.z - xrCamera.position.z);
  reticle.visible = false; syncMode(); speak('ここにいるよ。');
});

function presentPhoto(blob) {
  if (photoURL) URL.revokeObjectURL(photoURL);
  photoBlob = blob; photoURL = URL.createObjectURL(blob);
  $('#photo').src = photoURL; $('#thumbnail').src = photoURL; $('#thumbnail').hidden = false;
  $('#gallery [data-icon]').hidden = true; $('#gallery').disabled = false;
  $('#download').href = photoURL;
  $('#download').download = `keke-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  const file = new File([blob], 'keke-pocket.png', { type: 'image/png' });
  $('#share').hidden = !navigator.canShare?.({ files: [file] });
}
function openDialog(selector) { controls.release(); $(selector).showModal(); }
async function capture() {
  if (!ready || busy || mode === 'ar') return;
  $('#shutter').disabled = true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = renderer.domElement.width; canvas.height = renderer.domElement.height;
    const context = canvas.getContext('2d');
    if (mode === 'camera') feed.draw(context, canvas.width, canvas.height);
    // Render and copy synchronously, before the browser clears WebGL's drawing buffer.
    renderer.render(scene, camera); context.drawImage(renderer.domElement, 0, 0);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('写真を作成できませんでした。')), 'image/png'));
    presentPhoto(blob); lastPhoto(blob).catch(() => toast('写真は保存ボタンから保存できます。このブラウザでは履歴を保持できません。'));
    audio.play('shutter'); $('#flash').classList.remove('firing'); void $('#flash').offsetWidth; $('#flash').classList.add('firing');
    openDialog('#photo-dialog');
  } catch (error) { toast(error.message); }
  finally { syncMode(); }
}
$('#shutter').addEventListener('click', capture);
$('#gallery').addEventListener('click', () => openDialog('#photo-dialog'));
$('#share').addEventListener('click', async () => {
  if (!photoBlob) return;
  try { await navigator.share({ files: [new File([photoBlob], 'keke-pocket.png', { type: 'image/png' })], title: 'ケケとおでかけ' }); }
  catch (error) { if (error.name !== 'AbortError') toast('共有できませんでした。「写真を保存」をお使いください。'); }
});
lastPhoto().then((blob) => { if (blob && !photoBlob) presentPhoto(blob); }).catch(() => {});
$('#help').addEventListener('click', () => openDialog('#help-dialog'));
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => button.closest('dialog').close());
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event; });
$('#install').addEventListener('click', async () => {
  if (!installPrompt) { openDialog('#help-dialog'); $('#install-help').scrollIntoView({ block: 'nearest' }); return; }
  const prompt = installPrompt; installPrompt = null;
  try { await prompt.prompt(); await prompt.userChoice; } catch { openDialog('#help-dialog'); }
});
window.addEventListener('appinstalled', () => { $('#install').hidden = true; toast('ホーム画面にケケをお迎えしました。'); });
if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) $('#install').hidden = true;
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('./sw.js').catch(() => toast('オフラインの準備ができませんでした。オンラインではそのまま遊べます。'));

new GLTFLoader().load('./dist/keke-lowpoly-300-tex512.glb', (gltf) => {
  const bounds = new THREE.Box3().setFromObject(gltf.scene), center = bounds.getCenter(new THREE.Vector3());
  const height = bounds.getSize(new THREE.Vector3()).y;
  const model = new THREE.Group(); model.scale.setScalar(1 / height);
  gltf.scene.position.set(-center.x, -bounds.min.y, -center.z);
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      material.metalness = 0; material.roughness = 1; material.flatShading = true;
      if (material.map) { material.map.magFilter = THREE.NearestFilter; material.map.minFilter = THREE.NearestFilter; }
      material.needsUpdate = true;
    }
  });
  model.add(gltf.scene); body.add(model); ready = true;
  $('#loading').classList.add('is-hidden');
  document.querySelectorAll('[data-action]').forEach((button) => { button.disabled = false; });
  syncMode(); speak('こんにちは。');
  window.__KEKE_READY__ = true;
}, undefined, (error) => {
  console.error(error); $('#loading').textContent = 'ケケを読み込めませんでした。接続を確認して再読み込みしてください。';
});

function animate(timestamp, frame) {
  const dt = lastTime === null ? 0 : Math.min((timestamp - lastTime) / 1000, 0.05); lastTime = timestamp;
  if (document.hidden) return;
  if (mode === 'ar' && frame && hitSource && !placed) {
    const hits = frame.getHitTestResults(hitSource);
    lastPose = hits[0]?.getPose(renderer.xr.getReferenceSpace()) ?? null;
    // Only place on reasonably horizontal surfaces, not a wall.
    const horizontal = lastPose && lastPose.transform.matrix[5] > 0.85;
    reticle.visible = !!horizontal;
    if (horizontal) reticle.matrix.fromArray(lastPose.transform.matrix);
    $('#place').disabled = !horizontal;
    $('#placement-hint').textContent = horizontal ? 'いい場所。ここにケケを置こう。' : 'スマホをゆっくり動かして、床を探してください';
  }
  const input = controls.read();
  const canMove = ready && motion.canMove && (mode !== 'ar' || placed);
  const magnitude = canMove ? Math.hypot(input.x, input.y) : 0;
  walkSpeed += (magnitude - walkSpeed) * (1 - Math.exp(-dt * 16));
  const activeCamera = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  if (canMove && magnitude > 0.01) {
    right.setFromMatrixColumn(activeCamera.matrixWorld, 0); right.y = 0; right.normalize();
    forward.crossVectors(up, right).normalize();
    velocity.copy(right).multiplyScalar(input.x).addScaledVector(forward, input.y);
    // Deliberately no screen-boundary clamping and no camera following.
    character.position.addScaledVector(velocity, dt * (mode === 'ar' ? 0.38 : 1.35) * Math.sqrt(userSize));
    targetYaw = Math.atan2(-velocity.x, -velocity.z);
  }
  const angle = Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw)); yaw += angle * (1 - Math.exp(-dt * 11));
  const pose = motion.update(dt, canMove ? walkSpeed : 0, reducedMotion.matches);
  character.scale.setScalar((mode === 'ar' ? 0.28 : 1.8) * userSize);
  heading.rotation.y = yaw + pose.yaw;
  body.position.y = pose.y; body.rotation.z = pose.roll; body.scale.set(pose.sx, pose.sy, pose.sz);
  shadow.scale.set(1 + Math.abs(Math.sin(pose.roll)) * 0.4 + pose.y * 0.5, 1 + pose.y * 0.5, 1);
  shadow.position.x = -0.45 * Math.sin(pose.roll) * Math.cos(yaw + pose.yaw);
  shadow.position.z = 0.45 * Math.sin(pose.roll) * Math.sin(yaw + pose.yaw);
  shadow.material.opacity = Math.max(0.25, 1 - Math.max(0, pose.y - Math.abs(Math.sin(pose.roll)) * 0.34));
  for (const event of motion.drainEvents()) audio.play(event);
  $('#fall-label').textContent = motion.lying ? 'おきる' : 'ころん';
  const labels = { squish: 'ぷにぷにしています', jump: 'ぴょーん！', fall: 'ころん、とひと休み', getup: 'よいしょ、っと', spin: 'くるり、くるり' };
  $('#state-label').textContent = labels[motion.action] || (motion.lying ? 'ひと休み。おきる？' : walkSpeed > 0.05 ? 'おさんぽしています' : 'のんびりしています');
  for (const button of document.querySelectorAll('[data-action]')) button.classList.toggle('active', motion.action === button.dataset.action || (button.dataset.action === 'fall' && motion.lying));
  if (ready && character.visible) {
    character.updateMatrixWorld(); projected.copy(character.position); projected.y += (mode === 'ar' ? 0.14 : 0.9) * userSize;
    projected.project(activeCamera);
    const outside = Math.abs(projected.x) > 1.15 || Math.abs(projected.y) > 1.15 || projected.z > 1 || projected.z < -1;
    $('#offscreen').hidden = !outside;
    $('#speech').style.visibility = outside ? 'hidden' : '';
  } else $('#offscreen').hidden = true;
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
document.addEventListener('visibilitychange', () => {
  lastTime = null; controls.release();
  if (document.hidden) { audio.context?.suspend().catch(() => {}); if (mode === 'camera' || (busy && !session)) { studioMode(); toast('カメラを停止しました。「カメラ」から再開できます。'); } }
});
window.addEventListener('pagehide', () => { feed.stop(); session?.end().catch(() => {}); });
renderer.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); toast('3D表示が中断しました。復旧しない場合は再読み込みしてください。', 12000); });
// Read-only diagnostics for browser verification and model inspection.
window.kekeApp = { playAction, get state() { return { ready, mode, action: motion.action, lying: motion.lying, position: character.position.toArray(), pose: { y: body.position.y, sy: body.scale.y, roll: body.rotation.z }, sound: audio.enabled, cameraActive: !!feed.stream, model: 'keke-lowpoly-300-tex512.glb' }; } };
