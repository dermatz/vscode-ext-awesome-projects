/* global document, window, acquireVsCodeApi, sessionsMeta, reportPeriod, reportGroupBy */

const vscode = acquireVsCodeApi();

function isValidDateInput(value) {
    if (!value || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
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

function createLabel(forId, text) {
    const label = document.createElement('label');
    label.htmlFor = forId;
    label.textContent = text;
    return label;
}

function createTextField(id, label, value, placeholder) {
    const field = document.createElement('div');
    field.className = 'field';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.value = value || '';
    input.placeholder = placeholder || '';
    field.appendChild(createLabel(id, label));
    field.appendChild(input);
    return field;
}

function createTextareaField(id, label, value, placeholder) {
    const field = document.createElement('div');
    field.className = 'field';
    const textarea = document.createElement('textarea');
    textarea.id = id;
    textarea.rows = 2;
    textarea.placeholder = placeholder || '';
    textarea.value = value || '';
    field.appendChild(createLabel(id, label));
    field.appendChild(textarea);
    return field;
}

function createDateTimeField(id, label, value) {
    const field = document.createElement('div');
    field.className = 'field';
    const input = document.createElement('input');
    input.type = 'datetime-local';
    input.id = id;
    input.value = value || '';
    field.appendChild(createLabel(id, label));
    field.appendChild(input);
    return field;
}

function createNumberField(id, label, value, placeholder) {
    const field = document.createElement('div');
    field.className = 'field';
    field.style.maxWidth = '120px';
    const input = document.createElement('input');
    input.type = 'number';
    input.id = id;
    input.value = value || '';
    input.placeholder = placeholder || '';
    field.appendChild(createLabel(id, label));
    field.appendChild(input);
    return field;
}

function createActionButton(label, action, dataset) {
    const button = document.createElement('button');
    button.className = 'button mini' + (action === 'cancelEdit' ? ' secondary' : '');
    button.textContent = label;
    button.dataset.action = action;
    Object.entries(dataset).forEach(([key, value]) => {
        button.dataset[key] = value;
    });
    return button;
}

function readSessionForEdit(sessionId) {
    const titleEl = document.getElementById('session-title-' + sessionId);
    const descEl = document.getElementById('session-desc-' + sessionId);
    const durationEl = document.getElementById('session-duration-' + sessionId);
    const session = sessionsMeta.find(s => s.id === sessionId);
    return {
        title: titleEl ? titleEl.textContent : '',
        description: descEl ? descEl.textContent : '',
        duration: durationEl ? durationEl.dataset.seconds : '0',
        startTime: session ? session.startTime.slice(0, 16) : '',
        endTime: session && session.endTime ? session.endTime.slice(0, 16) : ''
    };
}

function buildEditForm(sessionId, data) {
    const wrapper = document.createElement('div');
    wrapper.className = 'inline-edit';

    const row = document.createElement('div');
    row.className = 'inline-edit-row';
    row.appendChild(createDateTimeField('edit-start-' + sessionId, 'Start', data.startTime));
    row.appendChild(createDateTimeField('edit-end-' + sessionId, 'End', data.endTime));
    row.appendChild(createNumberField('edit-duration-' + sessionId, 'Duration (s)', data.duration, 'Ignored when start and end are set'));

    const actions = document.createElement('div');
    actions.className = 'inline-edit-actions';
    actions.appendChild(createActionButton('Save', 'saveSession', { sessionId: sessionId }));
    actions.appendChild(createActionButton('Cancel', 'cancelEdit', { period: reportPeriod }));

    wrapper.appendChild(createTextField('edit-title-' + sessionId, 'Title', data.title, 'Session title'));
    wrapper.appendChild(createTextareaField('edit-desc-' + sessionId, 'Description', data.description, 'Optional description'));
    wrapper.appendChild(row);
    wrapper.appendChild(actions);
    return wrapper;
}

function editSession(sessionId) {
    const row = document.getElementById('session-row-' + sessionId);
    if (!row) {
        return;
    }
    const data = readSessionForEdit(sessionId);
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.appendChild(buildEditForm(sessionId, data));
    row.innerHTML = '';
    row.appendChild(cell);
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

let currentGroupBy = reportGroupBy;

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

function handleClickSetPeriod(target) {
vscode.postMessage({ command: 'openTimeTrackingReport', reportPeriod: target.dataset.period });
}

function handleClickApplyCustomRange(target) {
applyCustomRange();
}

function handleClickExportCsv(target) {
vscode.postMessage({
                command: 'exportTimeTrackingCsv',
                reportPeriod: target.dataset.period,
                customStartDate: target.dataset.start || undefined,
                customEndDate: target.dataset.end || undefined
            });
}

function handleClickStopActiveTimer(target) {
vscode.postMessage({ command: 'stopTimeTracking' });
}

function handleClickContinueSession(target) {
vscode.postMessage({ command: 'continueTimeTracking', sessionId: target.dataset.sessionId });
}

function handleClickDeleteSession(target) {
vscode.postMessage({ command: 'deleteTimeTrackingSession', sessionId: target.dataset.sessionId });
}

function handleClickEditSession(target) {
editSession(target.dataset.sessionId);
}

function handleClickSaveSession(target) {
saveSession(target.dataset.sessionId);
}

function handleClickCancelEdit(target) {
vscode.postMessage({ command: 'openTimeTrackingReport', reportPeriod: target.dataset.period });
}

function handleClickAddSession(target) {
addSession();
}

function handleClickSaveNewSession(target) {
saveNewSession();
}

function handleClickCancelAddSession(target) {
cancelAddSession();
}

function handleClickDeleteAllSessions(target) {
vscode.postMessage({ command: 'confirmDeleteAllTimeTrackingSessions' });
}

const clickHandlers = {
    'setPeriod': handleClickSetPeriod,
    'applyCustomRange': handleClickApplyCustomRange,
    'exportCsv': handleClickExportCsv,
    'stopActiveTimer': handleClickStopActiveTimer,
    'continueSession': handleClickContinueSession,
    'deleteSession': handleClickDeleteSession,
    'editSession': handleClickEditSession,
    'saveSession': handleClickSaveSession,
    'cancelEdit': handleClickCancelEdit,
    'addSession': handleClickAddSession,
    'saveNewSession': handleClickSaveNewSession,
    'cancelAddSession': handleClickCancelAddSession,
    'deleteAllSessions': handleClickDeleteAllSessions
};

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
    if (!action || !clickHandlers[action]) {
        return;
    }
    clickHandlers[action](target);
});

window.addEventListener('message', event => {
    handleTimeTrackingMessage(event.data);
});

function updateActiveBanner(activeSession, durationSeconds) {
    const banner = document.querySelector('.report-active-banner .report-active-time');
    if (banner && banner.dataset.activeSessionId === activeSession.id) {
        banner.textContent = formatDuration(durationSeconds);
    }
}

function updateActiveRow(activeSession, durationSeconds) {
    const activeRowDuration = document.getElementById('session-duration-' + activeSession.id);
    if (!activeRowDuration) {
        return null;
    }

    const delta = durationSeconds - Number(activeRowDuration.dataset.seconds || 0);
    activeRowDuration.textContent = formatDuration(durationSeconds);
    activeRowDuration.dataset.seconds = String(durationSeconds);
    const row = activeRowDuration.closest('tr');
    if (row) {
        row.dataset.duration = String(durationSeconds);
    }
    return { activeRowDuration, delta };
}

function updateGroupDuration(activeRowDuration, delta) {
    const group = activeRowDuration.closest('.report-branch-group');
    if (!group) {
        return;
    }
    const groupDurationEl = group.querySelector('.branch-group-duration');
    if (!groupDurationEl) {
        return;
    }
    const currentTotal = Number(groupDurationEl.dataset.groupDuration || 0);
    groupDurationEl.dataset.groupDuration = String(currentTotal + delta);
    groupDurationEl.textContent = formatDuration(currentTotal + delta);
}

function updateSummaryTotal(delta) {
    const summaryTotalEl = document.getElementById('summary-total-time');
    if (!summaryTotalEl) {
        return;
    }
    const currentTotal = Number(summaryTotalEl.dataset.totalSeconds || 0);
    const newTotal = currentTotal + delta;
    summaryTotalEl.dataset.totalSeconds = String(newTotal);
    summaryTotalEl.textContent = formatDuration(newTotal);
}

function updateSummaryAverage() {
    const summaryAvgEl = document.getElementById('summary-daily-avg');
    const summaryCountEl = document.getElementById('summary-session-count');
    const summaryTotalEl = document.getElementById('summary-total-time');
    if (!summaryAvgEl || !summaryCountEl || !summaryTotalEl) {
        return;
    }
    const count = Number(summaryCountEl.textContent || 1);
    const currentTotal = Number(summaryTotalEl.dataset.totalSeconds || 0);
    summaryAvgEl.textContent = formatDuration(Math.round(currentTotal / Math.max(1, count)));
}

function updateActiveSessionDisplay(activeSession) {
    const durationSeconds = activeSession.durationSeconds || 0;
    updateActiveBanner(activeSession, durationSeconds);
    const rowResult = updateActiveRow(activeSession, durationSeconds);
    if (!rowResult) {
        return;
    }
    updateGroupDuration(rowResult.activeRowDuration, rowResult.delta);
    updateSummaryTotal(rowResult.delta);
    updateSummaryAverage();
}

function handleTimeTrackingMessage(message) {
    if ((message.command === 'timeTrackingState' || message.command === 'timeTrackingTick') && message.activeSession) {
        updateActiveSessionDisplay(message.activeSession);
    }
}

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

