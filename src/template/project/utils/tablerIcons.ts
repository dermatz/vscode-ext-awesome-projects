import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { escAttr } from '../../utils/escaping';

export type IconVariant = 'outline' | 'filled';
export type IconNode = [string, Record<string, string>];

const nodesCache = new Map<string, Record<string, IconNode[]> | null>();

function loadIconNodes(context: vscode.ExtensionContext, variant: IconVariant): Record<string, IconNode[]> | null {
    const cacheKey = `${context.extensionPath}:${variant}`;
    if (nodesCache.has(cacheKey)) {
        return nodesCache.get(cacheKey)!;
    }

    try {
        const fileName = variant === 'filled' ? 'tabler-nodes-filled.json' : 'tabler-nodes-outline.json';
        const filePath = path.join(context.extensionPath, 'dist', fileName);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const nodes = JSON.parse(raw) as Record<string, IconNode[]>;
        nodesCache.set(cacheKey, nodes);
        return nodes;
    } catch (error) {
        console.error(`Failed to load Tabler icon nodes (${variant}):`, error);
        nodesCache.set(cacheKey, null);
        return null;
    }
}

function renderIconNodes(nodes: IconNode[]): string {
    return nodes.map(([tag, attributes]) => {
        const attributeString = Object.entries(attributes)
            .map(([key, value]) => `${key}="${escAttr(value)}"`)
            .join(' ');
        return attributeString ? `<${tag} ${attributeString}/>` : `<${tag}/>`;
    }).join('');
}

export function parseIconName(rawName: string): { name: string; variant: IconVariant } | null {
    let trimmed = rawName.trim();
    if (!trimmed) {
        return null;
    }

    const filledSuffix = '-filled';
    const isFilled = trimmed.toLowerCase().endsWith(filledSuffix);
    if (isFilled) {
        trimmed = trimmed.slice(0, -filledSuffix.length);
    }

    trimmed = trimmed
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();

    if (trimmed.startsWith('icon-')) {
        trimmed = trimmed.slice(5);
    } else if (trimmed.startsWith('ti-')) {
        trimmed = trimmed.slice(3);
    }

    if (!trimmed) {
        return null;
    }

    return { name: trimmed, variant: isFilled ? 'filled' : 'outline' };
}

export function getTablerIconSvg(context: vscode.ExtensionContext, iconName: string): string | null {
    const parsed = parseIconName(iconName);
    if (!parsed) {
        return null;
    }

    const { name, variant } = parsed;
    const nodesMap = loadIconNodes(context, variant);
    if (!nodesMap || !nodesMap[name]) {
        return null;
    }

    const isFilled = variant === 'filled';
    const fill = isFilled ? 'currentColor' : 'none';
    const stroke = isFilled ? 'none' : 'currentColor';
    const strokeWidth = isFilled ? '' : ' stroke-width="2"';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}"${strokeWidth} stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-${escAttr(name)}"><path stroke="none" d="M0 0h24v24H0z" fill="none"/>${renderIconNodes(nodesMap[name])}</svg>`;
}
