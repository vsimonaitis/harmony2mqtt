import HarmonyHub = require('harmony-ws');
import mqtt = require('mqtt')
import dotenv = require('dotenv');
import { MqttClient } from 'mqtt';

class HarmonyPublisher {

    private hub: any;
    private client: MqttClient;
    private static readonly topicPrefix = '/harmony2mqtt/';
    private publishInterval: NodeJS.Timeout = null;

    constructor() {
        dotenv.config();
        console.log(`Harrmony Hub is at ${process.env.HARMONYHUB_HOST}, MQTT is at ${process.env.MQTT_HOST}`);

        this.hub = new HarmonyHub(process.env.HARMONYHUB_HOST);
        this.client = mqtt.connect(process.env.MQTT_HOST, {
            username: process.env.MQTT_USER,
            password: process.env.MQTT_PASS,
            clientId: "Harmony2Mqtt",
            reconnectPeriod: 1000,
            connectTimeout: 10 * 1000
        });
    }




    start() {


        this.client.on('connect', function () {
            console.log(`Connected to MQTT`);

        });

        this.client.on('message', function (topic, message) {
            // message is Buffer
            console.log(message.toString())
            switch (topic) {
                case HarmonyPublisher.topicPrefix + 'startActivity': {
                    this.startActivity(message.toString());
                }

            }
        });

        // listen for changes to the current activity
        this.hub.onActivityStarted((activity) => {
            console.log(`Activity started: ${activity.label}`);
            this.resyncCurrentActivity(activity);
        });

        this.resyncCurrentActivity();
    }

    publishMqttMessage(topic: string, msg: any) {
        if (this.client.connected) {
            this.client.publish(HarmonyPublisher.topicPrefix + topic, JSON.stringify(msg), { retain: true, qos: 0 });
        }
    }

    resyncCurrentActivity(activity?: IActivity) {
        clearInterval(this.publishInterval);
        this.publishCurrentActivity(activity);
        this.publishInterval = setInterval(this.publishCurrentActivity.bind(this), 60 * 1000);
    }

    publishCurrentActivity(activity?: IActivity) {
        if (activity) {
            return this.publishMqttMessage('currentActivity', activity);
        } else {
            return this.getCurrentActivity().then(activity => {
                return this.publishMqttMessage('currentActivity', activity);
            })
        }
    }

    getActivities(): Promise<IActivity[]> {
        return this.hub.getActivities()
            .then((activities) => {
                console.log(activities);
                // [ { id: '-1', name: 'off', label: 'PowerOff' },
                // { id: '21642159', name: 'chromecast', label: 'Chromecast' },
                // { id: '26240332', name: 'tv', label: 'TV' },
                // { id: '26240296', name: 'roku', label: 'Roku' },
                // { id: '21641746', name: 'blu_ray', label: 'Blu-ray' } ]
                return activities;
            });
    }


    getCurrentActivity(): Promise<IActivity> {
        return this.hub.getCurrentActivity()
            .then((activity) => {
                console.log(`Current activity is: ${activity.label}`);

                return activity;
            });
    }

    startActivity(activityName) {
        // start an activity by id, name, or label
        this.hub.startActivity(activityName)
            .then((activity) => {
                console.log(`Started activity: ${activity.label}`);
            });
    }




    pressButton() {
        // press a button (on the current activity or a specific device)
        // optional second param is how long to hold the button (in milliseconds)
        // optional second/third param is which device to use
        // hub.pressButton('volume down', 2000, 'samsung tv')
        //     .then((button) => {
        //         console.log(`Pressed button: ${button.label}`);
        //     });

        // alias for startActivity('off')
        // hub.turnOff();

        // refresh the internal cache
        this.hub.refresh()
            .then((activities) => {
                console.log('Updated activity list', activities);
            });

    }
}

interface IActivity {
    id: string;
    name: string;
    label: string;

}

export = new HarmonyPublisher().start();