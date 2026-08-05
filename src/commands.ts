import * as vscode from 'vscode';
import { Project } from './extension';
import { ProjectsWebviewProvider } from './webviewProvider';
import { getProjectId } from './template/project/utils/project-id';

export const Commands = {
    ADD_PROJECT: 'awesome-projects.addProject',
    ADD_REMOTE_PROJECT: 'awesome-projects.addRemoteProject',
    OPEN_PROJECT: 'awesome-projects.openProject',
    REFRESH_PROJECTS: 'awesome-projects.refreshProjects',
    UPDATE_PROJECT: 'awesome-projects.updateProject',
    DELETE_PROJECT: 'awesome-projects.deleteProject'
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
                    const configuration = projectsProvider.getCachedConfiguration();
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
                        id: getProjectId({ path: projectPath, name: projectName, id: '' } as Project),
                        path: projectPath,
                        name: projectName
                    };

                    await configuration.update(
                        'projects',
                        [...projects, newProject],
                        vscode.ConfigurationTarget.Global
                    );

                    projectsProvider.invalidateCache();
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

        vscode.commands.registerCommand(Commands.ADD_REMOTE_PROJECT, async () => {
            const remoteUrl = await vscode.window.showInputBox({
                prompt: 'Enter repository URL (e.g. https://github.com/owner/repo)',
                placeHolder: 'https://github.com/owner/repo',
                validateInput: input => {
                    if (!input || !input.trim()) {
                        return 'Repository URL is required';
                    }
                    try {
                        const url = new URL(input.trim());
                        if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'git@') {
                            return 'Only http, https or git@ URLs are supported';
                        }
                    } catch {
                        return 'Please enter a valid URL';
                    }
                    return null;
                }
            });

            if (!remoteUrl) {
                return;
            }

            const trimmedUrl = remoteUrl.trim();
            let name = trimmedUrl.split('/').pop() || trimmedUrl;
            if (name.endsWith('.git')) {
                name = name.slice(0, -4);
            }

            const projectName = await vscode.window.showInputBox({
                prompt: 'Enter project name',
                value: name,
                validateInput: input => {
                    return input && input.trim().length > 0 ? null : 'Project name cannot be empty';
                }
            });

            if (!projectName) {
                return;
            }

            try {
                const configuration = projectsProvider.getCachedConfiguration();
                const projects: Project[] = configuration.get('projects') || [];

                const newProject: Project = {
                    id: getProjectId({ path: trimmedUrl, name: projectName.trim(), id: '' } as Project),
                    path: trimmedUrl,
                    name: projectName.trim(),
                    remoteUrl: trimmedUrl
                };

                await configuration.update(
                    'projects',
                    [...projects, newProject],
                    vscode.ConfigurationTarget.Global
                );

                projectsProvider.invalidateCache();
                projectsProvider.refresh();
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
                vscode.window.showErrorMessage(`Failed to add remote project: ${errorMessage}`);
            }
        }),

        vscode.commands.registerCommand(Commands.REFRESH_PROJECTS, () => {
            projectsProvider.refresh();
        }),

        // Add new command
        vscode.commands.registerCommand(Commands.UPDATE_PROJECT, async ({ projectId, updates }) => {
            try {
                const configuration = projectsProvider.getCachedConfiguration();
                const projects = [...(configuration.get<Project[]>('projects') || [])];
                const projectIndex = projects.findIndex(p => getProjectId(p) === projectId);

                if (projectIndex !== -1) {
                    projects[projectIndex] = {
                        ...projects[projectIndex],
                        ...updates,
                    };

                    await configuration.update('projects', projects, vscode.ConfigurationTarget.Global);
                    projectsProvider.invalidateCache();
                    projectsProvider.refresh();
                    return true;
                }
                return false;
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to update project: ${error}`);
                return false;
            }
        }),

        vscode.commands.registerCommand(Commands.DELETE_PROJECT, async ({ projectId }) => {
            if (!projectId) {
                return false;
            }

            try {
                const configuration = projectsProvider.getCachedConfiguration();
                const projects = [...(configuration.get<Project[]>('projects') || [])];
                const projectIndex = projects.findIndex(p => getProjectId(p) === projectId);

                if (projectIndex !== -1) {
                    const project = projects[projectIndex];

                    const answer = await vscode.window.showWarningMessage(
                        `Are you sure you want to remove project "${project.name}"?`,
                        { modal: true },
                        'Yes',
                        'No'
                    );

                    if (answer === 'Yes') {
                        projects.splice(projectIndex, 1);
                        await configuration.update('projects', projects, vscode.ConfigurationTarget.Global);

                        // Force cache invalidation in the provider
                        projectsProvider.invalidateCache();
                        projectsProvider.refresh();
                        return true;
                    }
                }
                return false;
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to delete project: ${error}`);
                return false;
            }
        })
    );
};
