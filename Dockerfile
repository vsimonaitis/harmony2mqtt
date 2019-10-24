# Set the base image
FROM hypriot/rpi-node

# File Author / Maintainer
LABEL Vilius Simonaitis

# Copy the application folder inside the container
ADD . /harmony2mqtt

# Set environment prameters
ENV HARMONY_HOST=192.168.1.7
ENV MQTT_HOST=mqtts://localhost:1883
ENV MQTT_USER=user
ENV MQTT_PASS=pass

# Set the default directory where CMD will execute
WORKDIR /harmony2mqtt

RUN npm install --production

# Set the default command to execute 
CMD node dist/index.js 