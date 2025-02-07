import * as fs from 'fs';
import * as path from 'path';

interface VersionChanges {
    version: string;
    date: string;
    changes: {
        [type: string]: string[];
    };
}

export function getChangesSinceLastTag(context: any): VersionChanges[] {
    const changelogPath = path.join(context.extensionPath, 'CHANGELOG.md');
    const content = fs.readFileSync(changelogPath, 'utf8');
    const versions: VersionChanges[] = [];
    let tagsFound = 0;

    // Split content by version sections
    const versionSections = content.split(/## \[/);

    for (const section of versionSections) {
        if (!section.includes(']')) continue;

        const versionMatch = section.match(/^([\d.]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?\n/);
        if (!versionMatch) continue;

        const version = versionMatch[1];
        const date = versionMatch[2] || '';
        const changes: { [type: string]: string[] } = {};

        // Parse section content
        const lines = section.split('\n');
        let currentType = '';

        for (const line of lines) {
            if (line.startsWith('### ')) {
                currentType = line.replace('### ', '').trim();
                changes[currentType] = [];
            } else if (line.trim().startsWith('- ') && currentType) {
                changes[currentType].push(line.trim().substring(2));
            }
        }

        versions.push({ version, date, changes });
        tagsFound++;

        // Stop after finding two tags
        if (tagsFound >= 2) {
            break;
        }
    }

    return versions;
}
