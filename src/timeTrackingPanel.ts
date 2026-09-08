import * as vscode from 'vscode';
import * as fs from 'fs';
import { TimeTrackingService } from './timeTrackingService';
import { getTimeTrackingReportHtml } from './template/timeTracking/report';
import { WebviewMessage } from './types/webviewMessages';

export class TimeTrackingPanel {
    public static readonly viewType = 'awesomeProjectsTimeTracking';
    private static _panel: vscode.WebviewPanel | undefined;
    private static _currentPeriod: 'today' | 'week' | 'month' | 'custom' = 'week';
    private static _customStartDate?: string;
    private static _customEndDate?: string;

    public static async createOrShow(
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        timeTrackingService: TimeTrackingService,
        period?: 'today' | 'week' | 'month' | 'custom',
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

        const disposables: vscode.Disposable[] = [];

        disposables.push(
            timeTrackingService.onDidChangeTimer(async () => {
                if (panel.visible) {
                    panel.webview.html = await TimeTrackingPanel._getHtml(
                        panel.webview,
                        extensionUri,
                        context,
                        timeTrackingService
                    );
                }
            })
        );

        disposables.push(
            panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
                switch (message.command) {
                    case 'openTimeTrackingReport':
                        if (message.reportPeriod) {
                            TimeTrackingPanel._currentPeriod = message.reportPeriod;
                            TimeTrackingPanel._customStartDate = message.customStartDate;
                            TimeTrackingPanel._customEndDate = message.customEndDate;
                        }
                        panel.webview.html = await TimeTrackingPanel._getHtml(
                            panel.webview,
                            extensionUri,
                            context,
                            timeTrackingService
                        );
                        break;
                    case 'stopTimeTracking':
                        try {
                            const stopped = await timeTrackingService.stopSession(message.projectId);
                            if (stopped) {
                                const minutes = Math.ceil(stopped.durationSeconds / 60);
                                vscode.window.showInformationMessage(
                                    `Timer stopped: ${minutes} min on ${stopped.title}`
                                );
                            }
                            panel.webview.html = await TimeTrackingPanel._getHtml(
                                panel.webview,
                                extensionUri,
                                context,
                                timeTrackingService
                            );
                        } catch (error) {
                            vscode.window.showErrorMessage(`Failed to stop timer: ${error}`);
                        }
                        break;
                    case 'deleteTimeTrackingSession':
                        if (message.sessionId) {
                            try {
                                const deleted = await timeTrackingService.deleteSession(message.sessionId);
                                if (deleted) {
                                    panel.webview.html = await TimeTrackingPanel._getHtml(
                                        panel.webview,
                                        extensionUri,
                                        context,
                                        timeTrackingService
                                    );
                                    const undo = 'Undo';
                                    const selection = await vscode.window.showInformationMessage(
                                        `Deleted session: ${deleted.title}`,
                                        undo
                                    );
                                    if (selection === undo) {
                                        const state = timeTrackingService.getState();
                                        state.sessionsByProject[deleted.projectId] = state.sessionsByProject[deleted.projectId] || [];
                                        state.sessionsByProject[deleted.projectId].push(deleted);
                                        await context.globalState.update('timeTrackingState', state);
                                        await timeTrackingService.addTimeToProject(deleted.projectId, deleted.durationSeconds);
                                        panel.webview.html = await TimeTrackingPanel._getHtml(
                                            panel.webview,
                                            extensionUri,
                                            context,
                                            timeTrackingService
                                        );
                                    }
                                }
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to delete session: ${error}`);
                            }
                        }
                        break;
                    case 'updateTimeTrackingSession':
                        if (message.sessionId) {
                            try {
                                await timeTrackingService.updateSession(message.sessionId, {
                                    title: message.sessionTitle,
                                    description: message.sessionDescription,
                                    startTime: message.sessionStartTime,
                                    endTime: message.sessionEndTime,
                                    durationSeconds: message.sessionDurationSeconds
                                });
                                panel.webview.html = await TimeTrackingPanel._getHtml(
                                    panel.webview,
                                    extensionUri,
                                    context,
                                    timeTrackingService
                                );
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to update session: ${error}`);
                            }
                        }
                        break;
                    case 'addTimeTrackingSession':
                        if (message.projectId) {
                            try {
                                await timeTrackingService.addSession(message.projectId, {
                                    title: message.sessionTitle || 'Manual entry',
                                    description: message.sessionDescription,
                                    startTime: message.sessionStartTime,
                                    endTime: message.sessionEndTime,
                                    durationSeconds: message.sessionDurationSeconds || 0
                                });
                                panel.webview.html = await TimeTrackingPanel._getHtml(
                                    panel.webview,
                                    extensionUri,
                                    context,
                                    timeTrackingService
                                );
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to add session: ${error}`);
                            }
                        }
                        break;
                    case 'exportTimeTrackingCsv':
                        await TimeTrackingPanel._exportCsv(timeTrackingService, message.reportPeriod, message.customStartDate, message.customEndDate);
                        break;
                }
            })
        );

        panel.onDidDispose(
            () => {
                TimeTrackingPanel._panel = undefined;
                disposables.forEach(d => d.dispose());
            },
            null,
            disposables
        );

        disposables.push(
            vscode.workspace.onDidChangeConfiguration(async event => {
                if (event.affectsConfiguration('awesomeProjects')) {
                    if (panel.visible) {
                        panel.webview.html = await TimeTrackingPanel._getHtml(
                            panel.webview,
                            extensionUri,
                            context,
                            timeTrackingService
                        );
                    }
                }
            })
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
            TimeTrackingPanel._customEndDate
        );
    }

    private static async _exportCsv(
        timeTrackingService: TimeTrackingService,
        period?: 'today' | 'week' | 'month' | 'custom',
        customStartDate?: string,
        customEndDate?: string
    ): Promise<void> {
        const state = timeTrackingService.getState();
        const allSessions = Object.values(state.sessionsByProject).flat();
        const filtered = TimeTrackingPanel._filterSessions(allSessions, period, customStartDate, customEndDate);

        if (filtered.length === 0) {
            vscode.window.showInformationMessage('No sessions to export for the selected period.');
            return;
        }

        const rows = filtered.map(session => {
            const start = new Date(session.startTime);
            const end = session.endTime ? new Date(session.endTime) : start;
            const branches = session.branchLog.map(b => b.branch).join(' → ');
            const durationFormatted = TimeTrackingPanel._formatDuration(session.durationSeconds);
            return [
                start.toISOString().split('T')[0],
                session.projectId,
                TimeTrackingPanel._escapeCsv(session.title),
                TimeTrackingPanel._escapeCsv(session.description || ''),
                session.durationSeconds,
                durationFormatted,
                TimeTrackingPanel._escapeCsv(branches),
                session.startTime,
                session.endTime || ''
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

    private static _filterSessions(
        sessions: import('./types/timeTracking').TimeTrackingSession[],
        period?: 'today' | 'week' | 'month' | 'custom',
        customStartDate?: string,
        customEndDate?: string
    ): import('./types/timeTracking').TimeTrackingSession[] {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        return sessions.filter(session => {
            const sessionDate = new Date(session.startTime);
            switch (period) {
                case 'today':
                    return sessionDate >= startOfDay;
                case 'week': {
                    const startOfWeek = new Date(startOfDay);
                    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
                    return sessionDate >= startOfWeek;
                }
                case 'month': {
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    return sessionDate >= startOfMonth;
                }
                case 'custom': {
                    const start = customStartDate ? new Date(customStartDate) : null;
                    const end = customEndDate ? new Date(customEndDate) : null;
                    if (start) { start.setHours(0, 0, 0, 0); }
                    if (end) { end.setHours(23, 59, 59, 999); }
                    return (!start || sessionDate >= start) && (!end || sessionDate <= end);
                }
                default:
                    return true;
            }
        });
    }

    private static _formatDuration(totalSeconds: number): string {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    private static _escapeCsv(value: string): string {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
}
