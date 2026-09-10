import * as vscode from "vscode";
import { Project } from '../../../../extension';
import { getColorPickerHtml } from '../colorpicker/colorPicker';
import { getProjectId } from '../../utils/project-id';
import { getTablerIconSvg } from '../../utils/tablerIcons';
import { escAttr, escOnclickArg, sanitizeCssColor, escHtml } from '../../../utils/escaping';

interface SettingsInput {
    label: string;
    type: string;
    value: string;
    placeholder: string;
    field: string;
}

function buildProjectDetailsInputs(project: Project): SettingsInput[] {
    const isRemote = !!project.isRemote;
    return [
        { label: isRemote ? 'Remote URL:' : 'Local path:', type: 'text', value: escAttr(project.path), placeholder: isRemote ? 'https://github.com/owner/repo' : '~/path/to/your/project/', field: 'path' },
        { label: 'Repository URL:', type: 'url', value: escAttr(project.remoteUrl || ""), placeholder: 'https://github.com/owner/repo', field: 'remoteUrl' },
    ];
}

function buildUrlInputs(project: Project): SettingsInput[] {
    return [
        { label: 'Production URL:', type: 'url', value: escAttr(project.productionUrl || ""), placeholder: 'https://..', field: 'productionUrl' },
        { label: 'Staging URL:', type: 'url', value: escAttr(project.stagingUrl || ""), placeholder: 'https://..', field: 'stagingUrl' },
        { label: 'Local development URL:', type: 'url', value: escAttr(project.devUrl || ""), placeholder: 'https://..', field: 'devUrl' },
        { label: 'Management URL:', type: 'url', value: escAttr(project.managementUrl || ""), placeholder: 'https://..', field: 'managementUrl' },
    ];
}

function renderAccordionToggle(title: string): string {
    return `
        <button class="accordion-toggle" onclick="toggleAccordion(event)">
            <svg class="chevron" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"/>
            </svg>
            ${title}
        </button>
    `;
}

function renderConnectionAccordion(project: Project, escapedId: string, inputs: SettingsInput[]): string {
    return `
        <div class="settings-accordion">
            ${renderAccordionToggle('Connection')}
            <div class="accordion-content">
                <p>Configure how this project is opened and where its source lives.</p>
                ${inputs.map(input => `
                    <div class="settings-item">
                        <label>${input.label}</label>
                        <input type="${input.type}" placeholder="${input.placeholder}" value="${input.value}" data-field="${input.field}" data-initial-value="${input.value}" oninput="handleInput(event, '${escapedId}')">
                    </div>
                `).join('')}
                <div class="settings-item settings-item-checkbox">
                    <label class="checkbox-label">
                        <input type="checkbox" ${project.isRemote ? 'checked' : ''} data-field="isRemote" data-initial-value="${project.isRemote ? 'true' : 'false'}" onchange="handleInput(event, '${escapedId}')">
                        <span>Open as Remote Project</span>
                    </label>
                </div>
            </div>
        </div>
    `;
}

function getIconPreviewHtml(iconPreviewHtml: string): string {
    return iconPreviewHtml
        ? iconPreviewHtml.replace(/<span class="icon-preview">|<\/span>/g, '')
        : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 12h.01"/></svg>';
}

function renderAppearanceAccordion(
    project: Project,
    escapedId: string,
    projectId: string,
    projectColor: string | null,
    bgColor: string,
    iconPreviewHtml: string
): string {
    return `
        <div class="settings-accordion">
            ${renderAccordionToggle('Appearance')}
            <div class="accordion-content">
                <div class="settings-item appearance-section">
                    <label>Color:</label>
                    <p>Choose a color to colorize the project card.</p>
                    ${getColorPickerHtml({
                        projectId: projectId,
                        currentColor: projectColor,
                        defaultColor: bgColor
                    })}
                </div>
                <div class="settings-item appearance-section">
                    <label>Group:</label>
                    <p>Assign a group to organize projects in the sidebar.</p>
                    <input type="text" placeholder="e.g. Work or Personal" value="${escAttr(project.group || '')}" data-field="group" data-initial-value="${escAttr(project.group || '')}" oninput="handleInput(event, '${escapedId}')">
                </div>
                <div class="settings-item appearance-section">
                    <label>Icon:</label>
                    <p>Pick an icon from <button type="button" class="text-link" onclick="window.vscodeApi.postMessage({ command: 'openUrl', url: 'https://tabler.io/icons' })">Tabler Icons</button>. Add <code>-filled</code> for filled variants (e.g. <code>heart-filled</code>). You can also use an emoji.</p>
                    <p class="hint">Leave empty and add a Production URL or Icon URL to use the website's favicon automatically.</p>
                    <div class="icon-input-row">
                        <input type="text" placeholder="brand-github" value="${escAttr(project.icon || '')}" data-field="icon" data-initial-value="${escAttr(project.icon || '')}" oninput="handleIconInput(event, '${escapedId}')">
                        <span class="icon-preview" id="icon-preview-${projectId}">${getIconPreviewHtml(iconPreviewHtml)}</span>
                    </div>
                </div>
                <div class="settings-item appearance-section">
                    <label>Icon URL:</label>
                    <p>Provide a website URL to fetch its favicon automatically, or a direct URL to an image file. This overrides the favicon from the Production URL.</p>
                    <input type="url" placeholder="https://example.com or https://example.com/icon.png" value="${escAttr(project.iconUrl || '')}" data-field="iconUrl" data-initial-value="${escAttr(project.iconUrl || '')}" oninput="handleInput(event, '${escapedId}')">
                </div>
            </div>
        </div>
    `;
}

