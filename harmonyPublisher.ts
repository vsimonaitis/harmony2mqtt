import HarmonyHub from "./harmony-ws"
import { MqttClient } from 'mqtt';
import mqtt = require('mqtt')
import dotenv = require('dotenv');


class HarmonyPublisher {

    private harmonyHub: any;
    private mqttClient: MqttClient;
    private static readonly topicPrefix = '/harmony2mqtt/';
    private publishInterval: NodeJS.Timeout = null;
    private currentActivityName: string;

    constructor() {
        dotenv.config();
        console.log(`Harrmony Hub is at ${process.env.HARMONYHUB_HOST}, MQTT is at ${process.env.MQTT_HOST}`);

        this.harmonyHub = new HarmonyHub(process.env.HARMONYHUB_HOST);
        this.mqttClient = mqtt.connect(process.env.MQTT_HOST, {
            username: process.env.MQTT_USER,
            password: process.env.MQTT_PASS,
            clientId: "Harmony2Mqtt_" + process.env.COMPUTERNAME + "_" + Math.random().toString(16).substr(2, 8),
            connectTimeout: 10 * 1000,
            keepalive: 60 // Seconds
        });
    }

    async start() {
        
        await this.harmonyHub.start();

        this.mqttClient.on('connect', () => { console.log(`Connected to MQTT`); });

        this.mqttClient.on('message', (topic, message, packet) => {
            // message is Buffer
            console.log(message.toString())
            switch (topic) {
                case HarmonyPublisher.topicPrefix + 'startActivity': {
                    this.startActivity(message.toString());
                }
                default:
                    console.warn("Unknown topic", topic);
            }
        });

        this.mqttClient.on('reconnect', () => { console.log(`Reconnecting to MQTT`); });
        this.mqttClient.on('close', () => { });
        this.mqttClient.on('disconnect', (packet) => { });
        this.mqttClient.on('error', (error) => { console.error(`MQTT error`, error); });





        // listen for changes to the current activity
        this.harmonyHub.onActivityStarted((activity: IActivity) => {
            console.log(`Activity started: ${activity.label}`);
            this.resyncCurrentActivity(activity);
        });

        this.resyncCurrentActivity();
    }

    publishMqttMessage(topic: string, msg: any) {
        if (this.mqttClient.connected) {
            this.mqttClient.publish(HarmonyPublisher.topicPrefix + topic, JSON.stringify(msg), { retain: true, qos: 0 });
        }
    }

    resyncCurrentActivity(activity?: IActivity) {
        clearInterval(this.publishInterval);
        this.publishCurrentActivity(activity);
        this.publishInterval = setInterval(() => { this.publishCurrentActivity() }, 5 * 60 * 1000);
    }

    publishCurrentActivity(activity?: IActivity) {
        try {
            if (activity) {
                return this.publishMqttMessage('currentActivity', activity);
            } else {
                return this.getCurrentActivity().then(activity => {
                    if (activity) { return this.publishMqttMessage('currentActivity', activity); }
                })
            }
        } catch (e) {
            console.error("Failed to update activity", e);
        }
    }

    getActivities(): Promise<IActivity[]> {
        return this.harmonyHub.getActivities()
            .then((activities) => {
                console.log(activities);
                return activities;
            });
    }


    getCurrentActivity(): Promise<IActivity> {
        return this.harmonyHub.getCurrentActivity()
            .then((activity) => {
                if (this.currentActivityName != activity.name) {
                    this.currentActivityName = activity.name;
                    console.log(`Current activity is: ${activity.label}`);
                }

                return activity;
            })
            .catch((error: Error) => { console.error('Error while getCurrentActivity from HarmonyHub', error.message); });
    }

    startActivity(activityName) {
        // start an activity by id, name, or label
        this.harmonyHub.startActivity(activityName)
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
        this.harmonyHub.refresh()
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