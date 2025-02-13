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
            const value = input.value;
            const initialValue = input.dataset.initialValue || '';

            if (!window.pendingChanges[projectId]) {
                window.pendingChanges[projectId] = {};
            }

            if (value !== initialValue) {
                window.pendingChanges[projectId][field] = value || null;
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
                            input.value = value ?? '';
                            input.dataset.initialValue = value ?? '';
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
                project: normalizedPath
            });
        }

        function toggleUrlSettings(event) {
            const button = event.currentTarget;
            const content = button.nextElementSibling;
            const isExpanded = button.classList.contains('expanded');

            button.classList.toggle('expanded');
            content.style.maxHeight = isExpanded ? '0' : content.scrollHeight + 'px';
        }
    `;
}
