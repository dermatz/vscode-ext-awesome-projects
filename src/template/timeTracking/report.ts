import * as vscode from 'vscode';
import { TimeTrackingService } from '../../timeTrackingService';
import { TimeTrackingSession } from '../../types/timeTracking';
import { Project } from '../../extension';
import { loadResourceFile } from '../utils/resourceLoader';
import { escHtml, escAttr } from '../utils/escaping';
import { formatDuration } from '../utils/formatDuration';
import { getProjectIconHtml } from '../project/utils/projectIcon';

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

function getUtcStartOfDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function getUtcEndOfDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function isValidDateString(value: string): boolean {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const date = new Date(value);
    return !isNaN(date.getTime());
}

export function getLiveDurationSeconds(
    session: TimeTrackingSession,
    activeSession?: { sessionId: string; accumulatedSeconds: number; lastTickAt: number }
): number {
    if (!activeSession || session.id !== activeSession.sessionId) {
        return session.durationSeconds;
    }
    const elapsedSinceLastTick = Math.max(0, Math.floor((Date.now() - activeSession.lastTickAt) / 1000));
    return activeSession.accumulatedSeconds + elapsedSinceLastTick;
}

export function filterSessionsForPeriod(
    sessions: TimeTrackingSession[],
    start: Date,
    end: Date,
    activeSessionId?: string
): TimeTrackingSession[] {
    return sessions.filter(session => {
        if (session.id === activeSessionId) {
            return true;
        }
        const sessionDate = new Date(session.startTime);
        return sessionDate >= start && sessionDate <= end;
    });
}

function getWeekStartOffset(weekStartsOn: number): number {
    // weekStartsOn: 0 = Sunday, 1 = Monday (matching locale conventions)
    const dayOfWeek = new Date().getUTCDay();
    return (dayOfWeek + 7 - weekStartsOn) % 7;
}

export function getPeriodBounds(
    period: 'today' | 'week' | 'month' | 'lastMonth' | 'all' | 'custom',
    customStart?: string,
    customEnd?: string,
    weekStartsOn: number = 0
): { start: Date; end: Date } {
    const now = new Date();
    let end = getUtcEndOfDay(now);
    let start = getUtcStartOfDay(now);

    switch (period) {
        case 'today':
            break;
        case 'week': {
            const offset = getWeekStartOffset(weekStartsOn);
            start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset, 0, 0, 0, 0));
            break;
        }
        case 'month':
            start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
            break;
        case 'lastMonth':
            start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
            end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
            break;
        case 'all':
            start = new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0));
            end = new Date(8640000000000000);
            break;
        case 'custom': {
            const customStartDate = customStart && isValidDateString(customStart) ? new Date(customStart) : undefined;
            const customEndDate = customEnd && isValidDateString(customEnd) ? new Date(customEnd) : undefined;
            start = customStartDate ? getUtcStartOfDay(customStartDate) : start;
            end = customEndDate ? getUtcEndOfDay(customEndDate) : end;
            if (start > end) {
                const temp = start;
                start = end;
                end = temp;
            }
            break;
        }
    }

    return { start, end };
}

