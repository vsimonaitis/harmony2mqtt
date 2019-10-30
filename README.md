# harmony2mqtt
Harmony Hub to MQTT bridge. All Harmony Hub events are posted though MQTT messages. Subscribe to topic `/harmony2mqtt/startActivity` to receive current status of your media.

```console
docker run -it --name=harmony2mqtt --restart always -e MQTT_HOST=mqtts://localhost:1883 -e HARMONYHUB_HOST=192.168.1.2 vsimonaitis/harmony2mqtt
```
# Environment variable example
* HARMONYHUB_HOST=192.168.1.2
* MQTT_HOST=mqtts://localhost:1883
* MQTT_USER=username
* MQTT_PASS=password
 
