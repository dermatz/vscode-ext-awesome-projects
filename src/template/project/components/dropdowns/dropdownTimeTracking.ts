import { Project } from '../../../../extension';
import { getProjectId } from '../../utils/project-id';
import { escAttr, escOnclickArg, escHtml, sanitizeCssColor } from '../../../utils/escaping';
import { TimeTrackingSession } from '../../../../types/timeTracking';

function formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

export function getTimeTrackingDropdownHtml(
    project: Project,
    todaySeconds: number = 0,
    sessions: TimeTrackingSession[] = [],
    isTimerActive: boolean = false
): string {
    const projectId = getProjectId(project);
    const escapedId = escOnclickArg(projectId);
    const bgColor = project.color || "var(--vscode-list-activeSelectionBackground)";
    const safeBgColor = sanitizeCssColor(bgColor);

    const timerButtonClass = isTimerActive ? 'secondary' : '';
    const timerLabel = isTimerActive ? 'Stop Timer' : 'Start Timer';

    return `
        <div id="time-tracking-${projectId}"
             class="dropdown time-tracking-dropdown"
             style="border-left: 1px solid ${safeBgColor}; border-right: 1px solid ${safeBgColor}; border-bottom: 1px solid ${safeBgColor}; background: linear-gradient(0deg, color-mix(in srgb, ${safeBgColor} 10%, var(--vscode-editor-background)) 0%, color-mix(in srgb, var(--vscode-editor-background) 92%, transparent) 55%);"
        >
            <div class="time-tracking-section">
                <div class="time-tracking-section-header">
                    <div class="time-tracking-section-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 6v6l4 2"/>
                        </svg>
                        Time Tracking
                    </div>
                    <div class="time-tracking-summary">
                        <span>Today: <strong>${formatDuration(todaySeconds)}</strong></span>
                        <span>Total: <strong>${formatDuration(project.timeSpentSeconds || 0)}</strong></span>
                    </div>
                </div>
                <div class="time-tracking-actions">
                    <button type="button" class="button small ${timerButtonClass}" onclick="toggleTimeTracking('${escapedId}', '${escOnclickArg(project.path)}')">
                        ${timerLabel}
                    </button>
                    <button type="button" class="button small" onclick="window.vscodeApi.postMessage({ command: 'openTimeTrackingReport' })">
                        Open Report
                    </button>
                    ${sessions.length > 0 ? `
                        <button type="button" class="button small danger" onclick="window.vscodeApi.postMessage({ command: 'clearTimeTracking', projectId: '${escapedId}' })">
                            Clear All
                        </button>
                    ` : ''}
                </div>
                ${sessions.length > 0 ? `
                    <div class="time-tracking-sessions">
                        ${sessions.slice(0, 10).map(session => `
                            <div class="time-tracking-session">
                                <div class="session-row">
                                    <button type="button" class="session-title-edit" title="Edit session" onclick="editTimeTrackingSessionInline('${escAttr(session.id)}')">
                                        <span class="session-title-text">${escHtml(session.title)}</span>
                                        <span class="session-edit-icon">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                        </span>
                                    </button>
                                    <button type="button" class="session-delete" title="Delete session" onclick="deleteTimeTrackingSession('${escAttr(session.id)}')">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                                    </button>
                                </div>
                                <div class="session-meta">${formatDuration(session.durationSeconds)} · ${new Date(session.startTime).toLocaleDateString()}</div>
                                <div class="session-branches">
                                    ${session.branchLog.map((change, index) => `
                                        <span>${index > 0 ? '→ ' : ''}${escHtml(change.branch)}</span>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}
