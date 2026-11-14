import { App, Modal, Setting } from 'obsidian';
import Manager from '../Managers/Manager';
import { setModalTitle } from '../Utils/Utilities';

export default class DeviceSelectionModal extends Modal {
	headerText: string;

	cancelText: string;

	confirmText: string;

	eventTarget: EventTarget = new EventTarget();

	onConfirm: CustomEvent = new CustomEvent('onConfirm', {
		detail: {
			devices: [],
		},
	});

	selectedDevices: Set<string> = new Set<string>();

	constructor(
		app: App,
		onConfirmSelectionListener: EventListener,
		selectedDevices?: string[]
	) {
		super(app);
		this.headerText = 'Select devices';
		this.cancelText = 'Cancel';
		this.confirmText = 'Confirm';

		this.selectedDevices = new Set(selectedDevices);

		if (this.selectedDevices?.size > 0) {
			this.onConfirm.detail.devices = Array.from(
				this.selectedDevices.values()
			);
		}

		this.eventTarget.addEventListener(
			this.onConfirm.type,
			onConfirmSelectionListener
		);
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.empty();

		setModalTitle(this, this.headerText);

		if (Manager.getInstance().devices.length === 0) {
			contentEl.createEl('p', {
				text: 'No devices yet. Add one under Settings → Plugin Groups → Devices first.',
			});
		} else {
			contentEl.createEl('h4', { text: 'Devices' });

			Manager.getInstance().devices.forEach((device) => {
				new Setting(contentEl).setName(device).addToggle((tgl) => {
					tgl.setValue(this.selectedDevices.has(device));
					tgl.onChange((value) => {
						if (value) {
							this.selectedDevices.add(device);
						} else {
							this.selectedDevices.delete(device);
						}
					});
				});
			});
		}

		const footer = contentEl.createDiv({
			cls: 'modal-button-container',
		});

		new Setting(footer)
			.addButton((btn) => {
				btn.setButtonText(this.cancelText);
				btn.onClick(() => this.close());
			})
			.addButton((btn) => {
				btn.setButtonText(this.confirmText);
				btn.setCta();
				btn.onClick(() => {
					this.onConfirm.detail.devices = Array.from(
						this.selectedDevices.values()
					);
					this.eventTarget.dispatchEvent(this.onConfirm);
					this.close();
				});
			});
	}
}
