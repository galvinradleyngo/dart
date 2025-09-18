import { useCallback, useEffect, useRef } from 'react';

const DEDUPE_WINDOW_MS = 400;
let lastConfettiTimestamp = 0;

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

    const colors = [
      '#22c55e',
      '#2dd4bf',
      '#38bdf8',
      '#fbbf24',
      '#f97316',
      '#ef4444',
      '#d946ef',
      '#f472b6',
    ];
    const originX = window.innerWidth / 2;
    const originY = window.innerHeight / 3;
    const particleCount = 160;
    const gravity = 0.5;
    const drag = 0.9;
    const terminalVelocity = 8;
    const duration = 2200;
    const radialSpread = Math.PI * 0.85;
    const burstCount = 3;
    const burstDelay = 120;

    const particles = Array.from({ length: particleCount }, (_, index) => {
      const element = document.createElement('div');
      const size = Math.random() * 12 + 8;
      element.style.width = `${size}px`;
      element.style.height = `${size * 0.6}px`;
      element.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      element.style.borderRadius = Math.random() > 0.7 ? `${size / 2}px` : '2px';
      element.style.position = 'absolute';
      element.style.top = '0';
      element.style.left = '0';
      element.style.willChange = 'transform, opacity';

      const burstIndex = index % burstCount;
      const angleOffset = (Math.random() - 0.5) * radialSpread;
      const baseAngle = Math.random() * Math.PI - Math.PI / 2;
      const angle = baseAngle + angleOffset;
      const radialOffset = Math.random() * 20 - 10;
      const startX = originX + Math.cos(angle) * radialOffset;
      const startY = originY + Math.sin(angle) * radialOffset;

      element.style.transform = `translate3d(${startX}px, ${startY}px, 0)`;
      element.style.opacity = '1';
      element.style.boxShadow = `0 0 12px rgba(255, 255, 255, ${Math.random() * 0.6})`;
      container.appendChild(element);
      const speed = Math.random() * 9 + 6;
      const startDelay = burstIndex * burstDelay + Math.random() * 60;

      return {
        element,
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * Math.PI,
        rotationSpeed: Math.random() * 0.3 - 0.15,
        wobble: Math.random() * 10,
        wobbleSpeed: Math.random() * 0.2 + 0.05,
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
      const fade = Math.max(1 - elapsed / duration, 0);
      particles.forEach((p) => {
        if (elapsed < p.startDelay) {
          return;
        }

        const progress = Math.max(elapsed - p.startDelay, 0);
        const easedProgress = Math.min(progress / duration, 1);

        p.vy = Math.min(p.vy + gravity, terminalVelocity);
        p.vx *= drag;
        p.x += p.vx + Math.cos(p.wobble) * 0.6;
        p.y += p.vy + Math.sin(p.wobble * 0.8);
        p.wobble += p.wobbleSpeed;
        p.rotation += p.rotationSpeed * (1 + easedProgress * 0.6);
        p.element.style.opacity = `${fade}`;
        p.element.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rotation}rad)`;
      });

      if (elapsed < duration) {
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
