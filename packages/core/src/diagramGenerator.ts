import { ArchitectureAnalysis, Module, Relationship } from './types';

export class DiagramGenerator {
    /**
     * Generate a component diagram showing modules and relationships
     * Improved version with better organization and visual hierarchy
     */
    static generateComponentDiagram(analysis: ArchitectureAnalysis): string {
        const { modules, relationships, layers } = analysis;
        
        if (!modules || modules.length === 0) {
            return 'graph TD\n    NoData[No modules to display]';
        }

        // If layers exist and have modules, use layered diagram
        if (layers && layers.length > 0 && layers.some(l => l.modules && l.modules.length > 0)) {
            return this.generateLayeredDiagram(analysis);
        }

        const lines: string[] = ['flowchart TB'];
        
        // Improved style classes with better colors and contrast
        lines.push('    classDef component fill:#3B82F6,stroke:#1E40AF,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('    classDef service fill:#10B981,stroke:#047857,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('    classDef model fill:#F59E0B,stroke:#B45309,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('    classDef controller fill:#8B5CF6,stroke:#6D28D9,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('    classDef utility fill:#06B6D4,stroke:#0E7490,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('    classDef view fill:#EF4444,stroke:#B91C1C,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('    classDef config fill:#6B7280,stroke:#374151,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('    classDef other fill:#9CA3AF,stroke:#4B5563,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('');

        // Group modules by type for better organization
        const modulesByType = new Map<string, Module[]>();
        modules.forEach(m => {
            const type = m.type || 'other';
            if (!modulesByType.has(type)) {
                modulesByType.set(type, []);
            }
            modulesByType.get(type)!.push(m);
        });

        // Create nodes organized by type
        const nodeMap = new Map<string, string>();
        let nodeIdx = 0;
        
        // Create subgraphs for each type
        modulesByType.forEach((typeModules, type) => {
            if (typeModules.length > 1) {
                const subgraphId = type.charAt(0).toUpperCase() + type.slice(1);
                lines.push(`    subgraph ${subgraphId}["${subgraphId} Layer"]`);
                
                typeModules.forEach(m => {
                    const nodeId = `M${nodeIdx}`;
                    const displayName = this.formatModuleName(m.name || m.path.split('/').pop() || `Module${nodeIdx}`);
                    const shape = this.getNodeShape(m.type);
                    
                    lines.push(`        ${nodeId}${shape.start}"${displayName}"${shape.end}`);
                    nodeMap.set(m.path, nodeId);
                    
                    // Apply styling
                    const styleClass = m.type || 'other';
                    lines.push(`        class ${nodeId} ${styleClass}`);
                    
                    nodeIdx++;
                });
                
                lines.push('    end');
                lines.push('');
            } else {
                // Single module - add directly
                const m = typeModules[0];
                const nodeId = `M${nodeIdx}`;
                const displayName = this.formatModuleName(m.name || m.path.split('/').pop() || `Module${nodeIdx}`);
                const shape = this.getNodeShape(m.type);
                
                lines.push(`    ${nodeId}${shape.start}"${displayName}"${shape.end}`);
                nodeMap.set(m.path, nodeId);
                
                const styleClass = m.type || 'other';
                lines.push(`    class ${nodeId} ${styleClass}`);
                lines.push('');
                
                nodeIdx++;
            }
        });
        
        // Add relationships with better styling
        if (relationships && relationships.length > 0) {
            relationships.forEach(r => {
                const fromId = nodeMap.get(r.from);
                const toId = nodeMap.get(r.to);
                
                if (fromId && toId) {
                    const arrow = this.getArrowStyle(r.type);
                    const label = this.formatRelationshipLabel(r);
                    if (label) {
                        lines.push(`    ${fromId} ${arrow}|"${label}"| ${toId}`);
                    } else {
                        lines.push(`    ${fromId} ${arrow} ${toId}`);
                    }
                }
            });
        }
        
        return lines.join('\n');
    }
    
    private static formatModuleName(name: string): string {
        // Truncate long names and format nicely
        if (name.length > 25) {
            return name.substring(0, 22) + '...';
        }
        return name;
    }
    
    private static formatRelationshipLabel(r: Relationship): string {
        if (r.description && r.description.length < 30) {
            return r.description;
        }
        if (r.type && r.type !== 'depends') {
            return r.type;
        }
        return '';
    }

    /**
     * Generate a layered architecture diagram with improved visual hierarchy
     */
    static generateLayeredDiagram(analysis: ArchitectureAnalysis): string {
        const { layers, modules, relationships } = analysis;
        
        if (!layers || layers.length === 0) {
            return this.generateComponentDiagram(analysis);
        }

        const lines: string[] = ['flowchart TB'];
        
        // Improved style definitions with better colors
        lines.push('    classDef presentation fill:#EF4444,stroke:#B91C1C,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('    classDef business fill:#3B82F6,stroke:#1E40AF,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('    classDef data fill:#10B981,stroke:#047857,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('    classDef infrastructure fill:#F59E0B,stroke:#B45309,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('    classDef other fill:#6B7280,stroke:#4B5563,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('    classDef cache fill:#06B6D4,stroke:#0E7490,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('    classDef monitoring fill:#8B5CF6,stroke:#6D28D9,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('    classDef communication fill:#EC4899,stroke:#BE185D,stroke-width:2px,color:#fff,font-weight:500');
        lines.push('');

        // Create subgraphs for each layer with better organization
        const layerModuleMap = new Map<string, string>();
        
        layers.forEach((layer, layerIdx) => {
            const layerName = layer.name || `Layer ${layerIdx}`;
            const layerKey = layerName.toLowerCase().replace(/\s+/g, '');
            
            lines.push(`    subgraph L${layerIdx}["${layerName}"]`);
            
            if (layer.modules && layer.modules.length > 0) {
                layer.modules.forEach((modulePath, modIdx) => {
                    const module = modules.find(m => m.path === modulePath);
                    const nodeId = `L${layerIdx}_M${modIdx}`;
                    const displayName = this.formatModuleName(
                        module?.name || modulePath.split('/').pop() || `Module${modIdx}`
                    );
                    const shape = module ? this.getNodeShape(module.type) : { start: '[', end: ']' };
                    
                    lines.push(`        ${nodeId}${shape.start}"${displayName}"${shape.end}`);
                    layerModuleMap.set(modulePath, nodeId);
                    
                    // Apply layer-based styling
                    const layerStyle = this.getLayerStyleClass(layerName);
                    if (layerStyle) {
                        lines.push(`        class ${nodeId} ${layerStyle}`);
                    } else if (module?.type && module.type !== 'other') {
                        lines.push(`        class ${nodeId} ${module.type}`);
                    } else {
                        lines.push(`        class ${nodeId} other`);
                    }
                });
            } else {
                // Empty layer - add placeholder
                lines.push(`        Empty${layerIdx}["No modules"]:::other`);
            }
            
            lines.push('    end');
            lines.push('');
        });
        
        // Add cross-layer dependencies with better styling
        if (relationships && relationships.length > 0) {
            relationships.forEach(r => {
                const fromId = layerModuleMap.get(r.from);
                const toId = layerModuleMap.get(r.to);
                
                if (fromId && toId) {
                    const arrow = this.getArrowStyle(r.type);
                    const label = this.formatRelationshipLabel(r);
                    if (label) {
                        lines.push(`    ${fromId} ${arrow}|"${label}"| ${toId}`);
                    } else {
                        lines.push(`    ${fromId} ${arrow} ${toId}`);
                    }
                }
            });
        }
        
        return lines.join('\n');
    }
    
    private static getLayerStyleClass(layerName: string): string | null {
        const name = layerName.toLowerCase();
        if (name.includes('presentation') || name.includes('view') || name.includes('ui')) {
            return 'presentation';
        }
        if (name.includes('business') || name.includes('service') || name.includes('logic')) {
            return 'business';
        }
        if (name.includes('data') || name.includes('database') || name.includes('model')) {
            return 'data';
        }
        if (name.includes('infrastructure') || name.includes('infra')) {
            return 'infrastructure';
        }
        if (name.includes('cache')) {
            return 'cache';
        }
        if (name.includes('monitor') || name.includes('logging')) {
            return 'monitoring';
        }
        if (name.includes('communication') || name.includes('message') || name.includes('api')) {
            return 'communication';
        }
        return null;
    }

    /**
     * Generate a C4-style component diagram
     */
    static generateC4Diagram(analysis: ArchitectureAnalysis): string {
        const { modules, relationships, summary } = analysis;
        
        const lines: string[] = ['graph TB'];
        
        // Style definitions for C4 model
        lines.push('    classDef system fill:#1168bd,stroke:#0b4884,stroke-width:2px,color:#fff');
        lines.push('    classDef container fill:#438dd5,stroke:#2e6295,stroke-width:2px,color:#fff');
        lines.push('    classDef component fill:#85bbf0,stroke:#5d9cdb,stroke-width:2px,color:#fff');
        lines.push('');
        
        // Group modules by layer/type
        const coreModules = modules.filter(m => 
            analysis.coreComponents?.includes(m.path) || 
            analysis.entryPoints?.includes(m.path)
        );
        const supportModules = modules.filter(m => 
            !coreModules.includes(m)
        );
        
        // Core system
        if (coreModules.length > 0) {
            lines.push('    subgraph System["Core System"]');
            coreModules.forEach((m, idx) => {
                const nodeId = `Core${idx}`;
                lines.push(`        ${nodeId}["${m.name}"]:::system`);
            });
            lines.push('    end');
            lines.push('');
        }
        
        // Supporting components
        if (supportModules.length > 0) {
            lines.push('    subgraph Support["Supporting Components"]');
            supportModules.forEach((m, idx) => {
                const nodeId = `Sup${idx}`;
                const styleClass = m.type === 'service' ? 'container' : 'component';
                lines.push(`        ${nodeId}["${m.name}"]:::${styleClass}`);
            });
            lines.push('    end');
            lines.push('');
        }
        
        return lines.join('\n');
    }

    /**
     * Generate a flowchart showing the execution flow
     */
    static generateFlowDiagram(analysis: ArchitectureAnalysis): string {
        const { modules, relationships, entryPoints } = analysis;
        
        if (!entryPoints || entryPoints.length === 0) {
            return this.generateComponentDiagram(analysis);
        }

        const lines: string[] = ['graph TD'];
        lines.push('    Start([Start])');
        lines.push('');
        
        // Find entry point modules
        const entryModules = modules.filter(m => entryPoints.includes(m.path));
        
        entryModules.forEach((entry, idx) => {
            const nodeId = `Entry${idx}`;
            lines.push(`    Start --> ${nodeId}["${entry.name}"]`);
        });
        
        return lines.join('\n');
    }

    private static getNodeShape(type: Module['type']): { start: string; end: string } {
        switch (type) {
            case 'service':
                return { start: '[[', end: ']]' }; // Subprocess
            case 'model':
                return { start: '[(', end: ')]' }; // Database
            case 'controller':
                return { start: '[/', end: '/]' }; // Parallel
            case 'view':
                return { start: '([', end: '])' }; // Stadium
            case 'config':
                return { start: '{', end: '}' }; // Diamond
            default:
                return { start: '[', end: ']' }; // Rectangle
        }
    }

    private static getArrowStyle(type: Relationship['type']): string {
        switch (type) {
            case 'extends':
            case 'implements':
                return '--|>';
            case 'imports':
            case 'uses':
                return '-->';
            case 'calls':
                return '-.->';
            case 'aggregates':
                return '--o';
            case 'composes':
                return '==>';
            default:
                return '-->';
        }
    }
}
