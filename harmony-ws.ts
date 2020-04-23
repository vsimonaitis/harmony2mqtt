import WebSocketClient from "./websocket-client"
import request = require("request-promise")
import changeCase = require("change-case")
import _get = require("lodash.get")
import _find = require("lodash.find")

export default class HarmonyHub {

	private socket: WebSocketClient
	readonly PORT = '8088';
	readonly TIMEOUT = 10000;
	readonly DOMAIN = 'svcs.myharmony.com';
	readonly ORIGIN = 'http://sl.dhg.myharmony.com';
	readonly ENGINE = 'vnd.logitech.harmony/vnd.logitech.harmony.engine';
	readonly EVENT_NOTIFY = 'connect.stateDigest?notify';

	private _msgId = 1;
	private _onActivityStartedCallbacks = [];
	private _hubId: string;
	private _lastActivityId: string;
	_config: unknown


	constructor(private _ip: string) {

	}

	async getHubId(): Promise<string> {
		var response = await request({
			url: `http://${this._ip}:${this.PORT}`,
			method: 'POST',
			headers: {
				Origin: this.ORIGIN,
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'Accept-Charset': 'utf-8',
			},
			body: {
				id: 1,
				cmd: 'setup.account?getProvisionInfo',
				params: {},
			},
			json: true,
		});


		const hubId: string = _get(response, 'data.activeRemoteId', false);
		if (!hubId) console.error('Hub not found');

		return hubId;
	}

	async start() {
		this._hubId = await this.getHubId();
		const wsUrl = `ws://${this._ip}:${this.PORT}/?domain=${this.DOMAIN}&hubId=${this._hubId}`;
		this.socket = await new WebSocketClient(wsUrl).open();
		await this.getConfig();
		this.socket.on('message', (data) => {
			try {
				const ob = JSON.parse(data.toString());
				const { id, type } = ob;
				_get(ob, 'data.device', []).forEach((device) => {
					device.label = changeCase.snakeCase(device.label);
				});
				if (type === this.EVENT_NOTIFY) this.handleNotify(ob);
			} catch (err) {
				console.error(err);
			}
		});
	}



	async getActivities() {
		return new Promise<IActivity[]>((resolve, reject) => {
			const activities: IActivity[] = _get(this._config, 'data.activity');
			if (!activities) reject(new Error('Activities not found'));
			const list: IActivity[] = [];
			activities.forEach((activity) => {
				const { id, label } = activity;
				const name = id === '-1' ? 'off' : changeCase.snakeCase(label.trim());
				list.push({ id, name, label });
			});
			resolve(list);
		});
	}

	async getCurrentActivity() {
		const cmd = `${this.ENGINE}?getCurrentActivity`;
		const params = { verb: 'get', format: 'json' };
		return this.runCmd(cmd, params)
			.then(ob => {
				const id = _get(ob, 'data.result');
				if (!id) throw new Error('Activity not found');
				return this.getActivities()
					.then((activities) => {
						const activity = _find(activities, { id });
						if (!activity) throw new Error('Activity not found');
						return activity;
					});
			});
	}

	async getConfig() {

		const cmd = `${this.ENGINE}?config`;
		const params = { verb: 'get', format: 'json' };
		this._config = await this.runCmd(cmd, params);
		_get(this._config, 'data.device', []).forEach((device) => {
			device.label = device.label;
		});

	}

	onActivityStarted(callback: (activity: IActivity) => void) {
		this._onActivityStartedCallbacks.push(callback);
	}

	turnOff() {
		return this.startActivity('off');
	}

	async startActivity(id: string) {
		id = changeCase.snakeCase(id.trim());
		return this.getActivities()
			.then((activities) => {
				let activity = _find(activities, { name: id });
				if (!activity) activity = _find(activities, { id });
				if (!activity) throw new Error('Activity not found');
				const cmd = 'harmony.activityengine?runactivity';
				const params = {
					async: 'false',
					timestamp: 0,
					args: { rule: 'start' },
					activityId: activity.id,
				};
				return this.runCmd<IActivity>(cmd, params);
			});

	}

	private async runCmd<T>(cmd, params) {
		const id = this._msgId++;
		const payload = {
			hubId: this._hubId,
			timeout: Math.floor(this.TIMEOUT / 1000),
			hbus: { cmd, id, params },
		};
		this.socket.send(JSON.stringify(payload), {});
		return this.responseAwait<T>(id);
	}

	private async responseAwait<T>(msgId) {
		return new Promise<T>((resolve, reject) => {
			let timeout: NodeJS.Timeout;
			let responseHandler = (data) => {
				try {
					const ob = JSON.parse(data.toString());
					const { id, type } = ob;
					if (msgId == id) {
						resolve(JSON.parse(data));
					}
				} catch (err) {
					console.error(err);
				} finally {
					clearTimeout(timeout);
					this.socket.off('message', responseHandler);
				}
			};
			timeout = setTimeout(() => {
				reject(`Msg ${msgId} Timeout`);
				clearTimeout(timeout);
				this.socket.off('message', responseHandler);
			}, this.TIMEOUT);

			this.socket.on('message', responseHandler);
		})
	}

	private handleNotify(ob) {
		const status = _get(ob, 'data.activityStatus');
		if (![0, 1].includes(status)) return;
		const id = _get(ob, 'data.activityId', false);
		if (id === false || this._lastActivityId === id) return;
		this._lastActivityId = id;
		this.getActivities()
			.then((activities) => {
				const activity = _find(activities, { id });
				if (activity) this._onActivityStartedCallbacks.forEach(callback => callback(activity));
			})
			.catch(() => { });
	}
}

export interface IActivity {
	id: string;
	name: string;
	label: string;

}