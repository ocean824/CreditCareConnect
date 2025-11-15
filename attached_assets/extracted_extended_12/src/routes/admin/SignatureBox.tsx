import React, { useRef } from 'react';

export default function SignatureBox() {
  const canvasRef = useRef(null);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleDraw = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    let isDrawing = true;
    let x = e.nativeEvent.offsetX;
    let y = e.nativeEvent.offsetY;

    const draw = (event) => {
      if (!isDrawing) return;
      ctx.beginPath();
      ctx.moveTo(x, y);
      x = event.nativeEvent.offsetX;
      y = event.nativeEvent.offsetY;
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      isDrawing = false;
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
    };

    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-2">✍️ Sign Below</h3>
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        className="border border-gray-400 rounded bg-white"
        onMouseDown={handleDraw}
      />
      <button onClick={clearCanvas} className="mt-2 px-3 py-1 bg-red-600 text-white rounded">
        Clear Signature
      </button>
    </div>
  );
}