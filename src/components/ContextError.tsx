import React, { useCallback, useState } from "react";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { FolderOpen, Loader2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

interface ErrorHandlerProps {
    onRetry?: (path: string) => void;
    onClear?: () => void;
    initialPath?: string;
}

interface FileAdditionState {
    path: string;
    isAdding: boolean;
    error: string | null;
}

export const ContextErrorHandler: React.FC<ErrorHandlerProps> = ({
    onRetry,
    onClear,
}) => {
    const [state, setState] = useState<FileAdditionState>({
        path: "",
        isAdding: false,
        error: null,
    });

    const handleBrowse = useCallback(async () => {
        try {
            const selected = await open({
                multiple: false,
                directory: false,
            });

            if (selected && typeof selected === "string") {
                setState((prev) => ({ ...prev, path: selected, error: null }));
            }
        } catch (err) {
            setState((prev) => ({
                ...prev,
                error: err instanceof Error
                    ? err.message
                    : "Failed to open file dialog",
            }));
        }
    }, []);

    const handleRetry = useCallback(async () => {
        if (!state.path) return;
        setState((prev) => ({ ...prev, isAdding: true, error: null }));
        try {
            if (onRetry) {
                onRetry(state.path);
            }
        } catch (err) {
            setState((prev) => ({
                ...prev,
                error: err instanceof Error
                    ? err.message
                    : "Failed to add file",
            }));
        } finally {
            setState((prev) => ({ ...prev, isAdding: false }));
        }
    }, [onRetry]);

    return (
        <div className="space-y-4 p-4">
            {state.error && (
                <Alert variant="destructive">
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            )}

            <div className="flex justify-end gap-2">
                <Button
                    onClick={handleRetry}
                    disabled={!state.path || state.isAdding}
                >
                    {state.isAdding
                        ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Adding...
                            </>
                        )
                        : (
                            "Retry"
                        )}
                </Button>
            </div>
        </div>
    );
};

export default ContextErrorHandler;
