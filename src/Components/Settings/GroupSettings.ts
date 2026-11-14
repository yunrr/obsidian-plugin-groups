import HtmlComponent from '../BaseComponents/HtmlComponent';
import { Setting, TextComponent } from 'obsidian';
import Manager from '../../Managers/Manager';
import { generateGroupID, makeCollapsible } from '../../Utils/Utilities';
import { PluginGroup } from '../../DataStructures/PluginGroup';
import GroupEditModal from '../Modals/GroupEditModal';

export interface GroupSettingOptions {
	collapsible?: boolean;
	startOpened?: boolean;
	maxListHeight?: number;
}

export default class GroupSettings extends HtmlComponent<GroupSettingOptions> {
	newGroupName: string;

	groupNameField: TextComponent;

	constructor(parentEL: HTMLElement, options: GroupSettingOptions) {
		super(parentEL, options);
		this.generateComponent();
	}

	protected generateContent(): void {
		if (!this.mainEl) {
			return;
		}

		const header = this.mainEl.createEl('h4', { text: 'Groups' });

		const content = this.mainEl.createDiv();

		if (this.options.collapsible) {
			makeCollapsible(header, content, this.options.startOpened);
		}

		let addBtn: { setDisabled(disabled: boolean): unknown };

		new Setting(content)
			.setName('Add group')
			.addText((text) => {
				this.groupNameField = text;
				this.groupNameField
					.setPlaceholder('Group name')
					.setValue(this.newGroupName)
					.onChange((val) => {
						this.newGroupName = val;
						addBtn?.setDisabled(
							val.replace(' ', '').length === 0
						);
					}).inputEl.onkeydown = async (e) => {
					if (e.key === 'Enter') {
						await this.addNewGroup();
					}
				};
			})
			.addButton((btn) => {
				btn.setIcon('plus')
					.setTooltip('Create group')
					.onClick(() => this.addNewGroup());
				addBtn = btn;
				btn.setDisabled(true);
			});

		const listContainer = this.createListContainer(content);

		this.GenerateGroupList(listContainer);
	}

	/**
	 * A list of group rows. The height limit is handed to CSS instead of being
	 * written as an inline `px` string, which used to end up as `undefinedpx`.
	 */
	private createListContainer(parentEl: HTMLElement): HTMLElement {
		const listContainer = parentEl.createDiv();

		if (this.options.maxListHeight) {
			listContainer.style.setProperty(
				'--pg-list-max-height',
				this.options.maxListHeight + 'px'
			);
		}

		return listContainer;
	}

	protected generateContainer(): void {
		this.mainEl = this.parentEl.createDiv();
	}

	GenerateGroupList(groupParent: HTMLElement) {
		Manager.getInstance().groupsMap.forEach((group) => {
			const groupSetting = new Setting(groupParent)
				.setName(group.name)
				.setClass('pg-group-row')
				.addExtraButton((btn) => {
					btn.setIcon('power')
						.setTooltip('Enable group')
						.setDisabled(!group.groupActive())
						.onClick(async () => {
							await group.enable();
						});
				})
				.addExtraButton((btn) => {
					btn.setIcon('power-off')
						.setTooltip('Disable group')
						.setDisabled(!group.groupActive())
						.onClick(() => group.disable());
				})
				.addExtraButton((btn) => {
					btn.setIcon('pencil')
						.setTooltip('Edit group')
						.onClick(() => this.editGroup(group));
				});
			if (group.loadAtStartup) {
				const descFrag = new DocumentFragment();
				const startupEl = descFrag.createEl('span');
				startupEl.createEl('b', {
					text: 'Startup: ',
				});
				startupEl.createEl('span', {
					text: group.disableOnStartup
						? 'Disabled after startup'
						: 'Delayed by ' + group.delay + ' seconds',
				});

				if (!group.groupActive()) {
					const activeEl = descFrag.createEl('span');
					activeEl.createEl('br');
					activeEl.createEl('b', { text: 'Inactive: ' });
					activeEl.createEl('span', {
						text: 'Not enabled for current device',
					});
				}

				groupSetting.setDesc(descFrag);
			}
		});
	}

	async addNewGroup() {
		const id = generateGroupID(this.newGroupName);

		if (!id) {
			console.error(
				'Failed to create Group, please choose a different Name as there have been to many groups with the same name'
			);
			return;
		}

		const newGroup = new PluginGroup({
			id: id,
			name: this.newGroupName,
		});
		new GroupEditModal(
			Manager.getInstance().pluginInstance.app,
			this,
			newGroup
		).open();
		this.newGroupName = '';
		if (this.groupNameField) {
			this.groupNameField.setValue('');
		}
	}

	editGroup(group: PluginGroup) {
		new GroupEditModal(
			Manager.getInstance().pluginInstance.app,
			this,
			group
		).open();
	}
}
