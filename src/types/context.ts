// src/types/context/index.ts

export interface ContextConfig {
    dbPath: string;
    maxFiles: number;
    maxEmbeddings: number;
    watchFiles?: boolean;
    chunkSize?: number;
    minChunkOverlap?: number;
}

export interface ContextInitializationResult {
    success: boolean;
    error?: string;
}

export enum SymbolKind {
    File = 'File',
    Class = 'Class',
    Interface = 'Interface',
    Function = 'Function',
    Method = 'Method',
    Variable = 'Variable',
    Import = 'Import'
}

export interface CodeLocation {
    file: string;
    startLine: number;
    endLine: number;
    startCol: number;
    endCol: number;
}

export interface CodeSymbol {
    name: string;
    kind: SymbolKind;
    location: CodeLocation;
    relatedSymbols: string[];
}

export interface ChunkInfo {
    content: string;
    startLine: number;
    endLine: number;
    filePath: string;
    symbolKind?: SymbolKind;
}

export interface QueryMetadata {
    timestamp: number;
    executionTimeMs: number;
    totalChunksSearched: number;
}

export interface QueryContext {
    chunks: ChunkInfo[];
    relevanceScore: number;
    sourceFile?: string;
    metadata: QueryMetadata;
}

export interface ContextFileMetadata {
    id: string;
    path: string;
    lastUpdated: number;
}

export interface ContextFile extends ContextFileMetadata {
    content: string;
    symbols: CodeSymbol[];
    imports: string[];
    dependencies: string[];
}

export interface ContextStats {
    totalFiles: number;
    activeFiles: number;
    totalSize: number;
}

export interface SearchOptions {
    limit?: number;
    minRelevance?: number;
    includeContent?: boolean;
}