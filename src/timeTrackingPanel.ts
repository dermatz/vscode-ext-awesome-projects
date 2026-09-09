import * as vscode from 'vscode';
import * as fs from 'fs';
import { TimeTrackingService } from './timeTrackingService';
import { getTimeTrackingReportHtml, getPeriodBounds, filterSessionsForPeriod, getLiveDurationSeconds } from './template/timeTracking/report';
import { formatDuration } from './template/utils/formatDuration';
import { WebviewMessage } from './types/webviewMessages';

export class TimeTrackingPanel {
    public static readonly viewType = 'awesomeProjectsTimeTracking';
    private static _panel: vscode.WebviewPanel | undefined;
    private static _currentPeriod: 'today' | 'week' | 'month' | 'lastMonth' | 'all' | 'custom' = 'week';
    private static _customStartDate?: string;
    private static _customEndDate?: string;
    private static _groupBy: 'none' | 'project' | 'title' | 'branch' | 'branchAndDate' = 'none';

    public static async createOrShow(
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        timeTrackingService: TimeTrackingService,
        period?: 'today' | 'week' | 'month' | 'lastMonth' | 'all' | 'custom',
        customStartDate?: string,
        customEndDate?: string
    ): Promise<void> {
        if (period) {
            TimeTrackingPanel._currentPeriod = period;
            TimeTrackingPanel._customStartDate = customStartDate;
            TimeTrackingPanel._customEndDate = customEndDate;
        }

        const column = vscode.ViewColumn.One;

        if (TimeTrackingPanel._panel) {
            TimeTrackingPanel._panel.reveal(column);
            TimeTrackingPanel._panel.webview.html = await TimeTrackingPanel._getHtml(
                TimeTrackingPanel._panel.webview,
                extensionUri,
                context,
                timeTrackingService
            );
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            TimeTrackingPanel.viewType,
            'Time Tracking Report',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        TimeTrackingPanel._panel = panel;

        panel.webview.html = await TimeTrackingPanel._getHtml(
            panel.webview,
            extensionUri,
            context,
            timeTrackingService
        );

        TimeTrackingPanel._setupPanelListeners(panel, extensionUri, context, timeTrackingService);
    }

    private static _setupPanelListeners(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        timeTrackingService: TimeTrackingService
    ): void {
        const disposables: vscode.Disposable[] = [];
        let lastActiveSessionId = timeTrackingService.getActiveSessionFull()?.id;
        let isDisposed = false;

        const handleTimerEvent = async (isUiTick: boolean) => {
            if (isDisposed || panel !== TimeTrackingPanel._panel || !panel.visible) {
                return;
            }
            const activeSession = timeTrackingService.getActiveSessionFull();
            const currentActiveSessionId = activeSession?.id;
            if (currentActiveSessionId !== lastActiveSessionId) {
                lastActiveSessionId = currentActiveSessionId;
                panel.webview.html = await TimeTrackingPanel._getHtml(
                    panel.webview,
                    extensionUri,
                    context,
                    timeTrackingService
                );
            } else if (isUiTick && activeSession) {
                panel.webview.postMessage({
                    command: 'timeTrackingTick',
                    activeSession: {
                        id: activeSession.id,
                        durationSeconds: activeSession.durationSeconds + Math.max(0, Math.floor((Date.now() - (timeTrackingService.getActiveSession()?.lastTickAt || Date.now())) / 1000))
                    }
                });
            } else if (!isUiTick) {
                panel.webview.postMessage({
                    command: 'timeTrackingTick',
                    activeSession: activeSession ? {
                        id: activeSession.id,
                        durationSeconds: activeSession.durationSeconds
                    } : undefined
                });
            }
        };

        disposables.push(
            timeTrackingService.onDidChangeTimer(async () => { await handleTimerEvent(false); }),
            timeTrackingService.onDidChangeUiTimer(async () => { await handleTimerEvent(true); }),
            panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
                if (isDisposed) {
                    return;
                }
                await TimeTrackingPanel._handleWebviewMessage(message, panel, extensionUri, context, timeTrackingService);
            }),
            vscode.workspace.onDidChangeConfiguration(async event => {
                if (event.affectsConfiguration('awesomeProjects') && panel.visible) {
                    panel.webview.html = await TimeTrackingPanel._getHtml(panel.webview, extensionUri, context, timeTrackingService);
                }
            })
        );

