import { Project } from '../../../extension';
import * as path from 'path';
import * as fs from 'fs';
import { gitIcons, getGitServiceType } from './gitIcons';

function convertGitUrlToHttps(gitUrl: string): string {
    gitUrl = gitUrl.trim().replace(/\.git$/, '');

    // Handle SSH URLs
    if (gitUrl.startsWith('git@')) {
        const match = gitUrl.match(/git@([^:]+):(.+)/);
        if (match) {
            const [, host, path] = match;
            return `https://${host}/${path}`;
        }
    }

    // Handle git:// protocol
    if (gitUrl.startsWith('git://')) {
        return gitUrl.replace(/^git:\/\//, 'https://');
    }

    // Handle HTTPS URLs - already in correct format
    if (gitUrl.startsWith('https://')) {
        return gitUrl;
    }

    return gitUrl;
}

function getSubmodules(projectPath: string): {name: string, url: string}[] {
    const submodules: {name: string, url: string}[] = [];
    const gitmodulesPath = path.join(projectPath, '.gitmodules');

    if (fs.existsSync(gitmodulesPath)) {
        const content = fs.readFileSync(gitmodulesPath, 'utf8');
        const submoduleMatches = content.matchAll(/\[submodule "([^"]+)"\][^[]*url = ([^\n]+)/g);

        for (const match of submoduleMatches) {
            const name = match[1];
            const url = convertGitUrlToHttps(match[2].trim());
            submodules.push({ name, url });
        }
    }

    return submodules;
}

export function getGitRepositoriesHtml(project: Project): string {
    let gitContent = '<span class="info-item-value">No Git repository found</span>';
    let submodulesHtml = '';

    const gitConfigPath = path.join(project.path, '.git', 'config');
    if (fs.existsSync(gitConfigPath)) {
        try {
            const configContent = fs.readFileSync(gitConfigPath, 'utf8');
            const urlMatch = configContent.match(/url = (.*)/);
            if (urlMatch && urlMatch[1]) {
                const httpsUrl = convertGitUrlToHttps(urlMatch[1].trim());
                const serviceType = getGitServiceType(httpsUrl);
                const icon = serviceType ? gitIcons[serviceType] : '';
                gitContent = `
                    <span class="repository-link">
                        ${icon}
                        <a class="info-item-value" href="${httpsUrl}" target="_blank">${httpsUrl}</a>
                    </span>`;
            }

            // Add submodules section if any exist
            const submodules = getSubmodules(project.path);
            if (submodules.length > 0) {
                const submodulesList = submodules
                    .map(sub => {
                        const serviceType = getGitServiceType(sub.url);
                        const icon = serviceType ? gitIcons[serviceType] : '';
                        return `
                            <li class="repository-link">
                                ${icon}
                                <a class="info-item-value" href="${sub.url}" target="_blank" title="${sub.url}">${sub.name}</a>
                            </li>`;
                    })
                    .join('\n');

                submodulesHtml = `
                    <div class="info-section">
                        <div class="info-label">Git Submodules</div>
                        <ul class="submodules">
                            ${submodulesList}
                        </ul>
                    </div>`;
            }
        } catch (error) {
            gitContent = '<span class="info-item-value">Error reading Git configuration</span>';
        }
    }

    return `
    <div class="info-section">
        <div class="info-label">Git Repository</div>
        <div class="info-content">
            <div class="info-item">
                ${gitContent}
            </div>
        </div>
    </div>
    ${submodulesHtml}`;
}
