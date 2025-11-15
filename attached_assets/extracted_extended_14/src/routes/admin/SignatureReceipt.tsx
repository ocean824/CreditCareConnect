import React from 'react';

export default function SignatureReceipt({ signedPdfUrl, signatureImageUrl }) {
  return (
    <div className="p-6 bg-white shadow rounded">
      <h2 className="text-xl font-bold mb-4">🧾 Signature Receipt</h2>

      <div className="mb-4">
        <p><strong>PDF Preview:</strong></p>
        <iframe src={signedPdfUrl} className="w-full h-96 border rounded" title="PDF Preview" />
      </div>

      <div className="mb-4">
        <p><strong>Signature Preview:</strong></p>
        <img src={signatureImageUrl} alt="Signature" className="h-24 border p-2 bg-gray-50 rounded" />
      </div>

      <a href={signedPdfUrl} download className="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        ⬇️ Download Signed PDF
      </a>
    </div>
  );
}