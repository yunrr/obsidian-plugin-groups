import { PluginGroup } from '../DataStructures/PluginGroup';
import { devLog } from '../Utils/Utilities';
import Manager from './Manager';

/**
 * Runs the groups that are marked as "load on startup" once their configured
 * delay has elapsed.
 *
 * Groups that share a delay are driven by a single timer and processed one
 * after another with a yield in between, so a large set of delayed plugins
 * doesn't collapse into one long blocking task right after Obsidian finished
 * loading. Every timer is tracked so pending work can be cancelled when the
 * plugin unloads.
 */
export default class StartupScheduler {
	private static instance?: StartupScheduler;

	private timers = new Set<number>();

	private constructor() {}

	public static getInstance(): StartupScheduler {
		if (!StartupScheduler.instance) {
			StartupScheduler.instance = new StartupScheduler();
		}
		return StartupScheduler.instance;
	}

	public schedule(groups: Iterable<PluginGroup>): void {
		const buckets = new Map<number, PluginGroup[]>();

		for (const group of groups) {
			if (!group.loadAtStartup) {
				continue;
			}

			const delayMs = Math.max(0, Math.round((group.delay ?? 0) * 1000));
			const bucket = buckets.get(delayMs);
			if (bucket) {
				bucket.push(group);
			} else {
				buckets.set(delayMs, [group]);
			}
		}

		buckets.forEach((bucketGroups, delayMs) => {
			const timer = window.setTimeout(() => {
				this.timers.delete(timer);
				void this.runBucket(bucketGroups);
			}, delayMs);
			this.timers.add(timer);
		});

		if (buckets.size > 0) {
			devLog(
				'Scheduled delayed startup',
				`${buckets.size} timer(s)`
			);
		}
	}

	private async runBucket(groups: PluginGroup[]): Promise<void> {
		for (let i = 0; i < groups.length; i++) {
			const group = groups[i];

			// The group may have been deleted or the plugin reloaded while we waited.
			if (!this.isGroupStillPending(group)) {
				continue;
			}

			try {
				await group.applyStartupBehaviour();
			} catch (error) {
				console.error(
					`Plugin Groups: delayed startup failed for "${group.name}"`,
					error
				);
			}

			if (i < groups.length - 1) {
				// Let the UI breathe between two groups instead of doing
				// everything in one go.
				await new Promise<void>((resolve) =>
					window.setTimeout(resolve, 0)
				);
			}
		}
	}

	private isGroupStillPending(group: PluginGroup): boolean {
		return (
			group.loadAtStartup &&
			Manager.getInstance().groupsMap.get(group.id) === group
		);
	}

	/** Cancels every delay that hasn't fired yet. */
	public cancel(): void {
		this.timers.forEach((timer) => window.clearTimeout(timer));
		this.timers.clear();
	}
}
