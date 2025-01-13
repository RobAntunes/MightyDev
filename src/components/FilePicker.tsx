import React, { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import {open} from '@tauri-apps/plugin-dialog';

interface FolderPickerProps {
    onFolderSelect: (path: string) => void;
    className?: string;
}

const FolderPicker: React.FC<FolderPickerProps> = ({ onFolderSelect, className = '' }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleOpenFolder = async () => {
        try {
            setIsLoading(true);
            // Open native folder picker dialog
            const selected = await open({multiple: false, directory: true});
            if (selected && typeof selected === 'string') {
                onFolderSelect(selected);
            }
        } catch (error) {
            console.error('Error opening folder:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleOpenFolder}
            disabled={isLoading}
            className={`
        flex items-center gap-2 px-4 py-2 
        bg-zinc-800 hover:bg-zinc-700 
        rounded-lg transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
        >
            <FolderOpen className="w-4 h-4 text-lime-400" />
            <span className="text-sm font-light text-zinc-300">
                {isLoading ? 'Opening...' : 'Open Folder'}
            </span>
        </button>
    );
};

export default FolderPicker;