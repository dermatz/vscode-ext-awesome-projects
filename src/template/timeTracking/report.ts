import * as vscode from 'vscode';
import { TimeTrackingService } from '../../timeTrackingService';
import { TimeTrackingSession } from '../../types/timeTracking';
import { loadResourceFile } from '../utils/resourceLoader';
import { escHtml, escAttr } from '../utils/escaping';

function formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

export function getPeriodBounds(period: 'today' | 'week' | 'month' | 'lastMonth' | 'all' | 'custom', customStart?: string, customEnd?: string): { start: Date; end: Date } {
    const now = new Date();
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    switch (period) {
        case 'today':
            break;
        case 'week':
            start.setDate(start.getDate() - start.getDay());
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            break;
        case 'lastMonth':
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            break;
        case 'all':
            start = new Date(1970, 0, 1, 0, 0, 0, 0);
            end = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
            break;
        case 'custom':
            start = customStart ? new Date(customStart) : start;
            end.setTime(customEnd ? new Date(customEnd).getTime() : now.getTime());
            if (customEnd) {
                end.setHours(23, 59, 59, 999);
            }
            break;
    }

    return { start, end };
}

export async function getTimeTrackingReportHtml(
    context: vscode.ExtensionContext,
    webview: vscode.Webview,
    timeTrackingService: TimeTrackingService,
    period: 'today' | 'week' | 'month' | 'lastMonth' | 'all' | 'custom' = 'week',
    customStartDate?: string,
    customEndDate?: string
): Promise<string> {
    let baseCss = '';
    try {
        baseCss = await loadResourceFile(context, 'dist/css/webview.css');
    } catch {
        baseCss = await loadResourceFile(context, 'src/css/webview.css').catch(() => '');
    }

    const config = vscode.workspace.getConfiguration('awesomeProjects');
    const projects = config.get<{ id: string; name: string; color?: string }[]>('projects') || [];
    const projectNameById = new Map(projects.map(p => [p.id, p.name]));
    const projectColorById = new Map(projects.map(p => [p.id, p.color || '']));

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

    const { start, end } = getPeriodBounds(period, customStartDate, customEndDate);
    const filteredSessions = allSessions.filter(session => {
        const sessionDate = new Date(session.startTime);
        return sessionDate >= start && sessionDate <= end;
    });

    const totalSeconds = filteredSessions.reduce((sum, session) => sum + session.durationSeconds, 0);
    const activeSession = state.activeSession ? timeTrackingService.getActiveSessionFull() : undefined;

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
                    <span class="report-summary-value">${formatDuration(totalSeconds)}</span>
                </div>
                <div class="report-summary-card">
                    <span class="report-summary-label">Sessions</span>
                    <span class="report-summary-value">${filteredSessions.length}</span>
                </div>
                <div class="report-summary-card">
                    <span class="report-summary-label">Projects</span>
                    <span class="report-summary-value">${new Set(filteredSessions.map(s => s.projectId)).size}</span>
                </div>
                <div class="report-summary-card">
                    <span class="report-summary-label">Daily Avg</span>
                    <span class="report-summary-value">${formatDuration(Math.round(totalSeconds / Math.max(1, filteredSessions.length)))}</span>
                </div>
            </div>
            <div class="report-table-wrapper">
                <table class="report-table" id="time-tracking-table">
                    <thead>
                        <tr>
                            <th class="sortable-header sort-desc" data-sort="date">Date</th>
                            <th class="sortable-header" data-sort="project">Project</th>
                            <th class="sortable-header" data-sort="title">Title</th>
                            <th class="sortable-header" data-sort="duration">Duration</th>
                            <th class="sortable-header" data-sort="branches">Branches</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredSessions.map(session => renderSessionRow(session, projectNameById, getProjectColorHex(session.projectId))).join('')}
                    </tbody>
                </table>
            </div>
        `;

    const activeBanner = activeSession
        ? `
            <div class="report-active-banner">
                <span class="report-active-indicator"></span>
                <span>Timer running: <strong>${escHtml(activeSession.title)}</strong></span>
                <span class="report-active-time" data-active-session-id="${escAttr(activeSession.id)}">${formatDuration(activeSession.durationSeconds)}</span>
                <button class="button mini" data-action="stopActiveTimer">Stop</button>
            </div>
        `
        : '';

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

            .report-active-banner {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 16px 20px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 12px;
                margin-bottom: 24px;
                border-left: 4px solid var(--vscode-testing-iconPassed);
            }

            .report-active-indicator {
                width: 10px;
                height: 10px;
                background: var(--vscode-testing-iconPassed);
                border-radius: 50%;
                animation: pulse 1.5s infinite;
                flex-shrink: 0;
            }

            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.4; }
                100% { opacity: 1; }
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
                border-collapse: separate;
                border-spacing: 0;
            }

            .report-table th,
            .report-table td {
                text-align: left;
                padding: 14px 16px;
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .report-table tbody tr:last-child td {
                border-bottom: none;
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

            .report-table tbody tr[style*="--project-color"] {
                border-left-color: var(--project-color);
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

            .branch-time {
                opacity: 0.6;
                white-space: nowrap;
            }

            .session-actions {
                display: flex;
                gap: 8px;
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
                <div class="report-period-tabs">
                    <button class="${period === 'today' ? 'active' : ''}" data-action="setPeriod" data-period="today">Today</button>
                    <button class="${period === 'week' ? 'active' : ''}" data-action="setPeriod" data-period="week">This Week</button>
                    <button class="${period === 'month' ? 'active' : ''}" data-action="setPeriod" data-period="month">This Month</button>
                    <button class="${period === 'lastMonth' ? 'active' : ''}" data-action="setPeriod" data-period="lastMonth">Last Month</button>
                    <button class="${period === 'all' ? 'active' : ''}" data-action="setPeriod" data-period="all">All</button>
                    <button class="${period === 'custom' ? 'active' : ''}" data-action="setPeriod" data-period="custom">Custom</button>
                </div>
            </div>

            ${period === 'custom' ? `
                <div class="report-custom-range">
                    <label>From</label>
                    <input type="date" id="custom-start" value="${escAttr(customStartDate || start.toISOString().split('T')[0])}">
                    <label>To</label>
                    <input type="date" id="custom-end" value="${escAttr(customEndDate || end.toISOString().split('T')[0])}">
                    <button class="button mini" data-action="applyCustomRange">Apply</button>
                </div>
            ` : ''}

            ${activeBanner}

            <div class="report-toolbar">
                <div class="report-toolbar-group">
                    <button class="button" data-action="addSession">+ Add Session</button>
                </div>
                <div class="report-toolbar-group">
                    ${filteredSessions.length > 0 ? `
                        <button class="button mini secondary" data-action="exportCsv" data-period="${escAttr(period)}" data-start="${escAttr(customStartDate || '')}" data-end="${escAttr(customEndDate || '')}">Export CSV</button>
                        <button class="button mini danger" data-action="deleteAllSessions">Delete All</button>
                    ` : ''}
                </div>
            </div>

            <div class="report-filter-bar">
                <input type="text" id="session-filter" placeholder="Filter by project, title, branch...">
                <div class="report-filter-pills" id="project-filter-pills">
                    ${[...new Set(filteredSessions.map(s => projectNameById.get(s.projectId) || s.projectId))].sort().map(name => `<button class="report-filter-pill" data-filter-project="${escAttr(name)}">${escHtml(name)}</button>`).join('')}
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
                        <input type="number" id="add-duration" placeholder="Seconds">
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

            function applyCustomRange() {
                const start = document.getElementById('custom-start').value;
                const end = document.getElementById('custom-end').value;
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

            function stopActiveTimer() {
                vscode.postMessage({ command: 'stopTimeTracking' });
            }

            const sessionsMeta = ${JSON.stringify(filteredSessions.map(s => ({ id: s.id, startTime: s.startTime, endTime: s.endTime })))};

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
                            '<input type="number" id="edit-duration-' + sessionId + '" value="' + duration + '" placeholder="Seconds">' +
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

            function saveSession(sessionId) {
                const session = sessionsMeta.find(s => s.id === sessionId);
                const startValue = document.getElementById('edit-start-' + sessionId).value;
                const endValue = document.getElementById('edit-end-' + sessionId).value;

                const startTime = startValue ? localDateTimeToIso(startValue) : (session ? session.startTime : undefined);
                const endTime = endValue ? localDateTimeToIso(endValue) : (session ? session.endTime : undefined);

                let durationSeconds = parseInt(document.getElementById('edit-duration-' + sessionId).value, 10) || 0;
                if (startTime && endTime) {
                    durationSeconds = Math.max(0, Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000));
                }

                vscode.postMessage({
                    command: 'updateTimeTrackingSession',
                    sessionId: sessionId,
                    sessionTitle: document.getElementById('edit-title-' + sessionId).value,
                    sessionDescription: document.getElementById('edit-desc-' + sessionId).value,
                    sessionStartTime: startTime,
                    sessionEndTime: endTime,
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
                const startValue = document.getElementById('add-start').value;
                const endValue = document.getElementById('add-end').value;
                let durationSeconds = parseInt(document.getElementById('add-duration').value, 10) || 0;

                const startTime = startValue ? localDateTimeToIso(startValue) : undefined;
                const endTime = endValue ? localDateTimeToIso(endValue) : undefined;

                if (startTime && endTime) {
                    durationSeconds = Math.max(0, Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000));
                }

                vscode.postMessage({
                    command: 'addTimeTrackingSession',
                    projectId: document.getElementById('add-project').value,
                    sessionTitle: document.getElementById('add-title').value,
                    sessionDescription: document.getElementById('add-desc').value,
                    sessionStartTime: startTime,
                    sessionEndTime: endTime,
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

            function filterRows() {
                const table = document.getElementById('time-tracking-table');
                if (!table) {
                    return;
                }
                const filterValue = document.getElementById('session-filter').value.toLowerCase().trim();
                const activeProjectPill = document.querySelector('.report-filter-pill.active');
                const activeProjectFilter = activeProjectPill ? activeProjectPill.dataset.filterProject : undefined;
                const clearButton = document.getElementById('filter-clear');
                if (clearButton) {
                    clearButton.style.display = filterValue || activeProjectFilter ? 'inline-block' : 'none';
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
                        vscode.postMessage({
                            command: 'openTimeTrackingReport',
                            reportPeriod: 'custom',
                            customStartDate: document.getElementById('custom-start').value,
                            customEndDate: document.getElementById('custom-end').value
                        });
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
                        if (confirm('Are you sure you want to delete all sessions in this period? This cannot be undone.')) {
                            vscode.postMessage({ command: 'deleteTimeTrackingSession', sessionId: 'ALL_FILTERED' });
                        }
                        break;
                }
            });

            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'timeTrackingState' && message.activeSession) {
                    const banner = document.querySelector('.time-tracking-active-banner .active-time');
                    if (banner && banner.dataset.activeSessionId === message.activeSession.id) {
                        banner.textContent = formatDuration(message.activeSession.durationSeconds || 0);
                    }
                }
            });

            function formatDuration(totalSeconds) {
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                if (hours > 0) {
                    return hours + ':' + minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
                }
                return minutes + ':' + seconds.toString().padStart(2, '0');
            }
        </script>
    </body>
    </html>`;
}

