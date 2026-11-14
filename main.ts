import { Notice, Plugin } from 'obsidian';
import PluginGroupSettings from './src/PluginGroupSettings';
import { disableStartupTimeout } from './src/Utils/Constants';
import Manager from './src/Managers/Manager';
import CommandManager from './src/Managers/CommandManager';
import PluginManager from './src/Managers/PluginManager';

interface PhaseTiming {
	label: string;
	duration: number;
}

export default class PgMain extends Plugin {
	async onload() {
		const manager = Manager.getInstance();
		const onloadStartedAt = performance.now();
		const timings: PhaseTiming[] = [];

		let phaseStartedAt = performance.now();
		await manager.init(this);
		this.recordTiming(timings, 'Manager Setup', phaseStartedAt);

		// Scanning for new plugins touches local storage and may rewrite
		// data.json. Obsidian loads every plugin before the user can interact
		// with the app, so this is queued rather than awaited here.
		phaseStartedAt = performance.now();
		void PluginManager.loadNewPlugins().catch((error) =>
			console.error(
				'Plugin Groups: could not scan for newly installed plugins',
				error
			)
		);
		this.recordTiming(timings, 'Queueing new plugin scan', phaseStartedAt);

		phaseStartedAt = performance.now();
		this.addSettingTab(new PluginGroupSettings(this.app, this));
		this.recordTiming(timings, 'Creating the Settings Tab', phaseStartedAt);

		phaseStartedAt = performance.now();
		manager.updateStatusbarItem();
		this.recordTiming(timings, 'Creating the Statusbar item', phaseStartedAt);

		// Anything that isn't a registration is deferred until the workspace is
		// ready. This follows Obsidian's "Optimize plugin load time" guide.
		this.app.workspace.onLayoutReady(() =>
			this.registerGroupCommandsAndStartupGroups()
		);

		this.displayTimeNotice(timings, performance.now() - onloadStartedAt);
	}

	private registerGroupCommandsAndStartupGroups() {
		const manager = Manager.getInstance();

		let phaseStartedAt = performance.now();
		if (manager.generateCommands) {
			manager.groupsMap.forEach((group) =>
				CommandManager.getInstance().AddGroupCommands(group.id)
			);
		}
		this.logDeferredTiming('Generated Commands for Groups', phaseStartedAt);

		// TODO: Improve hacky solution if possible
		if (window.performance.now() < disableStartupTimeout) {
			phaseStartedAt = performance.now();
			manager.groupsMap.forEach((group) => {
				if (group.loadAtStartup) group.startup();
			});
			this.logDeferredTiming(
				'Dispatching Groups for delayed start',
				phaseStartedAt
			);
		}
	}

	private recordTiming(
		timings: PhaseTiming[],
		label: string,
		startedAt: number
	) {
		if (!Manager.getInstance().devLog) {
			return;
		}
		timings.push({ label, duration: performance.now() - startedAt });
	}

	private logDeferredTiming(label: string, startedAt: number) {
		if (!Manager.getInstance().devLog) {
			return;
		}
		console.debug(
			`Plugin Groups: ${label} in ${(
				performance.now() - startedAt
			).toFixed(2)} ms`
		);
	}

	private displayTimeNotice(timings: PhaseTiming[], totalTime: number) {
		if (timings.length === 0) {
			return;
		}

		new Notice(
			timings
				.map(
					(item) => item.label + ': ' + item.duration.toFixed(2) + ' ms'
				)
				.join('\n') +
				'\nTotal Time: ' +
				totalTime.toFixed(0) +
				' ms',
			10000
		);
	}

	async onunload() {
		// Never lose a scheduled settings write when the plugin unloads.
		await Manager.getInstance().flushPendingSaveSettings();
	}
}
