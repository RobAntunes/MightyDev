import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Play,
    RotateCcw,
    Square,
} from "lucide-react";
import {
    EventBusMetrics,
    EventMetrics,
} from "../types/events";
import { EventPayload, EventBusAdapter } from "../types/events";

interface EventSystemDevToolsProps {
    eventBus: EventBusAdapter;
    className?: string;
}

interface EventLogEntry {
    id: string;
    timestamp: number;
    type: string;
    data: any;
    source: string;
    success: boolean;
    latency: number;
}

interface EventFilter {
    type?: string;
    source?: string;
    onlyErrors?: boolean;
}

const EventUI: React.FC<EventSystemDevToolsProps> = ({
    eventBus,
    className = "",
}) => {
    const [isRecording, setIsRecording] = useState(true);
    const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
    const [expandedEvents, setExpandedEvents] = useState<Set<string>>(
        new Set(),
    );
    const [filter, setFilter] = useState<EventFilter>({});
    const [metrics, setMetrics] = useState<EventBusMetrics>({
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        averageLatency: 0,
        retryRate: 0,
    });

    // Setup event listeners
    useEffect(() => {
        if (!isRecording) return;

        const handleEvent = (event: EventPayload<any>) => {
            const entry: EventLogEntry = {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                type: event.type,
                data: event.data,
                source: event.metadata.source,
                success: true,
                latency: 0,
            };

            setEventLog((prev) => [entry, ...prev].slice(0, 1000)); // Keep last 1000 events
        };

        const handleMetrics = (metrics: EventMetrics) => {
            setMetrics((prev) => ({
                ...prev,
                totalEvents: prev.totalEvents + 1,
                successfulEvents: metrics.success
                    ? prev.successfulEvents + 1
                    : prev.successfulEvents,
                failedEvents: !metrics.success
                    ? prev.failedEvents + 1
                    : prev.failedEvents,
                averageLatency:
                    (prev.averageLatency * prev.totalEvents + metrics.processingTime) /
                    (prev.totalEvents + 1),
                retryRate:
                    (prev.retryRate * prev.totalEvents + metrics.retryCount!) /
                    (prev.totalEvents + 1),
            }));
        };

        eventBus.on("eventProcessed", handleMetrics);
        const subscriptionIds: string[] = [];

        // Subscribe to all events for monitoring
        const subscribe = async () => {
            const id = await eventBus.subscribe("*", handleEvent);
            subscriptionIds.push(id);
        };

        subscribe();

        return () => {
            eventBus.off("eventProcessed", handleMetrics);
            subscriptionIds.forEach((id) => eventBus.unsubscribe(id));
        };
    }, [eventBus, isRecording]);

    const toggleRecording = () => setIsRecording((prev) => !prev);
    const clearLog = () => setEventLog([]);
    const toggleEventExpand = (id: string) => {
        setExpandedEvents((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const filteredEvents = eventLog.filter((entry) => {
        if (filter.type && !entry.type.includes(filter.type)) return false;
        if (filter.source && !entry.source.includes(filter.source)) {
            return false;
        }
        if (filter.onlyErrors && entry.success) return false;
        return true;
    });

    return (
        <div className={`flex flex-col h-full bg-zinc-900/90 ${className}`}>
            {/* Control Bar */}
            <div className="flex items-center gap-4 p-4 border-b border-zinc-800/50">
                <button
                    onClick={toggleRecording}
                    className={`p-2 rounded-lg ${
                        isRecording
                            ? "bg-red-500/20 text-red-400"
                            : "bg-lime-500/20 text-lime-400"
                    }`}
                >
                    {isRecording
                        ? <Square className="w-4 h-4" />
                        : <Play className="w-4 h-4" />}
                </button>

                <button
                    onClick={clearLog}
                    className="p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-400"
                >
                    <RotateCcw className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 ml-auto">
                    <input
                        type="text"
                        placeholder="Filter by type..."
                        className="px-3 py-1.5 bg-zinc-800/50 rounded-lg text-sm text-zinc-300"
                        value={filter.type || ""}
                        onChange={(e) =>
                            setFilter((prev) => ({
                                ...prev,
                                type: e.target.value,
                            }))}
                    />
                    <input
                        type="text"
                        placeholder="Filter by source..."
                        className="px-3 py-1.5 bg-zinc-800/50 rounded-lg text-sm text-zinc-300"
                        value={filter.source || ""}
                        onChange={(e) =>
                            setFilter((prev) => ({
                                ...prev,
                                source: e.target.value,
                            }))}
                    />
                    <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <input
                            type="checkbox"
                            checked={filter.onlyErrors}
                            onChange={(e) =>
                                setFilter((prev) => ({
                                    ...prev,
                                    onlyErrors: e.target.checked,
                                }))}
                            className="rounded border-zinc-600"
                        />
                        Only Errors
                    </label>
                </div>
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-5 gap-4 p-4 bg-zinc-800/30">
                <div className="text-center">
                    <div className="text-sm font-medium text-zinc-400">
                        Total Events
                    </div>
                    <div className="text-xl text-zinc-200">
                        {metrics.totalEvents}
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-sm font-medium text-zinc-400">
                        Success Rate
                    </div>
                    <div className="text-xl text-lime-400">
                        {((metrics.successfulEvents / metrics.totalEvents) *
                                100 || 0).toFixed(1)}%
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-sm font-medium text-zinc-400">
                        Failed Events
                    </div>
                    <div className="text-xl text-red-400">
                        {metrics.failedEvents}
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-sm font-medium text-zinc-400">
                        Avg Latency
                    </div>
                    <div className="text-xl text-zinc-200">
                        {metrics.averageLatency.toFixed(2)}ms
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-sm font-medium text-zinc-400">
                        Retry Rate
                    </div>
                    <div className="text-xl text-zinc-200">
                        {(metrics.retryRate * 100).toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Event Log */}
            <div className="flex-1 overflow-y-auto">
                {filteredEvents.map((entry) => (
                    <div
                        key={entry.id}
                        className="border-b border-zinc-800/30 hover:bg-zinc-800/20"
                    >
                        <div
                            className="flex items-center gap-4 px-4 py-2 cursor-pointer"
                            onClick={() => toggleEventExpand(entry.id)}
                        >
                            {expandedEvents.has(entry.id)
                                ? (
                                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                                )
                                : (
                                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                                )}

                            <span className="text-sm font-light text-zinc-400">
                                {new Date(entry.timestamp).toLocaleTimeString()}
                            </span>

                            <span
                                className={`px-2 py-0.5 rounded text-xs ${
                                    entry.success
                                        ? "bg-lime-500/20 text-lime-400"
                                        : "bg-red-500/20 text-red-400"
                                }`}
                            >
                                {entry.type}
                            </span>

                            <span className="text-sm text-zinc-500">
                                {entry.source}
                            </span>

                            {!entry.success && (
                                <AlertCircle className="w-4 h-4 text-red-400" />
                            )}

                            <span className="text-xs text-zinc-600">
                                {entry.latency.toFixed(2)}ms
                            </span>
                        </div>

                        {expandedEvents.has(entry.id) && (
                            <div className="px-12 py-4 bg-zinc-800/20">
                                <pre className="text-sm text-zinc-300 overflow-x-auto">
                  {JSON.stringify(entry.data, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EventUI;
