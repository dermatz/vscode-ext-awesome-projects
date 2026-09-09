import * as vscode from 'vscode';
import { TimeTrackingService } from '../../timeTrackingService';
import { TimeTrackingSession } from '../../types/timeTracking';
import { Project } from '../../extension';
import { loadResourceFile } from '../utils/resourceLoader';
import { escHtml, escAttr } from '../utils/escaping';
import { formatDuration } from '../utils/formatDuration';
import { getProjectIconHtml } from '../project/utils/projectIcon';
import { getReportScriptHtml } from './reportScript';
import { getReportCssHtml } from './reportCss';

function getUtcStartOfDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function getUtcEndOfDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function isValidDateString(value: string): boolean {
    if (!value || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
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

function getTodayBounds(now: Date): { start: Date; end: Date } {
    return { start: getUtcStartOfDay(now), end: getUtcEndOfDay(now) };
}

function getWeekBounds(now: Date, weekStartsOn: number): { start: Date; end: Date } {
    const offset = getWeekStartOffset(weekStartsOn);
    return {
        start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset, 0, 0, 0, 0)),
        end: getUtcEndOfDay(now)
    };
}

function getMonthBounds(now: Date): { start: Date; end: Date } {
    return {
        start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)),
        end: getUtcEndOfDay(now)
    };
}

function getLastMonthBounds(now: Date): { start: Date; end: Date } {
    return {
        start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0)),
        end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999))
    };
}

function getAllBounds(): { start: Date; end: Date } {
    return {
        start: new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0)),
        end: new Date(8640000000000000)
    };
}

function getCustomBounds(
    now: Date,
    customStart?: string,
    customEnd?: string
): { start: Date; end: Date } {
    const customStartDate = customStart && isValidDateString(customStart) ? new Date(customStart) : undefined;
    const customEndDate = customEnd && isValidDateString(customEnd) ? new Date(customEnd) : undefined;
    let start = customStartDate ? getUtcStartOfDay(customStartDate) : getUtcStartOfDay(now);
    let end = customEndDate ? getUtcEndOfDay(customEndDate) : getUtcEndOfDay(now);
    if (start > end) {
        return { start: end, end: start };
    }
    return { start, end };
}

const periodBoundFactories: Record<
    'today' | 'week' | 'month' | 'lastMonth' | 'all' | 'custom',
    (now: Date, customStart?: string, customEnd?: string, weekStartsOn?: number) => { start: Date; end: Date }
> = {
    today: (now) => getTodayBounds(now),
    week: (now, _cs, _ce, weekStartsOn) => getWeekBounds(now, weekStartsOn ?? 0),
    month: (now) => getMonthBounds(now),
    lastMonth: (now) => getLastMonthBounds(now),
    all: () => getAllBounds(),
    custom: (now, customStart, customEnd) => getCustomBounds(now, customStart, customEnd)
};

export function getPeriodBounds(
    period: 'today' | 'week' | 'month' | 'lastMonth' | 'all' | 'custom',
    customStart?: string,
    customEnd?: string,
    weekStartsOn: number = 0
): { start: Date; end: Date } {
    return periodBoundFactories[period](new Date(), customStart, customEnd, weekStartsOn);
}

interface ReportViewModel {
    projects: Project[];
    projectById: Map<string, Project>;
    projectNameById: Map<string, string>;
    projectColorById: Map<string, string>;
    useFavicons: boolean;
    period: 'today' | 'week' | 'month' | 'lastMonth' | 'all' | 'custom';
    customStartDate?: string;
    customEndDate?: string;
    groupBy: 'none' | 'project' | 'title' | 'branch' | 'branchAndDate';
    start: Date;
    end: Date;
    activeSession?: TimeTrackingSession;
    activeSessionId?: string;
    activeTimer?: { sessionId: string; accumulatedSeconds: number; lastTickAt: number };
    allSessions: TimeTrackingSession[];
    filteredSessions: TimeTrackingSession[];
    displaySessions: TimeTrackingSession[];
    hasMoreSessions: boolean;
    totalSeconds: number;
}

interface SessionRowContext {
    session: TimeTrackingSession;
    project: Project | undefined;
    projectNameById: Map<string, string>;
    projectColor: string;
    isActive: boolean;
    compact: boolean;
    activeTimer?: { sessionId: string; accumulatedSeconds: number; lastTickAt: number };
    context?: vscode.ExtensionContext;
    useFavicons?: boolean;
}

