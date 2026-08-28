import { Project } from '../extension';

export interface WebviewMessage {
    command: 'deleteProject' | 'updateProject' | 'openProject' | 'openProjectNewWindow' | 'openRemoteProject' |
             'openWorkspace' | 'openUrl' | 'addProject' | 'addRemoteProject' | 'projectSelected' |
             'sortProjects' | 'scanProjects' | 'setLoading' | 'relocateProject' |
             'toggleGroupCollapse' | 'showInFileManager' | 'previewIcon' | 'openInTerminal';
    projectId?: string;
    projectPath?: string;
    remoteUrl?: string;
    forceNewWindow?: boolean;
    url?: string;
    updates?: Partial<Project>;
    path?: string;
    isLoading?: boolean;
    sortedProjectIds?: string[];
    groupName?: string;
    isCollapsed?: boolean;
    project?: { path: string; name: string };
}
