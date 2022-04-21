// import { EntityManager, IDatabaseDriver, Connection } from "@mikro-orm/core"
import { Request, Response } from "express";
//@ts-ignore
import { Session } from "express-session";
import Redis from "ioredis";
import { createUserLoader } from "./utils/createUserLoader";

export type MyContext = {
  // em: EntityManager<IDatabaseDriver<Connection>>
  req: Request & { session: Session };
  redis: Redis;
  res: Response;
  // ReturnType gives the returned value of a function
  userLoader: ReturnType<typeof createUserLoader>;
};

declare module "express-session" {
  interface Session {
    userId: number;
  }
}
