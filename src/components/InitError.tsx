import { useProcessManager } from "@/hooks/useProcessManager";

// Example React component using the hook
interface InitializationErrorProps {
    error: string;
    onResolved?: () => void;
}

export function InitializationError({ error, onResolved }: InitializationErrorProps) {
    const { 
        killOtherInstances, 
        cleanupLocks, 
        isKilling, 
        isCleaning,
        lastResult 
    } = useProcessManager();

    const handleFixAttempt = async () => {
        try {
            const killResult = await killOtherInstances();
            if (killResult.killed_processes > 0 || !killResult.cleaned_locks) {
                await cleanupLocks();
            }
            
            if (onResolved) {
                onResolved();
            } else {
                window.location.reload();
            }
        } catch (e) {
            console.error('Failed to fix:', e);
        }
    }

    return (<div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded p-4">
                <div className="text-red-700 mb-2">Initialization Error</div>
                <div className="text-red-600 text-sm">{error}</div>
                {lastResult && (
                    <div className="mt-2 text-sm text-gray-600">
                        {lastResult.message}
                    </div>
                )}
            </div>
            
            <button
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 
                          disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleFixAttempt}
                disabled={isKilling || isCleaning}
            >
                {isKilling ? 'Killing Processes...' : 
                 isCleaning ? 'Cleaning Up...' : 
                 'Fix & Restart'}
            </button>
        </div>
    );
}