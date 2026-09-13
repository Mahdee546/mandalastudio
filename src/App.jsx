import React, { useRef, useState, useEffect } from 'react';
import { Download, Trash2, Settings, Eraser, Check, Palette, Orbit, Split, RotateCw, X, Undo2, Redo2 } from 'lucide-react';
import './index.css';

const PRESET_COLORS = ['#f8fafc', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

function App() {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasDrawn = useRef(false);

  // History State
  const historyRef = useRef([]);
  const historyStep = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // UI State
  const [isToolbarOpen, setIsToolbarOpen] = useState(window.innerWidth > 768);
  const [activeTool, setActiveTool] = useState('brush'); // 'brush', 'eraser', or null
  const [brushColor, setBrushColor] = useState('#3b82f6');
  const [brushSize, setBrushSize] = useState(4);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [segments, setSegments] = useState(8);
  
  const [effects, setEffects] = useState({
    radial: true,
    kaleidoscope: true,
    spiral: false
  });

  // Keep a ref of settings to use inside DOM event listeners without stale closures
  const settingsRef = useRef({ brushColor, brushSize, brushOpacity, segments, effects, activeTool });
  
  useEffect(() => {
    settingsRef.current = { brushColor, brushSize, brushOpacity, segments, effects, activeTool };
    if (contextRef.current && activeTool) {
      contextRef.current.strokeStyle = activeTool === 'eraser' ? '#0f172a' : brushColor;
      contextRef.current.lineWidth = brushSize;
    }
  }, [brushColor, brushSize, brushOpacity, segments, effects, activeTool]);

  const saveHistoryState = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Truncate forward history if we undo'd and then draw
    const nextStep = historyStep.current + 1;
    historyRef.current.splice(nextStep);
    
    historyRef.current.push(imageData);
    
    // Keep max 30 states to prevent memory issues
    if (historyRef.current.length > 30) {
      historyRef.current.shift();
    }
    historyStep.current = historyRef.current.length - 1;
    
    setCanUndo(historyStep.current > 0);
    setCanRedo(false);
  };

  const undo = () => {
    if (historyStep.current > 0) {
      historyStep.current -= 1;
      const ctx = contextRef.current;
      ctx.putImageData(historyRef.current[historyStep.current], 0, 0);
      setCanUndo(historyStep.current > 0);
      setCanRedo(true);
    }
  };

  const redo = () => {
    if (historyStep.current < historyRef.current.length - 1) {
      historyStep.current += 1;
      const ctx = contextRef.current;
      ctx.putImageData(historyRef.current[historyStep.current], 0, 0);
      setCanUndo(true);
      setCanRedo(historyStep.current < historyRef.current.length - 1);
    }
  };

  // Canvas Setup
  useEffect(() => {
    const canvas = canvasRef.current;
    let resizeTimer;
    
    const updateCanvasSize = () => {
      // Avoid resetting canvas if we are just opening/closing toolbar on mobile
      const container = canvas.parentElement;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      
      if (newWidth === 0 || newHeight === 0) return;
      if (canvas.width === newWidth && canvas.height === newHeight) return;

      const ctx = canvas.getContext('2d');
      
      // Only save existing image if the user has actually drawn something (historyStep > 0)
      // We use an offscreen canvas and drawImage instead of getImageData to preserve opacity
      let existingCanvas = null;
      if (historyStep.current > 0 && canvas.width > 0 && canvas.height > 0) {
        existingCanvas = document.createElement('canvas');
        existingCanvas.width = canvas.width;
        existingCanvas.height = canvas.height;
        existingCanvas.getContext('2d').drawImage(canvas, 0, 0);
      }
      
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Initialize background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Restore drawing if resizing
      if (existingCanvas) {
        ctx.drawImage(existingCanvas, 0, 0);
      } else {
        // Clear history if resizing from scratch to avoid restoring transparent blocks
        historyRef.current = [];
        historyStep.current = -1;
      }
      
      contextRef.current = ctx;

      // Save initial state if history is empty
      if (historyRef.current.length === 0) {
        saveHistoryState();
      }
    };

    // Delay initial calculation slightly to ensure DOM layout is complete
    setTimeout(updateCanvasSize, 50);
    
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateCanvasSize, 200); // debounce resize
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
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
    if (!settingsRef.current.activeTool) return; // Do not draw if no tool is selected

    const pos = getCoordinates(e);
    isDrawing.current = true;
    lastPos.current = pos;
    hasDrawn.current = true;
    
    // Draw a dot immediately for taps
    drawStroke(pos.x, pos.y, pos.x + 0.1, pos.y + 0.1);
  };

  const draw = (e) => {
    if (!isDrawing.current || !settingsRef.current.activeTool) return;
    e.preventDefault();
    const pos = getCoordinates(e);
    drawStroke(lastPos.current.x, lastPos.current.y, pos.x, pos.y);
    lastPos.current = pos;
  };

  const stopDrawing = () => {
    if (isDrawing.current) {
      isDrawing.current = false;
      if (hasDrawn.current) {
        saveHistoryState();
        hasDrawn.current = false;
      }
    }
  };

  const drawStroke = (x0, y0, x1, y1) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    const { brushColor, brushSize, brushOpacity, segments, effects, activeTool } = settingsRef.current;
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const p0x = x0 - cx;
    const p0y = y0 - cy;
    const p1x = x1 - cx;
    const p1y = y1 - cy;

    const numSegments = effects.radial ? segments : 1;
    const spiralSteps = effects.spiral ? 8 : 1;

    ctx.strokeStyle = activeTool === 'eraser' ? '#0f172a' : brushColor;
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
          ctx.globalAlpha = activeTool === 'eraser' ? 1 : brushOpacity * Math.pow(0.8, s);
        } else {
          ctx.globalAlpha = activeTool === 'eraser' ? 1 : brushOpacity;
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
    saveHistoryState();
  };

  const exportImage = async () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    const filename = `mandala-${Date.now()}.png`;

    // Try Web Share API first (perfect for mobile & in-app browsers like Instagram)
    if (navigator.share) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'My Mandala',
            files: [file]
          });
          return; // Stop here if share succeeded
        }
      } catch (err) {
        console.log("Share failed or was cancelled:", err);
        // Fall through to traditional download
      }
    }

    // Fallback to standard download (works well on desktop)
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        
        {/* History Actions */}
        <div className="toolbar-section">
          <div className="action-grid" style={{ marginBottom: '8px' }}>
            <button 
              className="btn" 
              onClick={undo} 
              disabled={!canUndo}
              style={{ backgroundColor: canUndo ? 'rgba(255,255,255,0.1)' : 'transparent', color: canUndo ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              <Undo2 /> Undo
            </button>
            <button 
              className="btn" 
              onClick={redo} 
              disabled={!canRedo}
              style={{ backgroundColor: canRedo ? 'rgba(255,255,255,0.1)' : 'transparent', color: canRedo ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              <Redo2 /> Redo
            </button>
          </div>
        </div>

        <div className="toolbar-section">
          <h2 className="toolbar-title">Tools</h2>
          <div className="action-grid">
            <button 
              className={`btn ${activeTool === 'brush' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTool(activeTool === 'brush' ? null : 'brush')}
              style={{ backgroundColor: activeTool === 'brush' ? 'var(--accent)' : 'rgba(255,255,255,0.05)' }}
            >
              <Palette /> Brush
            </button>
            <button 
              className={`btn ${activeTool === 'eraser' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTool(activeTool === 'eraser' ? null : 'eraser')}
              style={{ backgroundColor: activeTool === 'eraser' ? 'var(--text-primary)' : 'rgba(255,255,255,0.05)' }}
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

          {activeTool !== 'eraser' && (
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
