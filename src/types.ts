export interface FileContext {
    path: string;
    content: string;
}

export interface ArchitectureAnalysis {
    modules: string[];
    relationships: { from: string; to: string; type: string }[];
    summary: string;
    raw?: string;
}

export interface ILogger {
    info(message: string): void;
    error(error: any): void;
}