export async function getTimeTrackingReportHtml(
    context: vscode.ExtensionContext,
    webview: vscode.Webview,
    timeTrackingService: TimeTrackingService,
    period: 'today' | 'week' | 'month' | 'lastMonth' | 'all' | 'custom' = 'week',
    customStartDate?: string,
    customEndDate?: string,
    groupBy: 'none' | 'project' | 'title' | 'branch' | 'branchAndDate' = 'none'
): Promise<string> {
    let baseCss = '';
    try {
        baseCss = await loadResourceFile(context, 'dist/css/webview.css');
    } catch {
        baseCss = await loadResourceFile(context, 'src/css/webview.css').catch(() => '');
    }

    const config = vscode.workspace.getConfiguration('awesomeProjects');
    const projects = config.get<Project[]>('projects') || [];
    const projectById = new Map(projects.map(p => [p.id, p]));
    const projectNameById = new Map(projects.map(p => [p.id, p.name]));
    const projectColorById = new Map(projects.map(p => [p.id, p.color || '']));
    const useFavicons = config.get<boolean>('useFavicons', true);

    function getProjectColorHex(projectId: string): string {
        const color = projectColorById.get(projectId);
        if (!color) {
            return '';
        }
        const hex = color.replace('#', '');
        if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
            return '';
        }
        return `#${hex}`;
    }

    const state = timeTrackingService.getState();
    const allSessions = Object.values(state.sessionsByProject).flat().sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    const weekStartsOnSetting = config.get<string>('timeTracking.weekStartsOn', 'sunday');
    const weekStartsOn = weekStartsOnSetting === 'monday' ? 1 : 0;

    const { start, end } = getPeriodBounds(period, customStartDate, customEndDate, weekStartsOn);
    const activeSession = state.activeSession ? timeTrackingService.getActiveSessionFull() : undefined;
    const activeSessionId = activeSession?.id;
    const filteredSessions = filterSessionsForPeriod(allSessions, start, end, activeSessionId);

    const maxRenderedSessions = Math.max(50, Math.min(5000, config.get<number>('timeTracking.maxReportSessions', 500)));
    const displaySessions = filteredSessions.slice(0, maxRenderedSessions);
    const hasMoreSessions = filteredSessions.length > displaySessions.length;

    const totalSeconds = displaySessions.reduce((sum, session) => sum + getLiveDurationSeconds(session, state.activeSession), 0);

    const activeBanner = activeSession
        ? `
            <div class="report-active-banner">
                <span class="report-active-indicator"></span>
                <div class="report-active-info">
                    <span class="report-active-label">Timer running</span>
                    <span class="report-active-title">${escHtml(activeSession.title)}</span>
                </div>
                <span class="report-active-time" data-active-session-id="${escAttr(activeSession.id)}">${formatDuration(activeSession.durationSeconds)}</span>
                <button class="button mini" data-action="stopActiveTimer" onclick="stopActiveTimer(event)">Stop</button>
            </div>
        `
        : '';

    const paginationNotice = hasMoreSessions
        ? `<div class="report-pagination-notice">Showing ${displaySessions.length} of ${filteredSessions.length} sessions. Narrow the period to see older entries, or increase the limit in settings.</div>`
        : '';

    const sessionsHtml = filteredSessions.length === 0
        ? `
            <div class="report-empty">
                <div class="report-empty-icon">⏱</div>
                <h3>No sessions for this period</h3>
                <p>Start tracking time from a project in the sidebar to see it here.</p>
            </div>
        `
        : `
            <div class="report-summary-grid">
                <div class="report-summary-card">
                    <span class="report-summary-label">Total Time</span>
                    <span class="report-summary-value" id="summary-total-time" data-total-seconds="${totalSeconds}">${formatDuration(totalSeconds)}</span>
                </div>
                <div class="report-summary-card">
                    <span class="report-summary-label">Sessions</span>
                    <span class="report-summary-value" id="summary-session-count">${displaySessions.length}</span>
                </div>
                <div class="report-summary-card">
                    <span class="report-summary-label">Projects</span>
                    <span class="report-summary-value">${new Set(displaySessions.map(s => s.projectId)).size}</span>
                </div>
                <div class="report-summary-card">
                    <span class="report-summary-label">Daily Avg</span>
                    <span class="report-summary-value" id="summary-daily-avg">${formatDuration(Math.round(totalSeconds / Math.max(1, displaySessions.length)))}</span>
                </div>
            </div>
            ${activeBanner}
            ${paginationNotice}
            <div class="report-table-wrapper" style="display: ${groupBy === 'none' ? 'block' : 'none'};">
                <table class="report-table" id="time-tracking-table">
                    <thead>
                        <tr>
                            <th class="sortable-header sort-desc" data-sort="date">Date and Time</th>
                            <th class="sortable-header" data-sort="project">Project</th>
                            <th class="sortable-header" data-sort="title">Title</th>
                            <th class="sortable-header" data-sort="duration">Duration</th>
                            <th class="sortable-header" data-sort="branches">Branches</th>
                            <th class="actions-header">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${displaySessions.map(session => renderSessionRow(session, projectById.get(session.projectId), projectNameById, getProjectColorHex(session.projectId), activeSession?.id === session.id, false, state.activeSession, context, useFavicons)).join('')}
                    </tbody>
                </table>
            </div>

            <div id="branch-groups" class="report-branch-groups" style="display: ${groupBy === 'none' ? 'none' : 'block'};">
                ${renderGroups(displaySessions, projectById, projectNameById, getProjectColorHex, activeSession?.id, groupBy, state.activeSession, context, useFavicons)}
            </div>
        `;

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Time Tracking Report</title>
        <style>
            ${baseCss}

            * {
                box-sizing: border-box;
            }

            .time-tracking-report {
                padding: 32px;
                min-height: 100vh;
            }

            .report-page-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 24px;
                margin-bottom: 28px;
                flex-wrap: wrap;
            }

            .report-page-header h1 {
                margin: 0;
                font-size: 1.6rem;
                font-weight: 700;
                letter-spacing: -0.02em;
            }

            .report-header-actions {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-left: auto;
            }

            .report-header-stop {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 12px;
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 0.85rem;
                font-weight: 600;
            }

            .report-header-stop:hover {
                background: var(--vscode-button-hoverBackground);
            }

            .report-header-stop .live-dot {
                width: 8px;
                height: 8px;
                background: currentColor;
                border-radius: 50%;
                animation: pulse 1.5s infinite;
            }

            .report-period-tabs {
                display: flex;
                gap: 4px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                padding: 4px;
                border-radius: 10px;
            }

            .report-period-tabs button {
                background: transparent;
                border: none;
                color: var(--vscode-foreground);
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 0.85rem;
                font-weight: 500;
                transition: all 0.15s ease;
            }

            .report-period-tabs button:hover {
                background: var(--vscode-toolbar-hoverBackground);
            }

            .report-period-tabs button.active {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
            }

            .report-custom-range {
                display: flex;
                gap: 10px;
                align-items: center;
                padding: 14px 18px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 12px;
                margin-bottom: 20px;
                flex-wrap: wrap;
            }

            .report-custom-range label {
                font-size: 0.85rem;
                opacity: 0.8;
                font-weight: 500;
            }

            .report-custom-range input {
                background: var(--vscode-editor-background);
                color: var(--vscode-input-foreground);
                border: 2px solid var(--vscode-panel-border);
                border-radius: 8px;
                padding: 10px 14px;
                font-size: 0.9rem;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .report-custom-range input:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--vscode-focusBorder) 25%, transparent), inset 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .report-custom-range input.invalid {
                border-color: var(--vscode-errorForeground);
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--vscode-errorForeground) 25%, transparent), inset 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .report-custom-range .validation-message {
                color: var(--vscode-errorForeground);
                font-size: 0.85rem;
                width: 100%;
            }

            .report-active-banner {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 14px 18px;
                background: color-mix(in srgb, var(--vscode-button-background) 8%, var(--vscode-editor-inactiveSelectionBackground));
                border-radius: 12px;
                margin-bottom: 24px;
                border: 1px solid color-mix(in srgb, var(--vscode-button-background) 25%, transparent);
                border-left: 4px solid var(--vscode-button-background);
            }

            .report-pagination-notice {
                padding: 12px 16px;
                margin-bottom: 20px;
                background: color-mix(in srgb, var(--vscode-editorWarning-background, var(--vscode-editorWarning-border)) 15%, var(--vscode-editor-inactiveSelectionBackground));
                border: 1px solid var(--vscode-editorWarning-border, var(--vscode-foreground));
                border-radius: 10px;
                color: var(--vscode-editorWarning-foreground, var(--vscode-foreground));
                font-size: 0.9rem;
            }

            .report-active-indicator {
                width: 10px;
                height: 10px;
                background: var(--vscode-button-background);
                border-radius: 50%;
                animation: pulse 1.5s infinite;
                flex-shrink: 0;
            }

            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.4; }
                100% { opacity: 1; }
            }

            .report-active-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;
            }

            .report-active-label {
                font-size: 0.7rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                opacity: 0.7;
            }

            .report-active-title {
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .report-active-time {
                font-variant-numeric: tabular-nums;
                font-weight: 700;
                margin-left: auto;
                font-size: 1.1rem;
            }

            .report-summary-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(140px, 1fr));
                gap: 16px;
                margin-bottom: 28px;
            }

            .report-summary-card {
                padding: 20px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .report-summary-label {
                font-size: 0.75rem;
                opacity: 0.65;
                text-transform: uppercase;
                letter-spacing: 0.07em;
                font-weight: 700;
            }

            .report-summary-value {
                font-size: 1.6rem;
                font-weight: 700;
            }

            .report-toolbar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                margin-bottom: 16px;
                flex-wrap: wrap;
            }

            .report-toolbar-group {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .report-toolbar .button {
                padding: 8px 16px;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                font-size: 0.85rem;
                font-weight: 600;
                transition: all 0.15s ease;
            }

            .report-toolbar .button:hover {
                transform: translateY(-1px);
            }

            .report-toolbar .button.mini {
                padding: 6px 12px;
            }

            .report-toolbar .button.secondary {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }

            .report-toolbar .button.secondary:hover {
                background: var(--vscode-button-secondaryHoverBackground);
            }

            .report-toolbar .button.danger {
                background: var(--vscode-inputValidation-errorBorder);
                color: #ffffff;
            }

            .report-toolbar .button.danger:hover {
                background: color-mix(in srgb, var(--vscode-inputValidation-errorBorder) 85%, #000);
            }

            .report-toggle {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-size: 0.85rem;
                font-weight: 500;
                user-select: none;
            }

            .report-toggle input {
                width: 18px;
                height: 18px;
                accent-color: var(--vscode-button-background);
                cursor: pointer;
            }

            .report-grouping-bar {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 16px;
                padding: 10px 14px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 10px;
            }

            .report-grouping-bar label {
                font-size: 0.85rem;
                font-weight: 500;
                opacity: 0.8;
            }

            .report-grouping-bar select {
                background: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 8px;
                padding: 8px 12px;
                font-family: inherit;
                font-size: 0.9rem;
                cursor: pointer;
                min-width: 160px;
            }

            .report-grouping-bar select:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
            }

            .report-branch-groups {
                display: flex;
                flex-direction: column;
                padding-bottom: 20px;
            }

            .report-branch-group {
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 12px;
                overflow: hidden;
                border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 60%, transparent);
                margin-bottom: 24px;
            }

            .report-branch-group:last-child {
                margin-bottom: 0;
            }

            .report-branch-group-header {
                background: color-mix(in srgb, var(--vscode-panel-border) 35%, transparent);
                padding: 14px 18px;
                font-weight: 700;
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                user-select: none;
                position: sticky;
                top: 0;
                z-index: 1;
                border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 40%, transparent);
            }

            .report-branch-group-header:hover {
                background: color-mix(in srgb, var(--vscode-panel-border) 50%, transparent);
            }

            .report-branch-group-header .branch-group-color {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: var(--project-color, var(--vscode-foreground));
            }

            .report-branch-group-header .branch-group-duration {
                margin-left: auto;
                font-variant-numeric: tabular-nums;
                opacity: 0.9;
                font-weight: 700;
            }

            .report-branch-group-header .branch-group-count {
                opacity: 0.7;
                font-weight: 500;
                font-size: 0.8rem;
            }

            .report-branch-group-header .branch-group-toggle {
                transition: transform 0.2s ease;
                opacity: 0.6;
            }

            .report-branch-group.collapsed .branch-group-toggle {
                transform: rotate(-90deg);
            }

            .report-branch-group.collapsed .report-table-wrapper {
                display: none;
            }

            .report-branch-group .report-table-wrapper {
                background: transparent;
                border-radius: 0;
                padding: 0;
            }

            .report-branch-group .report-table th {
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 40%, transparent);
            }

            .report-branch-group .report-table tbody tr:last-child td {
                border-bottom: none;
            }

            .report-filter-bar {
                display: flex;
                gap: 12px;
                margin-bottom: 20px;
                align-items: center;
                flex-wrap: wrap;
                padding: 12px 16px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 12px;
            }

            .report-filter-bar input {
                flex: 1;
                min-width: 220px;
                background: var(--vscode-editor-background);
                color: var(--vscode-input-foreground);
                border: 2px solid var(--vscode-panel-border);
                border-radius: 10px;
                padding: 12px 16px;
                font-family: inherit;
                font-size: 0.95rem;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .report-filter-bar input::placeholder {
                color: var(--vscode-input-placeholderForeground, #9e9e9e);
            }

            .report-filter-bar input:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--vscode-focusBorder) 25%, transparent), inset 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .report-filter-pills {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .report-filter-pill {
                background: transparent;
                border: 1px solid var(--vscode-panel-border);
                color: var(--vscode-foreground);
                padding: 6px 12px;
                border-radius: 20px;
                cursor: pointer;
                font-size: 0.8rem;
                transition: all 0.15s ease;
            }

            .report-filter-pill:hover {
                background: var(--vscode-toolbar-hoverBackground);
            }

            .report-filter-pill.active {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border-color: var(--vscode-button-background);
            }

            .report-filter-clear {
                background: transparent;
                border: none;
                color: var(--vscode-foreground);
                cursor: pointer;
                opacity: 0.7;
                font-size: 0.85rem;
                font-weight: 500;
            }

            .report-filter-clear:hover {
                opacity: 1;
            }

            .report-table-wrapper {
                overflow-x: auto;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 12px;
                padding: 4px;
            }

            .report-table {
                width: 100%;
                border-collapse: collapse;
            }

            .report-table th,
            .report-table td {
                text-align: left;
                padding: 14px 16px;
            }

            .report-table tbody tr {
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .report-table tbody tr:last-child {
                border-bottom: none;
            }

            .report-table th.actions-header,
            .report-table td.session-actions {
                width: 210px;
                min-width: 210px;
                max-width: 210px;
                white-space: nowrap;
            }

            .report-table th {
                font-weight: 700;
                opacity: 0.7;
                font-size: 0.75rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                white-space: nowrap;
            }

            .report-table th.sortable-header {
                cursor: pointer;
                user-select: none;
            }

            .report-table th.sortable-header:hover {
                opacity: 1;
                background: var(--vscode-toolbar-hoverBackground);
            }

            .report-table th.sortable-header::after {
                content: '↕';
                margin-left: 8px;
                opacity: 0.35;
                font-size: 0.7rem;
            }

            .report-table th.sortable-header.sort-asc::after {
                content: '↑';
                opacity: 1;
            }

            .report-table th.sortable-header.sort-desc::after {
                content: '↓';
                opacity: 1;
            }

            .report-table tbody tr:hover {
                background: var(--vscode-toolbar-hoverBackground);
            }

            .report-table tbody tr {
                border-left: 3px solid transparent;
            }

            .report-table tbody tr.session-row-active {
                background: color-mix(in srgb, var(--vscode-button-background) 4%, transparent);
            }

            .report-table tbody tr[style*="--project-color"] {
                border-left-color: var(--project-color);
            }

            .report-table tbody tr.session-row-active[style*="--project-color"] {
                border-left-width: 4px;
            }

            .session-row-live-indicator {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                margin-right: 6px;
                font-size: 0.65rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.03em;
                color: var(--vscode-button-background);
                padding: 1px 0;
                line-height: 1;
                vertical-align: middle;
            }

            .session-row-live-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: var(--vscode-button-background);
                animation: session-row-live-pulse 1.5s ease-in-out infinite;
            }

            @keyframes session-row-live-pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(0.85); }
            }

            .project-color-dot {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--project-color, transparent);
                margin-right: 8px;
                vertical-align: middle;
            }

            .branch-timeline {
                font-size: 0.85rem;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .branch-entry {
                display: flex;
                gap: 8px;
            }

            .session-date {
                display: inline;
            }

            .session-time {
                opacity: 0.65;
                margin-left: 8px;
                white-space: nowrap;
            }

            .session-actions {
                display: flex;
                justify-content: flex-end;
                align-items: center;
                gap: 6px;
            }

            .session-actions .button.mini {
                padding: 5px 10px;
                font-size: 0.8rem;
            }

            .report-project-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 18px;
                height: 18px;
                margin-right: 8px;
                vertical-align: middle;
            }

            .report-project-icon img {
                width: 16px;
                height: 16px;
                object-fit: contain;
            }

            .report-project-icon svg {
                width: 16px;
                height: 16px;
            }

            .report-empty {
                text-align: center;
                padding: 72px 24px;
                opacity: 0.8;
            }

            .report-empty-icon {
                font-size: 3rem;
                margin-bottom: 16px;
            }

            .report-empty h3 {
                margin: 0 0 8px;
                font-size: 1.25rem;
            }

            .report-empty p {
                margin: 0 0 20px;
                opacity: 0.75;
            }

            .inline-edit {
                display: flex;
                flex-direction: column;
                gap: 16px;
                padding: 20px;
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 12px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            }

            .inline-edit input,
            .inline-edit textarea,
            .inline-edit select {
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 8px;
                padding: 10px 12px;
                font-family: inherit;
                font-size: 0.95rem;
                outline: none;
                width: 100%;
            }

            .inline-edit input:not(:focus),
            .inline-edit textarea:not(:focus),
            .inline-edit select:not(:focus) {
                border-color: var(--vscode-input-border, #6e6e6e);
            }

            .inline-edit input:focus,
            .inline-edit textarea:focus,
            .inline-edit select:focus {
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 0 0 2px var(--vscode-focusBorder);
            }

            .inline-edit textarea {
                min-height: 80px;
                resize: vertical;
            }

            .inline-edit-row {
                display: flex;
                gap: 16px;
                align-items: flex-end;
            }

            .inline-edit > .field,
            .inline-edit-row .field {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 8px;
                min-width: 0;
            }

            .inline-edit label {
                font-size: 0.8rem;
                font-weight: 700;
                opacity: 0.85;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }

            .inline-edit-actions {
                display: flex;
                gap: 10px;
                margin-top: 4px;
            }

            .add-session-edit select {
                background: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
            }

            @media (max-width: 768px) {
                .time-tracking-report {
                    padding: 20px;
                }

                .report-page-header {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .report-summary-grid {
                    grid-template-columns: repeat(2, 1fr);
                }

                .report-toolbar {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .inline-edit-row {
                    flex-direction: column;
                    align-items: stretch;
                }
            }
        </style>
    </head>
    <body>
        <div class="time-tracking-report">
            <div class="report-page-header">
                <h1>Time Tracking Report</h1>
                <div class="report-header-actions">
                    ${activeSession ? `
                        <button class="report-header-stop" data-action="stopActiveTimer" title="Stop running timer: ${escAttr(activeSession.title)}">
                            <span class="live-dot"></span>
                            <span>Stop</span>
                        </button>
                    ` : ''}
                    <div class="report-period-tabs">
                        <button class="${period === 'today' ? 'active' : ''}" data-action="setPeriod" data-period="today">Today</button>
                        <button class="${period === 'week' ? 'active' : ''}" data-action="setPeriod" data-period="week">This Week</button>
                        <button class="${period === 'month' ? 'active' : ''}" data-action="setPeriod" data-period="month">This Month</button>
                        <button class="${period === 'lastMonth' ? 'active' : ''}" data-action="setPeriod" data-period="lastMonth">Last Month</button>
                        <button class="${period === 'all' ? 'active' : ''}" data-action="setPeriod" data-period="all">All</button>
                        <button class="${period === 'custom' ? 'active' : ''}" data-action="setPeriod" data-period="custom">Custom</button>
                    </div>
                </div>
            </div>

            ${period === 'custom' ? `
                <div class="report-custom-range">
                    <label for="custom-start">From</label>
                    <input type="date" id="custom-start" value="${escAttr(customStartDate || start.toISOString().split('T')[0])}">
                    <label for="custom-end">To</label>
                    <input type="date" id="custom-end" value="${escAttr(customEndDate || end.toISOString().split('T')[0])}">
                    <button class="button mini" data-action="applyCustomRange">Apply</button>
                    <div class="validation-message" id="custom-range-error" style="display: none;"></div>
                </div>
            ` : ''}

            <div class="report-toolbar">
                <div class="report-toolbar-group">
                    <button class="button" data-action="addSession">+ Add Session</button>
                </div>
                <div class="report-toolbar-group">
                    ${displaySessions.length > 0 ? `
                        <button class="button mini secondary" data-action="exportCsv" data-period="${escAttr(period)}" data-start="${escAttr(customStartDate || '')}" data-end="${escAttr(customEndDate || '')}">Export CSV</button>
                        <button class="button mini danger" data-action="deleteAllSessions">Delete All</button>
                    ` : ''}
                </div>
            </div>

            <div class="report-grouping-bar">
                <label for="group-by">Group by</label>
                <select id="group-by" data-action="setGroupBy">
                    <option value="none" ${groupBy === 'none' ? 'selected' : ''}>None</option>
                    <option value="project" ${groupBy === 'project' ? 'selected' : ''}>Project</option>
                    <option value="title" ${groupBy === 'title' ? 'selected' : ''}>Title</option>
                    <option value="branch" ${groupBy === 'branch' ? 'selected' : ''}>Branch</option>
                    <option value="branchAndDate" ${groupBy === 'branchAndDate' ? 'selected' : ''}>Branch and Date</option>
                </select>
            </div>

            <div class="report-filter-bar">
                <input type="text" id="session-filter" placeholder="Filter by project, title, branch...">
                <div class="report-filter-pills" id="project-filter-pills">
                    ${[...new Set(displaySessions.map(s => projectNameById.get(s.projectId) || s.projectId))].sort().map(name => `<button class="report-filter-pill" data-filter-project="${escAttr(name)}">${escHtml(name)}</button>`).join('')}
                </div>
                <button class="report-filter-clear" id="filter-clear" style="display: none;">Clear</button>
            </div>

            <div id="add-session-form" class="inline-edit add-session-edit" style="display: none; margin-bottom: 24px;">
                <div class="field">
                    <label for="add-project">Project</label>
                    <select id="add-project">
                        ${projects.map(p => `<option value="${escAttr(p.id)}">${escHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="field">
                    <label for="add-title">Title</label>
                    <input type="text" id="add-title" placeholder="Session title">
                </div>
                <div class="field">
                    <label for="add-desc">Description</label>
                    <textarea id="add-desc" rows="2" placeholder="Optional description"></textarea>
                </div>
                <div class="inline-edit-row">
                    <div class="field">
                        <label for="add-start">Start</label>
                        <input type="datetime-local" id="add-start">
                    </div>
                    <div class="field">
                        <label for="add-end">End</label>
                        <input type="datetime-local" id="add-end">
                    </div>
                    <div class="field" style="max-width: 120px;">
                        <label for="add-duration">Duration (s)</label>
                        <input type="number" id="add-duration" placeholder="Ignored when start and end are set">
                    </div>
                </div>
                <div class="inline-edit-actions">
                    <button class="button mini" data-action="saveNewSession">Save</button>
                    <button class="button mini secondary" data-action="cancelAddSession">Cancel</button>
                </div>
            </div>

            ${sessionsHtml}
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            function setPeriod(period) {
                vscode.postMessage({ command: 'openTimeTrackingReport', reportPeriod: period });
            }

            function isValidDateInput(value) {
                if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    return false;
                }
                const date = new Date(value);
                return !isNaN(date.getTime());
            }

            function showCustomRangeError(message) {
                const startInput = document.getElementById('custom-start');
                const endInput = document.getElementById('custom-end');
                const errorEl = document.getElementById('custom-range-error');
                if (startInput) { startInput.classList.add('invalid'); }
                if (endInput) { endInput.classList.add('invalid'); }
                if (errorEl) {
                    errorEl.textContent = message;
                    errorEl.style.display = 'block';
                }
            }

            function clearCustomRangeError() {
                const startInput = document.getElementById('custom-start');
                const endInput = document.getElementById('custom-end');
                const errorEl = document.getElementById('custom-range-error');
                if (startInput) { startInput.classList.remove('invalid'); }
                if (endInput) { endInput.classList.remove('invalid'); }
                if (errorEl) {
                    errorEl.textContent = '';
                    errorEl.style.display = 'none';
                }
            }

            function applyCustomRange() {
                clearCustomRangeError();
                const start = document.getElementById('custom-start').value;
                const end = document.getElementById('custom-end').value;

                if (!start || !end) {
                    showCustomRangeError('Please select both a start and end date.');
                    return;
                }
                if (!isValidDateInput(start) || !isValidDateInput(end)) {
                    showCustomRangeError('Please enter valid dates.');
                    return;
                }

                vscode.postMessage({ command: 'openTimeTrackingReport', reportPeriod: 'custom', customStartDate: start, customEndDate: end });
            }

            function exportCsv(period, customStartDate, customEndDate) {
                vscode.postMessage({
                    command: 'exportTimeTrackingCsv',
                    reportPeriod: period,
                    customStartDate: customStartDate || undefined,
                    customEndDate: customEndDate || undefined
                });
            }

            function stopActiveTimer(event) {
                if (event) {
                    event.stopPropagation();
                    event.preventDefault();
                }
                vscode.postMessage({ command: 'stopTimeTracking' });
            }

            const sessionsMeta = ${JSON.stringify(displaySessions.map(s => ({ id: s.id, startTime: s.startTime, endTime: s.endTime })))};

            function editSession(sessionId) {
                const row = document.getElementById('session-row-' + sessionId);
                const titleEl = document.getElementById('session-title-' + sessionId);
                const descEl = document.getElementById('session-desc-' + sessionId);
                const durationEl = document.getElementById('session-duration-' + sessionId);
                const title = titleEl ? titleEl.textContent : '';
                const description = descEl ? descEl.textContent : '';
                const duration = durationEl ? durationEl.dataset.seconds : '0';
                const session = sessionsMeta.find(s => s.id === sessionId);

                row.innerHTML = '<td colspan="6"><div class="inline-edit">' +
                    '<div class="field">' +
                        '<label for="edit-title-' + sessionId + '">Title</label>' +
                        '<input type="text" id="edit-title-' + sessionId + '" value="' + (title || '').replace(/"/g, '&quot;') + '" placeholder="Session title">' +
                    '</div>' +
                    '<div class="field">' +
                        '<label for="edit-desc-' + sessionId + '">Description</label>' +
                        '<textarea id="edit-desc-' + sessionId + '" rows="2" placeholder="Optional description">' + (description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</textarea>' +
                    '</div>' +
                    '<div class="inline-edit-row">' +
                        '<div class="field">' +
                            '<label for="edit-start-' + sessionId + '">Start</label>' +
                            '<input type="datetime-local" id="edit-start-' + sessionId + '" value="' + (session ? session.startTime.slice(0, 16) : '') + '">' +
                        '</div>' +
                        '<div class="field">' +
                            '<label for="edit-end-' + sessionId + '">End</label>' +
                            '<input type="datetime-local" id="edit-end-' + sessionId + '" value="' + (session && session.endTime ? session.endTime.slice(0, 16) : '') + '">' +
                        '</div>' +
                        '<div class="field" style="max-width: 120px;">' +
                            '<label for="edit-duration-' + sessionId + '">Duration (s)</label>' +
                            '<input type="number" id="edit-duration-' + sessionId + '" value="' + duration + '" placeholder="Ignored when start and end are set">' +
                        '</div>' +
                    '</div>' +
                    '<div class="inline-edit-actions">' +
                        '<button class="button mini" data-action="saveSession" data-session-id="' + sessionId + '">Save</button>' +
                        '<button class="button mini secondary" data-action="cancelEdit" data-period="${escAttr(period)}">Cancel</button>' +
                    '</div>' +
                '</div></td>';
            }

            function localDateTimeToIso(localValue) {
                if (!localValue) {
                    return undefined;
                }
                return new Date(localValue).toISOString();
            }

            function showInlineError(inputId, message) {
                const input = document.getElementById(inputId);
                if (!input) { return false; }
                input.classList.add('invalid');
                input.title = message;
                return false;
            }

            function clearInlineError(inputId) {
                const input = document.getElementById(inputId);
                if (!input) { return; }
                input.classList.remove('invalid');
                input.title = '';
            }

            function validateSessionForm(titleId, startId, endId, durationId) {
                let valid = true;
                const title = document.getElementById(titleId).value.trim();
                if (!title) {
                    showInlineError(titleId, 'Session title cannot be empty.');
                    valid = false;
                } else {
                    clearInlineError(titleId);
                }

                const startValue = document.getElementById(startId).value;
                const endValue = document.getElementById(endId).value;
                const startTime = startValue ? localDateTimeToIso(startValue) : undefined;
                const endTime = endValue ? localDateTimeToIso(endValue) : undefined;
                if (startTime && endTime && new Date(endTime) < new Date(startTime)) {
                    showInlineError(endId, 'End time cannot be before start time.');
                    valid = false;
                } else {
                    clearInlineError(endId);
                }

                const durationSeconds = parseInt(document.getElementById(durationId).value, 10);
                if (!isNaN(durationSeconds) && durationSeconds < 0) {
                    showInlineError(durationId, 'Duration cannot be negative.');
                    valid = false;
                } else {
                    clearInlineError(durationId);
                }

                return { valid, startTime, endTime, durationSeconds: isNaN(durationSeconds) ? 0 : durationSeconds };
            }

            function saveSession(sessionId) {
                const session = sessionsMeta.find(s => s.id === sessionId);
                const validation = validateSessionForm(
                    'edit-title-' + sessionId,
                    'edit-start-' + sessionId,
                    'edit-end-' + sessionId,
                    'edit-duration-' + sessionId
                );
                if (!validation.valid) {
                    return;
                }

                let durationSeconds = validation.durationSeconds;
                if (validation.startTime && validation.endTime) {
                    durationSeconds = Math.max(0, Math.floor((new Date(validation.endTime).getTime() - new Date(validation.startTime).getTime()) / 1000));
                }

                vscode.postMessage({
                    command: 'updateTimeTrackingSession',
                    sessionId: sessionId,
                    sessionTitle: document.getElementById('edit-title-' + sessionId).value.trim(),
                    sessionDescription: document.getElementById('edit-desc-' + sessionId).value,
                    sessionStartTime: validation.startTime,
                    sessionEndTime: validation.endTime,
                    sessionDurationSeconds: durationSeconds
                });
            }

            function addSession() {
                const form = document.getElementById('add-session-form');
                if (form) {
                    form.style.display = 'block';
                    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }

            function saveNewSession() {
                const validation = validateSessionForm('add-title', 'add-start', 'add-end', 'add-duration');
                if (!validation.valid) {
                    return;
                }

                let durationSeconds = validation.durationSeconds;
                if (validation.startTime && validation.endTime) {
                    durationSeconds = Math.max(0, Math.floor((new Date(validation.endTime).getTime() - new Date(validation.startTime).getTime()) / 1000));
                }

                vscode.postMessage({
                    command: 'addTimeTrackingSession',
                    projectId: document.getElementById('add-project').value,
                    sessionTitle: document.getElementById('add-title').value.trim(),
                    sessionDescription: document.getElementById('add-desc').value,
                    sessionStartTime: validation.startTime,
                    sessionEndTime: validation.endTime,
                    sessionDurationSeconds: durationSeconds
                });
            }

            function cancelAddSession() {
                const form = document.getElementById('add-session-form');
                if (form) {
                    form.style.display = 'none';
                    document.getElementById('add-title').value = '';
                    document.getElementById('add-desc').value = '';
                    document.getElementById('add-start').value = '';
                    document.getElementById('add-end').value = '';
                    document.getElementById('add-duration').value = '';
                }
            }

            let currentSort = { column: 'date', direction: 'desc' };

            let currentGroupBy = '${groupBy}';

            function getSessionBranch(session) {
                if (!session.branchLog || session.branchLog.length === 0) {
                    return 'Unknown, no GIT branch found';
                }
                return session.branchLog[session.branchLog.length - 1].branch;
            }

            function isGrouped() {
                return currentGroupBy !== 'none';
            }

            function filterRows() {
                const filterValue = document.getElementById('session-filter').value.toLowerCase().trim();
                const activeProjectPill = document.querySelector('.report-filter-pill.active');
                const activeProjectFilter = activeProjectPill ? activeProjectPill.dataset.filterProject : undefined;
                const clearButton = document.getElementById('filter-clear');
                if (clearButton) {
                    clearButton.style.display = filterValue || activeProjectFilter ? 'inline-block' : 'none';
                }

                if (isGrouped()) {
                    document.querySelectorAll('.report-branch-group').forEach(group => {
                        let visibleCount = 0;
                        group.querySelectorAll('tbody tr').forEach(row => {
                            const project = row.dataset.project || '';
                            const title = row.dataset.title || '';
                            const branches = row.dataset.branches || '';
                            const matchesText = !filterValue ||
                                project.toLowerCase().includes(filterValue) ||
                                title.toLowerCase().includes(filterValue) ||
                                branches.toLowerCase().includes(filterValue);
                            const matchesProject = !activeProjectFilter || project === activeProjectFilter;
                            const visible = matchesText && matchesProject;
                            row.style.display = visible ? '' : 'none';
                            if (visible) { visibleCount++; }
                        });
                        group.style.display = visibleCount > 0 ? '' : 'none';
                    });
                    return;
                }

                const table = document.getElementById('time-tracking-table');
                if (!table) {
                    return;
                }
                table.querySelectorAll('tbody tr').forEach(row => {
                    const project = row.children[1].textContent.trim();
                    const title = row.children[2].textContent.trim();
                    const branches = row.children[4].textContent.trim();
                    const matchesText = !filterValue ||
                        project.toLowerCase().includes(filterValue) ||
                        title.toLowerCase().includes(filterValue) ||
                        branches.toLowerCase().includes(filterValue);
                    const matchesProject = !activeProjectFilter || project === activeProjectFilter;
                    row.style.display = matchesText && matchesProject ? '' : 'none';
                });
            }

            function updateGroupBy() {
                currentGroupBy = document.getElementById('group-by').value;
                const table = document.getElementById('time-tracking-table');
                const tableWrapper = table ? table.closest('.report-table-wrapper') : null;
                const groups = document.getElementById('branch-groups');
                if (tableWrapper) {
                    tableWrapper.style.display = currentGroupBy === 'none' ? 'block' : 'none';
                }
                if (groups) {
                    groups.style.display = currentGroupBy === 'none' ? 'none' : 'block';
                }
                filterRows();
            }

            document.getElementById('group-by').addEventListener('change', () => {
                updateGroupBy();
                vscode.postMessage({ command: 'openTimeTrackingReport', groupBy: currentGroupBy });
            });

            document.getElementById('branch-groups').addEventListener('click', event => {
                const header = event.target.closest('.report-branch-group-header');
                if (!header) {
                    return;
                }
                const group = header.closest('.report-branch-group');
                if (group) {
                    group.classList.toggle('collapsed');
                }
            });

            document.getElementById('session-filter').addEventListener('input', filterRows);

            document.getElementById('project-filter-pills').addEventListener('click', event => {
                const target = event.target;
                if (!target || !target.classList.contains('report-filter-pill')) {
                    return;
                }
                const isActive = target.classList.contains('active');
                document.querySelectorAll('.report-filter-pill').forEach(pill => pill.classList.remove('active'));
                if (!isActive) {
                    target.classList.add('active');
                }
                filterRows();
            });

            document.getElementById('filter-clear').addEventListener('click', () => {
                document.getElementById('session-filter').value = '';
                document.querySelectorAll('.report-filter-pill').forEach(pill => pill.classList.remove('active'));
                filterRows();
            });

            function sortTable(column) {
                const table = document.getElementById('time-tracking-table');
                if (!table) {
                    return;
                }
                const tbody = table.querySelector('tbody');
                if (!tbody) {
                    return;
                }

                if (currentSort.column === column) {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.column = column;
                    currentSort.direction = 'asc';
                }

                table.querySelectorAll('th.sortable-header').forEach(th => {
                    th.classList.remove('sort-asc', 'sort-desc');
                    if (th.dataset.sort === currentSort.column) {
                        th.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
                    }
                });

                const rows = Array.from(tbody.querySelectorAll('tr'));
                rows.sort((a, b) => {
                    let comparison = 0;
                    switch (column) {
                        case 'date':
                            comparison = new Date(a.dataset.startTime).getTime() - new Date(b.dataset.startTime).getTime();
                            break;
                        case 'project':
                            comparison = a.children[1].textContent.trim().localeCompare(b.children[1].textContent.trim());
                            break;
                        case 'title':
                            comparison = a.children[2].textContent.trim().localeCompare(b.children[2].textContent.trim());
                            break;
                        case 'duration':
                            comparison = parseInt(a.dataset.duration, 10) - parseInt(b.dataset.duration, 10);
                            break;
                        case 'branches':
                            comparison = a.children[4].textContent.trim().localeCompare(b.children[4].textContent.trim());
                            break;
                    }
                    return currentSort.direction === 'asc' ? comparison : -comparison;
                });

                rows.forEach(row => tbody.appendChild(row));
            }

            document.addEventListener('click', event => {
                const target = event.target;
                if (!target || !target.dataset) {
                    return;
                }
                if (target.dataset.sort) {
                    sortTable(target.dataset.sort);
                    return;
                }
                const action = target.dataset.action;
                if (!action) {
                    return;
                }
                switch (action) {
                    case 'setPeriod':
                        vscode.postMessage({ command: 'openTimeTrackingReport', reportPeriod: target.dataset.period });
                        break;
                    case 'applyCustomRange':
                        applyCustomRange();
                        break;
                    case 'exportCsv':
                        vscode.postMessage({
                            command: 'exportTimeTrackingCsv',
                            reportPeriod: target.dataset.period,
                            customStartDate: target.dataset.start || undefined,
                            customEndDate: target.dataset.end || undefined
                        });
                        break;
                    case 'stopActiveTimer':
                        vscode.postMessage({ command: 'stopTimeTracking' });
                        break;
                    case 'continueSession':
                        vscode.postMessage({ command: 'continueTimeTracking', sessionId: target.dataset.sessionId });
                        break;
                    case 'deleteSession':
                        vscode.postMessage({ command: 'deleteTimeTrackingSession', sessionId: target.dataset.sessionId });
                        break;
                    case 'editSession':
                        editSession(target.dataset.sessionId);
                        break;
                    case 'saveSession':
                        saveSession(target.dataset.sessionId);
                        break;
                    case 'cancelEdit':
                        vscode.postMessage({ command: 'openTimeTrackingReport', reportPeriod: target.dataset.period });
                        break;
                    case 'addSession':
                        addSession();
                        break;
                    case 'saveNewSession':
                        saveNewSession();
                        break;
                    case 'cancelAddSession':
                        cancelAddSession();
                        break;
                    case 'deleteAllSessions':
                        vscode.postMessage({ command: 'confirmDeleteAllTimeTrackingSessions' });
                        break;
                }
            });

            window.addEventListener('message', event => {
                const message = event.data;
                if ((message.command === 'timeTrackingState' || message.command === 'timeTrackingTick') && message.activeSession) {
                    const durationSeconds = message.activeSession.durationSeconds || 0;

                    const banner = document.querySelector('.report-active-banner .report-active-time');
                    if (banner && banner.dataset.activeSessionId === message.activeSession.id) {
                        banner.textContent = formatDuration(durationSeconds);
                    }

                    const activeRowDuration = document.getElementById('session-duration-' + message.activeSession.id);
                    if (activeRowDuration) {
                        const delta = durationSeconds - Number(activeRowDuration.dataset.seconds || 0);
                        activeRowDuration.textContent = formatDuration(durationSeconds);
                        activeRowDuration.dataset.seconds = String(durationSeconds);
                        const row = activeRowDuration.closest('tr');
                        if (row) {
                            row.dataset.duration = String(durationSeconds);
                        }

                        const group = activeRowDuration.closest('.report-branch-group');
                        if (group) {
                            const groupDurationEl = group.querySelector('.branch-group-duration');
                            if (groupDurationEl) {
                                const currentTotal = Number(groupDurationEl.dataset.groupDuration || 0);
                                groupDurationEl.dataset.groupDuration = String(currentTotal + delta);
                                groupDurationEl.textContent = formatDuration(currentTotal + delta);
                            }
                        }

                        const summaryTotalEl = document.getElementById('summary-total-time');
                        if (summaryTotalEl) {
                            const currentTotal = Number(summaryTotalEl.dataset.totalSeconds || 0);
                            const newTotal = currentTotal + delta;
                            summaryTotalEl.dataset.totalSeconds = String(newTotal);
                            summaryTotalEl.textContent = formatDuration(newTotal);
                        }

                        const summaryAvgEl = document.getElementById('summary-daily-avg');
                        const summaryCountEl = document.getElementById('summary-session-count');
                        if (summaryAvgEl && summaryCountEl) {
                            const count = Number(summaryCountEl.textContent || 1);
                            const currentTotal = Number(summaryTotalEl?.dataset.totalSeconds || 0);
                            summaryAvgEl.textContent = formatDuration(Math.round(currentTotal / Math.max(1, count)));
                        }
                    }
                }
            });

            function formatDuration(totalSeconds) {
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                if (hours > 0) {
                    return hours + 'h ' + minutes.toString().padStart(2, '0') + 'm ' + seconds.toString().padStart(2, '0') + 's';
                }
                if (minutes > 0) {
                    return minutes + 'm ' + seconds.toString().padStart(2, '0') + 's';
                }
                return seconds + 's';
            }
        </script>
    </body>
    </html>`;
}

function renderGroups(
    sessions: TimeTrackingSession[],
    projectById: Map<string, Project>,
    projectNameById: Map<string, string>,
    getProjectColorHex: (projectId: string) => string,
    activeSessionId?: string,
    groupBy: 'none' | 'project' | 'title' | 'branch' | 'branchAndDate' = 'branch',
    activeSession?: { sessionId: string; accumulatedSeconds: number; lastTickAt: number },
    context?: vscode.ExtensionContext,
    useFavicons?: boolean
): string {
    if (sessions.length === 0) {
        return '';
    }

    const groups = new Map<string, { label: string; projectId: string; sessions: TimeTrackingSession[] }>();
    for (const session of sessions) {
        const branch = sessionBranchDisplayName(session);
        const projectName = projectNameById.get(session.projectId) || session.projectId;
        let key: string;
        let label: string;
        switch (groupBy) {
            case 'project':
                key = session.projectId;
                label = projectName;
                break;
            case 'title':
                key = `${session.projectId}::${session.title}`;
                label = `${projectName} — ${session.title}`;
                break;
            case 'branchAndDate':
                key = `${session.projectId}::${branch}::${new Date(session.startTime).toLocaleDateString()}`;
                label = `${projectName} — ${branch} — ${new Date(session.startTime).toLocaleDateString()}`;
                break;
            case 'branch':
            default:
                key = `${session.projectId}::${branch}`;
                label = `${projectName} — ${branch}`;
                break;
        }
        const existing = groups.get(key);
        if (existing) {
            existing.sessions.push(session);
        } else {
            groups.set(key, { label, projectId: session.projectId, sessions: [session] });
        }
    }

    const sortedKeys = [...groups.keys()].sort((a, b) => {
        const aSessions = groups.get(a)!.sessions;
        const bSessions = groups.get(b)!.sessions;
        const aStart = aSessions[0]?.startTime;
        const bStart = bSessions[0]?.startTime;
        if (!aStart || !bStart) {
            return 0;
        }
        return new Date(bStart).getTime() - new Date(aStart).getTime();
    });

    return sortedKeys.map(key => {
        const { label, projectId, sessions } = groups.get(key)!;
        const projectColor = getProjectColorHex(projectId);
        const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
        return `
            <div class="report-branch-group" data-group-key="${escAttr(key)}">
                <div class="report-branch-group-header" style="${projectColor ? `--project-color: ${escAttr(projectColor)}` : ''}">
                    <span class="branch-group-toggle">▼</span>
                    <span class="branch-group-color"></span>
                    <span class="branch-group-name">${escHtml(label)}</span>
                    <span class="branch-group-count">${sessions.length} session${sessions.length === 1 ? '' : 's'}</span>
                    <span class="branch-group-duration" data-group-duration="${totalSeconds}">${formatDuration(totalSeconds)}</span>
                </div>
                <div class="report-table-wrapper">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Date and Time</th>
                                <th>Title</th>
                                <th>Duration</th>
                                <th>Branches</th>
                                <th class="actions-header">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sessions.map(session => renderSessionRow(session, projectById.get(session.projectId), projectNameById, projectColor, activeSessionId === session.id, true, activeSession, context, useFavicons)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');
}

function sessionBranchDisplayName(session: TimeTrackingSession): string {
    if (session.branchLog.length === 0) {
        return 'Unknown, no GIT branch found';
    }
    return session.branchLog[session.branchLog.length - 1].branch;
}

function renderSessionRow(session: TimeTrackingSession, project: Project | undefined, projectNameById: Map<string, string>, projectColor: string = '', isActive: boolean = false, compact: boolean = false, activeSession?: { sessionId: string; accumulatedSeconds: number; lastTickAt: number }, context?: vscode.ExtensionContext, useFavicons?: boolean): string {
    const startDate = new Date(session.startTime);
    const date = startDate.toLocaleDateString();
    const time = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const projectName = projectNameById.get(session.projectId) || session.projectId;
    const iconHtml = project && context ? `<span class="report-project-icon">${getProjectIconHtml(context, project, useFavicons ?? true)}</span>` : '';
    const UNKNOWN_BRANCH = 'Unknown, no GIT branch found';
    // Collapse consecutive identical branches and prefer the last real branch.
    const cleanedBranchLog = session.branchLog.reduce<{ branch: string; changedAt: string }[]>((acc, change) => {
        if (change.branch === UNKNOWN_BRANCH && acc.some(c => c.branch !== UNKNOWN_BRANCH)) {
            return acc;
        }
        if (acc.length > 0 && acc[acc.length - 1].branch === change.branch) {
            return acc;
        }
        acc.push(change);
        return acc;
    }, []);
    const branchLogEntries = (cleanedBranchLog.length > 0 ? cleanedBranchLog : session.branchLog).slice(-5);
    const branches = branchLogEntries.map((change, index) => `
        <div class="branch-entry">
            <span class="branch-name">${index > 0 ? '→ ' : ''}${escHtml(change.branch)}</span>
        </div>
    `).join('');
    const colorStyle = projectColor ? `style="--project-color: ${escAttr(projectColor)}"` : '';
    const activeClass = isActive ? 'session-row-active' : '';
    const activeIndicator = isActive ? '<span class="session-row-live-indicator" title="Running"><span class="session-row-live-dot"></span>running</span>' : '';

    const liveDurationSeconds = getLiveDurationSeconds(session, activeSession);
    const branchNames = (cleanedBranchLog.length > 0 ? cleanedBranchLog : session.branchLog).map(change => change.branch).join(' → ');
    const dataAttrs = `data-start-time="${escAttr(session.startTime)}" data-duration="${liveDurationSeconds}" data-project="${escAttr(projectName)}" data-title="${escAttr(session.title)}" data-branches="${escAttr(branchNames)}"`;

    if (compact) {
        return `
            <tr id="session-row-${escAttr(session.id)}" class="${activeClass}" ${dataAttrs} ${colorStyle}>
                <td><span class="project-color-dot" ${colorStyle}></span><span class="session-date">${escHtml(date)}</span><span class="session-time">${escHtml(time)}</span></td>
                <td>
                    <div id="session-title-${escAttr(session.id)}">${activeIndicator}${escHtml(session.title)}</div>
                    ${session.description ? `<small id="session-desc-${escAttr(session.id)}">${escHtml(session.description)}</small>` : ''}
                </td>
                <td id="session-duration-${escAttr(session.id)}" data-seconds="${liveDurationSeconds}">${formatDuration(liveDurationSeconds)}</td>
                <td>
                    <div class="branch-timeline">
                        ${branches || '<span class="branch-entry">–</span>'}
                    </div>
                </td>
                <td class="session-actions">
                    ${isActive ? '' : `<button class="button mini" data-action="continueSession" data-session-id="${escAttr(session.id)}" title="Continue">Continue</button>`}
                    <button class="button mini" data-action="editSession" data-session-id="${escAttr(session.id)}" title="Edit">Edit</button>
                    <button class="button mini secondary" data-action="deleteSession" data-session-id="${escAttr(session.id)}" title="Delete">Delete</button>
                </td>
            </tr>
        `;
    }

    return `
        <tr id="session-row-${escAttr(session.id)}" class="${activeClass}" ${dataAttrs} ${colorStyle}>
            <td><span class="project-color-dot" ${colorStyle}></span><span class="session-date">${escHtml(date)}</span><span class="session-time">${escHtml(time)}</span></td>
            <td>${iconHtml}${escHtml(projectName)}</td>
            <td>
                <div id="session-title-${escAttr(session.id)}">${activeIndicator}${escHtml(session.title)}</div>
                ${session.description ? `<small id="session-desc-${escAttr(session.id)}">${escHtml(session.description)}</small>` : ''}
            </td>
            <td id="session-duration-${escAttr(session.id)}" data-seconds="${liveDurationSeconds}">${formatDuration(liveDurationSeconds)}</td>
            <td>
                <div class="branch-timeline">
                    ${branches || '<span class="branch-entry">–</span>'}
                </div>
            </td>
            <td class="session-actions">
                ${isActive ? '' : `<button class="button mini" data-action="continueSession" data-session-id="${escAttr(session.id)}" title="Continue">Continue</button>`}
                <button class="button mini" data-action="editSession" data-session-id="${escAttr(session.id)}" title="Edit">Edit</button>
                <button class="button mini secondary" data-action="deleteSession" data-session-id="${escAttr(session.id)}" title="Delete">Delete</button>
            </td>
        </tr>
    `;
}
