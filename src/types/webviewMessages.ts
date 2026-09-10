import { Project } from '../extension';

export interface WebviewMessage {
    command: 'deleteProject' | 'updateProject' | 'openProject' | 'openProjectNewWindow' | 'openRemoteProject' |
             'openWorkspace' | 'openUrl' | 'addProject' | 'addRemoteProject' | 'projectSelected' |
             'sortProjects' | 'scanProjects' | 'setLoading' | 'relocateProject' |
             'toggleGroupCollapse' | 'showInFileManager' | 'previewIcon' | 'openInTerminal' |
             'startTimeTracking' | 'stopTimeTracking' | 'continueTimeTracking' | 'updateTimeTrackingSession' | 'deleteTimeTrackingSession' |
             'addTimeTrackingSession' | 'clearTimeTracking' | 'getTimeTrackingState' | 'exportTimeTrackingCsv' | 'openTimeTrackingReport' |
             'confirmDeleteAllTimeTrackingSessions' | 'confirmDeleteTimeTrackingSession';
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
    iconName?: string;
    sessionId?: string;
    sessionTitle?: string;
    sessionDescription?: string;
    sessionStartTime?: string;
    sessionEndTime?: string;
    sessionDurationSeconds?: number;
    reportPeriod?: 'today' | 'week' | 'month' | 'lastMonth' | 'all' | 'custom';
    customStartDate?: string;
    customEndDate?: string;
    groupBy?: 'none' | 'project' | 'title' | 'branch' | 'branchAndDate';
}
