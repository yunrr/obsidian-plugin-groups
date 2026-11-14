import { Menu, setIcon } from 'obsidian';
import HtmlComponent from './HtmlComponent';

interface DropdownActionButtonOptions {
	mainLabel: MainLabelOptions;
	dropDownOptions: DropdownOption[];
	minWidth?: string;
	drpIcon?: string;
}

/**
 * A button that opens its options in Obsidian's own menu.
 *
 * It used to render a `ul` inside the `button` and reveal it with
 * `:focus-within`, which does not work with touch and got clipped by the
 * surrounding scroll container. A real menu is themed, positioned and sized by
 * Obsidian itself, including the mobile version.
 */
export default class DropdownActionButton extends HtmlComponent<DropdownActionButtonOptions> {
	private labelEl?: HTMLElement;

	constructor(
		parentElement: HTMLElement,
		options: DropdownActionButtonOptions
	) {
		super(parentElement, options);

		this.generateComponent();
	}

	protected generateContainer() {
		this.mainEl = this.parentEl.createEl('button', {
			cls: 'pg-menu-btn',
		});

		if (this.options.minWidth) {
			this.mainEl.style.minWidth = this.options.minWidth;
		}

		// Assigned rather than added, so re-rendering cannot stack listeners.
		this.mainEl.onclick = (evt) => this.showMenu(evt);
	}

	protected generateContent() {
		if (!this.mainEl) {
			return;
		}

		this.mainEl.empty();

		const { mainLabel, drpIcon } = this.options;

		this.labelEl = this.mainEl.createSpan({ cls: 'pg-menu-btn-label' });
		this.setElementTextOrIcon(this.labelEl, mainLabel.label, mainLabel.icon);

		const iconEl = this.mainEl.createSpan({ cls: 'pg-menu-btn-icon' });
		setIcon(iconEl, drpIcon ?? 'chevron-down');
	}

	private showMenu(evt: MouseEvent) {
		const menu = new Menu();

		this.options.dropDownOptions.forEach((option) => {
			menu.addItem((item) =>
				item
					.setTitle(option.label)
					.setIcon(option.icon ?? null)
					.onClick(() => option.func())
			);
		});

		menu.showAtMouseEvent(evt);
	}

	private setElementTextOrIcon(
		element: HTMLElement,
		label: string,
		icon?: string
	) {
		if (icon) {
			setIcon(element.createSpan(), icon);
		} else {
			element.setText(label);
		}
	}
}

export interface DropdownOption {
	label: string;
	func: () => void;
	icon?: string;
}

interface MainLabelOptions {
	label: string;
	icon?: string;
}
