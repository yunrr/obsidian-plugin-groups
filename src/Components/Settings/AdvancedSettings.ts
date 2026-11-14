import HtmlComponent from '../BaseComponents/HtmlComponent';
import { Setting, TextComponent } from 'obsidian';
import Manager from '../../Managers/Manager';
import StartupPluginList from '../../Managers/StartupPluginList';
import { makeCollapsible } from '../../Utils/Utilities';

export interface AdvancedSettingOptions {
	collapsible?: boolean;
}

export default class AdvancedSettings extends HtmlComponent<AdvancedSettingOptions> {
	newGroupName: string;

	groupNameField: TextComponent;

	constructor(parentEL: HTMLElement, options: AdvancedSettingOptions) {
		super(parentEL, options);
		this.generateComponent();
	}

	protected generateContent(): void {
		if (!this.mainEl) {
			return;
		}

		const header = this.mainEl.createEl('h4', {
			text: 'Advanced',
		});

		const content = this.mainEl.createDiv();

		if (this.options.collapsible) {
			makeCollapsible(header, content);
		}

		new Setting(content)
			.setName('Development logs')
			.setDesc(
				'Writes startup timings and group activity to the developer console.'
			)
			.addToggle((tgl) => {
				tgl.setValue(Manager.getInstance().devLog);
				tgl.onChange(async (value) => {
					Manager.getInstance().devLog = value;
					await Manager.getInstance().saveSettings();
				});
			});

		new Setting(content)
			.setName('Load synchronously')
			.setDesc(
				"Enables a group's plugins all at once instead of one after the other."
			)
			.addToggle((tgl) => {
				tgl.setValue(Manager.getInstance().doLoadSynchronously);
				tgl.onChange(async (value) => {
					Manager.getInstance().doLoadSynchronously = value;
					await Manager.getInstance().saveSettings();
				});
			});

		new Setting(content)
			.setName('Keep delayed plugins out of the startup list')
			.setDesc(
				"Removes the plugins of delayed groups from Obsidian's startup list, so they only load once their delay has passed. Applies from the next start."
			)
			.addToggle((tgl) => {
				tgl.setValue(
					Manager.getInstance().detachDeferredPluginsOnStartup
				);
				tgl.onChange(async (value) => {
					Manager.getInstance().detachDeferredPluginsOnStartup = value;
					await Manager.getInstance().saveSettings();
					StartupPluginList.getInstance().reconcile();
				});
			});
	}

	protected generateContainer(): void {
		this.mainEl = this.parentEl.createDiv();
	}
}
