import * as vscode from 'vscode';
import { Project } from '../../../extension';
import { generateGradient, getContrastColor } from './colorpicker/colorPicker';
import { getSettingsDropdownHtml } from './dropdowns/dropdownSettings';
import { getProjectInfoDropdownHtml } from './dropdowns/dropdownProjectInfo';
import { getProjectId } from '../utils/project-id';

export interface ProjectItemProps {
    project: Project;
    index: number;
    useFavicons: boolean;
    currentWorkspace?: string;
}

export async function getProjectItemHtml(context: vscode.ExtensionContext, props: ProjectItemProps): Promise<string> {
    const { project, index, useFavicons, currentWorkspace } = props;
    const bgColor = project.color || "var(--vscode-list-activeSelectionBackground)";
    const gradientColor = project.color ? generateGradient(project.color) : "var(--vscode-list-activeSelectionBackground)";
    const textColor = project.color ? getContrastColor(project.color) : "#ffffff";

    const isCurrentProject = currentWorkspace === project.path;
    const currentProjectClass = isCurrentProject ? 'current-project' : '';

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

    const projectSettingsHtml = await getSettingsDropdownHtml(context, project);
    const projectInfoHtml = await getProjectInfoDropdownHtml(project, bgColor);

    return `
        <div class="project-item-wrapper ${currentProjectClass}" draggable="true" data-index="${index}" data-project-id="${getProjectId(project)}"
        >
            <div class="project-item"
                style="--bg-color: ${bgColor}; --bg-gradient: ${gradientColor}"
                onclick="toggleDropdown(event, '${getProjectId(project)}', 'info')"
            >
                <span class="project-icon">${faviconHtml}</span>
                <div class="project-info">
                    <div class="project-name" style="color: ${textColor}">${project.name}</div>
                </div>
                <div class="project-settings">
                    <button class="button mini" onclick="openProject('${project.path.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}')">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z"/>
                        </svg>
                        Open
                    </button>
                    <button class="button mini" onclick="toggleDropdown(event, '${getProjectId(project)}', 'settings')">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke="none" d="M0 0h24v24H0z"/>
                            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37 1 .608 2.296.07 2.572-1.065z"/>
                            <path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0"/>
                        </svg>
                        Edit
                    </button>
                </div>
            </div>
            ${projectInfoHtml}
            ${projectSettingsHtml}
        </div>
    `;
}
