import * as vscode from 'vscode';
import { Project } from './types';
import { ProjectsWebviewProvider } from './webviewProvider';

export const Commands = {
    ADD_PROJECT: 'awesome-projects.addProject',
    OPEN_PROJECT: 'awesome-projects.openProject',
    REFRESH_PROJECTS: 'awesome-projects.refreshProjects',
    UPDATE_PROJECT: 'awesome-projects.updateProject'  // Add this line
};

export const registerCommands = (context: vscode.ExtensionContext, projectsProvider: ProjectsWebviewProvider): void => {
    context.subscriptions.push(
        vscode.commands.registerCommand(Commands.ADD_PROJECT, async () => {
            const folderUri = await vscode.window.showOpenDialog({
                canSelectFolders: true,
                canSelectMany: false
            });

            if (folderUri && folderUri[0]) {
                try {
                    const projectPath = folderUri[0].fsPath;
                    const configuration = vscode.workspace.getConfiguration('awesomeProjects');
                    const projects: Project[] = configuration.get('projects') || [];

                    // Check if project already exists
                    if (projects.some(p => p.path === projectPath)) {
                        throw new Error('Project with this path already exists');
                    }

                    const projectName = await vscode.window.showInputBox({
                        prompt: 'Enter project name',
                        value: projectPath.split('/').pop(),
                        validateInput: input => {
                            return input && input.trim().length > 0 ? null : 'Project name cannot be empty';
                        }
                    });

                    if (!projectName) {
                        throw new Error('Project name is required');
                    }

                    const newProject: Project = {
                        path: projectPath,
                        name: projectName
                    };

                    await configuration.update(
                        'projects',
                        [...projects, newProject],
                        vscode.ConfigurationTarget.Global
                    );

                    projectsProvider.refresh();
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error
                        ? error.message
                        : 'An unknown error occurred';
                    vscode.window.showErrorMessage(`Failed to add project: ${errorMessage}`);
                }
            }
        }),

        vscode.commands.registerCommand(Commands.OPEN_PROJECT, (projectName: string) => {
            vscode.window.showInformationMessage(`Opening project: ${projectName}`);
        }),

        vscode.commands.registerCommand(Commands.REFRESH_PROJECTS, () => {
            projectsProvider.refresh();
        }),

        // Add new command
        vscode.commands.registerCommand(Commands.UPDATE_PROJECT, async ({ projectId, updates }) => {
            try {
                const configuration = vscode.workspace.getConfiguration('awesomeProjects');
                const projects = [...(configuration.get<Project[]>('projects') || [])];
                const projectIndex = projects.findIndex(p => p.id === projectId);

                if (projectIndex !== -1) {
                    projects[projectIndex] = {
                        ...projects[projectIndex],
                        ...updates,
                    };

                    await configuration.update('projects', projects, vscode.ConfigurationTarget.Global);
                    projectsProvider.refresh();
                    return true;
                }
                return false;
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to update project: ${error}`);
                return false;
            }
        })
    );
};
