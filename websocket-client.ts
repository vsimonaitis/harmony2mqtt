import WebSocket = require('ws');

export default class WebSocketClient {
    number: number = 0;	// Message number
    readonly autoReconnectInterval = 30 * 1000;	// ms
    instance: WebSocket;

    constructor(private url: string) {

    }

    open() {
        return new Promise<WebSocketClient>((resolve, reject) => {
            this.instance = new WebSocket(this.url);
            let timeout: NodeJS.Timeout;
            this.instance.on('open', (e) => {
                this.onopen(e);
                timeout = setInterval(() => this.instance.ping(), 10000)
                resolve(this);
            });
            this.instance.on('message', (data) => {
                this.number++;
                this.onmessage(data, this.number);
            });
            this.instance.on('close', (code, reason) => {
                clearTimeout(timeout);
                switch (code) {
                    case 1000:	// CLOSE_NORMAL
                        console.log("WebSocket: closed");
                        break;
                    default:	// Abnormal closure
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

    on(event: 'message', listener: (this: WebSocket, data: WebSocket.Data) => void) {
        return this.instance.on(event, listener);
    }
    off(event: string | symbol, listener: (...args: any[]) => void) {
        return this.instance.off(event, listener);
    }
    send(data, option) {
        try {
            this.instance.send(data, option);
        } catch (e) {
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
    onopen = function (e) {
        console.info("WebSocketClient: open");
    }
    onmessage = function (data, number) {
        //console.debug("WebSocketClient: message", arguments);
    }
    onerror = function (e) { 
        console.error("WebSocketClient: error", e); 
    }
    onclose = function (e) { 
        console.warn("WebSocketClient: closed", e); 
    }

}
