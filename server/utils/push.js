const { Expo } = require("expo-server-sdk");
const expo = new Expo();

const sendPush = async (tokens, message) => {
  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title: "Smart Venue",
    body: message,
  }));

  const chunks = expo.chunkPushNotifications(messages);

  for (let chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk);
  }
};

module.exports = sendPush;