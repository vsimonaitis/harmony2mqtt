"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WebSocket = require("ws");
class WebSocketClient {
    constructor(url) {
        this.url = url;
        this.number = 0; // Message number
        this.autoReconnectInterval = 30 * 1000; // ms
        this.onopen = function (e) {
            console.info("WebSocketClient: open");
        };
        this.onmessage = function (data, number) {
            //console.debug("WebSocketClient: message", arguments);
        };
        this.onerror = function (e) {
            console.error("WebSocketClient: error", e);
        };
        this.onclose = function (e) {
            console.warn("WebSocketClient: closed", e);
        };
    }
    open() {
        return new Promise((resolve, reject) => {
            this.instance = new WebSocket(this.url);
            let timeout;
            this.instance.on('open', (e) => {
                this.onopen(e);
                timeout = setInterval(() => this.instance.ping(), 10000);
                resolve(this);
            });
            this.instance.on('message', (data) => {
                this.number++;
                this.onmessage(data, this.number);
            });
            this.instance.on('close', (code, reason) => {
                clearTimeout(timeout);
                switch (code) {
                    case 1000: // CLOSE_NORMAL
                        console.log("WebSocket: closed");
                        break;
                    default: // Abnormal closure
                        this.reconnect(new Error(code + ": " + reason));
                        break;
                }
                this.onclose(reason);
            });
            this.instance.on('error', (e) => {
                switch (e.name) {
                    case 'ECONNREFUSED':
                        this.reconnect(e);
                        break;
                    default:
                        this.onerror(e);
                        resolve();
                        break;
                }
            });
        });
    }
    on(event, listener) {
        return this.instance.on(event, listener);
    }
    off(event, listener) {
        return this.instance.off(event, listener);
    }
    send(data, option) {
        try {
            this.instance.send(data, option);
        }
        catch (e) {
            this.instance.emit('error', e);
        }
    }
    reconnect(e) {
        console.log(`WebSocketClient: retry in ${this.autoReconnectInterval}ms`);
        setTimeout(() => {
            this.instance.removeAllListeners();
            console.warn("WebSocketClient: reconnecting...");
            this.open();
        }, this.autoReconnectInterval);
    }
}
exports.default = WebSocketClient;
//# sourceMappingURL=websocket-client.js.map