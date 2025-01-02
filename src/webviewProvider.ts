import * as vscode from 'vscode';

export class ProjectsWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'awesomeProjectsView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'addProject':
                    vscode.window.showInformationMessage('Add Project clicked!');
                    break;
                case 'openProject':
                    vscode.window.showInformationMessage(`Open Project: ${message.project}`);
                    break;
            }
        });
    }

    public refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        padding: 0;
                        margin: 0;
                    }
                    .section {
                        margin-bottom: 20px;
                    }
                    .section-header {
                        padding: 8px;
                        font-weight: bold;
                        background: var(--vscode-sideBar-background);
                        border-bottom: 1px solid var(--vscode-sideBar-border);
                    }
                    .project-item {
                        display: flex;
                        align-items: center;
                        padding: 6px 8px;
                        cursor: pointer;
                    }
                    .project-item:hover {
                        background: var(--vscode-list-hoverBackground);
                    }
                    .project-icon {
                        margin-right: 8px;
                    }
                    .project-info {
                        flex: 1;
                    }
                    .project-path {
                        font-size: 0.85em;
                        opacity: 0.8;
                    }
                    .add-button {
                        display: flex;
                        align-items: center;
                        padding: 6px 8px;
                        cursor: pointer;
                        color: var(--vscode-button-foreground);
                        background: var(--vscode-button-background);
                        border: none;
                        border-radius: 3px;
                        margin: 8px;
                    }
                    .add-button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="section">
                    <div class="section-header">Recent Projects</div>
                    <div class="project-item" onclick="openProject('project1')">
                        <span class="project-icon">📁</span>
                        <div class="project-info">
                            <div>My Node Project</div>
                            <div class="project-path">~/projects/node-project</div>
                        </div>
                    </div>
                    <button class="add-button" onclick="addProject()">
                        <span style="margin-right: 4px">+</span> Add Project
                    </button>
                </div>

                <div class="section">
                    <div class="section-header">Favorites</div>
                    <div class="project-item" onclick="openProject('project2')">
                        <span class="project-icon">📁</span>
                        <div class="project-info">
                            <div>Docker Project</div>
                            <div class="project-path">~/projects/docker</div>
                        </div>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();

                    function addProject() {
                        vscode.postMessage({ command: 'addProject' });
                    }

                    function openProject(project) {
                        vscode.postMessage({ command: 'openProject', project });
                    }
                </script>
            </body>
            </html>
        `;
    }
}
