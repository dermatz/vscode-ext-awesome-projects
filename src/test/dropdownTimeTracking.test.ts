import * as assert from 'assert';
import { getTimeTrackingDropdownHtml } from '../template/project/components/dropdowns/dropdownTimeTracking';
import { Project } from '../extension';
import { TimeTrackingSession } from '../types/timeTracking';

suite('Time Tracking Dropdown Template Tests', () => {
    const baseProject: Project = {
        id: 'proj-1',
        name: 'Videor',
        path: '/tmp/videor',
        color: '#3fb950'
    };

    const completedSession: TimeTrackingSession = {
        id: 'session-completed',
        projectId: 'proj-1',
        title: 'Earlier work',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        durationSeconds: 120,
        branchLog: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const activeSession: TimeTrackingSession = {
        id: 'session-active',
        projectId: 'proj-1',
        title: 'Working on VID-1781',
        startTime: new Date().toISOString(),
        durationSeconds: 14,
        branchLog: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    test('renders active session at the top with running indicator', () => {
        const html = getTimeTrackingDropdownHtml(
            baseProject,
            134,
            [completedSession],
            true,
            activeSession
        );

        assert.ok(html.includes('session-live-indicator'), 'should render running indicator');
        assert.ok(html.includes('Working on VID-1781'), 'should render active session title');
        assert.ok(html.includes('time-tracking-session-active'), 'should mark active session card');

        const activeIndex = html.indexOf('session-active');
        const completedIndex = html.indexOf('session-completed');
        assert.ok(activeIndex < completedIndex && activeIndex !== -1, 'active session should appear before completed sessions');
    });

    test('does not duplicate active session when it is already in the list', () => {
        const html = getTimeTrackingDropdownHtml(
            baseProject,
            134,
            [activeSession, completedSession],
            true,
            activeSession
        );

        const sessionCards = html.match(/class="time-tracking-session[ "]/g);
        assert.strictEqual(sessionCards?.length, 2, 'should render exactly two session cards');
    });

    test('renders no running indicator when timer is stopped', () => {
        const html = getTimeTrackingDropdownHtml(
            baseProject,
            120,
            [completedSession],
            false,
            undefined
        );

        assert.ok(!html.includes('session-live-indicator'), 'should not render running indicator when stopped');
        assert.ok(!html.includes('time-tracking-session-active'), 'should not mark any session as active when stopped');
    });
});
