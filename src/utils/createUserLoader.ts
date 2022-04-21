import DataLoader from "dataloader";
import { User } from "../entities/User";
import { In } from "typeorm";

// userIds is an array like [1, 78, 8, 9] of userId
// we will return an array of user objects [{id: 1, username: 'test'}, {}, {}]
export const createUserLoader = () =>
  new DataLoader<number, User>(async (userIds) => {
    // Retrieve array of user objects for the provided userIds
    // const users = await User.findByIds(userIds as number[]); // findByIds is depreciated
    const users = await User.findBy({
      id: In(userIds as number[]),
    });

    // Setting up our empty object w types
    const userIdToUser: Record<number, User> = {};
    // for each user in our Users array we associate their ID to their user object
    users.forEach((u) => {
      userIdToUser[u.id] = u;
    });

    // Map and return the array of user objs
    const sortedUsers = userIds.map((userId) => userIdToUser[userId]);
    return sortedUsers;
  });
