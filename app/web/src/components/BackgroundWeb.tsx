import { useEffect, useRef } from 'react';

type Node = { x: number; y: number; vx: number; vy: number };

type BackgroundWebProps = {
  density?: number;
  velocity?: number;
  filamentAmplitude?: number;
  gradientStops?: string[];
};

export function BackgroundWeb({
  density = 1.2,
  velocity = 1.6,
  filamentAmplitude = 1.25,
  gradientStops = ['#22d3ee', '#60a5fa', '#8b5cf6'],
}: BackgroundWebProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const nodesRef = useRef<Node[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const initialiseNodes = () => {
      const base = Math.min(120, Math.floor((width * height) / 16000));
      const count = Math.max(50, Math.floor(base * density));
      nodesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35 * velocity,
        vy: (Math.random() - 0.5) * 0.35 * velocity,
      }));
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradientStops.forEach((color, index) => {
        const stop = gradientStops.length === 1 ? 0 : index / (gradientStops.length - 1);
        gradient.addColorStop(stop, color);
      });
      context.strokeStyle = gradient;
      context.fillStyle = 'rgba(255,255,255,0.9)';

      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        a.x += a.vx;
        a.y += a.vy;

        if (a.x < 0 || a.x > width) a.vx *= -1;
        if (a.y < 0 || a.y > height) a.vy *= -1;

        context.beginPath();
        context.arc(a.x, a.y, 1.2, 0, Math.PI * 2);
        context.fill();

        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distanceSq = dx * dx + dy * dy;
          const limit = 180 * filamentAmplitude;
          if (distanceSq < limit * limit) {
            context.globalAlpha = Math.max(0.08, 1 - distanceSq / (limit * limit));
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
            context.globalAlpha = 1;
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initialiseNodes();
    };

    initialiseNodes();
    draw();
    window.addEventListener('resize', handleResize);

    const handleVisibility = () => {
      if (document.hidden) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } else if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [density, filamentAmplitude, gradientStops, velocity]);

  return (
    <canvas
      ref={canvasRef}
      className="background-web"
      aria-hidden="true"
      data-density={density}
      data-velocity={velocity}
      data-filament={filamentAmplitude}
    />
  );
}
