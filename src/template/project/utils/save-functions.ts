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
    `;
}
