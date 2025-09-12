'use client';

import React from 'react';

export default function ExperimentalFeaturesSection() {

  return (
    <section className="mx-auto mb-6 max-w-7xl">
      <div className="relative overflow-hidden rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 via-violet-50 to-indigo-50 shadow-lg">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-gradient-to-br from-purple-400/10 to-indigo-400/10 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-gradient-to-tr from-violet-400/10 to-purple-400/10 blur-xl"></div>
      </div>
    </section>
  );
}
