import * as fs from 'fs';
import * as path from 'path';

export function getGitUrl(projectPath: string): string | undefined {
    try {
        const gitConfigPath = path.join(projectPath, '.git', 'config');

        if (!fs.existsSync(gitConfigPath)) {
            return undefined;
        }

        const gitConfig = fs.readFileSync(gitConfigPath, 'utf8');
        const urlMatch = gitConfig.match(/url\s*=\s*(.+)/);

        if (!urlMatch) {
            return undefined;
        }

        let gitUrl = urlMatch[1].trim();

        // Convert SSH URL to HTTPS format if needed
        if (gitUrl.startsWith('git@')) {
            gitUrl = gitUrl
                .replace(/^git@([^:]+):/, 'https://$1/')
                .replace(/\.git$/, '');
        }

        return gitUrl;
    } catch (error) {
        console.error('Error reading Git config:', error);
        return undefined;
    }
}
