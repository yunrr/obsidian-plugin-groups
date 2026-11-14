import { App, Modal, Setting } from 'obsidian';
import { setModalTitle } from '../../Utils/Utilities';

export default class ConfirmationPopupModal extends Modal {
	onConfirm: Event = new Event('onConfirm');

	eventTarget: EventTarget;

	headerText: string;

	cancelText: string;

	confirmText: string;

	private onConfirmListener?: EventListener;

	constructor(
		app: App,
		headerText: string,
		cancelText?: string,
		confirmText?: string,
		onConfirmListener?: EventListener
	) {
		super(app);
		this.headerText = headerText;
		this.eventTarget = new EventTarget();
		this.cancelText = cancelText ?? 'Cancel';
		this.confirmText = confirmText ?? 'Confirm';

		this.onConfirmListener = onConfirmListener;
		if (this.onConfirmListener) {
			this.eventTarget.addEventListener(
				this.onConfirm.type,
				this.onConfirmListener
			);
		}
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.empty();

		// The question belongs in the modal title: it stays visible while the
		// buttons scroll into view on small screens.
		setModalTitle(this, this.headerText);

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
				btn.setWarning();
				btn.onClick(() => {
					this.eventTarget.dispatchEvent(this.onConfirm);
					if (this.onConfirmListener) {
						this.eventTarget.removeEventListener(
							this.onConfirm.type,
							this.onConfirmListener
						);
					}
					this.close();
				});
			});
	}
}
