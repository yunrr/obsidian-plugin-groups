import SettingsList from './SettingsList';
import { Setting } from 'obsidian';

/**
 * A list whose items can be moved with two icon buttons.
 *
 * Note that the list renders in array order, so "up" means a lower index.
 */
export default abstract class ReorderableList<
	ItemType,
	OptionsType extends { items: ItemType[] }
> extends SettingsList<ItemType, OptionsType> {
	moveItemUp(item: ItemType): void {
		const currentIndex = this.findIndexInItems(item);

		if (currentIndex < this.options.items.length - 1 && currentIndex > -1) {
			this.options.items[currentIndex] =
				this.options.items[currentIndex + 1];
			this.options.items[currentIndex + 1] = item;
		}
		this.render();
	}

	moveItemDown(item: ItemType): void {
		const currentIndex = this.findIndexInItems(item);

		if (currentIndex > 0) {
			this.options.items[currentIndex] =
				this.options.items[currentIndex - 1];
			this.options.items[currentIndex - 1] = item;
		}
		this.render();
	}

	protected findIndexInItems(item: ItemType): number {
		return this.options.items.findIndex((listItem) => listItem === item);
	}

	generateListItem(listEl: HTMLElement, item: ItemType): Setting {
		// moveItemUp moves the item towards the end of the array, which is
		// further down the rendered list, so the arrows are the other way
		// around on purpose.
		const itemEl = new Setting(listEl)
			.addExtraButton((btn) => {
				btn.setIcon('arrow-up')
					.setTooltip('Move up')
					.onClick(() => {
						this.moveItemDown(item);
					});
			})
			.addExtraButton((btn) => {
				btn.setIcon('arrow-down')
					.setTooltip('Move down')
					.onClick(() => {
						this.moveItemUp(item);
					});
			});

		return itemEl;
	}
}
