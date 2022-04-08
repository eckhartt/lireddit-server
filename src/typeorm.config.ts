import path from "path";
import { DataSource } from "typeorm";
import { Post } from "./entities/Post";
import { User } from "./entities/User";

// Creating new typeorm datasource
const postgresDataSource = new DataSource({
  type: "postgres",
  database: "lireddit2",
  username: "postgres",
  password: "postgres",
  logging: true,
  synchronize: true,
  migrations: [path.join(__dirname, "/migrations/*")],
  entities: [Post, User],
});

export default postgresDataSource;
