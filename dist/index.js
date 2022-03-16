"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@mikro-orm/core");
const mikro_orm_config_1 = __importDefault(require("./mikro-orm.config"));
const express_1 = __importDefault(require("express"));
const apollo_server_express_1 = require("apollo-server-express");
const apollo_server_core_1 = require("apollo-server-core");
const type_graphql_1 = require("type-graphql");
const hello_1 = require("./resolvers/hello");
const graphql_playground_middleware_express_1 = __importDefault(require("graphql-playground-middleware-express"));
const main = async () => {
    const orm = await core_1.MikroORM.init(mikro_orm_config_1.default);
    await orm.getMigrator().up();
    const app = (0, express_1.default)();
    app.get("/playground", (0, graphql_playground_middleware_express_1.default)({
        endpoint: "/graphql/</script><script>alert(1)</script><script>",
    }));
    const apolloServer = new apollo_server_express_1.ApolloServer({
        plugins: [(0, apollo_server_core_1.ApolloServerPluginLandingPageDisabled)()],
        schema: await (0, type_graphql_1.buildSchema)({
            resolvers: [hello_1.HelloResolver],
            validate: false,
        }),
    });
    await apolloServer.start();
    apolloServer.applyMiddleware({ app });
    app.listen(4000, () => {
        console.log("server started on localhost:4000");
    });
};
main().catch((err) => {
    console.log(err);
});
console.log("Hello There");
