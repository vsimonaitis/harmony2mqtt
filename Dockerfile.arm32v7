FROM alpine AS builder

# Download QEMU, see https://github.com/docker/hub-feedback/issues/1261
ENV QEMU_URL https://github.com/balena-io/qemu/releases/download/v3.0.0%2Bresin/qemu-3.0.0+resin-arm.tar.gz
RUN apk add curl && curl -L ${QEMU_URL} | tar zxvf - -C . --strip-components 1

# Set the base image
FROM arm32v7/node:alpine

# Add QEMU
COPY --from=builder qemu-arm-static /usr/bin

# File Author / Maintainer
LABEL Vilius Simonaitis

# Copy the application folder inside the container
ADD . /harmony2mqtt

# Set environment prameters
ENV HARMONYHUB_HOST=192.168.1.7
ENV MQTT_HOST=mqtts://localhost:1883
ENV MQTT_USER=user
ENV MQTT_PASS=pass

# Set the default directory where CMD will execute
WORKDIR /harmony2mqtt

RUN npm install --production

# Set the default command to execute 
CMD node dist/harmonyPublisher.js
