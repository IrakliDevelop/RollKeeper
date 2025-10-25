'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  User, 
  LogOut, 
  LogIn, 
  UserPlus, 
  Settings,
  Crown,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SyncStatusIcon } from '@/components/ui/sync/SyncIndicator';

interface AuthButtonProps {
  variant?: 'default' | 'compact' | 'header';
  showSync?: boolean;
  className?: string;
}

export function AuthButton({ 
  variant = 'default', 
  showSync = true, 
  className = '' 
}: AuthButtonProps) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="animate-spin" size={16} />
        <span className="text-sm text-gray-600">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Link
          href="/auth"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <LogIn size={16} />
          Sign In
        </Link>
        <Link
          href="/auth"
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <UserPlus size={16} />
          Sign Up
        </Link>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showSync && <SyncStatusIcon size={16} />}
        
        {/* Clickable User Info */}
        <Link
          href="/settings"
          className="group flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 px-3 py-1.5 text-xs font-medium text-gray-800 transition-all hover:from-blue-100 hover:to-purple-100 hover:shadow-sm"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-semibold text-white">
            {(user?.displayName || user?.username)?.charAt(0).toUpperCase()}
          </div>
          <span className="group-hover:text-gray-900">
            {user?.displayName || user?.username}
          </span>
          {user?.isDM && (
            <div title="Dungeon Master">
              <Crown size={12} className="text-purple-600" />
            </div>
          )}
        </Link>
        
        <button
          onClick={logout}
          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Sign Out"
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  // Default dropdown variant
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
      >
        <div className="flex items-center gap-3">
          {showSync && <SyncStatusIcon size={16} />}
          
          {/* Avatar */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-white">
            {(user?.displayName || user?.username)?.charAt(0).toUpperCase()}
          </div>
          
          {/* User Info */}
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-900">
                {user?.displayName || user?.username}
              </span>
              {user?.isDM && (
                <div title="Dungeon Master">
                  <Crown size={14} className="text-purple-600" />
                </div>
              )}
            </div>
            <span className="text-xs text-gray-500">Click for settings</span>
          </div>
        </div>
        
        <ChevronDown size={16} className={`text-gray-400 transition-transform group-hover:text-gray-600 ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-2 shadow-xl">
            {/* User Info Header */}
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-white">
                  {(user?.displayName || user?.username)?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {user?.displayName || user?.username}
                  </p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                  {user?.isDM && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-purple-600">
                      <Crown size={12} />
                      Dungeon Master
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Primary Action - Settings */}
            <div className="px-2 py-1">
              <Link
                href="/settings"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-blue-50 hover:text-blue-700"
                onClick={() => setShowDropdown(false)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Settings size={16} />
                </div>
                <div>
                  <div className="font-medium">Account Settings</div>
                  <div className="text-xs text-gray-500">Manage your profile</div>
                </div>
              </Link>
            </div>
            
            {/* Navigation Links */}
            <div className="border-t border-gray-100 px-2 py-1">
              <Link
                href="/player"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                onClick={() => setShowDropdown(false)}
              >
                <User size={16} />
                My Characters
              </Link>
              
              {user?.isDM && (
                <Link
                  href="/dm"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                  onClick={() => setShowDropdown(false)}
                >
                  <Crown size={16} />
                  DM Tools
                </Link>
              )}
            </div>
            
            {/* Sign Out */}
            <div className="border-t border-gray-100 px-2 py-1">
              <button
                onClick={() => {
                  logout();
                  setShowDropdown(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Simplified version for headers
export function HeaderAuthButton({ className = '' }: { className?: string }) {
  return <AuthButton variant="compact" className={className} />;
}

// Login-only button for landing pages
export function LoginButton({ className = '' }: { className?: string }) {
  const { isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <AuthButton variant="compact" className={className} />;
  }
  
  return (
    <Link
      href="/auth"
      className={`flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 ${className}`}
    >
      <LogIn size={16} />
      Sign In
    </Link>
  );
}
