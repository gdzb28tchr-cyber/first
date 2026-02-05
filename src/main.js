const startButton = document.getElementById("startButton");
const statusText = document.getElementById("status");
const errorText = document.getElementById("error");
const canvas = document.getElementById("viz");
const ctx = canvas.getContext("2d");

let audioContext;
let analyser;
let timeData;
let frequencyData;
let animationId;

let currentRadius = 80;
let targetRadius = 80;
let beatPulse = 0;
let lastBeatTime = 0;
let lowEnergyAvg = 0;

const lerp = (start, end, amount) => start + (end - start) * amount;

const resizeCanvas = () => {
  const size = Math.min(canvas.clientWidth, canvas.clientHeight);
  canvas.width = size * window.devicePixelRatio;
  canvas.height = size * window.devicePixelRatio;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
};

const draw = (level, lowEnergy) => {
  const size = Math.min(canvas.clientWidth, canvas.clientHeight);
  ctx.clearRect(0, 0, size, size);

  const center = size / 2;
  const gradient = ctx.createRadialGradient(
    center,
    center,
    currentRadius * 0.3,
    center,
    center,
    currentRadius * 1.2
  );

  gradient.addColorStop(0, "rgba(109, 125, 255, 0.9)");
  gradient.addColorStop(1, "rgba(20, 30, 60, 0.2)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, currentRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + lowEnergy * 0.8})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center, center, currentRadius + 12, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`레벨: ${(level * 100).toFixed(0)}%`, center, size - 20);
};

const calculateRms = () => {
  let sum = 0;
  for (let i = 0; i < timeData.length; i += 1) {
    const value = (timeData[i] - 128) / 128;
    sum += value * value;
  }
  return Math.sqrt(sum / timeData.length);
};

const calculateLowEnergy = () => {
  const nyquist = audioContext.sampleRate / 2;
  const minIndex = Math.max(0, Math.floor((20 / nyquist) * frequencyData.length));
  const maxIndex = Math.min(
    frequencyData.length - 1,
    Math.ceil((200 / nyquist) * frequencyData.length)
  );

  let sum = 0;
  for (let i = minIndex; i <= maxIndex; i += 1) {
    sum += frequencyData[i];
  }
  const avg = sum / (maxIndex - minIndex + 1);
  return avg / 255;
};

const detectBeat = (energy) => {
  lowEnergyAvg = lerp(lowEnergyAvg, energy, 0.05);
  const threshold = Math.max(0.12, lowEnergyAvg * 1.6);
  const now = performance.now();

  if (energy > threshold && now - lastBeatTime > 280) {
    lastBeatTime = now;
    beatPulse = 1;
  }
};

const tick = () => {
  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(frequencyData);

  const rms = calculateRms();
  const lowEnergy = calculateLowEnergy();
  detectBeat(lowEnergy);

  const baseRadius = 80;
  const levelBoost = rms * 160;
  const beatBoost = beatPulse * 50;

  targetRadius = baseRadius + levelBoost + beatBoost;
  currentRadius = lerp(currentRadius, targetRadius, 0.12);
  beatPulse = Math.max(0, beatPulse - 0.06);

  draw(rms, lowEnergy);
  animationId = requestAnimationFrame(tick);
};

const stop = () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (audioContext) {
    audioContext.close();
  }
};

const start = async () => {
  errorText.hidden = true;
  statusText.textContent = "마이크를 준비 중입니다...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.7;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    timeData = new Uint8Array(analyser.fftSize);
    frequencyData = new Uint8Array(analyser.frequencyBinCount);

    resizeCanvas();
    statusText.textContent = "마이크 입력이 활성화되었습니다.";
    startButton.disabled = true;
    tick();
  } catch (error) {
    console.error(error);
    errorText.hidden = false;
    errorText.textContent =
      "마이크 접근이 거부되었습니다. 브라우저 설정에서 권한을 허용한 뒤 다시 시도해주세요.";
    statusText.textContent = "마이크 권한이 필요합니다.";
  }
};

startButton.addEventListener("click", () => {
  if (!audioContext) {
    start();
  }
});

window.addEventListener("beforeunload", stop);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
