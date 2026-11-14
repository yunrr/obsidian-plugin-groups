import { App, Modal, Setting } from 'obsidian';
import { generateGroupID, setModalTitle } from '../../Utils/Utilities';
import ConfirmationPopupModal from '../BaseComponents/ConfirmationPopupModal';
import { PluginGroup } from '../../DataStructures/PluginGroup';
import GroupEditPluginsTab from '../../GroupEditModal/GroupEditPluginsTab';
import GroupEditGroupsTab from '../../GroupEditModal/GroupEditGroupsTab';
import GroupEditGeneralTab from '../../GroupEditModal/GroupEditGeneralTab';
import Manager from '../../Managers/Manager';
import CommandManager from '../../Managers/CommandManager';
import TabGroupComponent from '../BaseComponents/TabGroupComponent';
import GroupSettings from '../Settings/GroupSettings';

export default class GroupEditModal extends Modal {
	groupToEdit: PluginGroup;

	groupToEditCache: string;
	discardChanges = true;

	groupSettings: GroupSettings;

	constructor(app: App, settingsTab: GroupSettings, group: PluginGroup) {
		super(app);
		this.groupSettings = settingsTab;
		this.groupToEdit = group;
		this.groupToEditCache = JSON.stringify(group);
	}

	onOpen() {
		const { contentEl } = this;

		// Styling hook for the sticky tab bar and footer.
		this.modalEl.addClass('pg-edit-modal');

		// The title and the close button belong to the modal itself. Wiping
		// `modalEl` used to remove both, which left no way to close the dialog
		// on phones, where the modal covers the whole screen.
		this.updateTitle();

		contentEl.empty();

		new Setting(contentEl).setName('Name').addText((txt) => {
			txt.setValue(this.groupToEdit.name);
			txt.onChange((val) => {
				this.groupToEdit.name = val;
				this.updateTitle();
			});
		});

		new TabGroupComponent(contentEl, {
			tabs: [
				{
					title: 'General',
					content: new GroupEditGeneralTab(
						this.groupToEdit,
						contentEl
					).containerEl,
				},
				{
					title: 'Plugins',
					content:
						new GroupEditPluginsTab(contentEl, {
							group: this.groupToEdit,
						}).mainEl ??
						contentEl.createSpan(
							'Plugins not loaded, please contact the developer.'
						),
				},
				{
					title: 'Groups',
					content: new GroupEditGroupsTab(this.groupToEdit, contentEl)
						.containerEl,
				},
			],
		});

		this.generateFooter(contentEl);
	}

	private updateTitle() {
		setModalTitle(this, 'Editing "' + this.groupToEdit.name + '"');
	}

	private generateFooter(parentElement: HTMLElement) {
		const footer = parentElement.createDiv({ cls: 'modal-button-container' });

		new Setting(footer)
			.addButton((btn) => {
				btn.setButtonText('Delete');
				btn.setWarning();
				btn.onClick(() =>
					new ConfirmationPopupModal(
						this.app,
						'You are about to delete: ' + this.groupToEdit.name,
						void 0,
						'Delete',
						() => this.deleteGroup()
					).open()
				);
			})
			.addButton((btn) => {
				btn.setButtonText('Cancel');
				btn.onClick(() => this.close());
			})
			.addExtraButton((btn) => {
				btn.setIcon('copy')
					.setTooltip('Duplicate this group')
					.onClick(() => this.duplicate());
			})
			.addButton((btn) => {
				btn.setButtonText('Save');
				btn.setCta();
				btn.onClick(() => this.saveChanges());
			});
	}

	onClose() {
		const { contentEl } = this;

		contentEl.empty();

		if (
			Manager.getInstance().groupsMap.has(this.groupToEdit.id) &&
			this.discardChanges
		) {
			Object.assign(this.groupToEdit, JSON.parse(this.groupToEditCache));
		}
	}

	async saveChanges() {
		this.discardChanges = false;
		if (Manager.getInstance().groupsMap.has(this.groupToEdit.id)) {
			await this.editGroup(this.groupToEdit);
		} else {
			await this.addGroup(this.groupToEdit);
		}
	}

	async duplicate() {
		const duplicateGroup = new PluginGroup(this.groupToEdit);
		const groupMap = Manager.getInstance().groupsMap;

		if (!groupMap) {
			return;
		}
		duplicateGroup.name += '-Duplicate';
		const genId = generateGroupID(duplicateGroup.name);

		if (!genId) {
			return;
		}
		duplicateGroup.id = genId;

		await this.addGroup(duplicateGroup);
	}

	async addGroup(group: PluginGroup) {
		Manager.getInstance().groupsMap.set(group.id, group);

		CommandManager.getInstance().AddGroupCommands(group.id);

		await this.persistChangesAndClose();
	}

	async editGroup(group: PluginGroup) {
		Manager.getInstance().groupsMap.set(group.id, group);
		CommandManager.getInstance().updateCommand(group.id);
		await this.persistChangesAndClose();
	}

	async persistChangesAndClose() {
		await Manager.getInstance().saveSettings();
		this.groupSettings.render();
		this.close();
	}

	async deleteGroup() {
		Manager.getInstance().groupsMap.delete(this.groupToEdit.id);
		await Manager.getInstance().saveSettings();
		this.groupSettings.render();
		this.close();
	}
}
