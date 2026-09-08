import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { ActiveSession, BranchChange, TimeTrackingSession, TimeTrackingSessionPatch, TimeTrackingState } from './types/timeTracking';

export const TIME_TRACKING_STATE_KEY = 'timeTrackingState';
export const DEFAULT_TICK_INTERVAL_SECONDS = 10;
export const DEFAULT_RETENTION_DAYS = 90;

export interface TimeTrackingEvent {
    activeSession?: ActiveSession;
    sessions: TimeTrackingSession[];
}

export class TimeTrackingService implements vscode.Disposable {
    private _context: vscode.ExtensionContext;
    private _tickInterval: NodeJS.Timeout | undefined;
    private _onDidChangeTimer = new vscode.EventEmitter<TimeTrackingEvent>();
    private _disposables: vscode.Disposable[] = [];

    public readonly onDidChangeTimer = this._onDidChangeTimer.event;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._disposables.push(this._onDidChangeTimer);
    }

    /**
     * Loads the persisted time tracking state from globalState.
     */
    public getState(): TimeTrackingState {
        return this._context.globalState.get<TimeTrackingState>(TIME_TRACKING_STATE_KEY) || {
            sessionsByProject: {}
        };
    }

    /**
     * Persists the given time tracking state to globalState.
     */
    private async _setState(state: TimeTrackingState): Promise<void> {
        await this._context.globalState.update(TIME_TRACKING_STATE_KEY, state);
        this._emitChange(state);
    }

    private _emitChange(state: TimeTrackingState): void {
        this._onDidChangeTimer.fire({
            activeSession: state.activeSession,
            sessions: this._flattenSessions(state)
        });
    }

    private _flattenSessions(state: TimeTrackingState): TimeTrackingSession[] {
        return Object.values(state.sessionsByProject).flat().sort(
            (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
    }

    private _generateId(): string {
        return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    }

    /**
     * Tries to resolve the current branch for a workspace folder using the
     * built-in vscode.git extension API.
     */
    public async getCurrentBranch(workspaceFolderPath: string): Promise<string | undefined> {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension) {
                return undefined;
            }
            const gitApi = gitExtension.isActive ? gitExtension.exports : await gitExtension.activate();
            if (!gitApi || typeof gitApi.getAPI !== 'function') {
                return undefined;
            }
            const api = gitApi.getAPI(1);
            if (!api || !Array.isArray(api.repositories)) {
                return undefined;
            }
            const normalizedPath = workspaceFolderPath.replace(/\\/g, '/');
            const repo = api.repositories.find((r: { rootUri?: { fsPath: string } }) => {
                const repoPath = r.rootUri?.fsPath?.replace(/\\/g, '/');
                if (!repoPath) {
                    return false;
                }
                return normalizedPath === repoPath || normalizedPath.startsWith(repoPath + '/');
            });
            if (!repo) {
                return undefined;
            }
            return repo.state?.HEAD?.name;
        } catch {
            return undefined;
        }
    }

    /**
     * Starts a new tracking session for the given project/workspace.
     */
    public async startSession(
        projectId: string,
        workspaceFolderPath: string,
        title?: string,
        description?: string
    ): Promise<TimeTrackingSession> {
        const state = this.getState();

        if (state.activeSession) {
            await this.stopSession();
        }

        const branch = await this.getCurrentBranch(workspaceFolderPath) ?? 'unknown';
        const nowIso = new Date().toISOString();
        const sessionId = this._generateId();
        const sessionTitle = title?.trim() || `Work on ${branch}`;

        const session: TimeTrackingSession = {
            id: sessionId,
            projectId,
            title: sessionTitle,
            description,
            startTime: nowIso,
            durationSeconds: 0,
            branchLog: [{ branch, changedAt: nowIso }],
            createdAt: nowIso,
            updatedAt: nowIso
        };

        state.activeSession = {
            sessionId,
            projectId,
            workspaceFolderPath,
            lastBranch: branch,
            lastTickAt: Date.now(),
            accumulatedSeconds: 0
        };

        state.sessionsByProject[projectId] = state.sessionsByProject[projectId] || [];
        state.sessionsByProject[projectId].push(session);

        await this._setState(state);
        this._startTick();
        return session;
    }

    /**
     * Stops the active session, aggregates its duration into project config,
     * and returns the closed session.
     */
    public async stopSession(projectId?: string): Promise<TimeTrackingSession | undefined> {
        const state = this.getState();
        if (!state.activeSession) {
            return undefined;
        }

        if (projectId && state.activeSession.projectId !== projectId) {
            return undefined;
        }

        this._stopTick();

        const session = this._findSession(state, state.activeSession.sessionId);
        if (!session) {
            state.activeSession = undefined;
            await this._setState(state);
            return undefined;
        }

        const now = Date.now();
        const delta = Math.max(0, Math.floor((now - state.activeSession.lastTickAt) / 1000));
        session.durationSeconds = state.activeSession.accumulatedSeconds + delta;
        session.endTime = new Date().toISOString();
        session.updatedAt = session.endTime;

        await this.addTimeToProject(session.projectId, session.durationSeconds);

        state.activeSession = undefined;
        await this._setState(state);
        return session;
    }

    public async addTimeToProject(projectId: string, seconds: number): Promise<void> {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const projects = config.get<{ id: string; timeSpentSeconds?: number }[]>('projects') || [];
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            return;
        }
        project.timeSpentSeconds = (project.timeSpentSeconds || 0) + seconds;
        await config.update('projects', projects, vscode.ConfigurationTarget.Global);
    }

    private _findSession(state: TimeTrackingState, sessionId: string): TimeTrackingSession | undefined {
        for (const sessions of Object.values(state.sessionsByProject)) {
            const session = sessions.find(s => s.id === sessionId);
            if (session) {
                return session;
            }
        }
        return undefined;
    }

    /**
     * Adds a new manual session for a project and updates the aggregated time.
     */
    public async addSession(
        projectId: string,
        session: Partial<Pick<TimeTrackingSession, 'title' | 'description' | 'startTime' | 'endTime' | 'durationSeconds'>> & { branch?: string }
    ): Promise<TimeTrackingSession> {
        const state = this.getState();
        const nowIso = new Date().toISOString();

        const branch = session.branch?.trim() || 'unknown';
        const title = session.title?.trim() || branch;
        const branchLog: BranchChange[] = [{ branch, changedAt: session.startTime || nowIso }];

        const newSession: TimeTrackingSession = {
            id: this._generateId(),
            projectId,
            title,
            description: session.description,
            startTime: session.startTime || nowIso,
            endTime: session.endTime,
            durationSeconds: session.durationSeconds || 0,
            branchLog,
            createdAt: nowIso,
            updatedAt: nowIso
        };

        if (newSession.endTime && !newSession.durationSeconds) {
            newSession.durationSeconds = Math.max(
                0,
                Math.floor((new Date(newSession.endTime).getTime() - new Date(newSession.startTime).getTime()) / 1000)
            );
        }

        state.sessionsByProject[projectId] = state.sessionsByProject[projectId] || [];
        state.sessionsByProject[projectId].push(newSession);

        await this.addTimeToProject(projectId, newSession.durationSeconds);
        await this._setState(state);
        return newSession;
    }

    /**
     * Updates an existing session. Cannot mutate the active session's duration
     * directly; stop it first.
     */
    public async updateSession(sessionId: string, patch: TimeTrackingSessionPatch): Promise<TimeTrackingSession | undefined> {
        const state = this.getState();
        const session = this._findSession(state, sessionId);
        if (!session) {
            return undefined;
        }

        if (state.activeSession?.sessionId === sessionId) {
            if (patch.durationSeconds !== undefined || patch.startTime !== undefined || patch.endTime !== undefined) {
                throw new Error('Cannot edit duration or times of an active session. Stop it first.');
            }
        }

        const oldDuration = session.durationSeconds;
        if (patch.title !== undefined) {
            session.title = patch.title.trim();
        }
        if (patch.description !== undefined) {
            session.description = patch.description;
        }
        if (patch.startTime !== undefined) {
            session.startTime = patch.startTime;
        }
        if (patch.endTime !== undefined) {
            session.endTime = patch.endTime;
        }
        if (patch.durationSeconds !== undefined) {
            session.durationSeconds = patch.durationSeconds;
        }
        session.updatedAt = new Date().toISOString();

        const durationDelta = session.durationSeconds - oldDuration;
        if (durationDelta !== 0 && session.projectId) {
            await this.addTimeToProject(session.projectId, durationDelta);
        }

        await this._setState(state);
        return session;
    }

    /**
     * Deletes a session and adjusts the project's aggregated time.
     */
    public async deleteSession(sessionId: string): Promise<TimeTrackingSession | undefined> {
        const state = this.getState();
        if (state.activeSession?.sessionId === sessionId) {
            throw new Error('Cannot delete an active session. Stop it first.');
        }

        for (const projectId of Object.keys(state.sessionsByProject)) {
            const sessions = state.sessionsByProject[projectId];
            const index = sessions.findIndex(s => s.id === sessionId);
            if (index !== -1) {
                const [session] = sessions.splice(index, 1);
                await this.addTimeToProject(session.projectId, -session.durationSeconds);
                await this._setState(state);
                return session;
            }
        }
        return undefined;
    }

    /**
     * Clears all sessions for the given project and updates the aggregated time.
     */
    public async clearAllSessions(projectId: string): Promise<number> {
        const state = this.getState();
        const sessions = state.sessionsByProject[projectId];
        if (!sessions || sessions.length === 0) {
            return 0;
        }

        if (state.activeSession?.projectId === projectId) {
            await this.stopSession(projectId);
        }

        const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
        state.sessionsByProject[projectId] = [];
        await this.addTimeToProject(projectId, -totalSeconds);
        await this._setState(state);
        return sessions.length;
    }

    /**
     * Returns all sessions for a project, newest first.
     */
    public getSessionsByProject(projectId: string): TimeTrackingSession[] {
        const state = this.getState();
        return [...(state.sessionsByProject[projectId] || [])].sort(
            (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
    }

    /**
     * Returns the currently active session, if any.
     */
    public getActiveSession(): ActiveSession | undefined {
        return this.getState().activeSession;
    }

    /**
     * Returns the full session object for the active session.
     */
    public getActiveSessionFull(): TimeTrackingSession | undefined {
        const state = this.getState();
        if (!state.activeSession) {
            return undefined;
        }
        return this._findSession(state, state.activeSession.sessionId);
    }

    private _startTick(): void {
        this._stopTick();
        const intervalSeconds = vscode.workspace.getConfiguration('awesomeProjects').get<number>('timeTracking.tickIntervalSeconds', DEFAULT_TICK_INTERVAL_SECONDS);
        this._tickInterval = setInterval(() => this._tick(), intervalSeconds * 1000);
    }

    private _stopTick(): void {
        if (this._tickInterval) {
            clearInterval(this._tickInterval);
            this._tickInterval = undefined;
        }
    }

    private async _tick(): Promise<void> {
        const state = this.getState();
        if (!state.activeSession) {
            this._stopTick();
            return;
        }

        const now = Date.now();
        const delta = Math.max(0, Math.floor((now - state.activeSession.lastTickAt) / 1000));
        state.activeSession.lastTickAt = now;
        state.activeSession.accumulatedSeconds += delta;

        const session = this._findSession(state, state.activeSession.sessionId);
        if (session) {
            session.durationSeconds = state.activeSession.accumulatedSeconds;
            session.updatedAt = new Date().toISOString();

            const currentBranch = await this.getCurrentBranch(state.activeSession.workspaceFolderPath);
            if (currentBranch && currentBranch !== state.activeSession.lastBranch) {
                state.activeSession.lastBranch = currentBranch;
                session.branchLog.push({
                    branch: currentBranch,
                    changedAt: new Date().toISOString()
                });
            }
        }

        await this._context.globalState.update(TIME_TRACKING_STATE_KEY, state);
        this._emitChange(state);
    }

    /**
     * Removes sessions older than the configured retention days and adds their
     * duration to the project's aggregated time.
     */
    public async cleanupOldSessions(retentionDays?: number): Promise<void> {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const days = retentionDays ?? config.get<number>('timeTracking.retentionDays', DEFAULT_RETENTION_DAYS);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const state = this.getState();
        let changed = false;

        for (const projectId of Object.keys(state.sessionsByProject)) {
            const sessions = state.sessionsByProject[projectId];
            const keep: TimeTrackingSession[] = [];
            for (const session of sessions) {
                const sessionDate = new Date(session.startTime);
                const isActive = state.activeSession?.sessionId === session.id;
                if (sessionDate < cutoff && !isActive) {
                    await this.addTimeToProject(session.projectId, session.durationSeconds);
                    changed = true;
                } else {
                    keep.push(session);
                }
            }
            state.sessionsByProject[projectId] = keep;
            if (keep.length !== sessions.length) {
                changed = true;
            }
        }

        if (changed) {
            await this._setState(state);
        }
    }

    /**
     * Handles the restart of an orphaned active session by either resuming,
     * stopping with current time, or discarding it.
     */
    public async recoverActiveSession(action: 'resume' | 'stop' | 'discard'): Promise<void> {
        const state = this.getState();
        if (!state.activeSession) {
            return;
        }

        const session = this._findSession(state, state.activeSession.sessionId);
        if (!session) {
            state.activeSession = undefined;
            await this._setState(state);
            return;
        }

        if (action === 'resume') {
            state.activeSession.lastTickAt = Date.now();
            await this._setState(state);
            this._startTick();
        } else if (action === 'stop') {
            await this.stopSession();
        } else if (action === 'discard') {
            state.activeSession = undefined;
            const sessions = state.sessionsByProject[session.projectId] || [];
            const index = sessions.findIndex(s => s.id === session.id);
            if (index !== -1) {
                sessions.splice(index, 1);
            }
            await this._setState(state);
        }
    }

    public dispose(): void {
        this._stopTick();
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}
