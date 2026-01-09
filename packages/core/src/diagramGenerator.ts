import { ArchitectureAnalysis, Module, Relationship } from './types';

export class DiagramGenerator {
    /**
     * Generate a component diagram showing modules and relationships
     * Enhanced version with better organization, visual hierarchy, and informative labels
     */
    static generateComponentDiagram(analysis: ArchitectureAnalysis): string {
        const { modules, relationships, layers, entryPoints, coreComponents } = analysis;
        
        if (!modules || modules.length === 0) {
            return 'graph TD\n    NoData[No modules to display]';
        }

        // If layers exist and have modules, use layered diagram
        if (layers && layers.length > 0 && layers.some(l => l.modules && l.modules.length > 0)) {
            return this.generateLayeredDiagram(analysis);
        }

        const lines: string[] = ['flowchart TB'];
        
        // Enhanced style classes with better visual distinction
        lines.push('    classDef component fill:#3B82F6,stroke:#1E40AF,stroke-width:3px,color:#fff,font-weight:600,font-size:13px');
        lines.push('    classDef service fill:#10B981,stroke:#047857,stroke-width:3px,color:#fff,font-weight:600,font-size:13px');
        lines.push('    classDef model fill:#F59E0B,stroke:#B45309,stroke-width:3px,color:#fff,font-weight:600,font-size:13px');
        lines.push('    classDef controller fill:#8B5CF6,stroke:#6D28D9,stroke-width:3px,color:#fff,font-weight:600,font-size:13px');
        lines.push('    classDef utility fill:#06B6D4,stroke:#0E7490,stroke-width:3px,color:#fff,font-weight:600,font-size:13px');
        lines.push('    classDef view fill:#EF4444,stroke:#B91C1C,stroke-width:3px,color:#fff,font-weight:600,font-size:13px');
        lines.push('    classDef config fill:#6B7280,stroke:#374151,stroke-width:3px,color:#fff,font-weight:600,font-size:13px');
        lines.push('    classDef other fill:#9CA3AF,stroke:#4B5563,stroke-width:2px,color:#fff,font-weight:500,font-size:12px');
        lines.push('    classDef entry fill:#F59E0B,stroke:#B45309,stroke-width:4px,color:#fff,font-weight:700,font-size:14px');
        lines.push('    classDef core fill:#8B5CF6,stroke:#6D28D9,stroke-width:4px,color:#fff,font-weight:700,font-size:14px');
        lines.push('');

        // Identify entry points and core components
        const entryPointPaths = new Set(entryPoints || []);
        const coreComponentPaths = new Set(coreComponents || []);

        // Group modules by type for better organization
        const modulesByType = new Map<string, Module[]>();
        modules.forEach(m => {
            const type = m.type || 'other';
            if (!modulesByType.has(type)) {
                modulesByType.set(type, []);
            }
            modulesByType.get(type)!.push(m);
        });

        // Create nodes organized by type with enhanced labels
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
                    const nodeLabel = this.createEnhancedNodeLabel(m, entryPointPaths.has(m.path), coreComponentPaths.has(m.path));
                    
                    lines.push(`        ${nodeId}${shape.start}"${nodeLabel}"${shape.end}`);
                    nodeMap.set(m.path, nodeId);
                    
                    // Apply enhanced styling
                    let styleClass: string = m.type || 'other';
                    if (entryPointPaths.has(m.path)) {
                        styleClass = 'entry';
                    } else if (coreComponentPaths.has(m.path)) {
                        styleClass = 'core';
                    }
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
                const nodeLabel = this.createEnhancedNodeLabel(m, entryPointPaths.has(m.path), coreComponentPaths.has(m.path));
                
                lines.push(`    ${nodeId}${shape.start}"${nodeLabel}"${shape.end}`);
                nodeMap.set(m.path, nodeId);
                
                let styleClass: string = m.type || 'other';
                if (entryPointPaths.has(m.path)) {
                    styleClass = 'entry';
                } else if (coreComponentPaths.has(m.path)) {
                    styleClass = 'core';
                }
                lines.push(`    class ${nodeId} ${styleClass}`);
                lines.push('');
                
                nodeIdx++;
            }
        });
        
        // Add relationships with enhanced styling and strength indicators
        if (relationships && relationships.length > 0) {
            relationships.forEach(r => {
                const fromId = nodeMap.get(r.from);
                const toId = nodeMap.get(r.to);
                
                if (fromId && toId) {
                    const arrow = this.getArrowStyle(r.type, r.strength);
                    const label = this.formatRelationshipLabel(r);
                    
                    // Use different arrow styles for strength
                    let finalArrow = arrow;
                    if (r.strength === 'strong') {
                        finalArrow = arrow.replace('-->', '==>').replace('--|>', '==|>').replace('-.->', '==>');
                    } else if (r.strength === 'weak') {
                        finalArrow = arrow.replace('-->', '-.->').replace('--|>', '-.|>');
                    }
                    
                    if (label) {
                        lines.push(`    ${fromId} ${finalArrow}|"${label}"| ${toId}`);
                    } else {
                        lines.push(`    ${fromId} ${finalArrow} ${toId}`);
                    }
                }
            });
        }
        
        return lines.join('\n');
    }
    
    private static createEnhancedNodeLabel(module: Module, isEntryPoint: boolean, isCore: boolean): string {
        let label = module.name || module.path.split('/').pop() || 'Unknown';
        
        // Add type indicator
        if (module.type && module.type !== 'other') {
            label += `\n<small>${module.type}</small>`;
        }
        
        // Add entry point indicator
        if (isEntryPoint) {
            label = `🚀 ${label}`;
        } else if (isCore) {
            label = `⭐ ${label}`;
        }
        
        return label;
    }
    
    
    private static formatModuleName(name: string): string {
        // Truncate long names and format nicely
        if (name.length > 30) {
            return name.substring(0, 27) + '...';
        }
        return name;
    }
    
    private static formatRelationshipLabel(r: Relationship): string {
        // Prioritize description if available and concise
        if (r.description && r.description.length < 25) {
            return r.description;
        }
        // Use type if meaningful
        if (r.type && r.type !== 'depends' && r.type !== 'uses') {
            return r.type;
        }
        // Show strength if available
        if (r.strength && r.strength !== 'medium') {
            return r.strength;
        }
        return '';
    }

    /**
     * Generate a layered architecture diagram with enhanced visual hierarchy and information
     */
    static generateLayeredDiagram(analysis: ArchitectureAnalysis): string {
        const { layers, modules, relationships, entryPoints, coreComponents } = analysis;
        
        if (!layers || layers.length === 0) {
            return this.generateComponentDiagram(analysis);
        }

        const lines: string[] = ['flowchart TB'];
        
        // Enhanced style definitions with better visual distinction
        lines.push('    classDef presentation fill:#EF4444,stroke:#B91C1C,stroke-width:3px,color:#fff,font-weight:600,font-size:13px');
        lines.push('    classDef business fill:#3B82F6,stroke:#1E40AF,stroke-width:3px,color:#fff,font-weight:600,font-size:13px');
        lines.push('    classDef data fill:#10B981,stroke:#047857,stroke-width:3px,color:#fff,font-weight:600,font-size:13px');
        lines.push('    classDef infrastructure fill:#F59E0B,stroke:#B45309,stroke-width:3px,color:#fff,font-weight:600,font-size:13px');
        lines.push('    classDef other fill:#6B7280,stroke:#4B5563,stroke-width:2px,color:#fff,font-weight:500,font-size:12px');
        lines.push('    classDef cache fill:#06B6D4,stroke:#0E7490,stroke-width:3px,color:#fff,font-weight:600,font-size:13px');
        lines.push('    classDef monitoring fill:#8B5CF6,stroke:#6D28D9,stroke-width:3px,color:#fff,font-weight:600,font-size:13px');
        lines.push('    classDef communication fill:#EC4899,stroke:#BE185D,stroke-width:3px,color:#fff,font-weight:600,font-size:13px');
        lines.push('    classDef entry fill:#F59E0B,stroke:#B45309,stroke-width:4px,color:#fff,font-weight:700,font-size:14px');
        lines.push('    classDef core fill:#8B5CF6,stroke:#6D28D9,stroke-width:4px,color:#fff,font-weight:700,font-size:14px');
        lines.push('');

        // Identify entry points and core components
        const entryPointPaths = new Set(entryPoints || []);
        const coreComponentPaths = new Set(coreComponents || []);

        // Create subgraphs for each layer with enhanced organization
        const layerModuleMap = new Map<string, string>();
        
        layers.forEach((layer, layerIdx) => {
            const layerName = layer.name || `Layer ${layerIdx}`;
            const moduleCount = layer.modules?.length || 0;
            const layerTitle = `${layerName} (${moduleCount})`;
            
            lines.push(`    subgraph L${layerIdx}["${layerTitle}"]`);
            
            if (layer.modules && layer.modules.length > 0) {
                layer.modules.forEach((modulePath, modIdx) => {
                    const module = modules.find(m => m.path === modulePath);
                    const nodeId = `L${layerIdx}_M${modIdx}`;
                    const nodeLabel = this.createEnhancedNodeLabel(
                        module || { name: modulePath.split('/').pop() || `Module${modIdx}`, path: modulePath, type: 'other' },
                        entryPointPaths.has(modulePath),
                        coreComponentPaths.has(modulePath)
                    );
                    const shape = module ? this.getNodeShape(module.type) : { start: '[', end: ']' };
                    
                    lines.push(`        ${nodeId}${shape.start}"${nodeLabel}"${shape.end}`);
                    layerModuleMap.set(modulePath, nodeId);
                    
                    // Apply enhanced layer-based styling
                    let styleClass: string = 'other';
                    if (entryPointPaths.has(modulePath)) {
                        styleClass = 'entry';
                    } else if (coreComponentPaths.has(modulePath)) {
                        styleClass = 'core';
                    } else {
                        const layerStyle = this.getLayerStyleClass(layerName);
                        if (layerStyle) {
                            styleClass = layerStyle;
                        } else if (module?.type && module.type !== 'other') {
                            styleClass = module.type;
                        }
                    }
                    lines.push(`        class ${nodeId} ${styleClass}`);
                });
            } else {
                // Empty layer - add informative placeholder
                lines.push(`        Empty${layerIdx}["No modules in this layer"]:::other`);
            }
            
            lines.push('    end');
            lines.push('');
        });
        
        // Add cross-layer dependencies with enhanced styling and strength indicators
        if (relationships && relationships.length > 0) {
            relationships.forEach(r => {
                const fromId = layerModuleMap.get(r.from);
                const toId = layerModuleMap.get(r.to);
                
                if (fromId && toId) {
                    const arrow = this.getArrowStyle(r.type, r.strength);
                    const label = this.formatRelationshipLabel(r);
                    
                    // Use different arrow styles for strength
                    let finalArrow = arrow;
                    if (r.strength === 'strong') {
                        finalArrow = arrow.replace('-->', '==>').replace('--|>', '==|>').replace('-.->', '==>');
                    } else if (r.strength === 'weak') {
                        finalArrow = arrow.replace('-->', '-.->').replace('--|>', '-.|>');
                    }
                    
                    if (label) {
                        lines.push(`    ${fromId} ${finalArrow}|"${label}"| ${toId}`);
                    } else {
                        lines.push(`    ${fromId} ${finalArrow} ${toId}`);
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

    private static getArrowStyle(type: Relationship['type'], strength?: string): string {
        // Base arrow style
        let arrow: string;
        switch (type) {
            case 'extends':
            case 'implements':
                arrow = '--|>';
                break;
            case 'imports':
            case 'uses':
                arrow = '-->';
                break;
            case 'calls':
                arrow = '-.->';
                break;
            case 'aggregates':
                arrow = '--o';
                break;
            case 'composes':
                arrow = '==>';
                break;
            case 'depends':
                arrow = '-.->';
                break;
            default:
                arrow = '-->';
        }
        
        return arrow;
    }
}
