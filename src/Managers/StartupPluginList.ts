import { PluginGroup } from '../DataStructures/PluginGroup';
import { pluginId } from '../Utils/Constants';
import { devLog } from '../Utils/Utilities';
import Manager from './Manager';

/**
 * The slice of Obsidian's plugin manager this module needs. `app.plugins` is
 * not covered by the public API typings, so it is described structurally here.
 */
interface ObsidianPluginsInternals {
	enabledPlugins?: Set<string>;
	enablePlugin?: (id: string) => Promise<boolean>;
	requestSaveConfig?: () => void;
}

interface GroupCoverage {
	/** Only ever reached through a group that waits before loading it. */
	deferredOnly: Set<string>;
	/** A group turns the plugin off once Obsidian finished starting. */
	off: Set<string>;
}

/**
 * Keeps Obsidian's startup list (`.obsidian/community-plugins.json`) in sync
 * with the groups.
 *
 * Obsidian reads that list and loads every entry in it before the user can
 * interact, so a plugin listed there is loaded no matter what a delayed group
 * says. The only way to keep a delayed plugin out of that first load is to
 * take its id out of the list and let the group enable it when its delay has
 * passed. That is what this class does, and it is why the effect starts with
 * the next start: `onload` already runs after the list has been read.
 *
 * Ids taken out this way are remembered in the settings so that only plugins
 * this class removed are ever put back. A plugin the user disabled on their
 * own is never re-enabled here.
 */
export default class StartupPluginList {
	private static instance?: StartupPluginList;

	private constructor() {}

	public static getInstance(): StartupPluginList {
		if (!StartupPluginList.instance) {
			StartupPluginList.instance = new StartupPluginList();
		}
		return StartupPluginList.instance;
	}

	/**
	 * Takes the plugins of delayed groups out of Obsidian's startup list, and
	 * gives back the ones that are not delayed anymore.
	 */
	public reconcile(): void {
		const manager = Manager.getInstance();
		const obsidianPlugins = manager.obsidianPluginsObject as
			| ObsidianPluginsInternals
			| undefined;
		const enabledPlugins = obsidianPlugins?.enabledPlugins;

		if (!obsidianPlugins || !enabledPlugins) {
			return;
		}

		const managed = manager.detachDeferredPluginsOnStartup;
		const recorded = manager.detachedStartupPlugins;

		// A group assigned to another device doesn't run here, so only the
		// groups of this device decide what gets taken out...
		const coverageOnThisDevice = managed
			? StartupPluginList.getCoverage(manager.groupsMap.values(), true)
			: undefined;

		// ...but an id is only handed back once no group at all still delays
		// it, otherwise two devices would keep undoing each other's work.
		const coverageEverywhere = StartupPluginList.getCoverage(
			manager.groupsMap.values(),
			false
		);

		const toDetach: string[] = [];
		coverageOnThisDevice?.deferredOnly.forEach((id) => {
			if (id !== pluginId && enabledPlugins.has(id)) {
				toDetach.push(id);
			}
		});

		const toRestore = managed
			? recorded.filter((id) => !coverageEverywhere.deferredOnly.has(id))
			: [...recorded];

		if (toDetach.length === 0 && toRestore.length === 0) {
			return;
		}

		toDetach.forEach((id) => enabledPlugins.delete(id));
		toRestore.forEach((id) => enabledPlugins.add(id));

		// Obsidian debounces this write and then saves the whole list, so it
		// is one config write for any number of changes.
		obsidianPlugins.requestSaveConfig?.();

		for (const id of toRestore) {
			// Obsidian already read the list for this session, so the plugin
			// has to be loaded here to not disappear until the next restart.
			// Groups that switch it off at startup get to do that instead.
			if (!coverageEverywhere.off.has(id)) {
				void obsidianPlugins.enablePlugin?.(id);
			}
		}

		const nextRecorded = new Set(recorded);
		toRestore.forEach((id) => nextRecorded.delete(id));
		toDetach.forEach((id) => nextRecorded.add(id));
		manager.detachedStartupPlugins = Array.from(nextRecorded);

		devLog(
			'Updated the Obsidian startup list',
			`${toDetach.length} removed, ${toRestore.length} restored`
		);

		void manager.saveSettings();
	}

	/**
	 * Works out which plugins each startup group is responsible for, without
	 * touching the plugin list yet.
	 */
	private static getCoverage(
		groups: Iterable<PluginGroup>,
		respectDevices: boolean
	): GroupCoverage {
		const deferred = new Set<string>();
		const claimed = new Set<string>();
		const off = new Set<string>();

		for (const group of groups) {
			if (respectDevices && !group.groupActive()) {
				continue;
			}

			// Groups that are only ever started by hand must not change what
			// Obsidian loads on its own.
			if (!group.loadAtStartup) {
				continue;
			}

			const ids = group.getAllPluginIdsControlledByGroup();

			if (group.disableOnStartup) {
				ids.forEach((id) => {
					off.add(id);
					claimed.add(id);
				});
			} else if ((group.delay ?? 0) > 0) {
				ids.forEach((id) => deferred.add(id));
			} else {
				// Loaded right away: Obsidian may keep loading it by itself.
				ids.forEach((id) => claimed.add(id));
			}
		}

		claimed.forEach((id) => deferred.delete(id));

		return { deferredOnly: deferred, off };
	}
}
