/**
 * Drag and Drop utility for project reordering
 * This module provides a clean script that can be injected into webviews
 */

export const getDragDropScript = (): string => {
    return `
        // Initialize drag and drop for project reordering
        if (typeof window.projectDragDrop === 'undefined') {

            const dragTracker = {
                draggingElement: null,
                originalIndex: -1
            };

            function cleanupDragState() {
                document.querySelectorAll('.project-item-wrapper').forEach(item => {
                    item.classList.remove('dropzone', 'drag-over');
                });
            }

            function resetDragTracker() {
                dragTracker.draggingElement = null;
                dragTracker.originalIndex = -1;
            }

            function handleDragStart(e) {
                dragTracker.draggingElement = e.target;
                dragTracker.originalIndex = Array.from(e.target.parentNode.children).indexOf(e.target);
                e.target.classList.add('dragging');

                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                }

                // Mark other elements as potential drop zones
                document.querySelectorAll('.project-item-wrapper').forEach(item => {
                    if (item !== dragTracker.draggingElement) {
                        item.classList.add('dropzone');
                    }
                });
            }

            function handleDragEnd(e) {
                e.target.classList.remove('dragging');
                cleanupDragState();
                resetDragTracker();
            }

            function handleDragOver(e) {
                e.preventDefault();
                if (this === dragTracker.draggingElement) return;

                // Remove drag-over from all elements
                document.querySelectorAll('.project-item-wrapper').forEach(item => {
                    item.classList.remove('drag-over');
                });

                // Add drag-over only to current element
                this.classList.add('drag-over');
            }

            function handleDrop(e) {
                e.preventDefault();
                if (this === dragTracker.draggingElement) return;

                const dropIndex = Array.from(this.parentNode.children).indexOf(this);

                // Always insert after the drop target element to match visual feedback
                // The blue line (drag-over) appears at the bottom of the target element
                this.parentNode.insertBefore(dragTracker.draggingElement, this.nextSibling);

                // Clean up visual state
                this.classList.remove('drag-over');

                // Calculate the correct new index after DOM manipulation
                const newIndex = Array.from(this.parentNode.children).indexOf(dragTracker.draggingElement);

                // Notify VS Code about the reorder
                if (window.vscodeApi) {
                    window.vscodeApi.postMessage({
                        command: 'reorderProjects',
                        oldIndex: dragTracker.originalIndex,
                        newIndex: newIndex
                    });
                }

                resetDragTracker();
            }

            // Attach event listeners to all project items
            document.querySelectorAll('.project-item-wrapper').forEach(item => {
                item.setAttribute('draggable', 'true');

                item.addEventListener('dragstart', handleDragStart);
                item.addEventListener('dragend', handleDragEnd);
                item.addEventListener('dragover', handleDragOver);
                item.addEventListener('drop', handleDrop);
            });

            // Mark as initialized
            window.projectDragDrop = true;
        }
    `;
};
