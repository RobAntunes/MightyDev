// src/services/init.ts

import { eventSystem } from "../classes/events/manager";
import { startAIRequestHandler } from "../handlers/ai";
import { Auth0ContextInterface } from "@auth0/auth0-react";
import { StorageService } from "./db/rocksdb";

interface InitializerOptions {
    maxRetries: number;
    retryDelay: number;
    timeout: number;
}

interface InitializerState {
    isInitializing: boolean;
    isInitialized: boolean;
    error: Error | null;
    retryCount: number;
}

type InitFunction = () => Promise<void>;

interface SystemComponent {
    name: string;
    init: InitFunction;
    dependencies: string[];
    isOptional?: boolean;
    timeout?: number;
    cleanup?: () => Promise<void>;
}

export class SystemInitializer {
    private static instance: SystemInitializer | null = null;
    private state: InitializerState;
    private components: Map<string, SystemComponent>;
    private initialized: Set<string>;
    private options: InitializerOptions;
    private initPromise: Promise<void> | null = null;
    private auth0: Auth0ContextInterface;

    private constructor(
        auth0: Auth0ContextInterface,
        options: Partial<InitializerOptions> = {},
    ) {
        this.auth0 = auth0;
        this.state = {
            isInitializing: false,
            isInitialized: false,
            error: null,
            retryCount: 0,
        };

        this.components = new Map();
        this.initialized = new Set();

        this.options = {
            maxRetries: options.maxRetries ?? 3,
            retryDelay: options.retryDelay ?? 1000,
            timeout: options.timeout ?? 30000,
        };

        // Register core system components
        this.registerCoreComponents();
    }

    public static getInstance(
        auth0: Auth0ContextInterface,
        options?: Partial<InitializerOptions>,
    ): SystemInitializer {
        if (!SystemInitializer.instance) {
            SystemInitializer.instance = new SystemInitializer(auth0, options);
        }
        return SystemInitializer.instance;
    }

    private registerCoreComponents(): void {
        // Event System - Depends on storage
        this.registerComponent({
            name: "eventSystem",
            dependencies: [],
            init: async () => {
                eventSystem.initialize({
                    region: "eu-west-3",
                    eventBusName: "Main",
                    mode: "local",
                });
            },
        });

        // AI Handler - Depends on event system
        this.registerComponent({
            name: "aiHandler",
            dependencies: ["eventSystem"],
            init: async () => {
                await startAIRequestHandler(this.auth0);
            },
        });
    }

    public registerComponent(component: SystemComponent): void {
        if (this.components.has(component.name)) {
            throw new Error(`Component ${component.name} already registered`);
        }
        this.components.set(component.name, component);
    }

    private async initializeComponent(
        name: string,
        visited: Set<string> = new Set(),
    ): Promise<void> {
        if (visited.has(name)) {
            throw new Error(
                `Circular dependency detected: ${
                    Array.from(visited).join(" -> ")
                } -> ${name}`,
            );
        }

        if (this.initialized.has(name)) {
            return;
        }

        const component = this.components.get(name);
        if (!component) {
            throw new Error(`Component ${name} not found`);
        }

        visited.add(name);

        for (const dep of component.dependencies) {
            await this.initializeComponent(dep, new Set(visited));
        }

        try {
            await Promise.race([
                component.init(),
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new Error(`Timeout initializing ${name}`)),
                        component.timeout || this.options.timeout,
                    )
                ),
            ]);

            this.initialized.add(name);
        } catch (error) {
            if (!component.isOptional) {
                throw error;
            }
            console.warn(
                `Optional component ${name} failed to initialize:`,
                error,
            );
        }
    }

    public async initialize(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            if (this.state.isInitializing) {
                throw new Error("System is already initializing");
            }

            if (this.state.isInitialized) {
                return;
            }

            this.state.isInitializing = true;

            try {
                for (const [name] of this.components) {
                    await this.initializeComponent(name);
                }
                this.state.isInitialized = true;
                this.state.error = null;
            } catch (error) {
                this.state.error = error instanceof Error
                    ? error
                    : new Error(String(error));
                throw this.state.error;
            } finally {
                this.state.isInitializing = false;
                this.initPromise = null;
            }
        })();

        return this.initPromise;
    }

    public async cleanup(): Promise<void> {
        const componentsArray = Array.from(this.initialized).reverse();

        for (const name of componentsArray) {
            const component = this.components.get(name);
            if (component?.cleanup) {
                try {
                    await component.cleanup();
                } catch (error) {
                    console.error(`Error cleaning up ${name}:`, error);
                }
            }
        }

        this.initialized.clear();
        this.state.isInitialized = false;
        this.state.isInitializing = false;
        this.state.error = null;
    }

    public getError(): Error | null {
        return this.state.error;
    }
}