        panel.onDidDispose(
            () => {
                isDisposed = true;
                TimeTrackingPanel._panel = undefined;
                disposables.forEach(d => d.dispose());
            },
            null,
            disposables
        );
    }

    private static async _getHtml(
        webview: vscode.Webview,
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        timeTrackingService: TimeTrackingService
    ): Promise<string> {
        return getTimeTrackingReportHtml(
            context,
            webview,
            timeTrackingService,
            TimeTrackingPanel._currentPeriod,
            TimeTrackingPanel._customStartDate,
            TimeTrackingPanel._customEndDate,
            TimeTrackingPanel._groupBy
        );
    }

    private static async _exportCsv(
        timeTrackingService: TimeTrackingService,
        period?: 'today' | 'week' | 'month' | 'lastMonth' | 'all' | 'custom',
        customStartDate?: string,
        customEndDate?: string
    ): Promise<void> {
        const state = timeTrackingService.getState();
        const allSessions = Object.values(state.sessionsByProject).flat();
        const weekStartsOnSetting = vscode.workspace.getConfiguration('awesomeProjects').get<string>('timeTracking.weekStartsOn', 'sunday');
        const weekStartsOn = weekStartsOnSetting === 'monday' ? 1 : 0;
        const { start, end } = getPeriodBounds(period ?? 'all', customStartDate, customEndDate, weekStartsOn);
        const activeSessionId = state.activeSession?.sessionId;

        const filtered = filterSessionsForPeriod(allSessions, start, end, activeSessionId);

        if (filtered.length === 0) {
            vscode.window.showInformationMessage('No sessions to export for the selected period.');
            return;
        }

        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const projects = config.get<{ id: string; name: string }[]>('projects') || [];
        const projectNameById = new Map(projects.map(p => [p.id, p.name]));

        const rows = filtered.map(session => {
            const startDate = new Date(session.startTime);
            const isActive = session.id === activeSessionId;
            const durationSeconds = getLiveDurationSeconds(session, state.activeSession);
            const endTime = session.endTime || (isActive ? undefined : undefined);
            const branches = session.branchLog.map(b => b.branch).join(' → ');
            const durationFormatted = formatDuration(durationSeconds);
            const projectName = projectNameById.get(session.projectId) || session.projectId;
            return [
                startDate.toISOString().split('T')[0],
                TimeTrackingPanel._escapeCsv(projectName),
                TimeTrackingPanel._escapeCsv(session.title),
                TimeTrackingPanel._escapeCsv(session.description || ''),
                durationSeconds,
                durationFormatted,
                TimeTrackingPanel._escapeCsv(branches),
                session.startTime,
                endTime || ''
            ].join(',');
        });

        const header = 'date,project,title,description,durationSeconds,durationFormatted,branches,startTime,endTime';
        const csvContent = [header, ...rows].join('\n');

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`time-tracking-${period || 'all'}.csv`),
            filters: { 'CSV': ['csv'] }
        });

        if (!uri) {
            return;
        }

        await fs.promises.writeFile(uri.fsPath, csvContent, 'utf8');
        vscode.window.showInformationMessage(`Exported ${filtered.length} sessions to ${uri.fsPath}`);
    }

    private static async _handleWebviewMessage(
        message: WebviewMessage,
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        timeTrackingService: TimeTrackingService
    ): Promise<void> {
        switch (message.command) {
            case 'openTimeTrackingReport':
                await TimeTrackingPanel._handleOpenReport(message, panel, extensionUri, context, timeTrackingService);
                break;
            case 'stopTimeTracking':
                await TimeTrackingPanel._handleStopTimer(panel, extensionUri, context, timeTrackingService);
                break;
            case 'continueTimeTracking':
                await TimeTrackingPanel._handleContinueTimer(message, panel, extensionUri, context, timeTrackingService);
                break;
            case 'deleteTimeTrackingSession':
                await TimeTrackingPanel._handleDeleteSession(message, panel, extensionUri, context, timeTrackingService);
                break;
            case 'updateTimeTrackingSession':
                await TimeTrackingPanel._handleUpdateSession(message, panel, extensionUri, context, timeTrackingService);
                break;
            case 'addTimeTrackingSession':
                await TimeTrackingPanel._handleAddSession(message, panel, extensionUri, context, timeTrackingService);
                break;
            case 'exportTimeTrackingCsv':
                await TimeTrackingPanel._exportCsv(timeTrackingService, message.reportPeriod, message.customStartDate, message.customEndDate);
                break;
            case 'confirmDeleteAllTimeTrackingSessions':
                await TimeTrackingPanel._handleDeleteAllSessions(panel, extensionUri, context, timeTrackingService);
                break;
        }
    }

    private static async _refreshPanel(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        timeTrackingService: TimeTrackingService
    ): Promise<void> {
        panel.webview.html = await TimeTrackingPanel._getHtml(
            panel.webview,
            extensionUri,
            context,
            timeTrackingService
        );
    }

    private static async _handleOpenReport(
        message: WebviewMessage,
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        timeTrackingService: TimeTrackingService
    ): Promise<void> {
        if (message.reportPeriod) {
            TimeTrackingPanel._currentPeriod = message.reportPeriod;
            TimeTrackingPanel._customStartDate = message.customStartDate;
            TimeTrackingPanel._customEndDate = message.customEndDate;
        }
        if (message.groupBy) {
            TimeTrackingPanel._groupBy = message.groupBy;
        }
        await TimeTrackingPanel._refreshPanel(panel, extensionUri, context, timeTrackingService);
    }

    private static async _handleStopTimer(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        timeTrackingService: TimeTrackingService
    ): Promise<void> {
        try {
            const stopped = await timeTrackingService.stopSession();
            if (stopped) {
                const minutes = Math.ceil(stopped.durationSeconds / 60);
                vscode.window.showInformationMessage(`Timer stopped: ${minutes} min on ${stopped.title}`);
            }
            await TimeTrackingPanel._refreshPanel(panel, extensionUri, context, timeTrackingService);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to stop timer: ${error}`);
        }
    }

    private static async _handleContinueTimer(
        message: WebviewMessage,
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        timeTrackingService: TimeTrackingService
    ): Promise<void> {
        if (!message.sessionId) {
            return;
        }
        try {
            const continued = await timeTrackingService.continueSession({ sessionId: message.sessionId });
            if (continued) {
                vscode.window.showInformationMessage(`Timer continued: ${continued.title}`);
                await TimeTrackingPanel._refreshPanel(panel, extensionUri, context, timeTrackingService);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to continue timer: ${error}`);
        }
    }

    private static async _handleDeleteSession(
        message: WebviewMessage,
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        timeTrackingService: TimeTrackingService
    ): Promise<void> {
        if (!message.sessionId || message.sessionId === 'ALL_FILTERED') {
            return;
        }
        try {
            const deleted = await timeTrackingService.deleteSession(message.sessionId);
            if (!deleted) {
                return;
            }
            await TimeTrackingPanel._refreshPanel(panel, extensionUri, context, timeTrackingService);
            const selection = await vscode.window.showInformationMessage(
                `Deleted session: ${deleted.title}`,
                'Undo'
            );
            if (selection === 'Undo') {
                await timeTrackingService.addSession(deleted.projectId, {
                    title: deleted.title,
                    description: deleted.description,
                    startTime: deleted.startTime,
                    endTime: deleted.endTime,
                    durationSeconds: deleted.durationSeconds,
                    branch: deleted.branchLog.map(b => b.branch).join(' → ')
                });
                await TimeTrackingPanel._refreshPanel(panel, extensionUri, context, timeTrackingService);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete session: ${error}`);
        }
    }

    private static async _handleUpdateSession(
        message: WebviewMessage,
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        timeTrackingService: TimeTrackingService
    ): Promise<void> {
        if (!message.sessionId) {
            return;
        }
        try {
            await timeTrackingService.updateSession(message.sessionId, {
                title: message.sessionTitle,
                description: message.sessionDescription,
                startTime: message.sessionStartTime,
                endTime: message.sessionEndTime,
                durationSeconds: message.sessionDurationSeconds
            });
            await TimeTrackingPanel._refreshPanel(panel, extensionUri, context, timeTrackingService);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update session: ${error}`);
        }
    }

    private static async _handleAddSession(
        message: WebviewMessage,
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        timeTrackingService: TimeTrackingService
    ): Promise<void> {
        if (!message.projectId) {
            return;
        }
        try {
            await timeTrackingService.addSession(message.projectId, {
                title: message.sessionTitle || 'Manual entry',
                description: message.sessionDescription,
                startTime: message.sessionStartTime,
                endTime: message.sessionEndTime,
                durationSeconds: message.sessionDurationSeconds || 0
            });
            await TimeTrackingPanel._refreshPanel(panel, extensionUri, context, timeTrackingService);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add session: ${error}`);
        }
    }

    private static async _handleDeleteAllSessions(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        timeTrackingService: TimeTrackingService
    ): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            'Are you sure you want to delete all sessions in this period? This cannot be undone.',
            { modal: true },
            'Delete'
        );
        if (confirm !== 'Delete') {
            return;
        }

        const state = timeTrackingService.getState();
        const allSessions = Object.values(state.sessionsByProject).flat();
        const weekStartsOnSetting = vscode.workspace.getConfiguration('awesomeProjects').get<string>('timeTracking.weekStartsOn', 'sunday');
        const weekStartsOn = weekStartsOnSetting === 'monday' ? 1 : 0;
        const { start, end } = getPeriodBounds(
            TimeTrackingPanel._currentPeriod,
            TimeTrackingPanel._customStartDate,
            TimeTrackingPanel._customEndDate,
            weekStartsOn
        );
        const activeSessionId = state.activeSession?.sessionId;
        const sessionsToDelete = allSessions.filter(session => {
            const sessionDate = new Date(session.startTime);
            return sessionDate >= start && sessionDate <= end && session.id !== activeSessionId;
        });

        if (sessionsToDelete.length === 0) {
            vscode.window.showInformationMessage(activeSessionId
                ? 'Only the active session is in this period. Stop the timer first to delete it.'
                : 'No sessions to delete for this period.');
            return;
        }

        for (const session of sessionsToDelete) {
            await timeTrackingService.deleteSession(session.id);
        }

        await TimeTrackingPanel._refreshPanel(panel, extensionUri, context, timeTrackingService);
        const infoMessage = activeSessionId
            ? `Deleted ${sessionsToDelete.length} sessions. Active session was skipped.`
            : `Deleted ${sessionsToDelete.length} sessions`;
        vscode.window.showInformationMessage(infoMessage);
    }

    private static _escapeCsv(value: string): string {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
}
