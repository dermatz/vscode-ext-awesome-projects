import * as vscode from "vscode";
import { Project } from '../../../extension';
import { getColorHandlingScript } from '../utils/colorHandling';

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

    const urls = [
        { label: 'Project name:', type: 'text', value: project.name, placeholder: 'Projectname', field: 'name' },
        { label: 'Local path:', type: 'text', value: project.path, placeholder: '~/path/to/your/project/', field: 'path' },
        { label: 'Production URL:', type: 'url', value: project.productionUrl || "", placeholder: 'https://..', field: 'productionUrl' },
        { label: 'Staging URL:', type: 'url', value: project.stagingUrl || "", placeholder: 'https://..', field: 'stagingUrl' },
        { label: 'Local development URL:', type: 'url', value: project.devUrl || "", placeholder: 'https://..', field: 'devUrl' },
        { label: 'Management URL (e.G. Jira, Trello ... ):', type: 'url', value: project.managementUrl || "", placeholder: 'https://..', field: 'managementUrl' },
    ];

    return `
        <div class="settings-dropdown" id="settings-${project.path.replace(/[^a-zA-Z0-9]/g, "-")}">

            <div class="settings-item">
                <label>Background:</label>
                <div class="color-container">
                    <input type="color"
                        class="project-color-input"
                        value="${project.color || bgColor}"
                        data-uses-theme-color="${!project.color}"
                        oninput="handleColorChange(event, '${project.path.replace(/'/g, "\\'")}')"
                        onchange="handleColorChange(event, '${project.path.replace(/'/g, "\\'")}')">
                    <button class="button small secondary" onclick="setRandomColor(event, '${project.path.replace(/'/g,"\\'")}')" style="display:flex; align-items:center; gap:4px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pointer-events="none">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 4l3 3l-3 3" /><path d="M18 20l3 -3l-3 -3" /><path d="M3 7h3a5 5 0 0 1 5 5a5 5 0 0 0 5 5h5" /><path d="M21 7h-5a4.978 4.978 0 0 0 -3 1m-4 8a4.984 4.984 0 0 1 -3 1h-3" />
                        </svg>
                        <span style="pointer-events: none">Randomize</span>
                    </button>
                    <button class="button small secondary" onclick="resetColor(event, '${project.path.replace(/'/g, "\\'")}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 1 1 0 8h-1" />
                        </svg>
                        Reset
                    </button>
                </div>
            </div>

            <div class="card">
            ${urls.map(url => `
                <div class="settings-item">
                    <label>${url.label}</label>
                    <input type="${url.type}" placeholder="${url.placeholder}" value="${url.value}" oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                </div>
            `).join('')}
            </div>

            <button class="save-button" id="save-${project.path.replace(/[^a-zA-Z0-9]/g, "-")}" onclick="saveChanges('${project.path.replace(/'/g, "\\'")}')">
                Save Changes
            </button>
            <span class="delete-link" onclick="deleteProject('${project.path.replace(/'/g, "\\'")}')">
                Remove project
                <svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zM9 2H6v1h3V2zM4 13h7V4H4v9zm2-8H5v7h1V5zm1 0h1v7H7V5zm2 0h1v7H9V5z"/>
                </svg>
            </span>
        </div>

        <script>
            ${getColorHandlingScript()}

            function handleInput(event, projectPath) {
                const labelMap = {
                    'production url': 'productionUrl',
                    'staging url': 'stagingUrl',
                    'development url': 'devUrl',
                    'management url': 'managementUrl',
                    'name': 'name',
                    'color': 'color',
                    'path': 'path'
                };

                const label = event.target.closest('.settings-item').querySelector('label').textContent.toLowerCase().replace(':', '');
                const field = labelMap[label] || label;
                let value = event.target.value;

                if (field === 'color') {
                    const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
                    if (!value.startsWith('#')) {
                        value = '#' + value;
                    }
                    if (!isValidHex.test(value)) {
                        return;
                    }
                    const projectItem = event.target.closest('.project-item-wrapper').querySelector('.project-item');
                    const gradientColor = generateGradient(value);
                    projectItem.style.setProperty('--bg-color', value);
                    projectItem.style.setProperty('--bg-gradient', gradientColor);
                }

                if (!pendingChanges[projectPath]) {
                    pendingChanges[projectPath] = {};
                }
                pendingChanges[projectPath][field] = value === '' ? null : value;

                const saveButton = document.getElementById('save-' + projectPath.replace(/[^a-zA-Z0-9]/g, '-'));
                if (saveButton) {
                    saveButton.classList.add('show');
                }
            }

            function resetColor(event, projectPath) {
                event.preventDefault();
                const colorInput = event.target.closest('.color-container').querySelector('input[type="color"]');
                const themeColor = getComputedStyle(document.documentElement)
                    .getPropertyValue('--vscode-list-activeSelectionBackground')
                    .trim();

                // Konvertiere RGB zu Hex wenn nötig
                let hexColor = themeColor;
                if (themeColor.startsWith('rgb')) {
                    const rgb = themeColor.match(/d+/g);
                    if (rgb && rgb.length === 3) {
                        hexColor = '#' + rgb.map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
                    }
                }

                colorInput.value = hexColor;
                colorInput.setAttribute('data-uses-theme-color', 'true');

                if (!pendingChanges[projectPath]) {
                    pendingChanges[projectPath] = {};
                }
                pendingChanges[projectPath]['color'] = null;

                const projectItem = event.target.closest('.project-item-wrapper').querySelector('.project-item');
                projectItem.style.setProperty('--bg-color', 'var(--vscode-list-activeSelectionBackground)');
                projectItem.style.setProperty('--bg-gradient', 'var(--vscode-list-activeSelectionBackground)');

                const saveButton = document.getElementById('save-' + projectPath.replace(/[^a-zA-Z0-9]/g, '-'));
                if (saveButton) {
                    saveButton.classList.add('show');
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
                    delete pendingChanges[projectPath];

                    const saveButton = document.getElementById('save-' + projectPath.replace(/[^a-zA-Z0-9]/g, '-'));
                    if (saveButton) {
                        saveButton.classList.remove('show');
                    }
                }
            }
        </script>
    `;
}



