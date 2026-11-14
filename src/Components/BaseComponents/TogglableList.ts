import SettingsList from './SettingsList';
import { Setting } from 'obsidian';
import { Named } from '../../Utils/Types';

export interface ToggleListOptions<ItemType extends Named> {
	items: ItemType[];

	/**
	 * The function needs to be a reference or a '() =>' function to make sure that 'this.' references the parent object if needed
	 * @param item
	 */
	toggle: (item: ItemType) => void;

	/**
	 * The function needs to be a reference or a '() =>' function to make sure that 'this.' references the parent object if needed
	 * @param item
	 */
	getToggleState: (item: ItemType) => boolean;
}

export default class TogglableList<ItemType extends Named>
	extends SettingsList<ItemType, ToggleListOptions<ItemType>>
	implements IToggleableList<ItemType>
{
	generateListItem(listEl: HTMLElement, item: ItemType): Setting {
		const settingItem = new Setting(listEl);

		settingItem.setName(item.name);

		this.addToggleButton(settingItem, item);

		return settingItem;
	}

	/**
	 * A real toggle instead of a check/circle icon in a button: it is the
	 * control Obsidian uses for this, it is reachable with a thumb, and the
	 * row keeps its layout on phones.
	 */
	addToggleButton(setting: Setting, item: ItemType): void {
		setting.addToggle((tgl) => {
			tgl.setValue(this.getItemState(item));
			tgl.onChange(() => {
				this.toggleItem(item);
				tgl.setValue(this.getItemState(item));
			});
		});
	}

	toggleItem(item: ItemType): void {
		this.options.toggle(item);
	}

	getItemState(item: ItemType): boolean {
		return this.options.getToggleState(item);
	}
}

export interface IToggleableList<ItemType> {
	toggleItem(item: ItemType, value: boolean): void;

	addToggleButton(setting: Setting, item: ItemType): void;

	getItemState(item: ItemType): boolean;
}
