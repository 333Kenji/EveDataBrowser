import React, { useEffect, useRef } from 'react';
import { useUnifiedMarketModel } from './MarketHistoryChart';
import { useMarketHistoryStore } from './marketHistoryStore';

interface CanvasChartProps { typeId: string }

// Phase 2 scaffold: Canvas-based chart (layers will be iteratively added).
export function CanvasMarketHistoryChart({ typeId }: CanvasChartProps) {
  const query = useUnifiedMarketModel(typeId);
  const { status, model } = query;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const toggles = useMarketHistoryStore(s => s.toggles);
  const viewport = useMarketHistoryStore(s => s.viewport);

  useEffect(() => {
    if (!model || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Basic clear + placeholder render until full layer system added.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#888';
    ctx.fillText('Canvas chart (scaffold) — coming soon', 12, 20);
    ctx.fillText(`Points: ${model.days.length}`, 12, 36);
    ctx.fillText(`Viewport: ${viewport.start ?? 0} - ${viewport.end ?? model.days.length -1}`, 12, 52);
    ctx.fillText(`Toggles: ${Object.entries(toggles).filter(([,v])=>v).map(([k])=>k).join(', ')}`, 12, 68);
  }, [model, toggles, viewport.start, viewport.end]);

  if (status === 'loading') return <div style={{ minHeight: 160 }}>Loading market history…</div>;
  if (status === 'error' || status === 'empty' || !model) return <div style={{ minHeight: 160 }}>No market data.</div>;
  if (status === 'partial') return <div style={{ minHeight: 160 }}>Snapshot available; awaiting history ingest.</div>;

  return (
    <div style={{ width:'100%', maxWidth:640 }}>
      <canvas ref={canvasRef} width={640} height={200} style={{ width:'100%', height:200, background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:4 }} />
    </div>
  );
}
