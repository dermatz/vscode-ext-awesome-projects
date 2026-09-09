import * as vscode from 'vscode';
import { Project } from '../../../extension';
import { getTablerIconSvg } from './tablerIcons';
import { escHtml, escAttr, safeUrl } from '../../utils/escaping';

export function getProjectIconHtml(context: vscode.ExtensionContext, project: Project, useFavicons: boolean): string {
    const isRemote = !!project.isRemote;

    const isAllowedIconProtocol = (protocol: string): boolean => protocol === 'http:' || protocol === 'https:';

    const getBaseUrl = (url?: string): string | null => {
        if (!url) { return null; }
        try {
            const urlObj = new URL(url);
            if (!isAllowedIconProtocol(urlObj.protocol)) {
                return null;
            }
            return urlObj.protocol + "//" + urlObj.hostname;
        } catch {
            return null;
        }
    };

    const isDirectIconUrl = (url?: string): boolean => {
        if (!url) { return false; }
        try {
            const parsed = new URL(url);
            if (!isAllowedIconProtocol(parsed.protocol)) {
                return false;
            }
            return /\.(ico|png|jpg|jpeg|svg|webp|gif|bmp)(\?.*)?$/i.test(parsed.pathname);
        } catch {
            return false;
        }
    };

    if (project.icon) {
        const tablerIcon = getTablerIconSvg(context, project.icon);
        return tablerIcon || escHtml(project.icon);
    }

    const iconUrl = useFavicons ? project.iconUrl : undefined;
    const baseUrl = useFavicons && !iconUrl
        ? getBaseUrl(project.productionUrl) || getBaseUrl(project.stagingUrl) || getBaseUrl(project.devUrl) || getBaseUrl(project.managementUrl)
        : null;
    const faviconUrl = iconUrl
        ? (isDirectIconUrl(iconUrl) ? safeUrl(iconUrl) : `https://www.google.com/s2/favicons?domain=${escAttr(getBaseUrl(iconUrl) || iconUrl)}`)
        : baseUrl && useFavicons
            ? `https://www.google.com/s2/favicons?domain=${escAttr(baseUrl)}`
            : null;

    if (faviconUrl) {
        return `<img loading="lazy" src="${faviconUrl}" onerror="this.parentElement.textContent='${isRemote ? '\u{1F310}' : '\u{1F4C1}'}'">`;
    }

    return isRemote ? '🌐' : '📁';
}
