import {
	App,
	ButtonComponent,
	Notice,
	Platform,
	PluginSettingTab,
	Setting,
	TextComponent,
} from 'obsidian';
import PgMain from '../main';
import {
	getCurrentlyActiveDevice,
	makeCollapsible,
	setCurrentlyActiveDevice,
} from './Utils/Utilities';
import ConfirmationPopupModal from './Components/BaseComponents/ConfirmationPopupModal';
import Manager from './Managers/Manager';
import PluginManager from './Managers/PluginManager';
import GroupSettings from './Components/Settings/GroupSettings';
import AdvancedSettings from './Components/Settings/AdvancedSettings';
import PluginSettings from './Components/Settings/PluginsSettings';

export default class PluginGroupSettings extends PluginSettingTab {
	constructor(app: App, plugin: PgMain) {
		super(app, plugin);
	}

	async display(): Promise<void> {
		await PluginManager.loadNewPlugins();

		const { containerEl } = this;

		containerEl.empty();

		this.generateGeneralSettings(containerEl);

		new GroupSettings(containerEl, {
			collapsible: true,
			startOpened: true,
		});

		this.GenerateDeviceList(containerEl);

		new PluginSettings(containerEl, {collapsible: true});

		new AdvancedSettings(containerEl, { collapsible: true });
	}

	private generateGeneralSettings(containerEl: HTMLElement) {
		// A settings tab lists its general options at the top without a
		// heading: the tab title already names the plugin.
		const content = containerEl.createDiv();

		new Setting(content)
			.setName('Generate commands for groups')
			.addToggle((tgl) => {
				tgl.setValue(Manager.getInstance().generateCommands ?? false);
				tgl.onChange(async (value) => {
					Manager.getInstance().shouldGenerateCommands = value;
					await Manager.getInstance().saveSettings();
				});
			});

		new Setting(content)
			.setName('Notice upon loading groups')
			.addDropdown((drp) => {
				drp.addOption('none', 'None')
					.addOption('short', 'Short')
					.addOption('normal', 'Normal');
				drp.setValue(
					Manager.getInstance().showNoticeOnGroupLoad ?? 'none'
				);
				drp.onChange(async (value) => {
					Manager.getInstance().showNoticeOnGroupLoad = value;
					await Manager.getInstance().saveSettings();
				});
			});

		const statusBarSetting = new Setting(content).setName(
			'Status bar menu'
		);

		if (Platform.isMobile) {
			// Status bar items do not exist on mobile, see the Obsidian docs.
			statusBarSetting.setDesc('Not available on mobile.');
		}

		statusBarSetting.addDropdown((drp) => {
			drp.addOption('None', 'None')
				.addOption('Icon', 'Icon')
				.addOption('Text', 'Text');
			drp.setValue(Manager.getInstance().showStatusbarIcon ?? 'None');
			drp.onChange(async (value) => {
				switch (value) {
					case 'Icon':
						Manager.getInstance().showStatusbarIcon = 'Icon';
						break;
					case 'Text':
						Manager.getInstance().showStatusbarIcon = 'Text';
						break;
					default:
						Manager.getInstance().showStatusbarIcon = 'None';
						break;
				}
				await Manager.getInstance().saveSettings();
				Manager.getInstance().updateStatusbarItem();
			});
		});
	}

	GenerateDeviceList(contentEl: HTMLElement) {
		let newDeviceName = '';
		const CreateNewDevice = async () => {
			if (!newDeviceName || newDeviceName.replace(' ', '') === '') {
				return;
			}

			if (Manager.getInstance().devices.contains(newDeviceName)) {
				new Notice('Name already in use for other device');
				return;
			}

			Manager.getInstance().devices.push(newDeviceName);
			await Manager.getInstance().saveSettings();

			if (!getCurrentlyActiveDevice()) {
				setCurrentlyActiveDevice(newDeviceName);
			}

			this.display();

			newDeviceName = '';
			newDevNameText.setValue(newDeviceName);
		};

		const header = contentEl.createEl('h4', { text: 'Devices' });

		const content = contentEl.createDiv();

		makeCollapsible(header, content);

		let deviceAddBtn: ButtonComponent;

		const deviceNameSetting = new Setting(content).setName('New device');

		const newDevNameText = new TextComponent(deviceNameSetting.controlEl);
		newDevNameText
			.setValue(newDeviceName)
			.onChange((value) => {
				newDeviceName = value;
				if (deviceAddBtn) {
					value.replace(' ', '').length > 0
						? deviceAddBtn.buttonEl.removeClass('btn-disabled')
						: deviceAddBtn.buttonEl.addClass('btn-disabled');
				}
			})
			.setPlaceholder('Device name').inputEl.onkeydown = async (e) => {
			if (e.key === 'Enter') {
				await CreateNewDevice();
			}
		};

		deviceNameSetting.addButton((btn) => {
			deviceAddBtn = btn;
			deviceAddBtn
				.setIcon('plus')
				.onClick(async () => {
					await CreateNewDevice();
				})
				.buttonEl.addClass('btn-disabled');
		});

		Manager.getInstance().devices.forEach((device) => {
			const deviceSetting = new Setting(content).setName(device);
			if (getCurrentlyActiveDevice() === device) {
				deviceSetting.setDesc('Current Device').addButton((btn) => {
					btn.setIcon('trash');
					btn.onClick(() =>
						new ConfirmationPopupModal(
							this.app,
							'This is the currently active device, are you sure?',
							void 0,
							'Delete',
							() => {
								this.ResetCurrentDevice();
							}
						).open()
					);
				});
			} else {
				deviceSetting
					.addButton((btn) => {
						btn.setButtonText('Set as current');
						btn.onClick(() => {
							setCurrentlyActiveDevice(device);
							this.display();
						});
					})
					.addButton((btn) => {
						btn.setIcon('trash');
						btn.onClick(() =>
							new ConfirmationPopupModal(
								this.app,
								'You are about to delete: ' + device,
								void 0,
								'Delete',
								async () => {
									Manager.getInstance().devices.remove(
										device
									);
									await Manager.getInstance().saveSettings();
									this.display();
								}
							).open()
						);
					});
			}
		});
	}

	ResetCurrentDevice() {
		const device: string | null = getCurrentlyActiveDevice();

		if (!device) {
			return;
		}
		Manager.getInstance().devices.remove(device);
		setCurrentlyActiveDevice(null);
		this.display();
	}



}
