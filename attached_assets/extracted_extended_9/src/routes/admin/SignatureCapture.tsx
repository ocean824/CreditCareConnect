import React, { useRef } from 'react';

export default function SignatureCapture() {
  const canvasRef = useRef(null);

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    const base64 = canvas.toDataURL();
    const userId = 'demo_user';
    const res = await fetch('/api/save-signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, base64 })
    });
    const data = await res.json();
    alert('✅ Signature saved to: ' + data.path);
  };

  return (
    <div>
      <canvas ref={canvasRef} width={400} height={150} className="border" />
      <div className="mt-2">
        <button onClick={saveSignature} className="bg-green-600 text-white px-3 py-1 rounded">
          Save Signature
        </button>
      </div>
    </div>
  );
}