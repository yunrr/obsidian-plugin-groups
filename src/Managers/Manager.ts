import { PersistentSettings, PluginGroupsSettings } from '../Utils/Types';
import PgMain from '../../main';
import { PluginGroup } from '../DataStructures/PluginGroup';
import { pluginId } from '../Utils/Constants';
import { Platform, setIcon } from 'obsidian';
import GroupSettingsMenu from '../Components/Modals/GroupSettingsMenu';

const DEFAULT_SETTINGS: PluginGroupsSettings = {
	groupsMap: new Map<string, PluginGroup>(),
	generateCommands: true,
	showNoticeOnGroupLoad: 'none',
	devLogs: false,
	devices: [],
	doLoadSynchronously: true,
	showStatusbarIcon: 'None',
	detachDeferredPluginsOnStartup: true,
	detachedStartupPlugins: [],
};

export default class Manager {
	/**
	 * Rapid interactions (toggling plugins, renaming, filtering) call
	 * saveSettings many times in a row, and every call serializes the whole
	 * settings object and writes data.json to disk. Writes that land while
	 * another write is in flight are merged into a single follow-up write.
	 */
	private static readonly SAVE_DEBOUNCE_MS = 150;

	private static instance?: Manager;

	private settings: PluginGroupsSettings;

	private main: PgMain;

	private writeInFlight = false;
	private pendingWrite?: Promise<void>;
	private saveTimer?: number;
	private pendingSave?: Promise<void>;
	private resolvePendingSave?: () => void;
	private rejectPendingSave?: (reason?: unknown) => void;

	private constructor() {}

	public static getInstance(): Manager {
		if (!Manager.instance) {
			Manager.instance = new Manager();
		}
		return Manager.instance;
	}

	async init(main: PgMain): Promise<Manager> {
		this.main = main;
		await this.loadSettings();
		return this;
	}

	async loadSettings() {
		const savedSettings: PersistentSettings = await this.main.loadData();

		this.settings = Object.assign({}, DEFAULT_SETTINGS);

		if (!savedSettings) {
			return;
		}

		Object.keys(this.settings).forEach(function (key) {
			if (key in savedSettings) {
				// @ts-ignore
				Manager.getInstance().settings[key] = savedSettings[key];
			}
		});

		if (savedSettings.groups && Array.isArray(savedSettings.groups)) {
			this.settings.groupsMap = new Map<string, PluginGroup>();
			savedSettings.groups.forEach((g) => {
				this.groupsMap.set(g.id, new PluginGroup(g));
			});
		}
	}

	/***
	 * Returns a map of each plugin that is in 1 or more groups, and it's connected groups.
	 * Format: PluginID -> Set of connected groupsId's
	 */
	public get mapOfPluginsConnectedGroupsIncludingParentGroups(): Map<
		string,
		Set<string>
	> {
		const pluginsMemMap = new Map<string, Set<string>>();

		this.groupsMap.forEach((group) => {
			group.getAllPluginIdsControlledByGroup().forEach((plugin) => {
				if (!pluginsMemMap.has(pluginId)) {
					pluginsMemMap.set(plugin, new Set<string>());
				}
				pluginsMemMap.get(plugin)?.add(group.id);
			});
		});
		return pluginsMemMap;
	}

	public get mapOfPluginsDirectlyConnectedGroups(): Map<string, Set<string>> {
		const pluginsMemMap = new Map<string, Set<string>>();

		this.groupsMap.forEach((group) => {
			group.plugins.forEach((plugin) => {
				if (!pluginsMemMap.has(plugin.id)) {
					pluginsMemMap.set(plugin.id, new Set<string>());
				}
				pluginsMemMap.get(plugin.id)?.add(group.id);
			});
		});
		return pluginsMemMap;
	}

	public getGroupsOfPlugin(pluginId: string): PluginGroup[] {
		const groups: PluginGroup[] = [];
		for (const group of this.groupsMap.values()) {
			if (group.plugins.find((plugin) => plugin.id === pluginId)) {
				groups.push(group);
			}
		}
		return groups;
	}

	private createPersistentSettings(): PersistentSettings {
		return {
			groups: Array.from(this.groupsMap.values() ?? []),
			generateCommands:
				this.settings.generateCommands ??
				DEFAULT_SETTINGS.generateCommands,
			showNoticeOnGroupLoad:
				this.settings.showNoticeOnGroupLoad ??
				DEFAULT_SETTINGS.showNoticeOnGroupLoad,
			devLogs: this.settings.devLogs ?? DEFAULT_SETTINGS.devLogs,
			devices: this.settings.devices ?? DEFAULT_SETTINGS.devices,
			doLoadSynchronously:
				this.settings.doLoadSynchronously ??
				DEFAULT_SETTINGS.doLoadSynchronously,
			showStatusbarIcon:
				this.settings.showStatusbarIcon ??
				DEFAULT_SETTINGS.showStatusbarIcon,
			detachDeferredPluginsOnStartup:
				this.settings.detachDeferredPluginsOnStartup ??
				DEFAULT_SETTINGS.detachDeferredPluginsOnStartup,
			detachedStartupPlugins:
				this.settings.detachedStartupPlugins ??
				DEFAULT_SETTINGS.detachedStartupPlugins,
		};
	}

