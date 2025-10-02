import { useCallback, useEffect, useRef } from 'react';

const DEDUPE_WINDOW_MS = 400;
let lastConfettiTimestamp = 0;

const randomBetween = (min, max) => Math.random() * (max - min) + min;
const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

const CONFETTI_VARIANTS = [
  {
    name: 'aurora-splash',
    colors: ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#a855f7'],
    particleCount: 360,
    sizeRange: [14, 34],
    aspectRatioRange: [0.45, 1.1],
    speedRange: [8, 18],
    gravity: 0.55,
    drag: 0.9,
    terminalVelocity: 12,
    duration: 3200,
    angleRange: [-Math.PI, Math.PI],
    originPoints: [
      { x: 0.15, y: 0.1 },
      { x: 0.5, y: 0.15 },
      { x: 0.85, y: 0.1 },
    ],
    originJitter: { x: 0.6, y: 0.24 },
    burstCount: 6,
    burstDelay: 75,
    wobbleStrengthRange: [0.6, 1.4],
    wobbleSpeedRange: [0.08, 0.26],
    rotationSpeedRange: [-0.3, 0.4],
    sparkle: 0.85,
    gradientProbability: 0.35,
    shapes: ['rectangle', 'rounded', 'circle'],
    fadeCurve: 1.1,
    mixBlendMode: 'screen',
  },
  {
    name: 'firework-blast',
    colors: ['#f97316', '#facc15', '#ef4444', '#22d3ee', '#a855f7'],
    particleCount: 420,
    sizeRange: [10, 28],
    aspectRatioRange: [0.3, 0.9],
    speedRange: [10, 22],
    gravity: 0.62,
    drag: 0.88,
    terminalVelocity: 13,
    duration: 3000,
    angleRange: [-Math.PI, Math.PI],
    originPoints: [
      { x: 0.3, y: 0.2 },
      { x: 0.5, y: 0.25 },
      { x: 0.7, y: 0.2 },
      { x: 0.5, y: 0.4 },
    ],
    originJitter: { x: 0.7, y: 0.3 },
    burstCount: 7,
    burstDelay: 60,
    wobbleStrengthRange: [0.7, 1.6],
    wobbleSpeedRange: [0.1, 0.32],
    rotationSpeedRange: [-0.4, 0.45],
    sparkle: 1,
    gradientProbability: 0.45,
    streamerProbability: 0.28,
    fadeCurve: 1.3,
  },
  {
    name: 'candy-cloud',
    colors: ['#f9a8d4', '#fef08a', '#bfdbfe', '#c4b5fd', '#fcd34d'],
    particleCount: 340,
    sizeRange: [16, 36],
    aspectRatioRange: [0.6, 1.2],
    speedRange: [6, 14],
    gravity: 0.45,
    drag: 0.92,
    terminalVelocity: 10,
    duration: 3400,
    angleRange: [-Math.PI, Math.PI],
    originPoints: [
      { x: 0.2, y: 0.18 },
      { x: 0.8, y: 0.18 },
      { x: 0.5, y: 0.05 },
    ],
    originJitter: { x: 0.55, y: 0.25 },
    burstCount: 5,
    burstDelay: 110,
    wobbleStrengthRange: [0.8, 1.8],
    wobbleSpeedRange: [0.06, 0.18],
    rotationSpeedRange: [-0.25, 0.3],
    sparkle: 0.65,
    shapes: ['rounded', 'circle'],
    fadeCurve: 1,
    mixBlendMode: 'lighten',
  },
  {
    name: 'neon-rain',
    colors: ['#22d3ee', '#38bdf8', '#22c55e', '#f97316', '#f43f5e'],
    particleCount: 380,
    sizeRange: [14, 32],
    aspectRatioRange: [0.2, 0.6],
    speedRange: [9, 20],
    gravity: 0.68,
    drag: 0.86,
    terminalVelocity: 14,
    duration: 3100,
    angleRange: [-Math.PI, Math.PI],
    originPoints: [
      { x: 0.1, y: 0.05 },
      { x: 0.9, y: 0.05 },
      { x: 0.5, y: 0.15 },
      { x: 0.3, y: 0.25 },
      { x: 0.7, y: 0.25 },
    ],
    originJitter: { x: 0.8, y: 0.32 },
    burstCount: 6,
    burstDelay: 70,
    wobbleStrengthRange: [0.9, 2.1],
    wobbleSpeedRange: [0.14, 0.34],
    rotationSpeedRange: [-0.45, 0.5],
    sparkle: 0.9,
    streamerProbability: 0.35,
    fadeCurve: 1.2,
    mixBlendMode: 'screen',
  },
  {
    name: 'stardust',
    colors: ['#facc15', '#f97316', '#f472b6', '#a855f7', '#6366f1', '#38bdf8'],
    particleCount: 360,
    sizeRange: [12, 28],
    aspectRatioRange: [0.4, 0.9],
    speedRange: [8, 16],
    gravity: 0.5,
    drag: 0.9,
    terminalVelocity: 11,
    duration: 3600,
    angleRange: [-Math.PI, Math.PI],
    originPoints: [
      { x: 0.5, y: 0.1 },
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.5, y: 0.35 },
    ],
    originJitter: { x: 0.7, y: 0.3 },
    burstCount: 8,
    burstDelay: 65,
    wobbleStrengthRange: [0.8, 1.8],
    wobbleSpeedRange: [0.12, 0.28],
    rotationSpeedRange: [-0.35, 0.35],
    sparkle: 1,
    gradientProbability: 0.5,
    fadeCurve: 1.4,
  },
  {
    name: 'tropical-wave',
    colors: ['#34d399', '#2dd4bf', '#22d3ee', '#60a5fa', '#facc15'],
    particleCount: 300,
    sizeRange: [18, 40],
    aspectRatioRange: [0.5, 1],
    speedRange: [7, 16],
    gravity: 0.42,
    drag: 0.94,
    terminalVelocity: 9,
    duration: 3300,
    angleRange: [-Math.PI, Math.PI],
    originPoints: [
      { x: 0.15, y: 0.25 },
      { x: 0.85, y: 0.25 },
      { x: 0.5, y: 0.35 },
    ],
    originJitter: { x: 0.5, y: 0.35 },
    burstCount: 4,
    burstDelay: 120,
    wobbleStrengthRange: [1, 2.2],
    wobbleSpeedRange: [0.05, 0.16],
    rotationSpeedRange: [-0.22, 0.25],
    sparkle: 0.55,
    shapes: ['rounded', 'circle'],
    fadeCurve: 1,
  },
  {
    name: 'berry-pop',
    colors: ['#fb7185', '#f472b6', '#e879f9', '#c084fc', '#a855f7'],
    particleCount: 320,
    sizeRange: [14, 32],
    aspectRatioRange: [0.35, 0.85],
    speedRange: [8, 17],
    gravity: 0.52,
    drag: 0.89,
    terminalVelocity: 11,
    duration: 3000,
    angleRange: [-Math.PI, Math.PI],
    originPoints: [
      { x: 0.25, y: 0.12 },
      { x: 0.75, y: 0.12 },
      { x: 0.5, y: 0.28 },
      { x: 0.4, y: 0.4 },
      { x: 0.6, y: 0.4 },
    ],
    originJitter: { x: 0.55, y: 0.28 },
    burstCount: 5,
    burstDelay: 85,
    wobbleStrengthRange: [0.7, 1.6],
    wobbleSpeedRange: [0.09, 0.22],
    rotationSpeedRange: [-0.32, 0.32],
    sparkle: 0.75,
    gradientProbability: 0.4,
    fadeCurve: 1.15,
  },
  {
    name: 'citrus-burst',
    colors: ['#facc15', '#f97316', '#fb7185', '#fef08a', '#fbbf24'],
    particleCount: 310,
    sizeRange: [12, 30],
    aspectRatioRange: [0.4, 0.95],
    speedRange: [7, 15],
    gravity: 0.48,
    drag: 0.9,
    terminalVelocity: 10,
    duration: 3200,
    angleRange: [-Math.PI, Math.PI],
    originPoints: [
      { x: 0.1, y: 0.2 },
      { x: 0.9, y: 0.2 },
      { x: 0.5, y: 0.08 },
    ],
    originJitter: { x: 0.6, y: 0.3 },
    burstCount: 6,
    burstDelay: 90,
    wobbleStrengthRange: [0.8, 1.7],
    wobbleSpeedRange: [0.08, 0.2],
    rotationSpeedRange: [-0.3, 0.33],
    sparkle: 0.8,
    fadeCurve: 1.25,
  },
  {
    name: 'galaxy-swirl',
    colors: ['#6366f1', '#8b5cf6', '#0ea5e9', '#22d3ee', '#f472b6'],
    particleCount: 370,
    sizeRange: [16, 38],
    aspectRatioRange: [0.45, 1.05],
    speedRange: [9, 18],
    gravity: 0.5,
    drag: 0.9,
    terminalVelocity: 12,
    duration: 3500,
    angleRange: [-Math.PI, Math.PI],
    originPoints: [
      { x: 0.2, y: 0.18 },
      { x: 0.8, y: 0.18 },
      { x: 0.5, y: 0.3 },
      { x: 0.35, y: 0.4 },
      { x: 0.65, y: 0.4 },
    ],
    originJitter: { x: 0.65, y: 0.3 },
    burstCount: 7,
    burstDelay: 75,
    wobbleStrengthRange: [0.9, 2],
    wobbleSpeedRange: [0.1, 0.24],
    rotationSpeedRange: [-0.4, 0.38],
    sparkle: 0.95,
    gradientProbability: 0.55,
    mixBlendMode: 'screen',
    swirlFactor: 0.9,
  },
  {
    name: 'celebration-stream',
    colors: ['#22c55e', '#10b981', '#f97316', '#60a5fa', '#38bdf8', '#f472b6'],
    particleCount: 390,
    sizeRange: [14, 34],
    aspectRatioRange: [0.3, 1],
    speedRange: [8, 19],
    gravity: 0.58,
    drag: 0.88,
    terminalVelocity: 13,
    duration: 3300,
    angleRange: [-Math.PI, Math.PI],
    originPoints: [
      { x: 0.1, y: 0.08 },
      { x: 0.9, y: 0.08 },
      { x: 0.3, y: 0.3 },
      { x: 0.7, y: 0.3 },
      { x: 0.5, y: 0.45 },
    ],
    originJitter: { x: 0.75, y: 0.35 },
    burstCount: 6,
    burstDelay: 80,
    wobbleStrengthRange: [0.8, 1.9],
    wobbleSpeedRange: [0.09, 0.26],
    rotationSpeedRange: [-0.36, 0.4],
    sparkle: 0.7,
    streamerProbability: 0.3,
    gradientProbability: 0.3,
    fadeCurve: 1.2,
  },
];

