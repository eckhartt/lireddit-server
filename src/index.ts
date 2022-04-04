import "reflect-metadata";
import { MikroORM } from "@mikro-orm/core";
import { COOKIE_NAME, __prod__ } from "./constants";
// import { Post } from "./entities/Post";
import microConfig from "./mikro-orm.config";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginLandingPageDisabled } from "apollo-server-core";
import { buildSchema } from "type-graphql";
import expressPlayground from "graphql-playground-middleware-express";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import Redis from "ioredis";
import session from "express-session";
import connectRedis from "connect-redis";
import { __redisSecret__ } from "./redisSecret";
// import { MyContext } from "./types";
import cors from "cors";

const main = async () => {
  const orm = await MikroORM.init(microConfig); // Connect to postgresql database
  await orm.getMigrator().up(); // Run database migrations

  const app = express(); // Initialize express web server

  const RedisStore = connectRedis(session);
  const redis = new Redis();
  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  );

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({ client: redis as any, disableTouch: true }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        httpOnly: true,
        sameSite: "lax", // csrf
        secure: __prod__, // cookie only works in https
      },
      saveUninitialized: false,
      secret: __redisSecret__,
      resave: false,
    }) // Init express-session to connect to redis
  );

  app.get(
    "/playground",
    expressPlayground({
      endpoint: "/graphql/</script><script>alert(1)</script><script>",
    })
  ); // Provide a graphql playground. Need to move this elsewhere.

  const apolloServer = new ApolloServer({
    plugins: [ApolloServerPluginLandingPageDisabled()],
    schema: await buildSchema({
      resolvers: [PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({ em: orm.em, req, res, redis }),
  }); // Initialize apollo server

  await apolloServer.start(); // Wait for apollo server to be initialized
  apolloServer.applyMiddleware({ app, cors: false });

  app.listen(4000, () => {
    console.log("server started on localhost:4000");
  });
}; // Start web server listening on port 4000

main().catch((err) => {
  console.log(err);
}); // Catch errors and pass to console
