export interface BranchChange {
    branch: string;
    changedAt: string;
}

export interface TimeTrackingSession {
    id: string;
    projectId: string;
    title: string;
    description?: string;
    startTime: string;
    endTime?: string;
    durationSeconds: number;
    branchLog: BranchChange[];
    createdAt: string;
    updatedAt: string;
}

export interface ActiveSession {
    sessionId: string;
    projectId: string;
    workspaceFolderPath: string;
    lastBranch: string;
    lastTickAt: number;
    accumulatedSeconds: number;
    accumulatedMs: number;
}

export interface TimeTrackingState {
    activeSession?: ActiveSession;
    sessionsByProject: Record<string, TimeTrackingSession[]>;
}

export interface TimeTrackingSessionPatch {
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    durationSeconds?: number;
}

export interface ContinueSessionOptions {
    sessionId: string;
}

export interface TimeTrackingExportRow {
    date: string;
    project: string;
    title: string;
    description: string;
    durationSeconds: number;
    durationFormatted: string;
    branches: string;
    startTime: string;
    endTime: string;
}
