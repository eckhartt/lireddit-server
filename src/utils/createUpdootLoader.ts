import DataLoader from "dataloader";
import { In } from "typeorm";
import { Updoot } from "../entities/Updoot";

// the key is an array like [{postId: 5, userId: 1}, {}, {}]
// we return {postId: 5, userId: 1, value: 1}
export const createUpdootLoader = () =>
  new DataLoader<{ postId: number; userId: number }, Updoot | null>(
    async (keys) => {
      console.log(`------------------------keys: `, keys);

      // const updoots = await Updoot.findByIds(keys as any);
      // findByIds is depreciated so we need to use findBy({id: In(key)})
      // So we have keys which is { postId: 224, userId: 17 }, { postId: 207, userId: 17 } ....
      // and what we need is postId = [224, 207] and userId = [17, 17]

      // Separating into two arrays
      const postIdKeysArray: number[] = [];
      const userIdKeysArray: number[] = [];

      for (var i = 0; i < keys.length; i++) {
        postIdKeysArray.push(keys[i].postId);
        userIdKeysArray.push(keys[i].userId);
      }

      // Retrieving updoots
      const updoots = await Updoot.findBy({
        postId: In(postIdKeysArray),
        userId: In(userIdKeysArray),
      });

      // Setting up our empty object w types
      const updootIdsToUpdoot: Record<string, Updoot> = {};
      // for each user in our ?? array we associate their ID to their ?? object
      updoots.forEach((updoot) => {
        updootIdsToUpdoot[`${updoot.userId}|${updoot.postId}`] = updoot;
      });

      // Map and return the array of
      const sortedUpdoots = keys.map(
        (key) => updootIdsToUpdoot[`${key.userId}|${key.postId}`]
      );

      return sortedUpdoots;
    }
  );