const createParticleElement = (variant) => {
  const element = document.createElement('div');
  element.style.position = 'absolute';
  element.style.top = '0';
  element.style.left = '0';
  element.style.willChange = 'transform, opacity';
  element.style.transformOrigin = 'center';
  if (variant.mixBlendMode) {
    element.style.mixBlendMode = variant.mixBlendMode;
  }
  return element;
};

const applyShapeStyling = (element, baseSize, variant) => {
  const shape = variant.shapes ? pickRandom(variant.shapes) : 'rectangle';
  let width = baseSize;
  let height = baseSize * randomBetween(
    variant.aspectRatioRange ? variant.aspectRatioRange[0] : 0.5,
    variant.aspectRatioRange ? variant.aspectRatioRange[1] : 1
  );

  if (variant.streamerProbability && Math.random() < variant.streamerProbability) {
    width = baseSize * 0.35;
    height = baseSize * randomBetween(2.2, 3.4);
    element.style.borderRadius = `${baseSize}px`;
  } else if (shape === 'rounded') {
    element.style.borderRadius = `${baseSize / 2}px`;
  } else if (shape === 'circle') {
    element.style.borderRadius = '999px';
    height = width;
  } else {
    element.style.borderRadius = Math.random() > 0.6 ? `${baseSize * 0.35}px` : '2px';
  }

  element.style.width = `${Math.max(width, 2)}px`;
  element.style.height = `${Math.max(height, 2)}px`;
};

