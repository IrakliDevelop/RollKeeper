'use client';

import Link from 'next/link';
import { Users, Crown, Sword, FileText, Dice6, Shield, Star, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Dice6 className="h-8 w-8 text-purple-600 mr-3" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                RollKeeper
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/player" 
                className="text-slate-600 hover:text-purple-600 transition-colors font-medium"
              >
                Player Dashboard
              </Link>
              <Link 
                href="/dm" 
                className="text-slate-600 hover:text-purple-600 transition-colors font-medium"
              >
                DM Toolset
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <Dice6 className="h-20 w-20 text-purple-600 mx-auto mb-6" />
            <h1 className="text-5xl font-bold text-slate-800 mb-6">
              Your Ultimate
              <span className="block bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                D&D Companion
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              RollKeeper is the complete digital toolset for Dungeons & Dragons players and Dungeon Masters. 
              Manage your characters, track campaigns, and enhance your tabletop experience with powerful, 
              intuitive tools designed by gamers, for gamers.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="text-center">
              <FileText className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Smart Character Sheets</h3>
              <p className="text-slate-600">Auto-calculating, feature-rich character sheets that grow with your character</p>
            </div>
            <div className="text-center">
              <Sword className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Combat Tracking</h3>
              <p className="text-slate-600">Visual combat tracker with drag-and-drop functionality and resource management</p>
            </div>
            <div className="text-center">
              <Star className="h-12 w-12 text-purple-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Campaign Management</h3>
              <p className="text-slate-600">Comprehensive tools for organizing sessions, notes, and character progression</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Navigation Sections */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Player Section */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-blue-100 hover:shadow-2xl transition-shadow duration-300">
              <div className="text-center mb-8">
                <div className="bg-blue-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                  <Users className="h-10 w-10 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-800 mb-4">For Players</h2>
                <p className="text-slate-600 text-lg">
                  Create and manage multiple characters with powerful digital character sheets
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-800">Multiple Characters</h4>
                    <p className="text-slate-600 text-sm">Manage all your characters in one place</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <FileText className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-800">Auto-Calculating Sheets</h4>
                    <p className="text-slate-600 text-sm">No more manual math - focus on playing</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Star className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-800">Resource Tracking</h4>
                    <p className="text-slate-600 text-sm">Track spells, abilities, inventory & more</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Dice6 className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-800">Integrated Dice Rolling</h4>
                    <p className="text-slate-600 text-sm">Roll with advantage, modifiers, and more</p>
                  </div>
                </div>
              </div>

              <Link 
                href="/player"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center group"
              >
                Access Player Dashboard
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* DM Section */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-purple-100 hover:shadow-2xl transition-shadow duration-300">
              <div className="text-center mb-8">
                <div className="bg-purple-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                  <Crown className="h-10 w-10 text-purple-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-800 mb-4">For Dungeon Masters</h2>
                <p className="text-slate-600 text-lg">
                  Complete campaign management and combat tracking tools for DMs
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-start space-x-3">
                  <FileText className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-800">Campaign Management</h4>
                    <p className="text-slate-600 text-sm">Organize sessions, notes, and story progression</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Sword className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-800">Combat Tracker</h4>
                    <p className="text-slate-600 text-sm">Visual initiative tracking with drag & drop</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Users className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-800">Player Character Import</h4>
                    <p className="text-slate-600 text-sm">Import and manage player character sheets</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Star className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-800">Monster Bestiary</h4>
                    <p className="text-slate-600 text-sm">Access to comprehensive creature database</p>
                  </div>
                </div>
              </div>

              <Link 
                href="/dm"
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center group"
              >
                Access DM Toolset
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="py-16 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">Powerful Features for Every Table</h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Whether you&apos;re a new player or a veteran DM, RollKeeper has the tools you need
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center p-6 rounded-xl bg-white shadow-lg">
              <Dice6 className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-800 mb-2">Smart Calculations</h3>
              <p className="text-slate-600 text-sm">Automatic stat calculations and modifiers</p>
            </div>
            
            <div className="text-center p-6 rounded-xl bg-white shadow-lg">
              <FileText className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-800 mb-2">Rich Character Sheets</h3>
              <p className="text-slate-600 text-sm">Everything you need in one organized sheet</p>
            </div>
            
            <div className="text-center p-6 rounded-xl bg-white shadow-lg">
              <Sword className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-800 mb-2">Combat Tools</h3>
              <p className="text-slate-600 text-sm">Initiative tracking and resource management</p>
            </div>
            
            <div className="text-center p-6 rounded-xl bg-white shadow-lg">
              <Star className="h-12 w-12 text-purple-500 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-800 mb-2">Campaign Notes</h3>
              <p className="text-slate-600 text-sm">Keep track of story beats and NPCs</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Dice6 className="h-8 w-8 text-purple-400 mr-3" />
              <h3 className="text-2xl font-bold">RollKeeper</h3>
            </div>
            <p className="text-slate-400 mb-6">
              Built by D&D players for D&D players
            </p>
            <div className="flex justify-center space-x-6">
              <Link href="/player" className="text-slate-300 hover:text-white transition-colors">
                Player Tools
              </Link>
              <Link href="/dm" className="text-slate-300 hover:text-white transition-colors">
                DM Tools
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
