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

    const colors = ['#22c55e', '#2dd4bf', '#38bdf8', '#fbbf24', '#f97316', '#ef4444'];
    const originX = window.innerWidth / 2;
    const originY = window.innerHeight / 3;
    const particleCount = 80;
    const gravity = 0.45;
    const drag = 0.92;
    const terminalVelocity = 6;
    const duration = 1600;

    const particles = Array.from({ length: particleCount }, () => {
      const element = document.createElement('div');
      const size = Math.random() * 8 + 6;
      element.style.width = `${size}px`;
      element.style.height = `${size * 0.6}px`;
      element.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      element.style.borderRadius = '2px';
      element.style.position = 'absolute';
      element.style.top = '0';
      element.style.left = '0';
      element.style.willChange = 'transform, opacity';
      element.style.transform = `translate3d(${originX}px, ${originY}px, 0)`;
      element.style.opacity = '1';
      container.appendChild(element);

      const angle = Math.random() * Math.PI - Math.PI / 2;
      const speed = Math.random() * 6 + 3;

      return {
        element,
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * Math.PI,
        rotationSpeed: Math.random() * 0.3 - 0.15,
        wobble: Math.random() * 10,
        wobbleSpeed: Math.random() * 0.2 + 0.05,
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
        p.vy = Math.min(p.vy + gravity, terminalVelocity);
        p.vx *= drag;
        p.x += p.vx + Math.cos(p.wobble) * 0.5;
        p.y += p.vy;
        p.wobble += p.wobbleSpeed;
        p.rotation += p.rotationSpeed;
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