	/**
	 * Persists the current settings.
	 *
	 * When nothing else is being written, the write happens straight away so
	 * single actions (closing the group editor, flipping a switch) stay as
	 * responsive as before. Writes that arrive while another write is in
	 * flight, or during the short window after it, are merged into one
	 * follow-up write instead of each rewriting data.json.
	 */
	async saveSettings() {
		if (!this.writeInFlight && !this.saveTimer) {
			await this.writeSettings();
			return;
		}

		return this.scheduleSave();
	}

	private scheduleSave(): Promise<void> {
		if (!this.pendingSave) {
			this.pendingSave = new Promise<void>((resolve, reject) => {
				this.resolvePendingSave = resolve;
				this.rejectPendingSave = reject;
			});
		}

		if (this.saveTimer) {
			window.clearTimeout(this.saveTimer);
		}
		this.saveTimer = window.setTimeout(
			() => void this.flushPendingSaveSettings(),
			Manager.SAVE_DEBOUNCE_MS
		);

		return this.pendingSave;
	}

	private async writeSettings(): Promise<void> {
		this.writeInFlight = true;
		const write = this.main.saveData(this.createPersistentSettings());
		const settled = write
			.then(
				() => undefined,
				() => undefined
			)
			.then(() => {
				this.writeInFlight = false;
				if (this.pendingWrite === settled) {
					this.pendingWrite = undefined;
				}
			});
		this.pendingWrite = settled;
		await write;
	}

	/**
	 * Writes any pending settings change immediately. Called on unload so a
	 * scheduled write is never lost when the plugin or the app shuts down.
	 */
	async flushPendingSaveSettings(): Promise<void> {
		if (this.saveTimer) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = undefined;
		}

		// Let a write that is already on its way finish first.
		if (this.pendingWrite) {
			await this.pendingWrite;
		}

		if (!this.pendingSave) {
			return;
		}

		const resolve = this.resolvePendingSave;
		const reject = this.rejectPendingSave;
		this.pendingSave = undefined;
		this.resolvePendingSave = undefined;
		this.rejectPendingSave = undefined;

		try {
			await this.writeSettings();
			resolve?.();
		} catch (error) {
			reject?.(error);
		}
	}

	// Getters & Setters

	get doLoadSynchronously(): boolean {
		return this.settings.doLoadSynchronously;
	}

	set doLoadSynchronously(value: boolean) {
		this.settings.doLoadSynchronously = value;
	}

	get showStatusbarIcon() {
		return this.settings.showStatusbarIcon;
	}

	set showStatusbarIcon(value) {
		this.settings.showStatusbarIcon = value;
	}

	get devLog(): boolean {
		return this.settings.devLogs;
	}
	set devLog(value: boolean) {
		this.settings.devLogs = value;
	}

	get pluginInstance(): PgMain {
		return this.main;
	}

	public get pluginsManifests() {
		return this.obsidianPluginsObject.manifests;
	}

	public get obsidianPluginsObject() {
		// @ts-ignore
		return this.main.app.plugins;
	}

	get groupsMap(): Map<string, PluginGroup> {
		return this.settings.groupsMap;
	}

	get generateCommands(): boolean {
		return this.settings.generateCommands;
	}

	set shouldGenerateCommands(val: boolean) {
		this.settings.generateCommands = val;
	}

	get showNoticeOnGroupLoad(): string {
		return this.settings.showNoticeOnGroupLoad;
	}

	set showNoticeOnGroupLoad(val: string) {
		this.settings.showNoticeOnGroupLoad = val;
	}

	get devices(): string[] {
		return this.settings.devices;
	}

	/** Whether delayed plugins are kept out of Obsidian's startup list. */
	get detachDeferredPluginsOnStartup(): boolean {
		return this.settings.detachDeferredPluginsOnStartup;
	}

	set detachDeferredPluginsOnStartup(value: boolean) {
		this.settings.detachDeferredPluginsOnStartup = value;
	}

	/**
	 * Ids this plugin took out of Obsidian's startup list. Only these are ever
	 * added back, so plugins the user disabled themselves stay untouched.
	 */
	get detachedStartupPlugins(): string[] {
		return this.settings.detachedStartupPlugins;
	}

	set detachedStartupPlugins(value: string[]) {
		this.settings.detachedStartupPlugins = value;
	}

	private statusbarItem: HTMLElement;
	private statusbarMenu?: GroupSettingsMenu;

	public updateStatusbarItem() {
		if (this.statusbarItem) {
			this.statusbarItem.remove();
		}
		this.statusbarMenu = undefined;
		if (this.showStatusbarIcon === 'None') {
			return;
		}

		if (Platform.isMobile) {
			// The mobile apps have no status bar at all. main.ts adds a ribbon
			// action that offers the same group actions as a menu.
			return;
		}

		this.statusbarItem = this.pluginInstance.addStatusBarItem();
		this.statusbarItem.addClasses(['pg-statusbar-icon', 'mod-clickable']);
		this.statusbarItem.tabIndex = 0;

		if (this.showStatusbarIcon === 'Text') {
			this.statusbarItem.textContent = 'Plugins';
		} else if (this.showStatusbarIcon === 'Icon') {
			setIcon(this.statusbarItem, 'boxes');
		}

		// The menu renders a row (with buttons) for every group. Building it
		// eagerly made every startup pay for a panel most users never open.
		this.statusbarItem.onfocus = () => {
			if (!this.statusbarMenu) {
				this.statusbarMenu = new GroupSettingsMenu(
					this.statusbarItem,
					{}
				);
			}
			this.statusbarMenu.updatePosition();
		};
	}
}
