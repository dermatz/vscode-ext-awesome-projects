import * as vscode from 'vscode';
import { Project } from './extension';

enum ProjectItemType {
    Header,
    Project,
    AddButton
}

/**
 * Represents an item in the project tree view.
 */
export class ProjectItem extends vscode.TreeItem {
    constructor(
        label: string,
        public readonly type: ProjectItemType,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly path?: string
    ) {
        super(label, collapsibleState);

        if (type === ProjectItemType.Header) {
            this.iconPath = new vscode.ThemeIcon('folder');
            this.contextValue = 'header';
            this.description = '';
            this.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor('charts.foreground'));
        } else if (type === ProjectItemType.AddButton) {
            this.iconPath = new vscode.ThemeIcon('add');
            this.contextValue = 'addButton';
            this.tooltip = 'Add a new project to this section';
            this.command = {
                command: 'awesome-projects.addProject',
                title: 'Add Project'
            };
        } else {
            this.contextValue = 'project';
            this.tooltip = path || label;
            this.description = path ? path.replace(process.env.HOME || '', '~') : '';
            this.command = {
                command: 'awesome-projects.openProject',
                title: 'Open Project',
                arguments: [label, path]
            };
        }
    }
}

/**
 * Provides data for the project tree view.
 */
export class ProjectProvider implements vscode.TreeDataProvider<ProjectItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | null | void> = new vscode.EventEmitter<ProjectItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() {}

    /**
     * Refreshes the project tree view.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Gets a tree item for the project tree view.
     * @param {ProjectItem} element - The project item.
     * @returns {vscode.TreeItem} - The tree item.
     */
    getTreeItem(element: ProjectItem): vscode.TreeItem {
        return element;
    }

    /**
     * Gets the children for a tree item in the project tree view.
     * @param {ProjectItem} [element] - The project item.
     * @returns {Promise<ProjectItem[]>} - The children of the project item.
     */
    async getChildren(element?: ProjectItem): Promise<ProjectItem[]> {
        if (element) {
            if (element.type === ProjectItemType.Header) {
                const configuration = vscode.workspace.getConfiguration('awesomeProjects');
                const projects = configuration.get<Project[]>('projects') || [];
                const projectItems = projects.map(project => new ProjectItem(
                    project.name,
                    ProjectItemType.Project,
                    vscode.TreeItemCollapsibleState.None,
                    project.path
                ));
                projectItems.push(new ProjectItem('Add Project...', ProjectItemType.AddButton, vscode.TreeItemCollapsibleState.None));
                return projectItems;
            }
            return [];
        } else {
            return [
                new ProjectItem('Projects', ProjectItemType.Header, vscode.TreeItemCollapsibleState.Expanded)
            ];
        }
    }
}
