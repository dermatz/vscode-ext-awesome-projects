import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Project } from '../../extension';
import { getProjectItemHtml } from './components/project-item';
import { getAddToHtml } from './components/add-to';
import { getDropdownToggleScript } from './utils/dropdownUtils';
import { getDragDropScript } from './utils/dragAndDrop';
import { escHtml } from '../utils/escaping';

/**
 * Find the common root directory shared by all project paths.
 */
function findCommonRoot(paths: string[]): string {
    if (paths.length === 0) { return ''; }
    const dirParts = paths.map(p => path.dirname(p).split(path.sep));
    const first = dirParts[0];
    let commonLength = 0;
    for (let i = 0; i < first.length; i++) {
        if (dirParts.every(p => p[i] === first[i])) {
            commonLength = i + 1;
        } else {
            break;
        }
    }
    return first.slice(0, commonLength).join(path.sep);
}

/**
 * Infer a group name from the project path relative to the common root.
 * Returns the immediate parent folder name if the project is one level deeper
 * than the common root, otherwise undefined (= ungrouped).
 */
function inferGroup(projectPath: string, commonRoot: string): string | undefined {
    if (!commonRoot) { return undefined; }
    const relative = path.relative(commonRoot, projectPath);
    const parts = relative.split(path.sep);
    return parts.length > 1 ? parts[0] : undefined;
}

export async function getProjectListHtml(
    context: vscode.ExtensionContext,
    currentWorkspace: string = '',
    configuration?: vscode.WorkspaceConfiguration
): Promise<string> {
    const config = configuration || vscode.workspace.getConfiguration('awesomeProjects');
    const rawProjects = config.get<Project[]>('projects') || [];
    const useFavicons = config.get<boolean>('useFavicons') ?? true;
    const groupSortOrder = config.get<string>('groupSortOrder') ?? 'alphabetical';

    // Deduplicate by path: if the same path appears multiple times, keep the
    // entry that has an explicit group set (it contains more information).
    const seen = new Map<string, Project>();
    for (const project of rawProjects) {
        const existing = seen.get(project.path);
        if (!existing || (!existing.group && project.group)) {
            seen.set(project.path, project);
        }
    }
    const projects = Array.from(seen.values());

    // Check which paths still exist on disk (parallel)
    const existsMap = new Map<string, boolean>();
    await Promise.all(
        projects.map(async p => {
            try {
                await fs.promises.access(p.path);
                existsMap.set(p.path, true);
            } catch {
                existsMap.set(p.path, false);
            }
        })
    );

    const commonRoot = findCommonRoot(projects.map(p => p.path));

    const ungrouped: { project: Project; index: number }[] = [];
    const groupMap = new Map<string, { project: Project; index: number }[]>();

    projects.forEach((project, index) => {
        // Explicit group takes priority, then auto-infer from path structure
        const group = project.group?.trim() || inferGroup(project.path, commonRoot);
        if (group) {
            if (!groupMap.has(group)) {
                groupMap.set(group, []);
            }
            groupMap.get(group)!.push({ project, index });
        } else {
            ungrouped.push({ project, index });
        }
    });

    // Render ungrouped items
    const ungroupedHtml = (await Promise.all(
        ungrouped.map(({ project, index }) =>
            getProjectItemHtml(context, { project, index, useFavicons, currentWorkspace, pathExists: existsMap.get(project.path) ?? true })
        )
    )).join('');

    // Render grouped items with headers
    const groupEntries = Array.from(groupMap.entries());
    if (groupSortOrder === 'alphabetical') {
        groupEntries.sort(([a], [b]) => a.localeCompare(b));
    } else if (groupSortOrder === 'alphabetical-desc') {
        groupEntries.sort(([a], [b]) => b.localeCompare(a));
    }
    const groupedHtml = (await Promise.all(
        groupEntries.map(async ([group, items]) => {
            const itemsHtml = (await Promise.all(
                items.map(({ project, index }) =>
                    getProjectItemHtml(context, { project, index, useFavicons, currentWorkspace, pathExists: existsMap.get(project.path) ?? true })
                )
            )).join('');
            return `
                <div class="project-group" data-group="${escHtml(group)}">
                    <div class="project-group-header" onclick="toggleGroup(this)">
                        <svg class="group-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"/>
                        </svg>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span class="project-group-label">${escHtml(group)}</span>
                    </div>
                    <div class="project-group-items">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        })
    )).join('');

    return `
        <section id="a">
            <div id="projects-list" class="draggable-list">
                ${ungroupedHtml}
                ${groupedHtml}
            </div>
        </section>
        <section id="b">
            ${await getAddToHtml()}
        </section>

        <script>
            ${getDragDropScript()}
            ${getDropdownToggleScript()}

            // Group collapse/expand with persistence via vscodeApi state
            (function() {
                const api = window.vscodeApi || acquireVsCodeApi();
                if (!window.vscodeApi) { window.vscodeApi = api; }
                const state = api.getState() || {};
                const collapsed = state.collapsedGroups || {};

                function saveCollapsed() {
                    const current = api.getState() || {};
                    api.setState({ ...current, collapsedGroups: collapsed });
                }

                // Apply persisted state on load
                document.querySelectorAll('.project-group').forEach(function(group) {
                    const name = group.getAttribute('data-group');
                    if (collapsed[name]) {
                        group.classList.add('collapsed');
                    }
                });

                window.toggleGroup = function(header) {
                    const group = header.closest('.project-group');
                    const name = group.getAttribute('data-group');
                    const isCollapsed = group.classList.toggle('collapsed');
                    collapsed[name] = isCollapsed;
                    saveCollapsed();
                };
            })();
        </script>
    `;
}

