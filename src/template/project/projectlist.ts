import * as vscode from 'vscode';
import { Project } from '../../extension';
import { getProjectItemHtml } from './components/project-item';
import { getAddToHtml } from './components/add-to';
import { getDropdownToggleScript } from './utils/dropdownUtils';

export async function getProjectListHtml(context: vscode.ExtensionContext, currentWorkspace: string = ''): Promise<string> {
    const configuration = vscode.workspace.getConfiguration('awesomeProjects');
    const projects = configuration.get<Project[]>('projects') || [];
    const useFavicons = configuration.get<boolean>('useFavicons') ?? true;

    const projectsHtml = await Promise.all(
        projects.map((project, index) =>
            getProjectItemHtml(context, { project, index, useFavicons, currentWorkspace })
        )
    );

    return `
        <section id="a">
            <div id="projects-list" class="draggable-list">
                ${projectsHtml.join("")}
            </div>
        </section>
        <section id="b">
            ${await getAddToHtml()}
        </section>

        <script>
            const dragTracker = {
                draggingElement: null,
                originalIndex: -1
            };

            document.querySelectorAll('.project-item-wrapper').forEach(item => {
                item.addEventListener('dragstart', handleDragStart);
                item.addEventListener('dragend', handleDragEnd);
                item.addEventListener('dragover', handleDragOver);
                item.addEventListener('drop', handleDrop);
            });

            function handleDragStart(e) {
                dragTracker.draggingElement = e.target;
                dragTracker.originalIndex = Array.from(e.target.parentNode.children).indexOf(e.target);
                e.target.classList.add('dragging');

                // Alle anderen Elemente als potenzielle Dropzonen markieren
                document.querySelectorAll('.project-item-wrapper').forEach(item => {
                    if (item !== dragTracker.draggingElement) {
                        item.classList.add('dropzone');
                    }
                });
            }

            function handleDragEnd(e) {
                e.target.classList.remove('dragging');
                document.querySelectorAll('.project-item-wrapper').forEach(item => {
                    item.classList.remove('dropzone');
                    item.classList.remove('drag-over');
                });
                dragTracker.draggingElement = null;
                dragTracker.originalIndex = -1;
            }

            function handleDragOver(e) {
                e.preventDefault();
                if (this === dragTracker.draggingElement) return;

                // Entferne drag-over von allen Elementen
                document.querySelectorAll('.project-item-wrapper').forEach(item => {
                    item.classList.remove('drag-over');
                });

                // Füge drag-over nur zum aktuellen Element hinzu
                this.classList.add('drag-over');
            }

            function handleDrop(e) {
                e.preventDefault();
                if (this === dragTracker.draggingElement) return;

                const dropIndex = Array.from(this.parentNode.children).indexOf(this);

                if (dropIndex > dragTracker.originalIndex) {
                    this.parentNode.insertBefore(dragTracker.draggingElement, this.nextSibling);
                } else {
                    this.parentNode.insertBefore(dragTracker.draggingElement, this);
                }

                // Reset drag-over Status
                this.classList.remove('drag-over');

                // Informiere VS Code über die neue Reihenfolge
                vscode.postMessage({
                    command: 'reorderProjects',
                    oldIndex: dragTracker.originalIndex,
                    newIndex: dropIndex
                });
            }

            ${getDropdownToggleScript()}
        </script>
    `;
}



