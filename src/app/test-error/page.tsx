'use client';

import { useState } from 'react';

export default function TestErrorPage() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error('Test error for demonstrating the fancy error page!');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-800">
          Error Page Demo
        </h1>
        <p className="mb-6 text-gray-600">
          This page lets you test theerror page
        </p>

        <div className="space-y-4">
          <button
            onClick={() => setShouldThrow(true)}
            className="rounded-lg bg-red-600 px-6 py-3 text-white shadow-lg transition-colors hover:bg-red-700"
          >
            🎲 Roll for Catastrophic Failure
          </button>

          <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="space-y-2">
              <a
                href="/non-existent-page"
                className="block text-blue-600 underline hover:text-blue-800"
                target="_blank"
              >
                🔗 Test 404 Not Found Page
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
