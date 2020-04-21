"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const websocket_client_1 = require("./websocket-client");
const request = require("request-promise");
const changeCase = require("change-case");
const _get = require("lodash.get");
const _find = require("lodash.find");
class HarmonyHub {
    constructor(_ip) {
        this._ip = _ip;
        this.PORT = '8088';
        this.TIMEOUT = 10000;
        this.DOMAIN = 'svcs.myharmony.com';
        this.ORIGIN = 'http://sl.dhg.myharmony.com';
        this.ENGINE = 'vnd.logitech.harmony/vnd.logitech.harmony.engine';
        this.EVENT_NOTIFY = 'connect.stateDigest?notify';
        this._msgId = 1;
        this._onActivityStartedCallbacks = [];
    }
    async getHubId() {
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
        const hubId = _get(response, 'data.activeRemoteId', false);
        if (!hubId)
            console.error('Hub not found');
        return hubId;
    }
    async start() {
        this._hubId = await this.getHubId();
        const wsUrl = `ws://${this._ip}:${this.PORT}/?domain=${this.DOMAIN}&hubId=${this._hubId}`;
        this.socket = await new websocket_client_1.default(wsUrl).open();
        await this.getConfig();
        this.socket.on('message', (data) => {
            try {
                const ob = JSON.parse(data.toString());
                const { id, type } = ob;
                _get(ob, 'data.device', []).forEach((device) => {
                    device.label = changeCase.snakeCase(device.label);
                });
                if (type === this.EVENT_NOTIFY)
                    this.handleNotify(ob);
            }
            catch (err) {
                console.error(err);
            }
        });
    }
    async getActivities() {
        return new Promise((resolve, reject) => {
            const activities = _get(this._config, 'data.activity');
            if (!activities)
                reject(new Error('Activities not found'));
            const list = [];
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
            if (!id)
                throw new Error('Activity not found');
            return this.getActivities()
                .then((activities) => {
                const activity = _find(activities, { id });
                if (!activity)
                    throw new Error('Activity not found');
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
    onActivityStarted(callback) {
        this._onActivityStartedCallbacks.push(callback);
    }
    turnOff() {
        return this.startActivity('off');
    }
    async startActivity(id) {
        id = changeCase.snakeCase(id.trim());
        return this.getActivities()
            .then((activities) => {
            let activity = _find(activities, { name: id });
            if (!activity)
                activity = _find(activities, { id });
            if (!activity)
                throw new Error('Activity not found');
            const cmd = 'harmony.activityengine?runactivity';
            const params = {
                async: 'false',
                timestamp: 0,
                args: { rule: 'start' },
                activityId: activity.id,
            };
            return this.runCmd(cmd, params);
        });
    }
    async runCmd(cmd, params) {
        const id = this._msgId++;
        const payload = {
            hubId: this._hubId,
            timeout: Math.floor(this.TIMEOUT / 1000),
            hbus: { cmd, id, params },
        };
        this.socket.send(JSON.stringify(payload), {});
        return this.responseAwait(id);
    }
    async responseAwait(msgId) {
        return new Promise((resolve, reject) => {
            let timeout;
            const responseHandler = (data) => {
                try {
                    const ob = JSON.parse(data.toString());
                    const { id, type } = ob;
                    if (msgId == id) {
                        clearTimeout(timeout);
                        this.socket.off('message', responseHandler);
                        resolve(JSON.parse(data));
                    }
                }
                catch (err) {
                    console.error(err);
                }
            };
            timeout = setTimeout(() => {
                reject(`Msg ${msgId} Timeout`);
                clearTimeout(timeout);
                this.socket.off('message', responseHandler);
            }, this.TIMEOUT);
            this.socket.on('message', responseHandler);
        });
    }
    handleNotify(ob) {
        const status = _get(ob, 'data.activityStatus');
        if (![0, 1].includes(status))
            return;
        const id = _get(ob, 'data.activityId', false);
        if (id === false || this._lastActivityId === id)
            return;
        this._lastActivityId = id;
        this.getActivities()
            .then((activities) => {
            const activity = _find(activities, { id });
            if (activity)
                this._onActivityStartedCallbacks.forEach(callback => callback(activity));
        })
            .catch(() => { });
    }
}
exports.default = HarmonyHub;
//# sourceMappingURL=harmony-ws.js.map