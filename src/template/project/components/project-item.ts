import * as vscode from 'vscode';
import { Project } from '../../../extension';
import { generateGradient, getContrastColor } from './color-picker';
import { getSettingsDropdownHtml } from './settings-dropdown';
import { getProjectInfoDropdownHtml } from './dropdowns/dropdownProjectInfo';
import { getProjectId } from '../utils/project-id';

export interface ProjectItemProps {
    project: Project;
    index: number;
    useFavicons: boolean;
}

export async function getProjectItemHtml(context: vscode.ExtensionContext, props: ProjectItemProps): Promise<string> {
    const { project, index, useFavicons } = props;
    const bgColor = project.color || "var(--vscode-list-activeSelectionBackground)";
    const gradientColor = project.color ? generateGradient(project.color) : "var(--vscode-list-activeSelectionBackground)";
    const textColor = project.color ? getContrastColor(project.color) : "#ffffff";

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
    const faviconHtml = baseUrl && useFavicons ? `<img src="https://www.google.com/s2/favicons?domain=${baseUrl}" onerror="this.parentElement.innerHTML='📁'">` : "📁";

    const projectSettingsHtml = await getSettingsDropdownHtml(context, project);
    const projectInfoHtml = await getProjectInfoDropdownHtml(project, bgColor);

    return `
        <div class="project-item-wrapper" draggable="true" data-index="${index}" data-project-id="${getProjectId(project)}"
        >
            <div class="project-item"
                style="--bg-color: ${bgColor}; --bg-gradient: ${gradientColor}"
                onclick="toggleDropdown(event, '${getProjectId(project)}', 'info')"
            >
                <span class="project-icon">${faviconHtml}</span>
                <div class="project-info">
                    <div class="project-name" style="color: ${textColor}">${project.name}</div>
                </div>
                <div class="project-settings" onclick="toggleDropdown(event, '${getProjectId(project)}', 'settings')">
                    Edit
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" height="1rem" width="1rem" style="margin-left: 0.25rem" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                </div>
            </div>
            ${projectInfoHtml}
            ${projectSettingsHtml}
        </div>
    `;
}
