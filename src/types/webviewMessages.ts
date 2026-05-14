import { Project } from '../extension';

export interface WebviewMessage {
    command: 'deleteProject' | 'updateProject' | 'openProject' | 'openProjectNewWindow' | 'openWorkspace' | 'openUrl' |
             'addProject' | 'projectSelected' |
             'reorderProjects' | 'sortProjects' | 'scanProjects' | 'setLoading' | 'relocateProject' |
             'toggleGroupCollapse' | 'showInFileManager';
    projectId?: string;
    projectPath?: string;
    url?: string;
    updates?: Partial<Project>;
    path?: string;
    oldIndex?: number;
    newIndex?: number;
    isLoading?: boolean;
    sortedProjectIds?: string[];
    groupName?: string;
    isCollapsed?: boolean;
    project?: { path: string; name: string };
}
