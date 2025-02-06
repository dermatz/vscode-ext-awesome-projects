import { Project } from '../../../../extension';
import { getProjectId } from '../../utils/project-id';

export async function getProjectInfoDropdownHtml(project: Project, color?: string): Promise<string> {
    const getBaseUrl = (url?: string) => {
        if (!url) { return null; }
        try {
            const urlObj = new URL(url);
            return urlObj.protocol + "//" + urlObj.hostname;
        } catch (e) {
            return null;
        }
    };

    const projectId = getProjectId(project);
    const borderColor = color || "var(--vscode-list-activeSelectionBackground)";

    return `
        <div id="info-${projectId}"
             class="dropdown project-info-dropdown"
             style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; border-bottom: 1px solid ${borderColor};"
        >
            ${ project.productionUrl || project.devUrl || project.stagingUrl || project.managementUrl
                    ? `
            <div class="info-section">
                <div class="info-label">URLs</div>
                <div class="info-value">
                    ${
                        project.productionUrl
                            ? `
                        <a class="project-url" onclick="openUrl(event, '${project.productionUrl.replace(/'/g, "\\'")}')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9-3-9m-9 9a9 9 0 019-9"/>
                            </svg>
                            Production
                        </a>
                    `
                            : ""
                    }
                    ${
                        project.stagingUrl
                            ? `
                        <a class="project-url" onclick="openUrl(event, '${project.stagingUrl.replace(/'/g, "\\'")}')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                            </svg>
                            Staging
                        </a>
                    `
                            : ""
                    }
                    ${
                        project.devUrl
                            ? `
                        <a class="project-url" onclick="openUrl(event, '${project.devUrl.replace(/'/g, "\\'")}')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            Development
                        </a>
                    `
                            : ""
                    }
                    ${
                        project.managementUrl
                            ? `
                        <a class="project-url" onclick="openUrl(event, '${project.managementUrl.replace(/'/g, "\\'")}')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
                            </svg>
                            Management (Jira, Trello, etc.)
                        </a>
                    `
                            : ""
                    }
                </div>
            </div>
            `
                    : ""
            }
            <div class="info-actions">
                <button class="button info-action" onclick="openProject('${project.path.replace(/'/g, "\\'")}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z"/>
                    </svg>
                    Open Project
                </button>
                <button class="button show-in-file-manager" data-path="${project.path.replace(/'/g, "\\'")}" data-name="${project.name}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                    </svg>
                    Open Folder
                </button>
            </div>
        </div>
    `;
}
