import * as vscode from 'vscode';
import { Project } from '../../extension';
import { getProjectItemHtml } from './components/project-item';
import { getAddToHtml } from './components/add-to';
import { getDropdownToggleScript } from './utils/dropdownUtils';
import { getDragDropScript } from './utils/dragAndDrop';

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
            ${getDragDropScript()}
            ${getDropdownToggleScript()}
        </script>
    `;
}



