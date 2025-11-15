import React from 'react';

export default function SignatureSuccessPanel() {
  return (
    <div className="bg-green-100 border-l-4 border-green-500 text-green-800 p-4 rounded shadow mt-4" role="alert">
      <div className="flex items-center space-x-2">
        <span className="text-2xl">✅</span>
        <p className="font-semibold text-lg">Signature Complete!</p>
      </div>
      <p className="mt-2 text-sm">Your document has been successfully signed and saved. You can now download it or view the receipt.</p>
    </div>
  );
}