function renderSessionRow(session: TimeTrackingSession, projectNameById: Map<string, string>, projectColor: string = ''): string {
    const date = new Date(session.startTime).toLocaleDateString();
    const projectName = projectNameById.get(session.projectId) || session.projectId;
    const branches = session.branchLog.map((change, index) => `
        <div class="branch-entry">
            <span class="branch-name">${index > 0 ? '→ ' : ''}${escHtml(change.branch)}</span>
            <span class="branch-time">${new Date(change.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
    `).join('');
    const colorStyle = projectColor ? `style="--project-color: ${escAttr(projectColor)}"` : '';

    return `
        <tr id="session-row-${escAttr(session.id)}" data-start-time="${escAttr(session.startTime)}" data-duration="${session.durationSeconds}" ${colorStyle}>
            <td><span class="project-color-dot" ${colorStyle}></span>${escHtml(date)}</td>
            <td>${escHtml(projectName)}</td>
            <td>
                <div id="session-title-${escAttr(session.id)}">${escHtml(session.title)}</div>
                ${session.description ? `<small id="session-desc-${escAttr(session.id)}">${escHtml(session.description)}</small>` : ''}
            </td>
            <td id="session-duration-${escAttr(session.id)}" data-seconds="${session.durationSeconds}">${formatDuration(session.durationSeconds)}</td>
            <td>
                <div class="branch-timeline">
                    ${branches || '<span class="branch-entry">–</span>'}
                </div>
            </td>
            <td class="session-actions">
                <button class="button mini" data-action="editSession" data-session-id="${escAttr(session.id)}" title="Edit">Edit</button>
                <button class="button mini secondary" data-action="deleteSession" data-session-id="${escAttr(session.id)}" title="Delete">Delete</button>
            </td>
        </tr>
    `;
}
