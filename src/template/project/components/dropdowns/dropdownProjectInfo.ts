import { Project } from '../../../../extension';
import { getProjectId } from '../../utils/project-id';
import { getGitRepositoriesHtml } from '../../utils/getGitRepositories';
import { safeUrl, escOnclickArg, escHtml } from '../../../utils/escaping';

export async function getProjectInfoDropdownHtml(project: Project, color?: string, workspaceFile?: string): Promise<string> {
    const projectId = getProjectId(project);
    const borderColor = color || "var(--vscode-list-activeSelectionBackground)";

    return `
        <div id="info-${projectId}"
             class="dropdown project-info-dropdown"
             style="border-left: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; border-bottom: 1px solid ${borderColor};"
        >
            <div class="info-header">
                <div class="info-header-meta">
                    <div class="info-header-name">${escHtml(project.name)}</div>
                    ${project.productionUrl ? `<a class="info-header-url" href="${safeUrl(project.productionUrl)}" target="_blank">${safeUrl(project.productionUrl).replace(/^https?:\/\//, '')}</a>` : ''}
                </div>
                <button class="info-close-button" onclick="toggleDropdown(event, '${projectId}', 'info')" title="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
                    </svg>
                </button>
            </div>

            ${ project.productionUrl || project.devUrl || project.stagingUrl || project.managementUrl
                    ? `
            <div class="info-section">
                <div class="info-label">URLs</div>
                <div class="info-value">
                    ${project.productionUrl ? `<a class="project-url" href="${safeUrl(project.productionUrl)}" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9-3-9m-9 9a9 9 0 019-9"/></svg>Production</a>` : ""}
                    ${project.stagingUrl ? `<a class="project-url" href="${safeUrl(project.stagingUrl)}" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>Staging</a>` : ""}
                    ${project.devUrl ? `<a class="project-url" href="${safeUrl(project.devUrl)}" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Development</a>` : ""}
                    ${project.managementUrl ? `<a class="project-url" href="${safeUrl(project.managementUrl)}" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>Management (Jira, Trello, etc.)</a>` : ""}
                </div>
            </div>`
            : ""
            }

            <div class="info-section">
                ${await getGitRepositoriesHtml(project)}
            </div>

            <div class="action-grid">
                <button class="action-card action-card-primary" onclick="openProject('${escOnclickArg(project.path)}')">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
                    </svg>
                    <span>Open</span>
                </button>
                <button class="action-card" onclick="openProjectNewWindow('${escOnclickArg(project.path)}')">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                    <span>New Window</span>
                </button>
                ${workspaceFile ? `
                <button class="action-card" onclick="openWorkspace('${escOnclickArg(workspaceFile)}')">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    <span>Workspace</span>
                </button>` : ''}
                <button class="action-card" onclick="toggleDropdown(event, '${projectId}', 'settings')">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37 1 .608 2.296.07 2.572-1.065z"/>
                        <path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0"/>
                    </svg>
                    <span>Settings</span>
                </button>
            </div>
        </div>
    `;
}
