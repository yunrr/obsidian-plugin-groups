import { Menu } from 'obsidian';
import Manager from '../Managers/Manager';

/**
 * A menu with every group's enable and disable action.
 *
 * It exists for mobile: status bar items, which the desktop version uses for
 * the same purpose, are not supported by the mobile apps, so phones get a
 * ribbon action instead. A real menu also handles touch, theming and screen
 * edges on its own.
 */
export function showGroupMenu(evt: MouseEvent) {
	const manager = Manager.getInstance();
	const menu = new Menu();

	let groupCount = 0;

	manager.groupsMap.forEach((group) => {
		groupCount++;
		menu.addItem((item) =>
			item
				.setTitle('Enable ' + group.name)
				.setIcon('power')
				.onClick(() => void group.enable())
		);
	});

	if (groupCount === 0) {
		menu.addItem((item) =>
			item.setTitle('No groups yet').setDisabled(true)
		);
		menu.showAtMouseEvent(evt);
		return;
	}

	menu.addSeparator();

	manager.groupsMap.forEach((group) => {
		menu.addItem((item) =>
			item
				.setTitle('Disable ' + group.name)
				.setIcon('power-off')
				.onClick(() => group.disable())
		);
	});

	menu.showAtMouseEvent(evt);
}
