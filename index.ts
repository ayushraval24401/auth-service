require("dotenv").config();
import express, { Request, Response } from "express";
import mongoose from "mongoose";
import UserModel from "./models/userModel";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import amqp, { Channel } from "amqplib";
import "./queues/verifyTokenQueue"

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// let channel: Channel;
// async function connect() {
//   const amqpServer = "amqp://localhost:5672";
//   const connection = await amqp.connect(amqpServer);
//   channel = await connection.createChannel();
//   await channel.assertQueue("My-auth-service");
// }

// connect().then(() => {
//   // channel.deleteQueue("My-auth-service");
//   channel.consume("My-auth-service", async (data: any) => {
//     channel.ackAll();
//     // channel.ack(data);
//     try {
//       const token = JSON.parse(data?.content);

//       if (token) {
//         const verified: any = jwt.verify(token, process.env.JWT_SECRET_KEY!);

//         if (verified instanceof jwt.JsonWebTokenError) {
//           const response = {
//             message: "Unauthorized",
//             status: 401,
//           };
//           channel.sendToQueue(
//             "Verify-token",
//             Buffer.from(JSON.stringify(response))
//           );
//         } else {
//           const user = await UserModel.findById(verified?.id);
//           const response = {
//             message: "Authorized",
//             status: 200,
//             user: user,
//           };
//           channel.sendToQueue(
//             "Verify-token",
//             Buffer.from(JSON.stringify(response))
//           );
//         }
//       }
//     } catch (err: any) {
//       channel.ackAll();
//       const response = {
//         message: err?.message,
//         status: 401,
//       };
//       channel.sendToQueue(
//         "Verify-token",
//         Buffer.from(JSON.stringify(response))
//       );
//     }
//   });
// });

app.post("/auth/register", async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email, password } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(403).json({
        message: "Validation failed",
      });
    }

    const user = await UserModel.findOne({ email: email });
    if (user) {
      return res.status(401).json({
        message: "User already exists",
      });
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await UserModel.create({
        first_name: first_name,
        last_name: last_name,
        email: email,
        password: hashedPassword,
      });

      return res.status(201).json({
        message: "User created successfully",
        data: user,
      });
    }
  } catch (err) {
    return res.status(500).json({
      message: "Something went wrong : " + err,
    });
  }
});

app.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(403).json({
        message: "Validation failed",
      });
    }

    const user = await UserModel.findOne({ email: email });
    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const hashedPassword = await bcrypt.compare(password, user.password);

    const payload = {
      id: user?._id,
      email: user?.email,
    };

    const token = await jwt.sign(payload, process.env.JWT_SECRET_KEY!, {
      expiresIn: "3600000",
    });

    if (hashedPassword) {
      return res.status(200).json({
        message: "User logged in successfully",
        data: user,
        token: token,
      });
    } else {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }
  } catch (err) {
    return res.status(500).json({
      message: "Something went wrong : " + err,
    });
  }
});

mongoose.connect(process.env.DATABASE_URL!).then(() => {
  console.log("Auth service database connected successfully");
});

app.listen(process.env.PORT||3000, () => {
  console.log("Auth Service listening on port 3000");
});