async function loadBaseCss(context: vscode.ExtensionContext): Promise<string> {
    try {
        return await loadResourceFile(context, 'dist/css/webview.css');
    } catch {
        return await loadResourceFile(context, 'src/css/webview.css').catch(() => '');
    }
}

function getProjectColorHex(projectColorById: Map<string, string>, projectId: string): string {
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

function buildReportViewModel(
    timeTrackingService: TimeTrackingService,
    config: vscode.WorkspaceConfiguration,
    period: 'today' | 'week' | 'month' | 'lastMonth' | 'all' | 'custom',
    customStartDate?: string,
    customEndDate?: string,
    groupBy: 'none' | 'project' | 'title' | 'branch' | 'branchAndDate' = 'none'
): ReportViewModel {
    const projects = config.get<Project[]>('projects') || [];
    const projectById = new Map(projects.map(p => [p.id, p]));
    const projectNameById = new Map(projects.map(p => [p.id, p.name]));
    const projectColorById = new Map(projects.map(p => [p.id, p.color || '']));
    const useFavicons = config.get<boolean>('useFavicons', true);

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

    return {
        projects,
        projectById,
        projectNameById,
        projectColorById,
        useFavicons,
        period,
        customStartDate,
        customEndDate,
        groupBy,
        start,
        end,
        activeSession,
        activeSessionId,
        activeTimer: state.activeSession,
        allSessions,
        filteredSessions,
        displaySessions,
        hasMoreSessions,
        totalSeconds
    };
}

function renderActiveBanner(activeSession: TimeTrackingSession): string {
    return `
        <div class="report-active-banner">
            <span class="report-active-indicator"></span>
            <div class="report-active-info">
                <span class="report-active-label">Timer running</span>
                <span class="report-active-title">${escHtml(activeSession.title)}</span>
            </div>
            <span class="report-active-time" data-active-session-id="${escAttr(activeSession.id)}">${formatDuration(activeSession.durationSeconds)}</span>
            <button class="button mini" data-action="stopActiveTimer" onclick="stopActiveTimer(event)">Stop</button>
        </div>
    `;
}

function renderPaginationNotice(displayCount: number, totalCount: number): string {
    return totalCount > displayCount
        ? `<div class="report-pagination-notice">Showing ${displayCount} of ${totalCount} sessions. Narrow the period to see older entries, or increase the limit in settings.</div>`
        : '';
}

function renderSummaryGrid(displaySessions: TimeTrackingSession[], totalSeconds: number): string {
    return `
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
    `;
}

function renderSessionTable(
    vm: ReportViewModel,
    context: vscode.ExtensionContext
): string {
    return `
        <div class="report-table-wrapper" style="display: ${vm.groupBy === 'none' ? 'block' : 'none'};">
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
                    ${vm.displaySessions.map(session => renderSessionRow({
        session,
        project: vm.projectById.get(session.projectId),
        projectNameById: vm.projectNameById,
        projectColor: getProjectColorHex(vm.projectColorById, session.projectId),
        isActive: vm.activeSession?.id === session.id,
        compact: false,
        activeTimer: vm.activeTimer,
        context,
        useFavicons: vm.useFavicons
    })).join('')}
                </tbody>
            </table>
        </div>

        <div id="branch-groups" class="report-branch-groups" style="display: ${vm.groupBy === 'none' ? 'none' : 'block'};">
            ${renderGroups(vm.displaySessions, vm.projectById, vm.projectNameById, (projectId) => getProjectColorHex(vm.projectColorById, projectId), vm.activeSession?.id, vm.groupBy, vm.activeTimer, context, vm.useFavicons)}
        </div>
    `;
}

function renderSessionsSection(vm: ReportViewModel, context: vscode.ExtensionContext): string {
    if (vm.filteredSessions.length === 0) {
        return `
            <div class="report-empty">
                <div class="report-empty-icon">⏱</div>
                <h3>No sessions for this period</h3>
                <p>Start tracking time from a project in the sidebar to see it here.</p>
            </div>
        `;
    }

    const activeBanner = vm.activeSession ? renderActiveBanner(vm.activeSession) : '';
    const paginationNotice = renderPaginationNotice(vm.displaySessions.length, vm.filteredSessions.length);

    return renderSummaryGrid(vm.displaySessions, vm.totalSeconds)
        + activeBanner
        + paginationNotice
        + renderSessionTable(vm, context);
}

function renderReportHeader(vm: ReportViewModel): string {
    const stopButton = vm.activeSession ? `
        <button class="report-header-stop" data-action="stopActiveTimer" title="Stop running timer: ${escAttr(vm.activeSession.title)}">
            <span class="live-dot"></span>
            <span>Stop</span>
        </button>
    ` : '';

    const customRange = vm.period === 'custom' ? `
        <div class="report-custom-range">
            <label for="custom-start">From</label>
            <input type="date" id="custom-start" value="${escAttr(vm.customStartDate || vm.start.toISOString().split('T')[0])}">
            <label for="custom-end">To</label>
            <input type="date" id="custom-end" value="${escAttr(vm.customEndDate || vm.end.toISOString().split('T')[0])}">
            <button class="button mini" data-action="applyCustomRange">Apply</button>
            <div class="validation-message" id="custom-range-error" style="display: none;"></div>
        </div>
    ` : '';

    return `
        <div class="report-page-header">
            <h1>Time Tracking Report</h1>
            <div class="report-header-actions">
                ${stopButton}
                <div class="report-period-tabs">
                    <button class="${vm.period === 'today' ? 'active' : ''}" data-action="setPeriod" data-period="today">Today</button>
                    <button class="${vm.period === 'week' ? 'active' : ''}" data-action="setPeriod" data-period="week">This Week</button>
                    <button class="${vm.period === 'month' ? 'active' : ''}" data-action="setPeriod" data-period="month">This Month</button>
                    <button class="${vm.period === 'lastMonth' ? 'active' : ''}" data-action="setPeriod" data-period="lastMonth">Last Month</button>
                    <button class="${vm.period === 'all' ? 'active' : ''}" data-action="setPeriod" data-period="all">All</button>
                    <button class="${vm.period === 'custom' ? 'active' : ''}" data-action="setPeriod" data-period="custom">Custom</button>
                </div>
            </div>
        </div>

        ${customRange}
    `;
}

function renderReportToolbar(vm: ReportViewModel): string {
    const exportButtons = vm.displaySessions.length > 0 ? `
        <button class="button mini secondary" data-action="exportCsv" data-period="${escAttr(vm.period)}" data-start="${escAttr(vm.customStartDate || '')}" data-end="${escAttr(vm.customEndDate || '')}">Export CSV</button>
        <button class="button mini danger" data-action="deleteAllSessions">Delete All</button>
    ` : '';

    return `
        <div class="report-toolbar">
            <div class="report-toolbar-group">
                <button class="button" data-action="addSession">+ Add Session</button>
            </div>
            <div class="report-toolbar-group">
                ${exportButtons}
            </div>
        </div>
    `;
}

function renderReportGroupingBar(groupBy: 'none' | 'project' | 'title' | 'branch' | 'branchAndDate'): string {
    return `
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
    `;
}

function renderReportFilterBar(displaySessions: TimeTrackingSession[], projectNameById: Map<string, string>): string {
    const projectPills = [...new Set(displaySessions.map(s => projectNameById.get(s.projectId) || s.projectId))].sort()
        .map(name => `<button class="report-filter-pill" data-filter-project="${escAttr(name)}">${escHtml(name)}</button>`).join('');

    return `
        <div class="report-filter-bar">
            <input type="text" id="session-filter" placeholder="Filter by project, title, branch...">
            <div class="report-filter-pills" id="project-filter-pills">
                ${projectPills}
            </div>
            <button class="report-filter-clear" id="filter-clear" style="display: none;">Clear</button>
        </div>
    `;
}

function renderAddSessionForm(projects: Project[]): string {
    return `
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
    `;
}

function renderReportToolbarAndFilters(vm: ReportViewModel): string {
    return renderReportToolbar(vm)
        + renderReportGroupingBar(vm.groupBy)
        + renderReportFilterBar(vm.displaySessions, vm.projectNameById)
        + renderAddSessionForm(vm.projects);
}

function renderReportBody(vm: ReportViewModel, context: vscode.ExtensionContext): string {
    return `
        <div class="time-tracking-report">
            ${renderReportHeader(vm)}
            ${renderReportToolbarAndFilters(vm)}
            ${renderSessionsSection(vm, context)}
        </div>
    `;
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
    const baseCss = await loadBaseCss(context);
    const config = vscode.workspace.getConfiguration('awesomeProjects');
    const vm = buildReportViewModel(timeTrackingService, config, period, customStartDate, customEndDate, groupBy);

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Time Tracking Report</title>
        ${getReportCssHtml(baseCss)}
    </head>
    <body>
        ${renderReportBody(vm, context)}
        ${getReportScriptHtml(
            JSON.stringify(vm.displaySessions.map(s => ({ id: s.id, startTime: s.startTime, endTime: s.endTime }))),
            escAttr(period),
            groupBy
        )}
    </body>
    </html>`;
}

interface GroupKeyLabel {
    key: string;
    label: string;
}

function getGroupKeyLabel(session: TimeTrackingSession, projectName: string, groupBy: 'none' | 'project' | 'title' | 'branch' | 'branchAndDate'): GroupKeyLabel {
    const branch = sessionBranchDisplayName(session);
    switch (groupBy) {
        case 'project':
            return { key: session.projectId, label: projectName };
        case 'title':
            return { key: `${session.projectId}::${session.title}`, label: `${projectName} — ${session.title}` };
        case 'branchAndDate':
            return {
                key: `${session.projectId}::${branch}::${new Date(session.startTime).toLocaleDateString()}`,
                label: `${projectName} — ${branch} — ${new Date(session.startTime).toLocaleDateString()}`
            };
        case 'branch':
        default:
            return { key: `${session.projectId}::${branch}`, label: `${projectName} — ${branch}` };
    }
}

function groupSessions(
    sessions: TimeTrackingSession[],
    projectNameById: Map<string, string>,
    groupBy: 'none' | 'project' | 'title' | 'branch' | 'branchAndDate'
): Map<string, { label: string; projectId: string; sessions: TimeTrackingSession[] }> {
    const groups = new Map<string, { label: string; projectId: string; sessions: TimeTrackingSession[] }>();
    for (const session of sessions) {
        const projectName = projectNameById.get(session.projectId) || session.projectId;
        const { key, label } = getGroupKeyLabel(session, projectName, groupBy);
        const existing = groups.get(key);
        if (existing) {
            existing.sessions.push(session);
        } else {
            groups.set(key, { label, projectId: session.projectId, sessions: [session] });
        }
    }
    return groups;
}

function sortGroupKeys(groups: Map<string, { sessions: TimeTrackingSession[] }>): string[] {
    return [...groups.keys()].sort((a, b) => {
        const aStart = groups.get(a)!.sessions[0]?.startTime;
        const bStart = groups.get(b)!.sessions[0]?.startTime;
        if (!aStart || !bStart) {
            return 0;
        }
        return new Date(bStart).getTime() - new Date(aStart).getTime();
    });
}

function renderGroupHeader(label: string, projectColor: string, sessionCount: number, totalSeconds: number): string {
    return `
        <div class="report-branch-group-header" style="${projectColor ? `--project-color: ${escAttr(projectColor)}` : ''}">
            <span class="branch-group-toggle">▼</span>
            <span class="branch-group-color"></span>
            <span class="branch-group-name">${escHtml(label)}</span>
            <span class="branch-group-count">${sessionCount} session${sessionCount === 1 ? '' : 's'}</span>
            <span class="branch-group-duration" data-group-duration="${totalSeconds}">${formatDuration(totalSeconds)}</span>
        </div>
    `;
}

function renderGroupTable(
    sessions: TimeTrackingSession[],
    projectById: Map<string, Project>,
    projectNameById: Map<string, string>,
    projectColor: string,
    activeSessionId: string | undefined,
    activeTimer: { sessionId: string; accumulatedSeconds: number; lastTickAt: number } | undefined,
    context: vscode.ExtensionContext | undefined,
    useFavicons: boolean | undefined
): string {
    return `
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
                    ${sessions.map(session => renderSessionRow({
        session,
        project: projectById.get(session.projectId),
        projectNameById,
        projectColor,
        isActive: activeSessionId === session.id,
        compact: true,
        activeTimer,
        context,
        useFavicons
    })).join('')}
                </tbody>
            </table>
        </div>
    `;
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

    const groups = groupSessions(sessions, projectNameById, groupBy);
    const sortedKeys = sortGroupKeys(groups);

    return sortedKeys.map(key => {
        const { label, projectId, sessions } = groups.get(key)!;
        const projectColor = getProjectColorHex(projectId);
        const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
        return `
            <div class="report-branch-group" data-group-key="${escAttr(key)}">
                ${renderGroupHeader(label, projectColor, sessions.length, totalSeconds)}
                ${renderGroupTable(sessions, projectById, projectNameById, projectColor, activeSessionId, activeSession, context, useFavicons)}
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

function cleanBranchLog(branchLog: TimeTrackingSession['branchLog']): TimeTrackingSession['branchLog'] {
    const UNKNOWN_BRANCH = 'Unknown, no GIT branch found';
    return branchLog.reduce<{ branch: string; changedAt: string }[]>((acc, change) => {
        if (change.branch === UNKNOWN_BRANCH && acc.some(c => c.branch !== UNKNOWN_BRANCH)) {
            return acc;
        }
        if (acc.length > 0 && acc[acc.length - 1].branch === change.branch) {
            return acc;
        }
        acc.push(change);
        return acc;
    }, []);
}

function renderBranchTimeline(branchLog: TimeTrackingSession['branchLog']): string {
    const UNKNOWN_BRANCH = 'Unknown, no GIT branch found';
    const cleanedBranchLog = cleanBranchLog(branchLog);
    const branchLogEntries = (cleanedBranchLog.length > 0 ? cleanedBranchLog : branchLog).slice(-5);
    const branches = branchLogEntries.map((change, index) => `
        <div class="branch-entry">
            <span class="branch-name">${index > 0 ? '→ ' : ''}${escHtml(change.branch)}</span>
        </div>
    `).join('');
    return `
        <div class="branch-timeline">
            ${branches || '<span class="branch-entry">–</span>'}
        </div>
    `;
}

function renderSessionActions(sessionId: string, isActive: boolean): string {
    return `
        <td class="session-actions">
            ${isActive ? '' : `<button class="button mini" data-action="continueSession" data-session-id="${escAttr(sessionId)}" title="Continue">Continue</button>`}
            <button class="button mini" data-action="editSession" data-session-id="${escAttr(sessionId)}" title="Edit">Edit</button>
            <button class="button mini secondary" data-action="deleteSession" data-session-id="${escAttr(sessionId)}" title="Delete">Delete</button>
        </td>
    `;
}

function renderSessionRow(options: SessionRowContext): string {
    const { session, project, projectNameById, projectColor, isActive, compact, activeTimer, context, useFavicons } = options;
    const startDate = new Date(session.startTime);
    const date = startDate.toLocaleDateString();
    const time = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const projectName = projectNameById.get(session.projectId) || session.projectId;
    const iconHtml = project && context ? `<span class="report-project-icon">${getProjectIconHtml(context, project, useFavicons ?? true)}</span>` : '';

    const colorStyle = projectColor ? `style="--project-color: ${escAttr(projectColor)}"` : '';
    const activeClass = isActive ? 'session-row-active' : '';
    const activeIndicator = isActive ? '<span class="session-row-live-indicator" title="Running"><span class="session-row-live-dot"></span>running</span>' : '';

    const liveDurationSeconds = getLiveDurationSeconds(session, activeTimer);
    const cleanedBranchLog = cleanBranchLog(session.branchLog);
    const branchNames = (cleanedBranchLog.length > 0 ? cleanedBranchLog : session.branchLog).map(change => change.branch).join(' → ');
    const dataAttrs = `data-start-time="${escAttr(session.startTime)}" data-duration="${liveDurationSeconds}" data-project="${escAttr(projectName)}" data-title="${escAttr(session.title)}" data-branches="${escAttr(branchNames)}"`;
    const branchTimeline = renderBranchTimeline(session.branchLog);
    const actions = renderSessionActions(session.id, isActive);

    if (compact) {
        return `
            <tr id="session-row-${escAttr(session.id)}" class="${activeClass}" ${dataAttrs} ${colorStyle}>
                <td><span class="project-color-dot" ${colorStyle}></span><span class="session-date">${escHtml(date)}</span><span class="session-time">${escHtml(time)}</span></td>
                <td>
                    <div id="session-title-${escAttr(session.id)}">${activeIndicator}${escHtml(session.title)}</div>
                    ${session.description ? `<small id="session-desc-${escAttr(session.id)}">${escHtml(session.description)}</small>` : ''}
                </td>
                <td id="session-duration-${escAttr(session.id)}" data-seconds="${liveDurationSeconds}">${formatDuration(liveDurationSeconds)}</td>
                ${branchTimeline}
                ${actions}
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
            ${branchTimeline}
            ${actions}
        </tr>
    `;
}
