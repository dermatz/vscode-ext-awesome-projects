import * as vscode from 'vscode';
import { Project } from './extension';
import { ProjectsWebviewProvider } from './webviewProvider';
import { getProjectId } from './template/project/utils/project-id';

export const Commands = {
    ADD_PROJECT: 'awesome-projects.addProject',
    OPEN_PROJECT: 'awesome-projects.openProject',
    REFRESH_PROJECTS: 'awesome-projects.refreshProjects',
    UPDATE_PROJECT: 'awesome-projects.updateProject',
    SORT_PROJECTS: 'awesome-projects.sortProjects',
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

        vscode.commands.registerCommand(Commands.SORT_PROJECTS, async ({ sortedProjectIds }) => {
            try {
                const configuration = vscode.workspace.getConfiguration('awesomeProjects');
                const projects = [...(configuration.get<Project[]>('projects') || [])];

                // Reorder projects based on the sorted IDs
                const sortedProjects = sortedProjectIds
                    .map((id: string) => projects.find(p => getProjectId(p) === id))
                    .filter(Boolean) as Project[];

                // Add any projects that weren't in the sorted list (edge case)
                const includedIds = new Set(sortedProjectIds);
                const missingProjects = projects.filter(p => !includedIds.has(getProjectId(p)));
                sortedProjects.push(...missingProjects);

                await configuration.update('projects', sortedProjects, vscode.ConfigurationTarget.Global);
                projectsProvider.invalidateCache();
                projectsProvider.refresh();
                return true;
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to sort projects: ${error}`);
                return false;
            }
        }),

        vscode.commands.registerCommand(Commands.DELETE_PROJECT, async ({ projectId }) => {
            if (!projectId) {
                return false;
            }

            try {
                const configuration = vscode.workspace.getConfiguration('awesomeProjects');
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
