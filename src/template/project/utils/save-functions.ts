export function getSaveFunctionsScript(): string {
    return `
        if (!window.vscodeApi) {
            window.vscodeApi = acquireVsCodeApi();
        }
        if (!window.pendingChanges) {
            window.pendingChanges = {};
        }

        function updateSaveButtonState(projectId) {
            const saveButton = document.getElementById('save-' + projectId);
            if (saveButton) {
                const hasChanges = window.pendingChanges[projectId] && Object.keys(window.pendingChanges[projectId]).length > 0;
                saveButton.classList.toggle('show', hasChanges);
                saveButton.disabled = !hasChanges;
            }
        }

        function showSaveButton(projectId) {
            const saveButton = document.getElementById('save-' + projectId);
            if (saveButton) {
                saveButton.classList.add('show');
            }
        }

        function refreshInputStates(settingsElement) {
            const inputs = settingsElement.querySelectorAll('input');
            inputs.forEach(input => {
                input.defaultValue = input.value;
                input.dataset.initialValue = input.value;
            });
        }

        function handleInput(event, projectId) {
            const input = event.target;
            const field = input.dataset.field;
            const isCheckbox = input.type === 'checkbox';
            const value = isCheckbox ? input.checked : input.value;
            const initialValue = input.dataset.initialValue || '';
            const initialBool = isCheckbox ? (initialValue === 'true') : initialValue;

            if (!window.pendingChanges[projectId]) {
                window.pendingChanges[projectId] = {};
            }

            if (value !== initialBool) {
                window.pendingChanges[projectId][field] = isCheckbox ? input.checked : (value || null);
            } else {
                delete window.pendingChanges[projectId][field];
            }

            updateSaveButtonState(projectId);
        }

        function saveChanges(projectId) {
            if (window.pendingChanges[projectId]) {
                window.vscodeApi.postMessage({
                    command: 'updateProject',
                    projectId: projectId,
                    updates: window.pendingChanges[projectId]
                });

                const settingsElement = document.getElementById('settings-' + projectId);
                if (settingsElement) {
                    Object.entries(window.pendingChanges[projectId]).forEach(([field, value]) => {
                        const input = settingsElement.querySelector('input[data-field="' + field + '"]');
                        if (input) {
                            if (input.type === 'checkbox') {
                                input.checked = !!value;
                                input.dataset.initialValue = value ? 'true' : 'false';
                            } else {
                                input.value = value ?? '';
                                input.dataset.initialValue = value ?? '';
                            }
                        }
                    });
                }

                delete window.pendingChanges[projectId];
                updateSaveButtonState(projectId);
            }
        }

        function openProject(projectPath) {
            const normalizedPath = projectPath.replace(/\\\\/g, '\\\\');
            window.vscodeApi.postMessage({
                command: 'openProject',
                projectPath: normalizedPath
            });
        }

        function openProjectNewWindow(projectPath) {
            const normalizedPath = projectPath.replace(/\\\\/g, '\\\\');
            window.vscodeApi.postMessage({
                command: 'openProjectNewWindow',
                projectPath: normalizedPath
            });
        }

        function openRemoteProject(remoteUrl, forceNewWindow) {
            window.vscodeApi.postMessage({
                command: 'openRemoteProject',
                remoteUrl: remoteUrl,
                forceNewWindow: !!forceNewWindow
            });
        }

        function openWorkspace(workspacePath) {
            const normalizedPath = workspacePath.replace(/\\\\/g, '\\\\');
            window.vscodeApi.postMessage({
                command: 'openWorkspace',
                projectPath: normalizedPath
            });
        }

        function toggleAccordion(event) {
            const button = event.currentTarget;
            const content = button.nextElementSibling;
            const isExpanded = button.classList.contains('expanded');

            button.classList.toggle('expanded');
            content.style.maxHeight = isExpanded ? '0' : content.scrollHeight + 'px';
        }

        function handleIconInput(event, projectId) {
            handleInput(event, projectId);

            const input = event.target;
            const preview = document.getElementById('icon-preview-' + projectId);
            if (!preview) { return; }

            const value = input.value.trim();
            if (!value) {
                preview.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 12h.01"/></svg>';
                return;
            }

            window.vscodeApi.postMessage({
                command: 'previewIcon',
                projectId: projectId,
                iconName: value
            });
        }

        function updateIconPreview(projectId, iconHtml) {
            const preview = document.getElementById('icon-preview-' + projectId);
            if (preview) {
                preview.innerHTML = iconHtml;
            }
        }

        function handleDeleteProject(projectId) {
            if (!projectId) return;

            window.vscodeApi.postMessage({
                command: 'deleteProject',
                projectId: projectId
            });
        }

        function startInlineRename(event, projectId, currentName) {
            event.stopPropagation();
            event.preventDefault();
            const nameEl = event.currentTarget;
            if (nameEl.querySelector('input')) { return; }

            // Close info dropdown if open
            const infoDropdown = document.getElementById('info-' + projectId);
            if (infoDropdown && infoDropdown.classList.contains('show')) {
                infoDropdown.classList.remove('show');
                const wrapper = document.querySelector('[data-project-id="' + projectId + '"]');
                if (wrapper) {
                    const item = wrapper.querySelector('.project-item');
                    if (item) { item.classList.remove('active'); }
                }
            }

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'project-name-input';
            input.value = currentName;
            nameEl.textContent = '';
            nameEl.appendChild(input);
            input.focus();
            input.select();

            let committed = false;

            function commit() {
                if (committed) { return; }
                committed = true;
                const newName = input.value.trim();
                nameEl.textContent = newName || currentName;
                if (newName && newName !== currentName) {
                    window.vscodeApi.postMessage({
                        command: 'updateProject',
                        projectId: projectId,
                        updates: { name: newName }
                    });
                }
            }

            function cancel() {
                if (committed) { return; }
                committed = true;
                nameEl.textContent = currentName;
            }

            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.stopPropagation();
                    commit();
                } else if (e.key === 'Escape') {
                    e.stopPropagation();
                    cancel();
                }
            });
            input.addEventListener('blur', commit);
            input.addEventListener('click', function(e) { e.stopPropagation(); });
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

        function toggleTimeTracking(projectId, projectPath) {
            const isActive = window.activeTimeTrackingProjectId === projectId;
            if (isActive) {
                window.vscodeApi.postMessage({
                    command: 'stopTimeTracking'
                });
            } else {
                window.vscodeApi.postMessage({
                    command: 'startTimeTracking',
                    projectId: projectId,
                    projectPath: projectPath
                });
            }
        }

        function updateTimeTrackingButtons(activeSession) {
            window.activeTimeTrackingProjectId = activeSession ? activeSession.projectId : undefined;

            document.querySelectorAll('.time-tracking-toggle').forEach(button => {
                const projectId = button.getAttribute('data-project-id');
                const isActive = activeSession && activeSession.projectId === projectId;
                button.classList.toggle('active', !!isActive);
                button.title = 'Time tracking';
                button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="11" cy="11" r="8"/><path d="M11 7v4l2 2"/><path d="M15 21h6v-6"/><path d="M15 17l2-2 1 1 2-2"/></svg>';
            });

            document.querySelectorAll('.time-tracking-action-button').forEach(button => {
                const projectId = button.getAttribute('data-project-id');
                const isActive = activeSession && activeSession.projectId === projectId;
                button.classList.toggle('active', !!isActive);
                button.classList.toggle('secondary', !!isActive);
                button.textContent = isActive ? 'Stop Timer' : 'Start Timer';
            });
        }

        function updateTimeTrackingDropdown(activeSession) {
            const dropdown = document.querySelector('.time-tracking-dropdown.show');
            if (!dropdown) { return; }
            const projectId = dropdown.id.replace('time-tracking-', '');
            const sessionsContainer = dropdown.querySelector('.time-tracking-sessions');
            if (!sessionsContainer) { return; }

            const isThisProjectActive = activeSession && activeSession.projectId === projectId;
            if (!isThisProjectActive) {
                sessionsContainer.querySelectorAll('.time-tracking-session-active').forEach(el => el.remove());
                return;
            }

            const active = activeSession;
            const durationText = formatDuration(active.durationSeconds || 0) + ' · ' + new Date(active.startTime).toLocaleDateString();
            let activeCard = sessionsContainer.querySelector('.time-tracking-session-active');

            if (!activeCard) {
                activeCard = document.createElement('div');
                activeCard.className = 'time-tracking-session time-tracking-session-active';

                const row = document.createElement('div');
                row.className = 'session-row';

                const meta = document.createElement('div');
                meta.className = 'session-meta';
                meta.textContent = durationText;

                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'session-delete';
                deleteBtn.title = 'Delete session';
                deleteBtn.setAttribute('onclick', "deleteTimeTrackingSession('" + active.id + "')");
                deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>';

                row.appendChild(meta);
                row.appendChild(deleteBtn);

                const titleBtn = document.createElement('button');
                titleBtn.type = 'button';
                titleBtn.className = 'session-title-edit';
                titleBtn.title = 'Edit session';
                titleBtn.setAttribute('onclick', "editTimeTrackingSessionInline('" + active.id + "')");

                const liveIndicator = document.createElement('span');
                liveIndicator.className = 'session-live-indicator';
                liveIndicator.title = 'Running';
                liveIndicator.innerHTML = '<span class="session-live-dot"></span>Running';

                const titleText = document.createElement('span');
                titleText.className = 'session-title-text';
                const strong = document.createElement('strong');
                strong.textContent = active.title || 'Untitled';
                titleText.appendChild(strong);

                const editIcon = document.createElement('span');
                editIcon.className = 'session-edit-icon';
                editIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

                titleBtn.appendChild(liveIndicator);
                titleBtn.appendChild(titleText);
                titleBtn.appendChild(editIcon);

                activeCard.appendChild(row);
                activeCard.appendChild(titleBtn);
                sessionsContainer.insertBefore(activeCard, sessionsContainer.firstChild);
            } else {
                const meta = activeCard.querySelector('.session-meta');
                if (meta) { meta.textContent = durationText; }
                const titleEl = activeCard.querySelector('.session-title-text strong');
                if (titleEl) { titleEl.textContent = active.title || 'Untitled'; }
            }
        }

        function updateTimeTrackingDisplay(message) {
            updateTimeTrackingButtons(message.activeSession);
            updateTimeTrackingDropdown(message.activeSession);
            if (message.activeSession) {
                const active = message.activeSession;
                const elapsed = active.durationSeconds || 0;
                document.querySelectorAll('.project-time-spent').forEach(el => {
                    const projectId = el.getAttribute('data-project-id');
                    if (active.projectId === projectId) {
                        el.classList.add('active');
                        el.textContent = formatDuration(elapsed);
                    } else {
                        el.classList.remove('active');
                    }
                });
            } else {
                document.querySelectorAll('.project-time-spent').forEach(el => el.classList.remove('active'));
            }
        }

        function deleteTimeTrackingSession(sessionId) {
            window.vscodeApi.postMessage({ command: 'deleteTimeTrackingSession', sessionId: sessionId });
        }

        function editTimeTrackingSessionInline(sessionId) {
            window.vscodeApi.postMessage({ command: 'openTimeTrackingReport', reportPeriod: 'week' });
        }
    `;
}
