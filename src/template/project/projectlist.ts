import * as vscode from "vscode";
import { Project } from "../../extension";
import { getProjectItemHtml } from "./components/project-item";
import { getAddToHtml } from "./components/add-to";
import { getDropdownToggleScript } from "./utils/dropdownUtils";

/**
 * Returns footer HTML for the webview.
 * @param context Includes all structured elements to render the project list.
 */

export async function getProjectListHtml(context: vscode.ExtensionContext): Promise<string> {
    const configuration = vscode.workspace.getConfiguration('awesomeProjects');
    const projects = configuration.get<Project[]>('projects') || [];
    const useFavicons = configuration.get<boolean>('useFavicons') ?? true;

    const projectsHtml = await Promise.all(
        projects.map((project, index) =>
            getProjectItemHtml(context, { project, index, useFavicons })
        )
    );

    return `
        <section id="a">
            <div id="projects-list" class="draggable-list">
                ${projectsHtml.join("")}
            </div>
        </section>
        <section id="b">
            ${await getAddToHtml(context)}
        </section>

        <script>
            ${getDropdownToggleScript()}
       </script>
    `;
}



