import { Project } from '../extension';

export interface WebviewMessage {
    command: 'deleteProject' | 'updateProject' | 'openProject' | 'openUrl' |
             'addProject' | 'projectSelected' |
             'scanProjects' | 'setLoading';
    projectId?: string;
    projectPath?: string;
    project?: Project;
    url?: string;
    updates?: Partial<Project>;
    path?: string;
    isLoading?: boolean;
}
