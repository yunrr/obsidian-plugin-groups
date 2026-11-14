import { App, Modal, Setting } from 'obsidian';
import { PgPlugin } from '../../DataStructures/PgPlugin';
import Manager from '../../Managers/Manager';
import TogglableList from '../BaseComponents/TogglableList';
import { PluginGroup } from '../../DataStructures/PluginGroup';
import { setModalTitle } from '../../Utils/Utilities';

export default class PluginModal extends Modal {
	private pluginToEdit: PgPlugin;

	private memberGroupIds: string[];

	private memberGroupsIdsCache: string[];

	private onCloseActions?: () => void;

	discardChanges = true;

	constructor(app: App, pluginToEdit: PgPlugin, onCloseActions?: () => void) {
		super(app);
		this.pluginToEdit = pluginToEdit;
		this.onCloseActions = onCloseActions;

		this.memberGroupIds = Manager.getInstance()
			.getGroupsOfPlugin(pluginToEdit.id)
			.map((g) => g.id);

		this.memberGroupsIdsCache = this.memberGroupIds.map((id) => id);
	}

	onOpen() {
		const { contentEl } = this;

		setModalTitle(this, 'Plugin "' + this.pluginToEdit.name + '"');

		contentEl.empty();

		if (Manager.getInstance().groupsMap.size === 0) {
			contentEl.createEl('p', {
				text: 'There are no groups yet. Create one in the plugin settings to assign this plugin.',
			});
		}

		if (this.memberGroupIds) {
			new TogglableList<PluginGroup>(contentEl, {
				items: Array.from(Manager.getInstance().groupsMap.values()),
				getToggleState: (item) => {
					return this.getToggleState(item);
				},
				toggle: (item) => {
					this.toggleItem(item);
				},
			});
		}

		this.generateFooter(contentEl);
	}

	toggleItem(item: PluginGroup) {
		if (!this.memberGroupIds.contains(item.id)) {
			this.memberGroupIds.push(item.id);
		} else {
			this.memberGroupIds.remove(item.id);
		}
	}

	getToggleState(item: PluginGroup): boolean {
		return this.memberGroupIds && this.memberGroupIds.contains(item.id);
	}

	onClose() {
		const { contentEl } = this;

		if (this.onCloseActions) {
			this.onCloseActions();
		}

		contentEl.empty();
	}

	private generateFooter(parentElement: HTMLElement) {
		const footer = parentElement.createDiv({ cls: 'modal-button-container' });

		new Setting(footer)
			.addButton((btn) => {
				btn.setButtonText('Cancel');
				btn.onClick(() => this.close());
			})
			.addButton((btn) => {
				btn.setButtonText('Save');
				btn.setCta();
				btn.onClick(() => this.saveChanges());
			});
	}

	private async saveChanges() {
		const removedGroupIds = this.memberGroupsIdsCache.filter(
			(id) => !this.memberGroupIds.includes(id)
		);

		removedGroupIds.forEach((id) =>
			Manager.getInstance()
				.groupsMap.get(id)
				?.removePlugin(this.pluginToEdit)
		);

		const addedGroupIds = this.memberGroupIds.filter(
			(id) => !this.memberGroupsIdsCache.includes(id)
		);

		addedGroupIds.forEach((id) => {
			Manager.getInstance()
				.groupsMap.get(id)
				?.addPlugin(this.pluginToEdit);
		});

		await Manager.getInstance().saveSettings();

		this.close();
	}
}
