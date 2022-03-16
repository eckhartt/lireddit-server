import { __prod__ } from "./constants";
import { Post } from "./entities/Post";
import { MikroORM } from "@mikro-orm/core";
import path from 'path';

console.log("dirname is:",__dirname);

export default {
  migrations: {
    path: path.join(__dirname, "./migrations"), // path to the folder with migrations
    glob: "!(*.d).{js,ts}", // how to match migration files (all .js and .ts files, but not .d.ts)
  },
  entities: [Post],
  dbName: "lireddit",
  user: "postgres",
  password: "postgres",
  type: "postgresql",
  debug: !__prod__,
  allowGlobalContext: true,
} as Parameters<typeof MikroORM.init>[0]; // This tells typescript to source the correct parameters directly from the module