function renderQuickLinksAccordion(escapedId: string, urlInputs: SettingsInput[]): string {
    return `
        <div class="settings-accordion">
            ${renderAccordionToggle('Quick Links')}
            <div class="accordion-content">
                <p>These URLs will be displayed in the project overview and can be used to quickly navigate to the project websites.</p>
                ${urlInputs.map(url => `
                    <div class="settings-item">
                        <label>${url.label}</label>
                        <input type="${url.type}"
                               placeholder="${url.placeholder}"
                               value="${url.value}"
                               data-field="${url.field}"
                               data-initial-value="${url.value}"
                               oninput="handleInput(event, '${escapedId}')">
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderSettingsActions(projectId: string, escapedId: string): string {
    return `
        <div class="actions">
            <button class="button small save-button" id="save-${projectId}" onclick="saveChanges('${escapedId}')">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <path d="M8.56 3.69a9 9 0 0 0-2.92 1.95M3.69 8.56A9 9 0 0 0 3 12M3.69 15.44a9 9 0 0 0 1.95 2.92M8.56 20.31A9 9 0 0 0 12 21M15.44 20.31a9 9 0 0 0 2.92-1.95M20.31 15.44A9 9 0 0 0 21 12M20.31 8.56a9 9 0 0 0-1.95-2.92M15.44 3.69A9 9 0 0 0 12 3M9 12l2 2 4-4"/>
                </svg>
                Save
            </button>
            <button class="button small secondary remove" onclick="handleDeleteProject('${escapedId}')">
                <svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zM9 2H6v1h3V2zM4 13h7V4H4v9zm2-8H5v7h1V5zm1 0h1v7H7V5zm2 0h1v7H9V5z"/>
                </svg>
                Remove
            </button>
        </div>
    `;
}

export function getSettingsDropdownHtml(
    _context: vscode.ExtensionContext,
    project: Project
): string {
    const defaultBgColor = "var(--vscode-list-activeSelectionBackground)";
    const bgColor = project.color || defaultBgColor;
    const projectColor: string | null = project.color ?? null;
    const projectId = getProjectId(project);
    const escapedId = escOnclickArg(projectId);

    const iconPreviewSvg = project.icon ? getTablerIconSvg(_context, project.icon) : null;
    const iconPreviewHtml = iconPreviewSvg
        ? `<span class="icon-preview">${iconPreviewSvg}</span>`
        : (project.icon ? `<span class="icon-preview">${escHtml(project.icon)}</span>` : '');

    const projectDetailsInputs = buildProjectDetailsInputs(project);
    const urlInputs = buildUrlInputs(project);
    const safeBgColor = sanitizeCssColor(bgColor);

    return `
        <div class="dropdown settings-dropdown"
            style="border-left: 1px solid ${safeBgColor}; border-right: 1px solid ${safeBgColor}; border-bottom: 1px solid ${safeBgColor}; background: linear-gradient(0deg, color-mix(in srgb, ${safeBgColor} 10%, var(--vscode-editor-background)) 0%, color-mix(in srgb, var(--vscode-editor-background) 92%, transparent) 55%);"
            id="settings-${projectId}"
            data-settings-id="${projectId}">

            <div class="settings-fields">
                <div class="settings-item">
                    <label>Project name:</label>
                    <input type="text" placeholder="Projectname" value="${escAttr(project.name)}" data-field="name" data-initial-value="${escAttr(project.name)}" oninput="handleInput(event, '${escapedId}')">
                </div>
            </div>

            ${renderConnectionAccordion(project, escapedId, projectDetailsInputs)}
            ${renderAppearanceAccordion(project, escapedId, projectId, projectColor, bgColor, iconPreviewHtml)}
            ${renderQuickLinksAccordion(escapedId, urlInputs)}
            ${renderSettingsActions(projectId, escapedId)}
        </div>

    `;
}



