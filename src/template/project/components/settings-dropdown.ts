import * as vscode from "vscode";
import { Project } from '../../../extension';
import { getColorPickerHtml } from './color-picker';

async function handleDeleteProject(projectPath: string) {
    try {
        const configuration = vscode.workspace.getConfiguration('awesomeProjects');
        const projects = [...(configuration.get<Project[]>('projects') || [])];
        const projectIndex = projects.findIndex(p => p.path === projectPath);

        if (projectIndex !== -1) {
            projects.splice(projectIndex, 1);
            await configuration.update('projects', projects, vscode.ConfigurationTarget.Global);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete project: ${error}`);
    }
}

export async function getSettingsDropdownHtml(context: vscode.ExtensionContext, project: Project): Promise<string> {
    const defaultBgColor = "var(--vscode-list-activeSelectionBackground)";
    const bgColor = project.color || defaultBgColor;
    const projectColor: string | null = project.color ?? null;

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
        <div class="settings-dropdown" id="settings-${project.path.replace(/[^a-zA-Z0-9]/g, "-")}">

            <div class="card">
                ${getColorPickerHtml({
                    projectPath: project.path,
                    currentColor: projectColor,
                    defaultColor: bgColor
                })}
                ${basicInputs.map(input => `
                    <div class="settings-item">
                        <label>${input.label}</label>
                        <input type="${input.type}" placeholder="${input.placeholder}" value="${input.value}" oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                    </div>
                `).join('')}
            </div>

            <div class="settings-accordion">
                <button class="accordion-toggle" onclick="toggleUrlSettings(event)">
                    <svg class="chevron" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"/>
                    </svg>
                    URL Settings
                </button>
                <div class="accordion-content">
                    ${urlInputs.map(url => `
                        <div class="settings-item">
                            <label>${url.label}</label>
                            <input type="${url.type}" placeholder="${url.placeholder}" value="${url.value}" oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                        </div>
                    `).join('')}
                </div>
            </div>

            <button class="button small save-button" id="save-${project.path.replace(/[^a-zA-Z0-9]/g, "-")}" onclick="saveChanges('${project.path.replace(/'/g, "\\'")}')">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <path d="M8.56 3.69a9 9 0 0 0-2.92 1.95M3.69 8.56A9 9 0 0 0 3 12M3.69 15.44a9 9 0 0 0 1.95 2.92M8.56 20.31A9 9 0 0 0 12 21M15.44 20.31a9 9 0 0 0 2.92-1.95M20.31 15.44A9 9 0 0 0 21 12M20.31 8.56a9 9 0 0 0-1.95-2.92M15.44 3.69A9 9 0 0 0 12 3M9 12l2 2 4-4"/>
                </svg>
                Save
            </button>
            <button class="button small secondary remove" onclick="deleteProject('${project.path.replace(/'/g, "\\'")}')">
                <svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zM9 2H6v1h3V2zM4 13h7V4H4v9zm2-8H5v7h1V5zm1 0h1v7H7V5zm2 0h1v7H9V5z"/>
                </svg>
                Remove project
            </button>
        </div>

        <script>
            function handleInput(event, projectPath) {
                const labelMap = {
                    'production url': 'productionUrl',
                    'staging url': 'stagingUrl',
                    'development url': 'devUrl',
                    'management url': 'managementUrl',
                    'name': 'name',
                    'path': 'path'
                };

                const label = event.target.closest('.settings-item').querySelector('label').textContent.toLowerCase().replace(':', '');
                const field = labelMap[label] || label;
                const value = event.target.value;
                const oldValue = event.target.defaultValue;

                if (!pendingChanges[projectPath]) {
                    pendingChanges[projectPath] = {};
                }

                // Only save if the value has actually changed
                if (value !== oldValue) {
                    pendingChanges[projectPath][field] = value === '' ? null : value;
                } else {
                    delete pendingChanges[projectPath][field];
                }

                updateSaveButtonState(projectPath);
            }

            function updateSaveButtonState(projectPath) {
                const saveButton = document.getElementById('save-' + projectPath.replace(/[^a-zA-Z0-9]/g, '-'));
                if (saveButton) {
                    // Check if there are any changes
                    const hasChanges = pendingChanges[projectPath] && Object.keys(pendingChanges[projectPath]).length > 0;
                    saveButton.classList.toggle('show', hasChanges);
                    saveButton.disabled = !hasChanges;
                }
            }

            function deleteProject(projectPath) {
                vscode.postMessage({
                    command: 'deleteProject',
                    projectPath: projectPath
                });
            }

            function saveChanges(projectPath) {
                if (pendingChanges[projectPath]) {
                    vscode.postMessage({
                        command: 'updateProject',
                        projectPath: projectPath,
                        updates: pendingChanges[projectPath]
                    });

                    const settingsElement = document.getElementById('settings-' + projectPath.replace(/[^a-zA-Z0-9]/g, "-"));

                    if (settingsElement) {
                        Object.entries(pendingChanges[projectPath]).forEach(([field, value]) => {
                            const labelText = Object.entries(labelMap).find(([_, val]) => val === field)?.[0];
                            if (labelText) {
                                const inputs = settingsElement.querySelectorAll('input');
                                inputs.forEach(input => {
                                    const inputLabel = input.closest('.settings-item')?.querySelector('label')?.textContent.toLowerCase().replace(':', '');
                                    if (inputLabel === labelText) {
                                        input.defaultValue = value ?? '';
                                    }
                                });
                            }
                        });
                    }

                    delete pendingChanges[projectPath];
                    updateSaveButtonState(projectPath);
                }
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



