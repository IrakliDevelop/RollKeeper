'use client';

import Link from 'next/link';
import {
  Users,
  Crown,
  Sword,
  FileText,
  Dice6,
  Shield,
  Star,
  ArrowRight,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="border-b border-purple-100 bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Dice6 className="mr-3 h-8 w-8 text-purple-600" />
              <h1 className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-2xl font-bold text-transparent">
                RollKeeper
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/player"
                className="font-medium text-slate-600 transition-colors hover:text-purple-600"
              >
                Player Dashboard
              </Link>
              <span
                className="cursor-not-allowed font-medium text-slate-400"
                title="Coming Soon"
              >
                DM Toolset
              </span>
              <Link
                href="/resources"
                className="font-medium text-slate-600 transition-colors hover:text-purple-600"
              >
                Resources
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <div className="mb-8">
            <Dice6 className="mx-auto mb-6 h-20 w-20 text-purple-600" />
            <h1 className="mb-6 text-5xl font-bold text-slate-800">
              Your Ultimate
              <span className="block bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                D&D Companion
              </span>
            </h1>
            <p className="mx-auto max-w-3xl text-xl leading-relaxed text-slate-600">
              RollKeeper is the complete digital toolset for Dungeons & Dragons
              players and Dungeon Masters. Manage your characters, track
              campaigns, and enhance your tabletop experience with powerful,
              intuitive tools designed by gamers, for gamers.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-blue-500" />
              <h3 className="mb-2 text-lg font-semibold text-slate-800">
                Smart Character Sheets
              </h3>
              <p className="text-slate-600">
                Auto-calculating, feature-rich character sheets that grow with
                your character
              </p>
            </div>
            <div className="text-center">
              <Sword className="mx-auto mb-4 h-12 w-12 text-red-500" />
              <h3 className="mb-2 text-lg font-semibold text-slate-800">
                Combat Tracking
              </h3>
              <p className="text-slate-600">
                Visual combat tracker with drag-and-drop functionality and
                resource management
              </p>
            </div>
            <div className="text-center">
              <Star className="mx-auto mb-4 h-12 w-12 text-purple-500" />
              <h3 className="mb-2 text-lg font-semibold text-slate-800">
                Campaign Management
              </h3>
              <p className="text-slate-600">
                Comprehensive tools for organizing sessions, notes, and
                character progression
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Navigation Sections */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Player Section */}
            <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-xl transition-shadow duration-300 hover:shadow-2xl">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
                  <Users className="h-10 w-10 text-blue-600" />
                </div>
                <h2 className="mb-4 text-3xl font-bold text-slate-800">
                  For Players
                </h2>
                <p className="text-lg text-slate-600">
                  Create and manage multiple characters with powerful digital
                  character sheets
                </p>
              </div>

              <div className="mb-8 space-y-4">
                <div className="flex items-start space-x-3">
                  <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                  <div>
                    <h4 className="font-semibold text-slate-800">
                      Multiple Characters
                    </h4>
                    <p className="text-sm text-slate-600">
                      Manage all your characters in one place
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                  <div>
                    <h4 className="font-semibold text-slate-800">
                      Auto-Calculating Sheets
                    </h4>
                    <p className="text-sm text-slate-600">
                      No more manual math - focus on playing
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Star className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                  <div>
                    <h4 className="font-semibold text-slate-800">
                      Resource Tracking
                    </h4>
                    <p className="text-sm text-slate-600">
                      Track spells, abilities, inventory & more
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Dice6 className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                  <div>
                    <h4 className="font-semibold text-slate-800">
                      Integrated Dice Rolling
                    </h4>
                    <p className="text-sm text-slate-600">
                      Roll with advantage, modifiers, and more
                    </p>
                  </div>
                </div>
              </div>

              <Link
                href="/player"
                className="group flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 font-semibold text-white transition-all duration-200 hover:from-blue-700 hover:to-blue-800"
              >
                Access Player Dashboard
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* DM Section */}
            <div className="relative rounded-2xl border border-purple-100 bg-white p-8 shadow-xl">
              {/* Coming Soon Overlay */}
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-900/60 backdrop-blur-sm">
                <div className="text-center">
                  <div className="mb-3 inline-flex items-center rounded-full bg-purple-600 px-6 py-3 text-lg font-bold text-white shadow-lg">
                    Coming Soon
                  </div>
                  <p className="text-sm text-white">
                    DM Tools are currently under development
                  </p>
                </div>
              </div>

              <div className="mb-8 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-purple-100">
                  <Crown className="h-10 w-10 text-purple-600" />
                </div>
                <h2 className="mb-4 text-3xl font-bold text-slate-800">
                  For Dungeon Masters
                </h2>
                <p className="text-lg text-slate-600">
                  Complete campaign management and combat tracking tools for DMs
                </p>
              </div>

              <div className="mb-8 space-y-4">
                <div className="flex items-start space-x-3">
                  <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-500" />
                  <div>
                    <h4 className="font-semibold text-slate-800">
                      Campaign Management
                    </h4>
                    <p className="text-sm text-slate-600">
                      Organize sessions, notes, and story progression
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Sword className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-500" />
                  <div>
                    <h4 className="font-semibold text-slate-800">
                      Combat Tracker
                    </h4>
                    <p className="text-sm text-slate-600">
                      Visual initiative tracking with drag & drop
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Users className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-500" />
                  <div>
                    <h4 className="font-semibold text-slate-800">
                      Player Character Import
                    </h4>
                    <p className="text-sm text-slate-600">
                      Import and manage player character sheets
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Star className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-500" />
                  <div>
                    <h4 className="font-semibold text-slate-800">
                      Monster Bestiary
                    </h4>
                    <p className="text-sm text-slate-600">
                      Access to comprehensive creature database
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex w-full cursor-not-allowed items-center justify-center rounded-xl bg-gradient-to-r from-purple-400 to-purple-500 px-6 py-4 font-semibold text-white opacity-75">
                Access DM Toolset
                <ArrowRight className="ml-2 h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="bg-white/50 py-16 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-slate-800">
              Powerful Features for Every Table
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-600">
              Whether you&apos;re a new player or a veteran DM, RollKeeper has
              the tools you need
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-6 text-center shadow-lg">
              <Dice6 className="mx-auto mb-4 h-12 w-12 text-blue-500" />
              <h3 className="mb-2 font-semibold text-slate-800">
                Smart Calculations
              </h3>
              <p className="text-sm text-slate-600">
                Automatic stat calculations and modifiers
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 text-center shadow-lg">
              <FileText className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h3 className="mb-2 font-semibold text-slate-800">
                Rich Character Sheets
              </h3>
              <p className="text-sm text-slate-600">
                Everything you need in one organized sheet
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 text-center shadow-lg">
              <Sword className="mx-auto mb-4 h-12 w-12 text-red-500" />
              <h3 className="mb-2 font-semibold text-slate-800">
                Combat Tools
              </h3>
              <p className="text-sm text-slate-600">
                Initiative tracking and resource management
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 text-center shadow-lg">
              <Star className="mx-auto mb-4 h-12 w-12 text-purple-500" />
              <h3 className="mb-2 font-semibold text-slate-800">
                Campaign Notes
              </h3>
              <p className="text-sm text-slate-600">
                Keep track of story beats and NPCs
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800 py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-4 flex items-center justify-center">
              <Dice6 className="mr-3 h-8 w-8 text-purple-400" />
              <h3 className="text-2xl font-bold">RollKeeper</h3>
            </div>
            <p className="mb-6 text-slate-400">
              Built by D&D players for D&D players
            </p>
            <div className="flex justify-center space-x-6">
              <Link
                href="/player"
                className="text-slate-300 transition-colors hover:text-white"
              >
                Player Tools
              </Link>
              <span
                className="cursor-not-allowed text-slate-500"
                title="Coming Soon"
              >
                DM Tools
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
