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
 * Infer the full group path from the project path relative to the common root.
 * Returns an array of folder names representing each level of nesting, e.g.
 * ['github', 'customer1'] for a project two directories below the common root.
 */
function inferGroupPath(projectPath: string, commonRoot: string): string[] {
    if (!commonRoot) { return []; }
    const relative = path.relative(commonRoot, projectPath);
    const parts = relative.split(path.sep);
    // All parts except the last one (the project directory itself)
    return parts.length > 1 ? parts.slice(0, -1) : [];
}

/** Node in the recursive group tree. */
interface GroupTreeNode {
    children: Map<string, GroupTreeNode>;
    items: { project: Project; index: number }[];
}

/** Return the children of a group node in the requested sort order. */
function getSortedGroupChildren(node: GroupTreeNode, sortOrder: string): [string, GroupTreeNode][] {
    const entries = Array.from(node.children.entries());
    if (sortOrder === 'alphabetical') {
        entries.sort(([a], [b]) => a.localeCompare(b));
    } else if (sortOrder === 'alphabetical-desc') {
        entries.sort(([a], [b]) => b.localeCompare(a));
    }
    return entries;
}

/** Recursively render a single group node and all its nested children. */
async function renderGroupNode(
    name: string,
    groupKey: string,
    node: GroupTreeNode,
    context: vscode.ExtensionContext,
    useFavicons: boolean,
    currentWorkspace: string,
    existsMap: Map<string, boolean>,
    groupSortOrder: string
): Promise<string> {
    const itemsHtml = (await Promise.all(
        node.items.map(({ project, index }) =>
            getProjectItemHtml(context, { project, index, useFavicons, currentWorkspace, pathExists: existsMap.get(project.path) ?? true })
        )
    )).join('');

    const childrenHtml = (await Promise.all(
        getSortedGroupChildren(node, groupSortOrder).map(([childName, childNode]) =>
            renderGroupNode(
                childName,
                `${groupKey}/${childName}`,
                childNode,
                context,
                useFavicons,
                currentWorkspace,
                existsMap,
                groupSortOrder
            )
        )
    )).join('');

    return `
                <div class="project-group" data-group="${escHtml(groupKey)}">
                    <div class="project-group-header" onclick="toggleGroup(this)">
                        <svg class="group-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"/>
                        </svg>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span class="project-group-label">${escHtml(name)}</span>
                    </div>
                    <div class="project-group-items">
                        ${childrenHtml}
                        ${itemsHtml}
                    </div>
                </div>
            `;
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

    // Build a nested group tree.
    // Explicit group field → single flat level; path-based inference → multi-level.
    const rootNode: GroupTreeNode = { children: new Map(), items: [] };
    projects.forEach((project, index) => {
        const explicitGroup = project.group?.trim();
        const groupParts = explicitGroup
            ? [explicitGroup]
            : inferGroupPath(project.path, commonRoot);

        let node = rootNode;
        for (const part of groupParts) {
            if (!node.children.has(part)) {
                node.children.set(part, { children: new Map(), items: [] });
            }
            node = node.children.get(part)!;
        }
        node.items.push({ project, index });
    });

    // Render ungrouped items (items at the root of the tree)
    const ungroupedHtml = (await Promise.all(
        rootNode.items.map(({ project, index }) =>
            getProjectItemHtml(context, { project, index, useFavicons, currentWorkspace, pathExists: existsMap.get(project.path) ?? true })
        )
    )).join('');

    // Render top-level groups (and their nested children) recursively
    const groupedHtml = (await Promise.all(
        getSortedGroupChildren(rootNode, groupSortOrder).map(([name, node]) =>
            renderGroupNode(name, name, node, context, useFavicons, currentWorkspace, existsMap, groupSortOrder)
        )
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

