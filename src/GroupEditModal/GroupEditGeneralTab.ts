import { PluginGroup } from '../DataStructures/PluginGroup';
import { Setting } from 'obsidian';
import DeviceSelectionModal from '../Components/DeviceSelectionModal';
import { disableStartupTimeout } from '../Utils/Constants';
import Manager from '../Managers/Manager';

export default class GroupEditGeneralTab {
	containerEl: HTMLElement;

	private groupToEdit: PluginGroup;

	constructor(group: PluginGroup, parentEl: HTMLElement) {
		this.groupToEdit = group;

		this.containerEl = this.generateGeneralSettingsSection(parentEl);
	}

	private generateGeneralSettingsSection(
		contentEl: HTMLElement
	): HTMLElement {
		// No "General" heading: the tab is already called General.
		const generalSettingsSection = contentEl.createDiv();

		new Setting(generalSettingsSection)
			.setName('Commands')
			.setDesc('Add commands to enable or disable this group.')
			.addToggle((tgl) => {
				tgl.setValue(this.groupToEdit.generateCommands);
				tgl.onChange(
					(value) => (this.groupToEdit.generateCommands = value)
				);
			});

		new Setting(generalSettingsSection)
			.setName('Auto add')
			.setDesc('Automatically add newly installed plugins to this group.')
			.addToggle((tgl) => {
				tgl.setValue(this.groupToEdit.autoAdd ?? false);
				tgl.onChange((value) => (this.groupToEdit.autoAdd = value));
			});

		const devicesSetting = new Setting(generalSettingsSection)
			.setName('Devices')
			.setDesc(this.getDevicesDescription())
			.addExtraButton((btn) => {
				btn.setIcon('pencil')
					.setTooltip('Choose devices')
					.onClick(() => {
						new DeviceSelectionModal(
							app,
							(evt: CustomEvent) => {
								this.groupToEdit.assignedDevices =
									evt.detail.devices;
								devicesSetting.setDesc(
									this.getDevicesDescription()
								);
							},
							this.groupToEdit.assignedDevices
						).open();
					});
			});

		this.GenerateStartupSettings(generalSettingsSection);

		return generalSettingsSection;
	}

	getDevicesDescription() {
		let description = 'Active on all devices';

		if (!this.groupToEdit.assignedDevices) {
			return description;
		}
		const arr: string[] = this.groupToEdit.assignedDevices.filter(
			(device) => Manager.getInstance().devices.contains(device)
		);
		if (arr?.length > 0) {
			description =
				'Active on: ' +
				arr.reduce((acc, curr, i, arr) => {
					if (i < 3) {
						return acc + ', ' + curr;
					} else if (i === arr.length - 1) {
						return (
							acc +
							', ... and ' +
							(i - 2) +
							' other' +
							(i - 2 > 1 ? 's' : '')
						);
					}
					return acc;
				});
		}
		return description;
	}

	private GenerateStartupSettings(contentEl: HTMLElement) {
		const startupParent = contentEl.createEl('div');
		startupParent.createEl('h4', { text: 'Startup' });

		// eslint-disable-next-line prefer-const
		let delaySetting: Setting;

		// eslint-disable-next-line prefer-const
		let behaviourEl: HTMLElement;

		const ChangeOptionVisibility = () => {
			behaviourEl?.toggle(this.groupToEdit.loadAtStartup);
			delaySetting?.settingEl.toggle(this.groupToEdit.loadAtStartup);
		};

		new Setting(startupParent)
			.setName('Load on startup')
			.setDesc('Enable or disable this group once Obsidian has started.')
			.addDropdown((drp) => {
				behaviourEl = drp.selectEl;
				drp.addOption('enable', 'Enable');
				drp.addOption('disable', 'Disable');
				drp.setValue(
					this.groupToEdit.disableOnStartup ? 'disable' : 'enable'
				);
				drp.onChange((value) => {
					value === 'disable'
						? (this.groupToEdit.disableOnStartup = true)
						: (this.groupToEdit.disableOnStartup = false);
				});
			})
			.addToggle((tgl) => {
				tgl.onChange((value) => {
					this.groupToEdit.loadAtStartup = value;
					ChangeOptionVisibility();
				});
				tgl.setValue(this.groupToEdit.loadAtStartup);
			});

		delaySetting = new Setting(startupParent)
			.setName('Delay')
			.addSlider((slider) => {
				slider.setValue(this.groupToEdit.delay);
				slider.setLimits(0, disableStartupTimeout / 1000, 1);
				slider.setDynamicTooltip();
				slider.onChange((value) => {
					this.groupToEdit.delay = value;
					delaySetting.setDesc(this.getDelayDescription());
				});
			})
			.setDesc(this.getDelayDescription());

		ChangeOptionVisibility();
	}

	private getDelayDescription(): string {
		const delay = this.groupToEdit.delay;
		return 'Loaded ' + delay + (delay === 1 ? ' second' : ' seconds') + ' after startup';
	}
}
