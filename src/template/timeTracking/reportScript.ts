import * as vscode from 'vscode';
import { loadResourceFile } from '../utils/resourceLoader';

export async function getReportScriptHtml(
    context: vscode.ExtensionContext,
    sessionsMetaJson: string,
    period: string,
    groupBy: string
): Promise<string> {
    let scriptSrc = '';
    try {
        scriptSrc = await loadResourceFile(context, 'dist/js/timeTrackingReport.js');
    } catch {
        scriptSrc = await loadResourceFile(context, 'src/js/timeTrackingReport.js').catch(() => '');
    }
    return `<script>
        const sessionsMeta = ${sessionsMetaJson};
        const reportPeriod = ${JSON.stringify(period)};
        const reportGroupBy = ${JSON.stringify(groupBy)};
        ${scriptSrc}
    </script>`;
}
