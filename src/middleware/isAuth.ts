import { MyContext } from "../types";
import { MiddlewareFn } from "type-graphql";


// Checks if a userId is stored in the session
export const isAuth: MiddlewareFn<MyContext> = ({ context}, next) => {
  if (!context.req.session.userId) {
    throw new Error("not authenticated");
  }
  return next();
};
