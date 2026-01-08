export interface FileContext {
    path: string;
    content: string;
    language?: string;
    size?: number;
}

export interface Module {
    name: string;
    path: string;
    type: 'component' | 'service' | 'utility' | 'model' | 'controller' | 'view' | 'config' | 'test' | 'other';
    layer?: 'presentation' | 'business' | 'data' | 'infrastructure' | 'other';
    description?: string;
    exports?: string[];
    imports?: string[];
}

export interface Relationship {
    from: string;
    to: string;
    type: 'imports' | 'extends' | 'implements' | 'uses' | 'calls' | 'depends' | 'aggregates' | 'composes';
    strength?: 'weak' | 'medium' | 'strong';
    description?: string;
}

export interface ArchitecturalPattern {
    name: 'MVC' | 'Layered' | 'Microservices' | 'Event-Driven' | 'Client-Server' | 'Monolithic' | 'Unknown';
    confidence: number;
    description: string;
}

export interface ArchitectureAnalysis {
    modules: Module[];
    relationships: Relationship[];
    summary: string;
    pattern?: ArchitecturalPattern;
    layers?: {
        name: string;
        modules: string[];
    }[];
    entryPoints?: string[];
    coreComponents?: string[];
    raw?: string;
}

export interface ILogger {
    info(message: string): void;
    error(error: any): void;
}
