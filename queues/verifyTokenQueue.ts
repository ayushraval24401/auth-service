import jwt from "jsonwebtoken";
import amqp, { Channel } from "amqplib";
import UserModel from "../models/userModel";

let channel: Channel;
async function connect() {
  const amqpServer = "amqp://localhost:5672";
  const connection = await amqp.connect(amqpServer);
  channel = await connection.createChannel();
  await channel.assertQueue("My-auth-service");
}

connect().then(() => {
//   channel.deleteQueue("My-auth-service");
  channel.consume("My-auth-service", async (data: any) => {
    channel.ackAll();
    // channel.ack(data);
    try {
      const token = JSON.parse(data?.content);

      if (token) {
        const verified: any = jwt.verify(token, process.env.JWT_SECRET_KEY!);

        if (verified instanceof jwt.JsonWebTokenError) {
          const response = {
            message: "Unauthorized",
            status: 401,
          };
          channel.sendToQueue(
            "Verify-token",
            Buffer.from(JSON.stringify(response))
          );
        } else {
          const user = await UserModel.findById(verified?.id);
          const response = {
            message: "Authorized",
            status: 200,
            user: user,
          };
          channel.sendToQueue(
            "Verify-token",
            Buffer.from(JSON.stringify(response))
          );
        }
      }
    } catch (err: any) {
      channel.ackAll();
      const response = {
        message: err?.message,
        status: 401,
      };
      channel.sendToQueue(
        "Verify-token",
        Buffer.from(JSON.stringify(response))
      );
    }
  });
});
