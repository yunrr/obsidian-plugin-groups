import { Notice, Platform, Plugin } from 'obsidian';
import PluginGroupSettings from './src/PluginGroupSettings';
import Manager from './src/Managers/Manager';
import CommandManager from './src/Managers/CommandManager';
import PluginManager from './src/Managers/PluginManager';
import StartupScheduler from './src/Managers/StartupScheduler';
import StartupPluginList from './src/Managers/StartupPluginList';
import { showGroupMenu } from './src/Utils/GroupMenu';

interface PhaseTiming {
	label: string;
	duration: number;
}

export default class PgMain extends Plugin {
	async onload() {
		const manager = Manager.getInstance();
		const onloadStartedAt = performance.now();
		const timings: PhaseTiming[] = [];
		// Distinguishes "loaded while Obsidian starts" from "user just enabled
		// this plugin". Only the former should trigger delayed startup.
		const loadedDuringStartup = !this.app.workspace.layoutReady;

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

		if (Platform.isMobile) {
			// Status bar items don't exist on mobile, so the group actions get
			// a ribbon action instead.
			this.addRibbonIcon('boxes', 'Plugin groups', (evt) =>
				showGroupMenu(evt)
			);
		}

		// Anything that isn't a registration is deferred until the workspace is
		// ready. This follows Obsidian's "Optimize plugin load time" guide.
		this.app.workspace.onLayoutReady(() =>
			this.registerGroupCommandsAndStartupGroups(loadedDuringStartup)
		);

		this.displayTimeNotice(timings, performance.now() - onloadStartedAt);
	}

	private registerGroupCommandsAndStartupGroups(
		loadedDuringStartup: boolean
	) {
		const manager = Manager.getInstance();

		let phaseStartedAt = performance.now();
		if (manager.generateCommands) {
			manager.groupsMap.forEach((group) =>
				CommandManager.getInstance().AddGroupCommands(group.id)
			);
		}
		this.logDeferredTiming('Generated Commands for Groups', phaseStartedAt);

		// Delayed plugins are only postponed if Obsidian doesn't load them
		// itself first, so keep its startup list in line with the groups. This
		// shapes the next start, not this one.
		phaseStartedAt = performance.now();
		StartupPluginList.getInstance().reconcile();
		this.logDeferredTiming('Updated the startup plugin list', phaseStartedAt);

		if (!loadedDuringStartup) {
			// Loading the plugin mid-session shouldn't start enabling groups
			// behind the user's back.
			this.logDeferredTiming('Skipped delayed startup', performance.now());
			return;
		}

		phaseStartedAt = performance.now();
		StartupScheduler.getInstance().schedule(manager.groupsMap.values());
		this.logDeferredTiming('Scheduled delayed startup', phaseStartedAt);
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
		// Drop delays that haven't fired yet, then persist any pending change.
		StartupScheduler.getInstance().cancel();
		await Manager.getInstance().flushPendingSaveSettings();
	}
}
