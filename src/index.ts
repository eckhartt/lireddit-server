import { MikroORM } from "@mikro-orm/core";
import { __prod__ } from "./constants";
// import { Post } from "./entities/Post";
import microConfig from "./mikro-orm.config";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginLandingPageDisabled } from "apollo-server-core";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import expressPlayground from "graphql-playground-middleware-express";

const main = async () => {
  const orm = await MikroORM.init(microConfig); // Connect to postgresql database
  await orm.getMigrator().up(); // Run database migrations

  const app = express(); // Initialize express web server

  app.get(
    "/playground",
    expressPlayground({
      endpoint: "/graphql/</script><script>alert(1)</script><script>",
    })
  ); // Provide a graphql playground. Need to move this elsewhere. 

  const apolloServer = new ApolloServer({
    plugins: [ApolloServerPluginLandingPageDisabled()],
    schema: await buildSchema({
      resolvers: [HelloResolver],
      validate: false,
    }),
  }); // Initialize apollo server

  await apolloServer.start(); // Wait for apollo server to be initialized
  apolloServer.applyMiddleware({ app });

  app.listen(4000, () => {
    console.log("server started on localhost:4000");
  });
}; // Start web server listening on port 4000 

main().catch((err) => {
  console.log(err);
}); // Catch errors and pass to console 

console.log("Hello There");
