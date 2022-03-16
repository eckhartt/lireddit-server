"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_express_1 = require("apollo-server-express");
const apollo_server_core_1 = require("apollo-server-core");
const server = new apollo_server_express_1.ApolloServer({
    typeDefs,
    resolvers,
    plugins: [
        (0, apollo_server_core_1.ApolloServerPluginLandingPageDisabled)(),
    ],
});
