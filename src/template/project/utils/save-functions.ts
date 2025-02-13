export function getSaveFunctionsScript(): string {
    return `
        const pendingChanges = {};

        function updateSaveButtonState(projectId) {
            const saveButton = document.getElementById('save-' + projectId);
            if (saveButton) {
                const hasChanges = pendingChanges[projectId] && Object.keys(pendingChanges[projectId]).length > 0;
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

            if (!pendingChanges[projectId]) {
                pendingChanges[projectId] = {};
            }

            if (value !== initialValue) {
                pendingChanges[projectId][field] = value || null;
            } else {
                delete pendingChanges[projectId][field];
            }

            updateSaveButtonState(projectId);
        }

        function saveChanges(projectId) {
            if (pendingChanges[projectId]) {
                acquireVsCodeApi().postMessage({
                    command: 'updateProject',
                    projectId: projectId,
                    updates: pendingChanges[projectId]
                });

                const settingsElement = document.getElementById('settings-' + projectId);
                if (settingsElement) {
                    Object.entries(pendingChanges[projectId]).forEach(([field, value]) => {
                        const input = settingsElement.querySelector('input[data-field="' + field + '"]');
                        if (input) {
                            input.value = value ?? '';
                            input.dataset.initialValue = value ?? '';
                        }
                    });
                }

                delete pendingChanges[projectId];
                updateSaveButtonState(projectId);
            }
        }

        function openProject(projectPath) {
            const normalizedPath = projectPath.replace(/\\\\/g, '\\\\');
            acquireVsCodeApi().postMessage({
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
