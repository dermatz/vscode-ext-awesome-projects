import * as vscode from 'vscode';
import * as path from 'path';

enum ProjectItemType {
    Header,
    Project,
    AddButton
}

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
            // Style headers differently
            this.description = ''; // Optional description
            // Make text bold using ThemeIcon
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
            // Project styling
            this.contextValue = 'project';
            this.tooltip = path || label;
            this.description = path ? path.replace(process.env.HOME || '', '~') : '';

            // Use different icons based on project type (example)
            if (this.description?.includes('node_modules')) {
                this.iconPath = new vscode.ThemeIcon('nodejs');
            } else if (this.description?.includes('.git')) {
                this.iconPath = new vscode.ThemeIcon('git-branch');
            } else {
                this.iconPath = new vscode.ThemeIcon('folder-library');
            }

            this.command = {
                command: 'awesome-projects.openProject',
                title: 'Open Project',
                arguments: [label, path]
            };
        }
    }
}

export class ProjectProvider implements vscode.TreeDataProvider<ProjectItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | null | void> = new vscode.EventEmitter<ProjectItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ProjectItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ProjectItem): Thenable<ProjectItem[]> {
        if (element) {
            // Return children for a specific header
            switch(element.label) {
                case 'Recent Projects':
                    return Promise.resolve([
                        new ProjectItem(
                            'My Node Project',
                            ProjectItemType.Project,
                            vscode.TreeItemCollapsibleState.None,
                            '/Users/melle/projects/node-project'
                        ),
                        new ProjectItem(
                            'VS Code Extension',
                            ProjectItemType.Project,
                            vscode.TreeItemCollapsibleState.None,
                            '/Users/melle/projects/vscode-ext-awesome-projects'
                        ),
                        new ProjectItem('Add Project...', ProjectItemType.AddButton, vscode.TreeItemCollapsibleState.None),
                    ]);
                case 'Favorites':
                    return Promise.resolve([
                        new ProjectItem(
                            'Docker Project',
                            ProjectItemType.Project,
                            vscode.TreeItemCollapsibleState.None,
                            '/Users/melle/projects/docker-compose'
                        ),
                        new ProjectItem('Add Project...', ProjectItemType.AddButton, vscode.TreeItemCollapsibleState.None),
                    ]);
                default:
                    return Promise.resolve([]);
            }
        } else {
            // Return root items (headers)
            return Promise.resolve([
                new ProjectItem('Recent Projects', ProjectItemType.Header, vscode.TreeItemCollapsibleState.Expanded),
                new ProjectItem('Favorites', ProjectItemType.Header, vscode.TreeItemCollapsibleState.Expanded)
            ]);
        }
    }
}
