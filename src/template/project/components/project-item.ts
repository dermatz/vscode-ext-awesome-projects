import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Project } from '../../../extension';
import { getSettingsDropdownHtml } from './dropdowns/dropdownSettings';
import { getProjectInfoDropdownHtml } from './dropdowns/dropdownProjectInfo';
import { getProjectId } from '../utils/project-id';
import { getTablerIconSvg } from '../utils/tablerIcons';
import { escHtml, escAttr, escOnclickArg, sanitizeCssColor } from '../../utils/escaping';

async function findWorkspaceFile(projectPath: string): Promise<string | null> {
    try {
        const entries = await fs.promises.readdir(projectPath);
        const wsFile = entries.find(e => e.endsWith('.code-workspace'));
        return wsFile ? path.join(projectPath, wsFile) : null;
    } catch {
        return null;
    }
}

interface ProjectItemProps {
    project: Project;
    index: number;
    useFavicons: boolean;
    currentWorkspace?: string;
    pathExists?: boolean;
}

export async function getProjectItemHtml(context: vscode.ExtensionContext, props: ProjectItemProps): Promise<string> {
    const { project, index, useFavicons, currentWorkspace, pathExists = true } = props;
    const bgColor = project.color || "var(--vscode-list-activeSelectionBackground)";

    const isRemote = !!project.isRemote;
    const isCurrentProject = currentWorkspace === project.path;
    const currentProjectClass = isCurrentProject ? 'current-project' : '';
    const missingClass = pathExists || isRemote ? '' : 'missing';

    if (!pathExists && !isRemote) {
        const projectId = getProjectId(project);
        return `
        <div class="project-item-wrapper ${currentProjectClass} ${missingClass}" draggable="true" data-index="${index}" data-project-id="${escAttr(projectId)}">
            <div class="project-item" style="--bg-color: var(--vscode-inputValidation-errorBorder, #f44)">
                <span class="project-icon">⚠️</span>
                <div class="project-info">
                    <div class="project-name">${escHtml(project.name)}</div>
                    <div class="project-path missing-hint">Folder not found</div>
                </div>
                <div class="project-settings">
                    <button class="button mini relocate" onclick="window.vscodeApi.postMessage({ command: 'relocateProject', projectId: '${escOnclickArg(projectId)}' })">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M3 7v13h18V7M3 7l9-4 9 4M9 21V11h6v10"/>
                        </svg>
                        Relocate
                    </button>
                    <button class="button mini remove" onclick="handleDeleteProject('${escOnclickArg(projectId)}')">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                        </svg>
                        Remove
                    </button>
                </div>
            </div>
        </div>
    `;
    }

    const getBaseUrl = (url?: string) => {
        if (!url) { return null; }
        try {
            const urlObj = new URL(url);
            return urlObj.protocol + "//" + urlObj.hostname;
        } catch (e) {
            return null;
        }
    };

    let iconHtml: string;
    if (project.icon) {
        const tablerIcon = getTablerIconSvg(context, project.icon);
        iconHtml = tablerIcon || escHtml(project.icon);
    } else {
        const baseUrl = useFavicons
            ? getBaseUrl(project.productionUrl) || getBaseUrl(project.stagingUrl) || getBaseUrl(project.devUrl) || getBaseUrl(project.managementUrl)
            : null;
        iconHtml = baseUrl && useFavicons
            ? `<img loading="lazy" src="https://www.google.com/s2/favicons?domain=${escAttr(baseUrl)}" onerror="this.parentElement.textContent='${isRemote ? '\u{1F310}' : '\u{1F4C1}'}'">`
            : (isRemote ? "🌐" : "📁");
    }

    const workspaceFile = isRemote ? undefined : (await findWorkspaceFile(project.path) ?? undefined);
    const projectSettingsHtml = getSettingsDropdownHtml(context, project);
    const projectInfoHtml = await getProjectInfoDropdownHtml(project, bgColor, workspaceFile);
    const projectId = getProjectId(project);

    const activeBadge = isCurrentProject ? '<span class="current-project-badge" title="Current workspace"></span>' : '';

    return `
        <div class="project-item-wrapper ${currentProjectClass} ${missingClass}" draggable="true" data-index="${index}" data-project-id="${escAttr(projectId)}"
        >
            <div class="project-item"
                style="--bg-color: ${sanitizeCssColor(bgColor)}"
                onclick="toggleDropdown(event, '${escOnclickArg(projectId)}', 'info')"
            >
                ${activeBadge}
                <span class="project-icon">${iconHtml}</span>
                <div class="project-info">
                    <div class="project-name"
                        onclick="if(event.detail>=2)event.stopPropagation()"
                        ondblclick="startInlineRename(event, '${escOnclickArg(projectId)}', '${escOnclickArg(project.name)}')"
                        title="Double-click to rename"
                    >${escHtml(project.name)}</div>
                </div>
                <div class="project-settings">
                    ${isRemote ? `
                    <button type="button" class="button mini quick-action-button" onclick="openRemoteProject('${escOnclickArg(project.remoteUrl!)}')" title="Open remote repository">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                            <path d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                    </button>` : `
                    <button type="button" class="button mini quick-action-button" onclick="openProject('${escOnclickArg(project.path)}')" title="Open project">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                            <path d="m5 3 14 9-14 9V3z"/>
                        </svg>
                    </button>
                    <button type="button" class="button mini quick-action-button" onclick="openProjectNewWindow('${escOnclickArg(project.path)}')" title="Open project in new window">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                            <path d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                    </button>`}
                    <div class="quick-menu-wrapper">
                        <button type="button" class="button mini quick-menu-toggle" onclick="toggleQuickMenu(event, '${escOnclickArg(projectId)}')" title="Project actions">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37 1 .608 2.296.07 2.572-1.065z"/>
                                <path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0"/>
                            </svg>
                        </button>
                        <div class="quick-menu" id="quick-menu-${escAttr(projectId)}">
                            ${isRemote ? `
                            <button class="quick-menu-item" onclick="openRemoteProject('${escOnclickArg(project.remoteUrl!)}')">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                                    <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                </svg>
                                Open Remote
                            </button>` : `
                            <button class="quick-menu-item" onclick="openProject('${escOnclickArg(project.path)}')">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                                    <path d="M5 3l14 9-14 9V3z"/>
                                </svg>
                                Open
                            </button>
                            <button class="quick-menu-item" onclick="openProjectNewWindow('${escOnclickArg(project.path)}')">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                                    <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                </svg>
                                New Window
                            </button>`}
                            ${!isRemote ? `
                            <button class="quick-menu-item" onclick="window.vscodeApi.postMessage({ command: 'showInFileManager', project: { path: '${escOnclickArg(project.path)}', name: '${escOnclickArg(project.name)}' } })">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                </svg>
                                Reveal in Explorer
                            </button>
                            <button class="quick-menu-item" onclick="window.vscodeApi.postMessage({ command: 'openInTerminal', projectPath: '${escOnclickArg(project.path)}' })">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                                    <path d="M4 17l6-6-6-6M12 19h8"/>
                                </svg>
                                Open in Terminal
                            </button>` : ''}
                            ${workspaceFile ? `
                            <button class="quick-menu-item" onclick="openWorkspace('${escOnclickArg(workspaceFile)}')">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                </svg>
                                Workspace
                            </button>` : ''}
                            <hr class="quick-menu-divider"/>
                            <button class="quick-menu-item" onclick="toggleDropdown(event, '${escOnclickArg(projectId)}', 'settings')">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke="none" d="M0 0h24v24H0z"/>
                                    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37 1 .608 2.296.07 2.572-1.065z"/>
                                    <path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0"/>
                                </svg>
                                Edit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            ${projectInfoHtml}
            ${projectSettingsHtml}
        </div>
    `;
}
