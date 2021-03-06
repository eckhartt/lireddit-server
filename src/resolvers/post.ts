import { Updoot } from "../entities/Updoot";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { Post } from "../entities/Post";
import { isAuth } from "../middleware/isAuth";
import postgresDataSource from "../typeorm.config";
import { MyContext } from "../types";
import { User } from "../entities/User";

// Define fields we expect in input field PostInput
@InputType()
class PostInput {
  @Field()
  title!: string;
  @Field()
  text!: string;
}

// Define fields we expect in object PaginatedPosts
@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts!: Post[];
  @Field()
  hasMore!: boolean;
}

@Resolver(Post)
export class PostResolver {
  // creator - provides graphql access to know who a user is by the creatorId on each post
  // userLoader accepts an array of creatorId numbers
  // Returns promise of a User object
  @FieldResolver(() => User)
  creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
    return userLoader.load(post.creatorId);
    // return User.findOne({ where: { id: post.creatorId } });
  }

  // textSnippet - provides graphql access to the first 50 characters of the text field on post
  //
  //
  @FieldResolver(() => String)
  textSnippet(@Root() post: Post) {
    return post.text.slice(0, 50);
  }

  // vote status
  //
  // Returns promise of either a number value or null for each Post it resolves 
  @FieldResolver(() => Int, { nullable: true })
  async voteStatus(
    @Root() post: Post,
    @Ctx() { updootLoader, req }: MyContext
  ) {
    if (!req.session.userId) {
      return null;
    }

    const updoot = await updootLoader.load({
      postId: post.id,
      userId: req.session.userId,
    });

    return updoot ? updoot.value : null;
  }

  // Post voting
  //
  //
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx()
    { req }: MyContext
  ) {
    // If value is anything but -1, we consider it an updoot. Prevents malicious data
    const isUpdoot = value !== -1;
    // If isUpdoot is true, pass 1. Otherwise -1.
    const realValue = isUpdoot ? 1 : -1;
    // Grab userId from session
    const { userId } = req.session;
    // Checking if user has already voted on postId yet (and is thus on Updoot table)
    const updoot = await Updoot.findOne({ where: { postId, userId } });

    // if the user has voted on the post before and they are changing their vote
    if (updoot && updoot.value !== realValue) {
      await postgresDataSource.transaction(async (tm) => {
        await tm.query(
          `
    update updoot
    set value = $1
    where "postId" = $2 and "userId" = $3
          `,
          [realValue, postId, userId]
        );
        await tm.query(
          `
    update post
    set points = points + $1
    where id = $2
          `,
          [2 * realValue, postId]
        );
      });
    } else if (!updoot) {
      // else if user has never voted before
      await postgresDataSource.transaction(async (tm) => {
        await tm.query(
          `
    insert into updoot ("userId", "postId", value)
    values ($1, $2, $3);
          `,
          [userId, postId, realValue]
        );
        await tm.query(
          `
    update post
    set points = points + $1
    where id = $2
        `,
          [realValue, postId]
        );
      });
    }
    return true;
  }

  // QUERY all posts
  // Requires a limit (capped to 50). Accepts a cursor position using the datestamp of the post.
  // All posts before the cursor position, within the limit, are returned in createdAt descending order.
  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null, // This will be the datestamp the post was created
    @Ctx() { req }: MyContext
  ): Promise<PaginatedPosts> {
    // Check if limit provided is less than 50. If not, cap it at 50 results.
    const realLimit = Math.min(50, limit);
    //  +1 to enable us to check if there are more results available
    const realLimitPlusOne = realLimit + 1;

    // Setting up sql replacements
    const replacements: any[] = [realLimitPlusOne]; //, req.session.userId];

    // if cursor has been passed in, add it to replacements array
    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }

    // Connect to postgres via typeorm and create a query
    const posts = await postgresDataSource.query(
      `
      select p.*
      from post p
      ${cursor ? `where p."createdAt" < $2` : ""}
      order by p."createdAt" DESC
      limit $1
      `,
      replacements
    );

    // Connect to postgres via typeorm and create a querybuilder
    // const qb = postgresDataSource
    //   .getRepository(Post)
    //   .createQueryBuilder("p")
    //   .innerJoinAndSelect("p.creator", "u", 'u.id = p."creatorId"')
    //   .orderBy('"createdAt"', "DESC")
    //   .take(realLimitPlusOne);

    // If cursor value is not null, modify query to pull posts that were created before that date value
    // if (cursor) {
    //   qb.where('"createdAt" < :cursor', { cursor: new Date(parseInt(cursor)) });
    // }

    // Finish query and return results
    // const posts = await qb.getMany();
    return {
      // slice results so user recieves the requested number of posts
      posts: posts.slice(0, realLimit),
      // If there are more results available, passes true
      hasMore: posts.length === realLimitPlusOne,
    };
  }

  // Graphql query 'post' accepts an id arg and will return either null Or the result for matching id of type Post
  // relations creates a join in the sql request
  //
  @Query(() => Post, { nullable: true })
  post(@Arg("id", () => Int) id: number): Promise<Post | null> {
    // TODO: Extend to acquire vote status for single page voting view
    return Post.findOne({ where: { id } });
  }

  // Graphql mutation 'createPost' accepts a title arg and then em.create() a post entry
  //
  //
  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    return Post.create({
      ...input,
      creatorId: req.session.userId,
    }).save();
  }

  // Graphql mutation 'updatePost' accepts an id and title arg, checks if it can find the post with that id (else null) and then updates the post.title to the title provided
  //
  //
  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  async updatePost(
    @Arg("id", () => Int) id: number,
    @Arg("title") title: string,
    @Arg("text") text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const result = await postgresDataSource
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id = :id and "creatorId" = :creatorId', {
        id,
        creatorId: req.session.userId,
      })
      .returning("*")
      .execute();

    return result.raw[0];
  }

  // Graphql mutation 'deletePost' accepts an id and then em.nativeDelete() the post entry where matching id
  //
  //
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    // Delete entry from Post table if user is creator
    await Post.delete({ id, creatorId: req.session.userId });
    return true;
  }
}
