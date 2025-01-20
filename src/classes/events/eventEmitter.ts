import { OrchestrationEventMap } from "@/types/agents/orchestration"; // or whichever path you keep your internal event map
import { EventStatsManager } from "./eventBus";
import { EventBusAdapter } from "@/types/events";

export class CustomEventEmitter {
  private readonly listeners: Map<string, Array<(...args: any[]) => void>> =
    new Map();
  private maxListeners: number = 10;

  // Attach stats manager so subclasses can use it
  private readonly statsManager: EventStatsManager;

  constructor() {
    this.statsManager = new EventStatsManager();
  }

  protected getStatsManager(): EventStatsManager {
    return this.statsManager;
  }

  setMaxListeners(n: number): this {
    this.maxListeners = n;
    return this;
  }

  getMaxListeners(): number {
    return this.maxListeners;
  }

  on(event: string, listener: (...args: any[]) => void): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
    return this;
  }

  once(event: string, listener: (...args: any[]) => void): this {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener.apply(this, args);
    };
    return this.on(event, onceWrapper);
  }

  off(event: string, listener: (...args: any[]) => void): this {
    if (!this.listeners.has(event)) return this;
    const eventListeners = this.listeners.get(event)!;
    const index = eventListeners.indexOf(listener);
    if (index !== -1) {
      eventListeners.splice(index, 1);
      if (eventListeners.length === 0) {
        this.listeners.delete(event);
      }
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.listeners.has(event)) return false;
    const eventListeners = this.listeners.get(event)!;
    eventListeners.forEach((listener) => {
      try {
        listener.apply(this, args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }

  rawListeners(event: string): Function[] {
    return [...(this.listeners.get(event) || [])];
  }

  eventNames(): Array<string> {
    return Array.from(this.listeners.keys());
  }

  prependListener(event: string, listener: (...args: any[]) => void): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.unshift(listener);
    return this;
  }

  prependOnceListener(event: string, listener: (...args: any[]) => void): this {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener.apply(this, args);
    };
    return this.prependListener(event, onceWrapper);
  }
}
