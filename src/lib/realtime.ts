import { JWTPayload } from './auth';

// Real-time event types
export type RealtimeEventType = 
  | 'character_update'
  | 'combat_update' 
  | 'sync_request'
  | 'campaign_update'
  | 'user_joined'
  | 'user_left';

export interface RealtimeEvent {
  type: RealtimeEventType;
  campaignId: string;
  characterId?: string;
  data: any;
  timestamp: number;
  userId: string;
  username?: string;
}

// Combat-specific update types
export type CombatUpdateType = 
  | 'hp_change'
  | 'spell_slot_use'
  | 'feature_use'
  | 'condition_add'
  | 'condition_remove'
  | 'action_use'
  | 'turn_end'
  | 'initiative_change'
  | 'death_save'
  | 'concentration_break';

export interface CombatUpdate {
  type: CombatUpdateType;
  characterId: string;
  campaignId: string;
  data: any;
  source: 'player' | 'dm';
  timestamp: number;
  userId: string;
}

// Character update types
export type CharacterUpdateType =
  | 'basic_info'
  | 'ability_scores'
  | 'skills'
  | 'equipment'
  | 'spells'
  | 'features'
  | 'notes';

export interface CharacterUpdateData {
  type: CharacterUpdateType;
  path: string;
  value: any;
  previousValue?: any;
}

// Server-Sent Events connection manager
export class RealtimeClient {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private listeners: Map<RealtimeEventType, Set<(event: RealtimeEvent) => void>> = new Map();
  private connectionListeners: Set<(connected: boolean) => void> = new Set();
  private campaignId: string | null = null;
  private token: string | null = null;

  constructor() {
    // Initialize event type listeners
    const eventTypes: RealtimeEventType[] = [
      'character_update',
      'combat_update',
      'sync_request',
      'campaign_update',
      'user_joined',
      'user_left'
    ];

    eventTypes.forEach(type => {
      this.listeners.set(type, new Set());
    });
  }

  // Connect to real-time events for a campaign
  connect(campaignId: string, token: string): void {
    this.campaignId = campaignId;
    this.token = token;
    this.reconnectAttempts = 0;
    this.establishConnection();
  }

  // Disconnect from real-time events
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.campaignId = null;
    this.token = null;
    this.notifyConnectionListeners(false);
  }

  // Add event listener
  addEventListener(type: RealtimeEventType, listener: (event: RealtimeEvent) => void): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.add(listener);
    }
  }

  // Remove event listener
  removeEventListener(type: RealtimeEventType, listener: (event: RealtimeEvent) => void): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  // Add connection status listener
  addConnectionListener(listener: (connected: boolean) => void): void {
    this.connectionListeners.add(listener);
  }

  // Remove connection status listener
  removeConnectionListener(listener: (connected: boolean) => void): void {
    this.connectionListeners.delete(listener);
  }

  // Send real-time update
  async sendUpdate(event: Omit<RealtimeEvent, 'timestamp' | 'userId'>): Promise<void> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch('/api/realtime/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`Failed to send update: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send real-time update:', error);
      throw error;
    }
  }

  // Send combat update
  async sendCombatUpdate(update: Omit<CombatUpdate, 'timestamp' | 'userId'>): Promise<void> {
    await this.sendUpdate({
      type: 'combat_update',
      campaignId: update.campaignId,
      characterId: update.characterId,
      data: update,
    });
  }

  // Send character update
  async sendCharacterUpdate(
    characterId: string,
    campaignId: string,
    updateData: CharacterUpdateData
  ): Promise<void> {
    await this.sendUpdate({
      type: 'character_update',
      campaignId,
      characterId,
      data: updateData,
    });
  }

  // Private methods
  private establishConnection(): void {
    if (!this.campaignId || !this.token) {
      console.error('Cannot establish connection: missing campaign ID or token');
      return;
    }

    const url = `/api/realtime/connect?campaignId=${this.campaignId}&token=${encodeURIComponent(this.token)}`;
    
    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('Real-time connection established');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.notifyConnectionListeners(true);
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data: RealtimeEvent = JSON.parse(event.data);
          this.handleRealtimeEvent(data);
        } catch (error) {
          console.error('Failed to parse real-time event:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('Real-time connection error:', error);
        this.notifyConnectionListeners(false);
        this.handleReconnection();
      };
    } catch (error) {
      console.error('Failed to establish real-time connection:', error);
      this.handleReconnection();
    }
  }

  private handleRealtimeEvent(event: RealtimeEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in real-time event listener for ${event.type}:`, error);
        }
      });
    }
  }

  private handleReconnection(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.notifyConnectionListeners(false);
      return;
    }

    this.reconnectAttempts++;
    
    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.establishConnection();
    }, this.reconnectDelay);

    // Exponential backoff with jitter
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000) + Math.random() * 1000;
  }

  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  // Get connection status
  get isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

// Global real-time client instance
export const realtimeClient = new RealtimeClient();

// Utility functions for real-time updates
export function createCharacterUpdate(
  type: CharacterUpdateType,
  path: string,
  value: any,
  previousValue?: any
): CharacterUpdateData {
  return {
    type,
    path,
    value,
    previousValue,
  };
}

export function createCombatUpdate(
  type: CombatUpdateType,
  characterId: string,
  campaignId: string,
  data: any,
  source: 'player' | 'dm' = 'player'
): Omit<CombatUpdate, 'timestamp' | 'userId'> {
  return {
    type,
    characterId,
    campaignId,
    data,
    source,
  };
}
