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

function getPeriodBounds(period: 'today' | 'week' | 'month' | 'custom', customStart?: string, customEnd?: string): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
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
    period: 'today' | 'week' | 'month' | 'custom' = 'week',
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
    const projects = config.get<{ id: string; name: string }[]>('projects') || [];
    const projectNameById = new Map(projects.map(p => [p.id, p.name]));

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
            <div class="time-tracking-empty">
                <div class="time-tracking-empty-icon">⏱</div>
                <h3>No sessions for this period</h3>
                <p>Start tracking time from a project in the sidebar to see it here.</p>
            </div>
        `
        : `
            <div class="time-tracking-summary">
                <div class="summary-card">
                    <span class="summary-label">Total time</span>
                    <span class="summary-value">${formatDuration(totalSeconds)}</span>
                </div>
                <div class="summary-card">
                    <span class="summary-label">Sessions</span>
                    <span class="summary-value">${filteredSessions.length}</span>
                </div>
            </div>
            <div class="time-tracking-table-wrapper">
                <table class="time-tracking-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Project</th>
                            <th>Title</th>
                            <th>Duration</th>
                            <th>Branches</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredSessions.map(session => renderSessionRow(session, projectNameById)).join('')}
                    </tbody>
                </table>
            </div>
        `;

    const activeBanner = activeSession
        ? `
            <div class="time-tracking-active-banner">
                <span class="active-indicator"></span>
                <span>Timer running: <strong>${escHtml(activeSession.title)}</strong></span>
                <span class="active-time" data-active-session-id="${escAttr(activeSession.id)}">${formatDuration(activeSession.durationSeconds)}</span>
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

            .time-tracking-report {
                max-width: 960px;
                margin: 0 auto;
                padding: 24px;
            }

            .time-tracking-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 24px;
                flex-wrap: wrap;
            }

            .time-tracking-header h1 {
                margin: 0;
                font-size: 1.5rem;
            }

            .time-tracking-period {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }

            .time-tracking-period button {
                background: transparent;
                border: 1px solid var(--vscode-button-border, transparent);
                color: var(--vscode-foreground);
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
            }

            .time-tracking-period button.active {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }

            .time-tracking-custom-range {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .time-tracking-custom-range input {
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                padding: 4px 8px;
            }

            .time-tracking-active-banner {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 6px;
                margin-bottom: 24px;
            }

            .active-indicator {
                width: 10px;
                height: 10px;
                background: var(--vscode-testing-iconPassed);
                border-radius: 50%;
                animation: pulse 1.5s infinite;
            }

            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.4; }
                100% { opacity: 1; }
            }

            .active-time {
                font-variant-numeric: tabular-nums;
                font-weight: 600;
                margin-left: auto;
            }

            .time-tracking-summary {
                display: flex;
                gap: 16px;
                margin-bottom: 24px;
            }

            .summary-card {
                flex: 1;
                min-width: 120px;
                padding: 16px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 6px;
                display: flex;
                flex-direction: column;
            }

            .summary-label {
                font-size: 0.85rem;
                opacity: 0.8;
            }

            .summary-value {
                font-size: 1.5rem;
                font-weight: 600;
                margin-top: 4px;
            }

            .time-tracking-table-wrapper {
                overflow-x: auto;
            }

            .time-tracking-table {
                width: 100%;
                border-collapse: collapse;
            }

            .time-tracking-table th,
            .time-tracking-table td {
                text-align: left;
                padding: 10px 12px;
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .time-tracking-table th {
                font-weight: 600;
                opacity: 0.8;
                font-size: 0.85rem;
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
                gap: 6px;
            }

            .time-tracking-empty {
                text-align: center;
                padding: 48px 24px;
                opacity: 0.8;
            }

            .time-tracking-empty h3 {
                margin: 16px 0 8px;
            }

            .time-tracking-empty p {
                margin: 0 0 16px;
            }

            .inline-edit {
                display: flex;
                flex-direction: column;
                gap: 16px;
                padding: 16px;
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            }

            .inline-edit input,
            .inline-edit textarea {
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                padding: 8px 10px;
                font-family: inherit;
                font-size: 0.95rem;
                outline: none;
            }

            .inline-edit input:not(:focus),
            .inline-edit textarea:not(:focus) {
                border-color: var(--vscode-input-border, #6e6e6e);
                box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
            }

            .inline-edit input:focus,
            .inline-edit textarea:focus {
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 0 0 1px var(--vscode-focusBorder), inset 0 1px 2px rgba(0, 0, 0, 0.2);
            }

            .inline-edit textarea {
                min-height: 60px;
                resize: vertical;
            }

            .inline-edit-row {
                display: flex;
                gap: 12px;
                align-items: flex-end;
            }

            .inline-edit > .field,
            .inline-edit-row .field {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 6px;
                min-width: 0;
            }

            .inline-edit label {
                font-size: 0.8rem;
                font-weight: 600;
                opacity: 0.9;
                white-space: nowrap;
            }

            .inline-edit input,
            .inline-edit textarea {
                width: 100%;
                box-sizing: border-box;
            }

            .inline-edit-actions {
                display: flex;
                gap: 8px;
                margin-top: 4px;
            }

            .time-tracking-toolbar {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-bottom: 16px;
            }

            .add-session-edit select {
                background: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 4px;
                padding: 8px 10px;
                font-family: inherit;
                font-size: 0.95rem;
                outline: none;
                width: 100%;
                box-sizing: border-box;
            }
        </style>
    </head>
    <body>
        <div class="time-tracking-report">
            <div class="time-tracking-header">
                <h1>Time Tracking Report</h1>
                <div class="time-tracking-period">
                    <button class="${period === 'today' ? 'active' : ''}" data-action="setPeriod" data-period="today">Today</button>
                    <button class="${period === 'week' ? 'active' : ''}" data-action="setPeriod" data-period="week">This Week</button>
                    <button class="${period === 'month' ? 'active' : ''}" data-action="setPeriod" data-period="month">This Month</button>
                    <button class="${period === 'custom' ? 'active' : ''}" data-action="setPeriod" data-period="custom">Custom</button>
                </div>
            </div>

            ${period === 'custom' ? `
                <div class="time-tracking-custom-range">
                    <label>From</label>
                    <input type="date" id="custom-start" value="${escAttr(customStartDate || start.toISOString().split('T')[0])}">
                    <label>To</label>
                    <input type="date" id="custom-end" value="${escAttr(customEndDate || end.toISOString().split('T')[0])}">
                    <button class="button mini" data-action="applyCustomRange">Apply</button>
                </div>
            ` : ''}

            ${activeBanner}

            <div class="time-tracking-toolbar">
                <button class="button mini" data-action="addSession">+ Add Session</button>
                ${filteredSessions.length > 0 ? `
                    <button class="button mini" data-action="exportCsv" data-period="${escAttr(period)}" data-start="${escAttr(customStartDate || '')}" data-end="${escAttr(customEndDate || '')}">Export CSV</button>
                ` : ''}
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

            document.addEventListener('click', event => {
                const target = event.target;
                if (!target || !target.dataset) {
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

function renderSessionRow(session: TimeTrackingSession, projectNameById: Map<string, string>): string {
    const date = new Date(session.startTime).toLocaleDateString();
    const projectName = projectNameById.get(session.projectId) || session.projectId;
    const branches = session.branchLog.map((change, index) => `
        <div class="branch-entry">
            <span class="branch-name">${index > 0 ? '→ ' : ''}${escHtml(change.branch)}</span>
            <span class="branch-time">${new Date(change.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
    `).join('');

    return `
        <tr id="session-row-${escAttr(session.id)}">
            <td>${escHtml(date)}</td>
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
