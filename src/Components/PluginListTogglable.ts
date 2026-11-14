import { PgPlugin } from '../DataStructures/PgPlugin';
import { Setting } from 'obsidian';
import { PluginGroup } from '../DataStructures/PluginGroup';

export default class PluginListTogglable {
	pluginListEl: HTMLElement;

	private pluginListTarget: EventTarget = new EventTarget();

	private plugins: PgPlugin[];

	private ownerGroup?: PluginGroup;

	private parentEL: HTMLElement;

	constructor(
		parentEL: HTMLElement,
		pluginsToDisplay: PgPlugin[],
		actionOption?: ActionOption
	) {
		this.plugins = pluginsToDisplay;
		this.parentEL = parentEL;

		if (actionOption) {
			this.ownerGroup = actionOption?.group;

			this.pluginListTarget.addEventListener(
				'listToggleClicked',
				(evt: CustomEvent) => {
					actionOption.onClickAction(evt.detail);
				}
			);
		}
		this.generateList();
	}

	public updateList(pluginsToDisplay: PgPlugin[]) {
		this.plugins = pluginsToDisplay;
		this.render();
	}

	public render() {
		this.pluginListEl.remove();
		this.generateList();
	}

	private generateList() {
		this.pluginListEl = this.parentEL.createEl('div');
		this.pluginListEl.addClass('pg-settings-list');

		this.plugins.forEach((plugin) => {
			const setting = new Setting(this.pluginListEl).setName(plugin.name);
			if (this.ownerGroup) {
				// The button used to be appended straight into the row, next to
				// the control area. A toggle both lays out correctly and is
				// usable with a thumb.
				setting.addToggle((tgl) => {
					tgl.setValue(this.isPluginInGroup(plugin.id));
					tgl.onChange(() => {
						this.pluginListTarget.dispatchEvent(
							new CustomEvent('listToggleClicked', {
								detail: plugin,
							})
						);
						tgl.setValue(this.isPluginInGroup(plugin.id));
					});
				});
			}
		});
	}

	private isPluginInGroup(pluginId: string): boolean {
		if (!this.ownerGroup) {
			return false;
		}

		return this.ownerGroup.plugins.map((p) => p.id).contains(pluginId);
	}
}

interface ActionOption {
	group: PluginGroup;
	onClickAction: (plugin: PgPlugin) => void;
}
