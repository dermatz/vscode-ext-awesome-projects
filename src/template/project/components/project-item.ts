import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Project } from '../../../extension';
import { getSettingsDropdownHtml } from './dropdowns/dropdownSettings';
import { getProjectInfoDropdownHtml } from './dropdowns/dropdownProjectInfo';
import { getProjectId } from '../utils/project-id';
import { escHtml, escOnclickArg } from '../../utils/escaping';

function findWorkspaceFile(projectPath: string): string | null {
    try {
        const entries = fs.readdirSync(projectPath);
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

    const isCurrentProject = currentWorkspace === project.path;
    const currentProjectClass = isCurrentProject ? 'current-project' : '';
    const missingClass = pathExists ? '' : 'missing';

    if (!pathExists) {
        const projectId = getProjectId(project);
        return `
        <div class="project-item-wrapper ${currentProjectClass} ${missingClass}" draggable="true" data-index="${index}" data-project-id="${projectId}">
            <div class="project-item" style="--bg-color: var(--vscode-inputValidation-errorBorder, #f44)">
                <span class="project-icon">⚠️</span>
                <div class="project-info">
                    <div class="project-name">${escHtml(project.name)}</div>
                    <div class="project-path missing-hint">Folder not found</div>
                </div>
                <div class="project-settings">
                    <button class="button mini relocate" onclick="window.vscodeApi.postMessage({ command: 'relocateProject', projectId: '${projectId}' })">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M3 7v13h18V7M3 7l9-4 9 4M9 21V11h6v10"/>
                        </svg>
                        Relocate
                    </button>
                    <button class="button mini remove" onclick="handleDeleteProject('${projectId}')">
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

    const baseUrl = useFavicons
        ? getBaseUrl(project.productionUrl) || getBaseUrl(project.stagingUrl) || getBaseUrl(project.devUrl) || getBaseUrl(project.managementUrl)
        : null;
    const faviconHtml = baseUrl && useFavicons ? `<img loading="lazy" src="https://www.google.com/s2/favicons?domain=${baseUrl}" onerror="this.parentElement.innerHTML='📁'">` : "📁";

    const workspaceFile = findWorkspaceFile(project.path) ?? undefined;
    const projectSettingsHtml = getSettingsDropdownHtml(context, project);
    const projectInfoHtml = await getProjectInfoDropdownHtml(project, bgColor, workspaceFile);

    return `
        <div class="project-item-wrapper ${currentProjectClass} ${missingClass}" draggable="true" data-index="${index}" data-project-id="${getProjectId(project)}"
        >
            <div class="project-item"
                style="--bg-color: ${bgColor}"
                onclick="toggleDropdown(event, '${getProjectId(project)}', 'info')"
            >
                <span class="project-icon">${faviconHtml}</span>
                <div class="project-info">
                    <div class="project-name">${escHtml(project.name)}</div>
                </div>
                <div class="project-settings">
                    <div class="quick-menu-wrapper">
                        <button class="button mini" onclick="toggleQuickMenu(event, '${getProjectId(project)}')" title="Open options">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="16" height="16">
                                <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                            </svg>
                        </button>
                        <div class="quick-menu" id="quick-menu-${getProjectId(project)}">
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
                            </button>
                            ${workspaceFile ? `
                            <button class="quick-menu-item" onclick="openWorkspace('${escOnclickArg(workspaceFile)}')">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                </svg>
                                Workspace
                            </button>` : ''}
                            <hr class="quick-menu-divider"/>
                            <button class="quick-menu-item" onclick="toggleDropdown(event, '${getProjectId(project)}', 'settings')">
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