const applyColorStyling = (element, variant) => {
  const baseColor = pickRandom(variant.colors);
  if (variant.gradientProbability && Math.random() < variant.gradientProbability) {
    const otherColor = pickRandom(variant.colors.filter((c) => c !== baseColor)) || baseColor;
    const angle = Math.round(randomBetween(0, 360));
    element.style.background = `linear-gradient(${angle}deg, ${baseColor}, ${otherColor})`;
  } else {
    element.style.background = baseColor;
  }

  return baseColor;
};

const computeOrigin = (variant, index) => {
  const points = variant.originPoints?.length ? variant.originPoints : [{ x: 0.5, y: 0.2 }];
  const origin = points[index % points.length];
  const jitterX = (variant.originJitter?.x ?? 0.3) * window.innerWidth;
  const jitterY = (variant.originJitter?.y ?? 0.2) * window.innerHeight;
  const startX = origin.x * window.innerWidth + (Math.random() - 0.5) * jitterX;
  const startY = origin.y * window.innerHeight + (Math.random() - 0.5) * jitterY;
  return { startX, startY };
};

export function useCompletionConfetti({ status, auto = false } = {}) {
  const cleanupRef = useRef(null);
  const frameRef = useRef(null);
  const prevStatusRef = useRef(status);
  const skipNextAutoRef = useRef(false);

  const launchConfetti = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

    if (now - lastConfettiTimestamp < DEDUPE_WINDOW_MS) {
      return;
    }
    lastConfettiTimestamp = now;

    if (cleanupRef.current) {
      cleanupRef.current();
    }

    const variant = pickRandom(CONFETTI_VARIANTS);
    const container = document.createElement('div');
    container.setAttribute('data-confetti', 'true');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.overflow = 'hidden';
    container.style.zIndex = '9999';
    container.style.transform = 'translateZ(0)';

    const particles = Array.from({ length: variant.particleCount }, (_, index) => {
      const element = createParticleElement(variant);
      const size = randomBetween(variant.sizeRange[0], variant.sizeRange[1]);
      applyShapeStyling(element, size, variant);
      const baseColor = applyColorStyling(element, variant);
      const { startX, startY } = computeOrigin(variant, index);

      element.style.transform = `translate3d(${startX}px, ${startY}px, 0)`;
      element.style.opacity = '1';

      if (variant.sparkle) {
        const sparkleRadius = randomBetween(size * 0.5, size * 1.6);
        element.dataset.sparkleRadius = String(sparkleRadius);
        element.style.boxShadow = `0 0 ${sparkleRadius}px rgba(255, 255, 255, ${randomBetween(0.2, variant.sparkle)})`;
      }

      if (Math.random() < 0.18) {
        element.style.filter = 'brightness(1.15)';
      }

      container.appendChild(element);

      const angle = randomBetween(variant.angleRange?.[0] ?? -Math.PI, variant.angleRange?.[1] ?? Math.PI);
      const speed = randomBetween(variant.speedRange[0], variant.speedRange[1]);
      const wobbleSpeed = randomBetween(
        variant.wobbleSpeedRange?.[0] ?? 0.05,
        variant.wobbleSpeedRange?.[1] ?? 0.25
      );
      const wobbleStrength = randomBetween(
        variant.wobbleStrengthRange?.[0] ?? 0.6,
        variant.wobbleStrengthRange?.[1] ?? 1.4
      );
      const rotationSpeed = randomBetween(
        variant.rotationSpeedRange?.[0] ?? -0.3,
        variant.rotationSpeedRange?.[1] ?? 0.3
      );
      const swirlFactor = variant.swirlFactor ? randomBetween(variant.swirlFactor * 0.6, variant.swirlFactor * 1.4) : 0;
      const burstCount = variant.burstCount ?? 1;
      const burstDelay = variant.burstDelay ?? 0;
      const startDelay = (index % burstCount) * burstDelay + randomBetween(0, burstDelay || 90);

      return {
        element,
        color: baseColor,
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: randomBetween(0, Math.PI * 2),
        rotationSpeed,
        wobble: randomBetween(0, Math.PI * 2),
        wobbleSpeed,
        wobbleStrength,
        swirlFactor,
        startDelay,
      };
    });

    document.body.appendChild(container);

    const cleanup = () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      particles.forEach((p) => {
        if (p.element.parentNode) {
          p.element.parentNode.removeChild(p.element);
        }
      });
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
      cleanupRef.current = null;
    };

    const start =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

    const update = (time) => {
      const elapsed = time - start;
      const fadeBase = Math.max(1 - elapsed / variant.duration, 0);
      const fade = variant.fadeCurve ? Math.pow(fadeBase, variant.fadeCurve) : fadeBase;
      particles.forEach((p) => {
        if (elapsed < p.startDelay) {
          return;
        }

        const progress = Math.max(elapsed - p.startDelay, 0);
        const easedProgress = Math.min(progress / variant.duration, 1);

        p.vy = Math.min(p.vy + variant.gravity, variant.terminalVelocity);
        p.vx *= variant.drag;
        if (p.swirlFactor) {
          const swirl = p.swirlFactor * Math.sin((elapsed - p.startDelay) / 220);
          p.vx += swirl * 0.2;
        }
        p.x += p.vx + Math.cos(p.wobble) * p.wobbleStrength;
        p.y += p.vy + Math.sin(p.wobble * 0.9) * p.wobbleStrength;
        p.wobble += p.wobbleSpeed;
        p.rotation += p.rotationSpeed * (1 + easedProgress * 0.6);
        p.element.style.opacity = `${fade}`;
        p.element.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rotation}rad)`;

        if (variant.sparkle) {
          const sparkleStrength = Math.max(
            0,
            Math.min(1, fade + Math.sin(p.wobble * 1.5 + progress / 120) * 0.35)
          );
          const radius = Number.parseFloat(p.element.dataset.sparkleRadius || '8');
          p.element.style.boxShadow = `0 0 ${radius}px rgba(255, 255, 255, ${sparkleStrength * variant.sparkle})`;
        }
      });

      if (elapsed < variant.duration) {
        frameRef.current = window.requestAnimationFrame(update);
      } else {
        cleanup();
      }
    };

    cleanupRef.current = cleanup;
    frameRef.current = window.requestAnimationFrame(update);
  }, []);

  const fireOnDone = useCallback(
    (prevStatus, nextStatus) => {
      if (prevStatus !== 'done' && nextStatus === 'done') {
        skipNextAutoRef.current = true;
        launchConfetti();
      }
    },
    [launchConfetti]
  );

  useEffect(
    () => () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    },
    []
  );

  useEffect(() => {
    if (!auto) {
      prevStatusRef.current = status;
      return;
    }

    if (prevStatusRef.current !== 'done' && status === 'done') {
      if (skipNextAutoRef.current) {
        skipNextAutoRef.current = false;
      } else {
        launchConfetti();
      }
    } else {
      skipNextAutoRef.current = false;
    }

    prevStatusRef.current = status;
  }, [auto, status, launchConfetti]);

  return { launchConfetti, fireOnDone };
}

export default useCompletionConfetti;
