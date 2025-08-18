import * as vscode from "vscode";
import { Project } from '../../../../extension';
import { getColorPickerHtml } from '../colorpicker/colorPicker';
import { getProjectId } from '../../utils/project-id';
import { getSaveFunctionsScript } from '../../utils/save-functions';

// Cache for configuration to avoid repeated calls
let _cachedConfiguration: vscode.WorkspaceConfiguration | undefined;
let _configurationLoaded = false;

function getCachedConfiguration(): vscode.WorkspaceConfiguration {
    if (!_configurationLoaded || !_cachedConfiguration) {
        _cachedConfiguration = vscode.workspace.getConfiguration('awesomeProjects');
        _configurationLoaded = true;
    }
    return _cachedConfiguration;
}

async function handleDeleteProject(projectId: string) {
    try {
        const configuration = getCachedConfiguration();
        const projects = [...(configuration.get<Project[]>('projects') || [])];
        const projectIndex = projects.findIndex(p => getProjectId(p) === projectId);

        if (projectIndex !== -1) {
            projects.splice(projectIndex, 1);
            await configuration.update('projects', projects, vscode.ConfigurationTarget.Global);
            // Invalidate cache after update
            _configurationLoaded = false;
            _cachedConfiguration = undefined;
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete project: ${error}`);
    }
}

export async function getSettingsDropdownHtml(context: vscode.ExtensionContext, project: Project): Promise<string> {
    const defaultBgColor = "var(--vscode-list-activeSelectionBackground)";
    const bgColor = project.color || defaultBgColor;
    const projectColor: string | null = project.color ?? null;
    const projectId = getProjectId(project);

    const basicInputs = [
        { label: 'Project name:', type: 'text', value: project.name, placeholder: 'Projectname', field: 'name' },
        { label: 'Local path:', type: 'text', value: project.path, placeholder: '~/path/to/your/project/', field: 'path' },
    ];

    const urlInputs = [
        { label: 'Production URL:', type: 'url', value: project.productionUrl || "", placeholder: 'https://..', field: 'productionUrl' },
        { label: 'Staging URL:', type: 'url', value: project.stagingUrl || "", placeholder: 'https://..', field: 'stagingUrl' },
        { label: 'Local development URL:', type: 'url', value: project.devUrl || "", placeholder: 'https://..', field: 'devUrl' },
        { label: 'Management URL:', type: 'url', value: project.managementUrl || "", placeholder: 'https://..', field: 'managementUrl' },
    ];

    return `
        <div class="dropdown settings-dropdown"
            style="border-left: 1px solid ${bgColor}; border-right: 1px solid ${bgColor}; border-bottom: 1px solid ${bgColor};"
            id="settings-${projectId}"
            data-settings-id="${projectId}">

            <div class="settings-accordion">
                <button class="accordion-toggle" onclick="toggleUrlSettings(event)">
                    <svg class="chevron" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"/>
                    </svg>
                    Project Settings
                </button>
                <div class="accordion-content">
                    <p>Choose a color to colorize the project card.</p>
                    ${basicInputs.map(input => `
                    <div class="settings-item">
                        <label>${input.label}</label>
                        <input type="${input.type}" placeholder="${input.placeholder}" value="${input.value}" data-field="${input.field}" oninput="handleInput(event, '${projectId}')">
                    </div>
                `).join('')}
                </div>
            </div>

            <div class="settings-accordion">
                <button class="accordion-toggle" onclick="toggleUrlSettings(event)">
                    <svg class="chevron" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"/>
                    </svg>
                    Color
                </button>
                <div class="accordion-content">
                    <p>Choose a color to colorize the project card.</p>
                    ${getColorPickerHtml({
                        projectPath: project.path,
                        projectId: projectId,  // Add this line
                        currentColor: projectColor,
                        defaultColor: bgColor
                    })}
                </div>
            </div>

            <div class="settings-accordion">
                <button class="accordion-toggle" onclick="toggleUrlSettings(event)">
                    <svg class="chevron" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"/>
                    </svg>
                    Quick Links
                </button>
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
                                   oninput="handleInput(event, '${projectId}')">
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="actions">
                <button class="button small save-button" id="save-${projectId}" onclick="saveChanges('${projectId}')">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke="none" d="M0 0h24v24H0z"/>
                        <path d="M8.56 3.69a9 9 0 0 0-2.92 1.95M3.69 8.56A9 9 0 0 0 3 12M3.69 15.44a9 9 0 0 0 1.95 2.92M8.56 20.31A9 9 0 0 0 12 21M15.44 20.31a9 9 0 0 0 2.92-1.95M20.31 15.44A9 9 0 0 0 21 12M20.31 8.56a9 9 0 0 0-1.95-2.92M15.44 3.69A9 9 0 0 0 12 3M9 12l2 2 4-4"/>
                    </svg>
                    Save
                </button>
                <button class="button small secondary remove" onclick="handleDeleteProject('${projectId}')">
                    <svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zM9 2H6v1h3V2zM4 13h7V4H4v9zm2-8H5v7h1V5zm1 0h1v7H7V5zm2 0h1v7H9V5z"/>
                    </svg>
                    Remove
                </button>
            </div>
        </div>

        <script>
            ${getSaveFunctionsScript()}

            function handleInput(event, projectId) {
                const input = event.target;
                const field = input.dataset.field;
                const value = input.value;
                const initialValue = input.dataset.initialValue || '';

                if (!pendingChanges[projectId]) {
                    pendingChanges[projectId] = {};
                }

                if (value !== initialValue) {
                    pendingChanges[projectId][field] = value || null;
                } else {
                    delete pendingChanges[projectId][field];
                }

                updateSaveButtonState(projectId);
            }

            function refreshInputStates(settingsElement) {
                const inputs = settingsElement.querySelectorAll('input');
                inputs.forEach(input => {
                    input.defaultValue = input.value;
                    input.dataset.initialValue = input.value;
                });
            }

            function saveChanges(projectId) {
                if (window.pendingChanges[projectId]) {
                    window.vscodeApi.postMessage({
                        command: 'updateProject',
                        projectId: projectId,
                        updates: window.pendingChanges[projectId]
                    });

                    const settingsElement = document.getElementById('settings-' + projectId);
                    if (settingsElement) {
                        Object.entries(pendingChanges[projectId]).forEach(([field, value]) => {
                            const input = settingsElement.querySelector('input[data-field="' + field + '"]');
                            if (input) {
                                input.value = value ?? '';
                            }
                        });
                        refreshInputStates(settingsElement);
                    }

                    delete pendingChanges[projectId];
                    updateSaveButtonState(projectId);
                }
            }

            function handleDeleteProject(projectId) {
                if (!projectId) return;

                window.vscodeApi.postMessage({
                    command: 'deleteProject',
                    projectId: projectId
                });
            }

            function toggleUrlSettings(event) {
                const button = event.currentTarget;
                const content = button.nextElementSibling;
                const isExpanded = button.classList.contains('expanded');

                button.classList.toggle('expanded');
                content.style.maxHeight = isExpanded ? '0' : content.scrollHeight + 'px';
            }
        </script>
    `;
}



