'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { realtimeClient, type RealtimeEvent, type RealtimeEventType } from '@/lib/realtime';
import { useAuth } from './AuthContext';

interface RealtimeContextType {
  isConnected: boolean;
  currentCampaignId: string | null;
  connect: (campaignId: string) => void;
  disconnect: () => void;
  sendUpdate: (event: Omit<RealtimeEvent, 'timestamp' | 'userId'>) => Promise<void>;
  addEventListener: (type: RealtimeEventType, listener: (event: RealtimeEvent) => void) => void;
  removeEventListener: (type: RealtimeEventType, listener: (event: RealtimeEvent) => void) => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { accessToken, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(null);

  // Set up connection status listener
  useEffect(() => {
    const handleConnectionChange = (connected: boolean) => {
      setIsConnected(connected);
    };

    realtimeClient.addConnectionListener(handleConnectionChange);

    return () => {
      realtimeClient.removeConnectionListener(handleConnectionChange);
    };
  }, []);

  // Disconnect when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      disconnect();
    }
  }, [isAuthenticated]);

  const connect = (campaignId: string) => {
    if (!accessToken) {
      console.error('Cannot connect to real-time: not authenticated');
      return;
    }

    if (currentCampaignId === campaignId && isConnected) {
      console.log('Already connected to campaign:', campaignId);
      return;
    }

    // Disconnect from current campaign if connected to a different one
    if (currentCampaignId && currentCampaignId !== campaignId) {
      disconnect();
    }

    setCurrentCampaignId(campaignId);
    realtimeClient.connect(campaignId, accessToken);
  };

  const disconnect = () => {
    setCurrentCampaignId(null);
    realtimeClient.disconnect();
  };

  const sendUpdate = async (event: Omit<RealtimeEvent, 'timestamp' | 'userId'>) => {
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    await realtimeClient.sendUpdate(event);
  };

  const addEventListener = (type: RealtimeEventType, listener: (event: RealtimeEvent) => void) => {
    realtimeClient.addEventListener(type, listener);
  };

  const removeEventListener = (type: RealtimeEventType, listener: (event: RealtimeEvent) => void) => {
    realtimeClient.removeEventListener(type, listener);
  };

  const value: RealtimeContextType = {
    isConnected,
    currentCampaignId,
    connect,
    disconnect,
    sendUpdate,
    addEventListener,
    removeEventListener,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
