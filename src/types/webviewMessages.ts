import { Project } from '../extension';

export interface WebviewMessage {
    command: 'deleteProject' | 'updateProject' | 'openProject' | 'openProjectNewWindow' | 'openWorkspace' | 'openUrl' |
             'addProject' | 'projectSelected' |
             'reorderProjects' | 'sortProjects' | 'scanProjects' | 'setLoading' | 'relocateProject' |
             'toggleGroupCollapse';
    projectId?: string;
    projectPath?: string;
    project?: Project;
    url?: string;
    updates?: Partial<Project>;
    path?: string;
    oldIndex?: number;
    newIndex?: number;
    isLoading?: boolean;
    sortedProjectIds?: string[];
    groupName?: string;
    isCollapsed?: boolean;
}
