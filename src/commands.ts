import * as vscode from 'vscode';
import { Project } from './extension';
import { ProjectsWebviewProvider } from './webviewProvider';
import { getProjectId } from './template/project/utils/project-id';
import { showWhatsNewPanel } from './whatsNewPanel';
import { TimeTrackingPanel } from './timeTrackingPanel';

export const Commands = {
    ADD_PROJECT: 'awesome-projects.addProject',
    ADD_REMOTE_PROJECT: 'awesome-projects.addRemoteProject',
    OPEN_PROJECT: 'awesome-projects.openProject',
    REFRESH_PROJECTS: 'awesome-projects.refreshProjects',
    UPDATE_PROJECT: 'awesome-projects.updateProject',
    DELETE_PROJECT: 'awesome-projects.deleteProject',
    SHOW_WHATS_NEW: 'awesome-projects.showWhatsNew',
    HIDE_MISSING_PROJECTS: 'awesome-projects.hideMissingProjects',
    SHOW_MISSING_PROJECTS: 'awesome-projects.showMissingProjects',
    START_TIME_TRACKING: 'awesome-projects.startTimeTracking',
    STOP_TIME_TRACKING: 'awesome-projects.stopTimeTracking',
    OPEN_TIME_TRACKING_REPORT: 'awesome-projects.openTimeTrackingReport',
    OPEN_TIME_TRACKING_MENU: 'awesome-projects.openTimeTrackingMenu'
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
                    remoteUrl: trimmedUrl,
                    isRemote: true
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

        vscode.commands.registerCommand(Commands.HIDE_MISSING_PROJECTS, async () => {
            const configuration = projectsProvider.getCachedConfiguration();
            await configuration.update('projects.hideMissing', true, vscode.ConfigurationTarget.Global);
            vscode.commands.executeCommand('setContext', 'awesomeProjects.hideMissing', true);
            projectsProvider.refresh();
        }),

        vscode.commands.registerCommand(Commands.SHOW_MISSING_PROJECTS, async () => {
            const configuration = projectsProvider.getCachedConfiguration();
            await configuration.update('projects.hideMissing', false, vscode.ConfigurationTarget.Global);
            vscode.commands.executeCommand('setContext', 'awesomeProjects.hideMissing', false);
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
        }),

        vscode.commands.registerCommand(Commands.SHOW_WHATS_NEW, async () => {
            await showWhatsNewPanel(context);
        }),

        vscode.commands.registerCommand(Commands.START_TIME_TRACKING, async (args?: { projectId?: string; projectPath?: string }) => {
            const config = vscode.workspace.getConfiguration('awesomeProjects');
            if (!config.get<boolean>('timeTracking.enabled', true)) {
                vscode.window.showWarningMessage('Time tracking is disabled in settings.');
                return;
            }

            let projectId = args?.projectId;
            let projectPath = args?.projectPath;

            if (!projectId) {
                const projects = config.get<Project[]>('projects') || [];
                const pick = await vscode.window.showQuickPick(
                    projects.map(p => ({ label: p.name, description: p.path, id: p.id })),
                    { placeHolder: 'Select a project to track time for' }
                );
                if (!pick || !pick.id) {
                    return;
                }
                projectId = pick.id;
                projectPath = pick.description;
            }

            if (!projectId || !projectPath) {
                return;
            }

            try {
                await projectsProvider.timeTrackingService.startSession(projectId, projectPath);
                vscode.window.showInformationMessage('Timer started');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to start timer: ${error}`);
            }
        }),

        vscode.commands.registerCommand(Commands.STOP_TIME_TRACKING, async () => {
            try {
                const stopped = await projectsProvider.timeTrackingService.stopSession();
                if (stopped) {
                    const minutes = Math.ceil(stopped.durationSeconds / 60);
                    vscode.window.showInformationMessage(`Timer stopped: ${minutes} min on ${stopped.title}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to stop timer: ${error}`);
            }
        }),

        vscode.commands.registerCommand(Commands.OPEN_TIME_TRACKING_MENU, async () => {
            const active = projectsProvider.timeTrackingService.getActiveSession();
            const items: { label: string; command: string }[] = [
                { label: '$(folder) Open Awesome Projects', command: 'workbench.view.extension.awesomeProjects' }
            ];
            if (active) {
                items.unshift({ label: '$(debug-pause) Stop Timer', command: Commands.STOP_TIME_TRACKING });
                items.unshift({ label: '$(graph) Open Time Tracking Report', command: Commands.OPEN_TIME_TRACKING_REPORT });
            } else {
                items.unshift({ label: '$(play) Start Timer', command: Commands.START_TIME_TRACKING });
            }
            const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Time Tracking' });
            if (pick) {
                await vscode.commands.executeCommand(pick.command);
            }
        }),

        vscode.commands.registerCommand(Commands.OPEN_TIME_TRACKING_REPORT, async (args?: { reportPeriod?: 'today' | 'week' | 'month' | 'custom'; customStartDate?: string; customEndDate?: string }) => {
            await TimeTrackingPanel.createOrShow(
                context.extensionUri,
                context,
                projectsProvider.timeTrackingService,
                args?.reportPeriod,
                args?.customStartDate,
                args?.customEndDate
            );
        })
    );
};
