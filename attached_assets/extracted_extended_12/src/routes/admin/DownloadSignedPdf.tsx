import React from 'react';

export default function DownloadSignedPdf({ fileUrl }) {
  return (
    <div className="mt-4">
      <a
        href={fileUrl}
        download
        className="bg-green-700 text-white px-4 py-2 rounded shadow hover:bg-green-800"
      >
        ⬇️ Download Signed PDF
      </a>
    </div>
  );
}