'use client';

import { Crown, Wand2, ScrollText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function DMDashboard() {
  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
      <div className="mx-auto max-w-2xl text-center">
        {/* Coming Soon Badge */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-4 text-xl font-bold text-white shadow-2xl">
            <Crown className="mr-3 h-6 w-6" />
            Coming Soon
          </div>
        </div>

        {/* Main Message */}
        <h1 className="mb-6 text-4xl font-bold text-slate-800">
          DM Tools Are Under Development
        </h1>
        <p className="mb-8 text-lg leading-relaxed text-slate-600">
          We&apos;re working hard to bring you powerful Dungeon Master tools
          including campaign management, combat tracking, player character
          import, and a comprehensive monster bestiary. Stay tuned!
        </p>

        {/* Feature Preview Cards */}
        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow-md">
            <ScrollText className="mx-auto mb-3 h-10 w-10 text-purple-500" />
            <h3 className="mb-2 font-semibold text-slate-800">
              Campaign Management
            </h3>
            <p className="text-sm text-slate-600">
              Organize sessions and track story progression
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-md">
            <Wand2 className="mx-auto mb-3 h-10 w-10 text-purple-500" />
            <h3 className="mb-2 font-semibold text-slate-800">
              Combat Tracker
            </h3>
            <p className="text-sm text-slate-600">
              Visual initiative and resource management
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-md">
            <Crown className="mx-auto mb-3 h-10 w-10 text-purple-500" />
            <h3 className="mb-2 font-semibold text-slate-800">DM Screen</h3>
            <p className="text-sm text-slate-600">
              Quick reference and dice rolling tools
            </p>
          </div>
        </div>

        {/* Back Button */}
        <Link
          href="/"
          className="group inline-flex items-center rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-3 font-semibold text-white transition-all duration-200 hover:from-purple-700 hover:to-purple-800"
        >
          <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>

        {/* Beta Notice */}
        <div className="mt-12 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-6">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Note:</span> While DM tools are in
            development, you can still use the{' '}
            <Link
              href="/player"
              className="font-semibold text-purple-600 hover:underline"
            >
              Player Dashboard
            </Link>{' '}
            to manage your character sheets and access the{' '}
            <Link
              href="/resources"
              className="font-semibold text-purple-600 hover:underline"
            >
              Resources
            </Link>{' '}
            section for spells, classes, and more.
          </p>
        </div>
      </div>
    </div>
  );
}
