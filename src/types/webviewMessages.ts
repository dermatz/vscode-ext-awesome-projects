import { Project } from '../extension';

export interface WebviewMessage {
    command: 'deleteProject' | 'updateProject' | 'openProject' | 'openUrl' |
             'addProject' | 'projectSelected' |
             'reorderProjects' | 'scanProjects' | 'setLoading' | 'sortProjects';
    projectId?: string;
    projectPath?: string;
    project?: Project;
    url?: string;
    updates?: Partial<Project>;
    path?: string;
    oldIndex?: number;
    newIndex?: number;
    isLoading?: boolean;
    sortedProjects?: Project[];
    sortedProjectIds?: string[];
}
