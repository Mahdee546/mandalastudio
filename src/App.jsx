import React, { useRef, useState, useEffect } from 'react';
import { Download, Trash2, Settings, Eraser, Check, Palette, Orbit, Split, RotateCw, X } from 'lucide-react';
import './index.css';

const PRESET_COLORS = ['#f8fafc', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

function App() {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // UI State
  const [isToolbarOpen, setIsToolbarOpen] = useState(window.innerWidth > 768);
  const [brushColor, setBrushColor] = useState('#3b82f6');
  const [brushSize, setBrushSize] = useState(4);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [segments, setSegments] = useState(8);
  const [isEraser, setIsEraser] = useState(false);
  
  const [effects, setEffects] = useState({
    radial: true,
    kaleidoscope: true,
    spiral: false
  });

  // Keep a ref of settings to use inside DOM event listeners without stale closures
  const settingsRef = useRef({ brushColor, brushSize, brushOpacity, segments, effects, isEraser });
  
  useEffect(() => {
    settingsRef.current = { brushColor, brushSize, brushOpacity, segments, effects, isEraser };
    if (contextRef.current) {
      contextRef.current.strokeStyle = isEraser ? '#0f172a' : brushColor;
      contextRef.current.lineWidth = brushSize;
    }
  }, [brushColor, brushSize, brushOpacity, segments, effects, isEraser]);

  // Canvas Setup
  useEffect(() => {
    const canvas = canvasRef.current;
    
    // Set internal resolution to match display size exactly to prevent blur
    const updateCanvasSize = () => {
      const container = canvas.parentElement;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Initialize background (needed for PNG export to not have transparent bg)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      contextRef.current = ctx;
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault(); // Prevent scrolling on touch
    const pos = getCoordinates(e);
    isDrawing.current = true;
    lastPos.current = pos;
    // Draw a dot immediately for taps
    drawStroke(pos.x, pos.y, pos.x + 0.1, pos.y + 0.1);
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const pos = getCoordinates(e);
    drawStroke(lastPos.current.x, lastPos.current.y, pos.x, pos.y);
    lastPos.current = pos;
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const drawStroke = (x0, y0, x1, y1) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    const { brushColor, brushSize, brushOpacity, segments, effects, isEraser } = settingsRef.current;
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const p0x = x0 - cx;
    const p0y = y0 - cy;
    const p1x = x1 - cx;
    const p1y = y1 - cy;

    const numSegments = effects.radial ? segments : 1;
    const spiralSteps = effects.spiral ? 8 : 1;

    ctx.strokeStyle = isEraser ? '#0f172a' : brushColor;
    ctx.lineWidth = brushSize;

    for (let i = 0; i < numSegments; i++) {
      const angle = (i * 2 * Math.PI) / numSegments;

      for (let s = 0; s < spiralSteps; s++) {
        ctx.save();
        ctx.translate(cx, cy);
        
        if (effects.radial) {
          ctx.rotate(angle);
        }
        
        if (effects.spiral) {
          ctx.rotate(s * 0.3);
          const scale = Math.pow(0.85, s);
          ctx.scale(scale, scale);
          ctx.globalAlpha = isEraser ? 1 : brushOpacity * Math.pow(0.8, s);
        } else {
          ctx.globalAlpha = isEraser ? 1 : brushOpacity;
        }

        // Draw standard path
        ctx.beginPath();
        ctx.moveTo(p0x, p0y);
        ctx.lineTo(p1x, p1y);
        ctx.stroke();
        
        // Draw mirrored path
        if (effects.kaleidoscope) {
          ctx.scale(1, -1);
          ctx.beginPath();
          ctx.moveTo(p0x, p0y);
          ctx.lineTo(p1x, p1y);
          ctx.stroke();
        }

        ctx.restore();
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `mandala-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const toggleEffect = (effectName) => {
    setEffects(prev => ({ ...prev, [effectName]: !prev[effectName] }));
  };

  return (
    <div className="app-container">
      {/* Canvas Area */}
      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
      </div>

      {/* Floating Settings Button */}
      <button 
        className="settings-btn"
        onClick={() => setIsToolbarOpen(!isToolbarOpen)}
        aria-label="Toggle Settings"
      >
        {isToolbarOpen ? <X size={28} /> : <Settings size={28} />}
      </button>

      {/* Toolbar Area */}
      <div className={`toolbar ${isToolbarOpen ? 'open' : ''}`}>
        <div className="toolbar-section">
          <h2 className="toolbar-title">Tools</h2>
          <div className="action-grid">
            <button 
              className={`btn ${!isEraser ? 'btn-primary' : ''}`}
              onClick={() => setIsEraser(false)}
            >
              <Palette /> Brush
            </button>
            <button 
              className={`btn ${isEraser ? 'btn-primary' : ''}`}
              onClick={() => setIsEraser(true)}
              style={{ backgroundColor: isEraser ? 'var(--text-primary)' : 'rgba(255,255,255,0.05)' }}
            >
              <Eraser /> Eraser
            </button>
          </div>
        </div>

        <div className="toolbar-section">
          <h2 className="toolbar-title">Brush Properties</h2>
          
          <div className="control-group">
            <div className="control-label">
              <span>Size</span>
              <span>{brushSize}px</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="50" 
              value={brushSize} 
              onChange={(e) => setBrushSize(parseInt(e.target.value))} 
            />
          </div>

          <div className="control-group" style={{ marginTop: '12px' }}>
            <div className="control-label">
              <span>Opacity</span>
              <span>{Math.round(brushOpacity * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="1" 
              step="0.05"
              value={brushOpacity} 
              onChange={(e) => setBrushOpacity(parseFloat(e.target.value))} 
            />
          </div>

          {!isEraser && (
            <div className="control-group" style={{ marginTop: '12px' }}>
              <div className="control-label"><span>Color</span></div>
              <div className="color-picker">
                {PRESET_COLORS.map(color => (
                  <div 
                    key={color}
                    className={`color-swatch ${brushColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setBrushColor(color)}
                  />
                ))}
                <input 
                  type="color" 
                  value={brushColor}
                  onChange={(e) => setBrushColor(e.target.value)}
                  style={{ marginLeft: 'auto' }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="toolbar-section">
          <h2 className="toolbar-title">Symmetry Effects</h2>
          
          <div className="control-group">
            <button 
              className={`toggle-btn ${effects.radial ? 'active' : ''}`}
              onClick={() => toggleEffect('radial')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Orbit /> Radial Symmetry
              </span>
              {effects.radial && <Check size={16} />}
            </button>
            
            {effects.radial && (
              <div style={{ padding: '0 10px', marginTop: '4px' }}>
                <div className="control-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>Segments</span>
                  <span>{segments}</span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="32" 
                  step="2"
                  value={segments} 
                  onChange={(e) => setSegments(parseInt(e.target.value))} 
                />
              </div>
            )}

            <button 
              className={`toggle-btn ${effects.kaleidoscope ? 'active' : ''}`}
              onClick={() => toggleEffect('kaleidoscope')}
              style={{ marginTop: '8px' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Split /> Kaleidoscope (Mirror)
              </span>
              {effects.kaleidoscope && <Check size={16} />}
            </button>

            <button 
              className={`toggle-btn ${effects.spiral ? 'active' : ''}`}
              onClick={() => toggleEffect('spiral')}
              style={{ marginTop: '8px' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCw /> Spiral Trail
              </span>
              {effects.spiral && <Check size={16} />}
            </button>
          </div>
        </div>

        <div className="toolbar-section" style={{ marginTop: 'auto', paddingTop: '20px' }}>
          <div className="action-grid">
            <button className="btn btn-danger" onClick={clearCanvas}>
              <Trash2 /> Clear
            </button>
            <button className="btn btn-primary" onClick={exportImage}>
              <Download /> Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
