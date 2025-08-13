'use client';

import { useState } from 'react';

export default function TestErrorPage() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error('Test error for demonstrating the fancy error page!');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Error Page Demo</h1>
        <p className="text-gray-600 mb-6">
          This page lets you test theerror page
        </p>
        
        <div className="space-y-4">
          <button
            onClick={() => setShouldThrow(true)}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-lg"
          >
            🎲 Roll for Catastrophic Failure
          </button>

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="space-y-2">
              <a 
                href="/non-existent-page" 
                className="block text-blue-600 hover:text-blue-800 underline"
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